import { Link, router } from '@inertiajs/react';
import {
    ChevronDown,
    Eye,
    FileSpreadsheet,
    FileText,
    Import,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Project = {
    id: number;
    project_name: string;
    can_edit: boolean;
    can_delete: boolean;
};
export default function ProjectActions({
    project,
    canViewDupa,
}: {
    project: Project;
    canViewDupa: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Actions for ${project.project_name}`}
                >
                    Actions <ChevronDown />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                    <Link href={`/admin/projects/${project.id}`}>
                        <Eye /> View project
                    </Link>
                </DropdownMenuItem>
                {canViewDupa && (
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/projects/${project.id}/dupa`}>
                            <FileSpreadsheet /> DUPA
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <Link href={`/admin/projects/${project.id}/bid-docs`}>
                        <FileText /> View Bid Docs
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={`/admin/projects/${project.id}/import`}>
                        <Import /> Import / Update
                    </Link>
                </DropdownMenuItem>
                {project.can_delete && (
                    <>
                        <DropdownMenuSeparator />
                        <ConfirmDialog
                            title="Delete project?"
                            description="This permanently deletes the project, hierarchy, estimates, and saved bid document."
                            confirmLabel="Delete"
                            destructive
                            onConfirm={() => {
                                setOpen(false);
                                router.delete(`/admin/projects/${project.id}`);
                            }}
                        >
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={(event) => event.preventDefault()}
                            >
                                <Trash2 /> Delete project
                            </DropdownMenuItem>
                        </ConfirmDialog>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
