<?php

use App\Models\DupaSource;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

it('imports shifted columns and variants and can repeat the import without duplicates', function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => true, 'is_active' => true]));
    $book = new Spreadsheet;
    $sheet = $book->getActiveSheet();
    $sheet->setTitle('page 1');
    $sheet->setCellValue('A1', 'PART A - FACILITIES');
    foreach (['A' => 'Pay Item (Number)', 'D' => 'Suffix', 'G' => 'Description', 'K' => 'Thickness/Sizes', 'N' => 'Class', 'Q' => 'Others', 'T' => 'Unit Of Measure'] as $column => $value) {
        $sheet->setCellValue($column.'2', $value);
    }
    $sheet->setCellValue('A3', 'Item 100 - Test');
    foreach (['A' => '100 (1)', 'D' => 'a', 'G' => "First\nvariant", 'K' => '10 mm', 'N' => 'A', 'Q' => 'Test', 'T' => 'Each'] as $column => $value) {
        $sheet->setCellValue($column.'4', $value);
    }
    foreach (['A' => 'Pay Item (Number)', 'B' => 'Suffix', 'E' => 'Description', 'I' => 'Thickness/Sizes', 'L' => 'Class', 'O' => 'Others', 'R' => 'Unit Of Measure'] as $column => $value) {
        $sheet->setCellValue($column.'5', $value);
    }
    foreach (['A' => '100 (1)', 'B' => 'b', 'E' => 'Second variant', 'I' => '20 mm', 'R' => 'Set'] as $column => $value) {
        $sheet->setCellValue($column.'6', $value);
    }
    $path = tempnam(sys_get_temp_dir(), 'dupa-');
    try {
        (new Xlsx($book))->save($path);
        $upload = fn () => new UploadedFile($path, 'DPWH.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
        $this->post('/admin/dpwh-dupa/import', ['file' => $upload()])->assertRedirect('/admin/dpwh-dupa');
        $this->post('/admin/dpwh-dupa/import', ['file' => $upload()])->assertRedirect('/admin/dpwh-dupa');
        expect(DupaSource::count())->toBe(2);
        $this->assertDatabaseHas('dupa_sources', ['source_row' => 4, 'suffix' => 'a', 'description' => 'First variant', 'class' => 'A']);
        $this->assertDatabaseHas('dupa_sources', ['source_row' => 6, 'suffix' => 'b', 'thickness_sizes' => '20 mm', 'unit' => 'Set', 'part' => 'PART A - FACILITIES', 'item_heading' => 'Item 100 - Test']);
        $this->get('/admin/dpwh-dupa?search=Second')->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/dpwh-dupa/index')->has('records.data', 1)->where('records.data.0.description', 'Second variant'));
        $sheet->setCellValue('R6', null);
        (new Xlsx($book))->save($path);
        $this->post('/admin/dpwh-dupa/import', ['file' => $upload()])->assertSessionHasErrors('file');
        expect(DupaSource::count())->toBe(2);
    } finally {
        @unlink($path);
        $book->disconnectWorksheets();
    }
});

it('requires library access and import permission', function () {
    $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
    $this->get('/admin/dpwh-dupa')->assertForbidden();
    $this->post('/admin/dpwh-dupa/import')->assertForbidden();
});
