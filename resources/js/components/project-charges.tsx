import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import MiscellaneousInputs from '@/components/miscellaneous-inputs';
import type { ProjectFields } from '@/components/project-form';
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
export type Setting = {
    pol_amount: number;
    pre_engineering_percentage: number;
    supervision_percentage: number;
    contingencies_amount: number;
};
export type Misc = {
    estimate_type: 'ADD' | 'NON_ADD';
    description: string;
    unit: string;
    amount: number | string;
    multiplier: number | string;
};
export type Total = {
    dupa_total: number;
    charges_total: number;
    grand_total: number;
};

const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
export default function ProjectCharges({
    projectId,
    initialSettings,
    pol,
    initialMisc,
    totals,
    readOnly = false,
}: {
    projectId: number;
    readOnly?: boolean;
    pol: ProjectFields['pol'];
    initialSettings: Record<'ADD' | 'NON_ADD', Setting>;
    initialMisc: Misc[];
    totals: Record<'ADD' | 'NON_ADD', Total>;
}) {
    const form = useForm({
        pol: pol ?? initialSettings.ADD.pol_amount,
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
            <fieldset disabled={readOnly}>
                <Card>
                    <CardHeader>
                        <CardTitle>11. Breakdown of estimated cost</CardTitle>
                        <CardDescription>
                            POL is one project amount, counted once in the
                            combined total. The other charges retain their
                            estimate side.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="grid gap-2 lg:grid-cols-2">
                            {(['ADD', 'NON_ADD'] as const).map((type) => (
                                <div
                                    key={type}
                                    className="rounded-lg border p-3"
                                >
                                    <h3 className="mb-2 text-sm font-semibold">
                                        {type.replace('_', '-')}
                                    </h3>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {(
                                            [
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
                                            <div
                                                className="space-y-1"
                                                key={key}
                                            >
                                                <Label>{label}</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.0001"
                                                    value={
                                                        form.data.settings[
                                                            type
                                                        ]?.[key] ?? 0
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
                                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
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
                        <div className="space-y-1">
                            <Label htmlFor="project-charges-pol">
                                POL amount
                            </Label>
                            <Input
                                id="project-charges-pol"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.data.pol}
                                onChange={(e) =>
                                    form.setData('pol', e.target.value)
                                }
                            />
                            <InputError message={form.errors.pol} />
                        </div>
                        <MiscellaneousInputs
                            rows={form.data.miscellaneous}
                            onChange={(rows) =>
                                form.setData('miscellaneous', rows)
                            }
                            errors={form.errors}
                        />
                        {!readOnly && (
                            <div className="flex justify-end">
                                <Button disabled={form.processing}>
                                    {form.processing
                                        ? 'Saving…'
                                        : 'Save project charges'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </fieldset>
        </form>
    );
}
