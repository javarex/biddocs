import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label = 'Platform',
}: {
    items: NavItem[];
    label?: string | null;
}) {
    const { isCurrentUrl } = useCurrentUrl();
    const { state, isMobile } = useSidebar();
    const [open, setOpen] = useState(true);
    const iconOnly = state === 'collapsed' && !isMobile;

    const menu = (
        <SidebarMenu>
            {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                        asChild
                        isActive={isCurrentUrl(item.href)}
                        tooltip={{ children: item.title }}
                    >
                        <Link href={item.href} prefetch>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );

    if (label === null) {
        return <SidebarGroup className="px-2 py-0">{menu}</SidebarGroup>;
    }

    return (
        <Collapsible open={iconOnly || open} onOpenChange={setOpen} asChild>
            <SidebarGroup className="px-2 py-0">
                <SidebarGroupLabel asChild>
                    <CollapsibleTrigger
                        className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        aria-label={`Toggle ${label} navigation`}
                        disabled={iconOnly}
                    >
                        <span>{label}</span>
                        <ChevronDown
                            className={`ml-auto transition-transform ${open ? '' : '-rotate-90'}`}
                            aria-hidden="true"
                        />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>{menu}</CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}
