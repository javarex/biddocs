import { usePage } from '@inertiajs/react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leaveImpersonation } from '@/lib/impersonation';
import type { Impersonation } from '@/types';

export default function ImpersonationBanner() {
    const { impersonation } = usePage<{ impersonation: Impersonation }>().props;

    if (!impersonation.active) {
        return null;
    }

    return (
        <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 shrink-0" />
                <span>
                    You are impersonating another user. Original account:{' '}
                    <strong>{impersonation.originalUser?.email}</strong>
                </span>
            </div>
            <Button size="sm" variant="outline" onClick={leaveImpersonation}>
                Leave impersonation
            </Button>
        </div>
    );
}
