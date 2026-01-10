import { describe, it, expect } from "@jest/globals";
import { validateImage } from "../../utils/imageUpload.js";
import sharp from "sharp";

describe("Image Upload Utility", () => {
  describe("validateImage", () => {
    it("should reject files larger than 5MB", async () => {
      // Create a buffer that's larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      const result = await validateImage(largeBuffer);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errorCode).toBe("FILE_TOO_LARGE");
      }
    });

    it("should accept valid JPEG images", async () => {
      // Create a small valid JPEG
      const jpegBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      }).jpeg().toBuffer();

      const result = await validateImage(jpegBuffer);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.mimeType).toBe("image/jpeg");
      }
    });

    it("should accept valid PNG images", async () => {
      // Create a small valid PNG
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 }
        }
      }).png().toBuffer();

      const result = await validateImage(pngBuffer);
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.mimeType).toBe("image/png");
      }
    });

    it("should reject unsupported image formats", async () => {
      // Create a GIF (unsupported)
      const gifBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      }).gif().toBuffer();

      const result = await validateImage(gifBuffer);
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errorCode).toBe("UNSUPPORTED_FORMAT");
      }
    });

    it("should reject invalid/corrupted image data", async () => {
      const invalidBuffer = Buffer.from("This is not an image");
      const result = await validateImage(invalidBuffer);

      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errorCode).toBe("INVALID_IMAGE");
      }
    });

    it("should accept images under 5MB", async () => {
      // Create a 1MB JPEG
      const buffer = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      }).jpeg({ quality: 80 }).toBuffer();

      const result = await validateImage(buffer);
      expect(result.isValid).toBe(true);
    });
  });
});
