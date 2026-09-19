<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signatories', function (Blueprint $table): void {
            $table->string('cats_no', 64)->primary();
            $table->string('name', 255);
            $table->string('position', 255);

            $table->index('name');
            $table->index('position');
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->string('type_of_projects', 255)->nullable()->index();
            $table->string('category', 255)->nullable()->index();
            $table->text('dimension')->nullable();
            $table->string('floor_area', 255)->nullable();
            $table->enum('implementation_scheme', ['Administration', 'contract'])->nullable();
            $table->string('allotment_class', 255)->nullable()->index();
            $table->double('contingencies')->nullable();
            $table->double('pol')->nullable();

            foreach ($this->signatoryColumns() as $column) {
                $table->string($column, 64)->nullable()->index();
                $table->foreign($column)
                    ->references('cats_no')
                    ->on('signatories')
                    ->cascadeOnUpdate()
                    ->restrictOnDelete();
            }
        });

        Schema::create('miscellaneous', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('project_id');
            $table->text('description');
            $table->string('unit', 45);
            $table->double('amount');

            $table->index('project_id');
            $table->index('unit');
            $table->foreign('project_id')
                ->references('id')
                ->on('projects')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('miscellaneous');

        Schema::table('projects', function (Blueprint $table): void {
            foreach ($this->signatoryColumns() as $column) {
                $table->dropForeign([$column]);
            }

            $table->dropColumn([
                'type_of_projects',
                'category',
                'dimension',
                'floor_area',
                'implementation_scheme',
                'allotment_class',
                'contingencies',
                'pol',
                ...$this->signatoryColumns(),
            ]);
        });

        Schema::dropIfExists('signatories');
    }

    /** @return list<string> */
    private function signatoryColumns(): array
    {
        return [
            'prepared_by',
            'checked_by',
            'recommending_approval',
            'included_in_aip',
            'recommending_approval_pao',
            'approved_by',
        ];
    }
};
