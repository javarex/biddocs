<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Miscellaneous extends Model
{
    protected $table = 'miscellaneous';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount' => 'float', 'multiplier' => 'float'];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
