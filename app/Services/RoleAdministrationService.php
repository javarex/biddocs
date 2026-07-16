<?php

namespace App\Services;

use App\Models\Role;
use Illuminate\Support\Facades\DB;

class RoleAdministrationService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): Role
    {
        return DB::transaction(function () use ($data): Role {
            $role = Role::create(collect($data)->except('permissions')->all());
            $role->permissions()->sync($data['permissions'] ?? []);

            return $role;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Role $role, array $data): Role
    {
        return DB::transaction(function () use ($role, $data): Role {
            $role->update(collect($data)->except('permissions')->all());
            $role->permissions()->sync($data['permissions'] ?? []);

            return $role->refresh();
        });
    }
}
