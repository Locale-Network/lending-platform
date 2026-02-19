import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  ALLOWED_ACCREDITATION_METHODS,
  BLOCKED_COUNTRIES,
  REG_S_CERTIFICATION_KEYS,
  type RegSCertificationKey,
} from '@/constants/jurisdiction';

/**
 * POST /api/investor/accreditation
 *
 * Unified jurisdiction + accreditation certification endpoint.
 *
 * US flow (Reg D 506(b)):
 *   { jurisdictionType: "US_PERSON", state: "MO", method: "income" }
 *
 * Non-US flow (Reg S):
 *   { jurisdictionType: "NON_US_PERSON", country: "GB", regSCertifications: ["non_us_person", ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json(
        { error: 'Unauthorized - please connect your wallet' },
        { status: 401 }
      );
    }

    const address = session.address.toLowerCase();

    // Rate limit: 5 certifications per day per address
    const rateLimitResult = await checkRateLimit(
      `accreditation:${address}`,
      { limit: 5, windowSeconds: 86400 }
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again tomorrow.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { address },
      select: { address: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const jurisdictionType = body.jurisdictionType as string;

    if (jurisdictionType !== 'US_PERSON' && jurisdictionType !== 'NON_US_PERSON') {
      return NextResponse.json(
        { error: 'jurisdictionType must be US_PERSON or NON_US_PERSON' },
        { status: 400 }
      );
    }

    const now = new Date();

    // IP-based geolocation (Vercel injects this header; null in local dev)
    const detectedCountry = request.headers.get('x-vercel-ip-country')?.toUpperCase() || null;

    // ── US Person (Reg D 506(b)) ────────────────────────────────────
    if (jurisdictionType === 'US_PERSON') {
      const state = (body.state as string)?.toUpperCase();
      const method = body.method as string;

      if (!state || state.length !== 2) {
        return NextResponse.json(
          { error: 'state is required (2-letter code)' },
          { status: 400 }
        );
      }

      // Validate state is in allowed list
      const allowedState = await prisma.allowedState.findUnique({
        where: { stateCode: state },
      });

      if (!allowedState || !allowedState.isActive) {
        return NextResponse.json(
          { error: 'This state is not currently available for investment' },
          { status: 400 }
        );
      }

      if (!method || !ALLOWED_ACCREDITATION_METHODS.includes(method)) {
        return NextResponse.json(
          { error: `Invalid method. Must be one of: ${ALLOWED_ACCREDITATION_METHODS.join(', ')}` },
          { status: 400 }
        );
      }

      await prisma.account.update({
        where: { address },
        data: {
          jurisdictionType: 'US_PERSON',
          jurisdictionCountry: 'US',
          jurisdictionState: state,
          jurisdictionCertifiedAt: now,
          accreditationCertifiedAt: now,
          accreditationMethod: method,
          regSCertifications: undefined,
          detectedIpCountry: detectedCountry,
        },
      });

      if (detectedCountry && detectedCountry !== 'US') {
        console.warn(
          `[Accreditation] IP mismatch: address=${address} declared=US detected=${detectedCountry}`
        );
      }

      console.log(
        `[Accreditation] US self-certification: address=${address}, state=${state}, method=${method}, ipCountry=${detectedCountry}`
      );

      return NextResponse.json({
        success: true,
        jurisdictionType: 'US_PERSON',
        state,
        method,
        certifiedAt: now.toISOString(),
        detectedCountry,
      });
    }

    // ── Non-US Person (Reg S) ───────────────────────────────────────
    const country = (body.country as string)?.toUpperCase();
    const regSCerts = body.regSCertifications as string[];

    if (!country || country.length !== 2) {
      return NextResponse.json(
        { error: 'country is required (ISO 3166-1 alpha-2)' },
        { status: 400 }
      );
    }

    if (country === 'US') {
      return NextResponse.json(
        { error: 'US residents must select US_PERSON jurisdiction' },
        { status: 400 }
      );
    }

    if ((BLOCKED_COUNTRIES as readonly string[]).includes(country)) {
      return NextResponse.json(
        { error: 'This country is not eligible for participation' },
        { status: 400 }
      );
    }

    if (!Array.isArray(regSCerts) || regSCerts.length === 0) {
      return NextResponse.json(
        { error: 'regSCertifications array is required for Non-US investors' },
        { status: 400 }
      );
    }

    // All 4 Reg S certifications must be accepted
    const missingCerts = REG_S_CERTIFICATION_KEYS.filter(
      (k) => !regSCerts.includes(k)
    );
    if (missingCerts.length > 0) {
      return NextResponse.json(
        { error: `Missing required certifications: ${missingCerts.join(', ')}` },
        { status: 400 }
      );
    }

    // Only store valid keys
    const validCerts = regSCerts.filter((k): k is RegSCertificationKey =>
      REG_S_CERTIFICATION_KEYS.includes(k as RegSCertificationKey)
    );

    await prisma.account.update({
      where: { address },
      data: {
        jurisdictionType: 'NON_US_PERSON',
        jurisdictionCountry: country,
        jurisdictionState: null,
        jurisdictionCertifiedAt: now,
        regSCertifications: validCerts,
        accreditationCertifiedAt: now,
        accreditationMethod: 'reg_s',
        detectedIpCountry: detectedCountry,
      },
    });

    if (detectedCountry && detectedCountry !== country) {
      console.warn(
        `[Accreditation] IP mismatch: address=${address} declared=${country} detected=${detectedCountry}`
      );
    }

    console.log(
      `[Accreditation] Non-US Reg S certification: address=${address}, country=${country}, ipCountry=${detectedCountry}`
    );

    return NextResponse.json({
      success: true,
      jurisdictionType: 'NON_US_PERSON',
      country,
      regSCertifications: validCerts,
      certifiedAt: now.toISOString(),
      detectedCountry,
    });
  } catch (error) {
    console.error('[/api/investor/accreditation POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/investor/accreditation
 *
 * Check jurisdiction + accreditation certification status.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { address: session.address.toLowerCase() },
      select: {
        accreditationCertifiedAt: true,
        accreditationMethod: true,
        jurisdictionType: true,
        jurisdictionCountry: true,
        jurisdictionState: true,
        regSCertifications: true,
        jurisdictionCertifiedAt: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      certified: !!account.accreditationCertifiedAt,
      method: account.accreditationMethod,
      certifiedAt: account.accreditationCertifiedAt?.toISOString() ?? null,
      jurisdictionType: account.jurisdictionType,
      jurisdictionCountry: account.jurisdictionCountry,
      jurisdictionState: account.jurisdictionState,
      regSCertifications: account.regSCertifications,
      jurisdictionCertifiedAt: account.jurisdictionCertifiedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[/api/investor/accreditation GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
