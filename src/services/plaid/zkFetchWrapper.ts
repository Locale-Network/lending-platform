import 'server-only';

import { ReclaimClient } from '@reclaimprotocol/zk-fetch';
import { submitInput } from '@/services/cartesi';
import prisma from '@prisma/index';
import crypto from 'crypto';

/**
 * zkFetch Wrapper for Plaid Transaction Sync
 *
 * This service wraps Plaid API calls with Reclaim Protocol's zkFetch SDK
 * to generate ZK proofs of the API responses. These proofs can then be
 * verified by Cartesi to ensure data authenticity.
 *
 * Architecture:
 * 1. zkFetch wraps the Plaid /transactions/sync API call
 * 2. zkFetch generates a ZK proof of the HTTP response
 * 3. The proof is submitted to Cartesi along with the transaction data
 * 4. Cartesi verifies the proof and calculates DSCR
 * 5. Cartesi emits a NOTICE with the verified result
 * 6. Relay service calls SimpleLoanPool.handleNotice()
 *
 * See: loan-pool/memory-bank/ZKFETCH_ARCHITECTURE.md
 */

// Initialize Reclaim client (lazy initialization)
let reclaimClient: ReclaimClient | null = null;

/**
 * Decode HTTP chunked transfer encoding from a response body
 *
 * Chunked encoding format:
 * <chunk-size-hex>\r\n<chunk-data>\r\n<chunk-size-hex>\r\n<chunk-data>...\r\n0\r\n\r\n
 *
 * Example: "store_num\r\n2000\r\nber" becomes "store_number"
 * where "2000" (hex) is the chunk size marker that needs to be removed
 */
function decodeChunkedResponse(data: string): string {
  // Pattern matches: \r\n followed by hex digits followed by \r\n
  // This is the chunk boundary marker that appears mid-content
  // The hex number is the size of the next chunk in bytes
  let decoded = data.replace(/\r\n[0-9a-fA-F]+\r\n/g, '');

  // Also remove chunk markers at the very start (without leading \r\n)
  decoded = decoded.replace(/^[0-9a-fA-F]+\r\n/, '');

  // Remove the final chunk terminator (0\r\n\r\n)
  decoded = decoded.replace(/\r\n0\r\n\r\n$/, '');

  // Clean up any remaining \r characters that might cause issues
  // JSON allows \n but \r can cause problems in some parsers
  decoded = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '');

  return decoded;
}

function getReclaimClient(): ReclaimClient {
  if (!reclaimClient) {
    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('RECLAIM_APP_ID and RECLAIM_APP_SECRET must be set');
    }

    reclaimClient = new ReclaimClient(appId, appSecret);
  }
  return reclaimClient;
}

export interface ZkFetchTransactionResult {
  success: boolean;
  transactions: PlaidTransaction[];
  zkProof: ZkFetchProof | null;
  proofHash: string | null;
  error?: string;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  iso_currency_code?: string;
  category?: string[];
  personal_finance_category?: {
    primary: string;
    detailed: string;
  };
}

export interface ZkFetchProof {
  claimData: {
    provider: string;
    parameters: string;
    context: string;
  };
  signatures: string[];
  witnesses: Array<{
    id: string;
    url: string;
  }>;
  extractedParameterValues: Record<string, string>;
  identifier: string;
}

export interface PlaidTransactionSyncResponse {
  // Plaid /transactions/sync response fields
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
  // Additional fields that may be present
  accounts?: Array<{
    account_id: string;
    balances: {
      available: number | null;
      current: number | null;
      iso_currency_code: string | null;
    };
    name: string;
    type: string;
  }>;
  request_id?: string;
  transactions_update_status?: string;
}

/**
 * Sync transactions from Plaid with zkFetch proof
 *
 * This function wraps the Plaid /transactions/sync API call with zkFetch
 * to generate a ZK proof of the response. The proof can be verified by
 * Cartesi to ensure the transaction data is authentic.
 *
 * @param accessToken - Plaid access token for the user's bank connection
 * @param cursor - Optional cursor for pagination
 * @returns Transaction data with zkFetch proof
 */
