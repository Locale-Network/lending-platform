import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unpinFromPinata } from '@/lib/pinata';
import { deleteFromSupabaseStorage } from '@/lib/supabase/storage';
import { getSession } from '@/lib/auth/authorization';
import { Role, Prisma } from '@prisma/client';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

// GET - Get a single document
// Note: Public documents can be fetched without auth, private documents require admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id: poolId, docId } = await params;

    const document = await prisma.poolDocument.findFirst({
      where: {
        id: docId,
        poolId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // SECURITY: Private documents require admin authentication
    if (!document.isPublic) {
      const session = await getSession();
      if (!session?.address || session.user.role !== Role.ADMIN) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required for private documents' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PATCH - Update a document (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    // SECURITY: Require admin authentication for document updates
    const session = await getSession();
    if (!session?.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // SECURITY: Rate limiting on document updates
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `pool-doc-update:${session.address}`,
      { limit: 30, windowSeconds: 3600 } // 30 updates per hour
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many update requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { id: poolId, docId } = await params;
    const body = await request.json();

    // Verify document exists and belongs to pool
    const existing = await prisma.poolDocument.findFirst({
      where: {
        id: docId,
        poolId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only allow updating certain fields
    const allowedFields = [
      'title',
      'description',
      'isRequired',
      'isPublic',
      'effectiveDate',
      'expirationDate',
      'displayOrder',
    ] as const;

    const updateData: Prisma.PoolDocumentUncheckedUpdateInput = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'effectiveDate' || field === 'expirationDate') {
          (updateData as Record<string, unknown>)[field] = body[field] ? new Date(body[field]) : null;
        } else {
          (updateData as Record<string, unknown>)[field] = body[field];
        }
      }
    }

    const document = await prisma.poolDocument.update({
      where: { id: docId },
      data: updateData,
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    // SECURITY: Require admin authentication for document deletion
    const session = await getSession();
    if (!session?.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // SECURITY: Rate limiting on document deletion
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `pool-doc-delete:${session.address}`,
      { limit: 20, windowSeconds: 3600 } // 20 deletions per hour
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many delete requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { id: poolId, docId } = await params;

    // Verify document exists and belongs to pool
    const document = await prisma.poolDocument.findFirst({
      where: {
        id: docId,
        poolId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Try to clean up storage (but don't fail if cleanup fails)
    const cleanupErrors: string[] = [];

    // Unpin from IPFS if using IPFS
    if (document.storageProvider === 'IPFS' && document.storageHash) {
      try {
        await unpinFromPinata(document.storageHash);
      } catch (error) {
        cleanupErrors.push(
          `IPFS cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Delete from Supabase Storage if we have a path stored
    // Note: We'd need to store the Supabase path in the document model
    // For now, we'll just delete the database record

    // Delete the document record
    await prisma.poolDocument.delete({
      where: { id: docId },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted',
      cleanupErrors: cleanupErrors.length > 0 ? cleanupErrors : undefined,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
