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
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:') {
            throw new \LogicException('Category tests require an isolated in-memory SQLite database.');
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
        DB::table('materials')->insert(['itemcode' => 'M1', 'category_id' => 42, 'description' => 'Cement', 'unit' => 'bag']);
        $this->delete($url.'/42')->assertSessionHasErrors('delete');
        DB::table('materials')->where('itemcode', 'M1')->delete();
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

    public function test_material_sync_posts_selected_categories_and_updates_by_itemcode(): void
    {
        DB::table('categories')->insert([
            ['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true],
            ['IDCATEGORY' => 8, 'CATEGORY_DESCRIPTION' => 'Equipment', 'is_active' => true],
        ]);
        $id = DB::table('materials')->insertGetId(['itemcode' => '001', 'category_id' => 3, 'description' => 'Old', 'unit' => 'pc']);
        Http::fake(['http://pis.test/api/item/list/by-categories' => Http::response([
            ['ITEMCODE' => '001', 'IDCATEGORY' => 8, 'DESCRIPTION' => ' Updated ', 'UNIT' => ' set '],
            ['ITEMCODE' => '002', 'IDCATEGORY' => 3, 'DESCRIPTION' => 'New', 'UNIT' => 'pc'],
        ])]);
        for ($i = 0; $i < 2; $i++) {
            $this->from('/admin/libraries/materials')->post('/admin/libraries/materials/sync', ['categories' => [3, 8]])
                ->assertSessionHasNoErrors()->assertSessionHas('material_sync', 'Synced 2 items into Materials successfully.');
        }
        $this->assertDatabaseCount('materials', 2);
        $this->assertDatabaseHas('materials', ['id' => $id, 'itemcode' => '001', 'category_id' => 8, 'description' => 'Updated', 'unit' => 'set']);
        $this->assertDatabaseHas('materials', ['itemcode' => '002', 'category_id' => 3]);
        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->url() === 'http://pis.test/api/item/list/by-categories'
            && $request['categories'] === [3, 8]
            && $request->hasHeader('Accept', 'application/json')
            && $request->hasHeader('Content-Type', 'application/json'));
        $this->get('/admin/libraries/materials')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('admin/libraries/index')->has('categories', 2));
    }

    public function test_material_sync_validates_selection_before_requesting_pis(): void
    {
        $this->post('/admin/libraries/materials/sync', ['categories' => []])->assertSessionHasErrors('categories');
        $this->post('/admin/libraries/materials/sync', ['categories' => [999]])->assertSessionHasErrors('categories.0');
        Http::assertNothingSent();
    }

    public function test_material_sync_rejects_out_of_scope_items_without_partial_writes(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);
        Http::fake(['*' => Http::response([
            ['ITEMCODE' => '001', 'IDCATEGORY' => 3, 'DESCRIPTION' => 'Valid', 'UNIT' => 'pc'],
            ['ITEMCODE' => '002', 'IDCATEGORY' => 8, 'DESCRIPTION' => 'Unselected category', 'UNIT' => 'pc'],
        ])]);
        $this->post('/admin/libraries/materials/sync', ['categories' => [3]])->assertSessionHasErrors('sync');
        $this->assertDatabaseCount('materials', 0);
    }

    public function test_material_sync_reports_api_failure_and_handles_empty_results(): void
    {
        DB::table('categories')->insert(['IDCATEGORY' => 3, 'CATEGORY_DESCRIPTION' => 'Parts', 'is_active' => true]);
        Http::fakeSequence()->push([], 500)->push([]);
        $this->post('/admin/libraries/materials/sync', ['categories' => [3]])->assertSessionHasErrors('sync');
        $this->post('/admin/libraries/materials/sync', ['categories' => [3]])->assertSessionHasNoErrors()
            ->assertSessionHas('material_sync', 'Synced 0 items into Materials successfully.');
        $this->assertDatabaseCount('materials', 0);
    }

    public function test_unprivileged_users_cannot_manage_or_sync_categories(): void
    {
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        $this->get('/admin/libraries/categories')->assertForbidden();
        $this->post('/admin/libraries/categories', [])->assertForbidden();
        $this->put('/admin/libraries/categories/1', [])->assertForbidden();
        $this->delete('/admin/libraries/categories/1')->assertForbidden();
        $this->post('/admin/libraries/categories/sync')->assertForbidden();
        $this->post('/admin/libraries/materials/sync', ['categories' => [3]])->assertForbidden();
        Http::assertNothingSent();
    }
}
