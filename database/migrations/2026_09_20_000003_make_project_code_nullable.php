<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('project_code', 45)->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('projects')->whereNull('project_code')->update(['project_code' => '']);

        Schema::table('projects', function (Blueprint $table): void {
            $table->string('project_code', 45)->nullable(false)->change();
        });
    }
};
