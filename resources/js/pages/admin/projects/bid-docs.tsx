import { Head, Link, router } from '@inertiajs/react';
import { renderAsync } from 'docx-preview';
import {
    Download,
    FileText,
    Import,
    Pencil,
    Printer,
    RotateCcw,
    Save,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import PageHeader from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    project: {
        id: number;
        project_code: string;
        project_name: string;
        location: string;
        contract_duration: number;
        sections_count: number;
        items_count: number;
        total_cost: number;
    };
    documentUrl: string;
    editor: {
        can_edit: boolean;
        has_saved_version: boolean;
        revision: number;
        edited_at: string | null;
        edited_by: { id: number; name: string } | null;
        save_url: string;
        reset_url: string;
    };
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

function editableParagraphText(paragraph: HTMLElement): string {
    const clone = paragraph.cloneNode(true) as HTMLElement;

    clone.querySelectorAll('span[id^="BDS_EDIT_"]').forEach((marker) => {
        marker.remove();
    });
    clone.querySelectorAll('.bid-docx-tab-stop').forEach((tab) => {
        tab.replaceWith(document.createTextNode('\t'));
    });

    return clone.textContent ?? '';
}

export default function ProjectBidDocuments({
    project,
    documentUrl,
    editor,
}: Props) {
    const documentContainer = useRef<HTMLDivElement>(null);
    const styleContainer = useRef<HTMLDivElement>(null);
    const originalParagraphs = useRef(
        new Map<string, { html: string; text: string }>(),
    );
    const dirtyEdits = useRef<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [printError, setPrintError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirtyCount, setDirtyCount] = useState(0);
    const [editableParagraphCount, setEditableParagraphCount] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        const renderDocument = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(documentUrl, {
                    credentials: 'same-origin',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('The bid document could not be generated.');
                }

                const blob = await response.blob();

                if (!documentContainer.current || !styleContainer.current) {
                    return;
                }

                documentContainer.current.replaceChildren();
                styleContainer.current.replaceChildren();
                await renderAsync(
                    blob,
                    documentContainer.current,
                    styleContainer.current,
                    {
                        className: 'bid-docx',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        hideWrapperOnPrint: true,
                        renderHeaders: true,
                        renderFooters: true,
                        renderFootnotes: true,
                        renderEndnotes: true,
                        ignoreLastRenderedPageBreak: false,
                        useBase64URL: true,
                        experimental: true,
                    },
                );

                const indexedParagraphs = new Map<
                    string,
                    { html: string; text: string }
                >();
                const markers = documentContainer.current.querySelectorAll(
                    'span[id^="BDS_EDIT_"]',
                );

                markers.forEach((marker) => {
                    const paragraph = marker.closest('p');

                    if (!(paragraph instanceof HTMLParagraphElement)) {
                        return;
                    }

                    const key = marker.id;
                    paragraph.dataset.bidDocEditKey = key;
                    paragraph.contentEditable = 'false';
                    paragraph.spellcheck = true;
                    marker.setAttribute('contenteditable', 'false');
                    paragraph
                        .querySelectorAll('.bid-docx-tab-stop')
                        .forEach((tab) => {
                            tab.setAttribute('contenteditable', 'false');
                        });
                    indexedParagraphs.set(key, {
                        html: paragraph.innerHTML,
                        text: editableParagraphText(paragraph),
                    });
                });

                originalParagraphs.current = indexedParagraphs;
                dirtyEdits.current = {};
                setDirtyCount(0);
                setEditableParagraphCount(indexedParagraphs.size);
            } catch (exception) {
                if (
                    exception instanceof DOMException &&
                    exception.name === 'AbortError'
                ) {
                    return;
                }

                setError(
                    exception instanceof Error
                        ? exception.message
                        : 'The bid document could not be displayed.',
                );
            } finally {
                setLoading(false);
            }
        };

        void renderDocument();

        return () => controller.abort();
    }, [documentUrl]);

    useEffect(() => {
        const container = documentContainer.current;

        if (!container) {
            return;
        }

        container
            .querySelectorAll<HTMLElement>('p[data-bid-doc-edit-key]')
            .forEach((paragraph) => {
                paragraph.contentEditable = editing ? 'true' : 'false';
            });
    }, [editing, editableParagraphCount]);

    const updateDirtyParagraph = (paragraph: HTMLElement) => {
        const key = paragraph.dataset.bidDocEditKey;

        if (!key) {
            return;
        }

        const value = editableParagraphText(paragraph);

        if (value === originalParagraphs.current.get(key)?.text) {
            delete dirtyEdits.current[key];
        } else {
            dirtyEdits.current[key] = value;
        }

        setDirtyCount(Object.keys(dirtyEdits.current).length);
    };

    const handleDocumentInput = (event: React.FormEvent<HTMLDivElement>) => {
        if (!editing) {
            return;
        }

        const paragraph = (event.target as HTMLElement).closest<HTMLElement>(
            'p[data-bid-doc-edit-key]',
        );

        if (paragraph) {
            updateDirtyParagraph(paragraph);
        }
    };

    const handleDocumentKeyDown = (
        event: React.KeyboardEvent<HTMLDivElement>,
    ) => {
        if (editing && event.key === 'Enter') {
            event.preventDefault();
        }
    };

    const handleDocumentPaste = (
        event: React.ClipboardEvent<HTMLDivElement>,
    ) => {
        if (!editing) {
            return;
        }

        const paragraph = (event.target as HTMLElement).closest<HTMLElement>(
            'p[data-bid-doc-edit-key]',
        );

        if (!paragraph) {
            return;
        }

        event.preventDefault();
        const text = event.clipboardData
            .getData('text/plain')
            .replace(/\s*\r?\n\s*/g, ' ');
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        updateDirtyParagraph(paragraph);
    };

    const startEditing = () => {
        setSaveError(null);
        dirtyEdits.current = {};
        setDirtyCount(0);
        setEditing(true);
    };

    const cancelEditing = () => {
        const container = documentContainer.current;
        originalParagraphs.current.forEach((original, key) => {
            const paragraph = container?.querySelector<HTMLElement>(
                `p[data-bid-doc-edit-key="${key}"]`,
            );

            if (paragraph) {
                paragraph.innerHTML = original.html;
            }
        });
        dirtyEdits.current = {};
        setDirtyCount(0);
        setSaveError(null);
        setEditing(false);
    };

    const saveDocument = () => {
        if (dirtyCount === 0) {
            setEditing(false);

            return;
        }

        router.put(
            editor.save_url,
            {
                revision: editor.revision,
                edits: dirtyEdits.current,
            },
            {
                preserveScroll: true,
                onStart: () => {
                    setSaving(true);
                    setSaveError(null);
                },
                onError: (errors) => {
                    setSaveError(
                        errors.document ??
                            errors.edits ??
                            'The bid document changes could not be saved.',
                    );
                },
                onSuccess: () => {
                    dirtyEdits.current = {};
                    setDirtyCount(0);
                    setEditing(false);
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const printDocument = () => {
        if (!documentContainer.current || !styleContainer.current) {
            return;
        }

        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            setPrintError(
                'The print window was blocked. Allow pop-ups for this site and try again.',
            );

            return;
        }

        setPrintError(null);
        printWindow.document.open();
        printWindow.document.write(`<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bid Documents</title>
    ${styleContainer.current.innerHTML}
    <style>
        @page { size: auto; margin: 0; }
        html, body { margin: 0; padding: 0; background: white; }
        .bid-docx-wrapper {
            display: block !important;
            width: auto !important;
            min-height: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
        }
        .bid-docx-wrapper > section.bid-docx {
            display: flex !important;
            position: relative !important;
            margin: 0 auto !important;
            overflow: hidden !important;
            box-shadow: none !important;
            break-after: page !important;
            page-break-after: always !important;
        }
        .bid-docx-wrapper > section.bid-docx:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
        }
    </style>
</head>
<body>${documentContainer.current.innerHTML}</body>
</html>`);
        printWindow.document.close();
        printWindow.document.title = `${project.project_code} Bid Documents`;

        const printWhenReady = async () => {
            const images = Array.from(printWindow.document.images);
            await Promise.all(
                images.map(
                    (image) =>
                        new Promise<void>((resolve) => {
                            if (image.complete) {
                                resolve();

                                return;
                            }

                            image.addEventListener('load', () => resolve(), {
                                once: true,
                            });
                            image.addEventListener('error', () => resolve(), {
                                once: true,
                            });
                        }),
                ),
            );
            await printWindow.document.fonts?.ready;
            printWindow.focus();
            printWindow.print();
        };

        if (printWindow.document.readyState === 'complete') {
            window.setTimeout(() => void printWhenReady(), 250);
        } else {
            printWindow.addEventListener(
                'load',
                () => window.setTimeout(() => void printWhenReady(), 250),
                { once: true },
            );
        }
    };

    return (
        <>
            <Head title={`Bid Documents - ${project.project_code}`} />
            <div className="bid-doc-page space-y-6 p-4 md:p-6">
                <PageHeader
                    title="Bid Documents"
                    description={`${project.project_code} · ${project.project_name}`}
                    backHref={`/admin/projects/${project.id}`}
                    action={
                        <div className="flex flex-wrap gap-2 print:hidden">
                            {editing ? (
                                <>
                                    <Button
                                        variant="outline"
                                        disabled={saving}
                                        onClick={cancelEditing}
                                    >
                                        <X /> Cancel
                                    </Button>
                                    <Button
                                        disabled={saving || dirtyCount === 0}
                                        onClick={saveDocument}
                                    >
                                        {saving ? <Spinner /> : <Save />}
                                        Save changes
                                        {dirtyCount > 0 && ` (${dirtyCount})`}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {editor.can_edit && (
                                        <Button
                                            variant="outline"
                                            disabled={
                                                loading ||
                                                error !== null ||
                                                editableParagraphCount === 0
                                            }
                                            onClick={startEditing}
                                        >
                                            <Pencil /> Edit document
                                        </Button>
                                    )}
                                    {editor.can_edit &&
                                        editor.has_saved_version && (
                                            <ConfirmDialog
                                                title="Reset bid document?"
                                                description="This removes all direct document edits and regenerates the document from the current project and BOQ data."
                                                confirmLabel="Reset document"
                                                destructive
                                                onConfirm={() =>
                                                    router.delete(
                                                        editor.reset_url,
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                <Button variant="outline">
                                                    <RotateCcw /> Reset edits
                                                </Button>
                                            </ConfirmDialog>
                                        )}
                                    <Button asChild variant="outline">
                                        <Link
                                            href={`/admin/projects/${project.id}/import`}
                                        >
                                            <Import /> Import / Update
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline">
                                        <a href={documentUrl} download>
                                            <Download /> Download DOCX
                                        </a>
                                    </Button>
                                    <Button
                                        disabled={loading || error !== null}
                                        onClick={printDocument}
                                    >
                                        <Printer /> Print
                                    </Button>
                                </>
                            )}
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardDescription>Project</CardDescription>
                            <CardTitle className="text-base leading-snug">
                                {project.project_name}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Duration</CardDescription>
                            <CardTitle>
                                {project.contract_duration} days
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Sections / Items</CardDescription>
                            <CardTitle>
                                {project.sections_count} / {project.items_count}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardDescription>Project total</CardDescription>
                            <CardTitle className="text-base">
                                {currency.format(project.total_cost)}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Alert className="print:hidden">
                    <FileText />
                    <AlertTitle>
                        {editing
                            ? 'Document editing is active'
                            : editor.has_saved_version
                              ? 'Saved editable Word document'
                              : 'Dynamic Word document'}
                    </AlertTitle>
                    <AlertDescription>
                        {editing ? (
                            <>
                                Click any highlighted paragraph or table cell to
                                edit its text. Save changes when finished. New
                                paragraphs and formatting changes are not
                                supported in this editor.
                            </>
                        ) : (
                            <>
                                The original 107-page DOCX supplies the page
                                design, headers, footers, images, and
                                formatting. Project identity, location,
                                duration, budget, and Bill of Quantities are
                                generated from this project.
                                {editor.has_saved_version &&
                                    editor.edited_at && (
                                        <span className="mt-1 block">
                                            Last edited by{' '}
                                            {editor.edited_by?.name ??
                                                'a system user'}{' '}
                                            on{' '}
                                            {new Intl.DateTimeFormat('en-PH', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            }).format(
                                                new Date(editor.edited_at),
                                            )}
                                            .
                                        </span>
                                    )}
                                {editor.has_saved_version && (
                                    <span className="mt-1 block">
                                        This saved version is used for preview
                                        and download. After importing newer
                                        project or BOQ data, use Reset edits to
                                        regenerate the document from that data.
                                    </span>
                                )}
                            </>
                        )}
                    </AlertDescription>
                </Alert>

                {saveError && (
                    <Alert variant="destructive" className="print:hidden">
                        <AlertTitle>Unable to save document</AlertTitle>
                        <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                )}

                {printError && (
                    <Alert variant="destructive" className="print:hidden">
                        <AlertTitle>Unable to open print preview</AlertTitle>
                        <AlertDescription>{printError}</AlertDescription>
                    </Alert>
                )}

                <Card className="bid-doc-print-shell overflow-hidden print:overflow-visible print:border-0 print:shadow-none">
                    <CardContent className="bid-doc-print-content p-0 print:overflow-visible">
                        {loading && (
                            <div className="flex min-h-80 items-center justify-center gap-3 text-muted-foreground print:hidden">
                                <Spinner /> Generating 107-page bid document…
                            </div>
                        )}
                        {error && (
                            <Alert
                                variant="destructive"
                                className="m-6 print:hidden"
                            >
                                <AlertTitle>
                                    Unable to display bid documents
                                </AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div ref={styleContainer} />
                        <div
                            id="bid-doc-renderer"
                            ref={documentContainer}
                            onInput={handleDocumentInput}
                            onKeyDown={handleDocumentKeyDown}
                            onPaste={handleDocumentPaste}
                            className={
                                loading || error
                                    ? 'hidden'
                                    : `bid-doc-renderer ${editing ? 'bid-doc-editor-active' : ''}`
                            }
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ProjectBidDocuments.layout = {
    breadcrumbs: [
        { title: 'Projects', href: '/admin/projects' },
        { title: 'Bid Documents', href: '#' },
    ],
};
