<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class DupaBackupTemplate extends Model
{
    protected $guarded = [];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function setExcludedFor(int $userId, bool $excluded): void
    {
        $match = ['user_id' => $userId, 'template_id' => $this->id];
        if ($excluded) {
            DB::table('excluded_templates')->insertOrIgnore($match + ['created_at' => now(), 'updated_at' => now()]);
        } else {
            DB::table('excluded_templates')->where($match)->delete();
        }
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->whereNotExists(fn ($excluded) => $excluded->selectRaw('1')
            ->from('excluded_templates')
            ->whereColumn('excluded_templates.template_id', 'dupa_backup_templates.id')
            ->where('excluded_templates.user_id', $userId));
    }

    protected function casts(): array
    {
        return ['definition' => 'array', 'is_excluded' => 'boolean'];
    }
}
