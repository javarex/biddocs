import { Head } from '@inertiajs/react';
import { Pencil } from 'lucide-react';
import { Fragment, useState } from 'react';
import PageHeader from '@/components/page-header';
import ProjectCharges from '@/components/project-charges';
import type { Setting, Misc, Total } from '@/components/project-charges';
import ProjectDupaDetails from '@/components/project-dupa-details';
import ProjectDupaActions, {
    DupaEstimateDialog,
} from '@/components/project-dupa-workspace';
import type { DupaSection } from '@/components/project-dupa-workspace';
import type { ProjectFields } from '@/components/project-form';
import type { MarkupRateBand } from '@/components/project-markup-rates';
import { Button } from '@/components/ui/button';
import type { Item, Props } from './show';

const number = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const value = (n: number | undefined) =>
    n === undefined ? '—' : number.format(n);

export default function ProjectDupa({
    project,
    markupRateBands,
    chargeData,
    dupaSections = [],
    openEstimateId = null,
}: Pick<Props, 'project'> & {
    markupRateBands: MarkupRateBand[];
    chargeData: {
        pol: ProjectFields['pol'];
        settings: Record<'ADD' | 'NON_ADD', Setting>;
        miscellaneous: Misc[];
        totals: Record<'ADD' | 'NON_ADD', Total>;
    };
    dupaSections?: DupaSection[];
    openEstimateId?: number | null;
}) {
    const [side, setSide] = useState<'ADD' | 'NON_ADD'>('ADD');
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const items = project.sections.flatMap((section) => [
        ...section.items,
        ...section.sub_sections.flatMap((sub) => sub.items),
    ]);
    const total = (type: 'ADD' | 'NON_ADD') =>
        items.reduce(
            (sum, item) => sum + (item.estimates[type]?.total_cost ?? 0),
            0,
        );
    const selectedTotal = total(side);
    const cell = 'border border-slate-400 px-2 py-2';
    const row = (item: Item) => {
        const estimate = item.estimates[side];

        return (
            <tr key={item.id} className="hover:bg-slate-50">
                <td className={`${cell} text-center`}>{item.pay_item_no}</td>
                <td className={cell}>
                    <div className="flex items-start justify-between gap-2">
                        <span>{item.description}</span>
                        {project.can_edit && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 print:hidden"
                                aria-label={`Edit DUPA ${item.pay_item_no}`}
                                onClick={() => setEditingItem(item)}
                            >
                                <Pencil className="size-3.5" /> Edit
                            </Button>
                        )}
                    </div>
                </td>
                <td className={`${cell} text-right`}>
                    {estimate && selectedTotal > 0
                        ? `${number.format((estimate.total_cost / selectedTotal) * 100)} %`
                        : '—'}
                </td>
                <td className={`${cell} text-right`}>
                    {value(estimate?.quantity)}
                </td>
                <td className={`${cell} text-center`}>{item.unit}</td>
                <td className={`${cell} text-right`}>
                    {value(estimate?.unit_cost)}
                </td>
                <td className={`${cell} text-right`}>
                    {value(item.estimates.ADD?.total_cost)}
                </td>
                <td className={`${cell} text-right`}>
                    {value(item.estimates.NON_ADD?.total_cost)}
                </td>
            </tr>
        );
    };

    return (
        <>
            <Head title={`DUPA · ${project.project_name}`} />
            {project.can_edit && editingItem && (
                <DupaEstimateDialog
                    key={editingItem.id}
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                />
            )}
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="DUPA"
                    description={project.project_name}
                    action={
                        project.can_edit ? (
                            <ProjectDupaActions
                                projectId={project.id}
                                sections={dupaSections}
                                openEstimateId={openEstimateId}
                            />
                        ) : undefined
                    }
                    backHref="/admin/projects"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                        Weight, quantity and unit cost:
                    </span>
                    {(['ADD', 'NON_ADD'] as const).map((type) => (
                        <Button
                            key={type}
                            size="sm"
                            variant={side === type ? 'default' : 'outline'}
                            onClick={() => setSide(type)}
                            aria-pressed={side === type}
                        >
                            {type.replace('_', '-')}
                        </Button>
                    ))}
                </div>
                <div className="overflow-x-auto rounded-lg border bg-white text-slate-950 shadow-sm">
                    <div className="min-w-[1100px] p-5">
                        <div className="border border-slate-400 py-3 text-center text-base font-bold">
                            SUMMARY OF ESTIMATED COST
                        </div>
                        <ProjectDupaDetails
                            project={project}
                            markupRateBands={markupRateBands}
                        />
                        <table className="w-full border-collapse text-xs tabular-nums">
                            <caption className="border border-slate-400 p-2 text-left text-sm font-semibold">
                                10.) Summary of Estimated Cost
                            </caption>
                            <thead className="bg-slate-50 text-center">
                                <tr>
                                    <th rowSpan={2} className={cell}>
                                        ITEM NO.
                                    </th>
                                    <th
                                        rowSpan={2}
                                        className={`${cell} w-[35%]`}
                                    >
                                        DESCRIPTION
                                    </th>
                                    <th rowSpan={2} className={cell}>
                                        % WEIGHT
                                    </th>
                                    <th rowSpan={2} className={cell}>
                                        QUANTITY
                                    </th>
                                    <th rowSpan={2} className={cell}>
                                        UNIT
                                    </th>
                                    <th rowSpan={2} className={cell}>
                                        UNIT COST
                                    </th>
                                    <th colSpan={2} className={cell}>
                                        TOTAL AMOUNT
                                    </th>
                                </tr>
                                <tr>
                                    <th className={cell}>ADD</th>
                                    <th className={cell}>NON-ADD</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th
                                        colSpan={8}
                                        className={`${cell} text-left`}
                                    >
                                        A. Direct Cost
                                    </th>
                                </tr>
                                {project.sections.map((section) => (
                                    <Fragment key={section.id}>
                                        <tr>
                                            <th
                                                colSpan={8}
                                                className={`${cell} bg-slate-100 text-left font-bold`}
                                            >
                                                {section.section}
                                            </th>
                                        </tr>
                                        {section.items.map(row)}
                                        {section.sub_sections.map((sub) => (
                                            <Fragment key={sub.id}>
                                                <tr>
                                                    <th
                                                        colSpan={8}
                                                        className={`${cell} pl-6 text-left`}
                                                    >
                                                        {sub.sub_section}
                                                    </th>
                                                </tr>
                                                {sub.items.map(row)}
                                            </Fragment>
                                        ))}
                                    </Fragment>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className={`${cell} py-8 text-center`}
                                        >
                                            No DUPA items have been added to
                                            this project.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-100 font-bold">
                                    <td
                                        colSpan={6}
                                        className={`${cell} text-right`}
                                    >
                                        TOTAL ITEM AMOUNT
                                    </td>
                                    <td className={`${cell} text-right`}>
                                        {value(total('ADD'))}
                                    </td>
                                    <td className={`${cell} text-right`}>
                                        {value(total('NON_ADD'))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <div className="mt-4 [&_[data-slot=card-title]]:text-sm">
                            <ProjectCharges
                                key={JSON.stringify(chargeData)}
                                projectId={project.id}
                                pol={chargeData.pol}
                                initialSettings={chargeData.settings}
                                initialMisc={chargeData.miscellaneous}
                                totals={chargeData.totals}
                                readOnly={!project.can_edit}
                            />
                        </div>
                        <p className="mt-3 text-xs text-slate-600">
                            Weight is based on the selected estimate's total
                            item amount. ADD and NON-ADD retain their own
                            quantities and unit costs. Project-level charges are
                            excluded.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
ProjectDupa.layout = {
    breadcrumbs: [
        { title: 'Projects', href: '/admin/projects' },
        { title: 'DUPA', href: '#' },
    ],
};
