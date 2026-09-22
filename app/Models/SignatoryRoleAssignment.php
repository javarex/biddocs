<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignatoryRoleAssignment extends Model
{
    protected $primaryKey = 'role';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['role', 'cats_no'];

    /** @return BelongsTo<Signatory, $this> */
    public function signatory(): BelongsTo
    {
        return $this->belongsTo(Signatory::class, 'cats_no', 'cats_no');
    }
}
