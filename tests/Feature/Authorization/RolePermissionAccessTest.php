<?php

namespace Tests\Feature\Authorization;

use App\Models\Permission;
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
        $this->actingAs($creator)->post('/admin/libraries/items', $item)->assertSessionHasNoErrors();
        $id = DB::table('items')->where('itemcode', 'AUTH-1')->value('id');
        $this->actingAs($creator)->post('/admin/libraries/items', [...$item, 'itemcode' => 'AUTH-2', 'price' => 100])
            ->assertSessionHasErrors('price');
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
}
