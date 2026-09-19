<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\CategorySyncService;
use App\Services\MaterialSyncService;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ResourceCatalogController extends Controller
{
    private const CATALOGS = [
        'categories' => ['title' => 'Categories', 'fields' => ['IDCATEGORY', 'fccode', 'CATEGORY_DESCRIPTION', 'is_active']],
        'labors' => ['title' => 'Labor', 'fields' => ['manpower', 'rates', 'types']],
        'equipments' => ['title' => 'Equipment', 'fields' => ['equipment', 'rental']],
        'materials' => ['title' => 'Materials', 'fields' => ['itemcode', 'category_id', 'description', 'unit']],
        'prices' => ['title' => 'Prices', 'fields' => ['itemcode', 'price', 'effective_from', 'effective_to']],
        'signatories' => ['title' => 'Signatories', 'fields' => ['cats_no', 'name', 'position']],
    ];

    public function index(Request $request, string $catalog): Response
    {
        Gate::authorize('libraries.view');
        $definition = $this->definition($catalog);
        $search = trim((string) $request->string('search'));

        return Inertia::render('admin/libraries/index', [
            'catalog' => $catalog,
            'title' => $definition['title'],
            'fields' => $definition['fields'],
            'records' => DB::table($catalog)->select([$this->key($catalog).' as id', ...$definition['fields']])
                ->when($search !== '', function ($query) use ($definition, $search): void {
                    $query->where(function ($query) use ($definition, $search): void {
                        foreach ($definition['fields'] as $field) {
                            $query->orWhere($field, 'like', "%{$search}%");
                        }
                    });
                })->orderByDesc($this->key($catalog))->paginate(15)->withQueryString(),
            'filters' => ['search' => $search],
            'syncMessage' => $request->session()->get($catalog === 'materials' ? 'material_sync' : 'category_sync'),
            'categories' => $catalog === 'materials'
                ? DB::table('categories')->orderBy('CATEGORY_DESCRIPTION')->get(['IDCATEGORY', 'CATEGORY_DESCRIPTION', 'fccode']) : [],
            'materials' => $catalog === 'prices'
                ? DB::table('materials')->orderBy('itemcode')->get(['itemcode', 'description']) : [],
            'can' => [
                'create' => Gate::allows('libraries.create'),
                'update' => Gate::allows('libraries.update'),
                'delete' => Gate::allows('libraries.delete'),
                'sync' => Gate::allows('libraries.create') && Gate::allows('libraries.update'),
            ],
        ]);
    }

    public function store(Request $request, string $catalog): RedirectResponse
    {
        Gate::authorize('libraries.create');
        $this->definition($catalog);
        $data = $this->validated($request, $catalog);
        if (in_array($catalog, ['labors', 'categories'], true)) {
            $data['created_at'] = $data['updated_at'] = now();
        }
        DB::table($catalog)->insert($data);

        return back()->with('success', 'Record created successfully.');
    }

    public function update(Request $request, string $catalog, string $record): RedirectResponse
    {
        Gate::authorize('libraries.update');
        $this->find($catalog, $record);
        $data = $this->validated($request, $catalog, $record);
        if (in_array($catalog, ['labors', 'categories'], true)) {
            $data['updated_at'] = now();
        }
        DB::table($catalog)->where($this->key($catalog), $record)->update($data);

        return back()->with('success', 'Record updated successfully.');
    }

    public function destroy(string $catalog, string $record): RedirectResponse
    {
        Gate::authorize('libraries.delete');
        $this->find($catalog, $record);
        if ($catalog === 'categories' && DB::table('materials')->where('category_id', $record)->exists()) {
            throw ValidationException::withMessages(['delete' => 'This category is used by materials and cannot be deleted.']);
        }
        try {
            DB::table($catalog)->where($this->key($catalog), $record)->delete();
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23503'], true)) {
                throw ValidationException::withMessages([
                    'delete' => $catalog === 'signatories'
                        ? 'This signatory is assigned to a project and cannot be deleted.'
                        : 'This record is in use by a DUPA or price record. Remove those links before deleting it.',
                ]);
            }
            throw $exception;
        }

        return back()->with('success', 'Record deleted successfully.');
    }

    public function syncCategories(CategorySyncService $service): RedirectResponse
    {
        Gate::authorize('libraries.create');
        Gate::authorize('libraries.update');
        $count = $service->sync();

        return back()->with('category_sync', "Synced {$count} categories successfully.");
    }

    public function syncMaterials(Request $request, MaterialSyncService $service): RedirectResponse
    {
        Gate::authorize('libraries.create');
        Gate::authorize('libraries.update');
        $data = $request->validate([
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['required', 'integer', 'distinct', Rule::exists('categories', 'IDCATEGORY')],
        ]);
        $count = $service->sync($data['categories']);

        return back()->with('material_sync', "Synced {$count} items into Materials successfully.");
    }

    private function key(string $catalog): string
    {
        return match ($catalog) {
            'categories' => 'IDCATEGORY',
            'signatories' => 'cats_no',
            default => 'id',
        };
    }

    /** @return array{title: string, fields: list<string>} */
    private function definition(string $catalog): array
    {
        abort_unless(isset(self::CATALOGS[$catalog]), 404);

        return self::CATALOGS[$catalog];
    }

    private function find(string $catalog, string $record): void
    {
        $this->definition($catalog);
        abort_unless(DB::table($catalog)->where($this->key($catalog), $record)->exists(), 404);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, string $catalog, string|int|null $record = null): array
    {
        return $request->validate(match ($catalog) {
            'categories' => [
                'IDCATEGORY' => ['required', 'integer', 'min:1', 'max:4294967295',
                    $record === null ? Rule::unique('categories', 'IDCATEGORY') : Rule::in([$record])],
                'fccode' => ['nullable', 'string', 'max:255'],
                'CATEGORY_DESCRIPTION' => ['required', 'string', 'max:255'],
                'is_active' => ['required', 'boolean'],
            ],
            'labors' => [
                'manpower' => ['required', 'string', 'max:255'],
                'rates' => ['required', 'numeric', 'min:0'],
                'types' => ['required', Rule::in(['Contract', 'Admin'])],
            ],
            'equipments' => [
                'equipment' => ['required', 'string', 'max:255'],
                'rental' => ['required', 'numeric', 'min:0'],
            ],
            'materials' => [
                'itemcode' => ['required', 'string', 'max:255', Rule::unique('materials', 'itemcode')->ignore($record)],
                'category_id' => ['required', 'integer', 'min:1', 'max:4294967295'],
                'description' => ['required', 'string', 'max:10000'],
                'unit' => ['required', 'string', 'max:255'],
            ],
            'prices' => [
                'itemcode' => ['required', 'string', Rule::exists('materials', 'itemcode')],
                'price' => ['required', 'numeric', 'min:0', 'max:9999999999999.99', 'decimal:0,2'],
                'effective_from' => ['required', 'date_format:Y-m-d'],
                'effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            ],
            'signatories' => [
                'cats_no' => ['required', 'string', 'max:64',
                    $record === null ? Rule::unique('signatories', 'cats_no') : Rule::in([(string) $record])],
                'name' => ['required', 'string', 'max:255'],
                'position' => ['required', 'string', 'max:255'],
            ],
            default => throw new \InvalidArgumentException('Unknown resource catalog.'),
        });
    }
}
