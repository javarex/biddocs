<?php

namespace App\Services\Import;

use App\Models\ImportHistory;

final readonly class ImportPreviewResult
{
    /** @param array<string, mixed> $data */
    public function __construct(private array $data) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return $this->data;
    }

    public static function fromHistory(ImportHistory $history): self
    {
        return new self([
            'id' => $history->id,
            'status' => $history->status,
            'original_filename' => $history->original_filename,
            'import_mode' => $history->import_mode,
            'total_rows' => $history->total_rows,
            'imported_rows' => $history->imported_rows,
            'updated_rows' => $history->updated_rows,
            'duplicate_rows' => $history->duplicate_rows,
            'skipped_rows' => $history->skipped_rows,
            'failed_rows' => $history->failed_rows,
            'metadata' => $history->metadata ?? [],
            'failures' => $history->failures()->latest()->limit(100)->get()->map(fn ($failure): array => [
                'worksheet' => $failure->worksheet,
                'excel_row' => $failure->excel_row,
                'original_values' => $failure->original_values,
                'field_or_column' => $failure->field_or_column,
                'error_reason' => $failure->error_reason,
                'suggested_correction' => $failure->suggested_correction,
            ])->values()->all(),
        ]);
    }
}
