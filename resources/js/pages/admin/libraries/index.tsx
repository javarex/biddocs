import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import InputError from '@/components/input-error';
import MaterialSyncDialog from '@/components/material-sync-dialog';
import type { SyncCategory } from '@/components/material-sync-dialog';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RecordRow = { id: string | number; [key: string]: string | number | null };
type Props = {
    catalog: string;
    title: string;
    fields: string[];
    records: { data: RecordRow[]; links: PaginationLink[]; total: number };
    filters: { search: string };
    materials: { itemcode: string; description: string }[];
    categories: SyncCategory[];
    syncMessage?: string | null;
    can: { create: boolean; update: boolean; delete: boolean; sync: boolean };
};
const labels: Record<string, string> = {
    IDCATEGORY: 'Category ID',
    fccode: 'FC code',
    CATEGORY_DESCRIPTION: 'Category description',
    is_active: 'Status',
    manpower: 'Manpower',
    rates: 'Rates',
    types: 'Type',
    equipment: 'Equipment',
    rental: 'Rental',
    itemcode: 'Item code',
    category_id: 'Category ID',
    description: 'Description',
    unit: 'Unit',
    price: 'Price',
    effective_from: 'Effective from',
    effective_to: 'Effective to',
    cats_no: 'CATS number',
    name: 'Name',
    position: 'Position',
};

export default function LibraryPage(props: Props) {
    return <Library key={props.catalog} {...props} />;
}

