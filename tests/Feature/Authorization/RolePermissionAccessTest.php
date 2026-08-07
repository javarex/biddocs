<?php

namespace Tests\Feature\Authorization;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
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

        $this->actingAs($user)
            ->get(route('admin.imports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/imports/index')
                ->where('canViewHistory', false)
                ->missing('histories'));
        $this->actingAs($user)->get(route('admin.projects.index'))->assertOk();
    }

    public function test_import_history_permission_grants_history_visibility(): void
    {
        $user = User::factory()->create();
        $role = Role::create(['name' => 'Import History Viewer', 'slug' => 'import-history-viewer']);
        $role->permissions()->sync(
            Permission::query()->whereIn('slug', ['imports.view', 'imports.history.view'])->pluck('id'),
        );
        $user->roles()->attach($role);

        $this->actingAs($user)
            ->get(route('admin.imports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/imports/index')
                ->where('canViewHistory', true)
                ->has('histories'));
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
