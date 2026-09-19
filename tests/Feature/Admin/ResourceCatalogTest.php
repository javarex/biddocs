<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => true, 'is_active' => true]));
});

it('supports listing creating updating and deleting each catalog', function (string $catalog, array $data, string $field, string $updated) {
    if ($catalog === 'prices') {
        DB::table('materials')->insert(['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag']);
    }
    $url = '/admin/libraries/'.$catalog;
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/libraries/index')->where('catalog', $catalog));
    $this->from($url)->post($url, $data)->assertRedirect($url)->assertSessionHasNoErrors();
    $id = DB::table($catalog)->value('id');
    $this->assertDatabaseHas($catalog, $data);
    $this->from($url)->put("{$url}/{$id}", [...$data, $field => $updated])->assertSessionHasNoErrors();
    $this->assertDatabaseHas($catalog, ['id' => $id, $field => $updated]);
    $this->from($url)->delete("{$url}/{$id}")->assertSessionHasNoErrors();
    $this->assertDatabaseMissing($catalog, ['id' => $id]);
})->with([
    ['labors', ['manpower' => 'Foreman', 'rates' => 500, 'types' => 'Contract'], 'manpower', 'Mason'],
    ['equipments', ['equipment' => 'Mixer', 'rental' => 1000], 'equipment', 'Truck'],
    ['materials', ['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag'], 'itemcode', 'M-2'],
    ['prices', ['itemcode' => 'M-1', 'price' => 100, 'effective_from' => '2026-09-12', 'effective_to' => null], 'price', '120.50'],
]);

it('validates catalog contracts and protects priced materials', function () {
    $this->post('/admin/libraries/labors', ['manpower' => 'Worker', 'rates' => -1, 'types' => 'Invalid'])->assertSessionHasErrors(['rates', 'types']);
    $material = ['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag'];
    $id = DB::table('materials')->insertGetId($material);
    $this->post('/admin/libraries/materials', $material)->assertSessionHasErrors('itemcode');
    $this->post('/admin/libraries/prices', ['itemcode' => 'missing', 'price' => -1, 'effective_from' => '2026-09-12', 'effective_to' => '2026-09-11'])->assertSessionHasErrors(['itemcode', 'price', 'effective_to']);
    DB::table('prices')->insert(['itemcode' => 'M-1', 'price' => 100, 'effective_from' => '2026-09-12']);
    $this->put("/admin/libraries/materials/{$id}", [...$material, 'itemcode' => 'M-2'])->assertSessionHasNoErrors();
    $this->assertDatabaseHas('prices', ['itemcode' => 'M-2']);
    $this->delete("/admin/libraries/materials/{$id}")->assertSessionHasErrors('delete');
    $this->assertDatabaseHas('materials', ['id' => $id]);
});

it('denies catalog access without permissions', function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
    $this->get('/admin/libraries/labors')->assertForbidden();
    $this->post('/admin/libraries/labors', [])->assertForbidden();
    $this->put('/admin/libraries/labors/1', [])->assertForbidden();
    $this->delete('/admin/libraries/labors/1')->assertForbidden();
});
