import { createAdminClient } from './server';

const BUCKET_NAME = 'pool-documents';
const IMAGES_BUCKET = 'pool-images';

export interface StorageUploadResult {
  supabaseUrl: string;
  supabasePath: string;
  fileSize: number;
}

/**
 * Upload a file to Supabase Storage
 * @param file - File buffer to upload
 * @param fileName - Name for the file (will be stored with unique prefix)
 * @param poolId - Pool ID for organizing files
 * @param mimeType - MIME type of the file
 */
export async function uploadToSupabaseStorage(
  file: Buffer,
  fileName: string,
  poolId: string,
  mimeType: string = 'application/pdf'
): Promise<StorageUploadResult> {
  const supabase = createAdminClient();

  // Create unique file path with pool ID prefix and timestamp
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${poolId}/${timestamp}-${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error('Supabase storage upload error:', error);
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

  return {
    supabaseUrl: publicUrl,
    supabasePath: data.path,
    fileSize: file.length,
  };
}

/**
 * Delete a file from Supabase Storage
 * @param filePath - Path of the file to delete
 */
export async function deleteFromSupabaseStorage(filePath: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    console.error('Supabase storage delete error:', error);
    throw new Error(`Failed to delete from Supabase Storage: ${error.message}`);
  }
}

/**
 * Get a signed URL for a private file
 * @param filePath - Path of the file
 * @param expiresIn - Expiration time in seconds (default 1 hour)
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * List all documents for a pool
 * @param poolId - Pool ID to list documents for
 */
export async function listPoolDocuments(poolId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(poolId);

  if (error) {
    console.error('Supabase storage list error:', error);
    return [];
  }

  return data || [];
}

/**
 * Upload a pool image to Supabase Storage
 * @param file - File buffer to upload
 * @param fileName - Original file name
 * @param poolId - Pool ID or slug for organizing files
 */
export async function uploadPoolImage(
  file: Buffer,
  fileName: string,
  poolId: string
): Promise<StorageUploadResult> {
  const supabase = createAdminClient();

  // Get file extension
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Create unique file path
  const timestamp = Date.now();
  const filePath = `${poolId}/${timestamp}.${ext}`;

  const { data, error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: true, // Allow replacing existing image
    });

  if (error) {
    console.error('Supabase image upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(data.path);

  return {
    supabaseUrl: publicUrl,
    supabasePath: data.path,
    fileSize: file.length,
  };
}

/**
 * Delete a pool image from Supabase Storage
 * @param filePath - Path of the image to delete
 */
export async function deletePoolImage(filePath: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove([filePath]);

  if (error) {
    console.error('Supabase image delete error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

export { BUCKET_NAME, IMAGES_BUCKET };
