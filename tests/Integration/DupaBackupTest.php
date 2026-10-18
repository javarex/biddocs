<?php

namespace Tests\Integration;

use App\Models\DupaBackupTemplate;
use App\Models\DupaEstimate;
use App\Models\DupaSource;
use App\Models\Equipment;
use App\Models\Item;
use App\Models\Labor;
use App\Models\Permission;
use App\Models\Project;
use App\Models\ProjectItem;
use App\Models\Role;
use App\Models\Section;
use App\Models\User;
use App\Services\Backup\ExcavationTemplate;
use App\Services\DupaEstimateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DupaBackupTest extends TestCase
{
    use RefreshDatabase;

    private ProjectItem $dupa;

    private DupaEstimate $estimate;

    private array $document;

    private DupaEstimateService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['inertia.ssr.enabled' => false]);
        $this->actingAs(User::factory()->create(['is_super_admin' => true, 'is_active' => true]));
        $project = Project::create(['project_name' => 'School', 'location' => 'Monkayo', 'contract_duration' => 345]);
        $section = Section::create(['project_id' => $project->id, 'section' => 'Building']);
        $this->dupa = ProjectItem::create(['section_id' => $section->id, 'pay_item_no' => '803 (1)a', 'description' => 'Structure Excavation', 'unit' => 'm³'] + array_fill_keys(['qty', 'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage', 'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost', 'unit_cost_adjusted'], 0));
        $this->service = app(DupaEstimateService::class);
        $this->service->initialize($this->dupa);
        $labor = Labor::create(['manpower' => 'Laborer', 'rates' => 525, 'types' => 'Contract']);
        $equipment = Equipment::create(['equipment' => 'Excavator', 'rental' => 20344]);
        $laborUuid = (string) Str::uuid();
        $equipmentUuid = (string) Str::uuid();
        $this->estimate = $this->service->save($this->dupa, 'ADD', [
            'quantity' => 1, 'ocm_percentage' => 12, 'profit_percentage' => 8, 'vat_percentage' => 5,
            'labors' => [['labor_id' => $labor->id, 'designation' => 'Laborer', 'row_uuid' => $laborUuid, 'no_of_person' => 4, 'no_of_days' => 1, 'rate' => 525, 'is_included' => true]],
            'equipment' => [['equipment_id' => $equipment->id, 'designation' => 'Excavator', 'row_uuid' => $equipmentUuid, 'no_of_units' => 1, 'no_of_days' => 1, 'rental_unit_cost' => 20344, 'is_included' => true]], 'items' => [],
        ]);
        $this->document = ['backups' => [['key' => 'excavation', 'name' => 'Excavation backup', 'owner_type' => 'labors', 'owner_uuid' => $laborUuid, 'schema_version' => 1, 'definition' => ExcavationTemplate::definition()['table']]],
            'bindings' => [
                ['kind' => 'estimate', 'field' => 'quantity', 'formula' => '=excavation.outputs.total_volume'],
                ['kind' => 'labors', 'row_uuid' => $laborUuid, 'field' => 'no_of_days', 'formula' => '=excavation.outputs.labor_days'],
                ['kind' => 'equipment', 'row_uuid' => $equipmentUuid, 'field' => 'no_of_days', 'formula' => '=excavation.outputs.equipment_days'],
            ]];
    }

    private function url(string $action, string $side = 'ADD'): string
    {
        return "/admin/dupas/{$this->dupa->id}/estimates/{$side}/backups/{$action}";
    }

    private function payload(): array
    {
        return ['revision' => $this->estimate->fresh()->backup_revision, 'document' => $this->document];
    }

    private function apply(): void
    {
        $preview = $this->postJson($this->url('preview'), $this->payload())->assertOk()->json('preview_token');
        $this->postJson($this->url('apply'), $this->payload() + ['preview_token' => $preview])->assertOk();
        $this->estimate->refresh()->load(['labors', 'equipment', 'items']);
    }

    public function test_encoding_data_is_on_the_dedicated_dupa_page_and_not_project_edit(): void
    {
        $projectId = $this->dupa->section->project_id;
        $this->get("/admin/projects/{$projectId}/dupa")
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/projects/dupa')
            ->has('dupaSections', 1)->has('dupaSections.0.items', 1)
            ->where('dupaSections.0.items.0.id', $this->dupa->id)
            ->where('project.can_edit', true));
        $this->get("/admin/projects/{$projectId}/edit")
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/projects/edit')
            ->missing('project.sections')->where('initialStep', 'details'));
    }

    public function test_add_item_returns_to_the_dupa_workspace_and_opens_the_new_estimate(): void
    {
        $source = DupaSource::create(['source_file' => 'test.xlsx', 'worksheet' => 'Items', 'source_row' => 1, 'pay_item_no' => '804 (1)', 'suffix' => 'b', 'description' => 'Embankment', 'unit' => 'm³']);
        $response = $this->post(route('admin.sections.dupas.store', $this->dupa->section), [
            'dupa_source_id' => $source->id, 'open_estimate' => true,
        ])->assertSessionHasNoErrors();
        $created = ProjectItem::where('pay_item_no', '804 (1)b')->sole();
        $this->assertSame(2, $created->estimates()->count());
        $url = route('admin.projects.dupa', ['project' => $this->dupa->section->project_id, 'estimate' => $created->id]);
        $response->assertRedirect($url);
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->where('openEstimateId', $created->id));
    }

    public function test_source_lookup_searches_complete_codes_and_specifications_and_requires_edit_access(): void
    {
        $source = DupaSource::create(['source_file' => 'test.xlsx', 'worksheet' => 'Items', 'source_row' => 1, 'pay_item_no' => '803 (1)', 'suffix' => 'a', 'description' => 'Structure Excavation', 'thickness_sizes' => '2 metres', 'class' => 'Class A', 'others' => 'Rock', 'unit' => 'm³']);
        $url = "/admin/projects/{$this->dupa->section->project_id}/dupa-sources";
        $this->getJson($url.'?search=803(1)a')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $source->id)->assertJsonPath('data.0.pay_item_no', '803 (1)a');
        $this->getJson($url.'?search=metres')->assertOk()->assertJsonPath('data.0.description', 'Structure Excavation, 2 metres, Class A, Rock');
        $this->getJson($url.'?search=no-match')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        $this->getJson($url)->assertForbidden();
    }

    public function test_creation_uses_source_fields_and_rejects_missing_or_invalid_sources(): void
    {
        $url = route('admin.sections.dupas.store', $this->dupa->section);
        $this->postJson($url, ['pay_item_no' => 'Fake', 'description' => 'Fake', 'unit' => 'pc'])->assertUnprocessable()->assertJsonValidationErrors('dupa_source_id');
        $this->postJson($url, ['dupa_source_id' => 999999])->assertUnprocessable()->assertJsonValidationErrors('dupa_source_id');
        $source = DupaSource::create(['source_file' => 'test.xlsx', 'worksheet' => 'Items', 'source_row' => 1, 'pay_item_no' => '900 (1)', 'suffix' => 'a', 'description' => 'Concrete', 'thickness_sizes' => '150 mm', 'unit' => 'm³']);
        $this->postJson($url, ['dupa_source_id' => $source->id, 'pay_item_no' => 'Tampered', 'description' => 'Tampered', 'unit' => 'pc'])->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseHas('dupas', ['pay_item_no' => '900 (1)a', 'description' => 'Concrete, 150 mm', 'unit' => 'm³']);
        $this->assertDatabaseMissing('dupas', ['pay_item_no' => 'Tampered']);
    }

    public function test_preview_does_not_persist_and_apply_updates_all_linked_values(): void
    {
        $revision = $this->estimate->backup_revision;
        $preview = $this->postJson($this->url('preview'), $this->payload())->assertOk()->assertJsonPath('estimate.quantity', 432.36)->json('preview_token');
        $this->assertDatabaseCount('dupa_detail_backups', 0);
        $this->assertSame($revision, $this->estimate->fresh()->backup_revision);
        $this->assertSame(1.0, $this->estimate->fresh()->quantity);
        $this->postJson($this->url('apply'), $this->payload() + ['preview_token' => $preview])->assertOk();
        $this->estimate->refresh();
        $this->assertSame(432.36, $this->estimate->quantity);
        $this->assertSame(11.0, $this->estimate->labors()->sole()->no_of_days);
        $this->assertSame(2.0, $this->estimate->equipment()->sole()->no_of_days);
        $this->assertNotNull($this->estimate->backup_applied);
        $this->assertSame(0.0, $this->dupa->estimates()->where('estimate_type', 'NON_ADD')->sole()->quantity);
        $this->assertDatabaseCount('dupa_detail_backups', 1);
    }

    public function test_draft_does_not_change_applied_values_and_ordinary_save_uses_applied_formulas(): void
    {
        $this->apply();
        $this->document['backups'][0]['definition']['inputs'][0]['value'] = 8;
        $this->postJson($this->url('draft'), $this->payload())->assertOk();
        $this->assertSame(432.36, $this->estimate->fresh()->quantity);
        $data = $this->estimate->fresh(['labors', 'equipment', 'items'])->toArray();
        $data['labors'][0]['no_of_days'] = 99;
        $this->putJson("/admin/dupas/{$this->dupa->id}/estimates/ADD", $data)->assertOk()
            ->assertJsonPath('estimate.quantity', 432.36);
        $this->assertSame(11.0, $this->estimate->labors()->sole()->no_of_days);
        $this->assertSame(432.36, $this->estimate->fresh()->quantity);
        $this->assertSame(8, $this->estimate->backups()->sole()->definition['inputs'][0]['value']);
    }

    public function test_preview_token_and_revision_prevent_stale_apply(): void
    {
        $token = $this->postJson($this->url('preview'), $this->payload())->assertOk()->json('preview_token');
        $this->document['backups'][0]['definition']['inputs'][0]['value'] = 8;
        $this->postJson($this->url('apply'), $this->payload() + ['preview_token' => $token])->assertUnprocessable();
        $payload = $this->payload();
        $this->postJson($this->url('draft'), $payload)->assertOk();
        $this->postJson($this->url('preview'), $payload)->assertUnprocessable();
    }

    public function test_invalid_references_reject_changes_without_partial_writes(): void
    {
        $this->apply();
        $before = $this->estimate->backups()->sole()->definition;
        $this->document['backups'][0]['definition']['outputs'][0]['value'] = '=outputs.missing';
        $this->postJson($this->url('draft'), $this->payload())->assertUnprocessable();
        $this->assertSame($before, $this->estimate->backups()->sole()->definition);
        $this->assertSame(432.36, $this->estimate->fresh()->quantity);
    }

    public function test_referenced_detail_cannot_be_removed_and_row_uuid_survives_save(): void
    {
        $this->apply();
        $uuid = $this->estimate->labors()->sole()->row_uuid;
        $data = $this->estimate->fresh(['labors', 'equipment', 'items'])->toArray();
        $this->putJson("/admin/dupas/{$this->dupa->id}/estimates/ADD", $data)->assertOk()
            ->assertJsonPath('estimate.labors.0.row_uuid', $uuid);
        $this->assertSame($uuid, $this->estimate->labors()->sole()->row_uuid);
        $data = $this->estimate->fresh(['labors', 'equipment', 'items'])->toArray();
        $data['labors'] = [];
        $this->putJson("/admin/dupas/{$this->dupa->id}/estimates/ADD", $data)->assertUnprocessable();
        $this->assertSame($uuid, $this->estimate->labors()->sole()->row_uuid);
    }

    public function test_duplicate_and_copy_sides_remap_owners_and_bindings(): void
    {
        $this->apply();
        $old = $this->estimate->labors()->sole()->row_uuid;
        $copy = $this->service->duplicate($this->dupa);
        $copied = $copy->estimates()->where('estimate_type', 'ADD')->sole();
        $this->assertNotSame($old, $copied->labors()->sole()->row_uuid);
        $this->assertSame($copied->labors()->sole()->row_uuid, $copied->backups()->sole()->owner_uuid);
        $this->assertSame($copied->labors()->sole()->row_uuid, $copied->backup_bindings[1]['row_uuid']);
        $this->assertSame($copied->labors()->sole()->row_uuid, $copied->backup_applied['document']['bindings'][1]['row_uuid']);
        $this->service->save($copy, 'ADD', $copied->load(['labors', 'equipment', 'items'])->toArray());
        $nonAdd = $this->dupa->estimates()->where('estimate_type', 'NON_ADD')->sole();
        $this->postJson("/admin/dupas/{$this->dupa->id}/copy-add", ['add_revision' => $this->estimate->fresh()->backup_revision, 'non_add_revision' => $nonAdd->backup_revision])->assertRedirect();
        $nonAdd->refresh();
        $this->assertNotSame($old, $nonAdd->labors()->sole()->row_uuid);
        $this->assertSame($nonAdd->labors()->sole()->row_uuid, $nonAdd->backups()->sole()->owner_uuid);
        $this->assertSame(432.36, $nonAdd->quantity);
    }

    public function test_material_quantity_and_repeated_catalog_rows_bind_to_specific_detail_uuids(): void
    {
        $item = Item::create(['itemcode' => 'BORROW', 'description' => 'Common Borrow', 'unit' => 'm³', 'category_id' => 1]);
        $data = $this->estimate->load(['labors', 'equipment', 'items'])->toArray();
        $uuid = (string) Str::uuid();
        $second = (string) Str::uuid();
        $data['items'] = [
            ['item_id' => $item->id, 'designation' => $item->description, 'unit' => 'm³', 'qty' => 1, 'unit_cost' => 10, 'row_uuid' => $uuid, 'is_included' => true],
            ['item_id' => $item->id, 'designation' => $item->description, 'unit' => 'm³', 'qty' => 7, 'unit_cost' => 10, 'row_uuid' => $second, 'is_included' => true],
        ];
        $this->service->save($this->dupa, 'ADD', $data);
        $this->document['bindings'][] = ['kind' => 'items', 'row_uuid' => $uuid, 'field' => 'qty', 'formula' => '=ROUND(excavation.outputs.total_volume*1.2,2)'];
        $this->apply();
        $this->assertSame(518.83, $this->estimate->items()->where('row_uuid', $uuid)->sole()->qty);
        $this->assertSame(7.0, $this->estimate->items()->where('row_uuid', $second)->sole()->qty);
    }

    public function test_templates_are_immutable_named_snapshots_with_a_creator(): void
    {
        $payload = $this->payload() + ['template_name' => 'My excavation', 'template_key' => 'excavation'];
        $this->postJson($this->url('template'), $payload)->assertOk()->assertJsonPath('template.creator.id', auth()->id());
        $this->postJson($this->url('template'), $payload)->assertUnprocessable()->assertJsonValidationErrors('template_name');
        $this->document['backups'][0]['definition']['inputs'][0]['value'] = 8;
        $this->postJson($this->url('template'), $this->payload() + ['template_name' => 'Another excavation', 'template_key' => 'excavation'])->assertOk();
        $this->assertDatabaseCount('dupa_backup_templates', 2);
        $this->assertSame(10, DupaBackupTemplate::first()->definition['table']['inputs'][0]['value']);
    }

    public function test_exclusions_filter_only_the_current_users_template_choices_and_can_be_undone(): void
    {
        $this->postJson($this->url('template'), $this->payload() + ['template_name' => 'Visible template', 'template_key' => 'excavation'])->assertOk();
        $template = DupaBackupTemplate::sole();
        $url = "/admin/dupas/{$this->dupa->id}/backup-templates/{$template->id}/exclusion";
        $this->postJson($url, ['excluded' => true])->assertOk();
        $this->postJson($url, ['excluded' => true])->assertOk();
        $this->assertDatabaseCount('excluded_templates', 1);
        $this->assertSame(0, DupaBackupTemplate::visibleTo(auth()->id())->count());
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 1)->where('backupTemplates.0.id', 0));
        $firstUser = auth()->user();
        $other = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $this->actingAs($other);
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 2)->where('backupTemplates.1.creator.id', $firstUser->id));
        $this->actingAs($firstUser);
        $this->postJson($url, ['excluded' => false])->assertOk();
        $this->assertDatabaseCount('excluded_templates', 0);
        $this->assertSame(1, DupaBackupTemplate::visibleTo($firstUser->id)->count());
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        $this->postJson($url, ['excluded' => true])->assertForbidden();
        $this->assertDatabaseCount('excluded_templates', 0);
    }

    public function test_unauthorized_user_and_other_side_binding_are_rejected(): void
    {
        $this->postJson($this->url('preview', 'NON_ADD'), ['revision' => 0, 'document' => $this->document])->assertUnprocessable();
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        foreach (['preview', 'draft', 'apply', 'template'] as $action) {
            $this->postJson($this->url($action), $this->payload())->assertForbidden();
        }
    }

    public function test_apply_rolls_back_when_estimate_save_fails(): void
    {
        $token = $this->postJson($this->url('preview'), $this->payload())->assertOk()->json('preview_token');
        $this->mock(DupaEstimateService::class)->shouldReceive('save')->once()->andThrow(new \RuntimeException('Simulated save failure'));
        $this->withoutExceptionHandling();
        try {
            $this->postJson($this->url('apply'), $this->payload() + ['preview_token' => $token]);
            $this->fail('Expected save failure.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Simulated save failure', $e->getMessage());
        }
        $this->assertDatabaseCount('dupa_detail_backups', 0);
        $this->assertNull($this->estimate->fresh()->backup_applied);
        $this->assertSame(1.0, $this->estimate->fresh()->quantity);
    }

    public function test_used_backup_deletion_is_blocked_until_links_are_switched_and_applied(): void
    {
        $this->apply();
        $original = $this->document;
        $this->document = ['backups' => [], 'bindings' => []];
        $this->postJson($this->url('draft'), $this->payload())->assertUnprocessable()->assertJsonValidationErrors('backup');
        $this->assertDatabaseCount('dupa_detail_backups', 1);
        $this->document = $original;
        $second = $original['backups'][0];
        $second['key'] = 'replacement';
        $second['name'] = 'Replacement backup';
        $second['owner_type'] = 'estimate';
        $second['owner_uuid'] = (string) Str::uuid();
        $this->document['backups'][] = $second;
        foreach ($this->document['bindings'] as &$binding) {
            $binding['formula'] = str_replace('excavation.outputs.', 'replacement.outputs.', $binding['formula']);
        }
        unset($binding);
        $this->apply();
        $this->document['backups'] = [$second];
        $this->postJson($this->url('draft'), $this->payload())->assertOk();
        $this->assertSame('replacement', $this->estimate->backups()->sole()->key);
        $this->assertSame(432.36, $this->estimate->fresh()->quantity);
    }

    public function test_item_backup_can_be_created_without_resource_rows(): void
    {
        $this->estimate->labors()->delete();
        $this->estimate->equipment()->delete();
        $this->document['backups'][0]['owner_type'] = 'estimate';
        $this->document['backups'][0]['owner_uuid'] = (string) Str::uuid();
        $this->document['bindings'] = [$this->document['bindings'][0]];
        $this->apply();
        $this->assertSame(432.36, $this->estimate->fresh()->quantity);
    }

    public function test_template_page_can_reactivate_a_template_without_changing_another_users_exclusions(): void
    {
        $this->postJson($this->url('template'), $this->payload() + ['template_name' => 'Manageable template', 'template_key' => 'excavation'])->assertOk();
        $template = DupaBackupTemplate::sole();
        $original = $template->getAttributes();
        $other = User::factory()->create(['is_super_admin' => true, 'is_active' => true]);
        $template->setExcludedFor(auth()->id(), true);
        $template->setExcludedFor($other->id, true);
        $this->get('/admin/backup-templates?status=hidden&search=Manageable')->assertOk()->assertInertia(fn (Assert $page) => $page->component('admin/backup-templates/index')->has('templates.data', 1)->where('templates.data.0.is_excluded', true)->missing('templates.data.0.definition'));
        $this->from('/admin/backup-templates?status=hidden')->post("/admin/backup-templates/{$template->id}/visibility", ['excluded' => false])->assertRedirect('/admin/backup-templates?status=hidden');
        $this->assertDatabaseMissing('excluded_templates', ['user_id' => auth()->id(), 'template_id' => $template->id]);
        $this->assertDatabaseHas('excluded_templates', ['user_id' => $other->id, 'template_id' => $template->id]);
        $this->assertSame($original, $template->fresh()->getAttributes());
        $this->get('/admin/backup-templates?status=hidden')->assertOk()->assertInertia(fn (Assert $page) => $page->has('templates.data', 0));
        $this->get('/admin/backup-templates?status=active')->assertOk()->assertInertia(fn (Assert $page) => $page->has('templates.data', 1)->where('templates.data.0.is_excluded', false));
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 2));
        $this->actingAs(User::factory()->create(['is_super_admin' => false, 'is_active' => true]));
        $this->get('/admin/backup-templates')->assertForbidden();
        $this->post("/admin/backup-templates/{$template->id}/visibility", ['excluded' => false])->assertForbidden();
    }

    public function test_templates_are_shared_across_projects_with_per_user_visibility(): void
    {
        $this->postJson($this->url('template'), $this->payload() + ['template_name' => 'Owned template', 'template_key' => 'excavation'])->assertOk();
        $template = DupaBackupTemplate::sole();
        $editor = User::factory()->create(['is_super_admin' => false, 'is_active' => true]);
        $permission = Permission::firstOrCreate(['slug' => 'projects.update'], ['name' => 'Update projects', 'group' => 'Projects']);
        $role = Role::create(['slug' => 'template-editor', 'name' => 'Template editor']);
        $role->permissions()->attach($permission);
        $editor->roles()->attach($role);
        $this->dupa->section->project->update(['created_by' => $editor->id]);
        $otherProject = Project::create(['project_name' => 'Other project', 'location' => 'Other', 'contract_duration' => 1]);
        $foreign = DupaBackupTemplate::create(['project_id' => $otherProject->id, 'name' => 'Other template', 'version' => 1, 'definition' => $template->definition]);
        $this->actingAs($editor)->get('/admin/backup-templates')->assertOk()->assertInertia(fn (Assert $page) => $page->has('templates.data', 2));
        $this->get('/admin/backup-templates?search=Other')->assertOk()->assertInertia(fn (Assert $page) => $page->has('templates.data', 1)->where('templates.data.0.id', $foreign->id));
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 3));
        $original = $foreign->fresh()->toArray();
        $this->postJson("/admin/dupas/{$this->dupa->id}/backup-templates/{$foreign->id}/exclusion", ['excluded' => true])->assertOk();
        $this->assertDatabaseHas('excluded_templates', ['template_id' => $foreign->id, 'user_id' => $editor->id]);
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 2));
        $this->post("/admin/backup-templates/{$foreign->id}/visibility", ['excluded' => false])->assertRedirect();
        $this->get("/admin/dupas/{$this->dupa->id}/edit")->assertOk()->assertInertia(fn (Assert $page) => $page->has('backupTemplates', 3));
        $this->assertSame($original, $foreign->fresh()->toArray());
        $this->post("/admin/backup-templates/{$template->id}/visibility", ['excluded' => true])->assertRedirect();
        $this->assertDatabaseHas('excluded_templates', ['template_id' => $template->id, 'user_id' => $editor->id]);
    }

    public function test_json_estimate_save_returns_persisted_rows_ready_for_result_linking(): void
    {
        $estimate = $this->estimate->fresh(['labors', 'equipment', 'items'])->toArray();
        $newRow = $estimate['labors'][0];
        $newRow['row_uuid'] = (string) Str::uuid();
        $newRow['no_of_person'] = 5;
        $estimate['labors'][] = $newRow;
        $response = $this->putJson("/admin/dupas/{$this->dupa->id}/estimates/ADD", $estimate)
            ->assertOk()->assertJsonCount(2, 'estimate.labors')->assertJsonPath('estimate.estimate_type', 'ADD');
        $saved = $response->json('estimate');
        $this->assertContains($newRow['row_uuid'], array_column($saved['labors'], 'row_uuid'));
        $this->assertCount(0, $saved['backups']);
        $this->document['bindings'][] = ['kind' => 'labors', 'row_uuid' => $newRow['row_uuid'], 'field' => 'no_of_days', 'formula' => '=excavation.outputs.labor_days'];
        $payload = $this->payload();
        $payload['revision'] = $saved['backup_revision'];
        $token = $this->postJson($this->url('preview'), $payload)->assertOk()->json('preview_token');
        $this->postJson($this->url('apply'), $payload + ['preview_token' => $token])->assertOk();
        $this->assertSame(11.0, $this->estimate->fresh()->labors()->where('row_uuid', $newRow['row_uuid'])->firstOrFail()->no_of_days);
    }
}
