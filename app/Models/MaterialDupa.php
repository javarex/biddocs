<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property string|null $row_uuid */
class MaterialDupa extends Model
{
    protected $table = 'material_dupa';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['qty' => 'float', 'unit_cost' => 'float', 'is_included' => 'boolean'];
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

    /** @return BelongsTo<Item, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
