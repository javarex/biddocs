<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportFailure extends Model
{
    protected $fillable = [
        'import_history_id', 'worksheet', 'excel_row', 'original_values',
        'field_or_column', 'error_reason', 'suggested_correction',
    ];

    protected function casts(): array
    {
        return ['original_values' => 'array'];
    }

    /** @return BelongsTo<ImportHistory, $this> */
    public function importHistory(): BelongsTo
    {
        return $this->belongsTo(ImportHistory::class);
    }
}
