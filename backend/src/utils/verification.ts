import crypto from "crypto";
import type { Request } from "express";
import { prisma } from "./db.js";
import type { VerificationType } from "@prisma/client";
import { parseDeviceInfo, getLocationFromIp } from "./deviceInfo.js";

// Configuration
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

/**
 * Generates a random numeric verification code
 */
export function generateCode(): string {
  // Generate a cryptographically secure random number
  const max = Math.pow(10, CODE_LENGTH);
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0) % max;
  return randomNumber.toString().padStart(CODE_LENGTH, "0");
}

/**
 * Generates a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate expiration time for verification codes
 */
export function getCodeExpiry(): Date {
  return new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Calculate expiration time for sessions (30 days)
 */
export function getSessionExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

interface CreateVerificationCodeParams {
  phone?: string;
  email?: string;
  userId?: string;
  type: VerificationType;
  inviteToken?: string;
}

/**
 * Creates a new verification code in the database
 */
export async function createVerificationCode(
  params: CreateVerificationCodeParams
): Promise<string> {
  const { phone, email, userId, type, inviteToken } = params;

  // Invalidate any existing unused codes for this phone/email
  if (phone) {
    await prisma.verificationCode.updateMany({
      where: { phone, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
  if (email) {
    await prisma.verificationCode.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  const code = generateCode();

  await prisma.verificationCode.create({
    data: {
      phone,
      email,
      userId,
      code,
      type,
      inviteToken,
      expiresAt: getCodeExpiry(),
    },
  });

  return code;
}

interface VerifyCodeParams {
  phone?: string;
  email?: string;
  code: string;
  type: VerificationType;
}

interface VerifyCodeResult {
  valid: boolean;
  userId?: string;
  verificationCodeId?: string;
  inviteToken?: string;
}

/**
 * Verifies a code and marks it as used if valid
 */
export async function verifyCode(
  params: VerifyCodeParams
): Promise<VerifyCodeResult> {
  const { phone, email, code, type } = params;

  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      ...(phone && { phone }),
      ...(email && { email }),
      code,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!verificationCode) {
    return { valid: false };
  }

  // Mark as used
  await prisma.verificationCode.update({
    where: { id: verificationCode.id },
    data: { usedAt: new Date() },
  });

  return {
    valid: true,
    userId: verificationCode.userId ?? undefined,
    verificationCodeId: verificationCode.id,
    inviteToken: verificationCode.inviteToken ?? undefined,
  };
}

/**
 * Sends a verification code (currently just logs to console)
 * In production, this would integrate with SMS/email providers
 */
export function sendVerificationCode(
  destination: string,
  code: string,
  type: "phone" | "email"
): void {
  console.log("========================================");
  console.log(`VERIFICATION CODE for ${type}: ${destination}`);
  console.log(`Code: ${code}`);
  console.log(`Expires in: ${CODE_EXPIRY_MINUTES} minutes`);
  console.log("========================================");
}

/**
 * Create session data object with device information from request
 */
export function createSessionData(userId: string, req: Request, deviceInfo?: string) {
  const parsedDeviceInfo = parseDeviceInfo(req);
  const location = parsedDeviceInfo.ipAddress
    ? getLocationFromIp(parsedDeviceInfo.ipAddress)
    : null;

  return {
    userId,
    token: generateSessionToken(),
    deviceInfo: deviceInfo || req.headers["user-agent"] || null,
    deviceType: parsedDeviceInfo.deviceType,
    deviceName: parsedDeviceInfo.deviceName,
    ipAddress: parsedDeviceInfo.ipAddress,
    location,
    expiresAt: getSessionExpiry(),
  };
}

/**
 * Send notification for new device login
 */
export async function notifyNewDeviceLogin(
  userId: string,
  deviceName: string,
  location: string | null
): Promise<void> {
  const locationStr = location || "Unknown location";
  const message = `New login detected on ${deviceName} from ${locationStr}`;

  await prisma.notification.create({
    data: {
      userId,
      type: "NEW_DEVICE_LOGIN",
      message,
    },
  });
}
