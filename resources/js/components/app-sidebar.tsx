import { Link } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import {
    LayoutGrid,
    Settings,
    Shield,
    Users,
    Upload,
    FolderKanban,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { Auth, NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

const visibleNavItems = (items: Array<NavItem | null>): NavItem[] =>
    items.filter((item): item is NavItem => item !== null);

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const can = (permission: string): boolean =>
        auth.user?.is_super_admin === true ||
        auth.permissions.includes(permission);
    const administrationItems = visibleNavItems([
        can('users.view')
            ? { title: 'Users', href: '/admin/users', icon: Users }
            : null,
        can('roles.view')
            ? {
                  title: 'Roles & Permissions',
                  href: '/admin/roles',
                  icon: Shield,
              }
            : null,
        can('settings.view')
            ? {
                  title: 'System Settings',
                  href: '/admin/settings',
                  icon: Settings,
              }
            : null,
    ]);
    const procurementItems = visibleNavItems([
        can('imports.view')
            ? { title: 'Excel Imports', href: '/admin/imports', icon: Upload }
            : null,
        can('projects.view')
            ? {
                  title: 'Projects',
                  href: '/admin/projects',
                  icon: FolderKanban,
              }
            : null,
    ]);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} label="Workspace" />
                {administrationItems.length > 0 && (
                    <NavMain
                        items={administrationItems}
                        label="Administration"
                    />
                )}
                {procurementItems.length > 0 && (
                    <NavMain items={procurementItems} label="Procurement" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
