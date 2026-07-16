<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\BidDocumentService;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProjectBidDocumentController extends Controller
{
    public function __construct(private readonly BidDocumentService $documents) {}

    public function show(Project $project): Response
    {
        Gate::authorize('projects.bid_docs.view');

        return Inertia::render('admin/projects/bid-docs', [
            'project' => [
                ...$project->only(['id', 'project_code', 'project_name', 'location', 'contract_duration']),
                'sections_count' => $project->sections()->count(),
                'items_count' => $project->items()->count(),
                'total_cost' => (float) $project->items()->sum('total_cost'),
            ],
            'documentUrl' => route('admin.projects.bid-docs.document', $project),
        ]);
    }

    public function document(Project $project): BinaryFileResponse
    {
        Gate::authorize('projects.bid_docs.view');
        $path = $this->documents->generate($project);

        return response()->file($path, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => 'inline; filename="'.$project->project_code.'-bid-documents.docx"',
            'Cache-Control' => 'private, no-store',
        ])->deleteFileAfterSend(true);
    }
}
