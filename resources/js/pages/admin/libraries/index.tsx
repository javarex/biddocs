import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import InputError from '@/components/input-error';
import ItemSyncDialog from '@/components/item-sync-dialog';
import type { SyncCategory } from '@/components/item-sync-dialog';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

type RecordValue = string | number | boolean | string[] | null;
type RecordRow = { id: string | number; [key: string]: RecordValue };
type SignatoryRole = {
    key: string;
    label: string;
    cats_no: string | null;
    name: string | null;
};
type SystemUser = {
    id: number;
    name: string;
    username: string;
    is_active: boolean;
};
type Props = {
    catalog: string;
    title: string;
    fields: string[];
    displayFields: string[];
    records: { data: RecordRow[]; links: PaginationLink[]; total: number };
    filters: { search: string };
    items: { itemcode: string; description: string }[];
    categories: SyncCategory[];
    signatoryRoles: SignatoryRole[];
    systemUsers: SystemUser[];
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
    unit_cost: 'Unit Cost',
    effective_from: 'Effective from',
    effective_to: 'Effective to',
    cats_no: 'CATS number',
    name: 'Name',
    position: 'Position',
    user_id: 'Linked user account',
    roles: 'Current roles',
};

const recordRoles = (record: RecordRow): string[] =>
    Array.isArray(record.roles) ? record.roles : [];

export default function LibraryPage(props: Props) {
    return <Library key={props.catalog} {...props} />;
}

