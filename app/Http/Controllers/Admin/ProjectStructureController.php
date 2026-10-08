<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Section;
use App\Models\SubSection;
use App\Services\DupaEstimateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ProjectStructureController extends Controller
{
    public function __construct(private readonly DupaEstimateService $estimates) {}

    public function storeSection(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate(['section' => ['required', 'string', 'max:10000']]);
        $project->sections()->create($data + ['sort_order' => (int) $project->sections()->max('sort_order') + 1]);
        $this->touch($project);

        return back()->with('success', 'Section added.');
    }

    public function reorder(Request $request, Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);
        $data = $request->validate([
            'type' => ['required', Rule::in(['section', 'sub_section', 'dupa'])],
            'parent_id' => ['nullable', 'integer'],
            'sub_section_id' => ['nullable', 'integer'],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer', 'distinct'],
        ]);

        $section = $data['type'] === 'section'
            ? null
            : $project->sections()->findOrFail($data['parent_id'] ?? 0);
        if ($data['type'] === 'dupa' && isset($data['sub_section_id'])) {
            $section->subSections()->findOrFail($data['sub_section_id']);
        }

        $query = match ($data['type']) {
            'section' => $project->sections(),
            'sub_section' => $section->subSections(),
            'dupa' => $section->projectItems()
                ->where('sub_section_id', $data['sub_section_id'] ?? null),
        };

        $existing = $query->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $submitted = collect($data['ids'])->map(fn ($id) => (int) $id)->sort()->values()->all();
        if ($existing !== $submitted) {
            abort(422, 'The row list has changed. Refresh the page and try again.');
        }

        DB::transaction(function () use ($query, $data, $project): void {
            foreach ($data['ids'] as $index => $id) {
                (clone $query)->whereKey($id)->update(['sort_order' => $index + 1]);
            }
            $this->touch($project);
        });

        return back()->with('success', 'Row order saved.');
    }

    public function applyStarterStructure(Project $project): RedirectResponse
    {
        Gate::authorize('update', $project);

        DB::transaction(function () use ($project): void {
            $nextOrder = (int) $project->sections()->max('sort_order') + 1;
            foreach (['PART I', 'PART II', 'PART III'] as $name) {
                $section = $project->sections()->firstOrCreate(
                    ['section' => $name],
                    ['sort_order' => $nextOrder],
                );
                if ($section->wasRecentlyCreated) {
                    $nextOrder++;
                }
            }
            $this->touch($project);
        });

        return back()->with('success', 'PART I–III starter structure added. Rename the parts as needed.');
    }

    public function updateSection(Request $request, Section $section): RedirectResponse
    {
        Gate::authorize('update', $section->project);
        $section->update($request->validate([
            'section' => ['required', 'string', 'max:10000'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]));
        $this->touch($section->project);

        return back()->with('success', 'Section updated.');
    }

    public function destroySection(Section $section): RedirectResponse
    {
        Gate::authorize('update', $section->project);
        $project = $section->project;
        $section->delete();
        $this->touch($project);

        return back()->with('success', 'Section and its DUPA items deleted.');
    }

    public function storeSubSection(Request $request, Section $section): RedirectResponse
    {
        Gate::authorize('update', $section->project);
        $data = $request->validate(['sub_section' => ['required', 'string', 'max:10000']]);
        $section->subSections()->create($data + ['sort_order' => (int) $section->subSections()->max('sort_order') + 1]);
        $this->touch($section->project);

        return back()->with('success', 'Subsection added.');
    }

    public function updateSubSection(Request $request, SubSection $subSection): RedirectResponse
    {
        Gate::authorize('update', $subSection->section->project);
        $subSection->update($request->validate([
            'sub_section' => ['required', 'string', 'max:10000'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]));
        $this->touch($subSection->section->project);

        return back()->with('success', 'Subsection updated.');
    }

    public function destroySubSection(SubSection $subSection): RedirectResponse
    {
        Gate::authorize('update', $subSection->section->project);
        $project = $subSection->section->project;
        $subSection->delete();
        $this->touch($project);

        return back()->with('success', 'Subsection and its DUPA items deleted.');
    }

    public function storeDupa(Request $request, Section $section): RedirectResponse
    {
        Gate::authorize('update', $section->project);
        $data = $request->validate([
            'sub_section_id' => ['nullable', 'integer', Rule::exists('sub_sections', 'id')->where('section_id', $section->id)],
            'pay_item_no' => ['required', 'string', 'max:45'],
            'description' => ['required', 'string', 'max:10000'],
            'unit' => ['required', 'string', 'max:45'],
        ]);
        $dupa = ProjectItem::query()->create($data + [
            'section_id' => $section->id,
            'sort_order' => (int) $section->projectItems()->max('sort_order') + 1,
            'qty' => 0, 'estimated_direct_cost' => 0, 'ocm' => 0, 'profit' => 0,
            'total_markup_percentage' => 0, 'total_markup_value' => 0, 'vat_five_percent' => 0,
            'total_indirect_cost' => 0, 'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        $this->estimates->initialize($dupa);
        $this->touch($section->project);

        if ($request->boolean('stay_on_structure')) {
            return back()->with('success', 'DUPA item added.');
        }

        return to_route('admin.dupas.edit', $dupa)->with('success', 'DUPA item created. Add its estimate resources.');
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
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $dupa->update($data);
        $this->touch($project);

        return back()->with('success', 'DUPA details updated.');
    }

    public function destroyDupa(ProjectItem $dupa): RedirectResponse
    {
        $project = $dupa->section->project;
        Gate::authorize('update', $project);
        $dupa->delete();
        $this->touch($project);

        return to_route('admin.projects.edit', $project)->with('success', 'DUPA item deleted.');
    }

    public function duplicateDupa(Request $request, ProjectItem $dupa): RedirectResponse
    {
        $project = $dupa->section->project;
        Gate::authorize('update', $project);
        $copy = $this->estimates->duplicate($dupa);

        if ($request->boolean('stay_on_structure')) {
            return back()->with('success', 'DUPA copied with its ADD/NON-ADD resources and estimates.');
        }

        return to_route('admin.dupas.edit', $copy)
            ->with('success', 'DUPA copied with its ADD/NON-ADD resources and estimates.');
    }

    private function touch(Project $project): void
    {
        $project->update(['estimates_updated_at' => now()]);
    }
}
