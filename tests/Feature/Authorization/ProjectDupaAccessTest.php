<?php

namespace Tests\Feature\Authorization;

use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectDupaAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_dupa_requires_its_own_permission_and_viewer_cannot_edit(): void
    {
        $this->seed(AuthorizationSeeder::class);
        $project = Project::create(['project_name' => 'School building', 'location' => 'Monkayo', 'contract_duration' => 345]);
        $user = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $this->actingAs($user)->get(route('admin.projects.dupa', $project))->assertForbidden();
        $user->roles()->attach(Role::where('slug', 'dupa-viewer')->sole());
        $this->actingAs($user)->get(route('admin.projects.dupa', $project))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/projects/dupa')
                ->where('project.project_name', 'School building')->where('project.can_edit', false)->missing('dupaSections'));
        $this->actingAs($user)->get(route('admin.projects.edit', $project))->assertForbidden();
        $this->actingAs($user)->get(route('admin.projects.index'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can_view_dupa', true));
    }

    public function test_project_view_permission_does_not_grant_dupa_access(): void
    {
        $this->seed(AuthorizationSeeder::class);
        $project = Project::create(['project_name' => 'School building', 'location' => 'Monkayo', 'contract_duration' => 345]);
        $user = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $role = Role::create(['name' => 'Project viewer', 'slug' => 'project-viewer']);
        $role->permissions()->attach(Permission::where('slug', 'projects.view')->sole());
        $user->roles()->attach($role);
        $this->actingAs($user)->get(route('admin.projects.index'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('can_view_dupa', false));
        $this->actingAs($user)->get(route('admin.projects.dupa', $project))->assertForbidden();
    }
}
