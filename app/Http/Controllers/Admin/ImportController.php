<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreImportRequest;
use App\Jobs\ProcessExcelImport;
use App\Models\ImportHistory;
use App\Models\Project;
use App\Services\Import\BidDocumentImportService;
use App\Services\Import\ImportPreviewResult;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    public function __construct(private readonly BidDocumentImportService $imports) {}

    public function index(Request $request): Response
    {
        Gate::authorize('imports.view');

        return $this->renderImportPage($request);
    }

    public function preview(StoreImportRequest $request): Response
    {
        Gate::authorize('imports.create');

        return $this->createPreview($request);
    }

    public function downloadAbcTemplate(Request $request): BinaryFileResponse
    {
        Gate::authorize('imports.view');

        $requestedName = pathinfo((string) $request->query('filename', 'ABC Template'), PATHINFO_FILENAME);
        $filename = trim((string) preg_replace('/[\\\\\/:*?"<>|\x00-\x1F]+/u', '-', $requestedName), ' .-');

        if ($filename === '') {
            $filename = 'ABC Template';
        }

        return response()->download(
            resource_path('templates/abc.xlsm'),
            $filename.'.xlsm',
            ['Content-Type' => 'application/vnd.ms-excel.sheet.macroEnabled.12'],
        );
    }

    public function projectImport(Project $project): Response
    {
        Gate::authorize('projects.import');

        return $this->renderImportPage(request(), $project);
    }

    public function previewForProject(StoreImportRequest $request, Project $project): Response
    {
        Gate::authorize('projects.import');

        return $this->createPreview($request, $project);
    }

    private function createPreview(StoreImportRequest $request, ?Project $project = null): Response
    {
        $file = $request->file('file');
        $storedPath = $file->storeAs('imports', uniqid('workbook_', true).'.'.$file->getClientOriginalExtension(), 'local');
        $history = ImportHistory::query()->create([
            'imported_by' => $request->user()->id,
            'project_id' => $project?->id,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'import_type' => 'bid_document',
            'import_mode' => $request->validated('mode'),
            'status' => 'validating',
        ]);

        $history = $this->imports->preview($history);

        return $this->renderImportPage($request, $project, ImportPreviewResult::fromHistory($history)->toArray());
    }

    public function commit(Request $request, ImportHistory $importHistory): RedirectResponse
    {
        Gate::authorize('imports.create');
        abort_unless($importHistory->imported_by === $request->user()->id || $request->user()->is_super_admin, 403);

        if ($importHistory->total_rows > 1000) {
            ProcessExcelImport::dispatch($importHistory->id);

            return to_route('admin.imports.index')->with('success', 'The import was queued for background processing.');
        }

        $history = $this->imports->commit($importHistory);

        return to_route('admin.imports.index')->with('success', "Import {$history->status}. {$history->imported_rows} inserted and {$history->updated_rows} updated.");
    }

    public function errors(Request $request, ImportHistory $importHistory): StreamedResponse
    {
        Gate::authorize('imports.download_errors');
        abort_unless($importHistory->imported_by === $request->user()->id || $request->user()->is_super_admin, 403);

        return response()->streamDownload(function () use ($importHistory): void {
            $handle = fopen('php://output', 'wb');
            if ($handle === false) {
                throw new \RuntimeException('Unable to open the error report stream.');
            }
            fputcsv($handle, ['Worksheet', 'Excel row', 'Original values', 'Field/column', 'Error reason', 'Suggested correction']);
            $importHistory->failures()->orderBy('excel_row')->each(function ($failure) use ($handle): void {
                fputcsv($handle, [
                    $failure->worksheet,
                    $failure->excel_row,
                    json_encode($failure->original_values, JSON_THROW_ON_ERROR),
                    $failure->field_or_column,
                    $failure->error_reason,
                    $failure->suggested_correction,
                ]);
            });
            fclose($handle);
        }, 'import-errors-'.$importHistory->id.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function destroy(Request $request, ImportHistory $importHistory): RedirectResponse
    {
        Gate::authorize('imports.delete');
        abort_unless($importHistory->imported_by === $request->user()->id || $request->user()->is_super_admin, 403);
        Storage::disk('local')->delete($importHistory->stored_path);
        $importHistory->delete();

        return back()->with('success', 'Import history deleted.');
    }

    /** @return array<string, mixed> */
    private function present(ImportHistory $history): array
    {
        return [
            'id' => $history->id,
            'original_filename' => $history->original_filename,
            'import_type' => $history->import_type,
            'import_mode' => $history->import_mode,
            'status' => $history->status,
            'total_rows' => $history->total_rows,
            'imported_rows' => $history->imported_rows,
            'updated_rows' => $history->updated_rows,
            'duplicate_rows' => $history->duplicate_rows,
            'skipped_rows' => $history->skipped_rows,
            'failed_rows' => $history->failed_rows,
            'completed_at' => $history->completed_at !== null ? Carbon::parse((string) $history->completed_at)->toISOString() : null,
            'importer' => $history->importer?->only(['id', 'name']),
            'project' => $history->project?->only(['id', 'project_code', 'project_name']),
        ];
    }

    /** @param array<string, mixed>|null $preview */
    private function renderImportPage(Request $request, ?Project $project = null, ?array $preview = null): Response
    {
        return Inertia::render('admin/imports/index', [
            'histories' => ImportHistory::query()
                ->with(['importer:id,name', 'project:id,project_code,project_name'])
                ->when($project, fn ($query) => $query->where('project_id', $project->id))
                ->latest()
                ->paginate(10)
                ->through(fn (ImportHistory $history): array => $this->present($history)),
            'preview' => $preview ?? $request->session()->get('import_preview'),
            'targetProject' => $project?->only(['id', 'project_code', 'project_name', 'location', 'contract_duration']),
        ]);
    }
}
