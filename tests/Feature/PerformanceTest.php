<?php

namespace Tests\Feature;

use App\Models\ImportHistory;
use App\Models\Permission;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('performance')]
class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_listing_query_count_stays_constant_and_preserves_import_ownership(): void
    {
        $this->seed(AuthorizationSeeder::class);
        $user = User::factory()->create();
        $role = Role::query()->create(['name' => 'Project editor', 'slug' => 'project-editor']);
        $role->permissions()->attach(Permission::query()->whereIn('slug', [
            'projects.view', 'projects.update', 'projects.delete',
        ])->pluck('id'));
        $user->roles()->attach($role);
        $owner = User::factory()->create();
        $first = $this->project($owner, 1);

        $this->actingAs($user);
        $single = $this->queriesFor(function () use ($first): void {
            $this->get(route('admin.projects.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('projects.data.0.id', $first->id)
                ->where('projects.data.0.can_edit', false)
                ->where('projects.data.0.can_delete', false));
        });

        for ($index = 2; $index <= 10; $index++) {
            $project = $this->project($owner, $index);
            ImportHistory::query()->create([
                'project_id' => $project->id, 'imported_by' => $user->id,
                'original_filename' => 'project.xlsx', 'stored_path' => 'imports/project.xlsx',
                'import_type' => 'bid_document', 'import_mode' => 'update',
                'status' => $index === 9 ? 'failed' : 'completed_with_errors',
            ]);
        }

        $full = $this->queriesFor(function (): void {
            $this->get(route('admin.projects.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->has('projects.data', 10)
                ->where('projects.data.0.can_edit', true)
                ->where('projects.data.0.can_delete', true)
                ->where('projects.data.1.can_edit', false)
                ->where('projects.data.1.can_delete', false)
                ->where('projects.data.9.can_edit', false)
                ->where('projects.data.9.can_delete', false));
        });

        $this->assertCount(count($single), $full, 'Permission and ownership queries must not grow per project.');
        $this->assertLessThanOrEqual(5, count($full));
    }

    public function test_library_permission_checks_reuse_one_permission_load(): void
    {
        $this->seed(AuthorizationSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', 'administrator')->sole());
        $this->actingAs($user);

        $queries = $this->queriesFor(function (): void {
            $this->get('/admin/libraries/items')->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('can.create', false)
                ->where('can.update', true)
                ->where('can.delete', true)
                ->where('can.sync', true)
                ->where('can.syncPrices', true));
        });

        $permissionQueries = array_filter($queries, fn (array $query): bool => str_contains($query['query'], 'role_permission') || str_contains($query['query'], 'role_user'));
        $this->assertCount(2, $permissionQueries);
        $this->assertLessThanOrEqual(5, count($queries));
    }

    public function test_dashboard_uses_one_statistics_query_with_correct_counts(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        User::factory()->count(2)->create(['is_active' => true]);
        User::factory()->count(3)->create(['is_active' => false]);
        $this->actingAs($admin);

        $queries = $this->queriesFor(function (): void {
            $this->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('stats', ['totalUsers' => 6, 'activeUsers' => 3, 'inactiveUsers' => 3, 'superAdmins' => 1])
                ->has('recentUsers', 5));
        });

        $this->assertCount(2, $queries);
    }

    public function test_roles_listing_returns_counts_without_loading_all_permissions(): void
    {
        $this->seed(AuthorizationSeeder::class);
        $admin = User::factory()->create(['is_super_admin' => true]);
        $this->actingAs($admin);
        $permissionCount = Permission::query()->count();

        $queries = $this->queriesFor(function () use ($permissionCount): void {
            $this->get(route('admin.roles.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->where('roles.0.slug', 'administrator')
                ->where('roles.0.permissions_count', $permissionCount)
                ->where('roles.0.users_count', 0)
                ->missing('roles.0.permissions'));
        });

        $this->assertCount(1, $queries);
    }

    /** @return list<array{query: string, bindings: array<mixed>, time: float}> */
    private function queriesFor(\Closure $request): array
    {
        DB::enableQueryLog();
        DB::flushQueryLog();

        try {
            $request();

            return DB::getQueryLog();
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }
    }

    private function project(User $owner, int $number): Project
    {
        return Project::query()->create([
            'project_code' => 'PERF-'.$number, 'project_name' => 'Performance project '.$number,
            'location' => 'Test', 'contract_duration' => 30, 'created_by' => $owner->id,
        ]);
    }
}
