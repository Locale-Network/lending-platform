import { NextResponse } from 'next/server';
import prisma from '@prisma/index';

/**
 * GET /api/allowed-states
 *
 * Public endpoint — returns the list of US states where the platform
 * is currently accepting investors. No auth required.
 */
export async function GET() {
  try {
    const states = await prisma.allowedState.findMany({
      where: { isActive: true },
      select: { stateCode: true, stateName: true },
      orderBy: { stateName: 'asc' },
    });

    return NextResponse.json({ states });
  } catch (error) {
    console.error('[/api/allowed-states GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
