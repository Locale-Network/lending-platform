import { updateLoanInterestRate } from '@/services/contracts/simpleLoanPool';
import { checkNotice, getLastProcessedIndex, markNoticeProcessed } from '@/services/db/notices';
import { NextResponse } from 'next/server';

import { NextRequest } from 'next/server';

export interface NoticePayload {
  loanId: string;
  interestRate: number;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lastProcessedIndex = await getLastProcessedIndex();

  try {
    const cursor = Buffer.from(lastProcessedIndex.toString()).toString('base64');
    let query = JSON.stringify({
      query: `{
        notices(first: 2${cursor ? `, after: "${cursor}"` : ''}) {
          edges {
            node {
              index
              input {
                index
              }
              payload
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
    });
    if (lastProcessedIndex < 0) {
      query = JSON.stringify({
        query: `{
          notices(first: 2) {
            edges {
              node {
                index
                input {
                  index
                }
                payload
              }
            }
          }
        }`,
      });
    }

    const response = await fetch(`${process.env.CARTESI_GRAPHQL_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
    });

    if (!response.ok) {
      console.error('Failed to fetch notices', response);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const result = await response.json();

    for (const edge of result.data.notices?.edges || []) {
      const noticeId = edge.node.input.index;

      if (await checkNotice(noticeId)) {
        continue;
      }

      const payload = edge.node.payload;

      const decodedString = Buffer.from(payload.slice(2), 'hex').toString('utf8');

      const decodedPayload: NoticePayload = JSON.parse(decodedString);

      const updated = await updateLoanInterestRate(
        decodedPayload.loanId,
        BigInt(Math.floor(decodedPayload.interestRate))
      );

      if (!updated) {
        console.error('Failed to update loan interest rate');
        continue;
      }

      await markNoticeProcessed(noticeId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ success: false }, { status: 500 });
}
