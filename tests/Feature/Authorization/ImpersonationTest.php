<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
