import { Plus, Trash2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type MiscellaneousRow = {
    estimate_type: 'ADD' | 'NON_ADD';
    description: string;
    unit: string;
    amount: number | string;
    multiplier: number | string;
};
export default function MiscellaneousInputs({
    rows,
    onChange,
    errors = {},
    stacked = false,
}: {
    rows: MiscellaneousRow[];
    onChange: (rows: MiscellaneousRow[]) => void;
    errors?: Record<string, string>;
    stacked?: boolean;
}) {
    return (
        <div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Miscellaneous</h3>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            onChange([
                                ...rows,
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
                {rows.length === 0 && (
                    <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                        No miscellaneous charges. Add a row to enter an expense.
                    </div>
                )}
                {rows.length > 0 && !stacked && (
                    <div
                        className="hidden grid-cols-[minmax(6rem,0.8fr)_minmax(0,2fr)_minmax(4rem,0.6fr)_minmax(6rem,0.9fr)_minmax(5rem,0.7fr)_2rem] gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground md:grid"
                        aria-hidden="true"
                    >
                        <span>Estimate side</span>
                        <span>Description</span>
                        <span>Unit</span>
                        <span className="text-right">Amount</span>
                        <span className="text-right">Multiplier</span>
                        <span />
                    </div>
                )}
                {rows.map((row, index) => (
                    <div
                        className={`grid grid-cols-2 items-end gap-2 rounded-md border bg-muted/10 p-2 ${stacked ? '' : 'md:grid-cols-[minmax(6rem,0.8fr)_minmax(0,2fr)_minmax(4rem,0.6fr)_minmax(6rem,0.9fr)_minmax(5rem,0.7fr)_2rem] md:border-0 md:py-0'}`}
                        key={index}
                    >
                        <label className="space-y-1 text-xs text-muted-foreground">
                            <span className={stacked ? undefined : 'md:hidden'}>
                                Estimate side
                            </span>
                            <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                aria-label={`Miscellaneous row ${index + 1} estimate side`}
                                value={row.estimate_type}
                                onChange={(e) => {
                                    const updated = [...rows];
                                    updated[index] = {
                                        ...row,
                                        estimate_type: e.target.value as
                                            'ADD' | 'NON_ADD',
                                    };
                                    onChange(updated);
                                }}
                            >
                                <option value="ADD">ADD</option>
                                <option value="NON_ADD">NON-ADD</option>
                            </select>
                        </label>
                        {(
                            [
                                'description',
                                'unit',
                                'amount',
                                'multiplier',
                            ] as const
                        ).map((key) => (
                            <label
                                key={key}
                                className={`min-w-0 space-y-1 text-xs text-muted-foreground ${key === 'description' ? (stacked ? 'col-span-2' : 'col-span-2 md:col-span-1') : ''}`}
                            >
                                <span
                                    className={
                                        stacked
                                            ? 'capitalize'
                                            : 'capitalize md:hidden'
                                    }
                                >
                                    {key}
                                </span>
                                <Input
                                    className={
                                        key === 'amount' || key === 'multiplier'
                                            ? 'h-8 bg-background text-right tabular-nums'
                                            : 'h-8 bg-background'
                                    }
                                    type={
                                        key === 'amount' || key === 'multiplier'
                                            ? 'number'
                                            : 'text'
                                    }
                                    min="0"
                                    step="0.0001"
                                    aria-label={`Miscellaneous row ${index + 1} ${key}`}
                                    placeholder={key}
                                    value={row[key]}
                                    onChange={(e) => {
                                        const updated = [...rows];
                                        updated[index] = {
                                            ...row,
                                            [key]: e.target.value,
                                        };
                                        onChange(updated);
                                    }}
                                />
                            </label>
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove miscellaneous row ${index + 1}`}
                            onClick={() =>
                                onChange(rows.filter((_, i) => i !== index))
                            }
                        >
                            <Trash2 />
                        </Button>
                    </div>
                ))}
            </div>
            {Object.entries(errors)
                .filter(([key]) => key.startsWith('miscellaneous'))
                .map(([key, message]) => (
                    <InputError key={key} message={message} />
                ))}
        </div>
    );
}
