import Search from '@/components/custom/url-search';
import { Suspense } from 'react';
import Table from '@/components/custom/data-table';
import { columns } from './columns';
import { getSubmittedLoanApplications } from './actions';
import { getSession } from '@/lib/auth/authorization';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';
import {
  getLoanPoolRemaining,
  getLoanPoolTotalLentAmount,
} from '@/services/contracts/simpleLoanPool';

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  const accountAddress = session?.address;

  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  const { loanApplications, isError, errorMessage } = await getSubmittedLoanApplications(
    accountAddress!
  );

  if (isError || !loanApplications) {
    return <div>{errorMessage}</div>;
  }

  const symbol = await getTokenSymbol();
  const tokenDecimals = await getTokenDecimals();

  const loanPoolRemaining = await getLoanPoolRemaining();
  const loanPoolTotalLentAmount = await getLoanPoolTotalLentAmount();

  const loanPoolSize = Number(loanPoolRemaining) + Number(loanPoolTotalLentAmount);

  return (
    <>
      <div className="mb-4 flex w-full flex-col items-start justify-center space-y-4">
        <h1 className="text-2xl font-bold">Loan Pool</h1>
        <h2 className="text-xl font-bold">Size</h2>
        <p>
          {(loanPoolSize / 10 ** tokenDecimals).toFixed(2)} {symbol}
        </p>
        <h2 className="text-xl font-bold">Lent Amount</h2>
        <p>
          {(Number(loanPoolTotalLentAmount) / 10 ** tokenDecimals).toFixed(2)} {symbol}
        </p>
        <h2 className="text-xl font-bold">Remaining</h2>
        <p>
          {(Number(loanPoolRemaining) / 10 ** tokenDecimals).toFixed(2)} {symbol}
        </p>
      </div>
      <div className="mb-4 flex w-full flex-col items-start justify-center space-y-4">
        <div className="flex w-full items-center justify-between gap-2">
          <Search />
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
