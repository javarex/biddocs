<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class StoreImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('imports.create') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                File::types(['xlsx', 'xlsm'])->max(50 * 1024),
            ],
            'mode' => ['required', 'string', 'in:insert,update,upsert'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Choose an Excel workbook to import.',
            'file.mimes' => 'Only .xlsx and .xlsm workbooks are supported.',
            'mode.in' => 'Choose insert-only, update-existing, or insert-or-update.',
        ];
    }
}
