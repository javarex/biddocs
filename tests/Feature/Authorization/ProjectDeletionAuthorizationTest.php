<?php

namespace Tests\Feature\Authorization;

use App\Models\ImportHistory;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectDeletionAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AuthorizationSeeder::class);
    }

    public function test_user_can_delete_a_project_they_created(): void
    {
        $user = $this->userWithProjectDeletePermission();
        $project = $this->project(['created_by' => $user->id]);

        $this->actingAs($user)
            ->delete(route('admin.projects.destroy', $project))
            ->assertRedirect(route('admin.projects.index'));

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    public function test_user_can_delete_a_project_they_imported(): void
    {
        $user = $this->userWithProjectDeletePermission();
        $project = $this->project();
        ImportHistory::query()->create([
            'imported_by' => $user->id,
            'project_id' => $project->id,
            'original_filename' => 'project.xlsx',
            'stored_path' => 'imports/project.xlsx',
            'import_type' => 'bid_document',
            'import_mode' => 'update',
            'status' => 'completed',
        ]);

        $this->actingAs($user)
            ->delete(route('admin.projects.destroy', $project))
            ->assertRedirect(route('admin.projects.index'));

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    public function test_user_cannot_delete_a_project_owned_by_another_user(): void
    {
        $user = $this->userWithProjectDeletePermission();
        $project = $this->project(['created_by' => User::factory()->create()->id]);

        $this->actingAs($user)
            ->delete(route('admin.projects.destroy', $project))
            ->assertForbidden();

        $this->assertDatabaseHas('projects', ['id' => $project->id]);
    }

    public function test_super_admin_can_delete_any_project(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project(['created_by' => User::factory()->create()->id]);

        $this->actingAs($superAdmin)
            ->delete(route('admin.projects.destroy', $project))
            ->assertRedirect(route('admin.projects.index'));

        $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    }

    /** @param array<string, mixed> $attributes */
    private function project(array $attributes = []): Project
    {
        return Project::query()->create($attributes + [
            'project_code' => 'PRJ-'.fake()->unique()->numerify('#####'),
            'project_name' => 'Test project',
            'location' => 'Test location',
            'contract_duration' => 30,
        ]);
    }

    private function userWithProjectDeletePermission(): User
    {
        $user = User::factory()->create();
        $role = Role::query()->create(['name' => 'Project deleter', 'slug' => 'project-deleter']);
        $role->permissions()->sync(Permission::query()->where('slug', 'projects.delete')->pluck('id'));
        $user->roles()->attach($role);

        return $user;
    }
}
