<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectMarkupRateService
{
    /** @return Collection<int, array{id: int, minimum_amount: float, maximum_amount: float|null, ocm_percentage: float, profit_percentage: float, vat_percentage: float}> */
    public function bands(): Collection
    {
        return DB::table('project_markup_rates')->orderBy('minimum_amount')->get()->map(fn (object $rate): array => [
            'id' => (int) $rate->id,
            'minimum_amount' => (float) $rate->minimum_amount,
            'maximum_amount' => $rate->maximum_amount === null ? null : (float) $rate->maximum_amount,
            'ocm_percentage' => (float) $rate->ocm_percentage,
            'profit_percentage' => (float) $rate->profit_percentage,
            'vat_percentage' => (float) $rate->vat_percentage,
        ]);
    }

    /** @return array{ocm_percentage: float, profit_percentage: float, vat_percentage: float}|null */
    public function forProject(Project $project): ?array
    {
        if ($project->allocated_amount === null) {
            return null;
        }

        $rate = DB::table('project_markup_rates')
            ->where('minimum_amount', '<=', $project->allocated_amount)
            ->where(fn ($query) => $query->whereNull('maximum_amount')->orWhere('maximum_amount', '>=', $project->allocated_amount))
            ->first();

        if ($rate === null) {
            throw new \LogicException('No markup rate applies to the project allocated amount.');
        }

        return [
            'ocm_percentage' => (float) $rate->ocm_percentage,
            'profit_percentage' => (float) $rate->profit_percentage,
            'vat_percentage' => (float) $rate->vat_percentage,
        ];
    }
}
