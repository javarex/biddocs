import './dupa-worksheet.css';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import BackupDaysCell from '@/components/backup-days-cell';
import DupaBackups, {
    usedBackupKeys,
    stableJson,
    documentFor,
} from '@/components/dupa-backups';
import type { BackupEstimate, BackupTemplate } from '@/components/dupa-backups';
import ItemSyncDialog from '@/components/item-sync-dialog';
import type { SyncCategory } from '@/components/item-sync-dialog';
import PageHeader from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { estimateDraftKey } from '@/lib/estimate-draft-key';
import { laborDays, parseLaborDaysFormula } from '@/lib/labor-days-formula';

type Side = 'ADD' | 'NON_ADD';
type LaborCatalog = {
    id: number;
    manpower: string;
    rates: number;
    types: string;
};
type EquipmentCatalog = { id: number; equipment: string; rental: number };
type ItemCatalog = {
    id: number;
    itemcode: string;
    description: string;
    unit: string;
    price: number;
};
type LaborRow = {
    row_uuid?: string;
    labor_id: number | string;
    designation: string;
    no_of_person: number | string;
    no_of_days: number | string;
    rate: number | string;
    is_included: boolean;
};
type EquipmentRow = {
    row_uuid?: string;
    equipment_id: number;
    designation: string;
    no_of_units: number | string;
    no_of_days: number | string;
    rental_unit_cost: number | string;
    is_included: boolean;
};
type ItemRow = {
    row_uuid?: string;
    item_id: number;
    designation: string;
    unit: string;
    qty: number | string;
    unit_cost: number | string;
    group: string | null;
    is_included: boolean;
};
type ItemDraft = {
    item_id: string;
    item_search: string;
    qty: number | string;
    group: string;
};
type Estimate = BackupEstimate & {
    calculation_mode: string;
    quantity: number | string;
    ocm_percentage: number | string;
    profit_percentage: number | string;
    vat_percentage: number | string;
    direct_cost: number;
    total_cost: number;
    labors: LaborRow[];
    equipment: EquipmentRow[];
    items: ItemRow[];
};
type Section = {
    id: number;
    section: string;
    sub_sections: { id: number; sub_section: string }[];
};
type Props = {
    backupTemplates: BackupTemplate[];
    embedded?: boolean;
    csrf_token: string;
    canCreateResources: boolean;
    canSyncItems: boolean;
    canSyncPrices: boolean;
    syncCategories: SyncCategory[];
    project: {
        id: number;
        project_code: string | null;
        project_name: string;
        allocated_amount: number | null;
    };
    markupRates: {
        ocm_percentage: number;
        profit_percentage: number;
        vat_percentage: number;
    } | null;
    dupa: {
        id: number;
        section_id: number;
        sub_section_id: number | null;
        pay_item_no: string;
        description: string;
        unit: string;
        sort_order: number;
        estimates: Record<Side, Estimate>;
    };
    sections: Section[];
    catalogs: {
        labors: LaborCatalog[];
        equipment: EquipmentCatalog[];
        items: ItemCatalog[];
    };
    itemGroups: string[];
    navigation: {
        previous_id: number | null;
        next_id: number | null;
        position: number;
        total: number;
    };
};

const number = (value: string | number) => Number(value) || 0;
const money = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});
const laborGrid =
    'grid-cols-[2rem_minmax(12rem,2fr)_minmax(5rem,0.7fr)_minmax(5rem,0.7fr)_minmax(6rem,0.8fr)_minmax(7rem,0.9fr)_4rem_8rem]';
const itemGrid =
    'grid-cols-[2rem_minmax(13rem,2fr)_minmax(4rem,0.5fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_4rem_8rem]';
const supersededItemNotice =
    /^\s*\((?:do not use this code anymore|please use item code\b[^)]*)\)/i;

