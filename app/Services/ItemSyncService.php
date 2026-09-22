<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ItemSyncService
{
    /** @param list<int> $categories */
    public function sync(array $categories): int
    {
        $baseUrl = rtrim((string) config('services.pis.url'), '/');
        if (! filter_var($baseUrl, FILTER_VALIDATE_URL) || ! in_array(parse_url($baseUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            $this->fail('Configure a valid PIS_URL before syncing items.');
        }
        try {
            $response = Http::acceptJson()->asJson()->connectTimeout(5)->timeout(60)
                ->post($baseUrl.'/api/item/list/by-categories', ['categories' => array_map('intval', $categories)]);
        } catch (ConnectionException $exception) {
            $this->fail('Unable to connect to PIS. Check PIS_URL and try again.');
        }
        if (! $response->successful()) {
            $this->fail('PIS returned HTTP '.$response->status().'. No items were synced.');
        }
        $payload = $response->json();
        $rows = is_array($payload) ? ($payload['data'] ?? $payload) : null;
        if (! is_array($rows) || ! array_is_list($rows)) {
            $this->fail('PIS returned an invalid item list. No items were synced.');
        }
        if (data_get($payload, 'next_page_url') || data_get($payload, 'links.next')
            || (int) data_get($payload, 'last_page', 1) > 1
            || (int) data_get($payload, 'meta.last_page', 1) > 1) {
            $this->fail('PIS returned a paginated list. The item endpoint must return the complete list.');
        }
        $rows = array_map(function ($row) {
            if (is_array($row)) {
                foreach (['ITEMCODE', 'DESCRIPTION', 'UNIT', 'effective_from', 'effective_to'] as $field) {
                    if (is_string($row[$field] ?? null)) {
                        $row[$field] = trim($row[$field]);
                    }
                }
            }

            return $row;
        }, $rows);
        $existingUnits = DB::table('items')
            ->whereIn('itemcode', collect($rows)
                ->filter(fn ($row): bool => is_array($row) && is_string($row['ITEMCODE'] ?? null))
                ->pluck('ITEMCODE')
                ->unique())
            ->pluck('unit', 'itemcode');
        $rows = array_map(function ($row) use ($existingUnits) {
            if (is_array($row) && blank($row['UNIT'] ?? null)) {
                $row['UNIT'] = $existingUnits->get($row['ITEMCODE'] ?? '') ?: 'N/A';
            }

            return $row;
        }, $rows);
        $validator = Validator::make(['items' => $rows], [
            'items' => ['present', 'array'],
            'items.*' => ['required', 'array'],
            'items.*.ITEMCODE' => ['required', 'string', 'max:255', 'distinct:ignore_case'],
            'items.*.IDCATEGORY' => ['required', 'integer', Rule::in($categories)],
            'items.*.DESCRIPTION' => ['required', 'string', 'max:10000'],
            'items.*.UNIT' => ['required', 'string', 'max:255'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
            'items.*.effective_from' => ['required', 'date_format:Y-m-d'],
            'items.*.effective_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:items.*.effective_from'],
        ]);
        if ($validator->fails()) {
            $this->fail('PIS returned invalid item data: '.$validator->errors()->first().' No items were synced.');
        }
        DB::transaction(function () use ($rows): void {
            $records = array_map(fn (array $row): array => [
                'itemcode' => $row['ITEMCODE'],
                'category_id' => (int) $row['IDCATEGORY'],
                'description' => $row['DESCRIPTION'],
                'unit' => $row['UNIT'],
            ], $rows);
            foreach (array_chunk($records, 200) as $chunk) {
                DB::table('items')->upsert($chunk, ['itemcode'], ['category_id', 'description', 'unit']);
            }
            foreach ($rows as $row) {
                DB::table('prices')->insert([
                    'itemcode' => $row['ITEMCODE'],
                    'price' => $row['price'],
                    'effective_from' => $row['effective_from'],
                    'effective_to' => filled($row['effective_to'] ?? null) ? $row['effective_to'] : null,
                ]);
            }
        });

        return count($rows);
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['sync' => $message]);
    }
}
