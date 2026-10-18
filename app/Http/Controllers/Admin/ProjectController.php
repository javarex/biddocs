<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Section;
use App\Models\Signatory;
use App\Models\SignatoryRoleAssignment;
use App\Models\SubSection;
use App\Models\User;
use App\Services\DupaEstimateService;
use App\Services\ProjectMarkupRateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(private readonly DupaEstimateService $estimates, private readonly ProjectMarkupRateService $markupRates) {}

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
                ...$project->only(['id', 'project_code', 'project_date', 'project_name', 'allocated_amount', 'project_description', 'location', 'contract_duration']),
                'sections_count' => $project->sections_count,
                'items_count' => $project->items_count,
                'can_edit' => Gate::forUser($request->user())->allows('update', $project),
                'can_delete' => Gate::forUser($request->user())->allows('delete', $project),
            ]);

        return Inertia::render('admin/projects/index', [
            'projects' => $projects,
            'filters' => ['search' => $search],
            'can_create' => Gate::allows('projects.create'),
            'can_view_dupa' => Gate::allows('projects.dupa.view'),
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('projects.create');
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('admin/projects/create', [
            ...$this->signatoryFormData(user: $user),
            'markupRateBands' => $this->markupRates->bands(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('projects.create');
        $data = $this->validated($request);
        /** @var User $user */
        $user = $request->user();
        $preparer = $this->loggedInSignatory($user);
        if ($preparer === null) {
            throw ValidationException::withMessages([
                'prepared_by' => 'Your user account is not linked to an active signatory. Ask an administrator to link it in Libraries → Signatories.',
            ]);
        }

        $data['prepared_by'] = $preparer->cats_no;
        $defaults = $this->currentSignatoryDefaults();
        foreach (array_keys(Signatory::ROLES) as $role) {
            if (! $request->exists($role)) {
                $data[$role] = $defaults[$role];
            }
        }

        $project = DB::transaction(function () use ($data, $request): Project {
            $miscellaneous = $data['miscellaneous'] ?? [];
            unset($data['miscellaneous']);
            $project = Project::query()->create($data + ['created_by' => $request->user()->id]);
            $this->syncProjectCharges($project);
            $this->syncMiscellaneous($project, $miscellaneous);

            return $project;
        });

        return to_route('admin.projects.dupa', ['project' => $project])
            ->with('success', 'Project created. Add its sections and DUPA items here.');
    }

    public function show(Project $project): Response
    {
        Gate::authorize('projects.view');

        return $this->projectSummary($project, 'admin/projects/show');
    }

    public function dupa(Project $project): Response
    {
        Gate::authorize('projects.dupa.view');

        return $this->projectSummary($project, 'admin/projects/dupa');
    }

    private function projectSummary(Project $project, string $component): Response
    {
        $project->load([
            'sections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems' => fn ($query) => $query->whereNull('sub_section_id')->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems.estimates',
            'sections.subSections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems.estimates',
        ]);

        $chargeData = [];
        if ($component === 'admin/projects/dupa') {
            $this->estimates->ensureProjectSettings($project);
            $chargeData = [
                'pol' => $project->pol,
                'settings' => $project->estimateSettings()->get()->mapWithKeys(fn ($setting): array => [$setting->estimate_type => $setting->only([
                    'pol_amount', 'pre_engineering_percentage', 'supervision_percentage', 'contingencies_amount',
                ])]),
                'miscellaneous' => $project->miscellaneous()->orderBy('estimate_type')->orderBy('sort_order')->get()->map(fn ($row): array => $row->only([
                    'estimate_type', 'description', 'unit', 'amount', 'multiplier',
                ])),
                'totals' => $this->estimates->projectTotals($project),
            ];
        }

        return Inertia::render($component, [
            'markupRateBands' => $this->markupRates->bands(),
            'chargeData' => $chargeData,
            'can_view_dupa' => Gate::allows('projects.dupa.view'),
            ...($component === 'admin/projects/dupa' && Gate::allows('update', $project) ? [
                'dupaSections' => $project->sections->map(fn (Section $section): array => [
                    'id' => $section->id, 'section' => $section->section, 'sort_order' => $section->sort_order,
                    'items' => $section->projectItems->map(fn (ProjectItem $item) => $this->editableItem($item))->values(),
                    'sub_sections' => $section->subSections->map(fn (SubSection $subSection): array => [
                        'id' => $subSection->id, 'sub_section' => $subSection->sub_section, 'sort_order' => $subSection->sort_order,
                        'items' => $subSection->projectItems->map(fn (ProjectItem $item) => $this->editableItem($item))->values(),
                    ])->values(),
                ])->values(),
                'openEstimateId' => request()->integer('estimate') ?: null,
            ] : []),
            'project' => [
                ...$project->only([
                    'id', 'project_code', 'project_date', 'project_name', 'allocated_amount', 'project_description', 'source_of_funds',
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
            'totals' => $component === 'admin/projects/dupa' ? null : $this->estimates->projectTotals($project),
        ]);
    }

    public function edit(Request $request, Project $project): Response
    {
        Gate::authorize('update', $project);
        $this->estimates->ensureProjectSettings($project);
        $project->load([
            'sections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems' => fn ($query) => $query->whereNull('sub_section_id')->orderBy('sort_order')->orderBy('id'),
            'sections.projectItems.estimates',
            'sections.subSections' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'sections.subSections.projectItems.estimates',
            'estimateSettings', 'miscellaneous' => fn ($query) => $query->orderBy('estimate_type')->orderBy('sort_order'),
        ]);

        $items = $project->sections->flatMap(fn (Section $section) => $section->projectItems
            ->concat($section->subSections->flatMap(fn (SubSection $subSection) => $subSection->projectItems)));
        $configured = $items->filter(fn (ProjectItem $item): bool => $item->estimates->contains(
            fn ($estimate): bool => (float) $estimate->quantity > 0 || (float) $estimate->total_cost > 0,
        ));
        $imported = $items->filter(fn (ProjectItem $item): bool => $item->estimates->contains(
            fn ($estimate): bool => $estimate->calculation_mode === 'imported_summary',
        ));
        $missingSignatories = collect(['prepared_by', ...array_keys(Signatory::ROLES)])
            ->filter(fn (string $role): bool => blank($project->{$role}))
            ->values();

        return Inertia::render('admin/projects/edit', [
            'markupRateBands' => $this->markupRates->bands(),
            'project' => [
                ...$project->only($this->fields()),
                'estimate_settings' => $project->estimateSettings
                    ->mapWithKeys(fn ($setting): array => [$setting->estimate_type => $setting->only([
                        'pol_amount', 'pre_engineering_percentage',
                        'supervision_percentage', 'contingencies_amount',
                    ])]),
                'miscellaneous' => $project->miscellaneous->map(fn ($row): array => $row->only([
                    'estimate_type', 'description', 'unit', 'amount', 'multiplier',
                ])),
            ],
            ...$this->signatoryFormData($project),
            'canViewDupa' => Gate::allows('projects.dupa.view'),
            'totals' => $this->estimates->projectTotals($project),
            'initialStep' => in_array($request->query('step'), ['details', 'signatories', 'review'], true)
                ? $request->query('step')
                : 'details',
            'completion' => [
                'has_sections' => $project->sections->isNotEmpty(),
                'total_dupas' => $items->count(),
                'configured_dupas' => $configured->count(),
                'imported_summaries' => $imported->count(),
                'missing_signatories' => $missingSignatories,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function editableItem(ProjectItem $item): array
    {
        return [
            ...$item->only([
                'id', 'section_id', 'sub_section_id', 'pay_item_no', 'description', 'unit', 'sort_order',
            ]),
            'has_estimate' => $item->estimates->contains(
                fn ($estimate): bool => (float) $estimate->quantity > 0 || (float) $estimate->total_cost > 0,
            ),
            'needs_review' => $item->estimates->contains(
                fn ($estimate): bool => $estimate->calculation_mode === 'imported_summary',
            ),
        ];
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $data = $this->validated($request, $project);
        DB::transaction(function () use ($project, $data): void {
            $miscellaneous = $data['miscellaneous'] ?? null;
            unset($data['prepared_by'], $data['miscellaneous']);
            $project->update($data + ['estimates_updated_at' => now()]);
            if ($project->wasChanged('allocated_amount')) {
                $this->estimates->refreshProjectMarkup($project);
            }
            if (array_key_exists('pol', $data) || array_key_exists('contingencies', $data)) {
                $this->syncProjectCharges($project);
            }
            if ($miscellaneous !== null) {
                $this->syncMiscellaneous($project, $miscellaneous);
            }
        });

        return back()->with('success', 'Project details updated.');
    }

    private function syncProjectCharges(Project $project): void
    {
        $this->estimates->ensureProjectSettings($project);
        $project->estimateSettings()->where('estimate_type', 'ADD')->update([
            'pol_amount' => $project->pol ?? 0,
            'contingencies_amount' => $project->contingencies ?? 0,
        ]);
        $project->estimateSettings()->where('estimate_type', 'NON_ADD')->update(['pol_amount' => 0]);
    }

    /** @param array<int, array<string, mixed>> $rows */
    private function syncMiscellaneous(Project $project, array $rows): void
    {
        $project->miscellaneous()->delete();
        foreach ($rows as $index => $row) {
            $project->miscellaneous()->create($row + ['sort_order' => $index]);
        }
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
    private function validated(Request $request, ?Project $project = null): array
    {
        return $request->validate([
            'project_code' => ['nullable', 'string', 'max:45'],
            'project_name' => ['required', 'string', 'max:255'],
            'project_date' => ['nullable', 'date_format:Y-m-d'],
            'allocated_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999999999.99'],
            'project_description' => ['nullable', 'string', 'max:10000'],
            'source_of_funds' => ['nullable', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'contract_duration' => ['required', 'integer', 'min:1', 'max:100000'],
            'type_of_projects' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($project): void {
                    if ($value === null || $value === '' || $project?->type_of_projects === $value) {
                        return;
                    }

                    if (! in_array($value, ['Buildings', 'Waterworks', 'Others'], true)) {
                        $fail('Select Buildings, Waterworks, or Others as the project type.');
                    }
                },
            ],
            'category' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($request, $project): void {
                    if ($value === null || $value === '') {
                        return;
                    }

                    $type = $request->input('type_of_projects');
                    if ($project?->type_of_projects === $type && $project?->category === $value) {
                        return;
                    }

                    $categories = match ($type) {
                        'Buildings' => ['1 Room', '2 Rooms', '3 Rooms', '4 Rooms'],
                        'Waterworks' => ['Level 1', 'Level 2', 'Level 3'],
                        'Others' => ['Home Economics'],
                        default => [],
                    };
                    $isSpecifiedOther = str_starts_with((string) $value, 'Others: ')
                        && trim(substr((string) $value, strlen('Others: '))) !== '';

                    if (! in_array($value, $categories, true) && ! $isSpecifiedOther) {
                        $fail('Select a category available for the chosen project type or specify the other category.');
                    }
                },
            ],
            'dimension' => ['nullable', 'string', 'max:10000'],
            'floor_area' => ['nullable', 'string', 'max:255'],
            'implementation_scheme' => ['nullable', Rule::in(['Administration', 'contract'])],
            'allotment_class' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($project): void {
                    if ($value === null || $value === '' || $project?->allotment_class === $value) {
                        return;
                    }

                    if (! in_array($value, ['Trust Fund', 'General Fund'], true)) {
                        $fail('Select Trust Fund or General Fund as the allotment class.');
                    }
                },
            ],
            'miscellaneous' => ['sometimes', 'array'],
            'miscellaneous.*' => ['required', 'array:estimate_type,description,unit,amount,multiplier'],
            'miscellaneous.*.estimate_type' => ['required', Rule::in(['ADD', 'NON_ADD'])],
            'miscellaneous.*.description' => ['required', 'string', 'max:10000'],
            'miscellaneous.*.unit' => ['required', 'string', 'max:45'],
            'miscellaneous.*.amount' => ['required', 'numeric', 'min:0'],
            'miscellaneous.*.multiplier' => ['required', 'numeric', 'min:0'],
            'pol' => ['nullable', 'numeric', 'min:0'],
            'contingencies' => ['nullable', 'numeric', 'min:0'],
            'prepared_by' => ['nullable', 'string', 'max:64', Rule::exists('signatories', 'cats_no')],
            'checked_by' => $this->signatoryRule('checked_by', $project),
            'recommending_approval' => $this->signatoryRule('recommending_approval', $project),
            'included_in_aip' => $this->signatoryRule('included_in_aip', $project),
            'recommending_approval_pao' => $this->signatoryRule('recommending_approval_pao', $project),
            'approved_by' => $this->signatoryRule('approved_by', $project),
        ]);
    }

    /** @return list<string> */
    private function fields(): array
    {
        return [
            'id', 'project_code', 'project_date', 'project_name', 'allocated_amount', 'project_description', 'source_of_funds', 'location',
            'contract_duration', 'type_of_projects', 'category', 'dimension', 'floor_area',
            'implementation_scheme', 'allotment_class', 'prepared_by', 'checked_by',
            'pol', 'contingencies',
            'recommending_approval', 'included_in_aip', 'recommending_approval_pao', 'approved_by',
        ];
    }

    /** @return array<string, mixed> */
    private function signatoryFormData(?Project $project = null, ?User $user = null): array
    {
        $assignments = SignatoryRoleAssignment::query()
            ->with('signatory:cats_no,name')
            ->whereIn('role', array_keys(Signatory::ROLES))
            ->whereHas('signatory', fn ($query) => $query->where('is_active', true))
            ->get(['role', 'cats_no'])
            ->keyBy('role');
        $catsNumbers = $assignments->pluck('cats_no');
        $preparer = $project === null && $user !== null ? $this->loggedInSignatory($user) : null;

        if ($preparer !== null) {
            $catsNumbers->push($preparer->cats_no);
        }

        if ($project !== null) {
            $catsNumbers = $catsNumbers->merge(
                collect(['prepared_by', ...array_keys(Signatory::ROLES)])
                    ->map(fn (string $role) => $project->{$role}),
            );
        }

        return [
            'signatories' => Signatory::query()
                ->whereIn('cats_no', $catsNumbers->filter()->unique()->values())
                ->orderBy('name')
                ->get(['cats_no', 'name', 'position', 'is_active'])
                ->map(fn (Signatory $signatory): array => [
                    ...$signatory->only(['cats_no', 'name', 'position', 'is_active']),
                    'roles' => $assignments->where('cats_no', $signatory->cats_no)->keys()->values()->all(),
                    'is_current_user' => $preparer?->cats_no === $signatory->cats_no,
                ])->values()->all(),
            'signatoryDefaults' => ['prepared_by' => $preparer?->cats_no] + collect(array_keys(Signatory::ROLES))
                ->mapWithKeys(fn (string $role): array => [$role => $assignments->get($role)?->cats_no])
                ->all(),
            'canCreateSignatories' => Gate::allows('libraries.create'),
            'canUpdateSignatories' => Gate::allows('libraries.update'),
            'signatoryRoleOptions' => collect(Signatory::ROLES)
                ->map(fn (string $label, string $role): array => [
                    'key' => $role,
                    'label' => $label,
                    'cats_no' => $assignments->get($role)?->cats_no,
                    'name' => $assignments->get($role)?->signatory?->name,
                ])->values()->all(),
            'signatorySystemUsers' => User::query()
                ->orderBy('name')->orderBy('username')
                ->get(['id', 'name', 'username', 'is_active'])->all(),
        ];
    }

    /** @return array<string, string|null> */
    private function currentSignatoryDefaults(): array
    {
        return $this->signatoryFormData()['signatoryDefaults'];
    }

    private function loggedInSignatory(User $user): ?Signatory
    {
        return Signatory::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();
    }

    /** @return array<int, mixed> */
    private function signatoryRule(string $role, ?Project $project): array
    {
        return [
            'nullable',
            'string',
            'max:64',
            Rule::exists('signatories', 'cats_no'),
            function (string $attribute, mixed $value, \Closure $fail) use ($role, $project): void {
                if ($value === null || $value === '' || $project?->{$role} === $value) {
                    return;
                }

                $isCurrent = SignatoryRoleAssignment::query()
                    ->where('role', $role)
                    ->where('cats_no', $value)
                    ->whereHas('signatory', fn ($query) => $query->where('is_active', true))
                    ->exists();

                if (! $isCurrent) {
                    $fail('The selected signatory is no longer the current '.strtolower(Signatory::ROLES[$role]).'. Refresh the page and try again.');
                }
            },
        ];
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
