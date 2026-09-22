<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => true, 'is_active' => true]));
});

it('supports listing creating updating and deleting each catalog', function (string $catalog, array $data, string $field, string $updated) {
    if ($catalog === 'prices') {
        DB::table('items')->insert(['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag']);
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
    ['items', ['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag'], 'itemcode', 'M-2'],
    ['prices', ['itemcode' => 'M-1', 'price' => 100, 'effective_from' => '2026-09-12', 'effective_to' => null], 'price', '120.50'],
]);

it('validates catalog contracts and protects priced items', function () {
    $this->post('/admin/libraries/labors', ['manpower' => 'Worker', 'rates' => -1, 'types' => 'Invalid'])->assertSessionHasErrors(['rates', 'types']);
    $item = ['itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag'];
    $id = DB::table('items')->insertGetId($item);
    $this->post('/admin/libraries/items', $item)->assertSessionHasErrors('itemcode');
    $this->post('/admin/libraries/prices', ['itemcode' => 'missing', 'price' => -1, 'effective_from' => '2026-09-12', 'effective_to' => '2026-09-11'])->assertSessionHasErrors(['itemcode', 'price', 'effective_to']);
    DB::table('prices')->insert(['itemcode' => 'M-1', 'price' => 100, 'effective_from' => '2026-09-12']);
    $this->put("/admin/libraries/items/{$id}", [...$item, 'itemcode' => 'M-2'])->assertSessionHasNoErrors();
    $this->assertDatabaseHas('prices', ['itemcode' => 'M-2']);
    $this->delete("/admin/libraries/items/{$id}")->assertSessionHasErrors('delete');
    $this->assertDatabaseHas('items', ['id' => $id]);
});

it('shows the latest unit cost and effectivity on the items page', function () {
    DB::table('items')->insert([
        'itemcode' => 'M-1', 'category_id' => 1, 'description' => 'Cement', 'unit' => 'bag',
    ]);
    DB::table('prices')->insert([
        ['itemcode' => 'M-1', 'price' => 95, 'effective_from' => '2025-01-01', 'effective_to' => '2025-12-31'],
        ['itemcode' => 'M-1', 'price' => 110.50, 'effective_from' => '2026-01-01', 'effective_to' => null],
    ]);

    $this->get('/admin/libraries/items')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('displayFields', ['itemcode', 'category_id', 'description', 'unit', 'unit_cost', 'effective_from', 'effective_to'])
        ->where('records.data.0.itemcode', 'M-1')
        ->where('records.data.0.unit_cost', '110.50')
        ->where('records.data.0.effective_from', '2026-01-01')
        ->where('records.data.0.effective_to', null));
});

it('quick creates labor and equipment as json for the dupa editor', function () {
    $this->postJson('/admin/libraries/labors', [
        'manpower' => 'Quick Foreman', 'rates' => 850, 'types' => 'Contract',
    ])->assertCreated()
        ->assertJsonPath('record.manpower', 'Quick Foreman')
        ->assertJsonPath('record.rates', 850)
        ->assertJsonPath('record.types', 'Contract');

    $this->postJson('/admin/libraries/equipments', [
        'equipment' => 'Quick Mixer', 'rental' => 1500,
    ])->assertCreated()
        ->assertJsonPath('record.equipment', 'Quick Mixer')
        ->assertJsonPath('record.rental', 1500);

    $this->assertDatabaseHas('labors', ['manpower' => 'Quick Foreman', 'rates' => 850]);
    $this->assertDatabaseHas('equipments', ['equipment' => 'Quick Mixer', 'rental' => 1500]);
});

it('denies catalog access without permissions', function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
    $this->get('/admin/libraries/labors')->assertForbidden();
    $this->post('/admin/libraries/labors', [])->assertForbidden();
    $this->put('/admin/libraries/labors/1', [])->assertForbidden();
    $this->delete('/admin/libraries/labors/1')->assertForbidden();
});

it('transfers current signatory roles and retains inactive people', function () {
    $url = '/admin/libraries/signatories';
    $first = [
        'cats_no' => '0001',
        'name' => 'First Engineer',
        'position' => 'Engineer IV',
        'is_active' => true,
        'roles' => ['recommending_approval', 'checked_by'],
    ];
    $second = [
        'cats_no' => '0002',
        'name' => 'Second Engineer',
        'position' => 'Engineer V',
        'is_active' => true,
        'roles' => ['checked_by'],
    ];

    $this->post($url, $first)->assertSessionHasNoErrors();
    $this->post($url, $second)->assertSessionHasNoErrors();

    $this->assertDatabaseHas('signatory_role_assignments', [
        'role' => 'recommending_approval', 'cats_no' => '0001',
    ]);
    $this->assertDatabaseHas('signatory_role_assignments', [
        'role' => 'checked_by', 'cats_no' => '0002',
    ]);

    $this->put("{$url}/0002", [...$second, 'is_active' => false, 'roles' => []])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('signatories', ['cats_no' => '0002', 'is_active' => false]);
    $this->assertDatabaseMissing('signatory_role_assignments', ['cats_no' => '0002']);
    $this->delete("{$url}/0002")->assertSessionHasErrors('delete');
    $this->assertDatabaseHas('signatories', ['cats_no' => '0002']);
});

it('requires update permission when creating a signatory would replace a role holder', function () {
    DB::table('signatories')->insert([
        'cats_no' => '0100', 'name' => 'Current Holder',
        'position' => 'Engineer V', 'is_active' => true,
    ]);
    DB::table('signatory_role_assignments')->insert([
        'role' => 'approved_by', 'cats_no' => '0100',
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $permission = Permission::query()->create([
        'name' => 'Create libraries', 'slug' => 'libraries.create', 'group' => 'Libraries',
    ]);
    $role = Role::query()->create(['name' => 'Library creator', 'slug' => 'library-creator']);
    $role->permissions()->attach($permission);
    $creator = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
    $creator->roles()->attach($role);

    $this->actingAs($creator)->post('/admin/libraries/signatories', [
        'cats_no' => '0101', 'name' => 'Attempted Replacement',
        'position' => 'Department Head', 'is_active' => true,
        'roles' => ['approved_by'],
    ])->assertForbidden();

    $this->assertDatabaseMissing('signatories', ['cats_no' => '0101']);
    $this->assertDatabaseHas('signatory_role_assignments', [
        'role' => 'approved_by', 'cats_no' => '0100',
    ]);
});

it('links each signatory to at most one user account', function () {
    $user = User::factory()->create();
    $url = '/admin/libraries/signatories';
    $signatory = [
        'name' => 'Project Preparer', 'position' => 'Engineer III',
        'is_active' => true, 'roles' => [], 'user_id' => $user->id,
    ];

    $this->post($url, ['cats_no' => '0200', ...$signatory])->assertSessionHasNoErrors();
    $this->post($url, ['cats_no' => '0201', ...$signatory])->assertSessionHasErrors('user_id');

    $this->assertDatabaseHas('signatories', ['cats_no' => '0200', 'user_id' => $user->id]);
    $this->assertDatabaseMissing('signatories', ['cats_no' => '0201']);
});
