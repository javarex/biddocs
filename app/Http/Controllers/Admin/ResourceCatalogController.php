<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Signatory;
use App\Models\User;
use App\Services\CategorySyncService;
use App\Services\ItemSyncService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
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
        'items' => ['title' => 'Items', 'fields' => ['itemcode', 'category_id', 'description', 'unit']],
        'prices' => ['title' => 'Prices', 'fields' => ['itemcode', 'price', 'effective_from', 'effective_to']],
        'signatories' => ['title' => 'Signatories', 'fields' => ['cats_no', 'name', 'position', 'user_id', 'roles', 'is_active']],
    ];

    public function index(Request $request, string $catalog): Response
    {
        Gate::authorize('libraries.view');
        $definition = $this->definition($catalog);
        $search = trim((string) $request->string('search'));
        $displayFields = $catalog === 'items'
            ? [...$definition['fields'], 'unit_cost', 'effective_from', 'effective_to']
            : $definition['fields'];

        if ($catalog === 'signatories') {
            $records = Signatory::query()->with('roleAssignments')
                ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                    $query->where('cats_no', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('position', 'like', "%{$search}%");
                }))->orderByDesc('cats_no')->paginate(15)->withQueryString()
                ->through(fn (Signatory $signatory): array => [
                    'id' => $signatory->cats_no,
                    ...$signatory->only(['cats_no', 'name', 'position', 'user_id', 'is_active']),
                    'roles' => $signatory->roleAssignments->pluck('role')->values()->all(),
                ]);
        } elseif ($catalog === 'items') {
            $records = DB::table('items')
                ->select(['items.id as id', ...array_map(fn (string $field): string => 'items.'.$field, $definition['fields'])])
                ->selectSub($this->latestPriceColumn('price'), 'unit_cost')
                ->selectSub($this->latestPriceColumn('effective_from'), 'effective_from')
                ->selectSub($this->latestPriceColumn('effective_to'), 'effective_to')
                ->when($search !== '', function ($query) use ($definition, $search): void {
                    $query->where(function ($query) use ($definition, $search): void {
                        foreach ($definition['fields'] as $field) {
                            $query->orWhere('items.'.$field, 'like', "%{$search}%");
                        }
                    });
                })->orderByDesc('items.id')->paginate(15)->withQueryString();
        } else {
            $records = DB::table($catalog)->select([$this->key($catalog).' as id', ...$definition['fields']])
                ->when($search !== '', function ($query) use ($definition, $search): void {
                    $query->where(function ($query) use ($definition, $search): void {
                        foreach ($definition['fields'] as $field) {
                            $query->orWhere($field, 'like', "%{$search}%");
                        }
                    });
                })->orderByDesc($this->key($catalog))->paginate(15)->withQueryString();
        }

        return Inertia::render('admin/libraries/index', [
            'catalog' => $catalog,
            'title' => $definition['title'],
            'fields' => $definition['fields'],
            'displayFields' => $displayFields,
            'records' => $records,
            'filters' => ['search' => $search],
            'syncMessage' => $request->session()->get($catalog === 'items' ? 'item_sync' : 'category_sync'),
            'categories' => $catalog === 'items'
                ? DB::table('categories')->orderBy('CATEGORY_DESCRIPTION')->get(['IDCATEGORY', 'CATEGORY_DESCRIPTION', 'fccode']) : [],
            'items' => $catalog === 'prices'
                ? DB::table('items')->orderBy('itemcode')->get(['itemcode', 'description']) : [],
            'signatoryRoles' => $catalog === 'signatories'
                ? collect(Signatory::ROLES)->map(function (string $label, string $key): array {
                    $assignment = DB::table('signatory_role_assignments')
                        ->join('signatories', 'signatories.cats_no', '=', 'signatory_role_assignments.cats_no')
                        ->where('signatory_role_assignments.role', $key)
                        ->first(['signatories.cats_no', 'signatories.name']);

                    return [
                        'key' => $key,
                        'label' => $label,
                        'cats_no' => $assignment?->cats_no,
                        'name' => $assignment?->name,
                    ];
                })->values() : [],
            'systemUsers' => $catalog === 'signatories'
                ? User::query()->orderBy('name')->orderBy('username')
                    ->get(['id', 'name', 'username', 'is_active']) : [],
            'can' => [
                'create' => Gate::allows('libraries.create'),
                'update' => Gate::allows('libraries.update'),
                'delete' => Gate::allows('libraries.delete'),
                'sync' => Gate::allows('libraries.create') && Gate::allows('libraries.update'),
            ],
        ]);
    }

    public function store(Request $request, string $catalog): RedirectResponse|JsonResponse
    {
        Gate::authorize('libraries.create');
        $definition = $this->definition($catalog);
        $data = $this->validated($request, $catalog);
        if ($request->expectsJson() && ! in_array($catalog, ['labors', 'equipments'], true)) {
            abort(404);
        }
        if ($catalog === 'signatories') {
            $this->saveSignatory($data);

            return back()->with('success', 'Signatory created successfully.');
        }
        if (in_array($catalog, ['labors', 'categories'], true)) {
            $data['created_at'] = $data['updated_at'] = now();
        }
        if ($request->expectsJson()) {
            $id = DB::table($catalog)->insertGetId($data);

            return response()->json([
                'record' => [
                    'id' => $id,
                    ...collect($data)->only($definition['fields'])->all(),
                ],
            ], 201);
        }
        DB::table($catalog)->insert($data);

        return back()->with('success', 'Record created successfully.');
    }

    public function storeItemForDupa(Request $request): JsonResponse
    {
        Gate::authorize('libraries.create');
        $item = $this->validated($request, 'items');
        $details = $request->validate([
            'category_id' => [Rule::exists('categories', 'IDCATEGORY')],
            'price' => ['required', 'numeric', 'min:0', 'max:9999999999999.99', 'decimal:0,2'],
        ]);

        $id = DB::transaction(function () use ($item, $details): int {
            $id = DB::table('items')->insertGetId($item);
            DB::table('prices')->insert([
                'itemcode' => $item['itemcode'],
                'price' => $details['price'],
                'effective_from' => now()->toDateString(),
                'effective_to' => null,
            ]);

            return $id;
        });

        return response()->json([
            'record' => ['id' => $id, ...$item, 'price' => (float) $details['price']],
        ], 201);
    }

    public function update(Request $request, string $catalog, string $record): RedirectResponse
    {
        Gate::authorize('libraries.update');
        $this->find($catalog, $record);
        $data = $this->validated($request, $catalog, $record);
        if ($catalog === 'signatories') {
            $this->saveSignatory($data, $record);

            return back()->with('success', 'Signatory updated successfully.');
        }
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
        if ($catalog === 'signatories') {
            throw ValidationException::withMessages([
                'delete' => 'Signatories are retained for project history. Mark this person inactive instead.',
            ]);
        }
        if ($catalog === 'categories' && DB::table('items')->where('category_id', $record)->exists()) {
            throw ValidationException::withMessages(['delete' => 'This category is used by items and cannot be deleted.']);
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

    public function syncItems(Request $request, ItemSyncService $service): RedirectResponse
    {
        Gate::authorize('libraries.create');
        Gate::authorize('libraries.update');
        $data = $request->validate([
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['required', 'integer', 'distinct', Rule::exists('categories', 'IDCATEGORY')],
        ]);
        $count = $service->sync($data['categories']);

        return back()->with('item_sync', "Synced {$count} items successfully.");
    }

    private function key(string $catalog): string
    {
        return match ($catalog) {
            'categories' => 'IDCATEGORY',
            'signatories' => 'cats_no',
            default => 'id',
        };
    }

    private function latestPriceColumn(string $column): \Closure
    {
        return fn ($query) => $query->from('prices')
            ->select($column)
            ->whereColumn('prices.itemcode', 'items.itemcode')
            ->orderByDesc('prices.effective_from')
            ->orderByDesc('prices.id')
            ->limit(1);
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
            'items' => [
                'itemcode' => ['required', 'string', 'max:255', Rule::unique('items', 'itemcode')->ignore($record)],
                'category_id' => ['required', 'integer', 'min:1', 'max:4294967295'],
                'description' => ['required', 'string', 'max:10000'],
                'unit' => ['required', 'string', 'max:255'],
            ],
            'prices' => [
                'itemcode' => ['required', 'string', Rule::exists('items', 'itemcode')],
                'price' => ['required', 'numeric', 'min:0', 'max:9999999999999.99', 'decimal:0,2'],
                'effective_from' => ['required', 'date_format:Y-m-d'],
                'effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            ],
            'signatories' => [
                'cats_no' => ['required', 'string', 'max:64',
                    $record === null ? Rule::unique('signatories', 'cats_no') : Rule::in([(string) $record])],
                'name' => ['required', 'string', 'max:255'],
                'position' => ['required', 'string', 'max:255'],
                'user_id' => ['nullable', 'integer', Rule::exists('users', 'id'),
                    Rule::unique('signatories', 'user_id')->ignore($record, 'cats_no')],
                'is_active' => ['required', 'boolean'],
                'roles' => ['sometimes', 'array'],
                'roles.*' => ['required', 'string', 'distinct', Rule::in(array_keys(Signatory::ROLES))],
            ],
            default => throw new \InvalidArgumentException('Unknown resource catalog.'),
        });
    }

    /** @param array<string, mixed> $data */
    private function saveSignatory(array $data, ?string $record = null): void
    {
        DB::transaction(function () use ($data, $record): void {
            $roles = $data['is_active'] ? ($data['roles'] ?? []) : [];
            unset($data['roles']);

            if ($record === null) {
                if ($roles !== [] && DB::table('signatory_role_assignments')
                    ->whereIn('role', $roles)->lockForUpdate()->exists()) {
                    Gate::authorize('libraries.update');
                }

                DB::table('signatories')->insert($data);
                $catsNo = $data['cats_no'];
            } else {
                DB::table('signatories')->where('cats_no', $record)->update($data);
                $catsNo = $record;
            }

            $ownedRoles = DB::table('signatory_role_assignments')->where('cats_no', $catsNo);
            if ($roles === []) {
                $ownedRoles->delete();
            } else {
                $ownedRoles->whereNotIn('role', $roles)->delete();
            }

            foreach ($roles as $role) {
                DB::table('signatory_role_assignments')->updateOrInsert(
                    ['role' => $role],
                    ['cats_no' => $catsNo, 'updated_at' => now(), 'created_at' => now()],
                );
            }
        });
    }
}
