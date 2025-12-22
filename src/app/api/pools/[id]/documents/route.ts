import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for creating a document
const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  documentType: z.enum([
    'PPM',
    'SUBSCRIPTION_AGREEMENT',
    'OPERATING_AGREEMENT',
    'USE_OF_FUNDS',
    'RISK_DISCLOSURE',
    'INVESTOR_QUESTIONNAIRE',
    'ACCREDITATION_VERIFICATION',
    'FINANCIAL_STATEMENTS',
    'LEGAL_OPINION',
    'OTHER',
  ]),
  version: z.string().default('1.0'),
  storageProvider: z.enum(['IPFS', 'ARWEAVE', 'S3']),
  storageHash: z.string().min(1),
  storageUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().default('application/pdf'),
  checksum: z.string().optional(),
  isRequired: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  displayOrder: z.number().int().default(0),
  // Supabase backup info
  supabaseUrl: z.string().url().optional(),
  supabasePath: z.string().optional(),
});

// GET - List all documents for a pool
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;

    const documents = await prisma.poolDocument.findMany({
      where: { poolId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
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

// POST - Create a new document for a pool
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poolId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = createDocumentSchema.parse(body);

    // Verify pool exists
    const pool = await prisma.loanPool.findUnique({
      where: { id: poolId },
      select: { id: true },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Create the document
    const document = await prisma.poolDocument.create({
      data: {
        poolId,
        title: validatedData.title,
        description: validatedData.description,
        documentType: validatedData.documentType,
        version: validatedData.version,
        storageProvider: validatedData.storageProvider,
        storageHash: validatedData.storageHash,
        storageUrl: validatedData.storageUrl,
        fileName: validatedData.fileName,
        fileSize: validatedData.fileSize,
        mimeType: validatedData.mimeType,
        checksum: validatedData.checksum,
        isRequired: validatedData.isRequired,
        isPublic: validatedData.isPublic,
        effectiveDate: validatedData.effectiveDate
          ? new Date(validatedData.effectiveDate)
          : null,
        expirationDate: validatedData.expirationDate
          ? new Date(validatedData.expirationDate)
          : null,
        displayOrder: validatedData.displayOrder,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating pool document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
