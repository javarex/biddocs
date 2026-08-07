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

        $response = $this->get(route('admin.imports.index'));

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
}
