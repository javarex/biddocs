import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import DataTable from '@/components/data-table';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Template = {
    id: number;
    name: string;
    is_excluded: boolean | number;
    creator: { name: string } | null;
    project: { project_code: string | null; project_name: string };
};

export default function BackupTemplates({
    templates,
    filters,
}: {
    templates: { data: Template[]; links: PaginationLink[] };
    filters: { search: string; status: string };
}) {
    const form = useForm(filters);
    const [pending, setPending] = useState<number | null>(null);
    function toggle(template: Template) {
        router.post(
            `/admin/backup-templates/${template.id}/visibility`,
            { excluded: !template.is_excluded },
            {
                preserveScroll: true,
                onStart: () => setPending(template.id),
                onFinish: () => setPending(null),
            },
        );
    }

    return (
        <>
            <Head title="Backup Templates" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Backup Templates"
                    description="Manage which templates appear in your backup picker. Activation applies only to your account; saved templates remain unchanged."
                />
                <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.get('/admin/backup-templates', {
                            preserveState: true,
                            replace: true,
                        });
                    }}
                >
                    <Input
                        aria-label="Search templates"
                        placeholder="Search template, creator, or project…"
                        className="w-full sm:max-w-sm"
                        value={form.data.search}
                        onChange={(event) =>
                            form.setData('search', event.target.value)
                        }
                    />
                    <select
                        aria-label="Template status"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={form.data.status}
                        onChange={(event) =>
                            form.setData('status', event.target.value)
                        }
                    >
                        <option value="all">All templates</option>
                        <option value="active">Active for me</option>
                        <option value="hidden">Hidden for me</option>
                    </select>
                    <Button type="submit" disabled={form.processing}>
                        Filter
                    </Button>
                </form>
                <DataTable>
                    <thead className="bg-muted/50">
                        <tr>
                            {[
                                'Template',
                                'Project',
                                'Created by',
                                'Status for me',
                                'Action',
                            ].map((label) => (
                                <th
                                    key={label}
                                    className="px-4 py-3 font-medium"
                                >
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {templates.data.map((template) => (
                            <tr key={template.id} className="border-t">
                                <td className="px-4 py-3 font-medium">
                                    {template.name}
                                </td>
                                <td className="px-4 py-3">
                                    {[
                                        template.project.project_code,
                                        template.project.project_name,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </td>
                                <td className="px-4 py-3">
                                    {template.creator?.name ??
                                        'Unknown creator (legacy template)'}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`rounded px-2 py-1 text-xs ${template.is_excluded ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-800'}`}
                                    >
                                        {template.is_excluded
                                            ? 'Hidden'
                                            : 'Active'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            template.is_excluded
                                                ? 'default'
                                                : 'outline'
                                        }
                                        disabled={pending !== null}
                                        onClick={() => toggle(template)}
                                    >
                                        {pending === template.id
                                            ? 'Saving…'
                                            : template.is_excluded
                                              ? 'Activate for me'
                                              : 'Hide for me'}
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {!templates.data.length && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-4 py-10 text-center text-muted-foreground"
                                >
                                    No templates match your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </DataTable>
                <Pagination links={templates.links} />
            </div>
        </>
    );
}
