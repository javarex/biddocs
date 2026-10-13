<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DupaSource;
use App\Services\Import\DupaSourceImportService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Reader\Exception;
use RuntimeException;

class DupaSourceController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('libraries.view');
        $search = trim((string) $request->string('search'));
        $part = trim((string) $request->string('part'));

        return Inertia::render('admin/dpwh-dupa/index', [
            'records' => DupaSource::query()
                ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                    foreach (['pay_item_no', 'suffix', 'description', 'thickness_sizes', 'class', 'others', 'unit', 'item_heading'] as $field) {
                        $query->orWhere($field, 'like', "%{$search}%");
                    }
                }))
                ->when($part !== '', fn ($query) => $query->where('part', $part))
                ->orderBy('source_file')->orderBy('worksheet')->orderBy('source_row')
                ->paginate(25)->withQueryString(),
            'parts' => DupaSource::query()->whereNotNull('part')->distinct()->orderBy('part')->pluck('part'),
            'filters' => compact('search', 'part'),
            'canImport' => Gate::allows('imports.create'),
            'importMessage' => $request->session()->get('dupa_import'),
        ]);
    }

    public function import(Request $request, DupaSourceImportService $importer): RedirectResponse
    {
        Gate::authorize('libraries.view');
        Gate::authorize('imports.create');
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx', 'max:20480']]);
        $file = $request->file('file');
        try {
            $records = $importer->parse($file->getRealPath());
            foreach ($records as &$record) {
                $record['source_file'] = $file->getClientOriginalName();
            }
            unset($record);
            $count = $importer->import($records);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages(['file' => $exception->getMessage()]);
        } catch (Exception $exception) {
            throw ValidationException::withMessages(['file' => 'The workbook could not be read. Upload a valid DPWH pay-item XLSX workbook.']);
        }

        return to_route('admin.dpwh-dupa.index')->with('dupa_import', "Imported {$count} pay-item variants successfully.");
    }
}
