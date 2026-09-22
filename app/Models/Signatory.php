<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Signatory extends Model
{
    public const ROLES = [
        'checked_by' => 'Checked by',
        'recommending_approval' => 'Recommending approval',
        'included_in_aip' => 'Included in AIP',
        'recommending_approval_pao' => 'Recommending approval (PAO)',
        'approved_by' => 'Approved by',
    ];

    protected $primaryKey = 'cats_no';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['cats_no', 'user_id', 'name', 'position', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return HasMany<SignatoryRoleAssignment, $this> */
    public function roleAssignments(): HasMany
    {
        return $this->hasMany(SignatoryRoleAssignment::class, 'cats_no', 'cats_no');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
