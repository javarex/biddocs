<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class CategorySyncService
{
    public function sync(): int
    {
        $baseUrl = rtrim((string) config('services.pis.url'), '/');
        if (! filter_var($baseUrl, FILTER_VALIDATE_URL) || ! in_array(parse_url($baseUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            $this->fail('Configure a valid PIS_URL before syncing categories.');
        }

        try {
            $response = Http::acceptJson()->connectTimeout(5)->timeout(30)
                ->get($baseUrl.'/api/item/categories');
        } catch (ConnectionException $exception) {
            $this->fail('Unable to connect to PIS. Check PIS_URL and try again.');
        }

        if (! $response->successful()) {
            $this->fail('PIS returned HTTP '.$response->status().'. No categories were synced.');
        }

        $payload = $response->json();
        $rows = is_array($payload) ? ($payload['data'] ?? $payload) : null;
        if (! is_array($rows) || ! array_is_list($rows)) {
            $this->fail('PIS returned an invalid category list. No categories were synced.');
        }
        // Do not silently import just the first page of a paginated response.
        if (data_get($payload, 'next_page_url') || data_get($payload, 'links.next')
            || (int) data_get($payload, 'last_page', 1) > 1
            || (int) data_get($payload, 'meta.last_page', 1) > 1) {
            $this->fail('PIS returned a paginated list. The category endpoint must return the complete list.');
        }

        $rows = array_map(function ($row) {
            if (is_array($row) && is_string($row['CATEGORY_DESCRIPTION'] ?? null)) {
                $row['CATEGORY_DESCRIPTION'] = trim($row['CATEGORY_DESCRIPTION']);
            }

            return $row;
        }, $rows);
        $validator = Validator::make(['categories' => $rows], [
            'categories' => ['present', 'array'],
            'categories.*' => ['required', 'array'],
            'categories.*.IDCATEGORY' => ['required', 'integer', 'min:1', 'max:4294967295', 'distinct'],
            'categories.*.CATEGORY_DESCRIPTION' => ['required', 'string', 'max:255'],
            'categories.*.fccode' => ['sometimes', 'nullable', 'string', 'max:255'],
            'categories.*.is_active' => ['present', 'nullable', 'boolean'],
        ]);
        if ($validator->fails()) {
            $this->fail('PIS returned invalid category data: '.$validator->errors()->first().' No categories were synced.');
        }

        DB::transaction(function () use ($rows): void {
            $now = now();
            // Null means PIS has not specified a status. Omit it so inserts use
            // the table default and updates preserve the locally stored status.
            $groups = [];
            foreach ($rows as $row) {
                $record = [
                    'IDCATEGORY' => (int) $row['IDCATEGORY'],
                    'CATEGORY_DESCRIPTION' => $row['CATEGORY_DESCRIPTION'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $updates = ['CATEGORY_DESCRIPTION', 'updated_at'];
                if ($row['is_active'] !== null) {
                    $record['is_active'] = (bool) $row['is_active'];
                    $updates[] = 'is_active';
                }
                if (array_key_exists('fccode', $row)) {
                    $record['fccode'] = $row['fccode'];
                    $updates[] = 'fccode';
                }
                $group = implode(',', $updates);
                $groups[$group]['updates'] = $updates;
                $groups[$group]['records'][] = $record;
            }
            foreach ($groups as $group) {
                $updates = $group['updates'];
                $records = $group['records'];
                foreach (array_chunk($records, 200) as $chunk) {
                    DB::table('categories')->upsert($chunk, ['IDCATEGORY'], $updates);
                }
            }
        });

        return count($rows);
    }

    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['sync' => $message]);
    }
}
