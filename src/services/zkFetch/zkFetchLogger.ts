import 'server-only';

import prisma from '@prisma/index';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

/**
 * zkFetch Logging Service
 *
 * Provides structured logging and audit trail for all zkFetch operations.
 * Stores proofs in PostgreSQL for compliance, dispute resolution, and debugging.
 *
 * Features:
 * - Structured console logging with [zkFetch:LOG] prefix
 * - Persistent proof storage in database
 * - Operation audit trail (sync, verify, submit, relay)
 * - Error categorization and tracking
 */

// ============================================
// TYPES
// ============================================

export enum ZkFetchAction {
  SYNC = 'sync',
  VERIFY = 'verify',
  SUBMIT = 'submit',
  RELAY = 'relay',
}

export enum ZkFetchErrorCode {
  CLIENT_INIT_FAILED = 'ZKFETCH_CLIENT_INIT',
  PROOF_GENERATION_FAILED = 'ZKFETCH_PROOF_GEN',
  PROOF_VERIFICATION_FAILED = 'ZKFETCH_VERIFY',
  RESPONSE_PARSE_FAILED = 'ZKFETCH_PARSE',
  CARTESI_SUBMIT_FAILED = 'ZKFETCH_CARTESI',
  RELAY_FAILED = 'ZKFETCH_RELAY',
  DATABASE_ERROR = 'ZKFETCH_DB',
}

export interface ZkFetchLogEntry {
  loanId: string;
  borrowerAddress: string;
  action: ZkFetchAction;
  proofHash: string | null;
  proofIdentifier: string | null;
  success: boolean;
  durationMs?: number;
  metadata: {
    transactionCount?: number;
    dscrValue?: number;
    cartesiInputHash?: string;
    plaidEnv?: string;
    error?: string;
    errorCode?: ZkFetchErrorCode;
  };
}

export interface ZkFetchProofEntry {
  loanId: string;
  borrowerAddress: string;
  proofHash: string;
  proofIdentifier: string;
  proofData: Record<string, unknown>;
  provider?: string;
  signaturesCount?: number;
}

// ============================================
// CONSOLE LOGGING
// ============================================

/**
 * Log a zkFetch operation to console with structured format
 */
