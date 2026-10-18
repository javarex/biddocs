<?php

namespace Tests\Feature\Authorization;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_super_admin' => true]);
    }

    public function test_super_admin_can_create_and_update_a_user(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->post(route('admin.users.store'), [
            'name' => 'New User',
            'username' => 'new-user',
            'email' => 'new@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect(route('admin.users.index'));

        $user = User::where('email', 'new@example.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);

        $this->actingAs($admin)->put(route('admin.users.update', $user), [
            'name' => 'Updated User',
            'username' => 'updated-user',
            'email' => 'updated@example.com',
            'is_active' => false,
            'is_super_admin' => false,
            'roles' => [],
        ])->assertRedirect(route('admin.users.show', $user));

        $this->assertDatabaseHas('users', ['username' => 'updated-user', 'email' => 'updated@example.com', 'name' => 'Updated User', 'is_active' => false]);
    }

    public function test_super_admin_can_reset_a_password(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();

        $this->actingAs($admin)->put(route('admin.users.password', $user), [
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertRedirect();

        $this->assertTrue(Hash::check('new-password', $user->refresh()->password));
    }

    public function test_editing_a_user_loads_and_preserves_their_assigned_roles(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();
        $role = Role::query()->create(['name' => 'Estimator', 'slug' => 'estimator']);
        $user->roles()->attach($role);

        $this->actingAs($admin)->get(route('admin.users.edit', $user))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('user.roles.0.id', $role->id)
            ->where('user.roles.0.name', 'Estimator'));

        $this->put(route('admin.users.update', $user), [
            'name' => 'Updated Estimator', 'username' => $user->username, 'email' => $user->email,
            'roles' => [$role->id],
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('role_user', ['user_id' => $user->id, 'role_id' => $role->id]);
    }

    public function test_numeric_boolean_values_cannot_remove_the_final_active_super_admin(): void
    {
        $admin = $this->admin();

        foreach ([0, '0', false] as $value) {
            foreach (['is_active', 'is_super_admin'] as $flag) {
                $this->actingAs($admin)->put(route('admin.users.update', $admin), [
                    'name' => $admin->name, 'username' => $admin->username, 'email' => $admin->email,
                    $flag => $value,
                ])->assertSessionHasErrors('user');
            }
        }

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true, 'is_super_admin' => true]);
    }

    public function test_self_deletion_is_prevented(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->delete(route('admin.users.destroy', $admin))
            ->assertSessionHasErrors('user');
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_final_active_super_admin_cannot_be_demoted_or_deleted(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->put(route('admin.users.update', $admin), [
            'name' => $admin->name,
            'username' => $admin->username,
            'email' => $admin->email,
            'is_active' => true,
            'is_super_admin' => false,
            'roles' => [],
        ])->assertSessionHasErrors('user');

        $this->actingAs($admin)->delete(route('admin.users.destroy', $admin))
            ->assertSessionHasErrors('user');
    }

    public function test_a_user_can_be_promoted_and_demoted_when_another_active_super_admin_exists(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();

        $payload = ['name' => $user->name, 'username' => $user->username, 'email' => $user->email, 'is_active' => true, 'is_super_admin' => true, 'roles' => []];
        $this->actingAs($admin)->put(route('admin.users.update', $user), $payload)->assertRedirect();
        $this->assertTrue($user->refresh()->is_super_admin);

        $payload['is_super_admin'] = false;
        $this->actingAs($admin)->put(route('admin.users.update', $user), $payload)->assertRedirect();
        $this->assertFalse($user->refresh()->is_super_admin);
    }
}
