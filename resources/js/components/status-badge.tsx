import { Badge } from '@/components/ui/badge';

export function StatusBadge({ active }: { active: boolean }) {
    return (
        <Badge variant={active ? 'default' : 'secondary'}>
            {active ? 'Active' : 'Inactive'}
        </Badge>
    );
}

export function SuperAdminBadge({ value }: { value: boolean }) {
    return (
        <Badge variant={value ? 'default' : 'outline'}>
            {value ? 'Super Admin' : 'Standard'}
        </Badge>
    );
}
