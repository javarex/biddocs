<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InactiveUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_inactive_users_cannot_log_in(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->post(route('login.store'), [
            'login' => $user->username,
            'password' => 'password',
        ]);

        $this->assertGuest();
    }

    public function test_deactivated_accounts_are_logged_out_and_show_a_login_error(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('login'))
            ->assertSessionHasErrors(['login' => 'Your account is inactive.']);

        $this->assertGuest();
    }
}
