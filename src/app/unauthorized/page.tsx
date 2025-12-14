import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-destructive" />

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
          Access Denied
        </h1>

        <p className="mt-4 text-muted-foreground">
          You don't have permission to access this page. Please contact an administrator
          if you believe this is an error.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">Go to Home</Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href="/signin">Sign In</Link>
          </Button>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Need access?</strong> Your wallet may need to be assigned the appropriate
            role by an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
