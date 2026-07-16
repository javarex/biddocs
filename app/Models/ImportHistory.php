<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportHistory extends Model
{
    protected $fillable = [
        'imported_by', 'original_filename', 'stored_path', 'import_type', 'import_mode',
        'project_id',
        'status', 'total_rows', 'imported_rows', 'updated_rows', 'duplicate_rows',
        'skipped_rows', 'failed_rows', 'started_at', 'completed_at',
        'execution_time_seconds', 'error_message', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<ImportFailure, $this> */
    public function failures(): HasMany
    {
        return $this->hasMany(ImportFailure::class);
    }
}
