<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    public $timestamps = false;

    protected $fillable = ['section', 'project_id'];

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<SubSection, $this> */
    public function subSections(): HasMany
    {
        return $this->hasMany(SubSection::class);
    }

    /** @return HasMany<ProjectItem, $this> */
    public function projectItems(): HasMany
    {
        return $this->hasMany(ProjectItem::class);
    }
}
