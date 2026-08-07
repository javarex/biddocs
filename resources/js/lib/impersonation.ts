import { router } from '@inertiajs/react';

function clearIdentityScopedNavigationState() {
    router.cancelAll({ async: true, prefetch: true, sync: false });
    router.flushAll();
}

function postIdentityTransition(url: string) {
    clearIdentityScopedNavigationState();

    router.post(
        url,
        {},
        {
            preserveState: false,
            onSuccess: () => router.flushAll(),
        },
    );
}

export function impersonateUser(userId: number) {
    postIdentityTransition(`/admin/users/${userId}/impersonate`);
}

export function leaveImpersonation() {
    postIdentityTransition('/impersonation/leave');
}
