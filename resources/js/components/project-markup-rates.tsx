import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export type MarkupRateBand = {
    id: number;
    minimum_amount: number;
    maximum_amount: number | null;
    ocm_percentage: number;
    profit_percentage: number;
    vat_percentage: number;
};

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
});

const compactPeso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const rangeLabel = (
    band: MarkupRateBand,
    previous?: MarkupRateBand,
    formatter = compactPeso,
) => {
    if (!previous) {
        return `Up to ${formatter.format(band.maximum_amount ?? 0)}`;
    }

    const lower = formatter.format(previous.maximum_amount ?? 0);

    return band.maximum_amount === null
        ? `Above ${lower}`
        : `Above ${lower} up to ${formatter.format(band.maximum_amount)}`;
};

export default function ProjectMarkupRates({
    allocatedAmount,
    bands,
}: {
    allocatedAmount: number | string | null;
    bands: MarkupRateBand[];
}) {
    const amount =
        allocatedAmount === null || allocatedAmount === ''
            ? null
            : Number(allocatedAmount);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs print:hidden"
                >
                    View rates
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Project markup rates</DialogTitle>
                    <DialogDescription
                        title={
                            amount === null
                                ? undefined
                                : `Allocated amount: ${peso.format(amount)}`
                        }
                    >
                        Reference for DUPA OCM, contractor&apos;s profit, and
                        VAT.
                        {amount === null
                            ? ' Set an allocated amount to identify the applicable row.'
                            : ` Allocated amount: ${compactPeso.format(amount)}.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2 font-medium">
                                    Allocated amount
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                    OCM
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                    Profit
                                </th>
                                <th className="px-3 py-2 text-right font-medium">
                                    VAT
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {bands.map((band, index) => {
                                const selected =
                                    amount !== null &&
                                    amount >= Number(band.minimum_amount) &&
                                    (band.maximum_amount === null ||
                                        amount <= Number(band.maximum_amount));

                                return (
                                    <tr
                                        key={band.id}
                                        className={`border-b last:border-b-0 ${selected ? 'bg-primary/10 font-semibold' : ''}`}
                                    >
                                        <td
                                            className="px-3 py-2"
                                            title={rangeLabel(
                                                band,
                                                bands[index - 1],
                                                peso,
                                            )}
                                        >
                                            {rangeLabel(band, bands[index - 1])}
                                            {selected && (
                                                <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                                                    Applicable
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {band.ocm_percentage}%
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {band.profit_percentage}%
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {band.vat_percentage}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
