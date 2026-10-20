import { Head, Link, useForm } from '@inertiajs/react';
import { FolderKanban, Plus, Search } from 'lucide-react';
import DataTable from '@/components/data-table';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import type { PaginationLink } from '@/components/pagination';
import ProjectActions from '@/components/project-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProjectRow = {
    id: number;
    project_code: string | null;
    project_name: string;
    allocated_amount: number | null;
    project_description: string | null;
    location: string;
    contract_duration: number;
    sections_count: number;
    items_count: number;
    can_delete: boolean;
    can_edit: boolean;
};
type Props = {
    projects: { data: ProjectRow[]; links: PaginationLink[] };
    filters: { search: string };
    can_create: boolean;
    can_view_dupa: boolean;
};

export default function ProjectsIndex({
    projects,
    filters,
    can_create,
    can_view_dupa,
}: Props) {
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
                    action={
                        can_create ? (
                            <Button asChild>
                                <Link href="/admin/projects/create">
                                    <Plus /> Create project
                                </Link>
                            </Button>
                        ) : undefined
                    }
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
                                    'Allocated amount',
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
                                                    {project.project_code ||
                                                        'No project code'}
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
                                        {project.allocated_amount === null
                                            ? '—'
                                            : `₱${Number(project.allocated_amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                                        <ProjectActions
                                            project={project}
                                            canViewDupa={can_view_dupa}
                                        />
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
