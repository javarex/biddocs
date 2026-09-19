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
            $table->timestamp('estimates_updated_at')->nullable();
        });

        Schema::table('sections', function (Blueprint $table): void {
            $table->unsignedInteger('sort_order')->default(0)->index();
        });
        Schema::table('sub_sections', function (Blueprint $table): void {
            $table->unsignedInteger('sort_order')->default(0)->index();
        });
        Schema::table('dupas', function (Blueprint $table): void {
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->unsignedInteger('sub_section_id')->nullable()->change();
        });

        Schema::create('dupa_estimates', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('dupa_id');
            $table->enum('estimate_type', ['ADD', 'NON_ADD']);
            $table->enum('calculation_mode', ['imported_summary', 'resources'])->default('resources');
            $table->decimal('quantity', 18, 4)->default(0);
            $table->decimal('ocm_percentage', 8, 4)->default(12);
            $table->decimal('profit_percentage', 8, 4)->default(8);
            $table->decimal('vat_percentage', 8, 4)->default(5);
            $table->decimal('labor_cost', 18, 2)->default(0);
            $table->decimal('equipment_cost', 18, 2)->default(0);
            $table->decimal('material_cost', 18, 2)->default(0);
            $table->decimal('direct_cost', 18, 2)->default(0);
            $table->decimal('ocm_amount', 18, 2)->default(0);
            $table->decimal('profit_amount', 18, 2)->default(0);
            $table->decimal('vat_amount', 18, 2)->default(0);
            $table->decimal('indirect_cost', 18, 2)->default(0);
            $table->decimal('total_cost', 18, 2)->default(0);
            $table->decimal('unit_cost', 18, 2)->default(0);
            $table->timestamps();

            $table->unique(['dupa_id', 'estimate_type']);
            $table->foreign('dupa_id')->references('id')->on('dupas')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('project_estimate_settings', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('project_id');
            $table->enum('estimate_type', ['ADD', 'NON_ADD']);
            $table->decimal('pol_amount', 18, 2)->default(0);
            $table->decimal('pre_engineering_percentage', 8, 4)->default(0);
            $table->decimal('supervision_percentage', 8, 4)->default(0);
            $table->decimal('contingencies_amount', 18, 2)->default(0);
            $table->timestamps();

            $table->unique(['project_id', 'estimate_type']);
            $table->foreign('project_id')->references('id')->on('projects')
                ->cascadeOnUpdate()->cascadeOnDelete();
        });

        foreach (['labor_dupa' => 'labor_id', 'equipment_dupa' => 'equipment_id', 'material_dupa' => 'material_id'] as $table => $catalogKey) {
            Schema::table($table, function (Blueprint $blueprint) use ($catalogKey): void {
                $blueprint->dropUnique(['dupa_id', $catalogKey]);
                $blueprint->unsignedInteger('estimate_id')->nullable()->index();
                $blueprint->boolean('is_included')->default(true);
                $blueprint->unsignedInteger('sort_order')->default(0);
                $blueprint->foreign('estimate_id')->references('id')->on('dupa_estimates')
                    ->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        Schema::table('labor_dupa', function (Blueprint $table): void {
            $table->decimal('no_of_person', 12, 4)->change();
            $table->decimal('no_of_days', 12, 4)->change();
            $table->decimal('rate', 18, 2)->change();
        });
        Schema::table('equipment_dupa', function (Blueprint $table): void {
            $table->decimal('no_of_units', 12, 4)->change();
            $table->decimal('no_of_days', 12, 4)->change();
            $table->decimal('rental_unit_cost', 18, 2)->change();
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->string('unit', 45)->default('');
            $table->decimal('qty', 18, 4)->default(0);
            $table->decimal('unit_cost', 18, 2)->default(0);
            $table->decimal('multiplier', 18, 4)->default(1);
        });
        Schema::table('material_items', function (Blueprint $table): void {
            $table->decimal('qty', 18, 4)->change();
            $table->decimal('unit_cost', 18, 2)->change();
            $table->unsignedInteger('sort_order')->default(0);
        });
        Schema::table('miscellaneous', function (Blueprint $table): void {
            $table->enum('estimate_type', ['ADD', 'NON_ADD'])->default('ADD')->index();
            $table->decimal('amount', 18, 2)->change();
            $table->decimal('multiplier', 18, 4)->default(1);
            $table->unsignedInteger('sort_order')->default(0);
        });

        DB::table('dupas')->orderBy('id')->each(function (object $dupa): void {
            $direct = (float) $dupa->estimated_direct_cost;
            $ocm = (float) $dupa->ocm;
            $profit = (float) $dupa->profit;
            $vat = (float) $dupa->vat_five_percent;
            $id = DB::table('dupa_estimates')->insertGetId([
                'dupa_id' => $dupa->id,
                'estimate_type' => 'ADD',
                'calculation_mode' => 'imported_summary',
                'quantity' => $dupa->qty,
                'ocm_percentage' => $direct > 0 ? round(($ocm / $direct) * 100, 4) : 0,
                'profit_percentage' => $direct > 0 ? round(($profit / $direct) * 100, 4) : 0,
                'vat_percentage' => $direct + $ocm + $profit > 0 ? round(($vat / ($direct + $ocm + $profit)) * 100, 4) : 0,
                'direct_cost' => $direct,
                'ocm_amount' => $ocm,
                'profit_amount' => $profit,
                'vat_amount' => $vat,
                'indirect_cost' => $dupa->total_indirect_cost,
                'total_cost' => $dupa->total_cost,
                'unit_cost' => $dupa->unit_cost_adjusted,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach (['labor_dupa', 'equipment_dupa', 'material_dupa'] as $table) {
                DB::table($table)->where('dupa_id', $dupa->id)->update(['estimate_id' => $id]);
            }
        });

        foreach (DB::table('projects')->pluck('id') as $projectId) {
            foreach (['ADD', 'NON_ADD'] as $type) {
                DB::table('project_estimate_settings')->insert([
                    'project_id' => $projectId,
                    'estimate_type' => $type,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('miscellaneous', function (Blueprint $table): void {
            $table->dropColumn(['estimate_type', 'multiplier', 'sort_order']);
        });
        Schema::table('material_items', function (Blueprint $table): void {
            $table->dropColumn('sort_order');
        });
        Schema::table('material_dupa', function (Blueprint $table): void {
            $table->dropColumn(['unit', 'qty', 'unit_cost', 'multiplier']);
        });

        foreach (['labor_dupa' => 'labor_id', 'equipment_dupa' => 'equipment_id', 'material_dupa' => 'material_id'] as $table => $catalogKey) {
            Schema::table($table, function (Blueprint $blueprint) use ($catalogKey): void {
                $blueprint->dropForeign(['estimate_id']);
                $blueprint->dropColumn(['estimate_id', 'is_included', 'sort_order']);
                $blueprint->unique(['dupa_id', $catalogKey]);
            });
        }

        Schema::dropIfExists('project_estimate_settings');
        Schema::dropIfExists('dupa_estimates');
        Schema::table('dupas', function (Blueprint $table): void {
            $table->unsignedInteger('sub_section_id')->nullable(false)->change();
            $table->dropColumn('sort_order');
        });
        Schema::table('sub_sections', fn (Blueprint $table) => $table->dropColumn('sort_order'));
        Schema::table('sections', fn (Blueprint $table) => $table->dropColumn('sort_order'));
        Schema::table('projects', fn (Blueprint $table) => $table->dropColumn('estimates_updated_at'));
    }
};
