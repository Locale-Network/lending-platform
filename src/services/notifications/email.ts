import 'server-only';

import prisma from '@prisma/index';
import { EmailNotificationType, EmailStatus } from '@prisma/client';

/**
 * Email Notification Service
 *
 * Foundation for email notifications. This service:
 * 1. Queues emails to the database (EmailNotification table)
 * 2. Checks user preferences before queuing
 * 3. Provides templates for different notification types
 *
 * IMPORTANT: Actual email sending is NOT implemented yet.
 * This is the foundation - emails will be sent by a worker service post-launch.
 *
 * To implement sending:
 * 1. Add SendGrid/Resend/SES credentials to .env
 * 2. Create a cron job to process pending emails
 * 3. Update EmailNotification status after sending
 */

// Email template data types
export interface LoanApprovedData {
  borrowerName?: string;
  loanAmount: number;
  interestRate: number;
  loanId: string;
}

export interface LoanDisbursedData {
  borrowerName?: string;
  loanAmount: number;
  txHash: string;
  loanId: string;
}

export interface PaymentDueData {
  borrowerName?: string;
  loanId: string;
  amountDue: number;
  dueDate: string;
  daysUntilDue: number;
}

export interface StakeConfirmedData {
  investorName?: string;
  amount: number;
  poolName: string;
  txHash: string;
}

export interface UnstakeReadyData {
  investorName?: string;
  amount: number;
  poolName: string;
}