export default function DupaEdit({
    backupTemplates,
    embedded = false,
    csrf_token,
    canCreateResources,
    canSyncItems,
    canSyncPrices,
    syncCategories,
    project,
    dupa,
    sections,
    catalogs,
    itemGroups,
    navigation,
}: Props) {
    const details = useForm({
        section_id: dupa.section_id,
        sub_section_id: dupa.sub_section_id,
        pay_item_no: dupa.pay_item_no,
        description: dupa.description,
        unit: dupa.unit,
        sort_order: dupa.sort_order,
    });
    const [side, setSide] = useState<Side>('ADD');
    const [estimates, setEstimates] = useState<Record<Side, Estimate>>(
        dupa.estimates,
    );
    const laborCatalog = catalogs.labors;
    const [equipmentCatalog, setEquipmentCatalog] = useState(
        catalogs.equipment,
    );
    const itemCatalog = catalogs.items;
    const [savedEstimateKeys, setSavedEstimateKeys] = useState<
        Record<Side, string>
    >({
        ADD: estimateDraftKey(dupa.estimates.ADD),
        NON_ADD: estimateDraftKey(dupa.estimates.NON_ADD),
    });
    const dirty = useMemo(
        () => ({
            ADD: estimateDraftKey(estimates.ADD) !== savedEstimateKeys.ADD,
            NON_ADD:
                estimateDraftKey(estimates.NON_ADD) !==
                savedEstimateKeys.NON_ADD,
        }),
        [estimates, savedEstimateKeys],
    );
    const [savedBackupTemplates, setSavedBackupTemplates] =
        useState(backupTemplates);
    const [backupDirty, setBackupDirty] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [itemDrafts, setItemDrafts] = useState<Record<Side, ItemDraft>>({
        ADD: {
            item_id: '',
            item_search: '',
            qty: 1,
            group:
                [...dupa.estimates.ADD.items]
                    .reverse()
                    .find((row) => row.group?.trim())?.group ?? '',
        },
        NON_ADD: {
            item_id: '',
            item_search: '',
            qty: 1,
            group:
                [...dupa.estimates.NON_ADD.items]
                    .reverse()
                    .find((row) => row.group?.trim())?.group ?? '',
        },
    });
    const [estimateErrors, setEstimateErrors] = useState<
        Record<string, string>
    >({});
    const estimate = estimates[side];
    const notifyParentOfSave = () => {
        if (embedded && window.parent !== window) {
            window.parent.postMessage(
                { type: 'biddocs:dupa-saved', dupaId: dupa.id },
                window.location.origin,
            );
        }
    };
    const itemDraft = itemDrafts[side];
    const selectedItem = itemCatalog.find(
        (item) => item.id === Number(itemDraft.item_id),
    );
    const groupOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...itemGroups,
                    ...Object.values(estimates).flatMap((entry) =>
                        entry.items
                            .map((row) => row.group?.trim())
                            .filter((group): group is string => Boolean(group)),
                    ),
                ]),
            ).sort((a, b) => a.localeCompare(b)),
        [estimates, itemGroups],
    );
    const bound = (kind: string, field: string, uuid?: string) =>
        Boolean(
            estimate.backup_applied?.document.bindings.some(
                (b) =>
                    b.kind === kind && b.field === field && b.row_uuid === uuid,
            ),
        );
    const resultPicker = (
        kind: 'labors' | 'equipment' | 'items',
        field: string,
        uuid?: string,
    ) => {
        const binding = estimate.backup_applied?.document.bindings.find(
            (b) => b.kind === kind && b.field === field && b.row_uuid === uuid,
        );
        const options = (estimate.backups ?? []).flatMap((b) =>
            b.definition.outputs.map((o) => ({
                value: `=${b.key}.outputs.${o.key}`,
                label: `${b.name} / ${o.label}`,
            })),
        );

        return (
            <select
                aria-label={`Value source for ${kind} ${uuid ?? 'unsaved'} ${field}`}
                className="w-full min-w-0 rounded border bg-background px-1 py-1 text-xs"
                disabled={saving || backupDirty || !uuid}
                value={binding?.formula ?? ''}
                onChange={(e) =>
                    void switchResult(kind, field, uuid!, e.target.value)
                }
            >
                <option value="">Direct count</option>
                {binding &&
                    !options.some((o) => o.value === binding.formula) && (
                        <option value={binding.formula}>
                            Custom backup formula
                        </option>
                    )}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        );
    };
    async function switchResult(
        kind: 'labors' | 'equipment' | 'items',
        field: string,
        uuid: string,
        formula: string,
        manualValue?: string,
    ): Promise<boolean> {
        let sourceEstimate = estimate;
        setSaving(true);
        setEstimateErrors({});

        try {
            if (backupDirty) {
                throw new Error(
                    'Apply or discard backup draft changes before linking a result.',
                );
            }

            if (dirty[side]) {
                const response = await fetch(
                    `/admin/dupas/${dupa.id}/estimates/${side}`,
                    {
                        method: 'PUT',
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrf_token,
                        },
                        body: JSON.stringify(sourceEstimate),
                    },
                );
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(
                        Object.values(payload.errors ?? {})
                            .flat()
                            .join(' ') ||
                            payload.message ||
                            'Unable to save estimate changes.',
                    );
                }

                sourceEstimate = payload.estimate as Estimate;
                const savedKey = estimateDraftKey(sourceEstimate);
                const savedEstimate = sourceEstimate;
                setEstimates((current) => ({
                    ...current,
                    [side]: savedEstimate,
                }));
                setSavedEstimateKeys((current) => ({
                    ...current,
                    [side]: savedKey,
                }));
                notifyParentOfSave();
            }

            const document = {
                backups: (sourceEstimate.backups ?? []).map(
                    ({
                        key,
                        owner_type,
                        owner_uuid,
                        name,
                        schema_version,
                        definition,
                    }) => ({
                        key,
                        owner_type,
                        owner_uuid,
                        name,
                        schema_version,
                        definition,
                    }),
                ),
                bindings: [
                    ...(
                        sourceEstimate.backup_applied?.document.bindings ?? []
                    ).filter(
                        (b) =>
                            !(
                                b.kind === kind &&
                                b.field === field &&
                                b.row_uuid === uuid
                            ),
                    ),
                    ...(formula
                        ? [{ kind, field, row_uuid: uuid, formula }]
                        : []),
                ],
            };

            // Preserve saved drafts; the user must apply them deliberately in the backup editor.
            if (
                stableJson(documentFor(sourceEstimate)) !==
                stableJson(
                    sourceEstimate.backup_applied?.document ?? {
                        backups: [],
                        bindings: [],
                    },
                )
            ) {
                throw new Error(
                    'Apply the saved backup draft before changing a value source. Open Backups, then Apply & Save.',
                );
            }

            const post = async (action: string, token?: string) => {
                const response = await fetch(
                    `/admin/dupas/${dupa.id}/estimates/${side}/backups/${action}`,
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrf_token,
                        },
                        body: JSON.stringify({
                            revision: sourceEstimate.backup_revision ?? 0,
                            document,
                            preview_token: token,
                        }),
                    },
                );
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(
                        Object.values(payload.errors ?? {})
                            .flat()
                            .join(' ') ||
                            payload.message ||
                            'Unable to change value source.',
                    );
                }

                return payload;
            };
            const preview = await post('preview');
            const saved = await post('apply', preview.preview_token);
            const savedEstimate = saved.estimate as Estimate;
            setSavedEstimateKeys((current) => ({
                ...current,
                [side]: estimateDraftKey(savedEstimate),
            }));
            const next =
                manualValue !== undefined && kind === 'labors'
                    ? {
                          ...savedEstimate,
                          labors: savedEstimate.labors.map((row) =>
                              row.row_uuid === uuid
                                  ? { ...row, no_of_days: manualValue }
                                  : row,
                          ),
                      }
                    : savedEstimate;

            setEstimates((current) => ({ ...current, [side]: next }));
            notifyParentOfSave();

            return true;
        } catch (error) {
            setEstimateErrors({
                backup:
                    error instanceof Error
                        ? error.message
                        : 'Unable to change value source.',
            });

            return false;
        } finally {
            setSaving(false);
        }
    }
    const setEstimate = (next: Estimate) => {
        next = {
            ...next,
            labors: next.labors.map((row) => ({
                ...row,
                row_uuid: row.row_uuid ?? crypto.randomUUID(),
            })),
            equipment: next.equipment.map((row) => ({
                ...row,
                row_uuid: row.row_uuid ?? crypto.randomUUID(),
            })),
            items: next.items.map((row) => ({
                ...row,
                row_uuid: row.row_uuid ?? crypto.randomUUID(),
            })),
        };
        next = {
            ...next,
            labors: next.labors.map((row) => {
                const binding = next.backup_applied?.document.bindings.find(
                    (b) =>
                        b.kind === 'labors' &&
                        b.field === 'no_of_days' &&
                        b.row_uuid === row.row_uuid,
                );
                const auto = parseLaborDaysFormula(binding?.formula);

                if (!auto) {
                    return row;
                }

                const days = laborDays(
                    next.backup_applied?.values?.[auto.source] ?? NaN,
                    auto.productivity,
                    Number(row.no_of_person),
                );

                return days === null ? row : { ...row, no_of_days: days };
            }),
        };
        setEstimates({ ...estimates, [side]: next });
    };
    const setItemDraft = (next: ItemDraft) =>
        setItemDrafts({ ...itemDrafts, [side]: next });
    const currentSection = sections.find(
        (section) => Number(section.id) === Number(details.data.section_id),
    );
    const computed = useMemo(() => {
        const labor = estimate.labors
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) =>
                    sum +
                    number(row.no_of_person) *
                        number(row.no_of_days) *
                        number(row.rate),
                0,
            );
        const equipment = estimate.equipment
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) =>
                    sum +
                    number(row.no_of_units) *
                        number(row.no_of_days) *
                        number(row.rental_unit_cost),
                0,
            );
        const items = estimate.items
            .filter((row) => row.is_included)
            .reduce(
                (sum, row) => sum + number(row.qty) * number(row.unit_cost),
                0,
            );
        const direct = labor + equipment + items;
        const ocm = (direct * number(estimate.ocm_percentage)) / 100;
        const profit = (direct * number(estimate.profit_percentage)) / 100;
        const vat =
            ((direct + ocm + profit) * number(estimate.vat_percentage)) / 100;
        const total = direct + ocm + profit + vat;

        return {
            labor,
            equipment,
            items,
            direct,
            ocm,
            profit,
            vat,
            total,
            unit:
                number(estimate.quantity) > 0
                    ? total / number(estimate.quantity)
                    : 0,
        };
    }, [estimate]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (
                !dirty.ADD &&
                !dirty.NON_ADD &&
                !backupDirty &&
                !details.isDirty
            ) {
                return;
            }

            event.preventDefault();
            event.returnValue = true;
        };

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, backupDirty, details.isDirty]);

    useEffect(() => {
        if (embedded && window.parent !== window) {
            window.parent.postMessage(
                {
                    type: 'biddocs:dupa-dirty',
                    dupaId: dupa.id,
                    dirty:
                        details.isDirty ||
                        dirty.ADD ||
                        dirty.NON_ADD ||
                        backupDirty,
                    saving,
                },
                window.location.origin,
            );
        }
    }, [embedded, dupa.id, details.isDirty, dirty, backupDirty, saving]);

    const saveEstimate = async () => {
        if (saving) {
            return;
        }

        if (backupDirty) {
            toast.error(
                'Apply or discard the open backup draft before saving all changes.',
            );

            return;
        }

        setSaving(true);
        setEstimateErrors({});
        details.clearErrors();
        const snapshot = structuredClone(details.data);
        const changed = (['ADD', 'NON_ADD'] as Side[]).filter(
            (type) => dirty[type],
        );

        try {
            const response = await fetch(`/admin/dupas/${dupa.id}/save-all`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf_token,
                },
                body: JSON.stringify({
                    details: snapshot,
                    estimates: Object.fromEntries(
                        changed.map((type) => [type, estimates[type]]),
                    ),
                }),
            });
            const payload = await response.json();

            if (!response.ok) {
                setEstimateErrors(
                    Object.fromEntries(
                        Object.entries(payload.errors ?? {}).map(
                            ([key, messages]) => [
                                key,
                                Array.isArray(messages)
                                    ? messages.join(' ')
                                    : String(messages),
                            ],
                        ),
                    ),
                );

                throw new Error(payload.message || 'Unable to save changes.');
            }

            const updated = payload.estimates as Record<Side, Estimate>;
            setEstimates(updated);
            setSavedEstimateKeys({
                ADD: estimateDraftKey(updated.ADD),
                NON_ADD: estimateDraftKey(updated.NON_ADD),
            });
            details.setDefaults(snapshot);
            notifyParentOfSave();
            toast.success('All DUPA changes saved.');
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Unable to save changes.',
            );
        } finally {
            setSaving(false);
        }
    };

    const changeSide = (next: Side) => {
        if (
            next !== side &&
            backupDirty &&
            !window.confirm('Discard unsaved backup changes?')
        ) {
            return;
        }

        setBackupDirty(false);
        setSide(next);
    };

    const moveBetweenCells = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (
            event.key !== 'Enter' ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
        ) {
            return;
        }

        const cell = event.target;

        if (!(cell instanceof HTMLInputElement) || !cell.dataset.sheetColumn) {
            return;
        }

        const section = cell.closest('[data-sheet-section]');
        const row = cell.closest('[data-sheet-row]');

        if (!section || !row) {
            return;
        }

        event.preventDefault();
        const rows = Array.from(section.querySelectorAll('[data-sheet-row]'));
        const next = rows[rows.indexOf(row) + (event.shiftKey ? -1 : 1)];
        const nextCell = next?.querySelector<HTMLInputElement>(
            `[data-sheet-column="${cell.dataset.sheetColumn}"]`,
        );
        nextCell?.focus();
        nextCell?.select();
    };

    const copyAddToNonAdd = () => {
        if (
            !window.confirm('Replace the NON-ADD estimate with a copy of ADD?')
        ) {
            return;
        }

        if (backupDirty || dirty.ADD || dirty.NON_ADD) {
            toast.error(
                'Save estimate and backup changes before copying ADD to NON-ADD.',
            );

            return;
        }

        router.post(
            `/admin/dupas/${dupa.id}/copy-add`,
            {
                add_revision: estimates.ADD.backup_revision ?? 0,
                non_add_revision: estimates.NON_ADD.backup_revision ?? 0,
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const updated = (page.props as unknown as Props).dupa
                        .estimates;
                    setEstimates(updated);
                    setSavedEstimateKeys({
                        ADD: estimateDraftKey(updated.ADD),
                        NON_ADD: estimateDraftKey(updated.NON_ADD),
                    });
                    setSide('NON_ADD');
                    notifyParentOfSave();
                },
                onError: () =>
                    toast.error(
                        'Unable to copy estimate. Reload and try again.',
                    ),
            },
        );
    };

    return (
        <>
            <Head title={`${dupa.pay_item_no} estimate`} />
            <div
                onKeyDown={moveBetweenCells}
                className={`dupa-worksheet ${embedded ? 'dupa-worksheet-embedded p-1.5' : 'p-2 md:p-3'}`}
            >
                {!embedded && (
                    <PageHeader
                        title={`${dupa.pay_item_no} · ${dupa.description}`}
                        description={[
                            project.project_code,
                            project.project_name,
                            `DUPA ${navigation.position} of ${navigation.total}`,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    />
                )}
                <Card inert={saving} className="dupa-details-card">
                    <CardContent className="dupa-details-content">
                        <details
                            className="dupa-item-details"
                            open={embedded ? undefined : true}
                        >
                            <summary className="dupa-item-summary">
                                <span className="dupa-details-code">
                                    {details.data.pay_item_no}
                                </span>
                                <span className="dupa-item-description">
                                    {details.data.description ||
                                        'Item description'}
                                </span>
                                <span className="dupa-item-unit">
                                    Unit: {details.data.unit || '—'}
                                </span>
                                <span className="dupa-item-edit-hint">
                                    Item details{' '}
                                    <ChevronDown className="size-3.5" />
                                </span>
                            </summary>
                            <form
                                className="dupa-details-form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void saveEstimate();
                                }}
                            >
                                <Field label="Item no.">
                                    <Input
                                        value={details.data.pay_item_no}
                                        onChange={(e) =>
                                            details.setData(
                                                'pay_item_no',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Description">
                                    <Input
                                        value={details.data.description}
                                        onChange={(e) =>
                                            details.setData(
                                                'description',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Unit">
                                    <Input
                                        value={details.data.unit}
                                        onChange={(e) =>
                                            details.setData(
                                                'unit',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </Field>
                                <Field label="Section">
                                    <select
                                        className="h-8 w-full rounded-md border px-3 text-sm"
                                        value={details.data.section_id}
                                        onChange={(e) => {
                                            details.setData(
                                                'section_id',
                                                Number(e.target.value),
                                            );
                                            details.setData(
                                                'sub_section_id',
                                                null,
                                            );
                                        }}
                                    >
                                        {sections.map((section) => (
                                            <option
                                                key={section.id}
                                                value={section.id}
                                            >
                                                {section.section}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Subsection">
                                    <select
                                        className="h-8 w-full rounded-md border px-3 text-sm"
                                        value={
                                            details.data.sub_section_id ?? ''
                                        }
                                        onChange={(e) =>
                                            details.setData(
                                                'sub_section_id',
                                                e.target.value
                                                    ? Number(e.target.value)
                                                    : null,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Directly under section
                                        </option>
                                        {currentSection?.sub_sections.map(
                                            (sub) => (
                                                <option
                                                    key={sub.id}
                                                    value={sub.id}
                                                >
                                                    {sub.sub_section}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </Field>
                                <Field label="Display order">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={details.data.sort_order}
                                        onChange={(e) =>
                                            details.setData(
                                                'sort_order',
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </Field>
                                {Object.keys(details.errors).length > 0 && (
                                    <div
                                        className="dupa-details-errors"
                                        role="alert"
                                    >
                                        {Object.entries(details.errors).map(
                                            ([field, message]) => (
                                                <p key={field}>{message}</p>
                                            ),
                                        )}
                                    </div>
                                )}
                            </form>
                        </details>
                    </CardContent>
                </Card>

                <div
                    inert={saving}
                    data-worksheet-toolbar
                    className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b bg-background/95 py-1 backdrop-blur"
                >
                    {(['ADD', 'NON_ADD'] as Side[]).map((value) => (
                        <Button
                            key={value}
                            className={
                                side === value ? 'sheet-tab-active' : undefined
                            }
                            variant={side === value ? 'default' : 'outline'}
                            disabled={saving}
                            onClick={() => changeSide(value)}
                        >
                            {value.replace('_', '-')}
                            {dirty[value] ? ' •' : ''}
                        </Button>
                    ))}
                    <div className="dupa-quantity-control">
                        <NumberField
                            label="Quantity"
                            readOnly={bound('estimate', 'quantity')}
                            value={estimate.quantity}
                            onChange={(value) =>
                                setEstimate({
                                    ...estimate,
                                    quantity: value,
                                })
                            }
                        />
                    </div>
                    <span className="dupa-toolbar-context">
                        Editing {side.replace('_', '-')} estimate
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={saving || dirty[side]}
                        onClick={() => setBackupOpen(true)}
                    >
                        Backups ({estimate.backups?.length ?? 0}) ·{' '}
                        {usedBackupKeys(estimate.backup_applied?.document).size}{' '}
                        in use
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={copyAddToNonAdd}
                        disabled={saving}
                    >
                        <Copy /> Copy ADD to NON-ADD
                    </Button>
                </div>
                <Dialog
                    open={backupOpen}
                    onOpenChange={(open) => {
                        if (open || saving) {
                            return;
                        }

                        if (
                            backupDirty &&
                            !window.confirm('Discard unsaved backup changes?')
                        ) {
                            return;
                        }

                        setBackupDirty(false);
                        setBackupOpen(false);
                    }}
                >
                    <DialogContent
                        className="flex h-[94vh] max-h-[94vh] w-[97vw] max-w-[97vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[97vw] [&>button]:text-white"
                        onInteractOutside={(event) => {
                            event.preventDefault();
                        }}
                    >
                        <DialogHeader className="gap-1 border-b bg-emerald-800 px-4 py-3 text-white [&_p]:text-emerald-100">
                            <DialogTitle>
                                Backup computation · {dupa.pay_item_no}
                            </DialogTitle>
                            <DialogDescription className="hidden sm:block">
                                {dupa.pay_item_no} · {side.replace('_', '-')} ·
                                Enter measurements in the worksheet. The backup
                                belongs to this DUPA item.
                            </DialogDescription>
                        </DialogHeader>
                        {backupOpen && (
                            <DupaBackups
                                key={`${side}-${estimate.backup_revision ?? 0}`}
                                dupaId={dupa.id}
                                side={side}
                                csrfToken={csrf_token}
                                estimate={estimate}
                                templates={savedBackupTemplates}
                                onTemplateSaved={(template) =>
                                    setSavedBackupTemplates((current) => [
                                        ...current,
                                        template,
                                    ])
                                }
                                onTemplateVisibilityChanged={(
                                    template,
                                    excluded,
                                ) =>
                                    setSavedBackupTemplates((current) =>
                                        excluded
                                            ? current.filter(
                                                  (t) => t.id !== template.id,
                                              )
                                            : [
                                                  ...current.filter(
                                                      (t) =>
                                                          t.id !== template.id,
                                                  ),
                                                  template,
                                              ],
                                    )
                                }
                                disabled={dirty[side] || saving}
                                onDirty={setBackupDirty}
                                onBusy={setSaving}
                                onSaved={(next) => {
                                    setSavedEstimateKeys((current) => ({
                                        ...current,
                                        [side]: estimateDraftKey(next),
                                    }));
                                    setEstimates((current) => ({
                                        ...current,
                                        [side]: next,
                                    }));
                                    setBackupDirty(false);
                                    notifyParentOfSave();
                                }}
                            />
                        )}
                    </DialogContent>
                </Dialog>
                {backupDirty && (
                    <p className="text-sm text-muted-foreground">
                        Save, apply, or discard the backup changes to continue
                        editing the estimate.
                    </p>
                )}
                <Card
                    inert={backupDirty || saving}
                    className={`dupa-analysis ${backupDirty ? 'opacity-60' : ''}`}
                >
                    <CardHeader>
                        <CardTitle>
                            Resources &amp; cost breakdown{' '}
                            <span className="text-xs font-normal">
                                · {side.replace('_', '-')}
                            </span>
                        </CardTitle>
                        <CardDescription>
                            {estimate.calculation_mode === 'imported_summary'
                                ? 'This is an imported summary. Saving converts it to a resource-calculated estimate and replaces the imported total.'
                                : 'Add labor, equipment, and materials below. Review the totals, then save all changes.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="dupa-analysis-layout">
                            <div className="dupa-analysis-main space-y-2">
                                <div
                                    data-sheet-section="labor"
                                    className="dupa-resource-sheet border"
                                >
                                    <div>
                                        <h3 className="font-semibold">
                                            A. Labor
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Select labor to automatically fill
                                            its rate.
                                        </p>
                                    </div>
                                    <div
                                        data-sheet-grid
                                        className="overflow-x-auto"
                                    >
                                        {estimate.labors.length > 0 && (
                                            <ResourceColumns
                                                columns="#,Labor,Persons,Days,Rate,Amount,Include"
                                                className={`${laborGrid} min-w-[54rem]`}
                                            />
                                        )}
                                        {estimate.labors.length === 0 && (
                                            <p className="rounded-md border border-dashed px-2 py-2 text-center text-xs text-muted-foreground">
                                                No labor rows yet. Click Add
                                                labor to begin.
                                            </p>
                                        )}
                                        {estimate.labors.map((row, index) => (
                                            <div
                                                data-sheet-row
                                                className={`grid min-w-[54rem] items-center gap-1 border-b py-1 last:border-b-0 hover:bg-muted/30 ${laborGrid}`}
                                                key={index}
                                            >
                                                <span className="text-center text-xs text-muted-foreground tabular-nums">
                                                    {index + 1}
                                                </span>
                                                <div className="flex min-w-0">
                                                    <select
                                                        aria-label={`Labor row ${index + 1}`}
                                                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-sm"
                                                        value={row.labor_id}
                                                        onChange={(event) => {
                                                            const selected =
                                                                laborCatalog.find(
                                                                    (item) =>
                                                                        item.id ===
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                );

                                                            if (selected) {
                                                                updateLabor(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        labor_id:
                                                                            selected.id,
                                                                        designation:
                                                                            selected.manpower,
                                                                        rate: selected.rates,
                                                                    },
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <option
                                                            value=""
                                                            disabled
                                                        >
                                                            Select labor
                                                        </option>
                                                        {laborCatalog.map(
                                                            (item) => (
                                                                <option
                                                                    key={
                                                                        item.id
                                                                    }
                                                                    value={
                                                                        item.id
                                                                    }
                                                                >
                                                                    {
                                                                        item.manpower
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </div>
                                                <div className="dupa-cell">
                                                    <Input
                                                        data-sheet-column="persons"
                                                        aria-label={`Number of persons for labor row ${index + 1}`}
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        placeholder="No. of persons"
                                                        value={row.no_of_person}
                                                        readOnly={bound(
                                                            'labors',
                                                            'no_of_person',
                                                            row.row_uuid,
                                                        )}
                                                        onChange={(e) =>
                                                            updateLabor(index, {
                                                                ...row,
                                                                no_of_person:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <BackupDaysCell
                                                    key={`${side}-${row.row_uuid ?? index}`}
                                                    label={`Number of days for labor row ${index + 1}`}
                                                    autoCompute={{
                                                        persons:
                                                            row.no_of_person,
                                                        formula:
                                                            estimate.backup_applied?.document.bindings.find(
                                                                (b) =>
                                                                    b.kind ===
                                                                        'labors' &&
                                                                    b.field ===
                                                                        'no_of_days' &&
                                                                    b.row_uuid ===
                                                                        row.row_uuid,
                                                            )?.formula,
                                                        sources: (
                                                            estimate.backups ??
                                                            []
                                                        ).flatMap((b) =>
                                                            b.definition.outputs.map(
                                                                (o) => ({
                                                                    value: `=${b.key}.outputs.${o.key}`,
                                                                    label: `${b.name} / ${o.label}`,
                                                                }),
                                                            ),
                                                        ),
                                                        values:
                                                            estimate
                                                                .backup_applied
                                                                ?.values ?? {},
                                                        disabled:
                                                            saving ||
                                                            backupDirty ||
                                                            !row.row_uuid,
                                                        onApply: (formula) =>
                                                            switchResult(
                                                                'labors',
                                                                'no_of_days',
                                                                row.row_uuid!,
                                                                formula,
                                                            ),
                                                    }}
                                                    value={row.no_of_days}
                                                    formula={
                                                        estimate.backup_applied?.document.bindings.find(
                                                            (b) =>
                                                                b.kind ===
                                                                    'labors' &&
                                                                b.field ===
                                                                    'no_of_days' &&
                                                                b.row_uuid ===
                                                                    row.row_uuid,
                                                        )?.formula
                                                    }
                                                    options={(
                                                        estimate.backups ?? []
                                                    ).flatMap((b) =>
                                                        b.definition.outputs.map(
                                                            (o) => ({
                                                                value: `=${b.key}.outputs.${o.key}`,
                                                                label: `${b.name} / ${o.label}`,
                                                            }),
                                                        ),
                                                    )}
                                                    disabled={saving}
                                                    canLink={
                                                        !saving &&
                                                        !backupDirty &&
                                                        Boolean(row.row_uuid)
                                                    }
                                                    onResult={(formula) =>
                                                        switchResult(
                                                            'labors',
                                                            'no_of_days',
                                                            row.row_uuid!,
                                                            formula,
                                                        )
                                                    }
                                                    onManual={async (value) => {
                                                        if (
                                                            bound(
                                                                'labors',
                                                                'no_of_days',
                                                                row.row_uuid,
                                                            )
                                                        ) {
                                                            return switchResult(
                                                                'labors',
                                                                'no_of_days',
                                                                row.row_uuid!,
                                                                '',
                                                                value,
                                                            );
                                                        }

                                                        updateLabor(index, {
                                                            ...row,
                                                            no_of_days: value,
                                                        });

                                                        return true;
                                                    }}
                                                />
                                                <div className="dupa-cell">
                                                    <Input
                                                        data-sheet-column="rate"
                                                        aria-label={`Rate for labor row ${index + 1}`}
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Rate"
                                                        value={row.rate}
                                                        readOnly={bound(
                                                            'labors',
                                                            'rate',
                                                            row.row_uuid,
                                                        )}
                                                        onChange={(e) =>
                                                            updateLabor(index, {
                                                                ...row,
                                                                rate: e.target
                                                                    .value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <output
                                                    className="pr-1 text-right text-xs font-medium tabular-nums"
                                                    aria-label={`Labor row ${index + 1} amount`}
                                                >
                                                    {money.format(
                                                        number(
                                                            row.no_of_person,
                                                        ) *
                                                            number(
                                                                row.no_of_days,
                                                            ) *
                                                            number(row.rate),
                                                    )}
                                                </output>
                                                <Include
                                                    checked={row.is_included}
                                                    compact={embedded}
                                                    onChange={(checked) =>
                                                        updateLabor(index, {
                                                            ...row,
                                                            is_included:
                                                                checked,
                                                        })
                                                    }
                                                />
                                                <div className="flex items-center justify-end gap-1">
                                                    <Remove
                                                        onClick={() =>
                                                            setEstimate({
                                                                ...estimate,
                                                                labors: estimate.labors.filter(
                                                                    (_, i) =>
                                                                        i !==
                                                                        index,
                                                                ),
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div
                                        data-sheet-picker
                                        className="flex justify-center"
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="sheet-add-labor"
                                            variant="link"
                                            onClick={() =>
                                                setEstimate({
                                                    ...estimate,
                                                    labors: [
                                                        ...estimate.labors,
                                                        {
                                                            labor_id: '',
                                                            designation: '',
                                                            no_of_person: 1,
                                                            no_of_days: 1,
                                                            rate: '',
                                                            is_included: true,
                                                        },
                                                    ],
                                                })
                                            }
                                        >
                                            Add labor
                                        </Button>
                                    </div>
                                </div>

                                <div
                                    data-sheet-section="equipment"
                                    className="dupa-resource-sheet border"
                                >
                                    <div className="dupa-section-heading">
                                        <h3 className="font-semibold">
                                            B. Equipment
                                        </h3>
                                    </div>
                                    <div
                                        data-sheet-grid
                                        className="overflow-x-auto"
                                    >
                                        {estimate.equipment.length > 0 && (
                                            <ResourceColumns
                                                columns="#,Equipment,Units,Days,Rental,Amount,Include"
                                                className={`${laborGrid} min-w-[54rem]`}
                                            />
                                        )}
                                        {estimate.equipment.map(
                                            (row, index) => (
                                                <div
                                                    data-sheet-row
                                                    className={`grid min-w-[54rem] items-center gap-1 border-b py-1 last:border-b-0 hover:bg-muted/30 ${laborGrid}`}
                                                    key={index}
                                                >
                                                    <span className="text-center text-xs text-muted-foreground tabular-nums">
                                                        {index + 1}
                                                    </span>
                                                    <div className="dupa-cell">
                                                        <select
                                                            aria-label={`Equipment row ${index + 1}`}
                                                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                                                            value={
                                                                row.equipment_id
                                                            }
                                                            onChange={(e) => {
                                                                const selected =
                                                                    equipmentCatalog.find(
                                                                        (x) =>
                                                                            x.id ===
                                                                            Number(
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            ),
                                                                    )!;
                                                                updateEquipment(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        equipment_id:
                                                                            selected.id,
                                                                        designation:
                                                                            selected.equipment,
                                                                        rental_unit_cost:
                                                                            selected.rental,
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            {equipmentCatalog.map(
                                                                (item) => (
                                                                    <option
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        value={
                                                                            item.id
                                                                        }
                                                                    >
                                                                        {
                                                                            item.equipment
                                                                        }
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div className="dupa-cell">
                                                        <Input
                                                            data-sheet-column="units"
                                                            aria-label={`Units for equipment row ${index + 1}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.0001"
                                                            title="Units"
                                                            value={
                                                                row.no_of_units
                                                            }
                                                            readOnly={bound(
                                                                'equipment',
                                                                'no_of_units',
                                                                row.row_uuid,
                                                            )}
                                                            onChange={(e) =>
                                                                updateEquipment(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        no_of_units:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <Input
                                                            data-sheet-column="days"
                                                            aria-label={`Days for equipment row ${index + 1}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.0001"
                                                            title="Days"
                                                            value={
                                                                row.no_of_days
                                                            }
                                                            readOnly={bound(
                                                                'equipment',
                                                                'no_of_days',
                                                                row.row_uuid,
                                                            )}
                                                            onChange={(e) =>
                                                                updateEquipment(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        no_of_days:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                        {resultPicker(
                                                            'equipment',
                                                            'no_of_days',
                                                            row.row_uuid,
                                                        )}
                                                    </div>
                                                    <div className="dupa-cell">
                                                        <Input
                                                            data-sheet-column="rental"
                                                            aria-label={`Rental for equipment row ${index + 1}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            title="Rental"
                                                            value={
                                                                row.rental_unit_cost
                                                            }
                                                            readOnly={bound(
                                                                'equipment',
                                                                'rental_unit_cost',
                                                                row.row_uuid,
                                                            )}
                                                            onChange={(e) =>
                                                                updateEquipment(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        rental_unit_cost:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <output
                                                        className="pr-1 text-right text-xs font-medium tabular-nums"
                                                        aria-label={`Equipment row ${index + 1} amount`}
                                                    >
                                                        {money.format(
                                                            number(
                                                                row.no_of_units,
                                                            ) *
                                                                number(
                                                                    row.no_of_days,
                                                                ) *
                                                                number(
                                                                    row.rental_unit_cost,
                                                                ),
                                                        )}
                                                    </output>
                                                    <Include
                                                        checked={
                                                            row.is_included
                                                        }
                                                        compact={embedded}
                                                        onChange={(checked) =>
                                                            updateEquipment(
                                                                index,
                                                                {
                                                                    ...row,
                                                                    is_included:
                                                                        checked,
                                                                },
                                                            )
                                                        }
                                                    />
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Remove
                                                            onClick={() =>
                                                                setEstimate({
                                                                    ...estimate,
                                                                    equipment:
                                                                        estimate.equipment.filter(
                                                                            (
                                                                                _,
                                                                                i,
                                                                            ) =>
                                                                                i !==
                                                                                index,
                                                                        ),
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                    <ResourcePicker
                                        title="Equipment"
                                        items={equipmentCatalog.map((item) => ({
                                            id: item.id,
                                            label: `${item.equipment} · ${money.format(item.rental)}`,
                                        }))}
                                        onAdd={(id) => {
                                            const item = equipmentCatalog.find(
                                                (entry) => entry.id === id,
                                            );

                                            if (item) {
                                                setEstimate({
                                                    ...estimate,
                                                    equipment: [
                                                        ...estimate.equipment,
                                                        {
                                                            equipment_id:
                                                                item.id,
                                                            designation:
                                                                item.equipment,
                                                            no_of_units: 1,
                                                            no_of_days: 1,
                                                            rental_unit_cost:
                                                                item.rental,
                                                            is_included: true,
                                                        },
                                                    ],
                                                });
                                            }
                                        }}
                                        quickCreate={
                                            canCreateResources ? (
                                                <QuickEquipmentCreate
                                                    csrfToken={csrf_token}
                                                    onCreated={(item) => {
                                                        setEquipmentCatalog(
                                                            (current) =>
                                                                [
                                                                    ...current,
                                                                    item,
                                                                ].sort((a, b) =>
                                                                    a.equipment.localeCompare(
                                                                        b.equipment,
                                                                    ),
                                                                ),
                                                        );
                                                        setEstimate({
                                                            ...estimate,
                                                            equipment: [
                                                                ...estimate.equipment,
                                                                {
                                                                    equipment_id:
                                                                        item.id,
                                                                    designation:
                                                                        item.equipment,
                                                                    no_of_units: 1,
                                                                    no_of_days: 1,
                                                                    rental_unit_cost:
                                                                        item.rental,
                                                                    is_included: true,
                                                                },
                                                            ],
                                                        });
                                                    }}
                                                />
                                            ) : undefined
                                        }
                                    />
                                </div>

                                <div
                                    data-sheet-section="items"
                                    className="dupa-resource-sheet border"
                                >
                                    <div className="dupa-section-heading">
                                        <h3 className="font-semibold">
                                            C. Materials
                                        </h3>
                                    </div>
                                    <div
                                        data-sheet-grid
                                        className="overflow-x-auto"
                                    >
                                        {estimate.items.length > 0 && (
                                            <ResourceColumns
                                                columns="#,Material,Unit,Unit cost,Quantity,Group,Amount,Include"
                                                className={`${itemGrid} min-w-[62rem]`}
                                            />
                                        )}
                                        {estimate.items.map((row, index) => (
                                            <div key={index}>
                                                <div
                                                    data-sheet-row
                                                    className={`grid min-w-[62rem] items-center gap-1 ${itemGrid}`}
                                                >
                                                    <span className="text-center text-xs text-muted-foreground tabular-nums">
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex min-h-8 items-center text-sm">
                                                        {
                                                            itemCatalog.find(
                                                                (item) =>
                                                                    item.id ===
                                                                    row.item_id,
                                                            )?.itemcode
                                                        }{' '}
                                                        · {row.designation}
                                                    </div>
                                                    <div className="flex min-h-8 items-center text-sm">
                                                        {row.unit}
                                                    </div>
                                                    <div className="flex min-h-8 items-center text-sm tabular-nums">
                                                        {money.format(
                                                            number(
                                                                row.unit_cost,
                                                            ),
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <Input
                                                            data-sheet-column="quantity"
                                                            aria-label={`Quantity for item row ${index + 1}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.0001"
                                                            title="Quantity"
                                                            value={row.qty}
                                                            readOnly={bound(
                                                                'items',
                                                                'qty',
                                                                row.row_uuid,
                                                            )}
                                                            onChange={(event) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        qty: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                        {resultPicker(
                                                            'items',
                                                            'qty',
                                                            row.row_uuid,
                                                        )}
                                                    </div>
                                                    <div className="dupa-cell">
                                                        <Input
                                                            data-sheet-column="group"
                                                            aria-label={`Group for item row ${index + 1}`}
                                                            list="project-item-groups"
                                                            maxLength={255}
                                                            placeholder="Group (optional)"
                                                            title="Group (optional)"
                                                            value={
                                                                row.group ?? ''
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        ...row,
                                                                        group: event
                                                                            .target
                                                                            .value,
                                                                    },
                                                                );
                                                                setItemDraft({
                                                                    ...itemDraft,
                                                                    group: event
                                                                        .target
                                                                        .value,
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <output
                                                        className="pr-1 text-right text-xs font-medium tabular-nums"
                                                        aria-label={`Item row ${index + 1} amount`}
                                                    >
                                                        {money.format(
                                                            number(row.qty) *
                                                                number(
                                                                    row.unit_cost,
                                                                ),
                                                        )}
                                                    </output>
                                                    <Include
                                                        checked={
                                                            row.is_included
                                                        }
                                                        compact={embedded}
                                                        onChange={(checked) =>
                                                            updateItem(index, {
                                                                ...row,
                                                                is_included:
                                                                    checked,
                                                            })
                                                        }
                                                    />
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Remove
                                                            onClick={() =>
                                                                setEstimate({
                                                                    ...estimate,
                                                                    items: estimate.items.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            index,
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div
                                        data-sheet-picker
                                        className="space-y-2 rounded-md border bg-muted/20 p-2"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                Add material
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {itemCatalog.length} catalog
                                                item(s)
                                            </span>
                                        </div>
                                        <div className="dupa-material-entry grid gap-2">
                                            <div className="flex min-w-0 gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <ItemPicker
                                                        key={side}
                                                        items={itemCatalog}
                                                        value={
                                                            itemDraft.item_search
                                                        }
                                                        onChange={(
                                                            item,
                                                            search,
                                                        ) =>
                                                            setItemDraft({
                                                                ...itemDraft,
                                                                item_id: item
                                                                    ? String(
                                                                          item.id,
                                                                      )
                                                                    : '',
                                                                item_search:
                                                                    search,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                {canSyncItems && (
                                                    <ItemSyncDialog
                                                        categories={
                                                            syncCategories
                                                        }
                                                        canSyncPrices={
                                                            canSyncPrices
                                                        }
                                                        compact
                                                        onSynced={(message) =>
                                                            toast.success(
                                                                message,
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                            <Input
                                                aria-label="Selected item unit"
                                                title="Unit"
                                                placeholder="Unit"
                                                value={selectedItem?.unit ?? ''}
                                                readOnly
                                                className="bg-muted/40"
                                            />
                                            <Input
                                                aria-label="Selected item price"
                                                title="Current item price"
                                                placeholder="Price"
                                                value={
                                                    selectedItem
                                                        ? money.format(
                                                              selectedItem.price,
                                                          )
                                                        : ''
                                                }
                                                readOnly
                                                className="bg-muted/40 tabular-nums"
                                            />
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.0001"
                                                title="Quantity"
                                                placeholder="Quantity"
                                                value={itemDraft.qty}
                                                onChange={(event) =>
                                                    setItemDraft({
                                                        ...itemDraft,
                                                        qty: event.target.value,
                                                    })
                                                }
                                            />
                                            <Input
                                                list="project-item-groups"
                                                maxLength={255}
                                                title="Group"
                                                placeholder="Group (optional)"
                                                value={itemDraft.group}
                                                onChange={(event) =>
                                                    setItemDraft({
                                                        ...itemDraft,
                                                        group: event.target
                                                            .value,
                                                    })
                                                }
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    !itemDraft.item_id ||
                                                    itemDraft.qty === '' ||
                                                    number(itemDraft.qty) < 0
                                                }
                                                onClick={() => {
                                                    const item =
                                                        itemCatalog.find(
                                                            (entry) =>
                                                                entry.id ===
                                                                Number(
                                                                    itemDraft.item_id,
                                                                ),
                                                        );

                                                    if (!item) {
                                                        return;
                                                    }

                                                    setEstimate({
                                                        ...estimate,
                                                        items: [
                                                            ...estimate.items,
                                                            {
                                                                item_id:
                                                                    item.id,
                                                                designation:
                                                                    item.description,
                                                                unit: item.unit,
                                                                qty: itemDraft.qty,
                                                                unit_cost:
                                                                    item.price,
                                                                group:
                                                                    itemDraft.group.trim() ||
                                                                    null,
                                                                is_included: true,
                                                            },
                                                        ],
                                                    });
                                                    setItemDraft({
                                                        ...itemDraft,
                                                        item_id: '',
                                                        item_search: '',
                                                        qty: 1,
                                                    });
                                                }}
                                            >
                                                <Plus /> Add item
                                            </Button>
                                        </div>
                                        <datalist id="project-item-groups">
                                            {groupOptions.map((group) => (
                                                <option
                                                    key={group}
                                                    value={group}
                                                />
                                            ))}
                                        </datalist>
                                        <p className="text-xs text-muted-foreground">
                                            Unit and current effective price
                                            come from the item library. The
                                            group stays filled for the next
                                            item.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <aside
                                className="dupa-analysis-summary"
                                aria-label="Estimate totals"
                            >
                                <h3 className="dupa-panel-title">
                                    Estimate summary{' '}
                                    <span>{side.replace('_', '-')}</span>
                                </h3>
                                <div className="dupa-totals">
                                    {Object.entries(computed).map(
                                        ([key, value]) => (
                                            <div key={key}>
                                                <div className="text-xs text-muted-foreground capitalize">
                                                    {key === 'ocm' ||
                                                    key === 'profit' ||
                                                    key === 'vat' ? (
                                                        <label className="flex flex-wrap items-center gap-1 normal-case">
                                                            {key === 'ocm'
                                                                ? "Contractor's OCM"
                                                                : key ===
                                                                    'profit'
                                                                  ? "Contractor's Profit"
                                                                  : 'Value Added Tax'}
                                                            <Input
                                                                aria-label={
                                                                    key ===
                                                                    'ocm'
                                                                        ? 'OCM %'
                                                                        : key ===
                                                                            'profit'
                                                                          ? 'Profit %'
                                                                          : 'VAT %'
                                                                }
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="0.01"
                                                                className="h-6 w-16 px-1 text-xs"
                                                                value={
                                                                    estimate[
                                                                        key ===
                                                                        'ocm'
                                                                            ? 'ocm_percentage'
                                                                            : key ===
                                                                                'profit'
                                                                              ? 'profit_percentage'
                                                                              : 'vat_percentage'
                                                                    ]
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setEstimate(
                                                                        {
                                                                            ...estimate,
                                                                            [key ===
                                                                            'ocm'
                                                                                ? 'ocm_percentage'
                                                                                : key ===
                                                                                    'profit'
                                                                                  ? 'profit_percentage'
                                                                                  : 'vat_percentage']:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            <span>
                                                                % of{' '}
                                                                {key === 'vat'
                                                                    ? 'direct + OCM + profit'
                                                                    : 'direct cost'}
                                                            </span>
                                                        </label>
                                                    ) : (
                                                        ((
                                                            {
                                                                labor: 'Labor',
                                                                equipment:
                                                                    'Equipment',
                                                                items: 'Materials',
                                                                direct: 'Direct cost',
                                                                total: 'Total estimated cost',
                                                                unit: `Unit cost / ${details.data.unit || 'unit'}`,
                                                            } as Record<
                                                                string,
                                                                string
                                                            >
                                                        )[key] ?? key)
                                                    )}
                                                </div>
                                                <div className="font-semibold">
                                                    {money.format(value)}
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                            </aside>
                        </div>
                        {computed.direct > 0 &&
                            number(estimate.quantity) <= 0 && (
                                <p className="text-sm text-destructive">
                                    Quantity must be greater than zero before
                                    saving this estimate.
                                </p>
                            )}
                        {Object.keys(estimateErrors).length > 0 && (
                            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                <div className="font-medium">
                                    Please correct the following:
                                </div>
                                <ul className="mt-1 list-disc pl-5">
                                    {Object.entries(estimateErrors).map(
                                        ([key, message]) => (
                                            <li key={key}>{message}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <div
                    data-sheet-footer
                    className={`flex flex-wrap items-center gap-2 border p-2 ${embedded ? 'justify-end' : 'justify-between'}`}
                >
                    {!embedded && (
                        <Button asChild variant="outline">
                            <Link
                                href={`/admin/projects/${project.id}/dupa`}
                                onClick={(event) => {
                                    if (
                                        (dirty.ADD ||
                                            dirty.NON_ADD ||
                                            backupDirty ||
                                            details.isDirty) &&
                                        !window.confirm(
                                            'Leave this DUPA and discard unsaved estimate changes?',
                                        )
                                    ) {
                                        event.preventDefault();
                                    }
                                }}
                            >
                                <ArrowLeft /> DUPA items
                            </Link>
                        </Button>
                    )}
                    <span
                        role="status"
                        className="dupa-save-status text-xs text-muted-foreground"
                    >
                        {saving
                            ? 'Saving…'
                            : details.isDirty ||
                                dirty.ADD ||
                                dirty.NON_ADD ||
                                backupDirty
                              ? 'Unsaved changes'
                              : 'Saved ✓'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {!embedded && navigation.previous_id && (
                            <Button asChild variant="outline">
                                <Link
                                    href={`/admin/dupas/${navigation.previous_id}/edit`}
                                    onClick={(event) => {
                                        if (
                                            (dirty.ADD ||
                                                dirty.NON_ADD ||
                                                backupDirty ||
                                                details.isDirty) &&
                                            !window.confirm(
                                                'Open the previous DUPA and discard unsaved estimate changes?',
                                            )
                                        ) {
                                            event.preventDefault();
                                        }
                                    }}
                                >
                                    <ArrowLeft /> Previous DUPA
                                </Link>
                            </Button>
                        )}
                        <Button
                            disabled={
                                saving ||
                                !(details.isDirty || dirty.ADD || dirty.NON_ADD)
                            }
                            className="sheet-save"
                            onClick={() => saveEstimate()}
                        >
                            {saving ? 'Saving…' : 'Save All Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );

    function updateLabor(index: number, row: LaborRow) {
        const rows = [...estimate.labors];
        rows[index] = row;
        setEstimate({ ...estimate, labors: rows });
    }
    function updateEquipment(index: number, row: EquipmentRow) {
        const rows = [...estimate.equipment];
        rows[index] = row;
        setEstimate({ ...estimate, equipment: rows });
    }
    function updateItem(index: number, row: ItemRow) {
        const rows = [...estimate.items];
        rows[index] = row;
        setEstimate({ ...estimate, items: rows });
    }
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            {children}
        </div>
    );
}
function NumberField({
    readOnly = false,
    label,
    value,
    onChange,
}: {
    readOnly?: boolean;
    label: string;
    value: string | number;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label}>
            <Input
                type="number"
                min="0"
                step="0.0001"
                value={value}
                readOnly={readOnly}
                title={
                    readOnly
                        ? ['OCM %', 'Profit %', 'VAT %'].includes(label)
                            ? 'Determined by the project allocated amount.'
                            : 'Calculated from a backup. Change its formula binding to use a manual value.'
                        : undefined
                }
                onChange={(e) => onChange(e.target.value)}
            />
        </Field>
    );
}

async function createCatalogRecord<T>(
    url: string,
    data: Record<string, string | number>,
    csrfToken: string,
): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
        },
        body: JSON.stringify(data),
    });
    const payload = (await response.json().catch(() => ({
        message: `The server returned an unexpected response (${response.status}).`,
    }))) as {
        record?: T;
        message?: string;
        errors?: Record<string, string[]>;
    };

    if (!response.ok || !payload.record) {
        const validationMessage = Object.values(payload.errors ?? {}).flat()[0];

        throw new Error(
            validationMessage ??
                payload.message ??
                'The library record could not be created.',
        );
    }

    return payload.record;
}

function QuickEquipmentCreate({
    csrfToken,
    onCreated,
}: {
    csrfToken: string;
    onCreated: (item: EquipmentCatalog) => void;
}) {
    const [open, setOpen] = useState(false);
    const [equipment, setEquipment] = useState('');
    const [rental, setRental] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError('');

        try {
            const item = await createCatalogRecord<EquipmentCatalog>(
                '/admin/libraries/equipments',
                { equipment, rental: Number(rental) },
                csrfToken,
            );
            onCreated(item);
            setEquipment('');
            setRental('');
            setOpen(false);
            toast.success(
                `${item.equipment} was saved and added to Equipment.`,
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'The equipment record could not be created.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                setError('');
            }}
        >
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="sheet-new-equipment h-7 shrink-0 rounded-none border border-l-0 px-2.5"
                    aria-label="Create a new equipment library item"
                >
                    <Plus className="size-3.5" />
                    New
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New equipment library item</DialogTitle>
                    <DialogDescription>
                        Save reusable equipment and add it to this estimate.
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={submit}>
                    <div className="space-y-2">
                        <Label htmlFor="quick-equipment-name">
                            Equipment name
                        </Label>
                        <Input
                            id="quick-equipment-name"
                            required
                            autoFocus
                            value={equipment}
                            onChange={(event) =>
                                setEquipment(event.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quick-equipment-rental">
                            Rental cost
                        </Label>
                        <Input
                            id="quick-equipment-rental"
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={rental}
                            onChange={(event) => setRental(event.target.value)}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button disabled={saving} type="submit">
                            <Plus /> {saving ? 'Saving…' : 'Save & add'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ResourcePicker({
    title,
    items,
    onAdd,
    quickCreate,
}: {
    title: string;
    items: Array<{ id: number; label: string }>;
    onAdd: (id: number) => void;
    quickCreate?: React.ReactNode;
}) {
    const [selectedId, setSelectedId] = useState('');

    return (
        <div
            data-sheet-picker
            className="space-y-2 rounded-md border bg-muted/20 p-2"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                    Add {title.toLowerCase()}
                </span>
                <span className="text-xs text-muted-foreground">
                    {items.length} catalog item(s)
                </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 items-center">
                    <select
                        className={`h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm ${
                            quickCreate
                                ? 'rounded-l-md rounded-r-none'
                                : 'rounded-md'
                        }`}
                        value={selectedId}
                        onChange={(event) => setSelectedId(event.target.value)}
                    >
                        <option value="">
                            {items.length
                                ? `Select ${title.toLowerCase()}`
                                : `No ${title.toLowerCase()} items available`}
                        </option>
                        {items.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                    {quickCreate && (
                        <div className="flex h-7 shrink-0 items-center">
                            {quickCreate}
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedId}
                    onClick={() => {
                        onAdd(Number(selectedId));
                        setSelectedId('');
                    }}
                >
                    <Plus /> Add {title.toLowerCase()}
                </Button>
            </div>
        </div>
    );
}
function ItemPicker({
    items,
    value,
    onChange,
}: {
    items: ItemCatalog[];
    value: string;
    onChange: (item: ItemCatalog | null, search: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const container = useRef<HTMLDivElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const listId = 'dupa-item-options';
    const matches = useMemo(() => {
        const terms = query
            .trim()
            .toLocaleLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        const found: ItemCatalog[] = [];

        for (const item of items) {
            if (supersededItemNotice.test(item.description)) {
                continue;
            }

            const searchable =
                `${item.itemcode} ${item.description} ${item.unit}`.toLocaleLowerCase();

            if (terms.every((term) => searchable.includes(term))) {
                found.push(item);

                if (found.length === 50) {
                    break;
                }
            }
        }

        return found;
    }, [items, query]);

    useEffect(() => {
        if (open) {
            searchInput.current?.focus();
        }
    }, [open]);

    useEffect(() => {
        const closeOutside = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', closeOutside);

        return () => document.removeEventListener('pointerdown', closeOutside);
    }, []);

    const choose = (item: ItemCatalog) => {
        onChange(item, `${item.itemcode} · ${item.description}`);
        setQuery('');
        setOpen(false);
    };

    return (
        <div ref={container} className="relative min-w-0">
            <button
                type="button"
                aria-label="Select catalog item"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                disabled={!items.length}
                className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => {
                    setQuery('');
                    setActive(0);
                    setOpen((current) => !current);
                }}
            >
                <span
                    className={`truncate ${value ? '' : 'text-muted-foreground'}`}
                >
                    {value ||
                        (items.length
                            ? 'Select an item'
                            : 'No items available')}
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
            </button>
            {open && (
                <div className="absolute bottom-full z-50 mb-1 flex max-h-[min(24rem,60vh)] w-full flex-col rounded-md border bg-popover p-1 text-popover-foreground shadow-md md:w-[min(36rem,calc(100vw-4rem))]">
                    <Input
                        ref={searchInput}
                        aria-label="Search catalog items"
                        aria-controls={listId}
                        aria-activedescendant={
                            matches[active]
                                ? `dupa-item-${matches[active].id}`
                                : undefined
                        }
                        autoComplete="off"
                        placeholder="Search item code or description"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActive(0);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setOpen(false);
                            }

                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActive((current) =>
                                    Math.min(current + 1, matches.length - 1),
                                );
                            }

                            if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActive((current) =>
                                    Math.max(current - 1, 0),
                                );
                            }

                            if (event.key === 'Enter' && matches[active]) {
                                event.preventDefault();
                                choose(matches[active]);
                            }
                        }}
                    />
                    <div
                        id={listId}
                        role="listbox"
                        className="mt-1 max-h-64 min-h-0 overflow-y-auto"
                    >
                        {matches.length ? (
                            matches.map((item, index) => (
                                <button
                                    key={item.id}
                                    id={`dupa-item-${item.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={index === active}
                                    className={`flex !h-auto min-h-14 w-full flex-col items-start gap-1 rounded-sm px-3 py-2 text-left text-sm leading-snug whitespace-normal hover:bg-accent ${index === active ? 'bg-accent' : ''}`}
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onClick={() => choose(item)}
                                >
                                    <span className="font-semibold">
                                        {item.itemcode}
                                    </span>
                                    <span className="whitespace-normal text-muted-foreground">
                                        {item.description}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                                No matching items
                            </div>
                        )}
                        {matches.length === 50 && (
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                Showing first 50 matches. Refine your search.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ResourceColumns({
    columns,
    className,
}: {
    columns: string;
    className: string;
}) {
    return (
        <div
            data-sheet-columns
            className={`grid text-[11px] font-semibold ${className}`}
        >
            {columns.split(',').map((column) => (
                <span key={column}>{column}</span>
            ))}
            <span>
                <span className="sr-only">Actions</span>
            </span>
        </div>
    );
}
function Include({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    compact?: boolean;
}) {
    return (
        <label className="flex items-center justify-center gap-1 text-xs">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="sr-only">Include</span>
        </label>
    );
}
function Remove({ onClick }: { onClick: () => void }) {
    return (
        <Button type="button" size="sm" variant="ghost" onClick={onClick}>
            <Trash2 />
        </Button>
    );
}
