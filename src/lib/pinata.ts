import { PinataSDK } from 'pinata';

// Initialize Pinata client
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY || 'gateway.pinata.cloud',
});

export interface PinataUploadResult {
  ipfsHash: string;
  ipfsUrl: string;
  pinSize: number;
  timestamp: string;
}

/**
 * Upload a file to IPFS via Pinata
 * @param file - File object to upload
 * @param name - Optional name for the file
 * @returns IPFS hash and gateway URL
 */
export async function uploadToPinata(
  file: File,
  name?: string
): Promise<PinataUploadResult> {
  try {
    const result = await pinata.upload.public.file(file, {
      metadata: {
        name: name || file.name,
      },
    });

    const gateway = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';

    return {
      ipfsHash: result.cid,
      ipfsUrl: `https://${gateway}/ipfs/${result.cid}`,
      pinSize: result.size || file.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw new Error(
      `Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Upload a file buffer to IPFS via Pinata
 * @param buffer - Buffer containing file data
 * @param fileName - Name for the file
 * @param mimeType - MIME type of the file
 * @returns IPFS hash and gateway URL
 */
export async function uploadBufferToPinata(
  buffer: Buffer,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<PinataUploadResult> {
  try {
    // Convert buffer to File object
    const blob = new Blob([buffer], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    return await uploadToPinata(file, fileName);
  } catch (error) {
    console.error('Pinata buffer upload error:', error);
    throw new Error(
      `Failed to upload buffer to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Unpin a file from Pinata (removes from IPFS pinning)
 * @param ipfsHash - CID of the file to unpin
 */
export async function unpinFromPinata(ipfsHash: string): Promise<void> {
  try {
    await pinata.files.public.delete([ipfsHash]);
  } catch (error) {
    console.error('Pinata unpin error:', error);
    throw new Error(
      `Failed to unpin from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get file info from Pinata
 * @param ipfsHash - CID of the file
 */
export async function getPinataFileInfo(ipfsHash: string) {
  try {
    const files = await pinata.files.public.list().cid(ipfsHash);
    return files.files?.[0] || null;
  } catch (error) {
    console.error('Pinata file info error:', error);
    return null;
  }
}

export { pinata };
