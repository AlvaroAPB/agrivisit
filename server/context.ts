import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookies } from "cookie";
import { verifySessionToken } from "./auth";
import { getUserById } from "./db";
import type { User } from "../drizzle/schema";

export type Context = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<Context> {
  let user: User | null = null;
  try {
    const cookies = parseCookies(opts.req.headers.cookie || "");
    const token = cookies["agrivisit_session"];
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload) user = await getUserById(payload.userId);
    }
  } catch { user = null; }
  return { req: opts.req, res: opts.res, user };
}
