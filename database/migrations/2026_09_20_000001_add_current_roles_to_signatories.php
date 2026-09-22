<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signatories', function (Blueprint $table): void {
            $table->boolean('is_active')->default(true)->index();
        });

        Schema::create('signatory_role_assignments', function (Blueprint $table): void {
            $table->string('role', 64)->primary();
            $table->string('cats_no', 64)->index();
            $table->timestamps();

            $table->foreign('cats_no')
                ->references('cats_no')
                ->on('signatories')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signatory_role_assignments');

        Schema::table('signatories', function (Blueprint $table): void {
            $table->dropColumn('is_active');
        });
    }
};
