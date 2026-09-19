<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SubSection extends Model
{
    public $timestamps = false;

    protected $fillable = ['section_id', 'sub_section', 'sort_order'];

    /** @return BelongsTo<Section, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(Section::class);
    }

    /** @return HasMany<ProjectItem, $this> */
    public function projectItems(): HasMany
    {
        return $this->hasMany(ProjectItem::class);
    }
}
