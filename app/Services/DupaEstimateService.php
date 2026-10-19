<?php

namespace App\Services;

use App\Models\DupaEstimate;
use App\Models\EquipmentDupa;
use App\Models\LaborDupa;
use App\Models\MaterialDupa;
use App\Models\Project;
use App\Models\ProjectEstimateSetting;
use App\Models\ProjectItem;
use App\Services\Backup\Calculator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DupaEstimateService
{
    public function __construct(private readonly ProjectMarkupRateService $markupRates) {}

    public function initialize(ProjectItem $dupa): void
    {
        $rates = $this->markupRates->forProject($dupa->section->project);
        foreach (['ADD', 'NON_ADD'] as $type) {
            DupaEstimate::query()->firstOrCreate(
                ['dupa_id' => $dupa->id, 'estimate_type' => $type],
                [
                    'calculation_mode' => 'resources',
                    'quantity' => $type === 'ADD' ? $dupa->qty : 0,
                    'ocm_percentage' => $rates['ocm_percentage'] ?? 12,
                    'profit_percentage' => $rates['profit_percentage'] ?? 8,
                    'vat_percentage' => $rates['vat_percentage'] ?? 5,
                ],
            );
        }
    }

    /** @param array<string, mixed> $data */
    public function save(ProjectItem $dupa, string $type, array $data): DupaEstimate
    {
        return DB::transaction(function () use ($dupa, $type, $data): DupaEstimate {
            $estimate = DupaEstimate::query()->firstOrCreate(
                ['dupa_id' => $dupa->id, 'estimate_type' => $type],
                ['calculation_mode' => 'resources'],
            );

            $estimate = DupaEstimate::query()->whereKey($estimate->id)->lockForUpdate()->firstOrFail();
            foreach (['labors', 'equipment', 'items'] as $kind) {
                foreach ($data[$kind] ?? [] as $index => $row) {
                    $data[$kind][$index]['row_uuid'] = $row['row_uuid'] ?? (string) Str::uuid();
                }
            }
            if ($estimate->backup_applied) {
                try {
                    $data = (new Calculator)->preview($estimate->backup_applied['document'], $data)['estimate'];
                } catch (\InvalidArgumentException $exception) {
                    throw ValidationException::withMessages(['backup' => $exception->getMessage()]);
                }
            }
            $estimate->labors()->delete();
            $estimate->equipment()->delete();
            $estimate->items()->delete();

            $laborCost = 0.0;
            foreach ($data['labors'] ?? [] as $index => $row) {
                $included = (bool) ($row['is_included'] ?? true);
                $amount = (float) $row['no_of_person'] * (float) $row['no_of_days'] * (float) $row['rate'];
                if ($included) {
                    $laborCost += $amount;
                }
                LaborDupa::query()->create([
                    'dupa_id' => $dupa->id,
                    'estimate_id' => $estimate->id,
                    'labor_id' => $row['labor_id'],
                    'designation' => $row['designation'],
                    'no_of_person' => $row['no_of_person'],
                    'no_of_days' => $row['no_of_days'],
                    'rate' => $row['rate'],
                    'is_included' => $included,
                    'sort_order' => $index,
                    'row_uuid' => $row['row_uuid'],
                ]);
            }

            $equipmentCost = 0.0;
            foreach ($data['equipment'] ?? [] as $index => $row) {
                $included = (bool) ($row['is_included'] ?? true);
                $amount = (float) $row['no_of_units'] * (float) $row['no_of_days'] * (float) $row['rental_unit_cost'];
                if ($included) {
                    $equipmentCost += $amount;
                }
                EquipmentDupa::query()->create([
                    'dupa_id' => $dupa->id,
                    'estimate_id' => $estimate->id,
                    'equipment_id' => $row['equipment_id'],
                    'designation' => $row['designation'],
                    'no_of_units' => $row['no_of_units'],
                    'no_of_days' => $row['no_of_days'],
                    'rental_unit_cost' => $row['rental_unit_cost'],
                    'is_included' => $included,
                    'sort_order' => $index,
                    'row_uuid' => $row['row_uuid'],
                ]);
            }

            $materialCost = 0.0;
            foreach ($data['items'] ?? [] as $index => $row) {
                $included = (bool) ($row['is_included'] ?? true);
                $amount = (float) $row['qty'] * (float) $row['unit_cost'];
                if ($included) {
                    $materialCost += $amount;
                }
                MaterialDupa::query()->create([
                    'dupa_id' => $dupa->id,
                    'estimate_id' => $estimate->id,
                    'item_id' => $row['item_id'],
                    'designation' => $row['designation'],
                    'unit' => $row['unit'],
                    'group' => filled($row['group'] ?? null) ? $row['group'] : null,
                    'qty' => $row['qty'],
                    'unit_cost' => $row['unit_cost'],
                    'is_included' => $included,
                    'sort_order' => $index,
                    'row_uuid' => $row['row_uuid'],
                ]);
            }

            $direct = round($laborCost + $equipmentCost + $materialCost, 2);
            $quantity = (float) $data['quantity'];
            if ($direct > 0 && $quantity <= 0) {
                throw ValidationException::withMessages(['quantity' => 'Quantity must be greater than zero when the estimate has a direct cost.']);
            }

            $ocm = round($direct * ((float) $data['ocm_percentage'] / 100), 2);
            $profit = round($direct * ((float) $data['profit_percentage'] / 100), 2);
            $vat = round(($direct + $ocm + $profit) * ((float) $data['vat_percentage'] / 100), 2);
            $indirect = round($ocm + $profit + $vat, 2);
            $total = round($direct + $indirect, 2);

            $estimate->update([
                'calculation_mode' => 'resources',
                'backup_revision' => $estimate->backup_revision + 1,
                'quantity' => $quantity,
                'ocm_percentage' => $data['ocm_percentage'],
                'profit_percentage' => $data['profit_percentage'],
                'vat_percentage' => $data['vat_percentage'],
                'labor_cost' => round($laborCost, 2),
                'equipment_cost' => round($equipmentCost, 2),
                'material_cost' => round($materialCost, 2),
                'direct_cost' => $direct,
                'ocm_amount' => $ocm,
                'profit_amount' => $profit,
                'vat_amount' => $vat,
                'indirect_cost' => $indirect,
                'total_cost' => $total,
                'unit_cost' => $quantity > 0 ? round($total / $quantity, 2) : 0,
            ]);

            $this->syncLegacyTotals($dupa);
            $project = $dupa->section()->firstOrFail()->project()->firstOrFail();
            $project->update(['estimates_updated_at' => now()]);

            return $estimate->fresh(['labors', 'equipment', 'items']);
        });
    }

    public function refreshProjectMarkup(Project $project): void
    {
        $rates = $this->markupRates->forProject($project);
        if ($rates === null) {
            return;
        }

        $estimates = DupaEstimate::query()
            ->whereHas('dupa.section', fn ($query) => $query->where('project_id', $project->id))
            ->with('dupa')
            ->get();

        foreach ($estimates as $estimate) {
            $direct = (float) $estimate->direct_cost;
            $ocm = round($direct * $rates['ocm_percentage'] / 100, 2);
            $profit = round($direct * $rates['profit_percentage'] / 100, 2);
            $vat = round(($direct + $ocm + $profit) * $rates['vat_percentage'] / 100, 2);
            $indirect = round($ocm + $profit + $vat, 2);
            $total = round($direct + $indirect, 2);
            $quantity = (float) $estimate->quantity;

            $estimate->update($rates + [
                'ocm_amount' => $ocm,
                'profit_amount' => $profit,
                'vat_amount' => $vat,
                'indirect_cost' => $indirect,
                'total_cost' => $total,
                'unit_cost' => $quantity > 0 ? round($total / $quantity, 2) : 0,
                'backup_revision' => $estimate->backup_revision + 1,
            ]);
            $this->syncLegacyTotals($estimate->dupa);
        }
    }

    public function duplicate(ProjectItem $source): ProjectItem
    {
        return DB::transaction(function () use ($source): ProjectItem {
            $source->loadMissing([
                'section.project',
                'estimates.labors',
                'estimates.equipment',
                'estimates.items',
                'estimates.backups',
            ]);
            Project::query()->whereKey($source->section->project_id)->lockForUpdate()->firstOrFail();

            $copy = ProjectItem::query()->create([
                'section_id' => $source->section_id,
                'sub_section_id' => $source->sub_section_id,
                'pay_item_no' => $this->nextCopyPayItemNumber($source),
                'description' => $source->description,
                'unit' => $source->unit,
                'sort_order' => (int) $source->section->projectItems()->max('sort_order') + 1,
                'qty' => 0,
                'estimated_direct_cost' => 0,
                'ocm' => 0,
                'profit' => 0,
                'total_markup_percentage' => 0,
                'total_markup_value' => 0,
                'vat_five_percent' => 0,
                'total_indirect_cost' => 0,
                'total_cost' => 0,
                'unit_cost_adjusted' => 0,
            ]);
            $this->initialize($copy);

            foreach ($source->estimates as $sourceEstimate) {
                $estimate = DupaEstimate::query()->updateOrCreate(
                    [
                        'dupa_id' => $copy->id,
                        'estimate_type' => $sourceEstimate->estimate_type,
                    ],
                    Arr::except($sourceEstimate->getAttributes(), [
                        'id', 'dupa_id', 'estimate_type', 'created_at', 'updated_at',
                        'backup_applied', 'backup_bindings', 'backup_revision',
                    ]),
                );

                $uuidMap = [];
                foreach (['labors', 'equipment', 'items'] as $kind) {
                    foreach ($sourceEstimate->$kind as $row) {
                        if ($row->row_uuid) {
                            $uuidMap[$row->row_uuid] = (string) Str::uuid();
                        }
                    }
                }
                foreach ($sourceEstimate->labors as $row) {
                    LaborDupa::query()->create([
                        ...Arr::except($row->getAttributes(), ['id', 'dupa_id', 'estimate_id']),
                        'dupa_id' => $copy->id,
                        'estimate_id' => $estimate->id,
                        'row_uuid' => $uuidMap[$row->row_uuid] ?? (string) Str::uuid(),
                    ]);
                }
                foreach ($sourceEstimate->equipment as $row) {
                    EquipmentDupa::query()->create([
                        ...Arr::except($row->getAttributes(), ['id', 'dupa_id', 'estimate_id']),
                        'dupa_id' => $copy->id,
                        'estimate_id' => $estimate->id,
                        'row_uuid' => $uuidMap[$row->row_uuid] ?? (string) Str::uuid(),
                    ]);
                }
                foreach ($sourceEstimate->items as $row) {
                    MaterialDupa::query()->create([
                        ...Arr::except($row->getAttributes(), ['id', 'dupa_id', 'estimate_id']),
                        'dupa_id' => $copy->id,
                        'estimate_id' => $estimate->id,
                        'row_uuid' => $uuidMap[$row->row_uuid] ?? (string) Str::uuid(),
                    ]);
                }
                $remap = fn ($value) => json_decode(strtr(json_encode($value, JSON_THROW_ON_ERROR), $uuidMap), true, 512, JSON_THROW_ON_ERROR);
                foreach ($sourceEstimate->backups as $backup) {
                    $estimate->backups()->create([
                        ...$remap($backup->only(['key', 'owner_type', 'owner_uuid', 'name', 'schema_version', 'definition'])),
                    ]);
                }
                $estimate->update([
                    'backup_bindings' => $remap($sourceEstimate->backup_bindings),
                    'backup_applied' => $remap($sourceEstimate->backup_applied),
                    'backup_revision' => 0,
                ]);
            }

            $copy->updateQuietly($source->only([
                'qty', 'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
                'total_markup_value', 'vat_five_percent', 'total_indirect_cost',
                'total_cost', 'unit_cost_adjusted',
            ]));
            $source->section->project->update(['estimates_updated_at' => now()]);

            return $copy;
        });
    }

    public function copyAddToNonAdd(ProjectItem $dupa, int $addRevision, int $nonAddRevision): void
    {
        DB::transaction(function () use ($dupa, $addRevision, $nonAddRevision): void {
            $estimates = $dupa->estimates()->orderBy('id')->lockForUpdate()->get()->keyBy('estimate_type');
            $source = $estimates['ADD']->load(['labors', 'equipment', 'items', 'backups']);
            $target = $estimates['NON_ADD'];
            if ($source->backup_revision !== $addRevision || $target->backup_revision !== $nonAddRevision) {
                throw ValidationException::withMessages(['backup' => 'The estimate changed. Reload before copying.']);
            }
            $data = $source->toArray();
            $map = [];
            foreach (['labors', 'equipment', 'items'] as $kind) {
                foreach ($data[$kind] ?? [] as $index => $row) {
                    $uuid = (string) Str::uuid();
                    if ($row['row_uuid']) {
                        $map[$row['row_uuid']] = $uuid;
                    }
                    $data[$kind][$index]['row_uuid'] = $uuid;
                }
            }
            $remap = fn ($value) => json_decode(strtr(json_encode($value, JSON_THROW_ON_ERROR), $map), true, 512, JSON_THROW_ON_ERROR);
            $target->backups()->delete();
            $target->update([
                'backup_applied' => $remap($source->backup_applied),
                'backup_bindings' => $remap($source->backup_bindings),
            ]);
            $this->save($dupa, 'NON_ADD', $data);
            foreach ($source->backups as $backup) {
                $target->backups()->create($remap($backup->only(['key', 'owner_type', 'owner_uuid', 'name', 'schema_version', 'definition'])));
            }
        });
    }

    public function ensureProjectSettings(Project $project): void
    {
        foreach (['ADD', 'NON_ADD'] as $type) {
            ProjectEstimateSetting::query()->firstOrCreate([
                'project_id' => $project->id,
                'estimate_type' => $type,
            ]);
        }
    }

    /** @return array<string, array<string, float>> */
    public function projectTotals(Project $project): array
    {
        $this->ensureProjectSettings($project);
        // POL is a single project charge; carry it once in the combined totals.
        $projectPol = (float) ($project->pol ?? $project->estimateSettings()->where('estimate_type', 'ADD')->value('pol_amount'));
        $result = [];
        foreach (['ADD', 'NON_ADD'] as $type) {
            $settings = $project->estimateSettings()->where('estimate_type', $type)->firstOrFail();
            $query = DupaEstimate::query()->where('estimate_type', $type)
                ->whereHas('dupa.section', fn ($query) => $query->where('project_id', $project->id));
            $components = (clone $query)->selectRaw('COALESCE(SUM(labor_cost), 0) as labor_cost, COALESCE(SUM(material_cost), 0) as material_cost, COALESCE(SUM(equipment_cost), 0) as equipment_cost, COALESCE(SUM(ocm_amount), 0) as ocm_amount, COALESCE(SUM(profit_amount), 0) as profit_amount, COALESCE(SUM(vat_amount), 0) as vat_amount')->first()->only([
                'labor_cost', 'material_cost', 'equipment_cost', 'ocm_amount', 'profit_amount', 'vat_amount',
            ]);
            $direct = round((float) (clone $query)->sum('direct_cost'), 2);
            $dupaTotal = round((float) (clone $query)->sum('total_cost'), 2);
            $miscellaneous = round((float) $project->miscellaneous()->where('estimate_type', $type)
                ->selectRaw('COALESCE(SUM(amount * multiplier), 0) as aggregate')->value('aggregate'), 2);
            $preEngineering = round($direct * ($settings->pre_engineering_percentage / 100), 2);
            $supervision = round($direct * ($settings->supervision_percentage / 100), 2);
            $pol = $type === 'ADD' ? $projectPol : 0.0;
            $charges = round($pol + $settings->contingencies_amount + $preEngineering + $supervision + $miscellaneous, 2);
            $result[$type] = [
                ...array_map(fn ($amount): float => round((float) $amount, 2), $components),
                'indirect_cost' => round($dupaTotal - $direct + $charges - $pol, 2),
                'direct_cost' => $direct,
                'dupa_total' => $dupaTotal,
                'pol_amount' => $pol,
                'pre_engineering_amount' => $preEngineering,
                'supervision_amount' => $supervision,
                'contingencies_amount' => (float) $settings->contingencies_amount,
                'miscellaneous_amount' => $miscellaneous,
                'charges_total' => $charges,
                'grand_total' => round($dupaTotal + $charges, 2),
            ];
        }

        return $result;
    }

    private function syncLegacyTotals(ProjectItem $dupa): void
    {
        $estimates = $dupa->estimates()->get();
        $direct = (float) $estimates->sum('direct_cost');
        $ocm = (float) $estimates->sum('ocm_amount');
        $profit = (float) $estimates->sum('profit_amount');
        $vat = (float) $estimates->sum('vat_amount');
        $indirect = (float) $estimates->sum('indirect_cost');
        $total = (float) $estimates->sum('total_cost');
        $quantity = (float) ($estimates->firstWhere('estimate_type', 'ADD')?->quantity
            ?: $estimates->firstWhere('estimate_type', 'NON_ADD')?->quantity ?: 0);

        $dupa->updateQuietly([
            'qty' => $quantity,
            'estimated_direct_cost' => $direct,
            'ocm' => $ocm,
            'profit' => $profit,
            'total_markup_percentage' => $direct > 0 ? (($ocm + $profit) / $direct) : 0,
            'total_markup_value' => $ocm + $profit,
            'vat_five_percent' => $vat,
            'total_indirect_cost' => $indirect,
            'total_cost' => $total,
            'unit_cost_adjusted' => $quantity > 0 ? round($total / $quantity, 2) : 0,
        ]);
    }

    private function nextCopyPayItemNumber(ProjectItem $source): string
    {
        $base = preg_replace('/ \(Copy(?: \d+)?\)$/', '', $source->pay_item_no) ?: $source->pay_item_no;
        $used = ProjectItem::query()
            ->whereHas('section', fn ($query) => $query->where('project_id', $source->section->project_id))
            ->pluck('pay_item_no')
            ->all();

        for ($number = 1; $number < 10000; $number++) {
            $suffix = $number === 1 ? ' (Copy)' : " (Copy {$number})";
            $candidate = mb_substr($base, 0, 45 - mb_strlen($suffix)).$suffix;
            if (! in_array($candidate, $used, true)) {
                return $candidate;
            }
        }

        throw ValidationException::withMessages([
            'pay_item_no' => 'A unique pay item number could not be generated for the copy.',
        ]);
    }
}
