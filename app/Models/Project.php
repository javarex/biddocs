<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Project extends Model
{
    public $timestamps = false;

    protected $fillable = ['project_code', 'project_name', 'location', 'contract_duration'];

    /** @return HasMany<Section, $this> */
    public function sections(): HasMany
    {
        return $this->hasMany(Section::class);
    }

    /** @return HasManyThrough<ProjectItem, Section, $this> */
    public function items(): HasManyThrough
    {
        return $this->hasManyThrough(ProjectItem::class, Section::class);
    }
}
