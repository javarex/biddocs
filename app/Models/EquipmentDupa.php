<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EquipmentDupa extends Model
{
    protected $table = 'equipment_dupa';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['no_of_units' => 'float', 'no_of_days' => 'float', 'rental_unit_cost' => 'float', 'is_included' => 'boolean'];
    }

    /** @return BelongsTo<DupaEstimate, $this> */
    public function estimate(): BelongsTo
    {
        return $this->belongsTo(DupaEstimate::class, 'estimate_id');
    }

    /** @return BelongsTo<ProjectItem, $this> */
    public function dupa(): BelongsTo
    {
        return $this->belongsTo(ProjectItem::class, 'dupa_id');
    }

    /** @return BelongsTo<Equipment, $this> */
    public function equipmentCatalog(): BelongsTo
    {
        return $this->belongsTo(Equipment::class, 'equipment_id');
    }
}
