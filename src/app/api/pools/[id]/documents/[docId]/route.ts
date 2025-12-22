import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unpinFromPinata } from '@/lib/pinata';
import { deleteFromSupabaseStorage } from '@/lib/supabase/storage';

// GET - Get a single document
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

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PATCH - Update a document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
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
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'effectiveDate' || field === 'expirationDate') {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
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

// DELETE - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
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
