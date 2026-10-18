import { useLayoutEffect, useRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export default function AutoRowTextarea({
    value,
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'textarea'>, 'rows'>) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const resize = () => {
            element.style.height = 'auto';
            element.style.height = `${element.scrollHeight}px`;
        };
        resize();
        let width = element.getBoundingClientRect().width;
        const observer = new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width;

            if (nextWidth !== width) {
                width = nextWidth;
                resize();
            }
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, [value]);

    return (
        <textarea
            {...props}
            ref={ref}
            rows={1}
            value={value}
            className={cn(
                className,
                'block min-h-7 resize-none overflow-hidden leading-5',
            )}
        />
    );
}
