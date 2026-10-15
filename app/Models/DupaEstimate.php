<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property array<string, mixed>|null $backup_applied
 * @property list<array<string, mixed>>|null $backup_bindings
 * @property int $backup_revision
 */
class DupaEstimate extends Model
{
    protected $fillable = [
        'dupa_id', 'estimate_type', 'calculation_mode', 'quantity', 'ocm_percentage',
        'profit_percentage', 'vat_percentage', 'labor_cost', 'equipment_cost',
        'material_cost', 'direct_cost', 'ocm_amount', 'profit_amount', 'vat_amount',
        'backup_revision', 'backup_bindings', 'backup_applied',
        'indirect_cost', 'total_cost', 'unit_cost',
    ];

    protected function casts(): array
    {
        return ['backup_bindings' => 'array', 'backup_applied' => 'array', 'backup_revision' => 'integer'] + array_fill_keys([
            'quantity', 'ocm_percentage', 'profit_percentage', 'vat_percentage',
            'labor_cost', 'equipment_cost', 'material_cost', 'direct_cost',
            'ocm_amount', 'profit_amount', 'vat_amount', 'indirect_cost', 'total_cost', 'unit_cost',
        ], 'float');
    }

    /** @return HasMany<DupaDetailBackup, $this> */
    public function backups(): HasMany
    {
        return $this->hasMany(DupaDetailBackup::class, 'estimate_id')->orderBy('id');
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
