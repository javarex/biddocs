<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property string|null $row_uuid */
class LaborDupa extends Model
{
    protected $table = 'labor_dupa';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['no_of_person' => 'float', 'no_of_days' => 'float', 'rate' => 'float', 'is_included' => 'boolean'];
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

    /** @return BelongsTo<Labor, $this> */
    public function labor(): BelongsTo
    {
        return $this->belongsTo(Labor::class);
    }
}
