import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'send-emails' });

/**
 * Email Sending Cron Job
 *
 * DEFERRED: This cron job is disabled until Locale's email domains are configured with Resend.
 *
 * Once configured:
 * 1. Add RESEND_API_KEY and RESEND_FROM_EMAIL to .env
 * 2. Implement processPendingEmails() in email.ts
 * 3. Uncomment the processing logic below
 *
 * Should be called every minute via Vercel Cron:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-emails",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  // Verify cron secret for security
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Email sending is deferred until Locale's email domains are configured
  log.info('Email sending deferred - awaiting domain configuration');

  return NextResponse.json({
    success: true,
    message: 'Email sending deferred - awaiting Resend domain configuration',
    processed: 0,
    sent: 0,
    failed: 0,
  });
}

// Also support POST for manual triggering
export async function POST(req: NextRequest) {
  return GET(req);
}