export async function syncTransactionsWithZkFetch(
  accessToken: string,
  cursor?: string
): Promise<ZkFetchTransactionResult> {
  try {
    const client = getReclaimClient();

    // Build the request body
    const requestBody: Record<string, string> = {
      client_id: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      access_token: accessToken,
    };

    if (cursor) {
      requestBody.cursor = cursor;
    }

    // Determine Plaid environment
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    const plaidBaseUrl =
      plaidEnv === 'production'
        ? 'https://production.plaid.com'
        : plaidEnv === 'development'
          ? 'https://development.plaid.com'
          : 'https://sandbox.plaid.com';

    // Use zkFetch to call Plaid API with proof generation
    // Note: body goes in the first options object, secret headers go in the second
    // responseMatches with named capture group is required to extract data into extractedParameterValues
    const proof = await client.zkFetch(
      `${plaidBaseUrl}/transactions/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      {
        // These are redacted from the proof but included in the request
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
          'PLAID-SECRET': process.env.PLAID_SECRET!,
        },
        // responseMatches with named capture groups extracts data into extractedParameterValues
        // This regex captures the entire JSON response body as 'data'
        responseMatches: [
          {
            type: 'regex',
            // Capture the entire response as 'data' - matches the full JSON object
            value: '(?<data>\\{.*\\})',
          },
        ],
      }
    );

    // Check if proof was generated
    if (!proof) {
      return {
        success: false,
        transactions: [],
        zkProof: null,
        proofHash: null,
        error: 'Failed to generate ZK proof',
      };
    }

    // Log the full proof structure for debugging
    console.log('[zkFetch] Proof received:', {
      hasExtractedParams: !!proof.extractedParameterValues,
      extractedKeys: proof.extractedParameterValues ? Object.keys(proof.extractedParameterValues) : [],
      dataPreview: proof.extractedParameterValues?.data?.substring(0, 300) || 'no data field',
      hasClaimData: !!proof.claimData,
      identifier: proof.identifier?.substring(0, 32) || 'no identifier',
      signaturesCount: proof.signatures?.length || 0,
    });

    // Parse the response data from the proof
    // The 'data' field contains our captured response from the responseMatches regex
    const rawData = proof.extractedParameterValues?.data;

    if (!rawData) {
      // Log all available keys to help debug
      console.error('[zkFetch] No data field in extractedParameterValues:', {
        availableKeys: proof.extractedParameterValues ? Object.keys(proof.extractedParameterValues) : [],
        fullExtracted: JSON.stringify(proof.extractedParameterValues || {}).substring(0, 500),
        claimDataContext: proof.claimData?.context?.substring(0, 500) || 'no context',
      });
      return {
        success: false,
        transactions: [],
        zkProof: null,
        proofHash: null,
        error: 'No data field in zkFetch response. Check responseMatches configuration.',
      };
    }

    let responseData: PlaidTransactionSyncResponse;
    try {
      // Decode HTTP chunked transfer encoding
      // Format: <chunk-size-hex>\r\n<chunk-data>\r\n<chunk-size-hex>\r\n<chunk-data>...\r\n0\r\n\r\n
      // The chunk markers appear as: \r\n<hex>\r\n which splits the content mid-stream
      const cleanedData = decodeChunkedResponse(rawData);

      responseData = JSON.parse(cleanedData);
    } catch (parseError) {
      // Log context around the error position
      const errorMatch = parseError instanceof Error && parseError.message.match(/position (\d+)/);
      if (errorMatch) {
        const pos = parseInt(errorMatch[1], 10);
        const contextStart = Math.max(0, pos - 50);
        const contextEnd = Math.min(rawData.length, pos + 50);
        console.error('[zkFetch] Error context around position', pos, ':', {
          before: rawData.substring(contextStart, pos),
          charAtPos: rawData[pos],
          charCode: rawData.charCodeAt(pos),
          after: rawData.substring(pos + 1, contextEnd),
        });
      }
      console.error('[zkFetch] Failed to parse response data:', {
        rawDataLength: rawData.length,
        rawDataPreview: rawData.substring(0, 500),
        rawDataEnd: rawData.substring(Math.max(0, rawData.length - 200)),
        error: parseError,
      });
      return {
        success: false,
        transactions: [],
        zkProof: null,
        proofHash: null,
        error: `Failed to parse zkFetch response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
      };
    }

    // Log parsed response structure
    console.log('[zkFetch] Parsed response:', {
      hasAdded: !!responseData.added,
      addedCount: responseData.added?.length || 0,
      hasModified: !!responseData.modified,
      modifiedCount: responseData.modified?.length || 0,
      hasRemoved: !!responseData.removed,
      removedCount: responseData.removed?.length || 0,
      hasAccounts: !!responseData.accounts,
      accountsCount: responseData.accounts?.length || 0,
      nextCursor: responseData.next_cursor ? 'present' : 'missing',
      hasMore: responseData.has_more,
      requestId: responseData.request_id,
      updateStatus: responseData.transactions_update_status,
    });

    // Generate a hash of the proof for storage/verification
    const proofHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(proof))
      .digest('hex');

    // Handle case where added might be missing
    const transactions = responseData.added || [];

    return {
      success: true,
      transactions,
      zkProof: proof as unknown as ZkFetchProof,
      proofHash,
    };
  } catch (error) {
    console.error('[zkFetch] Error syncing transactions:', error);
    return {
      success: false,
      transactions: [],
      zkProof: null,
      proofHash: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Full transaction sync with zkFetch proof and Cartesi submission
 *
 * This function:
 * 1. Fetches transactions from Plaid using zkFetch
 * 2. Stores raw transactions in PostgreSQL (Supabase)
 * 3. Submits the zkFetch proof to Cartesi for DSCR calculation
 *
 * @param params - Sync parameters
 * @returns Sync result with proof details
 */
export async function syncAndSubmitToCartesi(params: {
  loanId: string;
  accessToken: string;
  borrowerAddress: string;
  cursor?: string;
  monthlyDebtService: number;
  loanAmount?: bigint; // Requested loan amount for Cartesi loan creation
}): Promise<{
  success: boolean;
  transactionsAdded: number;
  zkProofHash: string | null;
  cartesiInputHash: string | null;
  newCursor: string | null;
  error?: string;
}> {
  const { loanId, accessToken, borrowerAddress, cursor, monthlyDebtService, loanAmount } = params;

  try {
    // Step 1: Fetch transactions with zkFetch proof
    const zkResult = await syncTransactionsWithZkFetch(accessToken, cursor);

    if (!zkResult.success) {
      return {
        success: false,
        transactionsAdded: 0,
        zkProofHash: null,
        cartesiInputHash: null,
        newCursor: null,
        error: zkResult.error,
      };
    }

    // Step 2: Store transactions in PostgreSQL
    if (zkResult.transactions.length > 0) {
      const transactionData = zkResult.transactions.map(tx => ({
        loanApplicationId: loanId,
        transactionId: tx.transaction_id,
        accountId: tx.account_id,
        amount: tx.amount,
        currency: tx.iso_currency_code || 'USD',
        merchant: tx.merchant_name || tx.name,
        date: new Date(tx.date),
        isDeleted: false,
      }));

      await prisma.transaction.createMany({
        data: transactionData,
        skipDuplicates: true,
      });
    }

    // Step 3: Calculate DSCR data for Cartesi submission
    // Fetch all transactions for this loan to calculate accurate DSCR
    const allTransactions = await prisma.transaction.findMany({
      where: {
        loanApplicationId: loanId,
        isDeleted: false,
      },
      orderBy: { date: 'asc' },
    });

    // Calculate monthly income and expenses
    // In Plaid: negative amounts = income, positive = expenses
    const totalIncome = allTransactions
      .filter(tx => (tx.amount || 0) < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

    const totalExpenses = allTransactions
      .filter(tx => (tx.amount || 0) > 0)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Calculate months in window
    const dates = allTransactions.map(tx => tx.date).filter(Boolean) as Date[];
    const monthCount = dates.length > 0
      ? Math.max(
          1,
          Math.ceil(
            (Math.max(...dates.map(d => d.getTime())) -
              Math.min(...dates.map(d => d.getTime()))) /
              (30 * 24 * 60 * 60 * 1000)
          )
        )
      : 1;

    const monthlyNoi = (totalIncome - totalExpenses) / monthCount;
    const dscrValue = monthlyDebtService > 0 ? monthlyNoi / monthlyDebtService : 0;

    // Step 4: Create loan in Cartesi first (required before DSCR verification)
    // The create_loan handler auto-creates borrower if needed
    if (loanAmount && loanAmount > 0n) {
      const createLoanInput = {
        action: 'create_loan',
        loan_id: loanId,
        borrower_address: borrowerAddress,
        amount: loanAmount.toString(),
        term_months: 24, // Default term
      };

      try {
        await submitInput(createLoanInput);
        console.log(`[zkFetch] Created loan in Cartesi: loanId=${loanId}, amount=${loanAmount}`);
      } catch (createLoanError) {
        // Log but don't fail - loan might already exist in Cartesi
        console.warn(
          `[zkFetch] Create loan warning (may already exist): ${createLoanError instanceof Error ? createLoanError.message : 'Unknown error'}`
        );
      }
    }

    // Step 5: Submit DSCR verification to Cartesi with zkFetch proof
    const cartesiInput = {
      action: 'verify_dscr_zkfetch',
      loanId,
      borrowerAddress,
      data: {
        transactionCount: allTransactions.length,
        monthlyNoi: Math.round(monthlyNoi * 100), // Scale by 100 for precision
        monthlyDebtService: Math.round(monthlyDebtService * 100),
        dscrValue: Math.round(dscrValue * 10000), // Scale by 10000 for 4 decimal places
        zkFetchProofHash: zkResult.proofHash,
        calculatedAt: Math.floor(Date.now() / 1000),
      },
      zkProof: zkResult.zkProof
        ? {
            identifier: zkResult.zkProof.identifier,
            claimData: zkResult.zkProof.claimData,
            signatures: zkResult.zkProof.signatures,
          }
        : null,
    };

    const cartesiInputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(cartesiInput))
      .digest('hex');

    await submitInput(cartesiInput);

    console.log(
      `[zkFetch] Submitted to Cartesi: loanId=${loanId}, DSCR=${dscrValue.toFixed(4)}, ` +
        `proofHash=${zkResult.proofHash?.slice(0, 16)}...`
    );

    // Step 6: Update loan sync metadata
    // Note: We don't have next_cursor from zkFetch response parsing yet
    // This would need to be extracted from the full response
    await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        lastSyncedAt: new Date(),
      },
    });

    return {
      success: true,
      transactionsAdded: zkResult.transactions.length,
      zkProofHash: zkResult.proofHash,
      cartesiInputHash,
      newCursor: null, // Would need to parse from zkFetch response
    };
  } catch (error) {
    console.error('[zkFetch] Error in syncAndSubmitToCartesi:', error);
    return {
      success: false,
      transactionsAdded: 0,
      zkProofHash: null,
      cartesiInputHash: null,
      newCursor: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if zkFetch is properly configured
 */
export function isZkFetchConfigured(): boolean {
  return !!(process.env.RECLAIM_APP_ID && process.env.RECLAIM_APP_SECRET);
}

/**
 * Get zkFetch configuration status for debugging
 */
export function getZkFetchStatus(): {
  configured: boolean;
  appIdSet: boolean;
  appSecretSet: boolean;
  plaidEnv: string;
} {
  return {
    configured: isZkFetchConfigured(),
    appIdSet: !!process.env.RECLAIM_APP_ID,
    appSecretSet: !!process.env.RECLAIM_APP_SECRET,
    plaidEnv: process.env.PLAID_ENV || 'sandbox',
  };
}
