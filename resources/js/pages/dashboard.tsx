import { Head, usePage } from '@inertiajs/react';
import {
    Activity,
    ShieldCheck,
    UserCheck,
    UserRound,
    UserX,
} from 'lucide-react';
import PageHeader from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import type { Auth } from '@/types';

type DashboardProps = {
    auth: Auth;
    isSuperAdmin: boolean;
    stats: {
        totalUsers: number;
        activeUsers: number;
        inactiveUsers: number;
        superAdmins: number;
    } | null;
    recentUsers: Array<{
        id: number;
        name: string;
        email: string;
        is_active: boolean;
        is_super_admin: boolean;
        created_at: string;
    }>;
};

export default function Dashboard() {
    const { auth, isSuperAdmin, stats, recentUsers } =
        usePage<DashboardProps>().props;

    return (
        <>
            <Head title="Dashboard" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title={`Welcome back, ${auth.user?.name ?? 'there'}`}
                    description={
                        isSuperAdmin
                            ? 'System-wide account overview.'
                            : 'Your personal account dashboard.'
                    }
                />
                {isSuperAdmin && stats ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatCard
                                title="Total users"
                                value={stats.totalUsers}
                                icon={UserRound}
                            />
                            <StatCard
                                title="Active users"
                                value={stats.activeUsers}
                                icon={UserCheck}
                            />
                            <StatCard
                                title="Inactive users"
                                value={stats.inactiveUsers}
                                icon={UserX}
                            />
                            <StatCard
                                title="Super Admins"
                                value={stats.superAdmins}
                                icon={ShieldCheck}
                            />
                        </div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Recently created users</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {recentUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className="flex items-center justify-between border-b pb-3 last:border-0"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {user.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {user.email}
                                                </p>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(
                                                    user.created_at,
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card>
                        <CardContent className="flex items-center gap-3 pt-6">
                            <Activity className="size-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">
                                    Your account is active
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Use Profile to manage your personal
                                    information and security settings.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle>Current account</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                            <span className="text-muted-foreground">Name</span>
                            <p className="font-medium">{auth.user?.name}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Email</span>
                            <p className="font-medium">{auth.user?.email}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function StatCard({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: number;
    icon: typeof UserRound;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between pt-6">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="mt-1 text-3xl font-semibold">{value}</p>
                </div>
                <Icon className="size-8 text-muted-foreground" />
            </CardContent>
        </Card>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
