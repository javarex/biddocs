<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labors', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('manpower');
            $table->double('rates');
            $table->enum('types', ['Contract', 'Admin']);
            $table->timestamps();
        });

        Schema::create('equipments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('equipment');
            $table->double('rental');
        });

        Schema::create('materials', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('itemcode')->unique();
            // A category foreign key can be added when its table is defined.
            $table->unsignedInteger('category_id')->index();
            $table->text('description');
            $table->string('unit');
        });

        Schema::create('prices', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('itemcode');
            $table->decimal('price', 15, 2);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->index(['itemcode', 'effective_from']);
            $table->foreign('itemcode')
                ->references('itemcode')
                ->on('materials')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prices');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('equipments');
        Schema::dropIfExists('labors');
    }
};
