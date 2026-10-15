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
            ['name' => 'View libraries', 'slug' => 'libraries.view', 'group' => 'Libraries'],
            ['name' => 'Create libraries', 'slug' => 'libraries.create', 'group' => 'Libraries'],
            ['name' => 'Update libraries', 'slug' => 'libraries.update', 'group' => 'Libraries'],
            ['name' => 'Delete libraries', 'slug' => 'libraries.delete', 'group' => 'Libraries'],
            ['name' => 'Create items', 'slug' => 'items.create', 'group' => 'Items'],
            ['name' => 'Edit items', 'slug' => 'items.update', 'group' => 'Items'],
            ['name' => 'Delete items', 'slug' => 'items.delete', 'group' => 'Items'],
            ['name' => 'Encode item prices', 'slug' => 'items.prices.encode', 'group' => 'Items'],
            ['name' => 'Sync items', 'slug' => 'items.sync', 'group' => 'Items'],
            ['name' => 'Sync categories', 'slug' => 'categories.sync', 'group' => 'Categories'],
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
            ['name' => 'View import history', 'slug' => 'imports.history.view', 'group' => 'Imports'],
            ['name' => 'Create imports', 'slug' => 'imports.create', 'group' => 'Imports'],
            ['name' => 'Download import errors', 'slug' => 'imports.download_errors', 'group' => 'Imports'],
            ['name' => 'Delete import history', 'slug' => 'imports.delete', 'group' => 'Imports'],
            ['name' => 'View projects', 'slug' => 'projects.view', 'group' => 'Projects'],
            ['name' => 'Create projects', 'slug' => 'projects.create', 'group' => 'Projects'],
            ['name' => 'Update owned projects', 'slug' => 'projects.update', 'group' => 'Projects'],
            ['name' => 'Import project data', 'slug' => 'projects.import', 'group' => 'Projects'],
            ['name' => 'View project bid documents', 'slug' => 'projects.bid_docs.view', 'group' => 'Projects'],
            ['name' => 'Edit project bid documents', 'slug' => 'projects.bid_docs.edit', 'group' => 'Projects'],
            ['name' => 'Delete projects', 'slug' => 'projects.delete', 'group' => 'Projects'],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(['slug' => $permission['slug']], $permission);
        }

        $this->call(ProjectDupaPermissionSeeder::class);

        $role = Role::updateOrCreate(
            ['slug' => 'administrator'],
            ['name' => 'Administrator', 'description' => 'Full application access through explicit permissions.'],
        );
        $role->permissions()->sync(Permission::query()->pluck('id'));
    }
}
