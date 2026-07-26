<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_items', function (Blueprint $table): void {
            $table->renameColumn('vat_percentage', 'vat_five_percent');
        });
    }

    public function down(): void
    {
        Schema::table('project_items', function (Blueprint $table): void {
            $table->renameColumn('vat_five_percent', 'vat_percentage');
        });
    }
};
