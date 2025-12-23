import { NextRequest, NextResponse } from 'next/server';
import { uploadPoolImage } from '@/lib/supabase/storage';
import { requireAdmin } from '@/lib/auth/authorization';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const poolId = formData.get('poolId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!poolId) {
      return NextResponse.json({ error: 'Pool ID required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const result = await uploadPoolImage(buffer, file.name, poolId);

    return NextResponse.json({
      success: true,
      imageUrl: result.supabaseUrl,
      imagePath: result.supabasePath,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    const isAuthError = message.includes('Unauthorized') || message.includes('Authentication');
    return NextResponse.json(
      { error: message },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
