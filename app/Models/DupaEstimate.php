<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DupaEstimate extends Model
{
    protected $fillable = [
        'dupa_id', 'estimate_type', 'calculation_mode', 'quantity', 'ocm_percentage',
        'profit_percentage', 'vat_percentage', 'labor_cost', 'equipment_cost',
        'material_cost', 'direct_cost', 'ocm_amount', 'profit_amount', 'vat_amount',
        'indirect_cost', 'total_cost', 'unit_cost',
    ];

    protected function casts(): array
    {
        return array_fill_keys([
            'quantity', 'ocm_percentage', 'profit_percentage', 'vat_percentage',
            'labor_cost', 'equipment_cost', 'material_cost', 'direct_cost',
            'ocm_amount', 'profit_amount', 'vat_amount', 'indirect_cost', 'total_cost', 'unit_cost',
        ], 'float');
    }

    /** @return BelongsTo<ProjectItem, $this> */
    public function dupa(): BelongsTo
    {
        return $this->belongsTo(ProjectItem::class, 'dupa_id');
    }

    /** @return HasMany<LaborDupa, $this> */
    public function labors(): HasMany
    {
        return $this->hasMany(LaborDupa::class, 'estimate_id');
    }

    /** @return HasMany<EquipmentDupa, $this> */
    public function equipment(): HasMany
    {
        return $this->hasMany(EquipmentDupa::class, 'estimate_id');
    }

    /** @return HasMany<MaterialDupa, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(MaterialDupa::class, 'estimate_id');
    }
}
