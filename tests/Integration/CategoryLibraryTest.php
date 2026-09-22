<?php

namespace Tests\Integration;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

class CategoryLibraryTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase()
    {
        $usesMemorySqlite = config('database.default') === 'sqlite'
            && config('database.connections.sqlite.database') === ':memory:';
        $usesDisposableMysql = config('database.default') === 'mysql'
            && str_ends_with((string) config('database.connections.mysql.database'), '_tests');

        if (! $usesMemorySqlite && ! $usesDisposableMysql) {
            throw new \LogicException('Category tests require in-memory SQLite or a disposable MySQL database ending in _tests.');
        }
    }

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['services.pis.url' => 'http://pis.test', 'inertia.ssr.enabled' => false]);
        $this->actingAs(User::factory()->create(['is_super_admin' => true, 'is_active' => true]));
    }

    public function test_category_crud_and_validation(): void
    {
        $url = '/admin/libraries/categories';
        $data = ['IDCATEGORY' => 42, 'fccode' => 'FC01', 'CATEGORY_DESCRIPTION' => 'Construction', 'is_active' => '1'];
        $this->from($url)->post($url, $data)->assertRedirect($url)->assertSessionHasNoErrors();
        $this->get($url.'?search=Construction')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/libraries/index')->has('records.data', 1)->where('records.data.0.IDCATEGORY', 42));
        $this->post($url, $data)->assertSessionHasErrors('IDCATEGORY');
        $this->put($url.'/42', [...$data, 'IDCATEGORY' => 43])->assertSessionHasErrors('IDCATEGORY');
        $this->put($url.'/42', [...$data, 'is_active' => '0'])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 42, 'is_active' => false]);
        DB::table('items')->insert(['itemcode' => 'M1', 'category_id' => 42, 'description' => 'Cement', 'unit' => 'bag']);
        $this->delete($url.'/42')->assertSessionHasErrors('delete');
        DB::table('items')->where('itemcode', 'M1')->delete();
        $this->delete($url.'/42')->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('categories', ['IDCATEGORY' => 42]);
    }

    public function test_sync_is_repeatable_and_preserves_local_codes_and_missing_categories(): void
    {
        DB::table('categories')->insert([
            ['IDCATEGORY' => 1, 'fccode' => 'LOCAL', 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => true],
            ['IDCATEGORY' => 3, 'fccode' => null, 'CATEGORY_DESCRIPTION' => 'Local only', 'is_active' => true],
        ]);
        Http::fake(['http://pis.test/api/item/categories' => Http::response(['data' => [
            ['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => ' Updated ', 'is_active' => false],
            ['IDCATEGORY' => 2, 'CATEGORY_DESCRIPTION' => 'New', 'is_active' => '1'],
        ]])]);
        for ($i = 0; $i < 2; $i++) {
            $this->from('/admin/libraries/categories')->post('/admin/libraries/categories/sync')
                ->assertRedirect('/admin/libraries/categories')->assertSessionHasNoErrors()
                ->assertSessionHas('category_sync', 'Synced 2 categories successfully.');
        }
        $this->assertDatabaseCount('categories', 3);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 1, 'fccode' => 'LOCAL', 'CATEGORY_DESCRIPTION' => 'Updated', 'is_active' => false]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 2, 'fccode' => null]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 3, 'is_active' => true]);
        Http::assertSent(fn ($request) => $request->method() === 'GET' && $request->url() === 'http://pis.test/api/item/categories');
    }

    public function test_null_api_status_preserves_existing_status_and_defaults_new_categories_to_active(): void
    {
        DB::table('categories')->insert([
            ['IDCATEGORY' => 1, 'fccode' => 'KEEP', 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => false],
            ['IDCATEGORY' => 2, 'fccode' => null, 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => true],
        ]);
        Http::fake(['*' => Http::response([
            ['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Updated inactive', 'is_active' => null],
            ['IDCATEGORY' => 2, 'CATEGORY_DESCRIPTION' => 'Updated active', 'is_active' => null],
            ['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'New', 'is_active' => null],
            ['IDCATEGORY' => 4, 'CATEGORY_DESCRIPTION' => 'Explicit inactive', 'is_active' => false],
        ])]);
        for ($i = 0; $i < 2; $i++) {
            $this->post('/admin/libraries/categories/sync')->assertSessionHasNoErrors();
        }
        $this->assertDatabaseCount('categories', 4);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 1, 'fccode' => 'KEEP', 'CATEGORY_DESCRIPTION' => 'Updated inactive', 'is_active' => false]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 2, 'is_active' => true]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 3, 'is_active' => true]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 4, 'is_active' => false]);
    }

    public function test_missing_status_is_still_rejected(): void
    {
        Http::fake(['*' => Http::response([
            ['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Missing status'],
        ])]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasErrors('sync');
        $this->assertDatabaseCount('categories', 0);
    }

    public function test_sync_updates_existing_fc_codes_and_preserves_leading_zeroes(): void
    {
        DB::table('categories')->insert([
            ['IDCATEGORY' => 1, 'fccode' => null, 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => true],
            ['IDCATEGORY' => 2, 'fccode' => 'OLD', 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => true],
            ['IDCATEGORY' => 3, 'fccode' => 'LOCAL', 'CATEGORY_DESCRIPTION' => 'Old', 'is_active' => true],
        ]);
        Http::fake(['*' => Http::response([
            ['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Accessories', 'is_active' => null, 'fccode' => '022'],
            ['IDCATEGORY' => 2, 'CATEGORY_DESCRIPTION' => 'Blank code', 'is_active' => false, 'fccode' => ''],
            ['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Omitted code', 'is_active' => null],
            ['IDCATEGORY' => 4, 'CATEGORY_DESCRIPTION' => 'New', 'is_active' => true, 'fccode' => '003'],
        ])]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 1, 'fccode' => '022']);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 2, 'fccode' => '', 'is_active' => false]);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 3, 'fccode' => 'LOCAL']);
        $this->assertDatabaseHas('categories', ['IDCATEGORY' => 4, 'fccode' => '003']);
    }

    public function test_invalid_payload_does_not_partially_sync(): void
    {
        Http::fake(['*' => Http::response([
            ['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Valid', 'is_active' => true],
            ['IDCATEGORY' => 2, 'CATEGORY_DESCRIPTION' => 'Invalid', 'is_active' => 'bad'],
        ])]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasErrors('sync');
        $this->assertDatabaseCount('categories', 0);
    }

    public function test_plain_list_and_empty_list_are_supported(): void
    {
        Http::fakeSequence()->push([['IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Category', 'is_active' => true]])->push([]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasNoErrors();
        $this->post('/admin/libraries/categories/sync')->assertSessionHasNoErrors();
        $this->assertDatabaseCount('categories', 1);
    }

    public function test_connection_and_http_errors_are_reported(): void
    {
        Http::fake(['*' => Http::failedConnection()]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasErrors('sync');
        Http::fake(['*' => Http::response([], 500)]);
        $this->post('/admin/libraries/categories/sync')->assertSessionHasErrors('sync');
        $this->assertDatabaseCount('categories', 0);
    }

    public function test_item_sync_updates_items_and_appends_every_price_import(): void
    {
        DB::table('categories')->insert([
            ['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true],
            ['IDCATEGORY' => 8, 'CATEGORY_DESCRIPTION' => 'Equipment', 'is_active' => true],
        ]);
        $id = DB::table('items')->insertGetId(['itemcode' => '001', 'category_id' => 3, 'description' => 'Old', 'unit' => 'pc']);
        Http::fake(['http://pis.test/api/item/list/by-categories' => Http::response([
            [
                'ITEMCODE' => '001', 'IDCATEGORY' => 8, 'DESCRIPTION' => ' Updated ', 'UNIT' => ' set ',
                'price' => 125.50, 'effective_from' => '2026-09-01', 'effective_to' => null,
            ],
            [
                'ITEMCODE' => '002', 'IDCATEGORY' => 3, 'DESCRIPTION' => 'New', 'UNIT' => 'pc',
                'price' => 75, 'effective_from' => '2026-09-15', 'effective_to' => '2026-12-31',
            ],
        ])]);
        for ($i = 0; $i < 2; $i++) {
            $this->from('/admin/libraries/items')->post('/admin/libraries/items/sync', ['categories' => [3, 8]])
                ->assertSessionHasNoErrors()->assertSessionHas('item_sync', 'Synced 2 items successfully.');
        }
        $this->assertDatabaseCount('items', 2);
        $this->assertDatabaseHas('items', ['id' => $id, 'itemcode' => '001', 'category_id' => 8, 'description' => 'Updated', 'unit' => 'set']);
        $this->assertDatabaseHas('items', ['itemcode' => '002', 'category_id' => 3]);
        $this->assertDatabaseCount('prices', 4);
        $this->assertSame(2, DB::table('prices')->where('itemcode', '001')->count());
        $this->assertSame(2, DB::table('prices')->where('itemcode', '002')->count());
        $this->assertDatabaseHas('prices', [
            'itemcode' => '001', 'price' => 125.50,
            'effective_from' => '2026-09-01', 'effective_to' => null,
        ]);
        $this->assertDatabaseHas('prices', [
            'itemcode' => '002', 'price' => 75,
            'effective_from' => '2026-09-15', 'effective_to' => '2026-12-31',
        ]);
        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->url() === 'http://pis.test/api/item/list/by-categories'
            && $request['categories'] === [3, 8]
            && $request->hasHeader('Accept', 'application/json')
            && $request->hasHeader('Content-Type', 'application/json'));
        $this->get('/admin/libraries/items')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/libraries/index')->has('categories', 2));
    }

    public function test_item_sync_validates_selection_before_requesting_pis(): void
    {
        $this->post('/admin/libraries/items/sync', ['categories' => []])->assertSessionHasErrors('categories');
        $this->post('/admin/libraries/items/sync', ['categories' => [999]])->assertSessionHasErrors('categories.0');
        Http::assertNothingSent();
    }

    public function test_item_sync_preserves_or_defaults_blank_upstream_units(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 33, 'CATEGORY_DESCRIPTION' => 'Hardware', 'is_active' => true]);
        DB::table('items')->insert([
            'itemcode' => 'EXISTING', 'category_id' => 33, 'description' => 'Existing item', 'unit' => 'box',
        ]);
        Http::fake(['*' => Http::response([
            [
                'ITEMCODE' => 'EXISTING', 'IDCATEGORY' => 33, 'DESCRIPTION' => 'Updated item', 'UNIT' => '',
                'price' => 100, 'effective_from' => '2026-01-01', 'effective_to' => null,
            ],
            [
                'ITEMCODE' => 'NEW', 'IDCATEGORY' => 33, 'DESCRIPTION' => 'New item', 'UNIT' => null,
                'price' => 200, 'effective_from' => '2026-01-01', 'effective_to' => null,
            ],
        ])]);

        $this->post('/admin/libraries/items/sync', ['categories' => [33]])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('items', ['itemcode' => 'EXISTING', 'description' => 'Updated item', 'unit' => 'box']);
        $this->assertDatabaseHas('items', ['itemcode' => 'NEW', 'unit' => 'N/A']);
        $this->assertDatabaseCount('prices', 2);
    }

    public function test_item_sync_rejects_out_of_scope_items_without_partial_writes(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);
        Http::fake(['*' => Http::response([
            [
                'ITEMCODE' => '001', 'IDCATEGORY' => 3, 'DESCRIPTION' => 'Valid', 'UNIT' => 'pc',
                'price' => 10, 'effective_from' => '2026-09-01', 'effective_to' => null,
            ],
            [
                'ITEMCODE' => '002', 'IDCATEGORY' => 8, 'DESCRIPTION' => 'Unselected category', 'UNIT' => 'pc',
                'price' => 20, 'effective_from' => '2026-09-01', 'effective_to' => null,
            ],
        ])]);
        $this->post('/admin/libraries/items/sync', ['categories' => [3]])->assertSessionHasErrors('sync');
        $this->assertDatabaseCount('items', 0);
        $this->assertDatabaseCount('prices', 0);
    }

    public function test_item_sync_rejects_invalid_price_effectivity_without_partial_writes(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);
        Http::fake(['*' => Http::response([[
            'ITEMCODE' => '001', 'IDCATEGORY' => 3, 'DESCRIPTION' => 'Invalid price', 'UNIT' => 'pc',
            'price' => 10, 'effective_from' => '2026-09-30', 'effective_to' => '2026-09-01',
        ]])]);

        $this->post('/admin/libraries/items/sync', ['categories' => [3]])->assertSessionHasErrors('sync');

        $this->assertDatabaseCount('items', 0);
        $this->assertDatabaseCount('prices', 0);
    }

    public function test_item_sync_reports_api_failure_and_handles_empty_results(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);
        Http::fakeSequence()->push([], 500)->push([]);
        $this->post('/admin/libraries/items/sync', ['categories' => [3]])->assertSessionHasErrors('sync');
        $this->post('/admin/libraries/items/sync', ['categories' => [3]])->assertSessionHasNoErrors()
            ->assertSessionHas('item_sync', 'Synced 0 items successfully.');
        $this->assertDatabaseCount('items', 0);
    }

    public function test_unprivileged_users_cannot_manage_or_sync_categories(): void
    {
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        $this->get('/admin/libraries/categories')->assertForbidden();
        $this->post('/admin/libraries/categories', [])->assertForbidden();
        $this->put('/admin/libraries/categories/1', [])->assertForbidden();
        $this->delete('/admin/libraries/categories/1')->assertForbidden();
        $this->post('/admin/libraries/categories/sync')->assertForbidden();
        $this->post('/admin/libraries/items/sync', ['categories' => [3]])->assertForbidden();
        Http::assertNothingSent();
    }
}
