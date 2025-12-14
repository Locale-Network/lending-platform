import Search from '@/components/custom/url-search';
import { Suspense } from 'react';
import Table from '@/components/custom/data-table';
import { columns } from './columns';
import ApplyLoanButton from './apply-loans';
import { getLoanApplications } from './actions';
import { getSession } from '@/lib/auth/authorization';

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
    return <div>You must be logged in to view this page</div>;
  }

  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  const { loanApplications, isError, errorMessage } = await getLoanApplications(accountAddress);

  if (isError || !loanApplications) {
    return <div>{errorMessage}</div>;
  }

  return (
    <>
      <div className="mb-4 flex w-full flex-col items-start justify-center space-y-4">
        <div className="flex w-full items-center justify-between gap-2">
          <Search />
          <ApplyLoanButton />
        </div>
      </div>
      <Suspense key={query + currentPage}>
        <Table
          rows={loanApplications}
          columns={columns}
          total={loanApplications.length}
          totalPages={Math.ceil(loanApplications.length / 10)}
        />
      </Suspense>
    </>
  );
}
