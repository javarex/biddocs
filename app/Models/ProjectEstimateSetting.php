<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectEstimateSetting extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'pol_amount' => 'float', 'pre_engineering_percentage' => 'float',
            'supervision_percentage' => 'float', 'contingencies_amount' => 'float',
        ];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
