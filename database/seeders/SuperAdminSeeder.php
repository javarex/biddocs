<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $name = (string) config('super-admin.name');
        $email = strtolower((string) config('super-admin.email'));
        $password = (string) config('super-admin.password');

        if ($name === '' || $email === '' || $password === '') {
            throw new InvalidArgumentException('SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD must be set before seeding.');
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('SUPER_ADMIN_EMAIL must be a valid email address.');
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
                'is_super_admin' => true,
                'is_active' => true,
            ],
        );
    }
}
