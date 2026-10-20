import { Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BackupTemplatePicker from '@/components/backup-template-picker';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    insertFormulaReference,
    removeFormulaReference,
} from '@/lib/formula-reference';

type Kind = 'labors' | 'equipment' | 'items';
type NamedValue = {
    key: string;
    label: string;
    unit: string;
    value: string | number;
};
type Column = { key: string; label: string; unit?: string };
type Table = {
    columns: Column[];
    rows: {
        key: string;
        label: string;
        cells: Record<string, string | number>;
    }[];
    inputs: NamedValue[];
    outputs: NamedValue[];
};
type Backup = {
    key: string;
    owner_type: Kind | 'estimate';
    owner_uuid: string;
    name: string;
    schema_version: number;
    definition: Table;
};
type Binding = {
    kind: Kind | 'estimate';
    row_uuid?: string;
    field: string;
    formula: string;
};
type Document = { backups: Backup[]; bindings: Binding[] };
export type BackupEstimate = {
    backup_revision?: number;
    backups?: Backup[];
    backup_bindings?: Binding[] | null;
    backup_applied?: {
        document: Document;
        values?: Record<string, number>;
    } | null;
};
export type BackupTemplate = {
    id: number;
    name: string;
    version: number;
    creator?: { id?: number; name: string } | null;
    definition: { source_key: string; schema_version: number; table: Table };
};
type Detail = { row_uuid?: string; designation: string };
export function backupReferences(value: unknown): string[] {
    return [
        ...new Set(
            [
                ...JSON.stringify(value).matchAll(
                    /\b([A-Za-z_][A-Za-z_0-9]*)\.outputs\./g,
                ),
            ].map((m) => m[1]),
        ),
    ];
}
export function usedBackupKeys(document?: Document): Set<string> {
    const used = new Set(backupReferences(document?.bindings ?? []));
    let count;

    do {
        count = used.size;

        for (const b of document?.backups ?? []) {
            if (used.has(b.key)) {
                backupReferences(b.definition).forEach((key) => used.add(key));
            }
        }
    } while (count !== used.size);

    return used;
}
type Preview = {
    preview_token: string;
    values: Record<string, number>;
    variables: Record<
        string,
        { label: string; unit: string; value: number; backup: string }
    >;
    changes: {
        kind: string;
        uuid: string;
        field: string;
        before: number;
        value: number;
    }[];
    totals: { direct_cost: number; total_cost: number };
};
const key = (prefix: string) =>
    `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
const displayNumber = (value: number | undefined) =>
    value?.toLocaleString('en-PH', { maximumFractionDigits: 8 }) ?? '—';
const selectClass =
    'h-8 max-w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900';
const buttonClass =
    'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-950 dark:bg-white dark:text-slate-800';
const sheetInput =
    'h-7 w-full min-w-0 rounded-none border-0 bg-transparent px-1.5 py-0 text-xs leading-4 text-slate-950 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600';
// MySQL JSON may reorder object keys; that must not mark an applied backup as a draft.
export const stableJson = (value: unknown): string =>
    JSON.stringify(value, (_key, node) =>
        node && typeof node === 'object' && !Array.isArray(node)
            ? Object.fromEntries(
                  Object.entries(node).sort(([a], [b]) => a.localeCompare(b)),
              )
            : node,
    );
export const documentFor = (estimate: BackupEstimate): Document => ({
    backups: (estimate.backups ?? []).map(
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
    bindings: estimate.backup_bindings ?? [],
});
const emptyTable = (): Table => ({
    columns: [
        { key: 'a', label: 'a' },
        { key: 'b', label: 'b' },
        { key: 'depth', label: 'Depth' },
        { key: 'count', label: '#' },
        { key: 'volume', label: 'Volume' },
    ],
    rows: [
        {
            key: 'row_1',
            label: 'New row',
            cells: {
                a: 0,
                b: 0,
                depth: 0,
                count: 1,
                volume: '=ROUND(a*b*depth*count,2)',
            },
        },
    ],
    inputs: [],
    outputs: [
        {
            key: 'total_volume',
            label: 'Total volume',
            unit: 'm³',
            value: '=SUM(rows.volume)',
        },
    ],
});
const fieldLabels: Record<string, string> = {
    quantity: 'DUPA quantity',
    no_of_person: 'Number of persons',
    no_of_days: 'Number of days',
    rate: 'Rate',
    no_of_units: 'Number of units',
    rental_unit_cost: 'Rental per unit',
    qty: 'Material quantity',
};
function columnLetter(index: number): string {
    let result = '';

    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    }

    return result;
}
type Cell = { row: string; column: string };

export default function DupaBackups<
    T extends BackupEstimate & {
        labors: Detail[];
        equipment: Detail[];
        items: Detail[];
    },
>({
    dupaId,
    side,
    csrfToken,
    estimate,
    templates,
    onTemplateSaved,
    onTemplateVisibilityChanged,
    disabled,
    onSaved,
    onDirty,
    onBusy,
}: {
    dupaId: number;
    side: string;
    csrfToken: string;
    estimate: T;
    templates: BackupTemplate[];
    onTemplateSaved: (template: BackupTemplate) => void;
    onTemplateVisibilityChanged?: (
        template: BackupTemplate,
        excluded: boolean,
    ) => void;
    disabled: boolean;
    onSaved: (estimate: T) => void;
    onDirty: (dirty: boolean) => void;
    onBusy: (busy: boolean) => void;
}) {
    const [document, setDocument] = useState<Document>(() =>
        documentFor(estimate),
    );
    const [active, setActive] = useState(
        () =>
            estimate.backups?.find((b) =>
                usedBackupKeys(estimate.backup_applied?.document).has(b.key),
            )?.key ??
            estimate.backups?.[0]?.key ??
            '',
    );
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [changed, setChanged] = useState(false);
    const [templateId, setTemplateId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [templateDialog, setTemplateDialog] = useState(false);
    const [excludedIds, setExcludedIds] = useState<number[]>([]);
    const [lastExcluded, setLastExcluded] = useState<BackupTemplate | null>(
        null,
    );
    const [selection, setSelection] = useState<Cell | null>(null);
    const [editing, setEditing] = useState<Cell | null>(null);
    const [formulaTarget, setFormulaTarget] = useState('');
    const [formulaDialog, setFormulaDialog] = useState(false);
    const [formulaDraft, setFormulaDraft] = useState('=');
    const [namedError, setNamedError] = useState('');
    const [resultSelection, setResultSelection] = useState<{
        backup: string;
        key: string;
    } | null>(null);
    const [referenceMode, setReferenceMode] = useState(false);
    const formulaInput = useRef<HTMLInputElement>(null);
    const formulaCaret = useRef({ start: 0, end: 0 });
    const grid = useRef<HTMLTableElement>(null);
    const currentBackups = document.backups;
    const appliedKeys = usedBackupKeys(estimate.backup_applied?.document);
    const selectedKeys = usedBackupKeys(document);
    const deleteBlocked = (key: string) =>
        appliedKeys.has(key) ||
        backupReferences(document.bindings).includes(key) ||
        document.backups.some(
            (b) =>
                b.key !== key && backupReferences(b.definition).includes(key),
        );
    const backup = currentBackups.find((b) => b.key === active);
    const owners = (['labors', 'equipment', 'items'] as const).flatMap((kind) =>
        estimate[kind]
            .filter((row) => row.row_uuid)
            .map((row, index) => ({
                kind,
                uuid: row.row_uuid!,
                label: `${kind === 'items' ? 'Material' : kind === 'labors' ? 'Labor' : 'Equipment'} ${index + 1} · ${row.designation}`,
            })),
    );
    const targets = [
        {
            kind: 'estimate',
            row_uuid: undefined,
            field: 'quantity',
            label: 'DUPA quantity',
        },
        ...owners.flatMap((o) =>
            (o.kind === 'labors'
                ? ['no_of_person', 'no_of_days', 'rate']
                : o.kind === 'equipment'
                  ? ['no_of_units', 'no_of_days', 'rental_unit_cost']
                  : ['qty']
            ).map((field) => ({
                kind: o.kind,
                row_uuid: o.uuid,
                field,
                label: `${o.label} / ${fieldLabels[field]}`,
            })),
        ),
    ];
    const unapplied =
        stableJson(
            estimate.backup_applied?.document ?? { backups: [], bindings: [] },
        ) !== stableJson(document);
    const selectedResult =
        resultSelection?.backup === backup?.key
            ? backup?.definition.outputs.find(
                  (output) => output.key === resultSelection?.key,
              )
            : undefined;
    const resultReferences = [
        ...new Set(
            String(selectedResult?.value ?? '').match(
                /(?<![A-Za-z_0-9.])(?:rows\.[A-Za-z_0-9]+\.[A-Za-z_0-9]+|inputs\.[A-Za-z_0-9]+|outputs\.[A-Za-z_0-9]+)/g,
            ) ?? [],
        ),
    ];
    function jumpToReference(reference: string) {
        const element = grid.current
            ?.closest('fieldset')
            ?.querySelector<HTMLElement>(
                `[data-backup-reference="${reference}"]`,
            );

        if (!element) {
            return;
        }

        const details = element.closest('details');

        if (details) {
            details.open = true;
        }

        window.requestAnimationFrame(() =>
            element.scrollIntoView({
                block: 'center',
                inline: 'nearest',
                behavior: 'smooth',
            }),
        );
    }
    const selectedRow = backup?.definition.rows.find(
        (r) => r.key === selection?.row,
    );
    const selectedValue = selectedResult
        ? selectedResult.value
        : selection?.column === 'description'
          ? selectedRow?.label
          : selectedRow?.cells[selection?.column ?? ''];
    const selectedAddress = selectedResult
        ? selectedResult.label
        : backup && selection
          ? `${columnLetter(selection.column === 'description' ? 0 : backup.definition.columns.findIndex((c) => c.key === selection.column) + 1)}${backup.definition.rows.findIndex((r) => r.key === selection.row) + 3}`
          : 'Select cell';

    function edit(next: Document) {
        setDocument(next);
        setPreview(null);
        setChanged(true);
        onDirty(true);
        setError('');
    }
    function table(next: Table) {
        if (backup) {
            edit({
                ...document,
                backups: document.backups.map((b) =>
                    b.key === backup.key ? { ...b, definition: next } : b,
                ),
            });
        }
    }
    function cell(row: string, column: string, value: string) {
        if (!backup) {
            return;
        }

        table({
            ...backup.definition,
            rows: backup.definition.rows.map((r) =>
                r.key !== row
                    ? r
                    : column === 'description'
                      ? { ...r, label: value }
                      : { ...r, cells: { ...r.cells, [column]: value } },
            ),
        });
    }
    function formulaValue(value: string) {
        if (selectedResult && backup) {
            table({
                ...backup.definition,
                outputs: backup.definition.outputs.map((output) =>
                    output.key === selectedResult.key
                        ? { ...output, value }
                        : output,
                ),
            });
        } else if (selection) {
            cell(selection.row, selection.column, value);
        }
    }
    function selectResult(key: string) {
        if (!backup) {
            return;
        }

        setResultSelection({ backup: backup.key, key });
        setSelection(null);
        setReferenceMode(false);
        const value = String(
            backup.definition.outputs.find((output) => output.key === key)
                ?.value ?? '',
        );
        formulaCaret.current = { start: value.length, end: value.length };
        window.requestAnimationFrame(() => {
            formulaInput.current?.focus({ preventScroll: true });
            formulaInput.current?.setSelectionRange(value.length, value.length);
        });
    }
    function referenceFromTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement) || !backup) {
            return null;
        }

        const named = target.closest<HTMLElement>('[data-backup-reference]');

        if (named) {
            return named.dataset.backupReference ?? null;
        }

        const input = target.closest<HTMLInputElement>(
            'input[data-row][data-column]',
        );

        if (!input) {
            return null;
        }

        const row = backup.definition.rows[Number(input.dataset.row)];
        const column =
            backup.definition.columns[Number(input.dataset.column) - 1];

        return row && column ? `rows.${row.key}.${column.key}` : null;
    }
    function insertReference(reference: string) {
        if (!selectedResult || !String(selectedResult.value).startsWith('=')) {
            return;
        }

        if (reference === `outputs.${selectedResult.key}`) {
            setError('A result cannot reference itself.');

            return;
        }

        const next = insertFormulaReference(
            String(selectedResult.value),
            reference,
            formulaCaret.current.start,
            formulaCaret.current.end,
        );
        formulaValue(next.value);
        formulaCaret.current = { start: next.caret, end: next.caret };
        window.requestAnimationFrame(() => {
            formulaInput.current?.focus({ preventScroll: true });
            formulaInput.current?.setSelectionRange(next.caret, next.caret);
        });
    }
    function addRow() {
        if (!backup) {
            return;
        }

        return {
            key: key('row'),
            label: 'New row',
            cells: Object.fromEntries(
                backup.definition.columns.map((c) => [
                    c.key,
                    c.key === 'volume' &&
                    ['a', 'b', 'depth', 'count'].every((k) =>
                        backup.definition.columns.some((v) => v.key === k),
                    )
                        ? '=ROUND(a*b*depth*count,2)'
                        : c.key === 'count'
                          ? 1
                          : 0,
                ]),
            ),
        };
    }
    function addBackup() {
        const id = key('backup');
        const template = templates.find((t) => String(t.id) === templateId);
        const definition = template
            ? (JSON.parse(
                  JSON.stringify(template.definition.table).replaceAll(
                      `${template.definition.source_key}.`,
                      `${id}.`,
                  ),
              ) as Table)
            : emptyTable();
        edit({
            ...document,
            backups: [
                ...document.backups,
                {
                    key: id,
                    owner_type: 'estimate',
                    owner_uuid: crypto.randomUUID(),
                    name: template?.name ?? 'Backup computation',
                    schema_version: 1,
                    definition,
                },
            ],
        });
        setActive(id);
        setSelection(null);
    }
    // Live calculation is a read-only server preview. Only Apply & Save updates the estimate.
    useEffect(() => {
        if (!document.backups.length || disabled || busy) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setCalculating(true);

            try {
                const response = await fetch(
                    `/admin/dupas/${dupaId}/estimates/${side}/backups/preview`,
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        signal: controller.signal,
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                        },
                        body: JSON.stringify({
                            revision: estimate.backup_revision ?? 0,
                            document,
                        }),
                    },
                );
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        Object.values(data.errors ?? {})
                            .flat()
                            .join(' ') ||
                            data.message ||
                            'Check the highlighted formulas.',
                    );
                }

                if (!controller.signal.aborted) {
                    setPreview(data);
                    setError('');
                }
            } catch (e) {
                if (!controller.signal.aborted) {
                    setPreview(null);
                    setError(
                        e instanceof Error ? e.message : 'Unable to calculate.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setCalculating(false);
                }
            }
        }, 450);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [
        document,
        dupaId,
        side,
        csrfToken,
        estimate.backup_revision,
        disabled,
        busy,
    ]);

    async function excludeTemplate(
        template: BackupTemplate,
        excluded: boolean,
    ) {
        setBusy(true);
        onBusy(true);
        setError('');

        try {
            const response = await fetch(
                `/admin/dupas/${dupaId}/backup-templates/${template.id}/exclusion`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({ excluded }),
                },
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ?? 'Unable to change template visibility.',
                );
            }

            setExcludedIds((current) =>
                excluded
                    ? [...current, template.id]
                    : current.filter((id) => id !== template.id),
            );
            setLastExcluded(excluded ? template : null);
            onTemplateVisibilityChanged?.(template, excluded);

            if (excluded && templateId === String(template.id)) {
                setTemplateId('');
            }
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Unable to change template visibility.',
            );
        } finally {
            setBusy(false);
            onBusy(false);
        }
    }

    async function request(action: string) {
        setBusy(true);
        onBusy(true);
        setError('');

        try {
            const response = await fetch(
                `/admin/dupas/${dupaId}/estimates/${side}/backups/${action}`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify({
                        revision: estimate.backup_revision ?? 0,
                        document,
                        preview_token: preview?.preview_token,
                        template_name: templateName,
                        template_key: active,
                    }),
                },
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    Object.values(data.errors ?? {})
                        .flat()
                        .join(' ') ||
                        data.message ||
                        'Unable to save backup.',
                );
            }

            if (action === 'preview') {
                setPreview(data);
            } else if (action === 'template') {
                onTemplateSaved(data.template);
                setTemplateName('');
                setTemplateDialog(false);
                setTemplateId(String(data.template.id));
            } else {
                setChanged(false);
                onDirty(false);
                onSaved(data.estimate);
            }
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Unable to process backup.',
            );
        } finally {
            setBusy(false);
            onBusy(false);
        }
    }
    function bind(targetIndex: string, formula: string) {
        if (targetIndex === '') {
            return;
        }

        const target = targets[Number(targetIndex)];
        const binding: Binding = {
            kind: target.kind as Binding['kind'],
            row_uuid: target.row_uuid,
            field: target.field,
            formula,
        };
        const index = document.bindings.findIndex(
            (b) =>
                b.kind === binding.kind &&
                b.row_uuid === binding.row_uuid &&
                b.field === binding.field,
        );
        edit({
            ...document,
            bindings:
                index < 0
                    ? [...document.bindings, binding]
                    : document.bindings.map((b, i) =>
                          i === index ? binding : b,
                      ),
        });
    }
    function paste(
        event: React.ClipboardEvent<HTMLInputElement>,
        rowIndex: number,
        columnIndex: number,
    ) {
        const text = event.clipboardData.getData('text/plain');

        if (!backup || (!text.includes('\t') && !text.includes('\n'))) {
            return;
        }

        event.preventDefault();
        const lines = text
            .replace(/\r/g, '')
            .replace(/\n$/, '')
            .split('\n')
            .map((line) => line.split('\t'));

        if (lines.length + rowIndex > 200) {
            setError('A backup supports up to 200 rows.');

            return;
        }

        const rows = backup.definition.rows.map((r) => ({
            ...r,
            cells: { ...r.cells },
        }));
        const columns = [
            'description',
            ...backup.definition.columns.map((c) => c.key),
        ];
        lines.forEach((values, ri) => {
            const index = rowIndex + ri;

            if (!rows[index]) {
                rows[index] = addRow()!;
            }

            values.forEach((value, ci) => {
                const c = columns[columnIndex + ci];

                if (c === 'description') {
                    rows[index].label = value;
                } else if (c) {
                    const raw = value.trim();
                    rows[index].cells[c] =
                        /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)
                            ? raw.replaceAll(',', '')
                            : raw;
                }
            });
        });
        table({ ...backup.definition, rows });
    }
    function move(
        event: React.KeyboardEvent<HTMLInputElement>,
        row: number,
        column: number,
    ) {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        const next = grid.current?.querySelector<HTMLInputElement>(
            `input[data-row="${row + (event.shiftKey ? -1 : 1)}"][data-column="${column}"]`,
        );
        next?.focus();
        next?.select();
    }
    function insertColumn(after?: string) {
        if (
            !backup ||
            busy ||
            disabled ||
            backup.definition.columns.length >= 30
        ) {
            return;
        }

        let number = 1;

        while (
            backup.definition.columns.some(
                (c) => c.key.toLowerCase() === `column${number}`,
            )
        ) {
            number++;
        }

        const identifier = `column${number}`;
        const columns = [...backup.definition.columns];
        const index = after
            ? columns.findIndex((c) => c.key === after) + 1
            : columns.length;
        columns.splice(index, 0, {
            key: identifier,
            label: `Column ${number}`,
        });
        table({
            ...backup.definition,
            columns,
            rows: backup.definition.rows.map((r) => ({
                ...r,
                cells: { ...r.cells, [identifier]: 0 },
            })),
        });
        window.requestAnimationFrame(() => {
            const input = grid.current?.querySelector<HTMLInputElement>(
                `input[data-column-heading="${identifier}"]`,
            );
            input?.focus();
            input?.select();
        });
    }

    function removeColumn(identifier: string) {
        if (
            !backup ||
            busy ||
            disabled ||
            backup.definition.columns.length <= 1
        ) {
            return;
        }

        table({
            ...backup.definition,
            columns: backup.definition.columns.filter(
                (c) => c.key !== identifier,
            ),
            rows: backup.definition.rows.map((r) => ({
                ...r,
                cells: Object.fromEntries(
                    Object.entries(r.cells).filter(
                        ([key]) => key !== identifier,
                    ),
                ),
            })),
        });

        if (selection?.column === identifier) {
            setSelection(null);
        }

        if (editing?.column === identifier) {
            setEditing(null);
        }
    }

    function insertRow(after?: string) {
        if (
            !backup ||
            busy ||
            disabled ||
            backup.definition.rows.length >= 200
        ) {
            return;
        }

        const row = addRow();

        if (!row) {
            return;
        }

        const rows = [...backup.definition.rows];
        const index = after
            ? rows.findIndex((r) => r.key === after) + 1
            : rows.length;
        rows.splice(index, 0, row);
        table({ ...backup.definition, rows });
        setSelection({ row: row.key, column: 'description' });
        setResultSelection(null);
        setEditing({ row: row.key, column: 'description' });
        setReferenceMode(false);
        window.requestAnimationFrame(() => {
            const input = grid.current?.querySelector<HTMLInputElement>(
                `input[data-row="${index}"][data-column="0"]`,
            );
            input?.focus();
            input?.select();
        });
    }

    function openFormula(
        kind: 'inputs' | 'outputs' | 'binding',
        row?: Table['rows'][number],
    ) {
        if (!backup || busy || disabled) {
            return;
        }

        if (kind === 'binding') {
            setFormulaDraft('=');
            setNamedError('');
            setFormulaTarget('');
            setFormulaDialog(true);

            return;
        }

        const existing = [
            ...backup.definition.inputs,
            ...backup.definition.outputs,
        ];
        const prefix = kind === 'inputs' ? 'Variable' : 'Formula';
        let index = 1;

        while (
            existing.some(
                (v) =>
                    v.key.toLowerCase() === `${prefix}${index}`.toLowerCase() ||
                    v.label.toLowerCase() === `${prefix}${index}`.toLowerCase(),
            )
        ) {
            index++;
        }

        const identifier = `${prefix}${index}`;
        const column =
            backup.definition.columns.find((c) => c.key === 'volume') ??
            backup.definition.columns[0];
        const value =
            kind === 'inputs'
                ? 0
                : row && column
                  ? `=rows.${row.key}.${column.key}`
                  : backup.definition.columns.some((c) => c.key === 'volume')
                    ? '=SUM(rows.volume)'
                    : '=0';
        table({
            ...backup.definition,
            [kind]: [
                ...backup.definition[kind],
                { key: identifier, label: identifier, unit: '', value },
            ],
        });
        setSelection(null);
        setReferenceMode(false);
        setResultSelection(
            kind === 'outputs' ? { backup: backup.key, key: identifier } : null,
        );
        window.requestAnimationFrame(() => {
            const input = grid.current?.querySelector<HTMLInputElement>(
                `input[data-named-key="${identifier}"]`,
            );
            input?.focus();
            input?.select();
        });
    }

    function createFormula() {
        if (!backup || busy || disabled) {
            return;
        }

        const value = formulaDraft.trim();

        if (!value || value === '=') {
            setNamedError('Enter a number or formula.');

            return;
        }

        if (formulaTarget === '') {
            setNamedError('Choose the DUPA field to update.');

            return;
        }

        bind(formulaTarget, value);
        setFormulaDialog(false);
    }

    function renderOutputRow(v: NamedValue, i: number) {
        if (!backup) {
            return null;
        }

        return (
            <tr
                key={v.key}
                className={
                    selectedResult?.key === v.key
                        ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset'
                        : i === 0
                          ? 'border-t-2 border-emerald-700 bg-emerald-50 font-semibold'
                          : 'bg-white'
                }
            >
                <th className="border border-slate-300 bg-slate-100 text-xs font-normal text-slate-500">
                    {backup.definition.rows.length +
                        3 +
                        i +
                        (i > 0 ? backup.definition.inputs.length : 0)}
                </th>
                <td
                    colSpan={Math.max(1, backup.definition.columns.length)}
                    className="border border-slate-300 px-2 py-1"
                >
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="rounded bg-emerald-100 px-1.5 py-1 font-mono text-xs text-emerald-800"
                            data-backup-reference={`outputs.${v.key}`}
                            aria-label={`Edit formula for ${v.label}`}
                            aria-pressed={selectedResult?.key === v.key}
                            title="Click to view and edit in the formula bar above"
                            onClick={() => selectResult(v.key)}
                        >
                            fx
                        </button>
                        <input
                            aria-label={`Name for formula ${v.key}`}
                            data-named-key={v.key}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    selectResult(v.key);
                                }
                            }}
                            className="h-7 min-w-0 flex-1 border-0 bg-transparent text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-600"
                            value={v.label}
                            onChange={(e) =>
                                table({
                                    ...backup.definition,
                                    outputs: backup.definition.outputs.map(
                                        (n, j) =>
                                            j === i
                                                ? {
                                                      ...n,
                                                      label: e.target.value,
                                                  }
                                                : n,
                                    ),
                                })
                            }
                        />
                        <input
                            aria-label={`Unit for formula ${v.key}`}
                            placeholder="Unit"
                            className="h-7 w-16 border-0 bg-transparent text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                            value={v.unit}
                            onChange={(e) =>
                                table({
                                    ...backup.definition,
                                    outputs: backup.definition.outputs.map(
                                        (n, j) =>
                                            j === i
                                                ? {
                                                      ...n,
                                                      unit: e.target.value,
                                                  }
                                                : n,
                                    ),
                                })
                            }
                        />
                    </div>
                </td>
                <td className="border border-slate-300 px-1.5 py-1 text-right font-semibold tabular-nums">
                    <button
                        type="button"
                        className="w-full text-right hover:text-emerald-800"
                        data-backup-reference={`outputs.${v.key}`}
                        aria-label={`Edit result ${v.label}`}
                        title={String(v.value)}
                        onClick={() => selectResult(v.key)}
                    >
                        {displayNumber(
                            preview?.values[`${backup.key}.outputs.${v.key}`],
                        )}
                    </button>
                </td>
                <td className="border border-slate-300 text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-500 hover:text-red-700"
                        aria-label={`Remove formula ${v.label}`}
                        disabled={busy || disabled}
                        onClick={() =>
                            table({
                                ...backup.definition,
                                outputs: backup.definition.outputs.filter(
                                    (_, j) => j !== i,
                                ),
                            })
                        }
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                </td>
            </tr>
        );
    }
    function renderInputRows() {
        if (!backup) {
            return null;
        }

        return (
            <>
                {backup.definition.inputs.map((v, i) => (
                    <tr key={`input-${v.key}`} className="bg-white">
                        <th className="border border-slate-300 bg-slate-100 text-xs font-normal text-slate-500">
                            {backup.definition.rows.length +
                                Math.min(1, backup.definition.outputs.length) +
                                3 +
                                i}
                        </th>
                        <td
                            colSpan={Math.max(
                                1,
                                backup.definition.columns.length,
                            )}
                            className="border border-slate-300 px-2 py-1"
                        >
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-600">
                                    Variable
                                </span>
                                <input
                                    aria-label={`Name for variable ${v.key}`}
                                    data-named-key={v.key}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            grid.current
                                                ?.querySelector<HTMLInputElement>(
                                                    `input[data-named-value="${v.key}"]`,
                                                )
                                                ?.focus();
                                        }
                                    }}
                                    title={`inputs.${v.key}`}
                                    className="h-7 min-w-0 flex-1 border-0 bg-transparent text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                                    value={v.label}
                                    onChange={(e) =>
                                        table({
                                            ...backup.definition,
                                            inputs: backup.definition.inputs.map(
                                                (n, j) =>
                                                    j === i
                                                        ? {
                                                              ...n,
                                                              label: e.target
                                                                  .value,
                                                          }
                                                        : n,
                                            ),
                                        })
                                    }
                                />
                                <input
                                    aria-label={`Unit for variable ${v.key}`}
                                    placeholder="Unit"
                                    className="h-7 w-16 border-0 bg-transparent text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                                    value={v.unit}
                                    onChange={(e) =>
                                        table({
                                            ...backup.definition,
                                            inputs: backup.definition.inputs.map(
                                                (n, j) =>
                                                    j === i
                                                        ? {
                                                              ...n,
                                                              unit: e.target
                                                                  .value,
                                                          }
                                                        : n,
                                            ),
                                        })
                                    }
                                />
                            </div>
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1">
                            <input
                                aria-label={`Value or formula for ${v.label}`}
                                data-named-value={v.key}
                                data-backup-reference={`inputs.${v.key}`}
                                className="h-7 w-full min-w-0 border-0 bg-transparent text-right font-mono text-xs outline-none focus:ring-1 focus:ring-emerald-600"
                                value={v.value}
                                onChange={(e) =>
                                    table({
                                        ...backup.definition,
                                        inputs: backup.definition.inputs.map(
                                            (n, j) =>
                                                j === i
                                                    ? {
                                                          ...n,
                                                          value: e.target.value,
                                                      }
                                                    : n,
                                        ),
                                    })
                                }
                            />
                        </td>
                        <td className="border border-slate-300 text-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-slate-500 hover:text-red-700"
                                aria-label={`Remove variable ${v.label}`}
                                disabled={busy || disabled}
                                onClick={() =>
                                    table({
                                        ...backup.definition,
                                        inputs: backup.definition.inputs.filter(
                                            (_, j) => j !== i,
                                        ),
                                    })
                                }
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </td>
                    </tr>
                ))}
            </>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-100 text-slate-950">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2">
                <BackupTemplatePicker
                    templates={templates.filter(
                        (t) => !excludedIds.includes(t.id),
                    )}
                    value={templateId}
                    disabled={busy || disabled}
                    onChange={setTemplateId}
                    onExclude={(template) => {
                        if (
                            window.confirm(
                                `Hide "${template.name}" from your template choices? Other users can still use it.`,
                            )
                        ) {
                            void excludeTemplate(template, true);
                        }
                    }}
                />
                {lastExcluded && (
                    <button
                        type="button"
                        disabled={busy || disabled}
                        className="text-xs text-slate-600 underline"
                        onClick={() =>
                            void excludeTemplate(lastExcluded, false)
                        }
                    >
                        Undo hide: {lastExcluded.name}
                    </button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={buttonClass}
                    disabled={busy || disabled}
                    onClick={addBackup}
                >
                    <Plus /> New backup
                </Button>
                {backup && (
                    <Button
                        type="button"
                        variant="outline"
                        className={buttonClass}
                        disabled={busy || disabled || deleteBlocked(backup.key)}
                        title={
                            deleteBlocked(backup.key)
                                ? 'In use. Switch linked fields and Apply & Save first. Other backups must also stop referencing this backup.'
                                : 'Delete unused backup'
                        }
                        onClick={() => {
                            if (deleteBlocked(backup.key)) {
                                return;
                            }

                            if (
                                window.confirm(
                                    'Delete this unused backup? Save or apply to confirm deletion.',
                                )
                            ) {
                                edit({
                                    ...document,
                                    backups: document.backups.filter(
                                        (b) => b.key !== backup.key,
                                    ),
                                });
                                setActive(
                                    currentBackups.find(
                                        (b) => b.key !== backup.key,
                                    )?.key ?? '',
                                );
                                setSelection(null);
                            }
                        }}
                    >
                        Delete backup
                    </Button>
                )}
                <div
                    className="flex items-center gap-1 rounded border border-slate-300 bg-white p-0.5"
                    role="group"
                    aria-label="Backup worksheet zoom"
                >
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-700 hover:bg-slate-100"
                        aria-label="Zoom out backup"
                        disabled={zoom <= 50}
                        onClick={() =>
                            setZoom((current) => Math.max(50, current - 10))
                        }
                    >
                        <ZoomOut className="size-4" />
                    </Button>
                    <span
                        className="min-w-12 text-center text-xs tabular-nums"
                        aria-live="polite"
                    >
                        {zoom}%
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-700 hover:bg-slate-100"
                        aria-label="Zoom in backup"
                        disabled={zoom >= 150}
                        onClick={() =>
                            setZoom((current) => Math.min(150, current + 10))
                        }
                    >
                        <ZoomIn className="size-4" />
                    </Button>
                    <button
                        type="button"
                        className="px-2 text-xs text-slate-600 hover:underline"
                        onClick={() => setZoom(100)}
                    >
                        Reset
                    </button>
                </div>
                <span className="ml-auto text-xs text-slate-600">
                    {changed
                        ? 'Unsaved changes'
                        : unapplied
                          ? 'Draft · not applied'
                          : 'Saved'}{' '}
                    <span className="hidden sm:inline">
                        {' '}
                        ·{' '}
                        {calculating
                            ? 'Calculating…'
                            : 'Numbers = inputs · Green cells = formulas'}
                    </span>
                </span>
            </div>
            <Dialog open={formulaDialog} onOpenChange={setFormulaDialog}>
                <DialogContent className="bg-white text-slate-950 sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Link DUPA field</DialogTitle>
                        <DialogDescription>
                            Choose a DUPA field and the formula that supplies
                            its value.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createFormula();
                        }}
                    >
                        <div className="space-y-1">
                            <Label htmlFor="backup-formula-target">
                                DUPA field
                            </Label>
                            <select
                                id="backup-formula-target"
                                className={`${selectClass} w-full`}
                                value={formulaTarget}
                                onChange={(e) =>
                                    setFormulaTarget(e.target.value)
                                }
                                required
                            >
                                <option value="">Choose DUPA field…</option>
                                {targets.map((t, i) => (
                                    <option key={i} value={i}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="backup-formula-value">
                                Formula
                            </Label>
                            <Input
                                id="backup-formula-value"
                                required
                                className="font-mono"
                                placeholder="=SUM(rows.volume)"
                                value={formulaDraft}
                                onChange={(e) =>
                                    setFormulaDraft(e.target.value)
                                }
                            />
                        </div>
                        {namedError && (
                            <p role="alert" className="text-sm text-red-700">
                                {namedError}
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormulaDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={busy || disabled || !backup}
                            >
                                Link field
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            {backup && (
                <div className="z-20 shrink-0 border-b border-slate-300 bg-white px-2 py-1.5 shadow-sm">
                    {backup.definition.rows.length === 0 && (
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            {backup.definition.rows.length === 0 && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={`${buttonClass} h-7 shrink-0 px-2 text-[11px]`}
                                        disabled={
                                            busy ||
                                            disabled ||
                                            backup.definition.rows.length >= 200
                                        }
                                        onClick={() => insertRow()}
                                    >
                                        <Plus /> Add row
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                                        disabled={busy || disabled}
                                        onClick={() => openFormula('outputs')}
                                    >
                                        <Plus /> Add formula
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs">
                        <span
                            className="max-w-36 min-w-16 truncate rounded border border-slate-300 bg-slate-50 px-1.5 py-1 text-[11px]"
                            title={selectedAddress}
                        >
                            {selectedAddress}
                        </span>
                        <span className="font-serif text-emerald-800 italic">
                            fx
                        </span>
                        <input
                            ref={formulaInput}
                            aria-label="Formula bar"
                            className="h-7 min-w-0 flex-1 rounded border border-emerald-600 bg-white px-2 font-mono text-xs text-slate-950 outline-none focus:ring-1 focus:ring-emerald-600"
                            disabled={
                                busy ||
                                disabled ||
                                (!selection && !selectedResult)
                            }
                            value={selectedValue ?? ''}
                            onSelect={(event) => {
                                formulaCaret.current = {
                                    start:
                                        event.currentTarget.selectionStart ?? 0,
                                    end: event.currentTarget.selectionEnd ?? 0,
                                };
                            }}
                            onChange={(event) => {
                                formulaValue(event.target.value);
                                formulaCaret.current = {
                                    start: event.target.selectionStart ?? 0,
                                    end: event.target.selectionEnd ?? 0,
                                };
                                setReferenceMode(
                                    Boolean(selectedResult) &&
                                        event.target.value.startsWith('='),
                                );
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' ||
                                    event.key === 'Escape'
                                ) {
                                    event.preventDefault();
                                    setReferenceMode(false);
                                }
                            }}
                        />
                        {selectedResult && (
                            <Button
                                type="button"
                                size="sm"
                                variant={referenceMode ? 'default' : 'outline'}
                                className={`${buttonClass} h-7 shrink-0 px-2 text-[11px]`}
                                disabled={busy || disabled}
                                onClick={() => {
                                    if (
                                        !String(selectedValue).startsWith('=')
                                    ) {
                                        formulaValue('=');
                                        formulaCaret.current = {
                                            start: 1,
                                            end: 1,
                                        };
                                    }

                                    setReferenceMode(!referenceMode);
                                }}
                            >
                                {referenceMode ? 'Done picking' : 'Pick cells'}
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={`${buttonClass} h-7 shrink-0 px-2 text-[11px]`}
                            disabled={busy || disabled}
                            onClick={() => openFormula('binding')}
                        >
                            Link field
                        </Button>
                    </div>
                    {referenceMode && selectedResult && (
                        <p className="mt-1 text-[11px] text-slate-500">
                            Click cells to insert references · Type + − * / ·
                            Enter to finish.
                        </p>
                    )}
                    {resultReferences.length > 0 && (
                        <details className="mt-1 text-[11px] text-slate-600">
                            <summary className="w-fit cursor-pointer">
                                Sources ({resultReferences.length})
                            </summary>
                            <div className="mt-1 flex max-h-20 flex-wrap items-center gap-1 overflow-y-auto">
                                {resultReferences.map((reference) => (
                                    <span
                                        key={reference}
                                        className="inline-flex items-center overflow-hidden rounded border border-blue-200 bg-blue-50 font-mono text-blue-800"
                                    >
                                        <button
                                            type="button"
                                            className="px-1.5 py-0.5 hover:bg-blue-100"
                                            title="Jump to source cell"
                                            onClick={() =>
                                                jumpToReference(reference)
                                            }
                                        >
                                            {reference}
                                        </button>
                                        <button
                                            type="button"
                                            className="border-l border-blue-200 px-1.5 py-0.5 font-sans font-semibold hover:bg-red-100 hover:text-red-800"
                                            aria-label={`Remove ${reference} from formula`}
                                            title="Remove this source from the formula"
                                            disabled={busy || disabled}
                                            onClick={() => {
                                                const next =
                                                    removeFormulaReference(
                                                        String(
                                                            selectedValue ?? '',
                                                        ),
                                                        reference,
                                                    );
                                                formulaValue(next);
                                                formulaCaret.current = {
                                                    start: next.length,
                                                    end: next.length,
                                                };
                                            }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto p-2">
                {!currentBackups.length && (
                    <div className="mx-auto max-w-xl space-y-3 border border-slate-300 bg-white p-8 text-center">
                        <h3 className="text-lg font-semibold">
                            Create a backup for this DUPA item
                        </h3>
                        <p className="text-sm text-slate-600">
                            Choose a layout above, then click New backup. Enter
                            your measurements in the table, just like Excel.
                        </p>
                    </div>
                )}
                {backup && (
                    <fieldset
                        disabled={busy || disabled}
                        className="mx-auto w-full max-w-[1400px] min-w-0 space-y-2 disabled:opacity-60"
                        style={{ zoom: zoom / 100 }}
                        onPointerDownCapture={(event) => {
                            if (
                                referenceMode &&
                                selectedResult &&
                                referenceFromTarget(event.target)
                            ) {
                                event.preventDefault();
                            }
                        }}
                        onClickCapture={(event) => {
                            const reference = referenceFromTarget(event.target);

                            if (referenceMode && selectedResult && reference) {
                                event.preventDefault();
                                event.stopPropagation();
                                insertReference(reference);
                            }
                        }}
                    >
                        <div className="overflow-hidden border border-slate-400 bg-white shadow-sm">
                            <div className="border-b border-slate-400 px-3 py-1.5 text-center">
                                <Input
                                    aria-label="Backup title"
                                    className="h-7 border-0 bg-transparent text-center text-base font-bold text-slate-950 shadow-none"
                                    value={backup.name}
                                    onChange={(e) =>
                                        edit({
                                            ...document,
                                            backups: document.backups.map(
                                                (b) =>
                                                    b.key === backup.key
                                                        ? {
                                                              ...b,
                                                              name: e.target
                                                                  .value,
                                                          }
                                                        : b,
                                            ),
                                        })
                                    }
                                />
                                <p className="text-xs text-slate-600">
                                    BACKUP COMPUTATION · this DUPA item ·{' '}
                                    {side.replace('_', '-')}
                                </p>
                            </div>
                            <div
                                className="border-b border-slate-300 px-2 py-1 text-xs"
                                aria-live="polite"
                            >
                                <strong>
                                    {appliedKeys.has(backup.key)
                                        ? 'In use by this DUPA item'
                                        : selectedKeys.has(backup.key)
                                          ? 'Selected — apply changes to use this backup'
                                          : 'Unused backup'}
                                </strong>
                                {deleteBlocked(backup.key) &&
                                    ' · Delete locked: switch linked fields and apply first; remove references from other backups.'}
                            </div>
                            <div className="overflow-x-auto">
                                <table
                                    ref={grid}
                                    className="w-full table-fixed border-collapse text-xs"
                                    style={{
                                        minWidth: Math.max(
                                            640,
                                            304 +
                                                backup.definition.columns
                                                    .length *
                                                    88,
                                        ),
                                    }}
                                >
                                    <colgroup>
                                        <col className="w-8" />
                                        <col className="w-44" />
                                        {backup.definition.columns.map((c) => (
                                            <col
                                                key={c.key}
                                                className="min-w-20"
                                            />
                                        ))}
                                        <col className="w-24" />
                                    </colgroup>
                                    <thead>
                                        <tr className="bg-slate-100 text-center text-xs text-slate-600">
                                            <th className="border border-slate-300 py-1" />
                                            <th className="border border-slate-300">
                                                A
                                            </th>
                                            {backup.definition.columns.map(
                                                (c, i) => (
                                                    <th
                                                        key={c.key}
                                                        className="border border-slate-300 font-normal"
                                                    >
                                                        <div className="flex items-center justify-between gap-0.5 px-1 py-0.5">
                                                            <span>
                                                                {columnLetter(
                                                                    i + 1,
                                                                )}
                                                            </span>
                                                            <div className="flex items-center gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    className="flex size-5 items-center justify-center rounded text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                                                    aria-label={`Insert column after ${c.label}`}
                                                                    title="Add column to the right"
                                                                    disabled={
                                                                        busy ||
                                                                        disabled ||
                                                                        backup
                                                                            .definition
                                                                            .columns
                                                                            .length >=
                                                                            30
                                                                    }
                                                                    onClick={() =>
                                                                        insertColumn(
                                                                            c.key,
                                                                        )
                                                                    }
                                                                >
                                                                    <Plus className="size-3" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-700"
                                                                    aria-label={`Remove column ${c.label}`}
                                                                    title={`Remove ${c.label}`}
                                                                    disabled={
                                                                        busy ||
                                                                        disabled
                                                                    }
                                                                    onClick={() =>
                                                                        removeColumn(
                                                                            c.key,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="size-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </th>
                                                ),
                                            )}
                                            <th className="border border-slate-300">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                                                    disabled={
                                                        busy ||
                                                        disabled ||
                                                        backup.definition
                                                            .columns.length >=
                                                            30
                                                    }
                                                    onClick={() =>
                                                        insertColumn()
                                                    }
                                                >
                                                    <Plus className="size-3" />{' '}
                                                    Column
                                                </button>
                                            </th>
                                        </tr>
                                        <tr className="bg-slate-50 text-center">
                                            <th className="border border-slate-300 text-xs font-normal text-slate-500">
                                                2
                                            </th>
                                            <th className="border border-slate-300 px-1.5 py-1 text-left font-semibold">
                                                Description
                                            </th>
                                            {backup.definition.columns.map(
                                                (c) => (
                                                    <th
                                                        key={c.key}
                                                        className="border border-slate-300 px-1.5 py-1 font-semibold"
                                                    >
                                                        <input
                                                            aria-label={`Column ${c.key} heading`}
                                                            data-column-heading={
                                                                c.key
                                                            }
                                                            title={`Click to rename · Formula key: ${c.key}`}
                                                            className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-center text-xs font-semibold text-slate-950 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-600"
                                                            value={c.label}
                                                            onChange={(e) =>
                                                                table({
                                                                    ...backup.definition,
                                                                    columns:
                                                                        backup.definition.columns.map(
                                                                            (
                                                                                column,
                                                                            ) =>
                                                                                column.key ===
                                                                                c.key
                                                                                    ? {
                                                                                          ...column,
                                                                                          label: e
                                                                                              .target
                                                                                              .value,
                                                                                      }
                                                                                    : column,
                                                                        ),
                                                                })
                                                            }
                                                            onKeyDown={(
                                                                event,
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    'Enter'
                                                                ) {
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                ),
                                            )}
                                            <th className="border border-slate-300 text-xs font-medium">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backup.definition.rows.map((r, ri) => (
                                            <tr
                                                key={r.key}
                                                className="hover:bg-slate-50"
                                            >
                                                <th className="border border-slate-300 bg-slate-100 text-center text-xs font-normal text-slate-500">
                                                    {ri + 3}
                                                </th>
                                                <td className="border border-slate-300">
                                                    <input
                                                        aria-label={`Row ${ri + 1} description`}
                                                        data-row={ri}
                                                        data-column={0}
                                                        className={sheetInput}
                                                        value={r.label}
                                                        onFocus={() => {
                                                            setResultSelection(
                                                                null,
                                                            );
                                                            setReferenceMode(
                                                                false,
                                                            );
                                                            setSelection({
                                                                row: r.key,
                                                                column: 'description',
                                                            });
                                                            setEditing(null);
                                                        }}
                                                        onChange={(e) =>
                                                            cell(
                                                                r.key,
                                                                'description',
                                                                e.target.value,
                                                            )
                                                        }
                                                        onKeyDown={(e) =>
                                                            move(e, ri, 0)
                                                        }
                                                        onPaste={(e) =>
                                                            paste(e, ri, 0)
                                                        }
                                                    />
                                                </td>
                                                {backup.definition.columns.map(
                                                    (c, ci) => {
                                                        const formula = String(
                                                            r.cells[c.key] ??
                                                                '',
                                                        ).startsWith('=');
                                                        const isEditing =
                                                            editing?.row ===
                                                                r.key &&
                                                            editing.column ===
                                                                c.key;
                                                        const raw =
                                                            r.cells[c.key] ??
                                                            '';

                                                        return (
                                                            <td
                                                                key={c.key}
                                                                className={`border border-slate-300 ${resultReferences.includes(`rows.${r.key}.${c.key}`) ? 'bg-blue-100 ring-1 ring-blue-500 ring-inset' : formula ? 'bg-emerald-50' : 'bg-amber-50/30'}`}
                                                            >
                                                                <input
                                                                    aria-label={`${r.label} ${c.label}`}
                                                                    data-backup-reference={`rows.${r.key}.${c.key}`}
                                                                    data-row={
                                                                        ri
                                                                    }
                                                                    data-column={
                                                                        ci + 1
                                                                    }
                                                                    className={`${sheetInput} text-right tabular-nums`}
                                                                    value={
                                                                        formula &&
                                                                        !isEditing
                                                                            ? displayNumber(
                                                                                  preview
                                                                                      ?.values[
                                                                                      `${backup.key}.rows.${r.key}.${c.key}`
                                                                                  ],
                                                                              )
                                                                            : raw
                                                                    }
                                                                    onFocus={() => {
                                                                        setResultSelection(
                                                                            null,
                                                                        );
                                                                        setReferenceMode(
                                                                            false,
                                                                        );
                                                                        setSelection(
                                                                            {
                                                                                row: r.key,
                                                                                column: c.key,
                                                                            },
                                                                        );
                                                                        setEditing(
                                                                            null,
                                                                        );
                                                                    }}
                                                                    onDoubleClick={() =>
                                                                        setEditing(
                                                                            {
                                                                                row: r.key,
                                                                                column: c.key,
                                                                            },
                                                                        )
                                                                    }
                                                                    onBlur={() =>
                                                                        setEditing(
                                                                            null,
                                                                        )
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        cell(
                                                                            r.key,
                                                                            c.key,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e,
                                                                    ) => {
                                                                        if (
                                                                            e.key ===
                                                                            'F2'
                                                                        ) {
                                                                            e.preventDefault();
                                                                            setEditing(
                                                                                {
                                                                                    row: r.key,
                                                                                    column: c.key,
                                                                                },
                                                                            );
                                                                        } else {
                                                                            move(
                                                                                e,
                                                                                ri,
                                                                                ci +
                                                                                    1,
                                                                            );
                                                                        }
                                                                    }}
                                                                    onPaste={(
                                                                        e,
                                                                    ) =>
                                                                        paste(
                                                                            e,
                                                                            ri,
                                                                            ci +
                                                                                1,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        );
                                                    },
                                                )}
                                                <td className="border border-slate-300 text-center">
                                                    <div className="flex items-center justify-center gap-0.5 px-1">
                                                        <button
                                                            type="button"
                                                            className="flex size-7 items-center justify-center rounded text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                                                            disabled={
                                                                busy ||
                                                                disabled ||
                                                                backup
                                                                    .definition
                                                                    .rows
                                                                    .length >=
                                                                    200
                                                            }
                                                            aria-label={`Insert row below ${r.label}`}
                                                            title="Add row below"
                                                            onClick={() =>
                                                                insertRow(r.key)
                                                            }
                                                        >
                                                            <Plus className="size-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="size-7 rounded font-serif text-xs text-emerald-800 italic hover:bg-emerald-100"
                                                            disabled={
                                                                busy || disabled
                                                            }
                                                            aria-label={`Add formula from ${r.label}`}
                                                            title="Add formula from this row"
                                                            onClick={() =>
                                                                openFormula(
                                                                    'outputs',
                                                                    r,
                                                                )
                                                            }
                                                        >
                                                            fx
                                                        </button>

                                                        <button
                                                            type="button"
                                                            tabIndex={-1}
                                                            aria-label={`Remove ${r.label}`}
                                                            className="flex size-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-700"
                                                            onClick={() =>
                                                                table({
                                                                    ...backup.definition,
                                                                    rows: backup.definition.rows.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            ri,
                                                                    ),
                                                                })
                                                            }
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        {backup.definition.outputs
                                            .slice(0, 1)
                                            .map(renderOutputRow)}
                                        {renderInputRows()}
                                        {backup.definition.outputs
                                            .slice(1)
                                            .map((v, i) =>
                                                renderOutputRow(v, i + 1),
                                            )}
                                        <tr>
                                            <td
                                                colSpan={
                                                    backup.definition.columns
                                                        .length + 3
                                                }
                                                className="border border-slate-300 bg-emerald-50/50 px-2 py-1"
                                            >
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className={`${buttonClass} h-6 gap-1 rounded px-2 text-[11px] leading-none [&_svg]:size-3`}
                                                        disabled={
                                                            busy || disabled
                                                        }
                                                        onClick={() =>
                                                            openFormula(
                                                                'inputs',
                                                            )
                                                        }
                                                    >
                                                        <Plus /> Add variable
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className={`${buttonClass} h-6 gap-1 rounded px-2 text-[11px] leading-none [&_svg]:size-3`}
                                                        disabled={
                                                            busy || disabled
                                                        }
                                                        onClick={() =>
                                                            openFormula(
                                                                'outputs',
                                                            )
                                                        }
                                                    >
                                                        <Plus /> Add formula
                                                    </Button>
                                                    <span className="ml-1 text-[11px] text-slate-500">
                                                        Set up variables and
                                                        formulas here, below
                                                        Total volume.
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </fieldset>
                )}
                {preview && (
                    <div className="mx-auto mt-4 max-w-[1400px] border border-emerald-300 bg-emerald-50 p-4 text-sm">
                        <h3 className="mb-2 font-semibold">
                            Preview · changes after Apply &amp; Save
                        </h3>
                        {preview.changes.map((c, i) => (
                            <p key={i}>
                                {targets.find(
                                    (t) =>
                                        t.kind === c.kind &&
                                        (t.row_uuid ?? '') === c.uuid &&
                                        t.field === c.field,
                                )?.label ?? c.field}
                                : {displayNumber(c.before)} →{' '}
                                <strong>{displayNumber(c.value)}</strong>
                            </p>
                        ))}
                        <p className="mt-2">
                            Direct cost:{' '}
                            {displayNumber(preview.totals.direct_cost)} · Total
                            cost: {displayNumber(preview.totals.total_cost)}
                        </p>
                    </div>
                )}
            </div>
            <div
                className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-slate-300 bg-slate-200 px-3 py-1"
                aria-label="Backup sheets"
            >
                {currentBackups.map((b) => (
                    <button
                        type="button"
                        key={b.key}
                        className={`shrink-0 border px-4 py-2 text-xs whitespace-nowrap ${active === b.key ? 'border-b-2 border-slate-300 border-b-emerald-700 bg-white font-semibold text-emerald-800' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                        onClick={() => {
                            setActive(b.key);
                            setSelection(null);
                        }}
                    >
                        {b.name} ·{' '}
                        {appliedKeys.has(b.key)
                            ? 'In use'
                            : selectedKeys.has(b.key)
                              ? 'Selected · not applied'
                              : 'Unused'}
                    </button>
                ))}
            </div>
            <Dialog
                open={templateDialog}
                onOpenChange={(open) => {
                    if (!busy) {
                        setTemplateDialog(open);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save backup as template</DialogTitle>
                        <DialogDescription>
                            Create a new template from this backup. Existing
                            templates remain unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void request('template');
                        }}
                        className="space-y-4"
                    >
                        <label className="block space-y-2 text-sm">
                            Template name
                            <Input
                                aria-label="Template name"
                                autoFocus
                                required
                                maxLength={255}
                                value={templateName}
                                onChange={(event) =>
                                    setTemplateName(event.target.value)
                                }
                                disabled={busy}
                            />
                        </label>
                        {error && (
                            <p role="alert" className="text-sm text-red-700">
                                {error}
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setTemplateDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={busy || !templateName.trim()}
                            >
                                {busy ? 'Saving…' : 'Create template'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-300 bg-white px-4 py-3">
                <div className="min-w-48 flex-1 text-xs" aria-live="polite">
                    {error ? (
                        <span role="alert" className="text-red-700">
                            {error}
                        </span>
                    ) : busy ? (
                        'Saving…'
                    ) : calculating ? (
                        'Calculating preview…'
                    ) : changed ? (
                        'Changes are not applied to the DUPA yet.'
                    ) : unapplied ? (
                        'Draft saved. Apply & Save to update the DUPA.'
                    ) : (
                        'Edit measurements, then preview and apply.'
                    )}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={buttonClass}
                    disabled={busy || disabled || !backup}
                    onClick={() => {
                        setError('');
                        setTemplateName('');
                        setTemplateDialog(true);
                    }}
                >
                    Save template
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={buttonClass}
                    disabled={busy || disabled}
                    onClick={() => void request('draft')}
                >
                    Save draft
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={buttonClass}
                    disabled={busy || disabled}
                    onClick={() => void request('preview')}
                >
                    Preview
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={busy || disabled || !preview}
                    onClick={() => void request('apply')}
                >
                    Apply &amp; Save
                </Button>
            </div>
        </div>
    );
}
