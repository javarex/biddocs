<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    public $timestamps = false;

    protected $fillable = ['project_code', 'project_name', 'project_description', 'source_of_funds', 'location', 'contract_duration', 'created_by'];

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<ImportHistory, $this> */
    public function importHistories(): HasMany
    {
        return $this->hasMany(ImportHistory::class);
    }

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

    /** @return HasOne<BidDocumentVersion, $this> */
    public function bidDocumentVersion(): HasOne
    {
        return $this->hasOne(BidDocumentVersion::class);
    }
}
