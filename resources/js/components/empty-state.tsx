import { Inbox } from 'lucide-react';

export default function EmptyState({
    message = 'No records found.',
}: {
    message?: string;
}) {
    return (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Inbox className="size-8" />
            <p>{message}</p>
        </div>
    );
}
