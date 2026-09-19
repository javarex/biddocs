<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Section;
use App\Models\Signatory;
use App\Models\SubSection;
use App\Services\DupaEstimateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(private readonly DupaEstimateService $estimates) {}

    public function index(Request $request): Response
    {
        Gate::authorize('projects.view');
        $search = trim((string) $request->string('search'));
        $projects = Project::query()->withCount(['sections', 'items'])
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                $query->where('project_code', 'like', "%{$search}%")
                    ->orWhere('project_name', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            }))->orderByDesc('id')->paginate(10)->withQueryString()
            ->through(fn (Project $project): array => [
                ...$project->only(['id', 'project_code', 'project_name', 'project_description', 'location', 'contract_duration']),
                'sections_count' => $project->sections_count,
                'items_count' => $project->items_count,
                'can_edit' => Gate::forUser($request->user())->allows('update', $project),
                'can_delete' => Gate::forUser($request->user())->allows('delete', $project),
            ]);

        return Inertia::render('admin/projects/index', [
            'projects' => $projects,
            'filters' => ['search' => $search],
            'can_create' => Gate::allows('projects.create'),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('projects.create');

        return Inertia::render('admin/projects/create', ['signatories' => $this->signatories()]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('projects.create');
        $project = Project::query()->create($this->validated($request) + ['created_by' => $request->user()->id]);
        $this->estimates->ensureProjectSettings($project);
        $project->estimateSettings()->where('estimate_type', 'ADD')->update([
            'pol_amount' => $project->pol ?? 0,
            'contingencies_amount' => $project->contingencies ?? 0,
        ]);

        return to_route('admin.projects.edit', $project)->with('success', 'Project created. Add its sections and DUPA items next.');
    }

    public function show(Project $project): Response
    {
        Gate::authorize('projects.view');
        $project->load([
            'sections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems' => fn ($query) => $query->whereNull('sub_section_id')->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems.estimates',
            'sections.subSections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems.estimates',
        ]);

        return Inertia::render('admin/projects/show', [
            'project' => [
                ...$project->only([
                    'id', 'project_code', 'project_name', 'project_description', 'source_of_funds',
                    'location', 'contract_duration', 'type_of_projects', 'category', 'dimension',
                    'floor_area', 'implementation_scheme', 'allotment_class',
                ]),
                'can_edit' => Gate::allows('update', $project),
                'can_delete' => Gate::allows('delete', $project),
                'sections' => $project->sections->map(fn (Section $section): array => [
                    'id' => $section->id,
                    'section' => $section->section,
                    'sort_order' => $section->sort_order,
                    'items' => $section->projectItems->map(fn (ProjectItem $item) => $this->item($item))->values(),
                    'sub_sections' => $section->subSections->map(fn (SubSection $subSection): array => [
                        'id' => $subSection->id,
                        'sub_section' => $subSection->sub_section,
                        'sort_order' => $subSection->sort_order,
                        'items' => $subSection->projectItems->map(fn (ProjectItem $item) => $this->item($item))->values(),
                    ])->values(),
                ])->values(),
            ],
            'totals' => $this->estimates->projectTotals($project),
        ]);
    }

    public function edit(Project $project): Response
    {
        Gate::authorize('update', $project);
        $this->estimates->ensureProjectSettings($project);
        $project->load([
            'sections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems' => fn ($query) => $query->whereNull('sub_section_id')->orderBy('sort_order')->orderBy('id'),
            'sections.subSections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'estimateSettings', 'miscellaneous' => fn ($query) => $query->orderBy('estimate_type')->orderBy('sort_order'),
        ]);

        return Inertia::render('admin/projects/edit', [
            'project' => [
                ...$project->only($this->fields()),
                'sections' => $project->sections->map(fn (Section $section): array => [
                    'id' => $section->id,
                    'section' => $section->section,
                    'sort_order' => $section->sort_order,
                    'items' => $section->projectItems->map(fn (ProjectItem $item) => $item->only(['id', 'pay_item_no', 'description', 'unit']))->values(),
                    'sub_sections' => $section->subSections->map(fn (SubSection $subSection): array => [
                        'id' => $subSection->id,
                        'sub_section' => $subSection->sub_section,
                        'sort_order' => $subSection->sort_order,
                        'items' => $subSection->projectItems->map(fn (ProjectItem $item) => $item->only(['id', 'pay_item_no', 'description', 'unit']))->values(),
                    ])->values(),
                ])->values(),
                'estimate_settings' => $project->estimateSettings->keyBy('estimate_type'),
                'miscellaneous' => $project->miscellaneous,
            ],
            'signatories' => $this->signatories(),
            'totals' => $this->estimates->projectTotals($project),
        ]);
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $project->update($this->validated($request) + ['estimates_updated_at' => now()]);
        $this->estimates->ensureProjectSettings($project);
        $project->estimateSettings()->where('estimate_type', 'ADD')->update([
            'pol_amount' => $project->pol ?? 0,
            'contingencies_amount' => $project->contingencies ?? 0,
        ]);

        return back()->with('success', 'Project details updated.');
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

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $signatory = ['nullable', 'string', 'max:64', Rule::exists('signatories', 'cats_no')];

        return $request->validate([
            'project_code' => ['required', 'string', 'max:45'],
            'project_name' => ['required', 'string', 'max:255'],
            'project_description' => ['nullable', 'string', 'max:10000'],
            'source_of_funds' => ['nullable', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'contract_duration' => ['required', 'integer', 'min:1', 'max:100000'],
            'type_of_projects' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'dimension' => ['nullable', 'string', 'max:10000'],
            'floor_area' => ['nullable', 'string', 'max:255'],
            'implementation_scheme' => ['nullable', Rule::in(['Administration', 'contract'])],
            'allotment_class' => ['nullable', 'string', 'max:255'],
            'pol' => ['nullable', 'numeric', 'min:0'],
            'contingencies' => ['nullable', 'numeric', 'min:0'],
            'prepared_by' => $signatory,
            'checked_by' => $signatory,
            'recommending_approval' => $signatory,
            'included_in_aip' => $signatory,
            'recommending_approval_pao' => $signatory,
            'approved_by' => $signatory,
        ]);
    }

    /** @return list<string> */
    private function fields(): array
    {
        return [
            'id', 'project_code', 'project_name', 'project_description', 'source_of_funds', 'location',
            'contract_duration', 'type_of_projects', 'category', 'dimension', 'floor_area',
            'implementation_scheme', 'allotment_class', 'prepared_by', 'checked_by',
            'pol', 'contingencies',
            'recommending_approval', 'included_in_aip', 'recommending_approval_pao', 'approved_by',
        ];
    }

    /** @return array<int, Signatory> */
    private function signatories(): array
    {
        return Signatory::query()->orderBy('name')->get(['cats_no', 'name', 'position'])->values()->all();
    }

    /** @return array<string, mixed> */
    private function item(ProjectItem $item): array
    {
        return [
            ...$item->only(['id', 'pay_item_no', 'description', 'unit', 'qty', 'estimated_direct_cost', 'total_cost', 'unit_cost_adjusted']),
            'estimates' => $item->estimates->mapWithKeys(fn ($estimate) => [$estimate->estimate_type => $estimate->only(['quantity', 'direct_cost', 'total_cost', 'unit_cost'])]),
        ];
    }
}
