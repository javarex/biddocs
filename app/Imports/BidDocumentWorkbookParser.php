<?php

namespace App\Imports;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class BidDocumentWorkbookParser
{
    public const WORKSHEET = 'ABC.';

    /** @return array{worksheet: string, project: array<string, mixed>, headers: array<string, string>, rows: array<int, array{worksheet: string, excel_row: int, section: string, sub_section: string, values: array<string, mixed>}>, skipped_rows: int} */
    public function parse(string $path): array
    {
        try {
            $reader = IOFactory::createReaderForFile($path);
            if (! $reader instanceof Xlsx) {
                throw new \RuntimeException('Only OOXML Excel workbooks are supported.');
            }
            $worksheetInfo = collect($reader->listWorksheetInfo($path))->firstWhere('worksheetName', self::WORKSHEET);
        } catch (\Throwable $exception) {
            report($exception);
            throw ValidationException::withMessages(['file' => 'The workbook could not be opened or is corrupted.']);
        }

        if (! is_array($worksheetInfo)) {
            throw ValidationException::withMessages(['file' => 'The required worksheet "ABC." was not found.']);
        }

        $headers = [];
        $project = null;
        $rows = [];
        $skippedRows = 0;
        $currentSection = null;
        $currentSubSection = null;
        $highestRow = (int) $worksheetInfo['totalRows'];
        $chunkSize = max(1, (int) config('imports.chunk_size', 500));

        for ($chunkStart = 1; $chunkStart <= $highestRow; $chunkStart += $chunkSize) {
            try {
                $chunkReader = IOFactory::createReaderForFile($path);
                $chunkReader->setReadDataOnly(true);
                $chunkReader->setReadFilter(new BidDocumentChunkReadFilter($chunkStart, min($highestRow, $chunkStart + $chunkSize - 1)));
                $spreadsheet = $chunkReader->load($path);
            } catch (\Throwable $exception) {
                report($exception);
                throw ValidationException::withMessages(['file' => 'The workbook could not be read in chunks.']);
            }

            $sheet = $spreadsheet->getSheetByName(self::WORKSHEET);
            if (! $sheet instanceof Worksheet) {
                throw ValidationException::withMessages(['file' => 'The required worksheet "ABC." was not found.']);
            }

            if ($chunkStart === 1) {
                $headers = $this->readHeaders($sheet);
                $project = [
                    'project_name' => $this->text($sheet, 'B1'),
                    'location' => $this->text($sheet, 'B2'),
                    'contract_duration' => $this->number($sheet, 'L2'),
                ];

                if ($project['project_name'] === '' || $project['location'] === '' || $project['contract_duration'] === null) {
                    throw ValidationException::withMessages(['file' => 'The workbook is missing project name, location, or contract duration.']);
                }
            }

            for ($rowNumber = max(9, $chunkStart); $rowNumber <= min($highestRow, $chunkStart + $chunkSize - 1); $rowNumber++) {
                $a = $this->text($sheet, "A{$rowNumber}");
                $b = $this->text($sheet, "B{$rowNumber}");
                $values = $this->rowValues($sheet, $rowNumber);

                if ($this->isEmpty($values)) {
                    $skippedRows++;

                    continue;
                }

                if ($this->isRomanPart($a)) {
                    $currentSection = $a;
                    $currentSubSection = null;
                    $skippedRows++;

                    continue;
                }

                if ($this->isLetterPart($a)) {
                    $currentSubSection = trim($a.' '.$b);
                    $skippedRows++;

                    continue;
                }

                if ($a === '' || $b === '' || strtoupper($b) === 'TOTAL') {
                    $skippedRows++;

                    continue;
                }

                $rows[] = [
                    'worksheet' => self::WORKSHEET,
                    'excel_row' => $rowNumber,
                    'section' => $currentSection ?? 'Imported items',
                    'sub_section' => $currentSubSection ?? 'Imported items',
                    'values' => $values,
                ];
            }

            $spreadsheet->disconnectWorksheets();
        }

        if ($rows === [] || $project === null) {
            throw ValidationException::withMessages(['file' => 'The workbook contains no importable item rows.']);
        }

        return [
            'worksheet' => self::WORKSHEET,
            'project' => $project,
            'headers' => $headers,
            'rows' => $rows,
            'skipped_rows' => $skippedRows,
        ];
    }

    /** @return array<string, string> */
    private function readHeaders(Worksheet $sheet): array
    {
        $required = [
            'A4' => 'PAY ITEM NO.', 'B4' => 'DESCRIPTION', 'C4' => 'UNIT', 'D4' => 'QUANTITY',
            'E4' => 'ESTIMATED DIRECT COST', 'F6' => 'OCM', 'G6' => 'PROFIT', 'H6' => '%',
            'I6' => 'VALUE', 'J4' => 'VAT', 'K4' => 'TOTAL INDIRECT COST', 'L4' => 'TOTAL COST',
            'M4' => 'UNIT COST',
        ];
        $headers = [];
        foreach ($required as $cell => $expected) {
            $actual = $this->text($sheet, $cell);
            if ($actual === '' || ! Str::contains(Str::upper($actual), Str::upper($expected))) {
                throw ValidationException::withMessages(['file' => "Required header {$expected} was not found at {$cell}."]);
            }
            $headers[$cell] = $actual;
        }

        return $headers;
    }

    /** @return array<string, mixed> */
    private function rowValues(Worksheet $sheet, int $row): array
    {
        return [
            'pay_item_no' => $this->text($sheet, "A{$row}"),
            'description' => $this->text($sheet, "B{$row}"),
            'unit' => $this->text($sheet, "C{$row}"),
            'qty' => $this->number($sheet, "D{$row}"),
            'estimated_direct_cost' => $this->number($sheet, "E{$row}"),
            'ocm' => $this->number($sheet, "F{$row}"),
            'profit' => $this->number($sheet, "G{$row}"),
            'total_markup_percentage' => $this->number($sheet, "H{$row}"),
            'total_markup_value' => $this->number($sheet, "I{$row}"),
            'vat_percentage' => 5.0,
            'total_indirect_cost' => $this->number($sheet, "K{$row}"),
            'total_cost' => $this->number($sheet, "L{$row}"),
            'unit_cost_adjusted' => $this->number($sheet, "M{$row}"),
        ];
    }

    private function text(Worksheet $sheet, string $cell): string
    {
        $value = $sheet->getCell($cell)->getCalculatedValue();

        return preg_replace('/\s+/u', ' ', trim((string) ($value ?? ''))) ?? '';
    }

    private function number(Worksheet $sheet, string $cell): ?float
    {
        $value = $sheet->getCell($cell)->getCalculatedValue();
        if ($value === null || $value === '') {
            return null;
        }
        $value = str_replace([',', '%'], '', trim((string) $value));

        return is_numeric($value) ? (float) $value : null;
    }

    /** @param array<string, mixed> $values */
    private function isEmpty(array $values): bool
    {
        foreach ($values as $value) {
            if ($value !== null && $value !== '') {
                return false;
            }
        }

        return true;
    }

    private function isRomanPart(string $value): bool
    {
        return preg_match('/^PART\s+[IVX]+\b/i', $value) === 1;
    }

    private function isLetterPart(string $value): bool
    {
        return preg_match('/^PART\s+[A-Z]\b/i', $value) === 1;
    }
}