function Library({
    catalog,
    title,
    fields,
    displayFields,
    records,
    filters,
    items,
    syncMessage,
    categories,
    signatoryRoles,
    systemUsers,
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
    const form = useForm<Record<string, string | string[]>>(
        Object.fromEntries(
            fields.map((field) => [field, field === 'roles' ? [] : '']),
        ),
    );
    const showForm = (record?: RecordRow) => {
        setEditing(record?.id ?? null);
        form.clearErrors();
        form.setData(
            Object.fromEntries(
                fields.map((field) => [
                    field,
                    field === 'roles'
                        ? record
                            ? recordRoles(record)
                            : []
                        : String(
                              record?.[field] ??
                                  (field === 'is_active' ? '1' : ''),
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
                            {catalog === 'items' && can.sync && (
                                <ItemSyncDialog categories={categories} />
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
                                {displayFields.map((field) => (
                                    <th
                                        key={field}
                                        className="px-4 py-3 font-medium"
                                    >
                                        {field === 'category_id'
                                            ? 'Category'
                                            : labels[field]}
                                    </th>
                                ))}
                                {(can.update ||
                                    (can.delete &&
                                        catalog !== 'signatories')) && (
                                    <th className="px-4 py-3 font-medium">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {records.data.map((record) => (
                                <tr key={record.id}>
                                    {displayFields.map((field) => (
                                        <td
                                            key={field}
                                            className="max-w-md px-4 py-3 whitespace-normal"
                                        >
                                            {field === 'roles' ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {recordRoles(record)
                                                        .length ? (
                                                        recordRoles(record).map(
                                                            (role) => (
                                                                <Badge
                                                                    key={role}
                                                                    variant="secondary"
                                                                >
                                                                    {signatoryRoles.find(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.key ===
                                                                            role,
                                                                    )?.label ??
                                                                        role}
                                                                </Badge>
                                                            ),
                                                        )
                                                    ) : (
                                                        <span>—</span>
                                                    )}
                                                </div>
                                            ) : field === 'is_active' ? (
                                                <StatusBadge
                                                    active={
                                                        Number(
                                                            record[field],
                                                        ) === 1
                                                    }
                                                />
                                            ) : field === 'user_id' ? (
                                                (systemUsers.find(
                                                    (user) =>
                                                        user.id ===
                                                        Number(record[field]),
                                                )?.username ?? '—')
                                            ) : field === 'category_id' ? (
                                                (categoryDescriptions.get(
                                                    Number(record[field]),
                                                ) ?? 'Unknown category')
                                            ) : field === 'unit_cost' &&
                                              record[field] !== null ? (
                                                Number(
                                                    record[field],
                                                ).toLocaleString('en-PH', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                            ) : (
                                                String(record[field] ?? '—')
                                            )}
                                        </td>
                                    ))}
                                    {(can.update ||
                                        (can.delete &&
                                            catalog !== 'signatories')) && (
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
                                                {catalog === 'signatories' &&
                                                    can.update && (
                                                        <ConfirmDialog
                                                            title={`${Number(record.is_active) === 1 ? 'Deactivate' : 'Activate'} signatory?`}
                                                            description={
                                                                Number(
                                                                    record.is_active,
                                                                ) === 1
                                                                    ? 'This person will no longer be available for new projects. Existing projects keep their assignment.'
                                                                    : 'This person will be available in the library again. Assign role tags separately as needed.'
                                                            }
                                                            confirmLabel={
                                                                Number(
                                                                    record.is_active,
                                                                ) === 1
                                                                    ? 'Deactivate'
                                                                    : 'Activate'
                                                            }
                                                            onConfirm={() =>
                                                                router.put(
                                                                    `${url}/${record.id}`,
                                                                    {
                                                                        cats_no:
                                                                            record.cats_no,
                                                                        name: record.name,
                                                                        position:
                                                                            record.position,
                                                                        user_id:
                                                                            record.user_id,
                                                                        is_active:
                                                                            Number(
                                                                                record.is_active,
                                                                            ) ===
                                                                            1
                                                                                ? '0'
                                                                                : '1',
                                                                        roles:
                                                                            Number(
                                                                                record.is_active,
                                                                            ) ===
                                                                            1
                                                                                ? []
                                                                                : recordRoles(
                                                                                      record,
                                                                                  ),
                                                                    },
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                            >
                                                                {Number(
                                                                    record.is_active,
                                                                ) === 1
                                                                    ? 'Deactivate'
                                                                    : 'Activate'}
                                                            </Button>
                                                        </ConfirmDialog>
                                                    )}
                                                {can.delete &&
                                                    catalog !==
                                                        'signatories' && (
                                                        <ConfirmDialog
                                                            title="Delete record?"
                                                            description="This permanently deletes the selected library record. Records in use cannot be deleted."
                                                            confirmLabel="Delete"
                                                            destructive
                                                            onConfirm={() => {
                                                                setDeleteError(
                                                                    '',
                                                                );
                                                                router.delete(
                                                                    `${url}/${record.id}`,
                                                                    {
                                                                        preserveScroll: true,
                                                                        onError:
                                                                            (
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
                            if (field === 'roles') {
                                const selectedRoles = Array.isArray(
                                    form.data.roles,
                                )
                                    ? form.data.roles
                                    : [];

                                return (
                                    <div key={field} className="space-y-3">
                                        <Label>{labels[field]}</Label>
                                        <div className="space-y-3 rounded-md border p-3">
                                            {signatoryRoles.map((role) => {
                                                const checked =
                                                    selectedRoles.includes(
                                                        role.key,
                                                    );
                                                const replacement =
                                                    checked &&
                                                    role.cats_no !== null &&
                                                    role.cats_no !==
                                                        String(editing ?? '');
                                                const replacementBlocked =
                                                    !can.update &&
                                                    role.cats_no !== null &&
                                                    role.cats_no !==
                                                        String(editing ?? '');

                                                return (
                                                    <div
                                                        key={role.key}
                                                        className="space-y-1"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`role-${role.key}`}
                                                                checked={
                                                                    checked
                                                                }
                                                                disabled={
                                                                    form.data
                                                                        .is_active ===
                                                                        '0' ||
                                                                    replacementBlocked
                                                                }
                                                                onCheckedChange={(
                                                                    value,
                                                                ) =>
                                                                    form.setData(
                                                                        'roles',
                                                                        value
                                                                            ? [
                                                                                  ...selectedRoles,
                                                                                  role.key,
                                                                              ]
                                                                            : selectedRoles.filter(
                                                                                  (
                                                                                      selected,
                                                                                  ) =>
                                                                                      selected !==
                                                                                      role.key,
                                                                              ),
                                                                    )
                                                                }
                                                            />
                                                            <Label
                                                                htmlFor={`role-${role.key}`}
                                                                className="font-normal"
                                                            >
                                                                {role.label}
                                                            </Label>
                                                        </div>
                                                        {replacement && (
                                                            <p className="pl-6 text-xs text-amber-700 dark:text-amber-400">
                                                                Replaces{' '}
                                                                {role.name ??
                                                                    role.cats_no}{' '}
                                                                as the current
                                                                role holder.
                                                            </p>
                                                        )}
                                                        {replacementBlocked && (
                                                            <p className="pl-6 text-xs text-muted-foreground">
                                                                Update
                                                                permission is
                                                                required to
                                                                replace{' '}
                                                                {role.name ??
                                                                    role.cats_no}
                                                                .
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {form.data.is_active === '0' && (
                                                <p className="text-xs text-muted-foreground">
                                                    Inactive signatories cannot
                                                    hold current roles.
                                                </p>
                                            )}
                                        </div>
                                        <InputError
                                            message={form.errors.roles}
                                        />
                                    </div>
                                );
                            }

                            const options =
                                field === 'user_id'
                                    ? systemUsers.map((user) => ({
                                          value: String(user.id),
                                          label: `${user.name} (${user.username})${user.is_active ? '' : ' — inactive'}`,
                                      }))
                                    : field === 'is_active'
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
                                              {
                                                  value: 'Admin',
                                                  label: 'Admin',
                                              },
                                          ]
                                        : field === 'itemcode' &&
                                            catalog === 'prices'
                                          ? items.map((item) => ({
                                                value: item.itemcode,
                                                label: `${item.itemcode} — ${item.description}`,
                                            }))
                                          : null;

                            return (
                                <div key={field} className="space-y-2">
                                    <Label htmlFor={field}>
                                        {labels[field]}
                                        {[
                                            'effective_to',
                                            'fccode',
                                            'user_id',
                                        ].includes(field)
                                            ? ' (optional)'
                                            : ''}
                                    </Label>
                                    {options ? (
                                        <select
                                            id={field}
                                            required={field !== 'user_id'}
                                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                            value={String(
                                                form.data[field] ?? '',
                                            )}
                                            onChange={(event) => {
                                                form.setData(
                                                    field,
                                                    event.target.value,
                                                );

                                                if (
                                                    field === 'is_active' &&
                                                    event.target.value === '0'
                                                ) {
                                                    form.setData('roles', []);
                                                }
                                            }}
                                        >
                                            <option value="">
                                                {field === 'user_id'
                                                    ? 'No linked user account'
                                                    : `Select ${labels[field].toLowerCase()}`}
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
                                            value={String(
                                                form.data[field] ?? '',
                                            )}
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
                                                      ? String(
                                                            form.data
                                                                .effective_from ??
                                                                '',
                                                        )
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
                                            value={String(
                                                form.data[field] ?? '',
                                            )}
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
                                        items.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Create an item in the Items
                                                library first.
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
