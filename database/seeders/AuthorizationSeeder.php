<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class AuthorizationSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['name' => 'View dashboard', 'slug' => 'dashboard.view', 'group' => 'Dashboard'],
            ['name' => 'View users', 'slug' => 'users.view', 'group' => 'Users'],
            ['name' => 'Create users', 'slug' => 'users.create', 'group' => 'Users'],
            ['name' => 'Update users', 'slug' => 'users.update', 'group' => 'Users'],
            ['name' => 'Delete users', 'slug' => 'users.delete', 'group' => 'Users'],
            ['name' => 'View roles', 'slug' => 'roles.view', 'group' => 'Roles'],
            ['name' => 'Create roles', 'slug' => 'roles.create', 'group' => 'Roles'],
            ['name' => 'Update roles', 'slug' => 'roles.update', 'group' => 'Roles'],
            ['name' => 'Delete roles', 'slug' => 'roles.delete', 'group' => 'Roles'],
            ['name' => 'View settings', 'slug' => 'settings.view', 'group' => 'Settings'],
            ['name' => 'View imports', 'slug' => 'imports.view', 'group' => 'Imports'],
            ['name' => 'Create imports', 'slug' => 'imports.create', 'group' => 'Imports'],
            ['name' => 'Download import errors', 'slug' => 'imports.download_errors', 'group' => 'Imports'],
            ['name' => 'Delete import history', 'slug' => 'imports.delete', 'group' => 'Imports'],
            ['name' => 'View projects', 'slug' => 'projects.view', 'group' => 'Projects'],
            ['name' => 'Import project data', 'slug' => 'projects.import', 'group' => 'Projects'],
            ['name' => 'View project bid documents', 'slug' => 'projects.bid_docs.view', 'group' => 'Projects'],
            ['name' => 'Delete projects', 'slug' => 'projects.delete', 'group' => 'Projects'],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(['slug' => $permission['slug']], $permission);
        }

        $role = Role::updateOrCreate(
            ['slug' => 'administrator'],
            ['name' => 'Administrator', 'description' => 'Full application access through explicit permissions.'],
        );
        $role->permissions()->sync(Permission::query()->pluck('id'));
    }
}
