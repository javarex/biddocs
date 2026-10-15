<?php

namespace Tests\Feature\Admin;

use App\Models\DupaSource;
use App\Models\Equipment;
use App\Models\ImportHistory;
use App\Models\Item;
use App\Models\Labor;
use App\Models\Miscellaneous;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Role;
use App\Models\Signatory;
use App\Models\SignatoryRoleAssignment;
use App\Models\User;
use App\Services\DupaEstimateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProjectCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_create_and_update_the_complete_project_record(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $preparer = $this->linkPreparer($admin);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'POW-001',
            'project_name' => 'Two Storey School Building',
            'project_description' => 'Ten classroom building',
            'source_of_funds' => 'GAA 2026',
            'location' => 'Monkayo, Davao de Oro',
            'contract_duration' => 345,
            'type_of_projects' => 'Buildings',
            'category' => '1 Room',
            'dimension' => '9.5m x 55m, two floors',
            'floor_area' => '1045 sq.m.',
            'implementation_scheme' => 'contract',
            'allotment_class' => 'Trust Fund',
        ])->assertRedirect();

        $project = Project::query()->sole();
        $this->assertSame($admin->id, $project->created_by);
        $this->assertSame($preparer->cats_no, $project->prepared_by);
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

    public function test_project_code_is_optional_and_project_classification_is_constrained(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $this->linkPreparer($admin);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_name' => 'Optional code project',
            'location' => 'Test location',
            'contract_duration' => 60,
            'type_of_projects' => 'Waterworks',
            'category' => 'Level 2',
            'allotment_class' => 'General Fund',
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('projects', [
            'project_name' => 'Optional code project',
            'project_code' => null,
            'type_of_projects' => 'Waterworks',
            'category' => 'Level 2',
            'allotment_class' => 'General Fund',
        ]);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_name' => 'Invalid classification',
            'location' => 'Test location',
            'contract_duration' => 60,
            'type_of_projects' => 'Waterworks',
            'category' => '1 Room',
            'allotment_class' => 'Special Fund',
        ])->assertSessionHasErrors(['category', 'allotment_class']);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_name' => 'Invalid project type',
            'location' => 'Test location',
            'contract_duration' => 60,
            'type_of_projects' => 'Roads',
        ])->assertSessionHasErrors('type_of_projects');
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

    public function test_current_signatories_autofill_new_projects_and_can_be_explicitly_cleared(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $signatory = Signatory::query()->create([
            'cats_no' => '0012', 'name' => 'Current Engineer',
            'position' => 'Engineer V', 'is_active' => true, 'user_id' => $admin->id,
        ]);
        SignatoryRoleAssignment::query()->create([
            'role' => 'checked_by', 'cats_no' => $signatory->cats_no,
        ]);
        $otherSignatory = Signatory::query()->create([
            'cats_no' => '0013', 'name' => 'Other Engineer',
            'position' => 'Engineer IV', 'is_active' => true,
        ]);

        $this->actingAs($admin)->get(route('admin.projects.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('signatoryDefaults.checked_by', '0012')
                ->where('signatoryDefaults.prepared_by', '0012')
                ->where('signatories.0.cats_no', '0012')
                ->where('signatories.0.is_current_user', true)
                ->where('signatories.0.roles.0', 'checked_by'));

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'AUTO-1', 'project_name' => 'Autofilled project',
            'location' => 'Test', 'contract_duration' => 30,
            'prepared_by' => $otherSignatory->cats_no,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('projects', ['project_code' => 'AUTO-1', 'checked_by' => '0012']);
        $this->assertDatabaseHas('projects', ['project_code' => 'AUTO-1', 'prepared_by' => '0012']);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'AUTO-2', 'project_name' => 'Cleared project',
            'location' => 'Test', 'contract_duration' => 30, 'checked_by' => null,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('projects', ['project_code' => 'AUTO-2', 'checked_by' => null]);
    }

    public function test_project_creation_requires_an_active_signatory_link_for_the_logged_in_user(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'NO-PREPARER', 'project_name' => 'Missing preparer',
            'location' => 'Test', 'contract_duration' => 30,
        ])->assertSessionHasErrors('prepared_by');

        $this->assertDatabaseMissing('projects', ['project_code' => 'NO-PREPARER']);
    }

    public function test_replacing_a_signatory_preserves_historical_projects_and_rejects_stale_new_assignments(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $preparer = $this->linkPreparer($admin);
        $former = Signatory::query()->create([
            'cats_no' => '0020', 'name' => 'Former Engineer',
            'position' => 'Engineer IV', 'is_active' => false,
        ]);
        $current = Signatory::query()->create([
            'cats_no' => '0021', 'name' => 'Current Engineer',
            'position' => 'Engineer V', 'is_active' => true,
        ]);
        SignatoryRoleAssignment::query()->create([
            'role' => 'checked_by', 'cats_no' => $current->cats_no,
        ]);
        $project = Project::query()->create([
            'project_code' => 'HISTORY-1', 'project_name' => 'Historical project',
            'location' => 'Test', 'contract_duration' => 30, 'created_by' => $admin->id,
            'checked_by' => $former->cats_no,
        ]);

        $this->actingAs($admin)->put(route('admin.projects.update', $project), [
            'project_code' => 'HISTORY-1', 'project_name' => 'Historical project',
            'location' => 'Updated', 'contract_duration' => 30,
            'checked_by' => $former->cats_no,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('projects', [
            'id' => $project->id, 'checked_by' => $former->cats_no, 'location' => 'Updated',
        ]);

        $this->actingAs($admin)->post(route('admin.projects.store'), [
            'project_code' => 'STALE-1', 'project_name' => 'Stale form',
            'location' => 'Test', 'contract_duration' => 30,
            'checked_by' => $former->cats_no,
            'prepared_by' => $current->cats_no,
        ])->assertSessionHasErrors('checked_by');
        $this->assertDatabaseMissing('projects', ['project_code' => 'STALE-1']);
        $this->assertDatabaseHas('signatories', ['cats_no' => $preparer->cats_no, 'user_id' => $admin->id]);
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

    public function test_starter_structure_is_editable_and_idempotent(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();

        $this->actingAs($admin)
            ->post(route('admin.projects.starter-structure.store', $project))
            ->assertRedirect();
        $this->actingAs($admin)
            ->post(route('admin.projects.starter-structure.store', $project))
            ->assertRedirect();

        $this->assertSame(
            ['PART I', 'PART II', 'PART III'],
            $project->sections()->orderBy('sort_order')->pluck('section')->all(),
        );
    }

    public function test_structure_rows_can_be_reordered_only_with_their_siblings(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();
        $first = $project->sections()->create(['section' => 'First', 'sort_order' => 1]);
        $second = $project->sections()->create(['section' => 'Second', 'sort_order' => 2]);
        $subA = $first->subSections()->create(['sub_section' => 'A', 'sort_order' => 1]);
        $subB = $first->subSections()->create(['sub_section' => 'B', 'sort_order' => 2]);
        $foreignSub = $second->subSections()->create(['sub_section' => 'Other', 'sort_order' => 1]);

        $this->actingAs($admin)->put(route('admin.projects.structure.order', $project), [
            'type' => 'section', 'ids' => [$second->id, $first->id],
        ])->assertRedirect();
        $this->assertSame([$second->id, $first->id], $project->sections()->orderBy('sort_order')->pluck('id')->all());

        $this->actingAs($admin)->put(route('admin.projects.structure.order', $project), [
            'type' => 'sub_section', 'parent_id' => $first->id, 'ids' => [$subB->id, $subA->id],
        ])->assertRedirect();
        $this->assertSame([$subB->id, $subA->id], $first->subSections()->orderBy('sort_order')->pluck('id')->all());

        $this->actingAs($admin)->put(route('admin.projects.structure.order', $project), [
            'type' => 'sub_section', 'parent_id' => $first->id, 'ids' => [$subA->id, $foreignSub->id],
        ])->assertStatus(422);
    }

    public function test_manually_created_dupa_starts_with_resource_estimates(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $section = $this->project()->sections()->create(['section' => 'PART I']);

        $source = DupaSource::create(['source_file' => 'test.xlsx', 'worksheet' => 'Items', 'source_row' => 1, 'pay_item_no' => 'A.1', 'description' => 'Manual DUPA', 'unit' => 'l.s.']);
        $this->actingAs($admin)->post(route('admin.sections.dupas.store', $section), [
            'dupa_source_id' => $source->id,
        ])->assertRedirect();

        $dupa = ProjectItem::query()->sole();
        $this->assertSame(
            ['ADD' => 'resources', 'NON_ADD' => 'resources'],
            $dupa->estimates()->orderBy('estimate_type')->pluck('calculation_mode', 'estimate_type')->all(),
        );
    }

    public function test_dupa_resources_calculate_add_and_non_add_and_keep_repeated_item_rows(): void
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
        $item = Item::query()->create(['itemcode' => 'MAT-1', 'category_id' => 1, 'description' => 'Chair', 'unit' => 'set']);
        $service = app(DupaEstimateService::class);
        $service->initialize($dupa);

        $estimate = $service->save($dupa, 'ADD', [
            'quantity' => 2, 'ocm_percentage' => 15, 'profit_percentage' => 10, 'vat_percentage' => 5,
            'labors' => [['labor_id' => $labor->id, 'designation' => 'Unskilled Laborer', 'no_of_person' => 2, 'no_of_days' => 3, 'rate' => 500, 'is_included' => true]],
            'equipment' => [['equipment_id' => $equipment->id, 'designation' => 'Dumptruck', 'no_of_units' => 1, 'no_of_days' => 2, 'rental_unit_cost' => 1000, 'is_included' => true]],
            'items' => [
                ['item_id' => $item->id, 'designation' => 'Learner chairs', 'unit' => 'set', 'qty' => 20, 'unit_cost' => 100, 'group' => 'Classrooms', 'is_included' => true],
                ['item_id' => $item->id, 'designation' => 'Teacher chairs', 'unit' => 'set', 'qty' => 1, 'unit_cost' => 200, 'group' => null, 'is_included' => true],
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
        $this->assertDatabaseHas('material_dupa', ['designation' => 'Learner chairs', 'group' => 'Classrooms']);

        $nonAdd = $service->save($dupa, 'NON_ADD', [
            'quantity' => 1, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [],
            'items' => [['item_id' => $item->id, 'designation' => 'Non-add chair', 'unit' => 'set', 'qty' => 1, 'unit_cost' => 100, 'group' => null, 'is_included' => true]],
        ]);
        $this->assertSame(100.0, $nonAdd->total_cost);
        $this->assertSame(9550.0, (float) $dupa->fresh()->total_cost);
    }

    public function test_dupa_can_be_duplicated_with_both_estimates_and_grouped_items(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();
        $section = $project->sections()->create(['section' => 'PART I', 'sort_order' => 1]);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'pay_item_no' => 'A.1',
            'description' => 'Copied work', 'unit' => 'l.s.', 'qty' => 0,
            'estimated_direct_cost' => 0, 'ocm' => 0, 'profit' => 0,
            'total_markup_percentage' => 0, 'total_markup_value' => 0,
            'vat_five_percent' => 0, 'total_indirect_cost' => 0,
            'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        $labor = Labor::query()->create(['manpower' => 'Foreman', 'rates' => 900, 'types' => 'Contract']);
        $item = Item::query()->create([
            'itemcode' => 'COPY-MAT', 'category_id' => 1,
            'description' => 'Copy material', 'unit' => 'pc',
        ]);
        $service = app(DupaEstimateService::class);
        $service->initialize($dupa);
        $service->save($dupa, 'ADD', [
            'quantity' => 2, 'ocm_percentage' => 12, 'profit_percentage' => 8, 'vat_percentage' => 5,
            'labors' => [[
                'labor_id' => $labor->id, 'designation' => 'Foreman',
                'no_of_person' => 1, 'no_of_days' => 2, 'rate' => 900, 'is_included' => true,
            ]],
            'equipment' => [],
            'items' => [[
                'item_id' => $item->id, 'designation' => 'Copy material', 'unit' => 'pc',
                'qty' => 3, 'unit_cost' => 100, 'group' => 'First floor', 'is_included' => true,
            ]],
        ]);
        $service->save($dupa, 'NON_ADD', [
            'quantity' => 1, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [], 'items' => [],
        ]);

        $this->actingAs($admin)
            ->post(route('admin.dupas.duplicate', $dupa))
            ->assertRedirect();

        $copy = ProjectItem::query()->where('id', '!=', $dupa->id)->sole();
        $this->assertSame('A.1 (Copy)', $copy->pay_item_no);
        $this->assertSame($dupa->fresh()->total_cost, $copy->total_cost);
        $this->assertCount(2, $copy->estimates);
        $this->assertSame(1, $copy->laborRows()->count());
        $this->assertSame(1, $copy->materialRows()->count());
        $this->assertSame('First floor', $copy->materialRows()->firstOrFail()->group);
        $this->assertSame(1, $dupa->laborRows()->count());
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

    public function test_project_charges_form_only_submits_editable_fields(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();
        app(DupaEstimateService::class)->ensureProjectSettings($project);
        $project->miscellaneous()->create([
            'estimate_type' => 'ADD', 'description' => 'Permit', 'unit' => 'l.s.',
            'amount' => 25, 'multiplier' => 1, 'sort_order' => 0,
        ]);

        $this->actingAs($admin)->get(route('admin.projects.edit', $project))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('project.estimate_settings.ADD', [
                    'pol_amount' => 0, 'pre_engineering_percentage' => 0,
                    'supervision_percentage' => 0, 'contingencies_amount' => 0,
                ])
                ->where('project.miscellaneous.0', [
                    'estimate_type' => 'ADD', 'description' => 'Permit', 'unit' => 'l.s.',
                    'amount' => 25, 'multiplier' => 1,
                ]));

        $settings = [
            'ADD' => ['pol_amount' => 100, 'pre_engineering_percentage' => 1,
                'supervision_percentage' => 2, 'contingencies_amount' => 50],
            'NON_ADD' => ['pol_amount' => 0, 'pre_engineering_percentage' => 0,
                'supervision_percentage' => 0, 'contingencies_amount' => 0],
        ];
        $miscellaneous = [[
            'estimate_type' => 'ADD', 'description' => 'Permit', 'unit' => 'l.s.',
            'amount' => 30, 'multiplier' => 2,
        ]];

        $this->actingAs($admin)->put(route('admin.projects.estimate-settings.update', $project), [
            'settings' => $settings, 'miscellaneous' => $miscellaneous,
        ])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('project_estimate_settings', [
            'project_id' => $project->id, 'estimate_type' => 'ADD', 'pol_amount' => 100,
        ]);
        $this->assertDatabaseHas('miscellaneous', [
            'project_id' => $project->id, 'description' => 'Permit', 'amount' => 30,
        ]);

        $this->actingAs($admin)->put(route('admin.projects.estimate-settings.update', $project), [
            'settings' => ['ADD' => $settings['ADD'] + ['created_at' => '2026-10-08T01:06:29.000000Z'],
                'NON_ADD' => $settings['NON_ADD']],
            'miscellaneous' => $miscellaneous,
        ])->assertSessionHasErrors('settings.ADD');
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
        $item = Item::query()->create(['itemcode' => 'PERMIT', 'category_id' => 1, 'description' => 'Permit', 'unit' => 'l.s.']);

        $this->expectException(ValidationException::class);
        app(DupaEstimateService::class)->save($dupa, 'ADD', [
            'quantity' => 0, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [],
            'items' => [['item_id' => $item->id, 'designation' => 'Permit', 'unit' => 'l.s.', 'qty' => 1, 'unit_cost' => 100, 'group' => null, 'is_included' => true]],
        ]);
    }

    public function test_item_estimate_uses_catalog_values_and_exposes_project_groups(): void
    {
        $admin = User::factory()->create(['is_super_admin' => true]);
        $project = $this->project();
        $section = $project->sections()->create(['section' => 'PART I']);
        $dupa = ProjectItem::query()->create([
            'section_id' => $section->id, 'sub_section_id' => null, 'pay_item_no' => 'A.1',
            'description' => 'Carpentry', 'unit' => 'l.s.', 'qty' => 1, 'estimated_direct_cost' => 0,
            'ocm' => 0, 'profit' => 0, 'total_markup_percentage' => 0, 'total_markup_value' => 0,
            'vat_five_percent' => 0, 'total_indirect_cost' => 0, 'total_cost' => 0, 'unit_cost_adjusted' => 0,
        ]);
        DB::table('categories')->insert([
            'IDCATEGORY' => 1, 'CATEGORY_DESCRIPTION' => 'Carpentry materials', 'fccode' => null, 'is_active' => true,
        ]);
        $item = Item::query()->create([
            'itemcode' => 'LUMBER-1', 'category_id' => 1,
            'description' => 'Coco lumber', 'unit' => 'bd.ft.',
        ]);
        DB::table('prices')->insert([
            'itemcode' => $item->itemcode, 'price' => 85.25,
            'effective_from' => '2022-07-15', 'effective_to' => '2022-12-31',
        ]);
        DB::table('items')->insert([
            ['itemcode' => 'STEEL-1', 'category_id' => 1, 'description' => 'Steel rods', 'unit' => 'piece'],
            ['itemcode' => 'TILE-1', 'category_id' => 1, 'description' => 'Tiles', 'unit' => 'piece'],
        ]);
        DB::table('prices')->insert([
            ['itemcode' => 'STEEL-1', 'price' => 44, 'effective_from' => '2020-01-01', 'effective_to' => null],
            ['itemcode' => 'STEEL-1', 'price' => 100, 'effective_from' => '2999-01-01', 'effective_to' => null],
            ['itemcode' => 'TILE-1', 'price' => 60, 'effective_from' => '2020-01-01', 'effective_to' => '2020-12-31'],
            ['itemcode' => 'TILE-1', 'price' => 80, 'effective_from' => '2999-01-01', 'effective_to' => null],
        ]);
        app(DupaEstimateService::class)->initialize($dupa);

        $this->actingAs($admin)->put(route('admin.dupas.estimates.update', [$dupa, 'ADD']), [
            'quantity' => 1, 'ocm_percentage' => 0, 'profit_percentage' => 0, 'vat_percentage' => 0,
            'labors' => [], 'equipment' => [],
            'items' => [[
                'item_id' => $item->id, 'qty' => 2, 'group' => ' A. CARPENTRY WORKS ',
                'is_included' => true, 'designation' => 'Changed in browser',
                'unit' => 'wrong', 'unit_cost' => 1,
            ]],
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('material_dupa', [
            'dupa_id' => $dupa->id, 'item_id' => $item->id,
            'designation' => 'Coco lumber', 'unit' => 'bd.ft.',
            'qty' => 2, 'unit_cost' => 85.25, 'group' => 'A. CARPENTRY WORKS',
        ]);
        DB::enableQueryLog();
        DB::flushQueryLog();
        $this->actingAs($admin)->get(route('admin.dupas.edit', $dupa))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('itemGroups', ['A. CARPENTRY WORKS'])
                ->where('canSyncItems', true)
                ->where('syncCategories.0.IDCATEGORY', 1)
                ->where('syncCategories.0.CATEGORY_DESCRIPTION', 'Carpentry materials')
                ->where('catalogs.items.0.price', 85.25)
                ->where('catalogs.items.1.price', 44)
                ->where('catalogs.items.2.price', 80));
        $priceQueries = array_filter(DB::getQueryLog(), fn (array $query): bool => str_contains($query['query'], 'prices'));
        $this->assertCount(1, $priceQueries);
        DB::disableQueryLog();
    }

    private function project(): Project
    {
        return Project::query()->create([
            'project_code' => 'TEST-1', 'project_name' => 'Test project', 'location' => 'Test location',
            'contract_duration' => 30, 'created_by' => User::factory()->create()->id,
        ]);
    }

    private function linkPreparer(User $user): Signatory
    {
        return Signatory::query()->create([
            'cats_no' => 'PREP-'.$user->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'position' => 'Project Preparer',
            'is_active' => true,
        ]);
    }
}
