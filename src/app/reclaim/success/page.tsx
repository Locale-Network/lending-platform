import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-6 p-8 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Success!</h1>
          <p>You can now continue with your application.</p>
        </div>
      </Card>
    </div>
  );
}
