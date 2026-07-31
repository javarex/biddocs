<?php

namespace Tests\Feature\Authorization;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePermissionAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AuthorizationSeeder::class);
    }

    public function test_user_permissions_grant_access_to_imports_and_projects(): void
    {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'Procurement Viewer', 'slug' => 'procurement-viewer']);
        $role->permissions()->sync(
            Permission::query()->whereIn('slug', ['imports.view', 'projects.view'])->pluck('id'),
        );
        $user->roles()->attach($role);

        $this->actingAs($user)->get(route('admin.imports.index'))->assertOk();
        $this->actingAs($user)->get(route('admin.projects.index'))->assertOk();
    }

    public function test_user_permissions_do_not_grant_super_admin_pages(): void
    {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'Procurement Viewer', 'slug' => 'procurement-viewer']);
        $role->permissions()->sync(
            Permission::query()->whereIn('slug', ['imports.view', 'projects.view'])->pluck('id'),
        );
        $user->roles()->attach($role);

        $this->actingAs($user)->get(route('admin.users.index'))->assertForbidden();
        $this->actingAs($user)->get(route('admin.roles.index'))->assertForbidden();
    }
}
