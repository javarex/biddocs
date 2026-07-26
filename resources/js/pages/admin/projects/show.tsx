import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    FileSpreadsheet,
    FileText,
    Import,
    Trash2,
} from 'lucide-react';
import ConfirmDialog from '@/components/confirm-dialog';
import EmptyState from '@/components/empty-state';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Item = {
    id: number;
    pay_item_no: string;
    description: string;
    unit: string;
    qty: number;
    estimated_direct_cost: number;
    total_cost: number;
    unit_cost_adjusted: number;
};
type SubSection = {
    id: number;
    sub_section: string;
    items: Item[];
};
type Section = {
    id: number;
    section: string;
    sub_sections: SubSection[];
};
type Props = {
    project: {
        id: number;
        project_code: string;
        project_name: string;
        project_description: string | null;
        location: string;
        contract_duration: number;
        sections: Section[];
    };
};

const numberFormat = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function amount(value: number) {
    return numberFormat.format(value);
}

export default function ProjectsShow({ project }: Props) {
    const itemCount = project.sections.reduce(
        (total, section) =>
            total +
            section.sub_sections.reduce(
                (sectionTotal, subSection) =>
                    sectionTotal + subSection.items.length,
                0,
            ),
        0,
    );

    return (
        <>
            <Head title={project.project_name} />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={project.project_name}
                    description={`${project.project_code} · ${project.location}`}
                    backHref="/admin/projects"
                    action={
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline">
                                <Link
                                    href={`/admin/projects/${project.id}/bid-docs`}
                                >
                                    <FileText /> View Bid Docs
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link
                                    href={`/admin/projects/${project.id}/import`}
                                >
                                    <FileSpreadsheet /> Excel Imports
                                </Link>
                            </Button>
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
                                <Button variant="destructive">
                                    <Trash2 /> Delete project
                                </Button>
                            </ConfirmDialog>
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    {project.project_description && (
                        <Card className="sm:col-span-3">
                            <CardHeader className="pb-3">
                                <CardDescription>
                                    Project description
                                </CardDescription>
                                <CardTitle className="text-base leading-snug">
                                    {project.project_description}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    )}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Contract duration</CardDescription>
                            <CardTitle>
                                {project.contract_duration} days
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Sections</CardDescription>
                            <CardTitle>{project.sections.length}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardDescription>Items</CardDescription>
                            <CardTitle>{itemCount}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {project.sections.length === 0 ? (
                    <EmptyState message="This project has no sections or items yet." />
                ) : (
                    <div className="space-y-5">
                        {project.sections.map((section) => {
                            const sectionItemCount =
                                section.sub_sections.reduce(
                                    (total, subSection) =>
                                        total + subSection.items.length,
                                    0,
                                );

                            return (
                                <Card key={section.id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <CardTitle>
                                                    {section.section}
                                                </CardTitle>
                                                <CardDescription>
                                                    {
                                                        section.sub_sections
                                                            .length
                                                    }{' '}
                                                    subsections ·{' '}
                                                    {sectionItemCount} items
                                                </CardDescription>
                                            </div>
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Link
                                                    href={`/admin/projects/${project.id}/import`}
                                                >
                                                    <Import /> Update section
                                                    data
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {section.sub_sections.map(
                                            (subSection) => (
                                                <div
                                                    key={subSection.id}
                                                    className="space-y-3"
                                                >
                                                    <h3 className="font-medium text-muted-foreground">
                                                        {subSection.sub_section}
                                                    </h3>
                                                    {subSection.items.length ===
                                                    0 ? (
                                                        <p className="text-sm text-muted-foreground">
                                                            No items in this
                                                            subsection.
                                                        </p>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-lg border">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-muted/50">
                                                                    <tr>
                                                                        <th className="px-3 py-2 font-medium">
                                                                            Pay
                                                                            item
                                                                        </th>
                                                                        <th className="px-3 py-2 font-medium">
                                                                            Description
                                                                        </th>
                                                                        <th className="px-3 py-2 font-medium">
                                                                            Unit
                                                                        </th>
                                                                        <th className="px-3 py-2 text-right font-medium">
                                                                            Qty
                                                                        </th>
                                                                        <th className="px-3 py-2 text-right font-medium">
                                                                            Direct
                                                                            cost
                                                                        </th>
                                                                        <th className="px-3 py-2 text-right font-medium">
                                                                            Total
                                                                            cost
                                                                        </th>
                                                                        <th className="px-3 py-2 text-right font-medium">
                                                                            Adjusted
                                                                            unit
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y">
                                                                    {subSection.items.map(
                                                                        (
                                                                            item,
                                                                        ) => (
                                                                            <tr
                                                                                key={
                                                                                    item.id
                                                                                }
                                                                                className="hover:bg-muted/30"
                                                                            >
                                                                                <td className="px-3 py-2 font-medium whitespace-nowrap">
                                                                                    {
                                                                                        item.pay_item_no
                                                                                    }
                                                                                </td>
                                                                                <td className="min-w-72 px-3 py-2">
                                                                                    {
                                                                                        item.description
                                                                                    }
                                                                                </td>
                                                                                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                                                                    {
                                                                                        item.unit
                                                                                    }
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                                                    {amount(
                                                                                        item.qty,
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                                                    {amount(
                                                                                        item.estimated_direct_cost,
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                                                    {amount(
                                                                                        item.total_cost,
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                                                    {amount(
                                                                                        item.unit_cost_adjusted,
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ),
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <Button asChild variant="outline">
                    <Link href="/admin/projects">
                        <ArrowLeft /> Back to projects
                    </Link>
                </Button>
            </div>
        </>
    );
}

ProjectsShow.layout = {
    breadcrumbs: [
        { title: 'Projects', href: '/admin/projects' },
        { title: 'Project details', href: '#' },
    ],
};
