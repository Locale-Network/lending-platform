import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { checkRateLimit, rateLimitHeaders, rateLimits } from '@/lib/rate-limit';
import { US_STATES } from '@/constants/jurisdiction';

/**
 * GET /api/admin/allowed-states
 *
 * Returns all allowed states (active and inactive) for admin management.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.address || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const states = await prisma.allowedState.findMany({
      orderBy: { stateName: 'asc' },
    });

    return NextResponse.json({ states });
  } catch (error) {
    console.error('[/api/admin/allowed-states GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/allowed-states
 *
 * Add a new state to the allowed list.
 * Body: { stateCode: "CA" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.address || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimitResult = await checkRateLimit(
      `admin-allowed-states:${session.address}`,
      rateLimits.api
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    let body: { stateCode?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const stateCode = body.stateCode?.toUpperCase();
    if (!stateCode || stateCode.length !== 2) {
      return NextResponse.json({ error: 'stateCode is required (2-letter code)' }, { status: 400 });
    }

    const stateInfo = US_STATES.find((s) => s.code === stateCode);
    if (!stateInfo) {
      return NextResponse.json({ error: `Unknown state code: ${stateCode}` }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.allowedState.findUnique({
      where: { stateCode },
    });

    if (existing) {
      // Re-activate if it was deactivated
      if (!existing.isActive) {
        const updated = await prisma.allowedState.update({
          where: { stateCode },
          data: { isActive: true },
        });
        return NextResponse.json({ state: updated });
      }
      return NextResponse.json({ error: 'State already active' }, { status: 409 });
    }

    const state = await prisma.allowedState.create({
      data: {
        stateCode,
        stateName: stateInfo.name,
        isActive: true,
      },
    });

    console.log(`[Admin] Allowed state added: ${stateCode} by ${session.address}`);
    return NextResponse.json({ state }, { status: 201 });
  } catch (error) {
    console.error('[/api/admin/allowed-states POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/allowed-states
 *
 * Toggle a state's active status.
 * Body: { stateCode: "CA", isActive: false }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.address || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimitResult = await checkRateLimit(
      `admin-allowed-states:${session.address}`,
      rateLimits.api
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    let body: { stateCode?: string; isActive?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const stateCode = body.stateCode?.toUpperCase();
    if (!stateCode) {
      return NextResponse.json({ error: 'stateCode is required' }, { status: 400 });
    }

    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }

    const existing = await prisma.allowedState.findUnique({
      where: { stateCode },
    });

    if (!existing) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    const state = await prisma.allowedState.update({
      where: { stateCode },
      data: { isActive: body.isActive },
    });

    console.log(
      `[Admin] Allowed state ${body.isActive ? 'activated' : 'deactivated'}: ${stateCode} by ${session.address}`
    );

    return NextResponse.json({ state });
  } catch (error) {
    console.error('[/api/admin/allowed-states PATCH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
