import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageHeader({
    title,
    description,
    action,
    backHref,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
    backHref?: string;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                {backHref && (
                    <Button asChild variant="ghost" size="icon">
                        <Link href={backHref} aria-label="Back">
                            <ArrowLeft />
                        </Link>
                    </Button>
                )}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {action}
        </div>
    );
}
