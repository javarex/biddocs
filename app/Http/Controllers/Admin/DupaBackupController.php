<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DupaBackupTemplate;
use App\Models\ProjectItem;
use App\Services\Backup\Calculator;
use App\Services\Backup\Usage;
use App\Services\DupaEstimateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DupaBackupController extends Controller
{
    public function excludeTemplate(Request $request, ProjectItem $dupa, DupaBackupTemplate $template): JsonResponse
    {
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate(['excluded' => ['required', 'boolean']]);
        $template->setExcludedFor($request->user()->id, $data['excluded']);

        return response()->json(['excluded' => $data['excluded']]);
    }

    public function handle(Request $request, ProjectItem $dupa, string $type, string $action, Calculator $calculator, DupaEstimateService $service): JsonResponse
    {
        abort_unless(in_array($type, ['ADD', 'NON_ADD'], true) && in_array($action, ['draft', 'preview', 'apply', 'template'], true), 404);
        Gate::authorize('update', $dupa->section->project);
        $data = $request->validate([
            'revision' => ['required', 'integer', 'min:0'],
            'document' => ['required', 'array:backups,bindings'],
            'document.backups' => ['present', 'array', 'max:50'],
            'document.backups.*' => ['array:key,owner_type,owner_uuid,name,schema_version,definition'],
            'document.backups.*.key' => ['required', 'string', 'max:80', 'distinct', 'regex:/^[a-zA-Z_][a-zA-Z_0-9]*$/D'],
            'document.backups.*.owner_type' => ['required', Rule::in(['estimate', 'labors', 'equipment', 'items'])],
            'document.backups.*.owner_uuid' => ['required', 'uuid'],
            'document.backups.*.name' => ['required', 'string', 'max:255'],
            'document.backups.*.schema_version' => ['required', 'integer', Rule::in([1])],
            'document.backups.*.definition' => ['required', 'array:columns,rows,inputs,outputs'],
            'document.backups.*.definition.columns' => ['present', 'array', 'max:30'],
            'document.backups.*.definition.columns.*' => ['array:key,label,unit'],
            'document.backups.*.definition.columns.*.key' => ['required', 'string', 'max:80'],
            'document.backups.*.definition.columns.*.label' => ['required', 'string', 'max:255'],
            'document.backups.*.definition.rows' => ['present', 'array', 'max:200'],
            'document.backups.*.definition.rows.*' => ['array:key,label,cells'],
            'document.backups.*.definition.rows.*.key' => ['required', 'string', 'max:80'],
            'document.backups.*.definition.rows.*.label' => ['required', 'string', 'max:255'],
            'document.backups.*.definition.rows.*.cells' => ['present', 'array', 'max:30'],
            'document.backups.*.definition.inputs' => ['present', 'array', 'max:100'],
            'document.backups.*.definition.outputs' => ['present', 'array', 'max:100'],
            'document.bindings' => ['present', 'array', 'max:500'],
            'document.bindings.*' => ['array:kind,row_uuid,field,formula'],
            'document.bindings.*.kind' => ['required', Rule::in(['estimate', 'labors', 'equipment', 'items'])],
            'document.bindings.*.row_uuid' => ['nullable', 'uuid'],
            'document.bindings.*.field' => ['required', 'string', 'max:40'],
            'document.bindings.*.formula' => ['required', 'string', 'max:2000'],
            'preview_token' => ['nullable', 'string', 'max:64'],
            'template_name' => ['nullable', 'string', 'max:255'],
            'template_key' => ['nullable', 'string', 'max:80'],
        ]);

        foreach (['inputs', 'outputs'] as $group) {
            $request->validate([
                "document.backups.*.definition.{$group}.*" => ['array:key,label,unit,value'],
                "document.backups.*.definition.{$group}.*.key" => ['required', 'string', 'max:80'],
                "document.backups.*.definition.{$group}.*.label" => ['required', 'string', 'max:255'],
                "document.backups.*.definition.{$group}.*.unit" => ['nullable', 'string', 'max:40'],
                "document.backups.*.definition.{$group}.*.value" => ['required', function ($attribute, $value, $fail): void {
                    if ((! is_string($value) && ! is_numeric($value)) || strlen((string) $value) > 2000) {
                        $fail('Enter a number or formula up to 2000 characters.');
                    }
                }],
            ]);
        }

        return DB::transaction(function () use ($request, $dupa, $type, $action, $data, $calculator, $service): JsonResponse {
            // Serialize backup operations and ordinary estimate saves using the same row lock.
            $estimate = $dupa->estimates()->where('estimate_type', $type)->lockForUpdate()->firstOrFail();
            if ($estimate->backup_revision !== $data['revision']) {
                throw ValidationException::withMessages(['backup' => 'This estimate changed. Reload before saving or previewing.']);
            }
            $estimate->load(['labors', 'equipment', 'items']);
            $document = $data['document'];
            // Draft deletion cannot discard a backup still driving the applied estimate.
            $protected = $action === 'apply' ? $document : ($estimate->backup_applied['document'] ?? []);
            $required = Usage::referencedKeys($protected);
            $remaining = array_column($document['backups'], 'key');
            foreach ($estimate->backups as $existing) {
                if (! in_array($existing->key, $remaining, true) && in_array($existing->key, $required, true)) {
                    throw ValidationException::withMessages(['backup' => "{$existing->name} is in use. Switch its linked fields and apply the changes before deleting this backup."]);
                }
            }

            try {
                $result = $calculator->preview($document, $estimate->toArray());
            } catch (\InvalidArgumentException $exception) {
                throw ValidationException::withMessages(['backup' => $exception->getMessage()]);
            }
            $token = hash_hmac('sha256', json_encode([$estimate->backup_revision, $document, $result], JSON_THROW_ON_ERROR), config('app.key'));
            if ($action === 'preview') {
                return response()->json($result + ['preview_token' => $token, 'revision' => $estimate->backup_revision]);
            }
            if ($action === 'template') {
                $backup = null;
                foreach ($document['backups'] as $candidate) {
                    if ($candidate['key'] === ($data['template_key'] ?? '')) {
                        $backup = $candidate;
                    }
                }
                if (! $backup || empty($data['template_name'])) {
                    throw ValidationException::withMessages(['backup' => 'Select a backup and enter a template name.']);
                }
                // Only self-contained templates can be reused without broken cross-detail links.
                $definition = json_encode($backup['definition'], JSON_THROW_ON_ERROR);
                preg_match_all('/\b([A-Za-z_][A-Za-z_0-9]*)\.outputs\./', $definition, $refs);
                foreach ($refs[1] as $ref) {
                    if ($ref !== $backup['key']) {
                        throw ValidationException::withMessages(['backup' => 'Templates must be self-contained. Replace references to other backups with inputs first.']);
                    }
                }
                $dupa->section->project()->lockForUpdate()->firstOrFail();
                $name = trim($data['template_name']);
                if ($name === '' || DupaBackupTemplate::query()->where('project_id', $dupa->section->project_id)->where('name', $name)->exists()) {
                    throw ValidationException::withMessages(['template_name' => 'Choose a new template name. Existing templates cannot be updated.']);
                }
                $template = DupaBackupTemplate::query()->create([
                    'project_id' => $dupa->section->project_id,
                    'name' => $name,
                    'version' => 1,
                    'created_by' => $request->user()->id,
                    'definition' => ['source_key' => $backup['key'], 'schema_version' => 1, 'table' => $backup['definition']],
                ]);

                return response()->json(['template' => $template->load('creator:id,name')]);
            }
            if ($action === 'apply' && ! hash_equals($token, $data['preview_token'] ?? '')) {
                throw ValidationException::withMessages(['backup' => 'Preview the current changes before applying.']);
            }
            $estimate->backups()->delete();
            foreach ($document['backups'] as $backup) {
                $estimate->backups()->create($backup);
            }
            $estimate->update(['backup_bindings' => $document['bindings'], 'backup_revision' => $estimate->backup_revision + 1]);
            if ($action === 'apply') {
                $estimate->update(['backup_applied' => ['document' => $document, 'values' => $result['values'], 'applied_at' => now()->toIso8601String()]]);
                $estimate = $service->save($dupa, $type, $result['estimate']);
            }
            $estimate->load(['labors', 'equipment', 'items', 'backups']);

            return response()->json(['estimate' => $estimate]);
        });
    }
}