// Template generator functions
const templates: Record<EmailNotificationType, (data: any) => { subject: string; body: string }> = {
  LOAN_APPROVED: (data: LoanApprovedData) => ({
    subject: 'Your Loan Application Has Been Approved!',
    body: `
      <h2>Congratulations!</h2>
      <p>Your loan application has been approved.</p>
      <ul>
        <li><strong>Loan Amount:</strong> $${data.loanAmount.toLocaleString()}</li>
        <li><strong>Interest Rate:</strong> ${data.interestRate}%</li>
        <li><strong>Loan ID:</strong> ${data.loanId}</li>
      </ul>
      <p>Your funds will be disbursed shortly. Please check your dashboard for updates.</p>
    `,
  }),

  LOAN_DISBURSED: (data: LoanDisbursedData) => ({
    subject: 'Your Loan Has Been Disbursed',
    body: `
      <h2>Funds Transferred</h2>
      <p>Your loan funds have been sent to your wallet.</p>
      <ul>
        <li><strong>Amount:</strong> $${data.loanAmount.toLocaleString()}</li>
        <li><strong>Transaction:</strong> <a href="https://sepolia.arbiscan.io/tx/${data.txHash}">${data.txHash.slice(0, 10)}...</a></li>
      </ul>
      <p>You can view your loan details and repayment schedule in your dashboard.</p>
    `,
  }),

  LOAN_REJECTED: (data: { loanId: string; reason?: string }) => ({
    subject: 'Update on Your Loan Application',
    body: `
      <h2>Application Update</h2>
      <p>Unfortunately, we were unable to approve your loan application at this time.</p>
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      <p>If you have questions, please reach out to our support team.</p>
    `,
  }),

  PAYMENT_DUE: (data: PaymentDueData) => ({
    subject: `Payment Reminder: $${data.amountDue.toLocaleString()} Due ${data.daysUntilDue === 0 ? 'Today' : `in ${data.daysUntilDue} days`}`,
    body: `
      <h2>Payment Reminder</h2>
      <p>Your loan payment is ${data.daysUntilDue === 0 ? 'due today' : `due in ${data.daysUntilDue} days`}.</p>
      <ul>
        <li><strong>Amount Due:</strong> $${data.amountDue.toLocaleString()}</li>
        <li><strong>Due Date:</strong> ${data.dueDate}</li>
      </ul>
      <p><a href="/borrower/loans/${data.loanId}">Make a payment</a></p>
    `,
  }),

  PAYMENT_RECEIVED: (data: { amount: number; loanId: string; remainingBalance: number }) => ({
    subject: 'Payment Received - Thank You!',
    body: `
      <h2>Payment Confirmed</h2>
      <p>We've received your payment. Thank you!</p>
      <ul>
        <li><strong>Amount Received:</strong> $${data.amount.toLocaleString()}</li>
        <li><strong>Remaining Balance:</strong> $${data.remainingBalance.toLocaleString()}</li>
      </ul>
    `,
  }),

  STAKE_CONFIRMED: (data: StakeConfirmedData) => ({
    subject: `Investment Confirmed: $${data.amount.toLocaleString()} in ${data.poolName}`,
    body: `
      <h2>Investment Confirmed</h2>
      <p>Your investment has been successfully processed.</p>
      <ul>
        <li><strong>Amount:</strong> $${data.amount.toLocaleString()} USDC</li>
        <li><strong>Pool:</strong> ${data.poolName}</li>
        <li><strong>Transaction:</strong> <a href="https://sepolia.arbiscan.io/tx/${data.txHash}">${data.txHash.slice(0, 10)}...</a></li>
      </ul>
      <p>Your funds are now earning returns. View your portfolio for details.</p>
    `,
  }),

  UNSTAKE_READY: (data: UnstakeReadyData) => ({
    subject: 'Your Withdrawal is Ready',
    body: `
      <h2>Withdrawal Ready</h2>
      <p>The cooldown period for your unstake request has ended. You can now complete your withdrawal.</p>
      <ul>
        <li><strong>Amount:</strong> $${data.amount.toLocaleString()} USDC</li>
        <li><strong>Pool:</strong> ${data.poolName}</li>
      </ul>
      <p><a href="/explore/portfolio">Complete Withdrawal</a></p>
    `,
  }),

  SECURITY_ALERT: (data: { alertType: string; details: string }) => ({
    subject: 'Security Alert - Action Required',
    body: `
      <h2>Security Alert</h2>
      <p><strong>Alert Type:</strong> ${data.alertType}</p>
      <p>${data.details}</p>
      <p>If you did not initiate this action, please secure your account immediately.</p>
    `,
  }),

  POOL_UPDATE: (data: { poolName: string; updateType: string; details: string }) => ({
    subject: `Pool Update: ${data.poolName}`,
    body: `
      <h2>${data.updateType}</h2>
      <p><strong>Pool:</strong> ${data.poolName}</p>
      <p>${data.details}</p>
    `,
  }),

  MARKETING: (data: { subject: string; content: string }) => ({
    subject: data.subject,
    body: data.content,
  }),
};

// Notification type to preference key mapping
const notificationTypeToPreference: Record<EmailNotificationType, string | null> = {
  LOAN_APPROVED: 'investmentUpdates', // Borrowers don't have this pref, but we'll check emailNotifications
  LOAN_DISBURSED: 'investmentUpdates',
  LOAN_REJECTED: 'investmentUpdates',
  PAYMENT_DUE: 'investmentUpdates',
  PAYMENT_RECEIVED: 'investmentUpdates',
  STAKE_CONFIRMED: 'investmentUpdates',
  UNSTAKE_READY: 'earningsAlerts',
  SECURITY_ALERT: null, // Always sent
  POOL_UPDATE: 'poolUpdates',
  MARKETING: 'marketingEmails',
};

/**
 * Queue an email notification for a user
 *
 * @param recipientAddress - Wallet address of the recipient
 * @param type - Type of notification
 * @param data - Template data for the notification
 * @param scheduledFor - Optional: Schedule for future delivery
 * @returns The created notification record, or null if user opted out
 */
