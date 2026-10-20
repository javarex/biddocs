<?php

namespace Tests\Feature;

use App\Models\Labor;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\User;
use App\Services\DupaEstimateService;
use App\Services\ProjectMarkupRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectMarkupRatesTest extends TestCase
{
    use RefreshDatabase;

    public function test_amount_boundaries_select_the_expected_rates(): void
    {
        $project = Project::query()->create([
            'project_name' => 'Rate test', 'location' => 'Test', 'contract_duration' => 1,
        ]);
        $rates = app(ProjectMarkupRateService::class);

        foreach ([
            [0, 15, 10], [5000000, 15, 10], [5000000.01, 12, 8],
            [50000000, 12, 8], [50000000.01, 10, 8],
            [150000000, 10, 8], [150000000.01, 8, 8],
        ] as [$amount, $ocm, $profit]) {
            $project->update(['allocated_amount' => $amount]);
            $this->assertSame([
                'ocm_percentage' => (float) $ocm,
                'profit_percentage' => (float) $profit,
                'vat_percentage' => 5.0,
            ], $rates->forProject($project));
        }
    }

    public function test_estimates_default_to_project_rates_allow_edits_and_recalculate_when_amount_changes(): void
    {
        $project = Project::query()->create([
            'project_name' => 'Rate test', 'location' => 'Test', 'contract_duration' => 1,
            'allocated_amount' => 5000000,
        ]);
        $section = $project->sections()->create(['section' => 'PART I']);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'pay_item_no' => '1', 'description' => 'Work', 'unit' => 'lot',
            'qty' => 0, 'estimated_direct_cost' => 0, 'ocm' => 0, 'profit' => 0,
            'total_markup_percentage' => 0, 'total_markup_value' => 0,
            'vat_five_percent' => 0, 'total_indirect_cost' => 0,
            'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        $labor = Labor::query()->create(['manpower' => 'Worker', 'rates' => 1000, 'types' => 'Contract']);
        $service = app(DupaEstimateService::class);
        $service->initialize($dupa);
        $this->assertSame(15.0, $dupa->estimates()->where('estimate_type', 'ADD')->firstOrFail()->ocm_percentage);

        $estimate = $service->save($dupa, 'ADD', [
            'quantity' => 1,
            'ocm_percentage' => 9, 'profit_percentage' => 6, 'vat_percentage' => 4,
            'labors' => [[
                'labor_id' => $labor->id, 'designation' => 'Worker',
                'no_of_person' => 1, 'no_of_days' => 1, 'rate' => 1000, 'is_included' => true,
            ]],
            'equipment' => [], 'items' => [],
        ]);
        $this->assertSame(9.0, $estimate->ocm_percentage);
        $this->assertSame(90.0, $estimate->ocm_amount);
        $this->assertSame(60.0, $estimate->profit_amount);
        $this->assertSame(46.0, $estimate->vat_amount);

        $totals = $service->projectTotals($project);
        $this->assertSame(1000.0, $totals['ADD']['labor_cost']);
        $this->assertSame(0.0, $totals['ADD']['material_cost']);
        $this->assertSame(0.0, $totals['ADD']['equipment_cost']);
        $this->assertSame(90.0, $totals['ADD']['ocm_amount']);
        $this->assertSame(60.0, $totals['ADD']['profit_amount']);
        $this->assertSame(46.0, $totals['ADD']['vat_amount']);
        $this->assertSame(196.0, $totals['ADD']['indirect_cost']);
        foreach ($totals as $side) {
            $this->assertEqualsWithDelta(
                $side['grand_total'],
                $side['direct_cost'] + $side['pol_amount'] + $side['indirect_cost'],
                0.001,
            );
        }


        $admin = User::factory()->create(['is_super_admin' => true]);
        $this->actingAs($admin)->put(route('admin.projects.update', $project), [
            'project_name' => $project->project_name,
            'location' => $project->location,
            'contract_duration' => $project->contract_duration,
            'allocated_amount' => 5000000.01,
        ])->assertSessionHasNoErrors();
        $estimate->refresh();
        $this->assertSame(12.0, $estimate->ocm_percentage);
        $this->assertSame(120.0, $estimate->ocm_amount);
        $this->assertSame(80.0, $estimate->profit_amount);
        $this->assertSame(60.0, $estimate->vat_amount);
        $this->assertSame(1260.0, $estimate->total_cost);
        $this->assertSame(1260.0, $dupa->fresh()->total_cost);
    }

    public function test_imported_summary_uses_project_rates(): void
    {
        $project = Project::query()->create([
            'project_name' => 'Imported project', 'location' => 'Test', 'contract_duration' => 1,
            'allocated_amount' => 75000000,
        ]);
        $section = $project->sections()->create(['section' => 'PART I']);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'pay_item_no' => '1', 'description' => 'Imported work', 'unit' => 'lot',
            'qty' => 1, 'estimated_direct_cost' => 1000, 'ocm' => 150, 'profit' => 100,
            'total_markup_percentage' => .25, 'total_markup_value' => 250,
            'vat_five_percent' => 62.5, 'total_indirect_cost' => 312.5,
            'total_cost' => 1312.5, 'unit_cost_adjusted' => 1312.5,
        ]);

        $estimate = $dupa->estimates()->where('estimate_type', 'ADD')->firstOrFail();
        $this->assertSame(10.0, $estimate->ocm_percentage);
        $this->assertSame(8.0, $estimate->profit_percentage);
        $this->assertSame(5.0, $estimate->vat_percentage);
        $this->assertSame(1239.0, $estimate->total_cost);
        $this->assertSame(1239.0, $dupa->fresh()->total_cost);
    }

    public function test_project_pages_receive_the_read_only_rate_table(): void
    {
        $project = Project::query()->create([
            'project_name' => 'Visible rates', 'location' => 'Test', 'contract_duration' => 1,
            'allocated_amount' => 50000000.01,
        ]);
        $admin = User::factory()->create(['is_super_admin' => true]);

        foreach (['admin.projects.show', 'admin.projects.edit', 'admin.projects.dupa'] as $route) {
            $this->actingAs($admin)->get(route($route, $project))->assertOk()->assertInertia(
                fn (Assert $page) => $page
                    ->where('project.allocated_amount', 50000000.01)
                    ->where('markupRateBands.0.ocm_percentage', 15)
                    ->where('markupRateBands.2.ocm_percentage', 10)
                    ->where('markupRateBands.2.vat_percentage', 5)
                    ->has('markupRateBands', 4)
            );
        }
    }
}
