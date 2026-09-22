<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signatories', function (Blueprint $table): void {
            $table->foreignId('user_id')
                ->nullable()
                ->after('cats_no')
                ->unique()
                ->constrained('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();
        });

        DB::table('signatory_role_assignments')->where('role', 'prepared_by')->delete();
    }

    public function down(): void
    {
        Schema::table('signatories', function (Blueprint $table): void {
            $table->dropUnique(['user_id']);
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
