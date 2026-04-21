import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const getSecret = () => {
  const s = process.env.SESSION_SECRET ?? "dev_secret_agrivisit_2024";
  return new TextEncoder().encode(s);
};

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { userId: payload.userId as number };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
