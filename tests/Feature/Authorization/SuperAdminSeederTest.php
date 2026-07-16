<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SuperAdminSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_seeder_is_idempotent_and_uses_environment_values(): void
    {
        putenv('SUPER_ADMIN_NAME=Seeded Administrator');
        putenv('SUPER_ADMIN_EMAIL=seeded@example.com');
        putenv('SUPER_ADMIN_PASSWORD=seeded-password');

        $this->seed(SuperAdminSeeder::class);
        $this->seed(SuperAdminSeeder::class);

        $user = User::where('email', 'seeded@example.com')->firstOrFail();
        $this->assertSame(1, User::where('email', 'seeded@example.com')->count());
        $this->assertSame('Seeded Administrator', $user->name);
        $this->assertTrue($user->is_super_admin);
        $this->assertTrue($user->is_active);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('seeded-password', $user->password));
    }
}
