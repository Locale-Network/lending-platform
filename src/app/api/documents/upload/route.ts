import { NextRequest, NextResponse } from 'next/server';
import { uploadToSupabaseStorage } from '@/lib/supabase/storage';
import { uploadBufferToPinata } from '@/lib/pinata';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const poolId = formData.get('poolId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!poolId) {
      return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer for storage operations
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to both storage providers in parallel
    const [supabaseResult, pinataResult] = await Promise.all([
      uploadToSupabaseStorage(buffer, file.name, poolId, file.type),
      uploadBufferToPinata(buffer, file.name, file.type),
    ]);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      supabase: {
        url: supabaseResult.supabaseUrl,
        path: supabaseResult.supabasePath,
      },
      ipfs: {
        hash: pinataResult.ipfsHash,
        url: pinataResult.ipfsUrl,
      },
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
