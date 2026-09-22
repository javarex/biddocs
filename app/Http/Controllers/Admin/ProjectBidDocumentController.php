<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateBidDocumentRequest;
use App\Models\BidDocumentVersion;
use App\Models\Project;
use App\Services\BidDocumentService;
use App\Services\DupaEstimateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProjectBidDocumentController extends Controller
{
    public function __construct(
        private readonly BidDocumentService $documents,
        private readonly DupaEstimateService $estimates,
    ) {}

    public function show(Project $project): Response
    {
        Gate::authorize('projects.bid_docs.view');
        $version = $project->bidDocumentVersion()->with('editor:id,name')->first();
        $hasSavedVersion = $version !== null && Storage::disk('local')->exists($version->stored_path);
        $totals = $this->estimates->projectTotals($project);

        return Inertia::render('admin/projects/bid-docs', [
            'project' => [
                ...$project->only(['id', 'project_code', 'project_name', 'project_description', 'source_of_funds', 'location', 'contract_duration']),
                'sections_count' => $project->sections()->count(),
                'items_count' => $project->items()->count(),
                'total_cost' => $totals['ADD']['grand_total'] + $totals['NON_ADD']['grand_total'],
            ],
            // Keep this URL relative so the browser preserves the current HTTPS
            // scheme even when the app is behind a reverse proxy.
            'documentUrl' => route('admin.projects.bid-docs.document', [
                'project' => $project,
                'version' => $hasSavedVersion ? $version->revision : 0,
            ], false),
            'editor' => [
                'can_edit' => Gate::allows('projects.bid_docs.edit'),
                'has_saved_version' => $hasSavedVersion,
                'is_outdated' => $hasSavedVersion && $project->estimates_updated_at !== null
                    && Carbon::parse((string) $project->estimates_updated_at)->isAfter($version->edited_at),
                'revision' => $version->revision ?? 0,
                'edited_at' => $hasSavedVersion ? $version->edited_at->toISOString() : null,
                'edited_by' => $hasSavedVersion ? $version->editor?->only(['id', 'name']) : null,
                'save_url' => route('admin.projects.bid-docs.update', $project, false),
                'reset_url' => route('admin.projects.bid-docs.destroy', $project, false),
            ],
        ]);
    }

    public function document(Project $project): BinaryFileResponse
    {
        Gate::authorize('projects.bid_docs.view');
        $version = $project->bidDocumentVersion;

        if ($version !== null && Storage::disk('local')->exists($version->stored_path)) {
            return response()->file(
                Storage::disk('local')->path($version->stored_path),
                $this->documentHeaders($project),
            );
        }

        $path = $this->documents->generate($project);

        return response()->file($path, $this->documentHeaders($project))->deleteFileAfterSend(true);
    }

    public function update(UpdateBidDocumentRequest $request, Project $project): RedirectResponse
    {
        Gate::authorize('projects.bid_docs.edit');
        $temporary = null;

        try {
            DB::transaction(function () use ($request, $project, &$temporary): void {
                $version = BidDocumentVersion::query()
                    ->where('project_id', $project->id)
                    ->lockForUpdate()
                    ->first();
                $revision = $version->revision ?? 0;

                if ($revision !== $request->integer('revision')) {
                    throw ValidationException::withMessages([
                        'document' => 'This bid document was updated by another user. Reload the page before saving your changes.',
                    ]);
                }

                $source = $version !== null && Storage::disk('local')->exists($version->stored_path)
                    ? Storage::disk('local')->path($version->stored_path)
                    : null;
                $edits = collect((array) $request->validated('edits'))
                    ->map(fn (mixed $value): string => (string) ($value ?? ''))
                    ->all();
                try {
                    $temporary = $this->documents->applyTextEdits($project, $edits, $source);
                } catch (\RuntimeException $exception) {
                    throw ValidationException::withMessages([
                        'document' => $exception->getMessage(),
                    ]);
                }
                $storedPath = 'bid-documents/project-'.$project->id.'.docx';
                $contents = file_get_contents($temporary);

                if (! is_string($contents) || ! Storage::disk('local')->put($storedPath, $contents)) {
                    throw new \RuntimeException('Unable to store the edited bid document.');
                }

                BidDocumentVersion::query()->updateOrCreate(
                    ['project_id' => $project->id],
                    [
                        'edited_by' => $request->user()->id,
                        'stored_path' => $storedPath,
                        'revision' => $revision + 1,
                        'edited_at' => now(),
                    ],
                );
            });
        } finally {
            if (is_string($temporary) && is_file($temporary)) {
                unlink($temporary);
            }
        }

        return back()->with('success', 'Bid document changes saved successfully.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        Gate::authorize('projects.bid_docs.edit');
        $version = $project->bidDocumentVersion;

        if ($version !== null) {
            Storage::disk('local')->delete($version->stored_path);
            $version->delete();
        }

        return back()->with('success', 'The saved edits were removed and the bid document was regenerated from project data.');
    }

    /** @return array<string, string> */
    private function documentHeaders(Project $project): array
    {
        $name = Str::slug($project->project_code ?: $project->project_name) ?: 'project-'.$project->id;

        return [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'inline; filename="'.$name.'-bid-documents.docx"',
            'Cache-Control' => 'private, no-store',
        ];
    }
}
