<?php

namespace App\Imports;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
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
        $dataStartRow = 9;
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
                $headerRow = $this->findHeaderRow($sheet);
                $subHeaderRow = $this->findSubHeaderRow($sheet, $headerRow);
                $headers = $this->readHeaders($sheet, $headerRow, $subHeaderRow);
                $project = $this->readProject($sheet, $headerRow);
                $dataStartRow = $this->findDataStartRow($sheet, $headerRow, $subHeaderRow);

                if ($project['project_name'] === '' || $project['location'] === '' || $project['contract_duration'] === null) {
                    throw ValidationException::withMessages(['file' => 'The workbook is missing project name, location, or contract duration.']);
                }
            }

            for ($rowNumber = max($dataStartRow, $chunkStart); $rowNumber <= min($highestRow, $chunkStart + $chunkSize - 1); $rowNumber++) {
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
    private function readHeaders(Worksheet $sheet, int $headerRow, int $subHeaderRow): array
    {
        $required = [
            "A{$headerRow}" => 'PAY ITEM NO.', "B{$headerRow}" => 'DESCRIPTION',
            "C{$headerRow}" => 'UNIT', "D{$headerRow}" => 'QUANTITY',
            "E{$headerRow}" => 'ESTIMATED DIRECT COST', "F{$subHeaderRow}" => 'OCM',
            "G{$subHeaderRow}" => 'PROFIT', "H{$subHeaderRow}" => '%',
            "I{$subHeaderRow}" => 'VALUE', "J{$headerRow}" => 'VAT',
            "K{$headerRow}" => 'TOTAL INDIRECT COST', "L{$headerRow}" => 'TOTAL COST',
            "M{$headerRow}" => 'UNIT COST',
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

    private function findHeaderRow(Worksheet $sheet): int
    {
        for ($row = 1; $row <= 20; $row++) {
            if ($this->contains($this->text($sheet, "A{$row}"), 'PAY ITEM NO.')) {
                return $row;
            }
        }

        throw ValidationException::withMessages(['file' => 'The required header PAY ITEM NO. was not found in column A.']);
    }

    private function findSubHeaderRow(Worksheet $sheet, int $headerRow): int
    {
        for ($row = $headerRow; $row <= min(20, $headerRow + 5); $row++) {
            if ($this->contains($this->text($sheet, "F{$row}"), 'OCM')) {
                return $row;
            }
        }

        throw ValidationException::withMessages(['file' => 'The required header OCM was not found in column F.']);
    }

    private function findDataStartRow(Worksheet $sheet, int $headerRow, int $subHeaderRow): int
    {
        for ($row = $subHeaderRow + 1; $row <= min(25, $subHeaderRow + 5); $row++) {
            if ($this->normalized($this->text($sheet, "A{$row}")) === '(1)') {
                return $row + 1;
            }
        }

        return max($headerRow, $subHeaderRow) + 3;
    }

    /** @return array{project_code: string, project_name: string, project_description: string, source_of_funds: string, location: string, contract_duration: ?float} */
    private function readProject(Worksheet $sheet, int $headerRow): array
    {
        $labels = [];
        $lastMetadataRow = max(1, $headerRow - 1);
        $lastMetadataColumn = Coordinate::columnIndexFromString($sheet->getHighestColumn());

        for ($row = 1; $row <= $lastMetadataRow; $row++) {
            for ($column = 1; $column <= $lastMetadataColumn; $column++) {
                $label = rtrim($this->normalized($this->text($sheet, Coordinate::stringFromColumnIndex($column).$row)), ':');
                if ($label === '') {
                    continue;
                }

                $valueCell = $this->metadataValueCell($sheet, $row, $column, $lastMetadataColumn);
                if ($valueCell !== null) {
                    $labels[$label] = $valueCell;
                }
            }
        }

        return [
            'project_code' => $this->valueForLabel($sheet, $labels, ['PROJECT CODE', 'CODE', 'PROJECT NUMBER', 'PROJECT NO.']),
            'project_name' => $this->valueForLabel($sheet, $labels, ['PROJECT NAME', 'NAME OF PROJECT', 'PROJECT TITLE', 'PROJECT'], 'B1'),
            'project_description' => $this->valueForLabel($sheet, $labels, ['PROJECT DESCRIPTION', 'DESCRIPTION OF PROJECT']),
            'source_of_funds' => $this->valueForLabel($sheet, $labels, ['SOURCE OF FUNDS', 'SOURCE OF FUND', 'FUNDING SOURCE']),
            'location' => $this->valueForLabel($sheet, $labels, ['PROJECT LOCATION', 'SITE LOCATION', 'LOCATION', 'PROJECT SITE', 'PLACE OF PROJECT', 'PLACE OF WORK'], 'B2'),
            'contract_duration' => $this->numberForLabel($sheet, $labels, ['CONTRACT DURATION', 'CONTRACT TIME', 'PROJECT DURATION', 'CONTRACT PERIOD', 'DURATION'], 'L2'),
        ];
    }

    private function metadataValueCell(Worksheet $sheet, int $row, int $labelColumn, int $lastColumn): ?string
    {
        for ($column = $labelColumn + 1; $column <= $lastColumn; $column++) {
            $cell = Coordinate::stringFromColumnIndex($column).$row;
            $value = $this->text($sheet, $cell);
            if ($value === '') {
                continue;
            }

            if (Str::endsWith($value, ':')) {
                return null;
            }

            return $cell;
        }

        return null;
    }

    /**
     * @param  array<string, string>  $labels
     * @param  array<int, string>  $names
     */
    private function valueForLabel(Worksheet $sheet, array $labels, array $names, ?string $fallback = null): string
    {
        $cell = $this->cellForLabel($labels, $names);
        if ($cell !== null) {
            return $this->text($sheet, $cell);
        }

        return $fallback === null ? '' : $this->text($sheet, $fallback);
    }

    /**
     * @param  array<string, string>  $labels
     * @param  array<int, string>  $names
     */
    private function numberForLabel(Worksheet $sheet, array $labels, array $names, string $fallback): ?float
    {
        $cell = $this->cellForLabel($labels, $names);
        if ($cell !== null) {
            return $this->number($sheet, $cell);
        }

        return $this->number($sheet, $fallback);
    }

    /**
     * @param  array<string, string>  $labels
     * @param  array<int, string>  $names
     */
    private function cellForLabel(array $labels, array $names): ?string
    {
        foreach ($names as $name) {
            $expected = $this->normalized($name);
            if (isset($labels[$expected])) {
                return $labels[$expected];
            }
        }

        foreach ($names as $name) {
            $expected = $this->normalized($name);
            if (Str::length($expected) < 8) {
                continue;
            }

            foreach ($labels as $label => $cell) {
                if (Str::startsWith($label, $expected.' ')) {
                    return $cell;
                }
            }
        }

        return null;
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
            'vat_five_percent' => $this->number($sheet, "J{$row}"),
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
        return $this->numberValue($sheet->getCell($cell)->getCalculatedValue());
    }

    private function numberValue(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $value = str_replace([',', '%'], '', trim((string) $value));

        if (is_numeric($value)) {
            return (float) $value;
        }

        return preg_match('/-?\d+(?:\.\d+)?/', $value, $matches) === 1
            ? (float) $matches[0]
            : null;
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

    private function contains(string $actual, string $expected): bool
    {
        return Str::contains($this->normalized($actual), $this->normalized($expected));
    }

    private function normalized(string $value): string
    {
        return Str::upper(preg_replace('/\s+/u', ' ', trim($value)) ?? '');
    }
}
