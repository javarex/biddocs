import { Head, router, useForm } from '@inertiajs/react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type Failure = {
    worksheet: string;
    excel_row: number;
    original_values: Record<string, unknown>;
    field_or_column: string | null;
    error_reason: string;
    suggested_correction: string | null;
};
type Preview = {
    id: number;
    status: string;
    original_filename: string;
    import_mode: string;
    total_rows: number;
    imported_rows: number;
    updated_rows: number;
    duplicate_rows: number;
    skipped_rows: number;
    failed_rows: number;
    metadata: {
        worksheet?: string;
        project?: Record<string, unknown>;
        valid_rows?: number;
        new_rows?: number;
        existing_rows?: number;
        sample_rows?: Array<Record<string, unknown>>;
    };
    failures: Failure[];
};
type History = Omit<Preview, 'metadata' | 'failures'> & {
    importer: { id: number; name: string } | null;
    project: { id: number; project_code: string; project_name: string } | null;
    completed_at: string | null;
};
type Props = {
    histories: { data: History[]; links: PaginationLink[] };
    preview?: Preview | null;
    targetProject?: {
        id: number;
        project_code: string;
        project_name: string;
        location: string;
        contract_duration: number;
    } | null;
};

function formatBytes(bytes: number) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ImportsIndex({
    histories,
    preview,
    targetProject,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const form = useForm<{ file: File | null; mode: string }>({
        file: null,
        mode: 'insert',
    });

    const selectFile = (file: File | null) => {
        if (!file) {
            return;
        }

        setSelectedFile(file);
        form.setData('file', file);
    };
    const submitPreview = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(
            targetProject
                ? `/admin/projects/${targetProject.id}/import/preview`
                : '/admin/imports/preview',
            {
                forceFormData: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <Head title={targetProject ? 'Project Import' : 'Excel Imports'} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={targetProject ? 'Project Import' : 'Excel Imports'}
                    description={
                        targetProject
                            ? `Import additional or updated items into ${targetProject.project_name}.`
                            : 'Preview and import procurement bid documents from .xlsx or .xlsm workbooks.'
                    }
                />

                {targetProject && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{targetProject.project_name}</CardTitle>
                            <CardDescription>
                                {targetProject.project_code} ·{' '}
                                {targetProject.location} ·{' '}
                                {targetProject.contract_duration} days
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Upload workbook</CardTitle>
                        <CardDescription>
                            The source workbook is stored privately and is never
                            overwritten. Maximum size: 50 MB.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitPreview} className="space-y-5">
                            <div
                                className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition hover:border-primary"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    selectFile(
                                        event.dataTransfer.files[0] ?? null,
                                    );
                                }}
                                onClick={() => inputRef.current?.click()}
                            >
                                <FileSpreadsheet className="mx-auto mb-3 size-10 text-muted-foreground" />
                                <p className="font-medium">
                                    Drop an Excel workbook here or click to
                                    browse
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Accepted formats: .xlsx and .xlsm
                                </p>
                                <Input
                                    ref={inputRef}
                                    type="file"
                                    accept=".xlsx,.xlsm"
                                    className="hidden"
                                    onChange={(event) =>
                                        selectFile(
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                />
                            </div>
                            {selectedFile && (
                                <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3 text-sm">
                                    <span>
                                        {selectedFile.name} (
                                        {formatBytes(selectedFile.size)})
                                    </span>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            form.setData('file', null);

                                            if (inputRef.current) {
                                                inputRef.current.value = '';
                                            }
                                        }}
                                    >
                                        <X />
                                    </Button>
                                </div>
                            )}
                            {form.errors.file && (
                                <p className="text-sm text-destructive">
                                    {form.errors.file}
                                </p>
                            )}
                            {form.progress && (
                                <p className="text-sm text-muted-foreground">
                                    Upload progress: {form.progress.percentage}%
                                </p>
                            )}
                            <div className="max-w-md space-y-2">
                                <Label>Import mode</Label>
                                <Select
                                    value={form.data.mode}
                                    onValueChange={(value) =>
                                        form.setData('mode', value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="insert">
                                            Insert new records only
                                        </SelectItem>
                                        <SelectItem value="update">
                                            Update existing records only
                                        </SelectItem>
                                        <SelectItem value="upsert">
                                            Insert new and update existing
                                            records
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.errors.mode && (
                                <p className="text-sm text-destructive">
                                    {form.errors.mode}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={!selectedFile || form.processing}
                                >
                                    <Upload />{' '}
                                    {form.processing
                                        ? 'Validating…'
                                        : 'Preview import'}
                                </Button>
                                {selectedFile && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            form.reset();
                                        }}
                                    >
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {preview && (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Preview: {preview.original_filename}
                            </CardTitle>
                            <CardDescription>
                                Worksheet {preview.metadata.worksheet ?? '—'} ·
                                Mode: {preview.import_mode}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                {[
                                    ['Detected', preview.total_rows],
                                    ['Valid', preview.metadata.valid_rows ?? 0],
                                    ['New', preview.metadata.new_rows ?? 0],
                                    [
                                        'Existing',
                                        preview.metadata.existing_rows ?? 0,
                                    ],
                                    [
                                        'Failed',
                                        preview.failed_rows +
                                            preview.duplicate_rows,
                                    ],
                                ].map(([label, value]) => (
                                    <div
                                        key={label}
                                        className="rounded-md border p-3"
                                    >
                                        <p className="text-xs text-muted-foreground">
                                            {label}
                                        </p>
                                        <p className="text-2xl font-semibold">
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <ConfirmDialog
                                    title="Commit this import?"
                                    description="Valid rows will be written using the selected mode. Invalid and duplicate rows will remain in the error report."
                                    confirmLabel="Commit import"
                                    onConfirm={() =>
                                        router.post(
                                            `/admin/imports/${preview.id}/commit`,
                                        )
                                    }
                                >
                                    <Button
                                        disabled={
                                            preview.metadata.valid_rows === 0
                                        }
                                    >
                                        Commit import
                                    </Button>
                                </ConfirmDialog>
                                <Button
                                    variant="outline"
                                    onClick={() => router.get('/admin/imports')}
                                >
                                    <X /> Clear preview
                                </Button>
                            </div>
                            {preview.failures.length > 0 && (
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="px-3 py-2">
                                                    Row
                                                </th>
                                                <th className="px-3 py-2">
                                                    Field
                                                </th>
                                                <th className="px-3 py-2">
                                                    Reason
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {preview.failures.map((failure) => (
                                                <tr
                                                    key={`${failure.excel_row}-${failure.error_reason}`}
                                                >
                                                    <td className="px-3 py-2">
                                                        {failure.excel_row}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {failure.field_or_column ??
                                                            '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {failure.error_reason}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Import history</CardTitle>
                        <CardDescription>
                            Previous validation and processing results.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {histories.data.length === 0 ? (
                            <EmptyState message="No imports have been run yet." />
                        ) : (
                            <DataTable>
                                <thead className="bg-muted/50">
                                    <tr>
                                        {[
                                            'File',
                                            'Project',
                                            'Mode',
                                            'Status',
                                            'Rows',
                                            'Result',
                                            'Errors',
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
                                    {histories.data.map((history) => (
                                        <tr key={history.id}>
                                            <td className="px-4 py-3">
                                                {history.original_filename}
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.project
                                                    ?.project_name ??
                                                    'Auto-detected'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.import_mode}
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.status}
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.total_rows}
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.imported_rows} inserted
                                                / {history.updated_rows} updated
                                            </td>
                                            <td className="px-4 py-3">
                                                {history.failed_rows +
                                                    history.duplicate_rows >
                                                0 ? (
                                                    <a
                                                        className="text-primary underline"
                                                        href={`/admin/imports/${history.id}/errors`}
                                                    >
                                                        {history.failed_rows +
                                                            history.duplicate_rows}{' '}
                                                        rows
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                        )}
                        <div className="mt-4">
                            <Pagination links={histories.links} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ImportsIndex.layout = {
    breadcrumbs: [{ title: 'Excel Imports', href: '/admin/imports' }],
};
