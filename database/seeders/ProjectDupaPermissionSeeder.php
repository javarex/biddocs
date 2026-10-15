<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ProjectDupaPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permission = Permission::firstOrCreate(['slug' => 'projects.dupa.view'], [
            'name' => 'View project DUPA', 'group' => 'Projects',
            'description' => 'View the project DUPA summary and ADD / NON-ADD amounts.',
        ]);
        $role = Role::firstOrCreate(['slug' => 'dupa-viewer'], [
            'name' => 'DUPA Viewer', 'description' => 'Read-only access to projects and their DUPA summaries.',
        ]);
        $role->permissions()->syncWithoutDetaching(Permission::query()
            ->whereIn('slug', ['projects.view', 'projects.dupa.view'])->pluck('id'));
        Role::query()->where('slug', 'administrator')->first()?->permissions()->syncWithoutDetaching([$permission->id]);
    }
}
