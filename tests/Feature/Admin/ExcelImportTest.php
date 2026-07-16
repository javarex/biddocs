<?php

namespace Tests\Feature\Admin;

use App\Models\ImportHistory;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\User;
use App\Services\Import\BidDocumentImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ExcelImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_and_normal_users_cannot_access_imports(): void
    {
        $this->get(route('admin.imports.index'))->assertRedirect(route('login'));

        $user = User::factory()->create(['is_super_admin' => false]);
        $this->actingAs($user)->get(route('admin.imports.index'))->assertForbidden();
    }

    public function test_super_admin_can_preview_and_commit_a_valid_workbook(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $path = $this->createWorkbook();
        Storage::disk('local')->put('imports/test.xlsx', file_get_contents($path));

        $history = ImportHistory::query()->create([
            'imported_by' => $admin->id,
            'original_filename' => 'test.xlsx',
            'stored_path' => 'imports/test.xlsx',
            'import_type' => 'bid_document',
            'import_mode' => 'upsert',
            'status' => 'validating',
        ]);

        $service = app(BidDocumentImportService::class);
        $preview = $service->preview($history);

        $this->assertSame('pending', $preview->status);
        $this->assertSame(2, $preview->total_rows);
        $this->assertSame(2, $preview->metadata['valid_rows']);

        $result = $service->commit($preview);

        $this->assertSame('completed', $result->status);
        $this->assertSame(2, $result->imported_rows);
        $this->assertSame(1, Project::count());
        $this->assertSame(2, ProjectItem::count());

        unlink($path);
    }

    public function test_insert_mode_reports_existing_records_without_overwriting(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $path = $this->createWorkbook();
        Storage::disk('local')->put('imports/duplicate.xlsx', file_get_contents($path));

        $service = app(BidDocumentImportService::class);
        $first = ImportHistory::query()->create([
            'imported_by' => $admin->id, 'original_filename' => 'duplicate.xlsx',
            'stored_path' => 'imports/duplicate.xlsx', 'import_type' => 'bid_document',
            'import_mode' => 'upsert', 'status' => 'validating',
        ]);
        $service->commit($service->preview($first));

        $second = ImportHistory::query()->create([
            'imported_by' => $admin->id, 'original_filename' => 'duplicate.xlsx',
            'stored_path' => 'imports/duplicate.xlsx', 'import_type' => 'bid_document',
            'import_mode' => 'insert', 'status' => 'validating',
        ]);
        $preview = $service->preview($second);

        $this->assertSame(2, $preview->duplicate_rows);
        $this->assertSame(0, $preview->metadata['valid_rows']);
        $this->assertSame(2, ProjectItem::count());

        unlink($path);
    }

    private function createWorkbook(): string
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('ABC.');
        $sheet->setCellValue('B1', 'TEST PROJECT');
        $sheet->setCellValue('B2', 'TEST LOCATION');
        $sheet->setCellValue('L2', 30);
        foreach (['A4' => 'PAY ITEM NO.', 'B4' => 'DESCRIPTION', 'C4' => 'UNIT', 'D4' => 'QUANTITY', 'E4' => 'ESTIMATED DIRECT COST', 'J4' => 'VAT (5%)', 'K4' => 'TOTAL INDIRECT COST', 'L4' => 'TOTAL COST', 'M4' => 'UNIT COST', 'F6' => 'OCM', 'G6' => 'PROFIT', 'H6' => '%', 'I6' => 'VALUE'] as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }
        $sheet->fromArray(['A.1', 'FIRST ITEM', 'l.s.', 1, 100, null, 0.08, 0.08, 8, null, 13, 113, 113], null, 'A11');
        $sheet->fromArray(['A.2', 'SECOND ITEM', 'each', 2, 200, 0.12, 0.08, 0.20, 40, null, 56, 296, 148], null, 'A12');
        $path = tempnam(sys_get_temp_dir(), 'bid-import-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return $path;
    }
}
