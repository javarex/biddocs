<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
    }

    public function test_http_lan_requests_do_not_require_history_encryption(): void
    {
        $this->actingAs(User::factory()->create());

        $response = $this->get('http://192.168.160.99:8001/dashboard');

        $response->assertOk();
        $this->assertFalse($response->viewData('page')['encryptHistory'] ?? false);
    }

    public function test_https_requests_keep_history_encryption(): void
    {
        $this->actingAs(User::factory()->create());

        $response = $this->get('https://bds.test/dashboard');

        $response->assertOk();
        $this->assertTrue($response->viewData('page')['encryptHistory'] ?? false);
    }
}
