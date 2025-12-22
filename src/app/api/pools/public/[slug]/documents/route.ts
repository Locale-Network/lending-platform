import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Find the pool by slug
    const pool = await prisma.loanPool.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    });

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Fetch documents from database
    const documents = await prisma.poolDocument.findMany({
      where: {
        poolId: pool.id,
        isPublic: true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        description: true,
        documentType: true,
        version: true,
        storageProvider: true,
        storageHash: true,
        storageUrl: true,
        fileName: true,
        fileSize: true,
        isRequired: true,
        isPublic: true,
        effectiveDate: true,
        expirationDate: true,
        displayOrder: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      pool: {
        id: pool.id,
        name: pool.name,
        status: pool.status,
      },
      documents,
      totalCount: documents.length,
    });
  } catch (error) {
    console.error('Error fetching pool documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
