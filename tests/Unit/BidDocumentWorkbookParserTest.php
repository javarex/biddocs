<?php

namespace Tests\Unit;

use App\Imports\BidDocumentWorkbookParser;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class BidDocumentWorkbookParserTest extends TestCase
{
    public function test_it_reads_metadata_labels_from_other_columns_and_common_variants(): void
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('ABC.');
        $sheet->setCellValue('C1', 'Project Name:');
        $sheet->setCellValue('D1', 'HEALTH STATION PROJECT');
        $sheet->setCellValue('C2', 'Site Location:');
        $sheet->setCellValue('D2', 'Davao de Oro');
        $sheet->setCellValue('J2', 'Contract Time (Days):');
        $sheet->setCellValue('K2', '90 DAYS');
        foreach (['A5' => 'PAY ITEM NO.', 'B5' => 'DESCRIPTION', 'C5' => 'UNIT', 'D5' => 'QUANTITY', 'E5' => 'ESTIMATED DIRECT COST', 'J5' => 'VAT', 'K5' => 'TOTAL INDIRECT COST', 'L5' => 'TOTAL COST', 'M5' => 'UNIT COST', 'F7' => 'OCM', 'G7' => 'PROFIT', 'H7' => '%', 'I7' => 'VALUE'] as $cell => $value) {
            $sheet->setCellValue($cell, $value);
        }
        $sheet->fromArray(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)', '(11)', '(12)', '(13)'], null, 'A9');
        $sheet->fromArray(['A.1', 'FIELD OFFICE', 'l.s.', 1, 100, null, 0.08, 0.08, 8, 5, 13, 113, 113], null, 'A11');

        $path = tempnam(sys_get_temp_dir(), 'bid-parser-').'.xlsx';

        try {
            (new Xlsx($spreadsheet))->save($path);
            $project = (new BidDocumentWorkbookParser)->parse($path)['project'];

            $this->assertSame('HEALTH STATION PROJECT', $project['project_name']);
            $this->assertSame('Davao de Oro', $project['location']);
            $this->assertSame(90.0, $project['contract_duration']);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }
}
