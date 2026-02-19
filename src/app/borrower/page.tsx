import { Suspense } from 'react';
import Search from '@/components/custom/url-search';
import { getLoanApplications } from './loans/actions';
import { getSession } from '@/lib/auth/authorization';
import ApplyLoanCard from './apply-loan-card';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { LoansTableWithActions } from './loans/loans-table-with-actions';

export default async function Page(
  props: {
    searchParams?: Promise<{
      query?: string;
      page?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  const accountAddress = session?.address;

  if (!accountAddress) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You must be logged in to view this page</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  const { loanApplications, isError, errorMessage } = await getLoanApplications(accountAddress);

  if (isError) {
    return (
      <div className="container mx-auto p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{errorMessage || 'Failed to load loan applications'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Loans Section - Now includes drafts with DRAFT status */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Your Loan Applications</h2>
        </div>

        <div className="mb-4 flex w-full flex-col items-start justify-center space-y-4">
          <div className="flex w-full items-center justify-between gap-2">
            <Search />
          </div>
        </div>

        <Suspense key={query + currentPage + (loanApplications?.map(l => l.id).join(',') || '')}>
          <LoansTableWithActions
            loans={loanApplications || []}
            totalPages={Math.ceil((loanApplications?.length || 0) / 10)}
          />
        </Suspense>
      </section>

      {/* Action Cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="max-w-md">
          <ApplyLoanCard />
        </div>
      </section>
    </div>
  );
}
