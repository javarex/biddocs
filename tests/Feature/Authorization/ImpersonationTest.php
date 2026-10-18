<?php

namespace Tests\Feature\Authorization;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ImpersonationTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_impersonate_an_active_standard_user_and_leave(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create(['is_active' => true, 'is_super_admin' => false]);

        $this->actingAs($admin)
            ->post(route('admin.users.impersonate', $target))
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($target);

        $this->post(route('impersonation.leave'))
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($admin);
    }

    public function test_normal_users_cannot_start_impersonation(): void
    {
        $user = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($user)
            ->post(route('admin.users.impersonate', $target))
            ->assertForbidden();
    }

    public function test_impersonated_pages_share_only_the_target_users_permissions(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create(['is_active' => true, 'is_super_admin' => false]);
        $permission = Permission::query()->create([
            'name' => 'View imports',
            'slug' => 'imports.view',
            'group' => 'Imports',
        ]);
        $role = Role::query()->create(['name' => 'Import viewer', 'slug' => 'import-viewer']);
        $role->permissions()->attach($permission);
        $target->roles()->attach($role);

        $this->actingAs($admin)
            ->post(route('admin.users.impersonate', $target))
            ->assertRedirect(route('dashboard'));

        $response = $this->get('https://bds.test/admin/imports');

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/imports/index')
            ->where('auth.user.id', $target->id)
            ->where('auth.user.is_super_admin', false)
            ->where('auth.permissions', ['imports.view'])
            ->where('impersonation.active', true)
            ->where('impersonation.originalUser.id', $admin->id));

        $page = $response->viewData('page');
        $this->assertTrue($page['clearHistory'] ?? false);
        $this->assertTrue($page['encryptHistory'] ?? false);
    }

    public function test_inactive_and_super_admin_users_cannot_be_impersonated(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $inactive = User::factory()->create(['is_active' => false]);
        $secondAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($admin)
            ->post(route('admin.users.impersonate', $inactive))
            ->assertStatus(422);

        $this->actingAs($admin)
            ->post(route('admin.users.impersonate', $secondAdmin))
            ->assertStatus(422);
    }

    public function test_inertia_transitions_reload_the_client_and_clear_password_confirmation(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();

        $this->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('admin.users.impersonate', $target), [], ['X-Inertia' => 'true'])
            ->assertStatus(409)->assertHeader('X-Inertia-Location', route('dashboard'))
            ->assertSessionMissing('auth.password_confirmed_at');
        $this->assertAuthenticatedAs($target);
        $this->get(route('admin.users.index'))->assertForbidden();
        $this->get(route('security.edit'))->assertRedirect(route('password.confirm'));

        $this->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('impersonation.leave'), [], ['X-Inertia' => 'true'])
            ->assertStatus(409)->assertHeader('X-Inertia-Location', route('dashboard'))
            ->assertSessionMissing('auth.password_confirmed_at')
            ->assertSessionMissing('impersonate');
        $this->assertAuthenticatedAs($admin);
        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.id', $admin->id)
            ->where('auth.permissions', ['*'])
            ->where('impersonation.active', false)
            ->where('impersonation.originalUser', null));
    }

    public function test_nested_impersonation_is_denied(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();
        $this->post(route('admin.users.impersonate', $other))->assertForbidden();
        $this->assertAuthenticatedAs($target);
        $this->assertSame($admin->id, session('impersonate.impersonator'));
    }

    public function test_revoked_impersonators_cannot_restore_administrator_access(): void
    {
        foreach (['deactivated', 'demoted', 'deleted'] as $change) {
            $admin = User::factory()->create(['is_super_admin' => true]);
            $target = User::factory()->create();
            $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();

            match ($change) {
                'deactivated' => $admin->update(['is_active' => false]),
                'demoted' => $admin->update(['is_super_admin' => false]),
                'deleted' => $admin->delete(),
            };

            $this->post(route('impersonation.leave'))->assertRedirect(route('login'))
                ->assertSessionMissing('impersonate');
            $this->assertGuest();
        }
    }

    public function test_a_deleted_impersonator_does_not_crash_page_rendering(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();
        $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();
        $admin->delete();

        $this->get(route('dashboard'), ['X-Inertia' => 'true'])
            ->assertStatus(409)->assertHeader('X-Inertia-Location', route('login'));
        $this->assertGuest();
    }

    public function test_a_target_promoted_to_super_admin_ends_the_impersonation_session(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();
        $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();
        $target->update(['is_super_admin' => true]);
        $this->app['auth']->forgetGuards();

        $this->get(route('admin.users.index'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_an_inactive_target_can_still_leave_impersonation(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();
        $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();
        $target->update(['is_active' => false]);
        $this->app['auth']->forgetGuards();

        $this->post(route('impersonation.leave'))->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($admin);
    }

    public function test_a_deleted_target_is_logged_out_without_a_server_error(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $target = User::factory()->create();
        $this->actingAs($admin)->post(route('admin.users.impersonate', $target))->assertRedirect();
        $target->delete();
        $this->app['auth']->forgetGuards();

        $this->get(route('dashboard'))->assertRedirect(route('login'))
            ->assertSessionMissing('impersonate');
        $this->assertGuest();
    }
}
