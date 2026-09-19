<?php

namespace App\Services;

use App\Models\DupaEstimate;
use App\Models\EquipmentDupa;
use App\Models\LaborDupa;
use App\Models\MaterialDupa;
use App\Models\MaterialItem;
use App\Models\Project;
use App\Models\ProjectEstimateSetting;
use App\Models\ProjectItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DupaEstimateService
{
    public function initialize(ProjectItem $dupa): void
    {
        foreach (['ADD', 'NON_ADD'] as $type) {
            DupaEstimate::query()->firstOrCreate(
                ['dupa_id' => $dupa->id, 'estimate_type' => $type],
                [
                    'calculation_mode' => 'resources',
                    'quantity' => $type === 'ADD' ? $dupa->qty : 0,
                    'ocm_percentage' => 12,
                    'profit_percentage' => 8,
                    'vat_percentage' => 5,
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

            $estimate->labors()->delete();
            $estimate->equipment()->delete();
            $estimate->materials()->each(fn (MaterialDupa $material) => $material->delete());

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
                ]);
            }

            $materialCost = 0.0;
            foreach ($data['materials'] ?? [] as $index => $row) {
                $included = (bool) ($row['is_included'] ?? true);
                $amount = (float) $row['qty'] * (float) $row['multiplier'] * (float) $row['unit_cost'];
                if ($included) {
                    $materialCost += $amount;
                }
                $material = MaterialDupa::query()->create([
                    'dupa_id' => $dupa->id,
                    'estimate_id' => $estimate->id,
                    'material_id' => $row['material_id'],
                    'description' => $row['description'],
                    'unit' => $row['unit'],
                    'qty' => $row['qty'],
                    'unit_cost' => $row['unit_cost'],
                    'multiplier' => $row['multiplier'],
                    'is_included' => $included,
                    'sort_order' => $index,
                ]);
                foreach ($row['breakdowns'] ?? [] as $breakdownIndex => $breakdown) {
                    MaterialItem::query()->create([
                        'material_dupa_id' => $material->id,
                        'designation' => $breakdown['designation'],
                        'unit' => $breakdown['unit'],
                        'qty' => $breakdown['qty'],
                        'unit_cost' => $breakdown['unit_cost'] ?? 0,
                        'sort_order' => $breakdownIndex,
                    ]);
                }
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

            return $estimate->fresh(['labors', 'equipment', 'materials.breakdowns']);
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
        $result = [];
        foreach (['ADD', 'NON_ADD'] as $type) {
            $settings = $project->estimateSettings()->where('estimate_type', $type)->firstOrFail();
            $query = DupaEstimate::query()->where('estimate_type', $type)
                ->whereHas('dupa.section', fn ($query) => $query->where('project_id', $project->id));
            $direct = round((float) (clone $query)->sum('direct_cost'), 2);
            $dupaTotal = round((float) (clone $query)->sum('total_cost'), 2);
            $miscellaneous = round((float) $project->miscellaneous()->where('estimate_type', $type)
                ->selectRaw('COALESCE(SUM(amount * multiplier), 0) as aggregate')->value('aggregate'), 2);
            $preEngineering = round($direct * ($settings->pre_engineering_percentage / 100), 2);
            $supervision = round($direct * ($settings->supervision_percentage / 100), 2);
            $charges = round($settings->pol_amount + $settings->contingencies_amount + $preEngineering + $supervision + $miscellaneous, 2);
            $result[$type] = [
                'direct_cost' => $direct,
                'dupa_total' => $dupaTotal,
                'pol_amount' => (float) $settings->pol_amount,
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
}
