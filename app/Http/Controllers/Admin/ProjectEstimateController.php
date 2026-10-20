<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DupaBackupTemplate;
use App\Models\Equipment;
use App\Models\Item;
use App\Models\Labor;
use App\Models\Miscellaneous;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Services\Backup\ExcavationTemplate;
use App\Services\DupaEstimateService;
use App\Services\ProjectMarkupRateService;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProjectEstimateController extends Controller
{
    public function __construct(private readonly DupaEstimateService $estimates, private readonly ProjectMarkupRateService $markupRates) {}

    public function edit(Request $request, ProjectItem $dupa): Response
    {
        $project = $dupa->section->project;
        Gate::authorize('update', $project);
        $this->estimates->initialize($dupa);
        $dupa->load([
            'section.project', 'subSection',
            'estimates' => fn ($query) => $query->orderBy('estimate_type'),
            'estimates.labors' => fn ($query) => $query->orderBy('sort_order'),
            'estimates.equipment' => fn ($query) => $query->orderBy('sort_order'),
            'estimates.backups',
            'estimates.items' => fn ($query) => $query->orderBy('sort_order'),
        ]);
        $orderedIds = ProjectItem::query()
            ->select('dupas.id')
            ->join('sections', 'sections.id', '=', 'dupas.section_id')
            ->leftJoin('sub_sections', 'sub_sections.id', '=', 'dupas.sub_section_id')
            ->where('sections.project_id', $project->id)
            ->orderBy('sections.sort_order')
            ->orderBy('sections.id')
            ->orderByRaw('CASE WHEN dupas.sub_section_id IS NULL THEN 0 ELSE 1 END')
            ->orderBy('sub_sections.sort_order')
            ->orderBy('sub_sections.id')
            ->orderBy('dupas.sort_order')
            ->orderBy('dupas.id')
            ->pluck('dupas.id')
            ->map(fn ($id): int => (int) $id)
            ->values();
        $position = $orderedIds->search((int) $dupa->id);

        return Inertia::render(
            $request->boolean('embedded') ? 'admin/projects/dupa-embed' : 'admin/projects/dupa-edit',
            [
                'backupTemplates' => array_merge(
                    [['id' => 0, 'name' => '803 (1)a Structure Excavation (ADD example)', 'version' => 1, 'creator' => ['name' => 'Workbook example'], 'definition' => ExcavationTemplate::definition()]],
                    DupaBackupTemplate::query()->visibleTo($request->user()->id)->with('creator:id,name')->orderBy('name')->get()->toArray(),
                ),
                'embedded' => $request->boolean('embedded'),
                'project' => $project->only(['id', 'project_code', 'project_name', 'allocated_amount']),
                'markupRates' => $this->markupRates->forProject($project),
                'dupa' => [
                    ...$dupa->only(['id', 'section_id', 'sub_section_id', 'pay_item_no', 'description', 'unit', 'sort_order']),
                    'estimates' => $dupa->estimates->keyBy('estimate_type'),
                ],
                'sections' => $project->sections()->with('subSections:id,section_id,sub_section')->orderBy('sort_order')->get(['id', 'project_id', 'section']),
                'catalogs' => [
                    'labors' => Labor::query()->orderBy('manpower')->get(['id', 'manpower', 'rates', 'types']),
                    'equipment' => Equipment::query()->orderBy('equipment')->get(['id', 'equipment', 'rental']),
                    'items' => $this->pricedItems(),
                ],
                'syncCategories' => Gate::allows('sync', Item::class)
                    ? DB::table('categories')->orderBy('CATEGORY_DESCRIPTION')->get(['IDCATEGORY', 'CATEGORY_DESCRIPTION', 'fccode'])
                    : [],
                'canSyncItems' => Gate::allows('sync', Item::class),
                'canSyncPrices' => Gate::allows('encodePrices', Item::class),
                'syncMessage' => $request->session()->get('item_sync'),
                'itemGroups' => DB::table('material_dupa')
                    ->join('dupas', 'dupas.id', '=', 'material_dupa.dupa_id')
                    ->join('sections', 'sections.id', '=', 'dupas.section_id')
                    ->where('sections.project_id', $project->id)
                    ->whereNotNull('material_dupa.group')
                    ->where('material_dupa.group', '<>', '')
                    ->distinct()
                    ->orderBy('material_dupa.group')
                    ->pluck('material_dupa.group'),
                'navigation' => [
                    'previous_id' => $position !== false && $position > 0 ? $orderedIds[$position - 1] : null,
                    'next_id' => $position !== false && $position < $orderedIds->count() - 1 ? $orderedIds[$position + 1] : null,
                    'position' => $position === false ? 1 : $position + 1,
                    'total' => $orderedIds->count(),
                ],
                'canCreateResources' => Gate::allows('libraries.create'),
            ],
        );
    }

    public function updateDupa(Request $request, ProjectItem $dupa): RedirectResponse
    {
        $project = $dupa->section->project;
        Gate::authorize('update', $project);
        $data = $request->validate([
            'section_id' => ['required', 'integer', Rule::exists('sections', 'id')->where('project_id', $project->id)],
            'sub_section_id' => ['nullable', 'integer', Rule::exists('sub_sections', 'id')->where('section_id', $request->integer('section_id'))],
            'pay_item_no' => ['required', 'string', 'max:45'],
            'description' => ['required', 'string', 'max:10000'],
            'unit' => ['required', 'string', 'max:45'],
            'sort_order' => ['required', 'integer', 'min:0'],
        ]);
        $dupa->update($data);
        $project->update(['estimates_updated_at' => now()]);

        return back()->with('success', 'DUPA details updated.');
    }

    public function saveAll(Request $request, ProjectItem $dupa): JsonResponse
    {
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate([
            'details' => ['required', 'array'],
            'estimates' => ['present', 'array:ADD,NON_ADD'],
            'estimates.ADD' => ['sometimes', 'array'],
            'estimates.NON_ADD' => ['sometimes', 'array'],
        ]);

        DB::transaction(function () use ($request, $dupa, $data): void {
            $detailsRequest = clone $request;
            $detailsRequest->replace($data['details']);
            $this->updateDupa($detailsRequest, $dupa);

            foreach ($data['estimates'] as $type => $estimate) {
                $estimateRequest = clone $request;
                $estimateRequest->replace($estimate);
                try {
                    $this->updateEstimate($estimateRequest, $dupa, $type);
                } catch (ValidationException $exception) {
                    $errors = [];
                    foreach ($exception->errors() as $field => $messages) {
                        $errors["{$type}.{$field}"] = $messages;
                    }
                    throw ValidationException::withMessages($errors);
                }
            }
        });

        return response()->json([
            'estimates' => $dupa->estimates()->with(['labors', 'equipment', 'items', 'backups'])->get()->keyBy('estimate_type'),
        ]);
    }

    public function updateEstimate(Request $request, ProjectItem $dupa, string $type): RedirectResponse|JsonResponse
    {
        abort_unless(in_array($type, ['ADD', 'NON_ADD'], true), 404);
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate([
            'backup_revision' => ['sometimes', 'integer', 'min:0'],
            'quantity' => ['required', 'numeric', 'min:0', 'max:99999999999999'],
            'ocm_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'profit_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'vat_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'labors.*.row_uuid' => ['nullable', 'uuid', 'distinct'],
            'labors' => ['array'],
            'labors.*.labor_id' => ['required', 'integer', Rule::exists('labors', 'id')],
            'labors.*.designation' => ['required', 'string', 'max:255'],
            'labors.*.no_of_person' => ['required', 'numeric', 'min:0'],
            'labors.*.no_of_days' => ['required', 'numeric', 'min:0'],
            'labors.*.rate' => ['required', 'numeric', 'min:0'],
            'labors.*.is_included' => ['required', 'boolean'],
            'equipment.*.row_uuid' => ['nullable', 'uuid', 'distinct'],
            'equipment' => ['array'],
            'equipment.*.equipment_id' => ['required', 'integer', Rule::exists('equipments', 'id')],
            'equipment.*.designation' => ['required', 'string', 'max:255'],
            'equipment.*.no_of_units' => ['required', 'numeric', 'min:0'],
            'equipment.*.no_of_days' => ['required', 'numeric', 'min:0'],
            'equipment.*.rental_unit_cost' => ['required', 'numeric', 'min:0'],
            'equipment.*.is_included' => ['required', 'boolean'],
            'items.*.row_uuid' => ['nullable', 'uuid', 'distinct'],
            'items' => ['array'],
            'items.*.item_id' => ['required', 'integer', Rule::exists('items', 'id')],
            'items.*.qty' => ['required', 'numeric', 'min:0'],
            'items.*.group' => ['nullable', 'string', 'max:255'],
            'items.*.is_included' => ['required', 'boolean'],
        ]);
        $data['items'] = $this->hydrateCatalogItems($data['items'] ?? []);
        DB::transaction(function () use ($dupa, $type, $data): void {
            $dupa->estimates()->firstOrCreate(['estimate_type' => $type], ['calculation_mode' => 'resources']);
            $estimate = $dupa->estimates()->where('estimate_type', $type)->lockForUpdate()->firstOrFail();
            if (isset($data['backup_revision']) && $estimate->backup_revision !== $data['backup_revision']) {
                throw ValidationException::withMessages(['backup' => 'This estimate changed. Reload before saving.']);
            }
            $this->estimates->save($dupa, $type, $data);
        });

        if ($request->expectsJson()) {
            return response()->json(['estimate' => $dupa->estimates()->where('estimate_type', $type)->firstOrFail()->load(['labors', 'equipment', 'items', 'backups'])]);
        }

        return back()->with('success', "{$type} estimate updated.");
    }

    public function copyAdd(Request $request, ProjectItem $dupa): RedirectResponse
    {
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate(['add_revision' => ['required', 'integer'], 'non_add_revision' => ['required', 'integer']]);
        $this->estimates->copyAddToNonAdd($dupa, $data['add_revision'], $data['non_add_revision']);

        return back()->with('success', 'ADD copied to NON-ADD with independent backups.');
    }

    public function updateProject(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate([
            'pol' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'settings' => ['required', 'array:ADD,NON_ADD'],
            'settings.*' => ['required', 'array:pol_amount,pre_engineering_percentage,supervision_percentage,contingencies_amount'],
            'settings.*.pol_amount' => ['required', 'numeric', 'min:0'],
            'settings.*.pre_engineering_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'settings.*.supervision_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'settings.*.contingencies_amount' => ['required', 'numeric', 'min:0'],
            'miscellaneous' => ['array'],
            'miscellaneous.*' => ['required', 'array:estimate_type,description,unit,amount,multiplier'],
            'miscellaneous.*.estimate_type' => ['required', Rule::in(['ADD', 'NON_ADD'])],
            'miscellaneous.*.description' => ['required', 'string', 'max:10000'],
            'miscellaneous.*.unit' => ['required', 'string', 'max:45'],
            'miscellaneous.*.amount' => ['required', 'numeric', 'min:0'],
            'miscellaneous.*.multiplier' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($project, $data): void {
            $this->estimates->ensureProjectSettings($project);
            $pol = $data['pol'] ?? $data['settings']['ADD']['pol_amount'];
            foreach ($data['settings'] as $type => $settings) {
                $settings['pol_amount'] = $type === 'ADD' ? $pol : 0;
                $project->estimateSettings()->where('estimate_type', $type)->update($settings);
            }
            $project->update([
                'pol' => $pol,
                'contingencies' => $data['settings']['ADD']['contingencies_amount'],
                'estimates_updated_at' => now(),
            ]);
            $project->miscellaneous()->delete();
            foreach ($data['miscellaneous'] ?? [] as $index => $row) {
                Miscellaneous::query()->create($row + ['project_id' => $project->id, 'sort_order' => $index]);
            }
        });

        return back()->with('success', 'Project charges updated.');
    }

    /**
     * @param  list<array{item_id: int, qty: mixed, group?: string|null, is_included: bool}>  $rows
     * @return list<array<string, mixed>>
     */
    private function hydrateCatalogItems(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $items = $this->pricedItemsQuery()
            ->whereIn('items.id', collect($rows)->pluck('item_id')->unique())
            ->get()->keyBy('id');

        return array_values(collect($rows)->map(function (array $row, int $index) use ($items): array {
            $item = $items->get((int) $row['item_id']);
            if (! $item || $item->catalog_price === null) {
                throw ValidationException::withMessages([
                    "items.{$index}.item_id" => 'The selected item does not have a price history.',
                ]);
            }

            return [
                ...$row,
                'designation' => $item->description,
                'unit' => $item->unit,
                'unit_cost' => $item->catalog_price,
                'group' => filled($row['group'] ?? null) ? trim((string) $row['group']) : null,
            ];
        })->all());
    }

    /** @return Collection<int, array{id: mixed, itemcode: mixed, description: mixed, unit: mixed, price: float}> */
    private function pricedItems(): Collection
    {
        return $this->pricedItemsQuery()->orderBy('items.description')->get()
            ->map(fn (object $item): array => [
                'id' => $item->id,
                'itemcode' => $item->itemcode,
                'description' => $item->description,
                'unit' => $item->unit,
                'price' => (float) ($item->catalog_price ?? 0),
            ]);
    }

    private function pricedItemsQuery(): Builder
    {
        $today = now()->toDateString();

        return DB::table('items')
            ->select(['items.id', 'items.itemcode', 'items.description', 'items.unit'])
            ->selectSub(function ($query) use ($today): void {
                $query->from('prices')
                    ->select('price')
                    ->whereColumn('prices.itemcode', 'items.itemcode')
                    ->orderByRaw(
                        'CASE WHEN effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?) THEN 0 ELSE 1 END',
                        [$today, $today],
                    )
                    ->orderByDesc('effective_from')
                    ->orderByDesc('id')
                    ->limit(1);
            }, 'catalog_price');
    }
}
