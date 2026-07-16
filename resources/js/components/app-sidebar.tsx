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
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const administrationItems: NavItem[] = auth.user?.is_super_admin
        ? [
              { title: 'Users', href: '/admin/users', icon: Users },
              {
                  title: 'Roles & Permissions',
                  href: '/admin/roles',
                  icon: Shield,
              },
              {
                  title: 'System Settings',
                  href: '/admin/settings',
                  icon: Settings,
              },
          ]
        : [];
    const procurementItems: NavItem[] = auth.user?.is_super_admin
        ? [
              { title: 'Excel Imports', href: '/admin/imports', icon: Upload },
              {
                  title: 'Projects',
                  href: '/admin/projects',
                  icon: FolderKanban,
              },
          ]
        : [];

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
