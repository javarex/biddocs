<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('import_histories', function (Blueprint $table): void {
            $table->unsignedInteger('project_id')->nullable()->after('imported_by');
            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('import_histories', function (Blueprint $table): void {
            $table->dropForeign(['project_id']);
            $table->dropIndex(['project_id', 'status']);
            $table->dropColumn('project_id');
        });
    }
};
