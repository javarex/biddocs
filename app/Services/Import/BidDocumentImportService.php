<?php

namespace App\Services\Import;

use App\Imports\BidDocumentWorkbookParser;
use App\Models\ImportHistory;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Section;
use App\Models\SubSection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BidDocumentImportService
{
    public function __construct(private readonly BidDocumentWorkbookParser $parser) {}

    public function preview(ImportHistory $history): ImportHistory
    {
        try {
            $parsed = $this->parser->parse($this->path($history));
            $prepared = $this->prepare($parsed, $history->import_mode, $history);

            $history->failures()->delete();
            $this->storeFailures($history, $prepared['failures']);
            $history->update([
                'status' => 'pending',
                'total_rows' => count($parsed['rows']),
                'duplicate_rows' => $prepared['duplicate_rows'],
                'skipped_rows' => $parsed['skipped_rows'],
                'failed_rows' => count($prepared['failures']) - $prepared['duplicate_rows'],
                'metadata' => [
                    'worksheet' => $parsed['worksheet'],
                    'project' => $parsed['project'],
                    'headers' => $parsed['headers'],
                    'new_rows' => $prepared['new_rows'],
                    'existing_rows' => $prepared['existing_rows'],
                    'valid_rows' => count($prepared['valid_rows']),
                    'unmapped_columns' => ['J' => 'Calculated VAT amount; the schema stores the VAT percentage instead.'],
                    'sample_rows' => array_slice(array_map(fn (array $row): array => [
                        'excel_row' => $row['excel_row'],
                        ...$row['values'],
                    ], $prepared['valid_rows']), 0, 10),
                ],
            ]);
        } catch (ValidationException $exception) {
            $history->update(['status' => 'failed', 'error_message' => $exception->getMessage()]);
            throw $exception;
        } catch (\Throwable $exception) {
            report($exception);
            $history->update(['status' => 'failed', 'error_message' => 'The workbook could not be validated.']);
            throw ValidationException::withMessages(['file' => 'The workbook could not be validated. Check the file structure and try again.']);
        }

        return $history->refresh();
    }

    public function commit(ImportHistory $history): ImportHistory
    {
        if (! in_array($history->status, ['pending', 'processing'], true)) {
            throw ValidationException::withMessages(['import' => 'Only a validated import can be committed.']);
        }

        $started = now();
        $history->update(['status' => 'processing', 'started_at' => $started, 'error_message' => null]);

        try {
            $parsed = $this->parser->parse($this->path($history));
            $prepared = $this->prepare($parsed, $history->import_mode, $history);
            $history->failures()->delete();
            $this->storeFailures($history, $prepared['failures']);

            $counts = DB::transaction(function () use ($history, $parsed, $prepared): array {
                $project = $this->projectFor($parsed['project'], $history);
                if ($project === null) {
                    $project = Project::query()->updateOrCreate(
                        ['project_code' => $this->projectCode($parsed['project'])],
                        $parsed['project'] + ['project_code' => $this->projectCode($parsed['project'])],
                    );
                }
                $sections = [];
                $subSections = [];
                $existingItems = $this->existingItems($project);
                $imported = 0;
                $updated = 0;

                foreach ($prepared['valid_rows'] as $row) {
                    $section = $sections[$row['section']] ??= Section::query()->firstOrCreate([
                        'project_id' => $project->id,
                        'section' => $row['section'],
                    ]);
                    $subKey = $section->id.'|'.$row['sub_section'];
                    $subSection = $subSections[$subKey] ??= SubSection::query()->firstOrCreate([
                        'section_id' => $section->id,
                        'sub_section' => $row['sub_section'],
                    ]);
                    $values = $row['values'] + [
                        'section_id' => $section->id,
                        'sub_section_id' => $subSection->id,
                    ];
                    $key = $this->itemKey($row['values']['pay_item_no']);
                    $item = $existingItems[$key] ?? null;

                    if ($item !== null) {
                        $item->update($values);
                        $updated++;

                        continue;
                    }

                    $created = ProjectItem::query()->create($values);
                    $existingItems[$key] = $created;
                    $imported++;
                }

                return compact('imported', 'updated');
            });

            $history->update([
                'status' => count($prepared['failures']) > 0 ? 'completed_with_errors' : 'completed',
                'total_rows' => count($parsed['rows']),
                'imported_rows' => $counts['imported'],
                'updated_rows' => $counts['updated'],
                'duplicate_rows' => $prepared['duplicate_rows'],
                'skipped_rows' => $parsed['skipped_rows'],
                'failed_rows' => count($prepared['failures']) - $prepared['duplicate_rows'],
                'completed_at' => now(),
                'execution_time_seconds' => max(0, (int) $started->diffInSeconds(now())),
            ]);
        } catch (ValidationException $exception) {
            $history->update(['status' => 'failed', 'error_message' => $exception->getMessage(), 'completed_at' => now()]);
            throw $exception;
        } catch (\Throwable $exception) {
            report($exception);
            $history->update(['status' => 'failed', 'error_message' => 'The import failed and all database changes were rolled back.', 'completed_at' => now()]);
            throw ValidationException::withMessages(['import' => 'The import failed and all database changes were rolled back.']);
        }

        return $history->refresh();
    }

    /**
     * @param  array{project: array<string, mixed>, rows: array<int, array{worksheet: string, excel_row: int, section: string, sub_section: string, values: array<string, mixed>}>}  $parsed
     * @return array{valid_rows: array<int, array{worksheet: string, excel_row: int, section: string, sub_section: string, values: array<string, mixed>}>, failures: array<int, array<string, mixed>>, duplicate_rows: int, new_rows: int, existing_rows: int}
     */
    private function prepare(array $parsed, string $mode, ImportHistory $history): array
    {
        $project = $this->projectFor($parsed['project'], $history);
        $existing = $project ? $this->existingItems($project) : [];
        $seen = [];
        $valid = [];
        $failures = [];
        $duplicates = 0;
        $new = 0;
        $existingRows = 0;

        foreach ($parsed['rows'] as $row) {
            $errors = $this->validateRow($row['values']);
            $key = $this->itemKey((string) $row['values']['pay_item_no']);
            $isDuplicate = isset($seen[$key]);
            if ($isDuplicate) {
                $errors[] = 'The pay item number is duplicated within the workbook.';
            }
            $seen[$key] = true;

            $stored = $existing[$key] ?? null;
            if ($stored !== null) {
                $existingRows++;
                if ($mode === 'insert') {
                    $errors[] = 'A matching record already exists; insert-only mode will not overwrite it.';
                    $isDuplicate = true;
                }
            } elseif ($mode === 'update') {
                $errors[] = 'No matching stored record exists for update-existing mode.';
            }

            if ($errors !== []) {
                if ($isDuplicate) {
                    $duplicates++;
                }
                $failures[] = [
                    'worksheet' => $row['worksheet'],
                    'excel_row' => $row['excel_row'],
                    'original_values' => $row['values'],
                    'field_or_column' => 'A:M',
                    'error_reason' => implode(' ', $errors),
                    'suggested_correction' => 'Correct the row or choose a mode that matches the intended operation, then preview again.',
                ];

                continue;
            }

            if ($stored === null) {
                $new++;
            }
            $row['values']['ocm'] ??= 0.0;
            $row['values']['profit'] ??= 0.0;
            $row['values']['total_markup_percentage'] ??= 0.0;
            $row['values']['total_markup_value'] ??= 0.0;
            $valid[] = $row;
        }

        return compact('valid', 'failures', 'duplicates', 'new', 'existingRows') + [
            'valid_rows' => $valid,
            'duplicate_rows' => $duplicates,
            'new_rows' => $new,
            'existing_rows' => $existingRows,
        ];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<int, string>
     */
    private function validateRow(array $values): array
    {
        $errors = [];
        foreach (['pay_item_no', 'description', 'unit'] as $field) {
            if (trim((string) ($values[$field] ?? '')) === '') {
                $errors[] = "{$field} is required.";
            }
        }
        foreach (['qty', 'estimated_direct_cost', 'total_indirect_cost', 'total_cost', 'unit_cost_adjusted'] as $field) {
            $value = $values[$field] ?? null;
            if ($value === null || ! is_finite((float) $value) || (float) $value < 0) {
                $errors[] = "{$field} must be a non-negative number.";
            }
        }
        foreach (['ocm', 'profit', 'total_markup_percentage', 'total_markup_value'] as $field) {
            $value = $values[$field] ?? null;
            if ($value !== null && (! is_finite((float) $value) || (float) $value < 0)) {
                $errors[] = "{$field} must be a non-negative number when provided.";
            }
        }

        return $errors;
    }

    /** @return array<string, ProjectItem> */
    private function existingItems(Project $project): array
    {
        $sectionIds = $project->sections()->pluck('id');

        return ProjectItem::query()->whereIn('section_id', $sectionIds)->get()->keyBy(fn (ProjectItem $item): string => $this->itemKey($item->pay_item_no))->all();
    }

    /** @param array<int, array<string, mixed>> $failures */
    private function storeFailures(ImportHistory $history, array $failures): void
    {
        if ($failures !== []) {
            $history->failures()->createMany($failures);
        }
    }

    /** @param array<string, mixed> $project */
    private function projectCode(array $project): string
    {
        return 'IMP-'.strtoupper(substr(hash('sha256', implode('|', [
            $project['project_name'], $project['location'], $project['contract_duration'],
        ])), 0, 40));
    }

    /** @param array<string, mixed> $project */
    private function projectFor(array $project, ImportHistory $history): ?Project
    {
        if ($history->project_id !== null) {
            return Project::query()->with('sections')->findOrFail($history->project_id);
        }

        return Project::query()
            ->where('project_code', $this->projectCode($project))
            ->with('sections')
            ->first();
    }

    private function itemKey(string $payItemNo): string
    {
        return Str::lower(preg_replace('/\s+/u', ' ', trim($payItemNo)) ?? $payItemNo);
    }

    private function path(ImportHistory $history): string
    {
        $path = storage_path('app/private/'.$history->stored_path);
        if (! is_file($path)) {
            throw ValidationException::withMessages(['file' => 'The stored workbook is no longer available.']);
        }

        return $path;
    }
}
