<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBidDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('projects.bid_docs.edit') === true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'revision' => ['required', 'integer', 'min:0'],
            'edits' => ['required', 'array', 'min:1', 'max:3000'],
            'edits.*' => ['nullable', 'string', 'max:20000'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (array_keys((array) $this->input('edits', [])) as $key) {
                    if (! preg_match('/^BDS_EDIT_[1-9][0-9]*$/', (string) $key)) {
                        $validator->errors()->add('edits', 'The document contains an invalid editable paragraph reference.');

                        break;
                    }
                }
            },
        ];
    }
}