export async function queueEmailNotification({
  recipientAddress,
  type,
  data,
  scheduledFor,
}: {
  recipientAddress: string;
  type: EmailNotificationType;
  data: any;
  scheduledFor?: Date;
}): Promise<{ success: boolean; notificationId?: string; reason?: string }> {
  try {
    // Get user's account and preferences
    const account = await prisma.account.findUnique({
      where: { address: recipientAddress },
      include: {
        notificationPreferences: true,
      },
    });

    if (!account) {
      return { success: false, reason: 'Account not found' };
    }

    if (!account.email) {
      return { success: false, reason: 'No email address on file' };
    }

    // Check if user has opted in to this notification type
    const preferences = account.notificationPreferences;
    if (preferences) {
      // Check master email toggle
      if (!preferences.emailNotifications) {
        return { success: false, reason: 'User has disabled email notifications' };
      }

      // Check specific preference (unless it's a security alert which is always sent)
      const preferenceKey = notificationTypeToPreference[type];
      if (preferenceKey && !preferences[preferenceKey as keyof typeof preferences]) {
        return { success: false, reason: `User has disabled ${preferenceKey} notifications` };
      }
    }

    // Generate email content from template
    const template = templates[type];
    if (!template) {
      return { success: false, reason: 'Invalid notification type' };
    }

    const { subject, body } = template(data);

    // Queue the notification
    const notification = await prisma.emailNotification.create({
      data: {
        recipientAddress,
        recipientEmail: account.email,
        type,
        subject,
        body,
        templateData: JSON.stringify(data),
        status: 'PENDING',
        scheduledFor: scheduledFor || null,
      },
    });

    console.log(`[EmailNotification] Queued ${type} notification for ${recipientAddress}: ${notification.id}`);

    return { success: true, notificationId: notification.id };
  } catch (error) {
    console.error('[EmailNotification] Failed to queue notification:', error);
    return { success: false, reason: 'Failed to queue notification' };
  }
}

/**
 * Get pending notifications ready to be sent
 * Used by the worker/cron job to process the queue
 */
export async function getPendingNotifications(limit = 50) {
  const now = new Date();

  return prisma.emailNotification.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/**
 * Mark a notification as sent
 */
export async function markNotificationSent(notificationId: string) {
  return prisma.emailNotification.update({
    where: { id: notificationId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
  });
}

/**
 * Mark a notification as failed
 */
export async function markNotificationFailed(notificationId: string, errorMessage: string) {
  const notification = await prisma.emailNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) return null;

  return prisma.emailNotification.update({
    where: { id: notificationId },
    data: {
      status: notification.retryCount >= 3 ? 'FAILED' : 'PENDING',
      errorMessage,
      retryCount: notification.retryCount + 1,
    },
  });
}

/**
 * Helper: Queue loan approval notification
 */
export async function notifyLoanApproved(
  recipientAddress: string,
  data: LoanApprovedData
) {
  return queueEmailNotification({
    recipientAddress,
    type: 'LOAN_APPROVED',
    data,
  });
}

/**
 * Helper: Queue loan disbursement notification
 */
export async function notifyLoanDisbursed(
  recipientAddress: string,
  data: LoanDisbursedData
) {
  return queueEmailNotification({
    recipientAddress,
    type: 'LOAN_DISBURSED',
    data,
  });
}

/**
 * Helper: Queue payment due reminder
 */
export async function notifyPaymentDue(
  recipientAddress: string,
  data: PaymentDueData,
  scheduledFor?: Date
) {
  return queueEmailNotification({
    recipientAddress,
    type: 'PAYMENT_DUE',
    data,
    scheduledFor,
  });
}

/**
 * Helper: Queue stake confirmation
 */
export async function notifyStakeConfirmed(
  recipientAddress: string,
  data: StakeConfirmedData
) {
  return queueEmailNotification({
    recipientAddress,
    type: 'STAKE_CONFIRMED',
    data,
  });
}

/**
 * Helper: Queue unstake ready notification
 */
export async function notifyUnstakeReady(
  recipientAddress: string,
  data: UnstakeReadyData
) {
  return queueEmailNotification({
    recipientAddress,
    type: 'UNSTAKE_READY',
    data,
  });
}
