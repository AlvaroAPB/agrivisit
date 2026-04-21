import type { Express, Request, Response } from "express";
import { serialize } from "cookie";
import { createSessionToken, hashPassword, verifyPassword } from "./auth";
import { getUserByEmail, createUser, updateLastSignedIn } from "./db";

const COOKIE_NAME = "agrivisit_session";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

function setSession(res: Response, token: string) {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_MS / 1000,
    path: "/",
  }));
}

function clearSession(res: Response) {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: -1, path: "/",
  }));
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { res.status(400).json({ error: "Todos los campos son obligatorios" }); return; }
    if (password.length < 6) { res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" }); return; }
    try {
      const existing = await getUserByEmail(email);
      if (existing) { res.status(409).json({ error: "Ya existe una cuenta con ese email" }); return; }
      const passwordHash = await hashPassword(password);
      const user = await createUser({ name, email, passwordHash });
      const token = await createSessionToken(user.id);
      setSession(res, token);
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
      console.error("[Register]", e);
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Email y contraseña obligatorios" }); return; }
    try {
      const user = await getUserByEmail(email);
      if (!user) { res.status(401).json({ error: "Email o contraseña incorrectos" }); return; }
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) { res.status(401).json({ error: "Email o contraseña incorrectos" }); return; }
      await updateLastSignedIn(user.id);
      const token = await createSessionToken(user.id);
      setSession(res, token);
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (e) {
      console.error("[Login]", e);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    clearSession(res);
    res.json({ success: true });
  });
}
