import { Head, Link, router } from '@inertiajs/react';
import { FileSpreadsheet, FileText, Pencil, Trash2 } from 'lucide-react';
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

type Estimate = {
    quantity: number;
    direct_cost: number;
    total_cost: number;
    unit_cost: number;
};
type Item = {
    id: number;
    pay_item_no: string;
    description: string;
    unit: string;
    estimates: Partial<Record<'ADD' | 'NON_ADD', Estimate>>;
};
type Section = {
    id: number;
    section: string;
    items: Item[];
    sub_sections: { id: number; sub_section: string; items: Item[] }[];
};
type Total = {
    direct_cost: number;
    dupa_total: number;
    charges_total: number;
    grand_total: number;
};
type Props = {
    project: {
        id: number;
        project_code: string;
        project_name: string;
        project_description: string | null;
        source_of_funds: string | null;
        location: string;
        contract_duration: number;
        type_of_projects: string | null;
        category: string | null;
        dimension: string | null;
        floor_area: string | null;
        implementation_scheme: string | null;
        allotment_class: string | null;
        can_edit: boolean;
        can_delete: boolean;
        sections: Section[];
    };
    totals: Record<'ADD' | 'NON_ADD', Total>;
};
const amount = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function ProjectsShow({ project, totals }: Props) {
    const itemCount = project.sections.reduce(
        (count, section) =>
            count +
            section.items.length +
            section.sub_sections.reduce((n, sub) => n + sub.items.length, 0),
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
                            {project.can_edit && (
                                <Button asChild variant="outline">
                                    <Link
                                        href={`/admin/projects/${project.id}/edit`}
                                    >
                                        <Pencil /> Edit project
                                    </Link>
                                </Button>
                            )}
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
                            {project.can_delete && (
                                <ConfirmDialog
                                    title="Delete project?"
                                    description="This permanently deletes the project, hierarchy, estimates, and saved bid document."
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
                            )}
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Summary
                        label="Contract duration"
                        value={`${project.contract_duration} days`}
                    />
                    <Summary
                        label="Sections"
                        value={String(project.sections.length)}
                    />
                    <Summary label="DUPA items" value={String(itemCount)} />
                    <Summary
                        label="Combined estimate"
                        value={peso.format(
                            totals.ADD.grand_total + totals.NON_ADD.grand_total,
                        )}
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Project details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                        <Detail
                            label="Description"
                            value={project.project_description}
                        />
                        <Detail
                            label="Source of funds"
                            value={project.source_of_funds}
                        />
                        <Detail
                            label="Allotment class"
                            value={project.allotment_class}
                        />
                        <Detail label="Type" value={project.type_of_projects} />
                        <Detail label="Category" value={project.category} />
                        <Detail
                            label="Implementation"
                            value={project.implementation_scheme}
                        />
                        <Detail label="Dimensions" value={project.dimension} />
                        <Detail label="Floor area" value={project.floor_area} />
                    </CardContent>
                </Card>
                <div className="grid gap-4 md:grid-cols-2">
                    {(['ADD', 'NON_ADD'] as const).map((side) => (
                        <Card key={side}>
                            <CardHeader>
                                <CardDescription>
                                    {side.replace('_', '-')} estimate
                                </CardDescription>
                                <CardTitle>
                                    {peso.format(totals[side].grand_total)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-3 gap-3 text-sm">
                                <Detail
                                    label="Direct cost"
                                    value={peso.format(
                                        totals[side].direct_cost,
                                    )}
                                />
                                <Detail
                                    label="DUPA total"
                                    value={peso.format(totals[side].dupa_total)}
                                />
                                <Detail
                                    label="Project charges"
                                    value={peso.format(
                                        totals[side].charges_total,
                                    )}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {project.sections.length === 0 ? (
                    <EmptyState message="This project has no sections or DUPA items yet." />
                ) : (
                    <div className="space-y-5">
                        {project.sections.map((section) => (
                            <Card key={section.id}>
                                <CardHeader>
                                    <CardTitle>{section.section}</CardTitle>
                                    <CardDescription>
                                        {section.items.length +
                                            section.sub_sections.reduce(
                                                (n, sub) =>
                                                    n + sub.items.length,
                                                0,
                                            )}{' '}
                                        DUPA items
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {section.items.length > 0 && (
                                        <ItemTable
                                            items={section.items}
                                            editable={project.can_edit}
                                        />
                                    )}
                                    {section.sub_sections.map((sub) => (
                                        <div key={sub.id} className="space-y-2">
                                            <h3 className="font-medium text-muted-foreground">
                                                {sub.sub_section}
                                            </h3>
                                            {sub.items.length ? (
                                                <ItemTable
                                                    items={sub.items}
                                                    editable={project.can_edit}
                                                />
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    No DUPA items.
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardDescription>{label}</CardDescription>
                <CardTitle>{value}</CardTitle>
            </CardHeader>
        </Card>
    );
}
function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-medium whitespace-pre-line">
                {value || '—'}
            </div>
        </div>
    );
}
function ItemTable({ items, editable }: { items: Item[]; editable: boolean }) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                    <tr>
                        {[
                            'Pay item',
                            'Description',
                            'Unit',
                            'ADD qty',
                            'ADD total',
                            'NON-ADD qty',
                            'NON-ADD total',
                            'Combined',
                        ].map((heading) => (
                            <th
                                className="px-3 py-2 font-medium whitespace-nowrap"
                                key={heading}
                            >
                                {heading}
                            </th>
                        ))}
                        {editable && <th />}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {items.map((item) => {
                        const add = item.estimates.ADD;
                        const non = item.estimates.NON_ADD;

                        return (
                            <tr key={item.id}>
                                <td className="px-3 py-2 font-medium whitespace-nowrap">
                                    {item.pay_item_no}
                                </td>
                                <td className="min-w-64 px-3 py-2">
                                    {item.description}
                                </td>
                                <td className="px-3 py-2">{item.unit}</td>
                                <td className="px-3 py-2 text-right">
                                    {amount.format(add?.quantity ?? 0)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {amount.format(add?.total_cost ?? 0)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {amount.format(non?.quantity ?? 0)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {amount.format(non?.total_cost ?? 0)}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                    {amount.format(
                                        (add?.total_cost ?? 0) +
                                            (non?.total_cost ?? 0),
                                    )}
                                </td>
                                {editable && (
                                    <td className="px-3 py-2">
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                        >
                                            <Link
                                                href={`/admin/dupas/${item.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
