import { Head, router, useForm } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
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

type Source = {
    id: number;
    pay_item_no: string;
    suffix: string | null;
    description: string;
    thickness_sizes: string | null;
    class: string | null;
    others: string | null;
    unit: string;
    part: string | null;
    item_heading: string | null;
};
type Props = {
    records: { data: Source[]; links: PaginationLink[]; total: number };
    filters: { search: string; part: string };
    parts: string[];
    canImport: boolean;
    importMessage: string | null;
};

export default function DpwhDupaIndex({
    records,
    filters,
    parts,
    canImport,
    importMessage,
}: Props) {
    const [open, setOpen] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const search = useForm(filters);
    const form = useForm<{ file: File | null }>({ file: null });

    const close = () => {
        if (form.processing) {
            return;
        }

        setOpen(false);
        form.reset();
        form.clearErrors();

        if (input.current) {
            input.current.value = '';
        }
    };

    return (
        <>
            <Head title="DPWH DUPA" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="DPWH DUPA"
                    description="DPWH pay-item reference catalog"
                    action={
                        canImport ? (
                            <Button onClick={() => setOpen(true)}>
                                <Upload /> Import
                            </Button>
                        ) : undefined
                    }
                />
                {importMessage && (
                    <p
                        role="status"
                        className="rounded-lg border bg-muted p-4 text-sm"
                    >
                        {importMessage}
                    </p>
                )}
                <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.get('/admin/dpwh-dupa', search.data, {
                            preserveState: true,
                        });
                    }}
                >
                    <Input
                        aria-label="Search pay items"
                        className="max-w-sm"
                        placeholder="Search item number, description, or specifications"
                        value={search.data.search}
                        onChange={(event) =>
                            search.setData('search', event.target.value)
                        }
                    />
                    <select
                        aria-label="Filter by part"
                        className="h-9 max-w-full rounded-md border bg-background px-3 text-sm sm:max-w-md"
                        value={search.data.part}
                        onChange={(event) =>
                            search.setData('part', event.target.value)
                        }
                    >
                        <option value="">All parts</option>
                        {parts.map((part) => (
                            <option key={part} value={part}>
                                {part}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>
                <p className="text-sm text-muted-foreground">
                    {records.total.toLocaleString()} pay-item variants
                </p>
                {records.data.length === 0 ? (
                    <EmptyState message="No pay items found. Import a DPWH workbook to get started." />
                ) : (
                    <DataTable>
                        <thead className="bg-muted/50">
                            <tr>
                                {[
                                    'Pay item',
                                    'Suffix',
                                    'Description',
                                    'Thickness / Sizes',
                                    'Class',
                                    'Others',
                                    'Unit',
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className="px-4 py-3 font-medium"
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {records.data.map((record) => (
                                <tr
                                    key={record.id}
                                    className="hover:bg-muted/30"
                                >
                                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                                        {record.pay_item_no}
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.suffix || '—'}
                                    </td>
                                    <td className="min-w-80 px-4 py-3">
                                        <p>{record.description}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {record.part}
                                            {record.item_heading
                                                ? ` · ${record.item_heading}`
                                                : ''}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.thickness_sizes || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.class || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {record.others || '—'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {record.unit}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                )}
                <Pagination links={records.links} />
                <Dialog
                    open={open}
                    onOpenChange={(value) => {
                        if (value) {
                            setOpen(true);
                        } else {
                            close();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Import DPWH DUPA</DialogTitle>
                            <DialogDescription>
                                Upload a DPWH pay-item XLSX workbook (up to 20
                                MB). Reimporting the same filename updates its
                                matching source rows.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                form.post('/admin/dpwh-dupa/import', {
                                    forceFormData: true,
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        setOpen(false);
                                        form.reset();

                                        if (input.current) {
                                            input.current.value = '';
                                        }
                                    },
                                });
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="dupa-workbook">Workbook</Label>
                                <Input
                                    ref={input}
                                    id="dupa-workbook"
                                    type="file"
                                    accept=".xlsx"
                                    disabled={form.processing}
                                    onChange={(event) =>
                                        form.setData(
                                            'file',
                                            event.target.files?.[0] || null,
                                        )
                                    }
                                />
                                {form.errors.file && (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {form.errors.file}
                                    </p>
                                )}
                            </div>
                            {form.progress && (
                                <p role="status" className="text-sm">
                                    Uploading: {form.progress.percentage}%
                                </p>
                            )}
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={form.processing}
                                    onClick={close}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        !form.data.file || form.processing
                                    }
                                >
                                    {form.processing ? 'Importing…' : 'Import'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
