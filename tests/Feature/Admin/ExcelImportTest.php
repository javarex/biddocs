<?php

namespace Tests\Feature\Admin;

use App\Models\ImportHistory;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\User;
use App\Services\Import\BidDocumentImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ExcelImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_and_normal_users_cannot_access_imports(): void
    {
        $this->get(route('admin.imports.index'))->assertRedirect(route('login'));
        $this->get(route('admin.imports.templates.abc'))->assertRedirect(route('login'));

        $user = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $this->actingAs($user)->get(route('admin.imports.index'))->assertForbidden();
        $this->actingAs($user)->get(route('admin.imports.templates.abc'))->assertForbidden();
    }

    public function test_super_admin_can_download_the_abc_template_with_a_custom_filename(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);

        $response = $this->actingAs($admin)->get(route('admin.imports.templates.abc', [
            'filename' => 'My Project ABC.xlsx',
        ]));

        $response->assertOk();
        $response->assertDownload('My Project ABC.xlsx');
        $this->assertSame(
            hash_file('sha256', resource_path('templates/abc.xlsx')),
            hash('sha256', $response->streamedContent()),
        );

        $template = IOFactory::load(resource_path('templates/abc.xlsx'));
        $this->assertSame('Source of Funds:', $template->getSheet(0)->getCell('K3')->getFormattedValue());
        $this->assertSame('', $template->getSheet(0)->getCell('L3')->getFormattedValue());
        $this->assertSame('', $template->getSheet(0)->getCell('A2')->getFormattedValue());
        $this->assertSame('', $template->getSheet(0)->getCell('B2')->getFormattedValue());
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
        $this->assertSame(5.4, ProjectItem::query()->where('pay_item_no', 'A.1')->value('vat_five_percent'));
        $this->assertSame(12.0, ProjectItem::query()->where('pay_item_no', 'A.2')->value('vat_five_percent'));

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

    public function test_current_template_layout_is_detected_and_uses_its_project_code(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $path = $this->createCurrentTemplateWorkbook();
        Storage::disk('local')->put('imports/current-template.xlsm', file_get_contents($path));

        $history = ImportHistory::query()->create([
            'imported_by' => $admin->id,
            'original_filename' => 'current-template.xlsm',
            'stored_path' => 'imports/current-template.xlsm',
            'import_type' => 'bid_document',
            'import_mode' => 'upsert',
            'status' => 'validating',
        ]);

        $service = app(BidDocumentImportService::class);
        $preview = $service->preview($history);

        $this->assertSame('pending', $preview->status);
        $this->assertSame(2, $preview->total_rows);
        $this->assertSame('CW-123', $preview->metadata['project']['project_code']);
        $this->assertSame('TEST DESCRIPTION', $preview->metadata['project']['project_description']);
        $this->assertSame('AB CY 2026 – 20% DF', $preview->metadata['project']['source_of_funds']);
        $this->assertSame('CURRENT TEMPLATE LOCATION', $preview->metadata['project']['location']);

        $service->commit($preview);

        $this->assertDatabaseHas('projects', [
            'project_code' => 'CW-123',
            'project_name' => 'CURRENT TEMPLATE PROJECT',
            'project_description' => 'TEST DESCRIPTION',
            'source_of_funds' => 'AB CY 2026 – 20% DF',
            'location' => 'CURRENT TEMPLATE LOCATION',
            'contract_duration' => 200,
        ]);
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
        $sheet->fromArray(['A.1', 'FIRST ITEM', 'l.s.', 1, 100, null, 0.08, 0.08, 8, 5.4, 13, 113, 113], null, 'A11');
        $sheet->fromArray(['A.2', 'SECOND ITEM', 'each', 2, 200, 0.12, 0.08, 0.20, 40, 12, 56, 296, 148], null, 'A12');
        $path = tempnam(sys_get_temp_dir(), 'bid-import-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        return $path;
    }

    private function createCurrentTemplateWorkbook(): string
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('ABC.');
        $sheet->setCellValue('A1', 'Project:');
        $sheet->setCellValue('B1', 'CURRENT TEMPLATE PROJECT');
        $sheet->setCellValue('A2', 'Code:');
        $sheet->setCellValue('B2', 'CW-123');
        $sheet->setCellValue('A3', 'Location:');
        $sheet->setCellValue('B3', 'CURRENT TEMPLATE LOCATION');
        $sheet->setCellValue('K1', 'Project Description:');
        $sheet->setCellValue('L1', 'TEST DESCRIPTION');
        $sheet->setCellValue('K2', 'Contract Duration:');
        $sheet->setCellValue('L2', 200);
        $sheet->setCellValue('K3', 'Source of Funds:');
        $sheet->setCellValue('L3', 'AB CY 2026 – 20% DF');
        foreach (['A5' => 'PAY ITEM NO.', 'B5' => 'DESCRIPTION', 'C5' => 'UNIT', 'D5' => 'QUANTITY', 'E5' => 'ESTIMATED DIRECT COST', 'J5' => 'VAT (5+9) 5%', 'K5' => 'TOTAL INDIRECT COST (9 + 10)', 'L5' => 'TOTAL COST (5 + 11)', 'M5' => 'UNIT COST (Adjusted) (12/3)', 'F7' => 'OCM', 'G7' => 'PROFIT', 'H7' => '%', 'I7' => 'VALUE (5*8)'] as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }
        $sheet->fromArray(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)'], null, 'A9');
        $sheet->setCellValue('A11', 'PART I. FACILITIES FOR ENGINEER');
        $sheet->fromArray(['A.1', 'FIRST ITEM', 'l.s.', 1, 100, null, 0.08, 0.08, 8, 5.4, 13.4, 113.4, 113.4], null, 'A12');
        $sheet->fromArray(['A.2', 'SECOND ITEM', 'each', 2, 200, 0.12, 0.08, 0.20, 40, 12, 52, 252, 126], null, 'A13');
        $path = tempnam(sys_get_temp_dir(), 'bid-current-import-').'.xlsm';
        (new Xlsx($spreadsheet))->save($path);

        return $path;
    }
}
