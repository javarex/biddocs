<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Section;
use App\Models\SubSection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('projects.view');

        $search = trim((string) $request->string('search'));
        $projects = Project::query()
            ->withCount(['sections', 'items'])
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                $query->where('project_code', 'like', "%{$search}%")
                    ->orWhere('project_name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            }))
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Project $project): array => [
                'id' => $project->id,
                'project_code' => $project->project_code,
                'project_name' => $project->project_name,
                'project_description' => $project->project_description,
                'location' => $project->location,
                'contract_duration' => $project->contract_duration,
                'sections_count' => $project->sections_count,
                'items_count' => $project->items_count,
                'can_delete' => Gate::forUser($request->user())->allows('delete', $project),
            ]);

        return Inertia::render('admin/projects/index', [
            'projects' => $projects,
            'filters' => ['search' => $search],
        ]);
    }

    public function show(Project $project): Response
    {
        Gate::authorize('projects.view');

        $project->load([
            'sections' => fn ($query) => $query->orderBy('id'),
            'sections.subSections' => fn ($query) => $query->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('id'),
        ]);

        return Inertia::render('admin/projects/show', [
            'project' => [
                'id' => $project->id,
                'project_code' => $project->project_code,
                'project_name' => $project->project_name,
                'project_description' => $project->project_description,
                'location' => $project->location,
                'contract_duration' => $project->contract_duration,
                'can_delete' => Gate::allows('delete', $project),
                'sections' => $project->sections->map(fn (Section $section): array => [
                    'id' => $section->id,
                    'section' => $section->section,
                    'sub_sections' => $section->subSections->map(fn (SubSection $subSection): array => [
                        'id' => $subSection->id,
                        'sub_section' => $subSection->sub_section,
                        'items' => $subSection->projectItems->map(fn (ProjectItem $item): array => [
                            'id' => $item->id,
                            'pay_item_no' => $item->pay_item_no,
                            'description' => $item->description,
                            'unit' => $item->unit,
                            'qty' => $item->qty,
                            'estimated_direct_cost' => $item->estimated_direct_cost,
                            'total_cost' => $item->total_cost,
                            'unit_cost_adjusted' => $item->unit_cost_adjusted,
                        ])->values()->all(),
                    ])->values()->all(),
                ])->values()->all(),
            ],
        ]);
    }

    public function destroy(Project $project): RedirectResponse
    {
        Gate::authorize('delete', $project);

        if ($project->bidDocumentVersion !== null) {
            Storage::disk('local')->delete($project->bidDocumentVersion->stored_path);
        }

        $project->delete();

        return to_route('admin.projects.index')->with('success', 'Project deleted successfully.');
    }
}
