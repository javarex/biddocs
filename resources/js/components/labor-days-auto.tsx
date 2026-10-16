import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { laborDays, parseLaborDaysFormula } from '@/lib/labor-days-formula';

type Source = { value: string; label: string };
export default function LaborDaysAuto({
    persons,
    formula,
    sources,
    values,
    disabled,
    onApply,
}: {
    persons: number | string;
    formula?: string;
    sources: Source[];
    values: Record<string, number>;
    disabled: boolean;
    onApply: (formula: string) => Promise<boolean>;
}) {
    const [open, setOpen] = useState(false);
    const [source, setSource] = useState('');
    const [productivity, setProductivity] = useState('1.5');
    const [busy, setBusy] = useState(false);
    const volume = values[source.replace(/^=/, '')];
    const validProductivity = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(
        productivity,
    );
    const days = validProductivity
        ? laborDays(volume, Number(productivity), Number(persons))
        : null;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (busy) {
                    return;
                }

                if (next) {
                    const current = parseLaborDaysFormula(formula);
                    setSource(
                        current
                            ? `=${current.source}`
                            : (sources.find((s) =>
                                  s.value.endsWith('.manual_volume'),
                              )?.value ??
                                  sources[0]?.value ??
                                  ''),
                    );
                    setProductivity(String(current?.productivity ?? 1.5));
                }

                setOpen(next);
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    className="labor-days-trigger absolute top-1/2 left-0.5 z-10 -translate-y-1/2 font-serif text-xs italic"
                    aria-label={
                        parseLaborDaysFormula(formula)
                            ? 'Edit auto-computed days'
                            : 'Auto-compute labor days'
                    }
                    disabled={disabled || !sources.length}
                    title={
                        disabled
                            ? 'Finish the current save or apply backup changes before configuring auto-computed days.'
                            : parseLaborDaysFormula(formula)
                              ? 'Auto-computed days: click to edit the volume and productivity formula.'
                              : 'Auto-compute days from backup volume, productivity, and this row’s No. of Persons.'
                    }
                >
                    <span aria-hidden="true">fx</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Auto-compute labor days</DialogTitle>
                    <DialogDescription>
                        Uses the No. of Persons from this labor row. Type a
                        number in the Days cell to return to manual entry.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="labor-days-volume">Backup volume</Label>
                        <select
                            id="labor-days-volume"
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                        >
                            {sources.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="labor-days-productivity">
                            Productivity (m³/person/day)
                        </Label>
                        <Input
                            id="labor-days-productivity"
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            value={productivity}
                            onChange={(e) => setProductivity(e.target.value)}
                        />
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p>
                            No. of Persons: <strong>{persons}</strong>
                        </p>
                        <p>
                            ROUNDUP({volume ?? '—'} ÷ {productivity || '—'} ÷{' '}
                            {persons || '—'}, 0)
                        </p>
                        <p className="mt-1 font-semibold">
                            Calculated days: {days ?? '—'}
                        </p>
                    </div>
                    {days === null && (
                        <p role="alert" className="text-xs text-destructive">
                            Apply the backup first to load its volume.
                            Productivity and No. of Persons must be greater than
                            zero.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        disabled={busy || days === null}
                        onClick={async () => {
                            setBusy(true);

                            try {
                                if (
                                    await onApply(
                                        `=ROUNDUP(${source.slice(1)}/${productivity}/row.no_of_person,0)`,
                                    )
                                ) {
                                    setOpen(false);
                                }
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {busy ? 'Saving…' : 'Apply & Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
