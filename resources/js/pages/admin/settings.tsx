import { Head } from '@inertiajs/react';
import { Settings } from 'lucide-react';
import PageHeader from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SystemSettings({
    settings,
}: {
    settings: { application: string; timezone: string; environment: string };
}) {
    return (
        <>
            <Head title="System settings" />
            <div className="space-y-6 p-4 md:p-6">
                <PageHeader
                    title="System settings"
                    description="Application configuration visible to Super Admins."
                />
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="size-5" />
                            Runtime
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
                        <div>
                            <p className="text-muted-foreground">Application</p>
                            <p className="font-medium">
                                {settings.application}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Timezone</p>
                            <p className="font-medium">{settings.timezone}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Environment</p>
                            <p className="font-medium">
                                {settings.environment}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
