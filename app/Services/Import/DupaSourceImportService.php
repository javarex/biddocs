<?php

namespace App\Services\Import;

use App\Models\DupaSource;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use RuntimeException;

class DupaSourceImportService
{
    /** @return array<int, array<string, mixed>> */
    public function parse(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException('Workbook does not exist: '.$path);
        }

        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $workbook = $reader->load($path);
        $records = [];
        $headers = [
            'pay item' => 'pay_item_no', 'suffix' => 'suffix',
            'description' => 'description', 'thickness/sizes' => 'thickness_sizes',
            'class' => 'class', 'others' => 'others', 'unit of measure' => 'unit',
        ];

        try {
            foreach ($workbook->getWorksheetIterator() as $sheet) {
                $columns = [];
                $part = null;
                $heading = null;
                foreach ($sheet->toArray(null, false, false, true) as $rowNumber => $row) {
                    $row = array_map(fn ($value): string => trim(preg_replace('/\s+/u', ' ', (string) $value) ?? ''), $row);
                    if (str_starts_with(strtolower($row['A'] ?? ''), 'pay item')) {
                        foreach ($row as $column => $value) {
                            foreach ($headers as $label => $field) {
                                if (str_starts_with(strtolower($value), $label)) {
                                    $columns[$field] = $column;
                                }
                            }
                        }

                        continue;
                    }
                    $first = $row['A'] ?? '';
                    if (preg_match('/^PART\s/i', $first)) {
                        $part = $first;
                        $heading = null;

                        continue;
                    }
                    $description = $row[$columns['description'] ?? ''] ?? '';
                    $unit = $row[$columns['unit'] ?? ''] ?? '';
                    if ($first !== '' && $description === '' && $unit === '') {
                        $heading = $first;

                        continue;
                    }
                    if ($first === '' && $description === '' && $unit === '') {
                        continue;
                    }
                    if ($columns === [] || $first === '' || $description === '' || $unit === '') {
                        throw new RuntimeException("Incomplete pay item on {$sheet->getTitle()} row {$rowNumber}.");
                    }
                    $record = [
                        'source_file' => basename($path), 'worksheet' => $sheet->getTitle(),
                        'source_row' => $rowNumber, 'part' => $part, 'item_heading' => $heading,
                    ];
                    foreach ($headers as $field) {
                        $value = $row[$columns[$field] ?? ''] ?? '';
                        $record[$field] = $value === '' ? null : $value;
                    }
                    $records[] = $record;
                }
            }
        } finally {
            $workbook->disconnectWorksheets();
        }
        if ($records === []) {
            throw new RuntimeException('No pay items found in the workbook.');
        }

        return $records;
    }

    /** @param array<int, array<string, mixed>> $records */
    public function import(array $records): int
    {
        return DB::transaction(function () use ($records): int {
            foreach (array_chunk($records, 100) as $chunk) {
                DupaSource::query()->upsert($chunk, ['source_file', 'worksheet', 'source_row'], [
                    'part', 'item_heading', 'pay_item_no', 'suffix', 'description',
                    'thickness_sizes', 'class', 'others', 'unit', 'updated_at',
                ]);
            }

            return count($records);
        });
    }
}
