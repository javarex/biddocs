import { Head, Link, router } from '@inertiajs/react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/page-header';
import type { Setting, Misc, Total } from '@/components/project-charges';
import ProjectForm from '@/components/project-form';
import type { MarkupRateBand } from '@/components/project-markup-rates';
import type {
    ProjectFields,
    Signatory,
    SignatoryRoleOption,
    SignatorySystemUser,
} from '@/components/project-form';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Props = {
    markupRateBands: MarkupRateBand[];
    canViewDupa: boolean;
    project: ProjectFields & {
        estimate_settings: Record<'ADD' | 'NON_ADD', Setting>;
        miscellaneous: Misc[];
    };
    signatories: Signatory[];
    signatoryDefaults: Partial<ProjectFields>;
    canCreateSignatories: boolean;
    canUpdateSignatories: boolean;
    signatoryRoleOptions: SignatoryRoleOption[];
    signatorySystemUsers: SignatorySystemUser[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
    initialStep: WorkspaceStep;
    completion: Completion;
};
type WorkspaceStep = 'details' | 'signatories' | 'review';
type Completion = {
    has_sections: boolean;
    total_dupas: number;
    configured_dupas: number;
    imported_summaries: number;
    missing_signatories: string[];
};
const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function ProjectEdit({
    markupRateBands,
    canViewDupa,
    project,
    signatories,
    signatoryDefaults,
    canCreateSignatories,
    canUpdateSignatories,
    signatoryRoleOptions,
    signatorySystemUsers,
    totals,
    initialStep,
    completion,
}: Props) {
    const [step, setStep] = useState<WorkspaceStep>(initialStep);
    const steps: Array<[WorkspaceStep, string]> = [
        ['details', '1. Project details'],
        ['signatories', '2. Signatories'],
        ['review', '3. Review'],
    ];

    return (
        <>
            <Head title={`Edit ${project.project_name}`} />
            <div className="space-y-2 p-3 [&_[data-slot=card-content]]:px-3 [&_[data-slot=card-header]]:px-3 [&_[data-slot=card-title]]:text-sm [&_[data-slot=card]]:gap-2 [&_[data-slot=card]]:py-3 [&_[data-slot=input]]:h-8 [&_button]:h-8 [&_select]:h-8">
                <PageHeader
                    compact
                    title={`Edit ${project.project_name}`}
                    description="Complete the project details and signatories. Encode items, estimates, and project charges on the DUPA page. Changes in each step are saved independently."
                    backHref={`/admin/projects/${project.id}`}
                    action={
                        canViewDupa && (
                            <Button asChild variant="outline">
                                <Link
                                    href={`/admin/projects/${project.id}/dupa`}
                                >
                                    Open DUPA
                                </Link>
                            </Button>
                        )
                    }
                />
                <nav
                    className="grid gap-1 rounded-lg border bg-card p-1 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label="Project setup steps"
                >
                    {steps.map(([value, label]) => (
                        <Button
                            key={value}
                            type="button"
                            variant={step === value ? 'default' : 'ghost'}
                            className="h-8 justify-start px-3 text-xs"
                            onClick={() => setStep(value)}
                        >
                            {label}
                        </Button>
                    ))}
                </nav>
                <div
                    className={
                        step === 'details' || step === 'signatories'
                            ? undefined
                            : 'hidden'
                    }
                >
                    <ProjectForm
                        worksheet
                        markupRateBands={markupRateBands}
                        key={JSON.stringify([
                            project.pol,
                            project.miscellaneous,
                        ])}
                        activePanel={
                            step === 'signatories' ? 'signatories' : 'details'
                        }
                        onPanelChange={setStep}
                        project={project}
                        signatories={signatories}
                        signatoryDefaults={signatoryDefaults}
                        canCreateSignatories={canCreateSignatories}
                        canUpdateSignatories={canUpdateSignatories}
                        signatoryRoleOptions={signatoryRoleOptions}
                        signatorySystemUsers={signatorySystemUsers}
                    />
                </div>
                <div className={step === 'review' ? undefined : 'hidden'}>
                    <Review
                        canViewDupa={canViewDupa}
                        completion={completion}
                        totals={totals}
                        onNavigate={(next) =>
                            next === 'dupa'
                                ? canViewDupa &&
                                  router.visit(
                                      `/admin/projects/${project.id}/dupa`,
                                  )
                                : setStep(next)
                        }
                    />
                </div>
            </div>
        </>
    );
}

const signatoryLabels: Record<string, string> = {
    prepared_by: 'Prepared by',
    checked_by: 'Checked by',
    recommending_approval: 'Recommending approval',
    included_in_aip: 'Included in AIP',
    recommending_approval_pao: 'Recommending approval (PAO)',
    approved_by: 'Approved by',
};

function Review({
    canViewDupa,
    completion,
    totals,
    onNavigate,
}: {
    canViewDupa: boolean;
    completion: Completion;
    totals: Record<'ADD' | 'NON_ADD', Total>;
    onNavigate: (step: WorkspaceStep | 'dupa') => void;
}) {
    const checks = [
        {
            label: 'Project has at least one section',
            complete: completion.has_sections,
            step: 'dupa' as const,
        },
        {
            label: 'Project has at least one DUPA item',
            complete: completion.total_dupas > 0,
            step: 'dupa' as const,
        },
        {
            label:
                completion.total_dupas === 0
                    ? 'DUPA estimates have not started'
                    : `${completion.configured_dupas} of ${completion.total_dupas} DUPAs have an estimate`,
            complete:
                completion.total_dupas > 0 &&
                completion.configured_dupas === completion.total_dupas,
            step: 'dupa' as const,
        },
        {
            label:
                completion.missing_signatories.length === 0
                    ? 'All signatory roles are assigned'
                    : `Missing: ${completion.missing_signatories.map((role) => signatoryLabels[role] ?? role).join(', ')}`,
            complete: completion.missing_signatories.length === 0,
            step: 'signatories' as WorkspaceStep,
        },
        {
            label:
                completion.imported_summaries === 0
                    ? 'No imported summary estimates need review'
                    : `${completion.imported_summaries} imported DUPA(s) should be reviewed`,
            complete: completion.imported_summaries === 0,
            step: 'dupa' as const,
        },
    ];

    return (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
                <CardHeader>
                    <CardTitle>Project readiness</CardTitle>
                    <CardDescription>
                        Use this checklist before preparing the final project
                        documents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {checks.map((check) => (
                        <button
                            type="button"
                            key={check.label}
                            disabled={check.step === 'dupa' && !canViewDupa}
                            className="flex w-full items-center gap-2 rounded-md border p-2 text-left hover:bg-muted/50"
                            onClick={() => onNavigate(check.step)}
                        >
                            {check.complete ? (
                                <CircleCheck className="text-green-600" />
                            ) : (
                                <CircleAlert className="text-amber-600" />
                            )}
                            <span className="text-sm">{check.label}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Estimate totals</CardTitle>
                    <CardDescription>
                        Combined DUPA totals and project-level charges.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(['ADD', 'NON_ADD'] as const).map((type) => (
                        <div key={type} className="rounded-md border p-3">
                            <div className="font-semibold">
                                {type.replace('_', '-')}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                Grand total
                            </div>
                            <div className="text-xl font-bold">
                                {money.format(totals[type].grand_total)}
                            </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => onNavigate('dupa')}
                    >
                        Open DUPA and project charges
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
