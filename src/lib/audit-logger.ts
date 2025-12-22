/**
 * Audit Logger for Sensitive Data Access
 *
 * Logs access to sensitive data for compliance and security monitoring.
 * Supports both database logging and structured console output for external log aggregation.
 *
 * Usage:
 *   await auditLog.sensitiveDataAccess({
 *     action: 'DECRYPT_ACCESS_TOKEN',
 *     userId: 'user-123',
 *     resourceType: 'PlaidAccessToken',
 *     resourceId: 'token-456',
 *     outcome: 'success',
 *   });
 */

import { logger } from './logger';
import prisma from '../../prisma';

export type AuditAction =
  | 'DECRYPT_ACCESS_TOKEN'
  | 'ENCRYPT_ACCESS_TOKEN'
  | 'ACCESS_LOAN_APPLICATION'
  | 'ACCESS_BANK_TRANSACTIONS'
  | 'ACCESS_CREDIT_SCORE'
  | 'ACCESS_KYC_DATA'
  | 'ADMIN_VIEW_INVESTOR_DATA'
  | 'ADMIN_VIEW_BORROWER_DATA'
  | 'ROLE_CHANGE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'API_KEY_ACCESS';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEvent {
  action: AuditAction;
  userId?: string; // Wallet address or internal user ID
  userRole?: string;
  resourceType?: string;
  resourceId?: string;
  outcome: AuditOutcome;
  reason?: string; // Why access was denied or failed
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLogEntry {
  timestamp: string;
  action: AuditAction;
  outcome: AuditOutcome;
  userId?: string;
  userRole?: string;
  resourceType?: string;
  resourceId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logger instance for sensitive data access tracking
 */
class AuditLogger {
  private enabled: boolean;

  constructor() {
    // Enable audit logging by default, can be disabled for tests
    this.enabled = process.env.DISABLE_AUDIT_LOG !== 'true';
  }

  /**
   * Log access to sensitive data
   */
  async sensitiveDataAccess(event: AuditEvent): Promise<void> {
    if (!this.enabled) return;

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action: event.action,
      outcome: event.outcome,
      userId: event.userId,
      userRole: event.userRole,
      resourceType: event.resourceType,
      resourceId: this.maskResourceId(event.resourceId),
      reason: event.reason,
      ipAddress: this.maskIpAddress(event.ipAddress),
      userAgent: event.userAgent,
      metadata: event.metadata,
    };

    // Log to structured logger (for external aggregation)
    if (event.outcome === 'denied' || event.outcome === 'failure') {
      logger.warn({ audit: true, ...logEntry }, 'Sensitive data access');
    } else {
      logger.info({ audit: true, ...logEntry }, 'Sensitive data access');
    }
  }

  /**
   * Log authentication events
   */
  async authEvent(event: AuditEvent): Promise<void> {
    if (!this.enabled) return;

    const logEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action: event.action,
      outcome: event.outcome,
      userId: event.userId,
      ipAddress: this.maskIpAddress(event.ipAddress),
      userAgent: event.userAgent,
      reason: event.reason,
      metadata: event.metadata,
    };

    if (event.outcome === 'failure' || event.action === 'LOGIN_FAILURE') {
      logger.warn({ audit: true, security: true, ...logEntry }, 'Authentication event');
    } else {
      logger.info({ audit: true, ...logEntry }, 'Authentication event');
    }
  }

  /**
   * Log role/permission changes
   */
  async roleChange(event: AuditEvent): Promise<void> {
    if (!this.enabled) return;

    logger.info(
      {
        audit: true,
        security: true,
        timestamp: new Date().toISOString(),
        action: event.action,
        outcome: event.outcome,
        userId: event.userId,
        metadata: event.metadata,
      },
      'Role change'
    );
  }

  /**
   * Mask resource IDs for privacy (show first/last 4 chars)
   */
  private maskResourceId(id?: string): string | undefined {
    if (!id) return undefined;
    if (id.length <= 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  /**
   * Mask IP addresses for privacy (show first octets only)
   */
  private maskIpAddress(ip?: string): string | undefined {
    if (!ip) return undefined;

    // IPv4: show first two octets
    if (ip.includes('.')) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }

    // IPv6: show first 4 groups
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return `${parts.slice(0, 4).join(':')}::xxxx`;
    }

    return ip;
  }
}

// Singleton instance
export const auditLog = new AuditLogger();

/**
 * Helper to create audit context from request
 */
export function getAuditContext(
  request: Request
): Pick<AuditEvent, 'ipAddress' | 'userAgent'> {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}
