<?php

use App\Http\Controllers\Admin\ImportController;
use App\Http\Controllers\Admin\ProjectBidDocumentController;
use App\Http\Controllers\Admin\ProjectController;
use App\Http\Controllers\Admin\ProjectEstimateController;
use App\Http\Controllers\Admin\ProjectStructureController;
use App\Http\Controllers\Admin\ResourceCatalogController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SystemSettingsController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ImpersonationController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::post('impersonation/leave', [ImpersonationController::class, 'leave'])->name('impersonation.leave');
});

Route::middleware(['auth', 'active'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::post('libraries/items/sync', [ResourceCatalogController::class, 'syncItems'])->name('libraries.items.sync');
        Route::get('libraries/items/{record}/price-history', [ResourceCatalogController::class, 'itemPriceHistory'])->name('libraries.items.price-history');

        Route::post('libraries/categories/sync', [ResourceCatalogController::class, 'syncCategories'])->name('libraries.categories.sync');

        Route::prefix('libraries/{catalog}')->where(['catalog' => 'labors|equipments|items|prices|categories|signatories'])->name('libraries.')->group(function () {
            Route::get('/', [ResourceCatalogController::class, 'index'])->name('index');
            Route::post('/', [ResourceCatalogController::class, 'store'])->name('store');
            Route::put('/{record}', [ResourceCatalogController::class, 'update'])->name('update');
            Route::delete('/{record}', [ResourceCatalogController::class, 'destroy'])->name('destroy');
        });

        Route::middleware(['super.admin'])->group(function () {
            Route::resource('users', UserController::class)->except(['create', 'store', 'show', 'edit', 'update', 'destroy']);
            Route::get('users/create', [UserController::class, 'create'])->name('users.create');
            Route::post('users', [UserController::class, 'store'])->name('users.store');
            Route::get('users/{user}', [UserController::class, 'show'])->name('users.show');
            Route::get('users/{user}/edit', [UserController::class, 'edit'])->name('users.edit');
            Route::put('users/{user}', [UserController::class, 'update'])->name('users.update');
            Route::put('users/{user}/password', [UserController::class, 'resetPassword'])->name('users.password');
            Route::delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
            Route::post('users/{user}/impersonate', [ImpersonationController::class, 'start'])->name('users.impersonate');

            Route::resource('roles', RoleController::class)->except(['show']);
        });

        Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
        Route::get('projects/create', [ProjectController::class, 'create'])->name('projects.create');
        Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
        Route::get('projects/{project}/edit', [ProjectController::class, 'edit'])->name('projects.edit');
        Route::put('projects/{project}', [ProjectController::class, 'update'])->name('projects.update');
        Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
        Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
        Route::get('projects/{project}/bid-docs', [ProjectBidDocumentController::class, 'show'])->name('projects.bid-docs.show');
        Route::get('projects/{project}/bid-docs/document', [ProjectBidDocumentController::class, 'document'])->name('projects.bid-docs.document');
        Route::put('projects/{project}/bid-docs', [ProjectBidDocumentController::class, 'update'])->name('projects.bid-docs.update');
        Route::delete('projects/{project}/bid-docs', [ProjectBidDocumentController::class, 'destroy'])->name('projects.bid-docs.destroy');
        Route::get('projects/{project}/import', [ImportController::class, 'projectImport'])->name('projects.import');
        Route::post('projects/{project}/import/preview', [ImportController::class, 'previewForProject'])->name('projects.import.preview');
        Route::post('projects/{project}/sections', [ProjectStructureController::class, 'storeSection'])->name('projects.sections.store');
        Route::put('projects/{project}/structure/order', [ProjectStructureController::class, 'reorder'])->name('projects.structure.order');
        Route::post('projects/{project}/starter-structure', [ProjectStructureController::class, 'applyStarterStructure'])->name('projects.starter-structure.store');
        Route::put('sections/{section}', [ProjectStructureController::class, 'updateSection'])->name('sections.update');
        Route::delete('sections/{section}', [ProjectStructureController::class, 'destroySection'])->name('sections.destroy');
        Route::post('sections/{section}/sub-sections', [ProjectStructureController::class, 'storeSubSection'])->name('sections.sub-sections.store');
        Route::put('sub-sections/{subSection}', [ProjectStructureController::class, 'updateSubSection'])->name('sub-sections.update');
        Route::delete('sub-sections/{subSection}', [ProjectStructureController::class, 'destroySubSection'])->name('sub-sections.destroy');
        Route::post('sections/{section}/dupas', [ProjectStructureController::class, 'storeDupa'])->name('sections.dupas.store');
        Route::get('dupas/{dupa}/edit', [ProjectEstimateController::class, 'edit'])->name('dupas.edit');
        Route::post('dupas/{dupa}/duplicate', [ProjectStructureController::class, 'duplicateDupa'])->name('dupas.duplicate');
        Route::put('dupas/{dupa}', [ProjectEstimateController::class, 'updateDupa'])->name('dupas.update');
        Route::delete('dupas/{dupa}', [ProjectStructureController::class, 'destroyDupa'])->name('dupas.destroy');
        Route::put('dupas/{dupa}/estimates/{type}', [ProjectEstimateController::class, 'updateEstimate'])->name('dupas.estimates.update');
        Route::put('projects/{project}/estimate-settings', [ProjectEstimateController::class, 'updateProject'])->name('projects.estimate-settings.update');

        Route::middleware(['super.admin'])->group(function () {
            Route::get('settings', SystemSettingsController::class)->name('settings');
        });

        Route::get('imports', [ImportController::class, 'index'])->name('imports.index');
        Route::get('imports/templates/abc', [ImportController::class, 'downloadAbcTemplate'])->name('imports.templates.abc');
        Route::post('imports/preview', [ImportController::class, 'preview'])->name('imports.preview');
        Route::post('imports/{importHistory}/commit', [ImportController::class, 'commit'])->name('imports.commit');
        Route::get('imports/{importHistory}/errors', [ImportController::class, 'errors'])->name('imports.errors');
        Route::delete('imports/{importHistory}', [ImportController::class, 'destroy'])->name('imports.destroy');
    });
});

require __DIR__.'/settings.php';
