import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';

export function ThemeToggle() {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const nextAppearance = resolvedAppearance === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${nextAppearance} mode`;

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={label}
            title={label}
            onClick={() => updateAppearance(nextAppearance)}
        >
            {resolvedAppearance === 'dark' ? <Sun /> : <Moon />}
        </Button>
    );
}
