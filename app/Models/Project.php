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

    protected $fillable = [
        'project_code', 'project_date', 'project_name', 'allocated_amount', 'project_description', 'source_of_funds', 'location',
        'contract_duration', 'created_by', 'type_of_projects', 'category', 'dimension',
        'floor_area', 'implementation_scheme', 'allotment_class', 'contingencies', 'pol',
        'prepared_by', 'checked_by', 'recommending_approval', 'included_in_aip',
        'recommending_approval_pao', 'approved_by', 'estimates_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'allocated_amount' => 'float',
            'contingencies' => 'float',
            'pol' => 'float',
            'estimates_updated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function preparedBySignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'prepared_by', 'cats_no');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function checkedBySignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'checked_by', 'cats_no');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function recommendingApprovalSignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'recommending_approval', 'cats_no');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function includedInAipSignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'included_in_aip', 'cats_no');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function recommendingApprovalPaoSignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'recommending_approval_pao', 'cats_no');
    }

    /** @return BelongsTo<Signatory, $this> */
    public function approvedBySignatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'approved_by', 'cats_no');
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

    /** @return HasMany<ProjectEstimateSetting, $this> */
    public function estimateSettings(): HasMany
    {
        return $this->hasMany(ProjectEstimateSetting::class);
    }

    /** @return HasMany<Miscellaneous, $this> */
    public function miscellaneous(): HasMany
    {
        return $this->hasMany(Miscellaneous::class);
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
