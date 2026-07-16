import { Head, Link } from '@inertiajs/react';
import { renderAsync } from 'docx-preview';
import { Download, FileText, Import, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
};

const currency = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

export default function ProjectBidDocuments({ project, documentUrl }: Props) {
    const documentContainer = useRef<HTMLDivElement>(null);
    const styleContainer = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [printError, setPrintError] = useState<string | null>(null);

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
                    <AlertTitle>Dynamic Word document</AlertTitle>
                    <AlertDescription>
                        The original 107-page DOCX supplies the page design,
                        static text, headers, footers, images, and formatting.
                        Project identity, location, duration, budget, and Bill
                        of Quantities are generated from this project.
                    </AlertDescription>
                </Alert>

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
                            className={
                                loading || error ? 'hidden' : 'bid-doc-renderer'
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
