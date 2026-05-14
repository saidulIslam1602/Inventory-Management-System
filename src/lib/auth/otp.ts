import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_LEN = 6;

export function generateNumericOtp(length: number = OTP_LEN): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String(randomInt(0, 10));
  }
  return out;
}

function pepper(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

/** Store only this in the database (never the raw OTP). */
export function hashOtp(code: string): string {
  return createHash("sha256").update(`${pepper()}:pwd-reset:${code}`).digest("hex");
}

export function verifyOtpAgainstHash(code: string, storedHash: string): boolean {
  const computed = hashOtp(code);
  if (computed.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
