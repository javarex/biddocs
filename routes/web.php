<?php

use App\Http\Controllers\Admin\ImportController;
use App\Http\Controllers\Admin\ProjectBidDocumentController;
use App\Http\Controllers\Admin\ProjectController;
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

Route::middleware(['auth', 'verified', 'active'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::prefix('admin')->name('admin.')->middleware(['super.admin'])->group(function () {
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
        Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
        Route::get('projects/{project}', [ProjectController::class, 'show'])->name('projects.show');
        Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->name('projects.destroy');
        Route::get('projects/{project}/bid-docs', [ProjectBidDocumentController::class, 'show'])->name('projects.bid-docs.show');
        Route::get('projects/{project}/bid-docs/document', [ProjectBidDocumentController::class, 'document'])->name('projects.bid-docs.document');
        Route::get('projects/{project}/import', [ImportController::class, 'projectImport'])->name('projects.import');
        Route::post('projects/{project}/import/preview', [ImportController::class, 'previewForProject'])->name('projects.import.preview');
        Route::get('settings', SystemSettingsController::class)->name('settings');
        Route::get('imports', [ImportController::class, 'index'])->name('imports.index');
        Route::post('imports/preview', [ImportController::class, 'preview'])->name('imports.preview');
        Route::post('imports/{importHistory}/commit', [ImportController::class, 'commit'])->name('imports.commit');
        Route::get('imports/{importHistory}/errors', [ImportController::class, 'errors'])->name('imports.errors');
        Route::delete('imports/{importHistory}', [ImportController::class, 'destroy'])->name('imports.destroy');
    });
});

require __DIR__.'/settings.php';
