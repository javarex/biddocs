<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $project_id
 * @property int|null $edited_by
 * @property string $stored_path
 * @property int $revision
 * @property Carbon $edited_at
 */
class BidDocumentVersion extends Model
{
    protected $fillable = [
        'project_id', 'edited_by', 'stored_path', 'revision', 'edited_at',
    ];

    protected function casts(): array
    {
        return [
            'revision' => 'integer',
            'edited_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'edited_by');
    }
}