function Library({
    catalog,
    title,
    fields,
    records,
    filters,
    materials,
    syncMessage,
    categories,
    can,
}: Props) {
    const url = `/admin/libraries/${catalog}`;
    const categoryDescriptions = new Map(
        categories.map((category) => [
            category.IDCATEGORY,
            category.CATEGORY_DESCRIPTION,
        ]),
    );
    const [search, setSearch] = useState(filters.search);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<string | number | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const syncForm = useForm<Record<string, string>>({});
    const form = useForm<Record<string, string>>(
        Object.fromEntries(fields.map((field) => [field, ''])),
    );
    const showForm = (record?: RecordRow) => {
        setEditing(record?.id ?? null);
        form.clearErrors();
        form.setData(
            Object.fromEntries(
                fields.map((field) => [
                    field,
                    String(
                        record?.[field] ?? (field === 'is_active' ? '1' : ''),
                    ),
                ]),
            ),
        );
        setOpen(true);
    };

    return (
        <>
            <Head title={`${title} library`} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={title}
                    description={`Manage the ${title.toLowerCase()} library.`}
                    action={
                        <div className="flex gap-2">
                            {catalog === 'categories' && can.sync && (
                                <Button
                                    variant="outline"
                                    disabled={syncForm.processing}
                                    onClick={() =>
                                        syncForm.post(`${url}/sync`, {
                                            preserveScroll: true,
                                        })
                                    }
                                >
                                    {syncForm.processing
                                        ? 'Syncing…'
                                        : 'Sync categories'}
                                </Button>
                            )}
                            {catalog === 'materials' && can.sync && (
                                <MaterialSyncDialog categories={categories} />
                            )}
                            {can.create && (
                                <Button onClick={() => showForm()}>
                                    Add record
                                </Button>
                            )}
                        </div>
                    }
                />
                <form
                    className="flex max-w-lg gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.get(
                            url,
                            { search },
                            { preserveState: true, replace: true },
                        );
                    }}
                >
                    <Input
                        aria-label={`Search ${title}`}
                        placeholder={`Search ${title.toLowerCase()}…`}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>
                <InputError message={deleteError} />
                <InputError message={syncForm.errors.sync} />
                {syncMessage && (
                    <p
                        role="status"
                        className="text-sm text-green-700 dark:text-green-400"
                    >
                        {syncMessage}
                    </p>
                )}
                <p className="text-sm text-muted-foreground">
                    {records.total} records
                </p>
                {records.data.length ? (
                    <DataTable>
                        <thead className="bg-muted/50">
                            <tr>
                                {fields.map((field) => (
                                    <th
                                        key={field}
                                        className="px-4 py-3 font-medium"
                                    >
                                        {field === 'category_id'
                                            ? 'Category'
                                            : labels[field]}
                                    </th>
                                ))}
                                {(can.update || can.delete) && (
                                    <th className="px-4 py-3 font-medium">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {records.data.map((record) => (
                                <tr key={record.id}>
                                    {fields.map((field) => (
                                        <td
                                            key={field}
                                            className="max-w-md px-4 py-3 whitespace-normal"
                                        >
                                            {field === 'is_active'
                                                ? Number(record[field]) === 1
                                                    ? 'Active'
                                                    : 'Inactive'
                                                : field === 'category_id'
                                                  ? (categoryDescriptions.get(
                                                        Number(record[field]),
                                                    ) ?? 'Unknown category')
                                                  : (record[field] ?? '—')}
                                        </td>
                                    ))}
                                    {(can.update || can.delete) && (
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {can.update && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            showForm(record)
                                                        }
                                                    >
                                                        Edit
                                                    </Button>
                                                )}
                                                {can.delete && (
                                                    <ConfirmDialog
                                                        title="Delete record?"
                                                        description="This permanently deletes the selected library record. Records in use cannot be deleted."
                                                        confirmLabel="Delete"
                                                        destructive
                                                        onConfirm={() => {
                                                            setDeleteError('');
                                                            router.delete(
                                                                `${url}/${record.id}`,
                                                                {
                                                                    preserveScroll: true,
                                                                    onError: (
                                                                        errors,
                                                                    ) =>
                                                                        setDeleteError(
                                                                            errors.delete ??
                                                                                'Unable to delete this record.',
                                                                        ),
                                                                },
                                                            );
                                                        }}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                        >
                                                            Delete
                                                        </Button>
                                                    </ConfirmDialog>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                ) : (
                    <EmptyState message="No records found." />
                )}
                <Pagination links={records.links} />
            </div>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!form.processing) {
                        setOpen(value);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Edit' : 'Add'} {title.toLowerCase()}{' '}
                            record
                        </DialogTitle>
                        <DialogDescription>
                            Enter the library details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const options = {
                                preserveScroll: true,
                                onSuccess: () => setOpen(false),
                            };

                            if (editing) {
                                form.put(`${url}/${editing}`, options);
                            } else {
                                form.post(url, options);
                            }
                        }}
                    >
                        {fields.map((field) => {
                            const options =
                                field === 'is_active'
                                    ? [
                                          { value: '1', label: 'Active' },
                                          { value: '0', label: 'Inactive' },
                                      ]
                                    : field === 'types'
                                      ? [
                                            {
                                                value: 'Contract',
                                                label: 'Contract',
                                            },
                                            { value: 'Admin', label: 'Admin' },
                                        ]
                                      : field === 'itemcode' &&
                                          catalog === 'prices'
                                        ? materials.map((material) => ({
                                              value: material.itemcode,
                                              label: `${material.itemcode} — ${material.description}`,
                                          }))
                                        : null;

                            return (
                                <div key={field} className="space-y-2">
                                    <Label htmlFor={field}>
                                        {labels[field]}
                                        {['effective_to', 'fccode'].includes(
                                            field,
                                        )
                                            ? ' (optional)'
                                            : ''}
                                    </Label>
                                    {options ? (
                                        <select
                                            id={field}
                                            required
                                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                            value={form.data[field]}
                                            onChange={(event) =>
                                                form.setData(
                                                    field,
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select{' '}
                                                {labels[field].toLowerCase()}
                                            </option>
                                            {options.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : [
                                          'description',
                                          'CATEGORY_DESCRIPTION',
                                      ].includes(field) ? (
                                        <textarea
                                            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                            id={field}
                                            required
                                            value={form.data[field]}
                                            onChange={(event) =>
                                                form.setData(
                                                    field,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    ) : (
                                        <Input
                                            id={field}
                                            required={
                                                ![
                                                    'effective_to',
                                                    'fccode',
                                                ].includes(field)
                                            }
                                            readOnly={
                                                [
                                                    'IDCATEGORY',
                                                    'cats_no',
                                                ].includes(field) &&
                                                editing !== null
                                            }
                                            type={
                                                field.startsWith('effective_')
                                                    ? 'date'
                                                    : [
                                                            'rates',
                                                            'rental',
                                                            'price',
                                                            'category_id',
                                                            'IDCATEGORY',
                                                        ].includes(field)
                                                      ? 'number'
                                                      : 'text'
                                            }
                                            min={
                                                [
                                                    'category_id',
                                                    'IDCATEGORY',
                                                ].includes(field)
                                                    ? 1
                                                    : field === 'effective_to'
                                                      ? form.data.effective_from
                                                      : [
                                                              'rates',
                                                              'rental',
                                                              'price',
                                                          ].includes(field)
                                                        ? 0
                                                        : undefined
                                            }
                                            step={
                                                [
                                                    'category_id',
                                                    'IDCATEGORY',
                                                ].includes(field)
                                                    ? '1'
                                                    : field === 'price'
                                                      ? '0.01'
                                                      : 'any'
                                            }
                                            value={form.data[field]}
                                            onChange={(event) =>
                                                form.setData(
                                                    field,
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    )}
                                    {['category_id', 'IDCATEGORY'].includes(
                                        field,
                                    ) && (
                                        <p className="text-xs text-muted-foreground">
                                            Enter the numeric category ID.
                                        </p>
                                    )}
                                    {catalog === 'prices' &&
                                        field === 'itemcode' &&
                                        materials.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Create a material in the
                                                Materials library first.
                                            </p>
                                        )}
                                    <InputError message={form.errors[field]} />
                                </div>
                            );
                        })}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={form.processing}
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing ? 'Saving…' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
