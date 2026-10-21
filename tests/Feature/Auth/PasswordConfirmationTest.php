<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PasswordConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_confirm_password_screen_can_be_rendered()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get(route('password.confirm'));

        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('auth/confirm-password'),
        );
    }

    public function test_password_confirmation_requires_authentication()
    {
        $response = $this->get(route('password.confirm'));

        $response->assertRedirect(route('login'));
    }

    public function test_password_can_be_confirmed_without_a_login_field(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('password.confirm.store'), [
            'password' => 'password',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('auth.password_confirmed_at');
    }

    public function test_incorrect_password_cannot_be_confirmed(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('password.confirm.store'), [
            'password' => 'incorrect-password',
        ]);

        $response->assertSessionHasErrors('password');
        $response->assertSessionMissing('auth.password_confirmed_at');
    }
}
