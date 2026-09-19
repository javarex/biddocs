<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $section_id
 * @property int|null $sub_section_id
 * @property string $pay_item_no
 * @property string $description
 * @property string $unit
 * @property float $qty
 * @property float $estimated_direct_cost
 * @property float $ocm
 * @property float $profit
 * @property float $total_markup_percentage
 * @property float $total_markup_value
 * @property float $vat_five_percent
 * @property float $total_indirect_cost
 * @property float $total_cost
 * @property float $unit_cost_adjusted
 */
class ProjectItem extends Model
{
    protected $table = 'dupas';

    public $timestamps = false;

    protected $fillable = [
        'section_id', 'sub_section_id', 'pay_item_no', 'description', 'unit', 'qty',
        'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
        'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost',
        'unit_cost_adjusted', 'sort_order',
    ];

    protected function casts(): array
    {
        return array_fill_keys([
            'qty', 'estimated_direct_cost', 'ocm', 'profit', 'total_markup_percentage',
            'total_markup_value', 'vat_five_percent', 'total_indirect_cost', 'total_cost',
            'unit_cost_adjusted',
        ], 'float');
    }

    protected static function booted(): void
    {
        static::saved(function (ProjectItem $item): void {
            $tracked = [
                'qty', 'estimated_direct_cost', 'ocm', 'profit', 'vat_five_percent',
                'total_indirect_cost', 'total_cost', 'unit_cost_adjusted',
            ];
            if (! $item->wasRecentlyCreated && ! $item->wasChanged($tracked)) {
                return;
            }

            $estimate = DupaEstimate::query()->firstOrNew([
                'dupa_id' => $item->id,
                'estimate_type' => 'ADD',
            ]);
            if ($estimate->exists && $estimate->calculation_mode !== 'imported_summary') {
                return;
            }

            $direct = (float) $item->estimated_direct_cost;
            $base = $direct + (float) $item->ocm + (float) $item->profit;
            $estimate->fill([
                'calculation_mode' => 'imported_summary',
                'quantity' => $item->qty,
                'ocm_percentage' => $direct > 0 ? ((float) $item->ocm / $direct) * 100 : 0,
                'profit_percentage' => $direct > 0 ? ((float) $item->profit / $direct) * 100 : 0,
                'vat_percentage' => $base > 0 ? ((float) $item->vat_five_percent / $base) * 100 : 0,
                'direct_cost' => $direct,
                'ocm_amount' => $item->ocm,
                'profit_amount' => $item->profit,
                'vat_amount' => $item->vat_five_percent,
                'indirect_cost' => $item->total_indirect_cost,
                'total_cost' => $item->total_cost,
                'unit_cost' => $item->unit_cost_adjusted,
            ])->save();
        });
    }

    /** @return BelongsTo<Section, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /** @return BelongsTo<SubSection, $this> */
    public function subSection(): BelongsTo
    {
        return $this->belongsTo(SubSection::class);
    }

    /** @return HasMany<DupaEstimate, $this> */
    public function estimates(): HasMany
    {
        return $this->hasMany(DupaEstimate::class, 'dupa_id');
    }

    /** @return HasMany<LaborDupa, $this> */
    public function laborRows(): HasMany
    {
        return $this->hasMany(LaborDupa::class, 'dupa_id');
    }

    /** @return HasMany<EquipmentDupa, $this> */
    public function equipmentRows(): HasMany
    {
        return $this->hasMany(EquipmentDupa::class, 'dupa_id');
    }

    /** @return HasMany<MaterialDupa, $this> */
    public function materialRows(): HasMany
    {
        return $this->hasMany(MaterialDupa::class, 'dupa_id');
    }

    /** @return BelongsToMany<Labor, $this> */
    public function labors(): BelongsToMany
    {
        return $this->belongsToMany(Labor::class, 'labor_dupa', 'dupa_id', 'labor_id')
            ->withPivot(['id', 'designation', 'no_of_person', 'no_of_days', 'rate']);
    }

    /** @return BelongsToMany<Equipment, $this> */
    public function equipment(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'equipment_dupa', 'dupa_id', 'equipment_id')
            ->withPivot(['id', 'designation', 'no_of_units', 'no_of_days', 'rental_unit_cost']);
    }

    /** @return BelongsToMany<Material, $this> */
    public function materials(): BelongsToMany
    {
        return $this->belongsToMany(Material::class, 'material_dupa', 'dupa_id', 'material_id')
            ->withPivot(['id', 'description']);
    }
}
