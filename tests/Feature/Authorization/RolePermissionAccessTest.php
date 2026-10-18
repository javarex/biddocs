<?php

namespace Tests\Feature\Authorization;

use App\Models\Item;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\AuthorizationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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

    public function test_item_and_price_permissions_are_independent(): void
    {
        $this->assertSame(5, Permission::query()->where('group', 'Items')->count());
        $this->assertSame(1, Permission::query()->where('slug', 'categories.sync')->count());

        $creator = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $creatorRole = Role::create(['name' => 'Item creator', 'slug' => 'item-creator']);
        $creatorRole->permissions()->sync(Permission::query()
            ->whereIn('slug', ['libraries.view', 'items.create'])->pluck('id'));
        $creator->roles()->attach($creatorRole);

        $item = ['itemcode' => 'AUTH-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag'];
        $this->actingAs($creator)->post('/admin/libraries/items', $item)->assertForbidden();
        $this->assertDatabaseMissing('items', ['itemcode' => 'AUTH-1']);
        $id = DB::table('items')->insertGetId($item);
        $this->actingAs($creator)->post('/admin/libraries/items', [...$item, 'itemcode' => 'AUTH-2', 'price' => 100])
            ->assertForbidden();
        $this->actingAs($creator)->put("/admin/libraries/items/{$id}", $item)->assertForbidden();
        $this->actingAs($creator)->post('/admin/libraries/items/sync', ['categories' => [1]])->assertForbidden();
        $this->assertDatabaseMissing('items', ['itemcode' => 'AUTH-2']);

        $encoder = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $encoderRole = Role::create(['name' => 'Price encoder', 'slug' => 'price-encoder']);
        $encoderRole->permissions()->sync(Permission::query()
            ->whereIn('slug', ['libraries.view', 'items.prices.encode'])->pluck('id'));
        $encoder->roles()->attach($encoderRole);

        $this->actingAs($encoder)->put("/admin/libraries/items/{$id}", [...$item, 'price' => '125.50'])->assertForbidden();
        $this->assertDatabaseCount('prices', 0);
        $this->actingAs($encoder)->delete("/admin/libraries/items/{$id}")->assertForbidden();

        $editor = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $editorRole = Role::create(['name' => 'Item editor', 'slug' => 'item-editor']);
        $editorRole->permissions()->sync(Permission::query()
            ->whereIn('slug', ['libraries.view', 'items.update', 'items.delete'])->pluck('id'));
        $editor->roles()->attach($editorRole);

        $this->actingAs($editor)->put("/admin/libraries/items/{$id}", [...$item, 'description' => 'Updated cement'])
            ->assertSessionHasNoErrors();
        $this->actingAs($editor)->put("/admin/libraries/items/{$id}", [...$item, 'price' => 200])
            ->assertForbidden();
        $this->assertDatabaseHas('items', ['id' => $id, 'description' => 'Updated cement']);
        $this->assertDatabaseCount('prices', 0);

        $editorRole->permissions()->attach(Permission::query()->where('slug', 'items.prices.encode')->value('id'));
        $this->actingAs($editor)->put("/admin/libraries/items/{$id}", [...$item, 'price' => '125.50'])
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('prices', ['itemcode' => 'AUTH-1', 'price' => '125.50']);

        $deleteId = DB::table('items')->insertGetId([
            'itemcode' => 'AUTH-3', 'category_id' => 1, 'description' => 'Unused', 'unit' => 'piece',
        ]);
        $this->actingAs($editor)->delete("/admin/libraries/items/{$deleteId}")->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('items', ['id' => $deleteId]);
    }

    public function test_category_and_item_sync_have_separate_permissions(): void
    {
        config(['services.pis.url' => 'http://pis.test']);
        Http::fake(['*' => Http::response([])]);
        DB::table('categories')->insert(['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);

        $user = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $role = Role::create(['name' => 'Category syncer', 'slug' => 'category-syncer']);
        $role->permissions()->sync(Permission::query()
            ->whereIn('slug', ['libraries.view', 'categories.sync'])->pluck('id'));
        $user->roles()->attach($role);

        $this->actingAs($user)->post('/admin/libraries/categories/sync')->assertSessionHasNoErrors();
        $this->actingAs($user)->post('/admin/libraries/items/sync', ['categories' => [1]])->assertForbidden();

        $role->permissions()->attach(Permission::query()->where('slug', 'items.sync')->value('id'));
        $this->actingAs($user)->post('/admin/libraries/items/sync', ['categories' => [1]])->assertSessionHasNoErrors();
        $this->actingAs($user)->post('/admin/libraries/items/sync', ['categories' => [1], 'sync_prices' => true])
            ->assertForbidden();
    }

    public function test_role_changes_take_effect_on_the_next_request_and_revocation_is_not_cached(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $user = User::factory()->create();
        $roleData = ['name' => 'Import reader', 'slug' => 'import-reader', 'permissions' => Permission::query()
            ->whereIn('slug', ['imports.view', 'libraries.view'])->pluck('id')->all()];

        $this->actingAs($admin)->post(route('admin.roles.store'), $roleData)->assertSessionHasNoErrors();
        $role = Role::query()->where('slug', 'import-reader')->sole();
        $user->roles()->attach($role);
        $this->actingAs($user)->get(route('admin.imports.index'))->assertOk();

        $roleData['permissions'] = Permission::query()->where('slug', 'libraries.view')->pluck('id')->all();
        $this->actingAs($admin)->put(route('admin.roles.update', $role), $roleData)->assertSessionHasNoErrors();

        $this->actingAs($user)->get(route('admin.imports.index'))->assertForbidden();
        $this->get('/admin/libraries/items')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('auth.permissions', ['libraries.view']));

        $this->actingAs($admin)->delete(route('admin.roles.destroy', $role))->assertRedirect();
        $this->actingAs($user)->get('/admin/libraries/items')->assertForbidden();
        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('auth.permissions', []));
    }

    public function test_dupa_item_sync_controls_use_the_dedicated_permissions(): void
    {
        $user = User::factory()->create();
        $role = Role::query()->create(['name' => 'Estimator', 'slug' => 'estimator']);
        $role->permissions()->attach(Permission::query()->whereIn('slug', [
            'projects.update', 'libraries.create', 'libraries.update',
        ])->pluck('id'));
        $user->roles()->attach($role);
        $project = Project::query()->create([
            'project_name' => 'Sync controls', 'location' => 'Test', 'contract_duration' => 30, 'created_by' => $user->id,
        ]);
        $section = $project->sections()->create(['section' => 'PART I']);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'pay_item_no' => 'A.1', 'description' => 'Test item', 'unit' => 'piece',
        ] + array_fill_keys(['qty', 'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
            'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost', 'unit_cost_adjusted'], 0));
        DB::table('categories')->insert(['IDCATEGORY' => 10, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);

        $this->actingAs($user)->get(route('admin.dupas.edit', $dupa))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('canSyncItems', false)->where('syncCategories', []));

        $role->permissions()->sync(Permission::query()->whereIn('slug', ['projects.update', 'items.sync'])->pluck('id'));
        $this->get(route('admin.dupas.edit', $dupa))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('canSyncItems', true)->where('canSyncPrices', false)->where('syncCategories.0.IDCATEGORY', 10));

        $role->permissions()->attach(Permission::query()->where('slug', 'items.prices.encode')->value('id'));
        $this->get(route('admin.dupas.edit', $dupa))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('canSyncPrices', true));
    }

    public function test_manual_item_creation_policy_denies_super_admins_and_inactive_users_have_no_access(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $this->assertFalse($admin->can('create', Item::class));
        $this->assertFalse($admin->can('items.create'));

        $admin->update(['is_active' => false]);
        $this->assertFalse($admin->can('projects.view'));
        $this->assertFalse($admin->can('viewAny', Role::class));
    }

    public function test_default_administrator_role_cannot_be_renamed_to_bypass_deletion_protection(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $role = Role::query()->where('slug', 'administrator')->sole();

        $this->actingAs($admin)->put(route('admin.roles.update', $role), [
            'name' => $role->name, 'slug' => 'renamed-administrator', 'permissions' => [],
        ])->assertSessionHasErrors('slug');

        $this->assertDatabaseHas('roles', ['id' => $role->id, 'slug' => 'administrator']);
        $this->assertGreaterThan(0, $role->permissions()->count());
        $this->delete(route('admin.roles.destroy', $role))->assertStatus(422);
        $this->assertDatabaseHas('roles', ['id' => $role->id]);
    }
}
