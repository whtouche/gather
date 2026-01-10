import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Image upload and storage utility
 * Uses local filesystem storage (can be replaced with S3/CDN later)
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "images");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;

export interface ImageUploadResult {
  url: string;
  width: number;
  height: number;
}

export interface ImageValidationError {
  isValid: false;
  error: string;
  errorCode: string;
}

export interface ImageValidationSuccess {
  isValid: true;
  mimeType: string;
}

export type ImageValidationResult = ImageValidationError | ImageValidationSuccess;

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Validate image buffer
 */
export async function validateImage(buffer: Buffer): Promise<ImageValidationResult> {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: "Image file size must be 5MB or less",
      errorCode: "FILE_TOO_LARGE",
    };
  }

  // Validate image format using sharp
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format) {
      return {
        isValid: false,
        error: "Invalid image format",
        errorCode: "INVALID_FORMAT",
      };
    }

    const mimeType = `image/${metadata.format}`;

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return {
        isValid: false,
        error: "Only JPEG and PNG images are allowed",
        errorCode: "UNSUPPORTED_FORMAT",
      };
    }

    return {
      isValid: true,
      mimeType,
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid or corrupted image file",
      errorCode: "INVALID_IMAGE",
    };
  }
}

/**
 * Process and save uploaded image
 * - Validates format and size
 * - Resizes if needed
 * - Saves to disk
 * - Returns URL and dimensions
 */
export async function saveImage(buffer: Buffer, userId: string): Promise<ImageUploadResult> {
  await ensureUploadDir();

  // Validate image
  const validation = await validateImage(buffer);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Process image with sharp
  let image = sharp(buffer);
  const metadata = await image.metadata();

  // Resize if too large while maintaining aspect ratio
  if (metadata.width && metadata.height) {
    if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
      image = image.resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
  }

  // Convert to JPEG for consistency and smaller file size
  image = image.jpeg({ quality: 85, progressive: true });

  // Generate unique filename
  const hash = createHash("sha256")
    .update(buffer)
    .update(userId)
    .update(Date.now().toString())
    .digest("hex");
  const filename = `${hash}.jpg`;
  const filepath = path.join(UPLOAD_DIR, filename);

  // Save processed image
  const processedBuffer = await image.toBuffer();
  await fs.writeFile(filepath, processedBuffer);

  // Get final dimensions
  const finalMetadata = await sharp(processedBuffer).metadata();
  const width = finalMetadata.width || 0;
  const height = finalMetadata.height || 0;

  // Return URL (relative path that can be served by Express static middleware)
  const url = `/uploads/images/${filename}`;

  return {
    url,
    width,
    height,
  };
}

/**
 * Delete an image by URL
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    const filename = path.basename(url);
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.unlink(filepath);
  } catch (error) {
    // Ignore errors if file doesn't exist
    console.error("Error deleting image:", error);
  }
}
