import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
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

app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).cookies = parseCookies(req.headers.cookie || "");
  next();
});

registerAuthRoutes(app);

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist/client");
  app.use(express.static(distPath));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = parseInt(process.env.PORT || "3000");
server.listen(PORT, () => {
  console.log(`AgriVisit server running on http://localhost:${PORT}`);
});
