<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserAdministrationService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $user = User::create([
                'name' => $data['name'],
                'username' => strtolower($data['username']),
                'email' => strtolower($data['email']),
                'email_verified_at' => now(),
                'password' => Hash::make($data['password']),
                'is_active' => $data['is_active'] ?? true,
                'is_super_admin' => $data['is_super_admin'] ?? false,
            ]);

            $user->roles()->sync($data['roles'] ?? []);

            return $user;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $user, array $data): User
    {
        return DB::transaction(function () use ($user, $data): User {
            $this->guardSuperAdminSafety($user, $data);

            $user->update([
                'name' => $data['name'],
                'username' => strtolower($data['username']),
                'email' => strtolower($data['email']),
                'is_active' => $data['is_active'] ?? $user->is_active,
                'is_super_admin' => $data['is_super_admin'] ?? $user->is_super_admin,
            ]);
            $user->roles()->sync($data['roles'] ?? []);

            return $user->refresh();
        });
    }

    public function resetPassword(User $user, string $password): void
    {
        $user->update(['password' => Hash::make($password)]);
    }

    public function delete(User $actor, User $user): void
    {
        DB::transaction(function () use ($actor, $user): void {
            if ($actor->is($user)) {
                throw ValidationException::withMessages(['user' => 'You cannot delete your own account.']);
            }

            $this->guardFinalActiveSuperAdmin($user);
            $user->delete();
        });
    }

    /** @param array<string, mixed> $data */
    private function guardSuperAdminSafety(User $user, array $data): void
    {
        $isRemovingAccess = ($data['is_super_admin'] ?? $user->is_super_admin) === false
            || ($data['is_active'] ?? $user->is_active) === false;

        if ($user->is_super_admin && $user->is_active && $isRemovingAccess) {
            $this->guardFinalActiveSuperAdmin($user);
        }
    }

    private function guardFinalActiveSuperAdmin(User $user): void
    {
        if ($user->is_super_admin && $user->is_active && User::query()->where('is_super_admin', true)->where('is_active', true)->count() <= 1) {
            throw ValidationException::withMessages(['user' => 'The final active Super Admin cannot be removed.']);
        }
    }
}
