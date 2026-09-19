<?php

namespace Tests\Feature\Admin;

use App\Models\Equipment;
use App\Models\ImportHistory;
use App\Models\Labor;
use App\Models\Material;
use App\Models\Miscellaneous;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Role;
use App\Models\User;
use App\Services\DupaEstimateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProjectCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_create_and_update_the_complete_project_record(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'POW-001',
            'project_name' => 'Two Storey School Building',
            'project_description' => 'Ten classroom building',
            'source_of_funds' => 'GAA 2026',
            'location' => 'Monkayo, Davao de Oro',
            'contract_duration' => 345,
            'type_of_projects' => 'Buildings',
            'category' => 'Buildings',
            'dimension' => '9.5m x 55m, two floors',
            'floor_area' => '1045 sq.m.',
            'implementation_scheme' => 'contract',
            'allotment_class' => 'Trust Fund',
        ])->assertRedirect();

        $project = Project::query()->sole();
        $this->assertSame($admin->id, $project->created_by);
        $this->assertDatabaseHas('project_estimate_settings', ['project_id' => $project->id, 'estimate_type' => 'ADD']);
        $this->assertDatabaseHas('project_estimate_settings', ['project_id' => $project->id, 'estimate_type' => 'NON_ADD']);

        $this->actingAs($admin)->put(route('admin.projects.update', $project), [
            ...$project->only([
                'project_code', 'project_name', 'project_description', 'source_of_funds', 'location',
                'contract_duration', 'type_of_projects', 'category', 'dimension', 'floor_area',
                'implementation_scheme', 'allotment_class',
            ]),
            'location' => 'Updated location',
        ])->assertRedirect();

        $this->assertDatabaseHas('projects', ['id' => $project->id, 'location' => 'Updated location']);
    }

    public function test_update_permission_is_limited_to_creators_and_successful_importers(): void
    {
        $permission = Permission::query()->create(['name' => 'Update projects', 'slug' => 'projects.update', 'group' => 'Projects']);
        $role = Role::query()->create(['name' => 'Project editor', 'slug' => 'project-editor']);
        $role->permissions()->attach($permission);
        $owner = User::factory()->create();
        $importer = User::factory()->create();
        $stranger = User::factory()->create();
        $owner->roles()->attach($role);
        $importer->roles()->attach($role);
        $stranger->roles()->attach($role);
        $project = Project::query()->create([
            'project_code' => 'OWNED', 'project_name' => 'Owned project', 'location' => 'Test',
            'contract_duration' => 10, 'created_by' => $owner->id,
        ]);
        ImportHistory::query()->create([
            'imported_by' => $importer->id, 'project_id' => $project->id,
            'original_filename' => 'project.xlsx', 'stored_path' => 'imports/project.xlsx',
            'import_type' => 'bid_document', 'import_mode' => 'update', 'status' => 'completed',
        ]);

        $this->actingAs($owner)->get(route('admin.projects.edit', $project))->assertOk();
        $this->actingAs($importer)->get(route('admin.projects.edit', $project))->assertOk();
        $this->actingAs($stranger)->get(route('admin.projects.edit', $project))->assertForbidden();
    }

    public function test_dupa_cannot_use_a_subsection_from_another_section(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();
        $first = $project->sections()->create(['section' => 'PART I']);
        $second = $project->sections()->create(['section' => 'PART II']);
        $foreignSubsection = $second->subSections()->create(['sub_section' => 'PART A']);

        $this->actingAs($admin)->post(route('admin.sections.dupas.store', $first), [
            'sub_section_id' => $foreignSubsection->id,
            'pay_item_no' => 'A.1', 'description' => 'Invalid placement', 'unit' => 'l.s.',
        ])->assertSessionHasErrors('sub_section_id');

        $this->assertDatabaseMissing('dupas', ['pay_item_no' => 'A.1']);
    }

    public function test_dupa_resources_calculate_add_and_non_add_and_keep_repeated_material_rows(): void
    {
        $project = $this->project();
        $section = $project->sections()->create(['section' => 'PART I', 'sort_order' => 1]);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'sub_section_id' => null, 'pay_item_no' => 'SPL-1',
            'description' => 'Tables and Chairs', 'unit' => 'l.s.', 'qty' => 0,
            'estimated_direct_cost' => 0, 'ocm' => 0, 'profit' => 0, 'total_markup_percentage' => 0,
            'total_markup_value' => 0, 'vat_five_percent' => 0, 'total_indirect_cost' => 0,
            'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        $labor = Labor::query()->create(['manpower' => 'Unskilled Laborer', 'rates' => 500, 'types' => 'Contract']);
        $equipment = Equipment::query()->create(['equipment' => 'Dumptruck', 'rental' => 1000]);
        $material = Material::query()->create(['itemcode' => 'MAT-1', 'category_id' => 1, 'description' => 'Chair', 'unit' => 'set']);
        $service = app(DupaEstimateService::class);
        $service->initialize($dupa);

        $estimate = $service->save($dupa, 'ADD', [
            'quantity' => 2, 'ocm_percentage' => 15, 'profit_percentage' => 10, 'vat_percentage' => 5,
            'labors' => [['labor_id' => $labor->id, 'designation' => 'Unskilled Laborer', 'no_of_person' => 2, 'no_of_days' => 3, 'rate' => 500, 'is_included' => true]],
            'equipment' => [['equipment_id' => $equipment->id, 'designation' => 'Dumptruck', 'no_of_units' => 1, 'no_of_days' => 2, 'rental_unit_cost' => 1000, 'is_included' => true]],
            'materials' => [
                ['material_id' => $material->id, 'description' => 'Learner chairs', 'unit' => 'set', 'qty' => 10, 'unit_cost' => 100, 'multiplier' => 2, 'is_included' => true, 'breakdowns' => [['designation' => 'Grade 1', 'unit' => 'set', 'qty' => 5, 'unit_cost' => 0]]],
                ['material_id' => $material->id, 'description' => 'Teacher chairs', 'unit' => 'set', 'qty' => 1, 'unit_cost' => 200, 'multiplier' => 1, 'is_included' => true, 'breakdowns' => []],
            ],
        ]);

        $this->assertSame(3000.0, $estimate->labor_cost);
        $this->assertSame(2000.0, $estimate->equipment_cost);
        $this->assertSame(2200.0, $estimate->material_cost);
        $this->assertSame(7200.0, $estimate->direct_cost);
        $this->assertSame(1080.0, $estimate->ocm_amount);
        $this->assertSame(720.0, $estimate->profit_amount);
        $this->assertSame(450.0, $estimate->vat_amount);
        $this->assertSame(9450.0, $estimate->total_cost);
        $this->assertDatabaseCount('material_dupa', 2);
        $this->assertDatabaseCount('material_items', 1);

        $nonAdd = $service->save($dupa, 'NON_ADD', [
            'quantity' => 1, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [],
            'materials' => [['material_id' => $material->id, 'description' => 'Non-add chair', 'unit' => 'set', 'qty' => 1, 'unit_cost' => 100, 'multiplier' => 1, 'is_included' => true, 'breakdowns' => []]],
        ]);
        $this->assertSame(100.0, $nonAdd->total_cost);
        $this->assertSame(9550.0, (float) $dupa->fresh()->total_cost);
    }

    public function test_project_charges_are_counted_once_per_estimate_side(): void
    {
        $project = $this->project();
        $service = app(DupaEstimateService::class);
        $service->ensureProjectSettings($project);
        $project->estimateSettings()->where('estimate_type', 'ADD')->update([
            'pol_amount' => 100, 'pre_engineering_percentage' => 1,
            'supervision_percentage' => 2, 'contingencies_amount' => 50,
        ]);
        Miscellaneous::query()->create([
            'project_id' => $project->id, 'estimate_type' => 'ADD', 'description' => 'Permit',
            'unit' => 'l.s.', 'amount' => 25, 'multiplier' => 2,
        ]);

        $totals = $service->projectTotals($project);
        $this->assertSame(200.0, $totals['ADD']['charges_total']);
        $this->assertSame(200.0, $totals['ADD']['grand_total']);
        $this->assertSame(0.0, $totals['NON_ADD']['grand_total']);
    }

    public function test_positive_direct_cost_requires_positive_quantity(): void
    {
        $project = $this->project();
        $section = $project->sections()->create(['section' => 'PART I']);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'sub_section_id' => null, 'pay_item_no' => 'B.3',
            'description' => 'Permits', 'unit' => 'l.s.', 'qty' => 0, 'estimated_direct_cost' => 0,
            'ocm' => 0, 'profit' => 0, 'total_markup_percentage' => 0, 'total_markup_value' => 0,
            'vat_five_percent' => 0, 'total_indirect_cost' => 0, 'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        $material = Material::query()->create(['itemcode' => 'PERMIT', 'category_id' => 1, 'description' => 'Permit', 'unit' => 'l.s.']);

        $this->expectException(ValidationException::class);
        app(DupaEstimateService::class)->save($dupa, 'ADD', [
            'quantity' => 0, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [],
            'materials' => [['material_id' => $material->id, 'description' => 'Permit', 'unit' => 'l.s.', 'qty' => 1, 'unit_cost' => 100, 'multiplier' => 1, 'is_included' => true, 'breakdowns' => []]],
        ]);
    }

    private function project(): Project
    {
        return Project::query()->create([
            'project_code' => 'TEST-1', 'project_name' => 'Test project', 'location' => 'Test location',
            'contract_duration' => 30, 'created_by' => User::factory()->create()->id,
        ]);
    }
}
