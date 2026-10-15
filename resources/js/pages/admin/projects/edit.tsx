import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleAlert, CircleCheck, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '@/components/page-header';
import ProjectForm from '@/components/project-form';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Setting = {
    pol_amount: number;
    pre_engineering_percentage: number;
    supervision_percentage: number;
    contingencies_amount: number;
};
type Misc = {
    estimate_type: 'ADD' | 'NON_ADD';
    description: string;
    unit: string;
    amount: number | string;
    multiplier: number | string;
};
type Total = { dupa_total: number; charges_total: number; grand_total: number };
type Props = {
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
type WorkspaceStep = 'details' | 'charges' | 'review';
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
        ['charges', '2. Project charges'],
        ['review', '3. Review'],
    ];

    return (
        <>
            <Head title={`Edit ${project.project_name}`} />
            <div className="space-y-4 p-3 md:p-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4 [&_[data-slot=card]]:gap-4 [&_[data-slot=card]]:py-4 [&_[data-slot=input]]:h-8 [&_button]:h-8 [&_select]:h-8">
                <PageHeader
                    title={`Edit ${project.project_name}`}
                    description="Complete the project in three guided steps. Encode items and estimates on the DUPA page. Changes in each step are saved independently."
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
                <div className={step === 'details' ? undefined : 'hidden'}>
                    <ProjectForm
                        project={project}
                        signatories={signatories}
                        signatoryDefaults={signatoryDefaults}
                        canCreateSignatories={canCreateSignatories}
                        canUpdateSignatories={canUpdateSignatories}
                        signatoryRoleOptions={signatoryRoleOptions}
                        signatorySystemUsers={signatorySystemUsers}
                    />
                </div>
                <div className={step === 'charges' ? undefined : 'hidden'}>
                    <Charges
                        projectId={project.id!}
                        initialSettings={project.estimate_settings}
                        initialMisc={project.miscellaneous}
                        totals={totals}
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
            step: 'details' as WorkspaceStep,
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
                <CardContent className="space-y-3">
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
                        onClick={() => onNavigate('charges')}
                    >
                        Review project charges
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function Charges({
    projectId,
    initialSettings,
    initialMisc,
    totals,
}: {
    projectId: number;
    initialSettings: Record<'ADD' | 'NON_ADD', Setting>;
    initialMisc: Misc[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
}) {
    const form = useForm({
        settings: initialSettings,
        miscellaneous: initialMisc,
    });
    const setSetting = (
        type: 'ADD' | 'NON_ADD',
        key: keyof Setting,
        value: string,
    ) =>
        form.setData('settings', {
            ...form.data.settings,
            [type]: { ...form.data.settings[type], [key]: value },
        });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.put(`/admin/projects/${projectId}/estimate-settings`, {
                    preserveScroll: true,
                });
            }}
        >
            <Card>
                <CardHeader>
                    <CardTitle>Project-level charges</CardTitle>
                    <CardDescription>
                        These are added once after the DUPA totals for each
                        estimate side.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {(['ADD', 'NON_ADD'] as const).map((type) => (
                            <div key={type} className="rounded-lg border p-3">
                                <h3 className="mb-3 font-semibold">
                                    {type.replace('_', '-')}
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {(
                                        [
                                            ['pol_amount', 'POL amount'],
                                            [
                                                'pre_engineering_percentage',
                                                'Pre-engineering %',
                                            ],
                                            [
                                                'supervision_percentage',
                                                'Supervision %',
                                            ],
                                            [
                                                'contingencies_amount',
                                                'Contingencies amount',
                                            ],
                                        ] as Array<[keyof Setting, string]>
                                    ).map(([key, label]) => (
                                        <div className="space-y-1" key={key}>
                                            <Label>{label}</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.0001"
                                                value={
                                                    form.data.settings[type]?.[
                                                        key
                                                    ] ?? 0
                                                }
                                                onChange={(e) =>
                                                    setSetting(
                                                        type,
                                                        key,
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        DUPAs
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].dupa_total,
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        Charges
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].charges_total,
                                            )}
                                        </strong>
                                    </div>
                                    <div>
                                        Total
                                        <br />
                                        <strong>
                                            {money.format(
                                                totals[type].grand_total,
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Miscellaneous</h3>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    form.setData('miscellaneous', [
                                        ...form.data.miscellaneous,
                                        {
                                            estimate_type: 'ADD',
                                            description: '',
                                            unit: 'l.s.',
                                            amount: 0,
                                            multiplier: 1,
                                        },
                                    ])
                                }
                            >
                                <Plus /> Add row
                            </Button>
                        </div>
                        {form.data.miscellaneous.map((row, index) => (
                            <div
                                className="grid gap-2 md:grid-cols-[0.7fr_2fr_0.6fr_0.8fr_0.8fr_auto]"
                                key={index}
                            >
                                <select
                                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                    value={row.estimate_type}
                                    onChange={(e) => {
                                        const rows = [
                                            ...form.data.miscellaneous,
                                        ];
                                        rows[index] = {
                                            ...row,
                                            estimate_type: e.target.value as
                                                'ADD' | 'NON_ADD',
                                        };
                                        form.setData('miscellaneous', rows);
                                    }}
                                >
                                    <option value="ADD">ADD</option>
                                    <option value="NON_ADD">NON-ADD</option>
                                </select>
                                {(
                                    [
                                        'description',
                                        'unit',
                                        'amount',
                                        'multiplier',
                                    ] as const
                                ).map((key) => (
                                    <Input
                                        key={key}
                                        type={
                                            key === 'amount' ||
                                            key === 'multiplier'
                                                ? 'number'
                                                : 'text'
                                        }
                                        min="0"
                                        step="0.0001"
                                        placeholder={key}
                                        value={row[key]}
                                        onChange={(e) => {
                                            const rows = [
                                                ...form.data.miscellaneous,
                                            ];
                                            rows[index] = {
                                                ...row,
                                                [key]: e.target.value,
                                            };
                                            form.setData('miscellaneous', rows);
                                        }}
                                    />
                                ))}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                        form.setData(
                                            'miscellaneous',
                                            form.data.miscellaneous.filter(
                                                (_, i) => i !== index,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <Button disabled={form.processing}>
                            {form.processing
                                ? 'Saving…'
                                : 'Save project charges'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
