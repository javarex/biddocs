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
            $table->decimal('allocated_amount', 18, 2)->nullable()->after('project_name');
        });

        Schema::create('project_markup_rates', function (Blueprint $table): void {
            $table->increments('id');
            $table->decimal('minimum_amount', 18, 2);
            $table->decimal('maximum_amount', 18, 2)->nullable();
            $table->decimal('ocm_percentage', 8, 4);
            $table->decimal('profit_percentage', 8, 4);
            $table->decimal('vat_percentage', 8, 4);
        });

        DB::table('project_markup_rates')->insert([
            ['minimum_amount' => 0, 'maximum_amount' => 5000000, 'ocm_percentage' => 15, 'profit_percentage' => 10, 'vat_percentage' => 5],
            ['minimum_amount' => 5000000.01, 'maximum_amount' => 50000000, 'ocm_percentage' => 12, 'profit_percentage' => 8, 'vat_percentage' => 5],
            ['minimum_amount' => 50000000.01, 'maximum_amount' => 150000000, 'ocm_percentage' => 10, 'profit_percentage' => 8, 'vat_percentage' => 5],
            ['minimum_amount' => 150000000.01, 'maximum_amount' => null, 'ocm_percentage' => 8, 'profit_percentage' => 8, 'vat_percentage' => 5],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('project_markup_rates');
        Schema::table('projects', fn (Blueprint $table) => $table->dropColumn('allocated_amount'));
    }
};