export function logToConsole(entry: ZkFetchLogEntry): void {
  const timestamp = new Date().toISOString();
  const status = entry.success ? 'SUCCESS' : 'FAILED';
  const duration = entry.durationMs ? `${entry.durationMs}ms` : 'N/A';

  const logData = {
    timestamp,
    status,
    action: entry.action,
    loanId: entry.loanId,
    borrower: entry.borrowerAddress?.slice(0, 10) + '...',
    proofHash: entry.proofHash?.slice(0, 16) + '...' || null,
    duration,
    ...entry.metadata,
  };

  if (entry.success) {
    console.log('[zkFetch:LOG]', JSON.stringify(logData));
  } else {
    console.error('[zkFetch:ERROR]', JSON.stringify(logData));
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Store a zkFetch proof in the database for audit trail
 */
export async function storeProof(entry: ZkFetchProofEntry): Promise<string | null> {
  try {
    const proof = await prisma.zkFetchProof.create({
      data: {
        loanId: entry.loanId,
        borrowerAddress: entry.borrowerAddress,
        proofHash: entry.proofHash,
        proofIdentifier: entry.proofIdentifier,
        proofData: entry.proofData as object,
        provider: entry.provider || 'http',
        signaturesCount: entry.signaturesCount || 0,
      },
    });

    console.log('[zkFetch:LOG] Proof stored:', {
      id: proof.id,
      proofHash: entry.proofHash.slice(0, 16) + '...',
    });

    return proof.id;
  } catch (error) {
    // Handle unique constraint violation (proof already exists)
    if ((error as { code?: string }).code === 'P2002') {
      console.log('[zkFetch:LOG] Proof already exists:', entry.proofHash.slice(0, 16) + '...');
      return null;
    }

    console.error('[zkFetch:ERROR] Failed to store proof:', error);
    throw error;
  }
}

/**
 * Store a zkFetch operation log entry
 */
export async function storeLog(entry: ZkFetchLogEntry): Promise<string> {
  try {
    const log = await prisma.zkFetchLog.create({
      data: {
        loanId: entry.loanId,
        borrowerAddress: entry.borrowerAddress,
        action: entry.action,
        proofHash: entry.proofHash,
        proofIdentifier: entry.proofIdentifier,
        success: entry.success,
        durationMs: entry.durationMs,
        transactionCount: entry.metadata.transactionCount,
        dscrValue: entry.metadata.dscrValue,
        cartesiInputHash: entry.metadata.cartesiInputHash,
        errorMessage: entry.metadata.error,
        errorCode: entry.metadata.errorCode,
      },
    });

    return log.id;
  } catch (error) {
    console.error('[zkFetch:ERROR] Failed to store log:', error);
    throw error;
  }
}

/**
 * Combined logging: console + database
 */
export async function logZkFetchOperation(
  entry: ZkFetchLogEntry,
  proof?: ZkFetchProofEntry
): Promise<{ logId: string; proofId: string | null }> {
  // Always log to console
  logToConsole(entry);

  // Store log entry
  const logId = await storeLog(entry);

  // Store proof if provided and successful
  let proofId: string | null = null;
  if (proof && entry.success) {
    proofId = await storeProof(proof);
  }

  return { logId, proofId };
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Get zkFetch logs for a specific loan
 */
export async function getLogsByLoan(loanId: string, limit = 50) {
  return prisma.zkFetchLog.findMany({
    where: { loanId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get zkFetch proofs for a specific loan
 */
export async function getProofsByLoan(loanId: string, limit = 50) {
  return prisma.zkFetchProof.findMany({
    where: { loanId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get all zkFetch logs with pagination
 */
export async function getAllLogs(options: {
  page?: number;
  limit?: number;
  action?: ZkFetchAction;
  success?: boolean;
  loanId?: string;
  borrowerAddress?: string;
} = {}) {
  const { page = 1, limit = 50, action, success, loanId, borrowerAddress } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.ZkFetchLogWhereInput = {};
  if (action) where.action = action;
  if (success !== undefined) where.success = success;
  if (loanId) where.loanId = loanId;
  if (borrowerAddress) where.borrowerAddress = borrowerAddress;

  const [logs, total] = await Promise.all([
    prisma.zkFetchLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        loan: {
          select: {
            businessLegalName: true,
            status: true,
          },
        },
      },
    }),
    prisma.zkFetchLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get all zkFetch proofs with pagination
 */
export async function getAllProofs(options: {
  page?: number;
  limit?: number;
  loanId?: string;
  borrowerAddress?: string;
  verified?: boolean;
} = {}) {
  const { page = 1, limit = 50, loanId, borrowerAddress, verified } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.ZkFetchProofWhereInput = {};
  if (loanId) where.loanId = loanId;
  if (borrowerAddress) where.borrowerAddress = borrowerAddress;
  if (verified !== undefined) {
    where.verifiedAt = verified ? { not: null } : null;
  }

  const [proofs, total] = await Promise.all([
    prisma.zkFetchProof.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        loan: {
          select: {
            businessLegalName: true,
            status: true,
          },
        },
      },
    }),
    prisma.zkFetchProof.count({ where }),
  ]);

  return {
    proofs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single proof by hash
 */
export async function getProofByHash(proofHash: string) {
  return prisma.zkFetchProof.findUnique({
    where: { proofHash },
    include: {
      loan: {
        select: {
          businessLegalName: true,
          status: true,
          accountAddress: true,
        },
      },
    },
  });
}

/**
 * Mark a proof as verified
 */
export async function markProofVerified(proofHash: string): Promise<void> {
  await prisma.zkFetchProof.update({
    where: { proofHash },
    data: { verifiedAt: new Date() },
  });
}

// ============================================
// SUMMARY STATISTICS
// ============================================

/**
 * Get summary statistics for zkFetch operations
 */
export async function getZkFetchStats() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLogs,
    totalProofs,
    successfulOps,
    failedOps,
    last24HoursLogs,
    last7DaysLogs,
    actionBreakdown,
    recentErrors,
  ] = await Promise.all([
    prisma.zkFetchLog.count(),
    prisma.zkFetchProof.count(),
    prisma.zkFetchLog.count({ where: { success: true } }),
    prisma.zkFetchLog.count({ where: { success: false } }),
    prisma.zkFetchLog.count({ where: { createdAt: { gte: last24Hours } } }),
    prisma.zkFetchLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.zkFetchLog.groupBy({
      by: ['action'],
      _count: { action: true },
    }),
    prisma.zkFetchLog.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
        loanId: true,
      },
    }),
  ]);

  const successRate = totalLogs > 0 ? (successfulOps / totalLogs) * 100 : 0;

  return {
    totalLogs,
    totalProofs,
    successfulOps,
    failedOps,
    successRate: Math.round(successRate * 100) / 100,
    last24Hours: last24HoursLogs,
    last7Days: last7DaysLogs,
    actionBreakdown: actionBreakdown.reduce(
      (acc, item) => {
        acc[item.action] = item._count.action;
        return acc;
      },
      {} as Record<string, number>
    ),
    recentErrors,
  };
}

// ============================================
// HELPER: Create operation timer
// ============================================

export function createOperationTimer() {
  const startTime = Date.now();
  return {
    elapsed: () => Date.now() - startTime,
  };
}

// ============================================
// HELPER: Generate context identifier
// ============================================

export function generateContextId(loanId: string): string {
  return `plaid_sync_${loanId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}
