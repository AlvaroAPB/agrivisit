import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { parse as parseCookies } from "cookie";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";
import { registerAuthRoutes } from "./authRoutes";

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parsing sin cookie-parser
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie || "");
  next();
});

// Rutas de autenticación
registerAuthRoutes(app);

// API tRPC
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

// Frontend estático en producción
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist/client");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = parseInt(process.env.PORT || "3000");
server.listen(PORT, () => {
  console.log(`AgriVisit server running on http://localhost:${PORT}`);
});
