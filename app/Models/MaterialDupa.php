<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaterialDupa extends Model
{
    protected $table = 'material_dupa';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['qty' => 'float', 'unit_cost' => 'float', 'multiplier' => 'float', 'is_included' => 'boolean'];
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

    /** @return BelongsTo<Material, $this> */
    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    /** @return HasMany<MaterialItem, $this> */
    public function breakdowns(): HasMany
    {
        return $this->hasMany(MaterialItem::class, 'material_dupa_id');
    }
}
