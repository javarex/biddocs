import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Eye,
    FileText,
    FolderKanban,
    Import,
    Search,
    Trash2,
} from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProjectRow = {
    id: number;
    project_code: string;
    project_name: string;
    project_description: string | null;
    location: string;
    contract_duration: number;
    sections_count: number;
    items_count: number;
    can_delete: boolean;
};
type Props = {
    projects: { data: ProjectRow[]; links: PaginationLink[] };
    filters: { search: string };
};

export default function ProjectsIndex({ projects, filters }: Props) {
    const search = useForm({ search: filters.search });
    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault();
        search.get('/admin/projects', {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <>
            <Head title="Projects" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Projects"
                    description="Review procurement projects and import additional or updated project items."
                />

                <form onSubmit={submitSearch} className="flex max-w-xl gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            value={search.data.search}
                            onChange={(event) =>
                                search.setData('search', event.target.value)
                            }
                            placeholder="Search project code, name, or location"
                        />
                    </div>
                    <Button type="submit" variant="outline">
                        Search
                    </Button>
                </form>

                {projects.data.length === 0 ? (
                    <EmptyState message="No projects match your search." />
                ) : (
                    <DataTable>
                        <thead className="bg-muted/50">
                            <tr>
                                {[
                                    'Project',
                                    'Location',
                                    'Duration',
                                    'Sections',
                                    'Items',
                                    'Actions',
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
                            {projects.data.map((project) => (
                                <tr
                                    key={project.id}
                                    className="hover:bg-muted/30"
                                >
                                    <td className="max-w-md px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <FolderKanban className="mt-0.5 size-5 shrink-0 text-primary" />
                                            <div>
                                                <p className="font-medium">
                                                    {project.project_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {project.project_code}
                                                </p>
                                                {project.project_description && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {
                                                            project.project_description
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="max-w-xs px-4 py-4 text-muted-foreground">
                                        {project.location}
                                    </td>
                                    <td className="px-4 py-4">
                                        {project.contract_duration} days
                                    </td>
                                    <td className="px-4 py-4">
                                        {project.sections_count}
                                    </td>
                                    <td className="px-4 py-4">
                                        {project.items_count}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-2">
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Link
                                                    href={`/admin/projects/${project.id}`}
                                                >
                                                    <Eye /> View
                                                </Link>
                                            </Button>
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Link
                                                    href={`/admin/projects/${project.id}/bid-docs`}
                                                >
                                                    <FileText /> View Bid Docs
                                                </Link>
                                            </Button>
                                            <Button asChild size="sm">
                                                <Link
                                                    href={`/admin/projects/${project.id}/import`}
                                                >
                                                    <Import /> Import / Update
                                                </Link>
                                            </Button>
                                            {project.can_delete && (
                                                <ConfirmDialog
                                                    title="Delete project?"
                                                    description="This will permanently delete the project and its imported sections and items."
                                                    confirmLabel="Delete"
                                                    destructive
                                                    onConfirm={() =>
                                                        router.delete(
                                                            `/admin/projects/${project.id}`,
                                                        )
                                                    }
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        aria-label={`Delete ${project.project_name}`}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </ConfirmDialog>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                )}

                <Pagination links={projects.links} />
            </div>
        </>
    );
}

ProjectsIndex.layout = {
    breadcrumbs: [{ title: 'Projects', href: '/admin/projects' }],
};
