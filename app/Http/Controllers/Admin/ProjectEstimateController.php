<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\Labor;
use App\Models\Material;
use App\Models\Miscellaneous;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Services\DupaEstimateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProjectEstimateController extends Controller
{
    public function __construct(private readonly DupaEstimateService $estimates) {}

    public function edit(ProjectItem $dupa): Response
    {
        $project = $dupa->section->project;
        Gate::authorize('update', $project);
        $this->estimates->initialize($dupa);
        $dupa->load([
            'section.project', 'subSection',
            'estimates' => fn ($query) => $query->orderBy('estimate_type'),
            'estimates.labors' => fn ($query) => $query->orderBy('sort_order'),
            'estimates.equipment' => fn ($query) => $query->orderBy('sort_order'),
            'estimates.materials' => fn ($query) => $query->orderBy('sort_order'),
            'estimates.materials.breakdowns' => fn ($query) => $query->orderBy('sort_order'),
        ]);

        return Inertia::render('admin/projects/dupa-edit', [
            'project' => $project->only(['id', 'project_code', 'project_name']),
            'dupa' => [
                ...$dupa->only(['id', 'section_id', 'sub_section_id', 'pay_item_no', 'description', 'unit', 'sort_order']),
                'estimates' => $dupa->estimates->keyBy('estimate_type'),
            ],
            'sections' => $project->sections()->with('subSections:id,section_id,sub_section')->orderBy('sort_order')->get(['id', 'project_id', 'section']),
            'catalogs' => [
                'labors' => Labor::query()->orderBy('manpower')->get(['id', 'manpower', 'rates', 'types']),
                'equipment' => Equipment::query()->orderBy('equipment')->get(['id', 'equipment', 'rental']),
                'materials' => Material::query()->orderBy('description')->get(['id', 'itemcode', 'description', 'unit'])
                    ->map(function (Material $material): array {
                        $price = DB::table('prices')->where('itemcode', $material->itemcode)
                            ->where('effective_from', '<=', now()->toDateString())
                            ->where(fn ($query) => $query->whereNull('effective_to')->orWhere('effective_to', '>=', now()->toDateString()))
                            ->orderByDesc('effective_from')->value('price');

                        return [...$material->toArray(), 'price' => (float) ($price ?? 0)];
                    }),
            ],
        ]);
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

    public function updateEstimate(Request $request, ProjectItem $dupa, string $type): RedirectResponse
    {
        abort_unless(in_array($type, ['ADD', 'NON_ADD'], true), 404);
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'min:0', 'max:99999999999999'],
            'ocm_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'profit_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'vat_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'labors' => ['array'],
            'labors.*.labor_id' => ['required', 'integer', Rule::exists('labors', 'id')],
            'labors.*.designation' => ['required', 'string', 'max:255'],
            'labors.*.no_of_person' => ['required', 'numeric', 'min:0'],
            'labors.*.no_of_days' => ['required', 'numeric', 'min:0'],
            'labors.*.rate' => ['required', 'numeric', 'min:0'],
            'labors.*.is_included' => ['required', 'boolean'],
            'equipment' => ['array'],
            'equipment.*.equipment_id' => ['required', 'integer', Rule::exists('equipments', 'id')],
            'equipment.*.designation' => ['required', 'string', 'max:255'],
            'equipment.*.no_of_units' => ['required', 'numeric', 'min:0'],
            'equipment.*.no_of_days' => ['required', 'numeric', 'min:0'],
            'equipment.*.rental_unit_cost' => ['required', 'numeric', 'min:0'],
            'equipment.*.is_included' => ['required', 'boolean'],
            'materials' => ['array'],
            'materials.*.material_id' => ['required', 'integer', Rule::exists('materials', 'id')],
            'materials.*.description' => ['required', 'string', 'max:10000'],
            'materials.*.unit' => ['required', 'string', 'max:45'],
            'materials.*.qty' => ['required', 'numeric', 'min:0'],
            'materials.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'materials.*.multiplier' => ['required', 'numeric', 'min:0'],
            'materials.*.is_included' => ['required', 'boolean'],
            'materials.*.breakdowns' => ['array'],
            'materials.*.breakdowns.*.designation' => ['required', 'string', 'max:255'],
            'materials.*.breakdowns.*.unit' => ['required', 'string', 'max:45'],
            'materials.*.breakdowns.*.qty' => ['required', 'numeric', 'min:0'],
            'materials.*.breakdowns.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
        ]);
        $this->estimates->save($dupa, $type, $data);

        return back()->with('success', "{$type} estimate updated.");
    }

    public function updateProject(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate([
            'settings' => ['required', 'array:ADD,NON_ADD'],
            'settings.*.pol_amount' => ['required', 'numeric', 'min:0'],
            'settings.*.pre_engineering_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'settings.*.supervision_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'settings.*.contingencies_amount' => ['required', 'numeric', 'min:0'],
            'miscellaneous' => ['array'],
            'miscellaneous.*.estimate_type' => ['required', Rule::in(['ADD', 'NON_ADD'])],
            'miscellaneous.*.description' => ['required', 'string', 'max:10000'],
            'miscellaneous.*.unit' => ['required', 'string', 'max:45'],
            'miscellaneous.*.amount' => ['required', 'numeric', 'min:0'],
            'miscellaneous.*.multiplier' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($project, $data): void {
            $this->estimates->ensureProjectSettings($project);
            foreach ($data['settings'] as $type => $settings) {
                $project->estimateSettings()->where('estimate_type', $type)->update($settings);
            }
            $project->update([
                'pol' => $data['settings']['ADD']['pol_amount'],
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
}
