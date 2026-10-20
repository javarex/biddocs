import { router, useForm } from '@inertiajs/react';
import { LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Dupa = {
    id: number;
    section_id: number;
    sub_section_id: number | null;
    pay_item_no: string;
    description: string;
    unit: string;
    sort_order: number;
    has_estimate: boolean;
    needs_review: boolean;
};
type SubSection = {
    id: number;
    sub_section: string;
    sort_order: number;
    items: Dupa[];
};
export type DupaSection = {
    id: number;
    section: string;
    sort_order: number;
    items: Dupa[];
    sub_sections: SubSection[];
};
export default function ProjectDupaActions({
    sections,
    openEstimateId,
}: {
    projectId: number;
    sections: DupaSection[];
    openEstimateId: number | null;
}) {
    const item = sections
        .flatMap((s) => [
            ...s.items,
            ...s.sub_sections.flatMap((sub) => sub.items),
        ])
        .find((item) => item.id === openEstimateId);

    return <>{item && <DupaEstimateDialog key={item.id} item={item} />}</>;
}

export function DupaEstimateDialog({
    item,
    onClose,
}: {
    item: Pick<Dupa, 'id' | 'pay_item_no'>;
    onClose?: () => void;
}) {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const frame = useRef<HTMLIFrameElement>(null);
    const changed = useRef(false);
    const unsaved = useRef(false);
    const saving = useRef(false);
    useEffect(() => {
        if (!open) {
            return;
        }

        const saved = (event: MessageEvent) => {
            if (
                event.origin === window.location.origin &&
                event.source === frame.current?.contentWindow &&
                event.data?.type === 'biddocs:dupa-dirty' &&
                event.data.dupaId === item.id
            ) {
                unsaved.current = Boolean(event.data.dirty);
                saving.current = Boolean(event.data.saving);
            }

            if (
                event.origin === window.location.origin &&
                event.source === frame.current?.contentWindow &&
                event.data?.type === 'biddocs:dupa-saved' &&
                event.data.dupaId === item.id
            ) {
                changed.current = true;
            }
        };
        window.addEventListener('message', saved);

        return () => window.removeEventListener('message', saved);
    }, [open, item.id]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (
                    !next &&
                    (saving.current ||
                        (unsaved.current &&
                            !window.confirm('Discard unsaved DUPA changes?')))
                ) {
                    return;
                }

                setOpen(next);

                if (!next) {
                    onClose?.();
                }

                if (!next && changed.current) {
                    changed.current = false;
                    router.reload();
                }
            }}
        >
            <DialogContent
                className="flex h-[98dvh] max-h-[98dvh] w-[99vw] max-w-[99vw] flex-col gap-0 overflow-hidden rounded-xl border-emerald-900/20 p-0 shadow-2xl sm:h-[96dvh] sm:max-h-[96dvh] sm:w-[96vw] sm:max-w-[96vw]"
                onFocusOutside={(event) => {
                    if (event.target instanceof HTMLIFrameElement) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader className="gap-1 border-b border-emerald-800/15 bg-gradient-to-r from-emerald-50 to-white px-5 py-3 pr-12 text-left">
                    <DialogTitle className="text-base font-semibold text-emerald-950">
                        Detailed Unit Price Analysis — {item.pay_item_no}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-emerald-900/70">
                        Build your estimate, review the cost breakdown, and save
                        all changes in one place.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative min-h-0 flex-1">
                    {loading && (
                        <div
                            className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
                            role="status"
                        >
                            <LoaderCircle className="size-4 animate-spin" />
                            Loading estimate…
                        </div>
                    )}
                    <iframe
                        ref={frame}
                        className="absolute inset-0 size-full border-0 bg-background"
                        src={`/admin/dupas/${item.id}/edit?embedded=1`}
                        title={`Estimate for ${item.pay_item_no}`}
                        onLoad={() => setLoading(false)}
                        style={{ visibility: loading ? 'hidden' : 'visible' }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

type DupaSourceOption = {
    id: number;
    pay_item_no: string;
    description: string;
    unit: string;
    part: string | null;
    item_heading: string | null;
};

export function AddDupaItem({
    projectId,
    sections,
    sectionId,
    subSectionId,
    inline = false,
}: {
    projectId: number;
    sections: DupaSection[];
    sectionId?: number;
    subSectionId?: number;
    inline?: boolean;
}) {
    const [search, setSearch] = useState('');
    const [sources, setSources] = useState<DupaSourceOption[]>([]);
    const [selectedSource, setSelectedSource] =
        useState<DupaSourceOption | null>(null);
    const [loadingSources, setLoadingSources] = useState(false);
    const [sourceError, setSourceError] = useState('');
    const sectionForm = useForm({ section: '' });
    const [open, setOpen] = useState(false);
    const form = useForm({
        section_id: '',
        sub_section_id: '',
        dupa_source_id: '',
        open_estimate: true,
    });
    const section = sections.find((s) => String(s.id) === form.data.section_id);
    useEffect(() => {
        if (!open || selectedSource) {
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoadingSources(true);
            setSourceError('');

            try {
                const response = await fetch(
                    `/admin/projects/${projectId}/dupa-sources?search=${encodeURIComponent(search)}`,
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('Unable to load DUPA sources. Try again.');
                }

                const data = await response.json();
                setSources(data.data);
            } catch (error) {
                if (!controller.signal.aborted) {
                    setSourceError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load DUPA sources.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingSources(false);
                }
            }
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [open, search, projectId, selectedSource]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button
                type="button"
                variant={inline ? 'ghost' : 'default'}
                size={inline ? 'sm' : 'default'}
                className={
                    inline
                        ? 'h-7 justify-start text-xs text-primary print:hidden'
                        : undefined
                }
                onClick={() => {
                    form.setData(
                        'section_id',
                        sectionId
                            ? String(sectionId)
                            : sections.length
                              ? String(sections[0].id)
                              : '',
                    );
                    form.setData(
                        'sub_section_id',
                        subSectionId ? String(subSectionId) : '',
                    );
                    form.setData('dupa_source_id', '');
                    setSelectedSource(null);
                    setLoadingSources(true);
                    setSourceError('');
                    setSearch('');
                    setSources([]);
                    form.clearErrors();
                    setOpen(true);
                }}
            >
                <Plus /> Add Item
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add DUPA Item</DialogTitle>
                    <DialogDescription>
                        Choose its placement and select an item from the DUPA
                        source catalog. Its estimate form opens here after
                        saving.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!section || !selectedSource) {
                            return;
                        }

                        form.post(`/admin/sections/${section.id}/dupas`, {
                            preserveScroll: true,
                            onSuccess: () => {
                                setOpen(false);
                                form.reset();
                            },
                        });
                    }}
                >
                    <div className="space-y-1">
                        <Label htmlFor="dupa-section">Section</Label>
                        <select
                            id="dupa-section"
                            className="h-9 w-full rounded border bg-background px-2"
                            required
                            value={form.data.section_id}
                            onChange={(e) => {
                                form.setData('section_id', e.target.value);
                                form.setData('sub_section_id', '');
                            }}
                        >
                            {sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.section}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="dupa-new-section">
                            New section (optional)
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="dupa-new-section"
                                placeholder="Section name"
                                value={sectionForm.data.section}
                                onChange={(e) =>
                                    sectionForm.setData(
                                        'section',
                                        e.target.value,
                                    )
                                }
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={
                                    sectionForm.processing ||
                                    !sectionForm.data.section.trim()
                                }
                                onClick={() =>
                                    sectionForm.post(
                                        `/admin/projects/${projectId}/sections`,
                                        {
                                            preserveScroll: true,
                                            onSuccess: (page) => {
                                                const updated = (
                                                    page.props as unknown as {
                                                        dupaSections: DupaSection[];
                                                    }
                                                ).dupaSections;
                                                const id = Math.max(
                                                    ...updated.map((s) => s.id),
                                                );
                                                form.setData(
                                                    'section_id',
                                                    String(id),
                                                );
                                                form.setData(
                                                    'sub_section_id',
                                                    '',
                                                );
                                                sectionForm.reset();
                                            },
                                        },
                                    )
                                }
                            >
                                Add section
                            </Button>
                        </div>
                        {sectionForm.errors.section && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {sectionForm.errors.section}
                            </p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="dupa-subsection">Subsection</Label>
                        <select
                            id="dupa-subsection"
                            className="h-9 w-full rounded border bg-background px-2"
                            value={form.data.sub_section_id}
                            onChange={(e) =>
                                form.setData('sub_section_id', e.target.value)
                            }
                        >
                            <option value="">Directly under section</option>
                            {section?.sub_sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.sub_section}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dupa-source-search">
                            DUPA source item
                        </Label>
                        <Input
                            id="dupa-source-search"
                            placeholder="Search item number, description, or specifications"
                            maxLength={255}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setLoadingSources(true);
                                setSourceError('');
                                setSources([]);
                                setSelectedSource(null);
                                form.setData('dupa_source_id', '');
                            }}
                        />
                        {!selectedSource && (
                            <div
                                className="max-h-56 overflow-y-auto rounded border"
                                aria-label="DUPA source results"
                            >
                                {loadingSources && (
                                    <p
                                        role="status"
                                        className="p-3 text-sm text-muted-foreground"
                                    >
                                        Loading sources…
                                    </p>
                                )}
                                {!loadingSources &&
                                    sources.length === 0 &&
                                    !sourceError && (
                                        <p className="p-3 text-sm text-muted-foreground">
                                            No source items found. Try another
                                            search or import the DUPA source
                                            catalog first.
                                        </p>
                                    )}
                                {sources.map((source) => (
                                    <button
                                        type="button"
                                        key={source.id}
                                        className="block w-full space-y-1 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted focus:bg-muted"
                                        onClick={() => {
                                            setSelectedSource(source);
                                            form.setData(
                                                'dupa_source_id',
                                                String(source.id),
                                            );
                                        }}
                                    >
                                        <span className="block font-medium">
                                            {source.pay_item_no} · {source.unit}
                                        </span>
                                        <span className="block whitespace-normal">
                                            {source.description}
                                        </span>
                                        {source.part && (
                                            <span className="block text-xs text-muted-foreground">
                                                {source.part}
                                            </span>
                                        )}
                                    </button>
                                ))}
                                {sources.length === 30 && (
                                    <p className="p-2 text-xs text-muted-foreground">
                                        Showing the first 30 matches. Refine
                                        your search to find a specific variant.
                                    </p>
                                )}
                            </div>
                        )}
                        {sourceError && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {sourceError}
                            </p>
                        )}
                        {selectedSource && (
                            <div className="space-y-2 rounded border bg-muted/30 p-3 text-sm">
                                <p>
                                    <strong>Item No.:</strong>{' '}
                                    {selectedSource.pay_item_no}
                                </p>
                                <p className="whitespace-pre-line">
                                    <strong>Description:</strong>{' '}
                                    {selectedSource.description}
                                </p>
                                <p>
                                    <strong>Unit:</strong> {selectedSource.unit}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedSource(null);
                                        form.setData('dupa_source_id', '');
                                    }}
                                >
                                    Change source item
                                </Button>
                            </div>
                        )}
                    </div>
                    {Object.values(form.errors).length > 0 && (
                        <p role="alert" className="text-sm text-destructive">
                            {Object.values(form.errors).join(' ')}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={
                                form.processing || !section || !selectedSource
                            }
                        >
                            Create &amp; open estimate
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
