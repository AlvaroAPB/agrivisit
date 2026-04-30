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

// Endpoint REST para convertir fotos de Cloudinary a base64 (usado por generación de PDF)
app.post("/api/photos-base64", async (req: Request, res: Response) => {
  try {
    const { urls } = req.body as { urls: string[] };
    if (!Array.isArray(urls)) {
      console.error("[photos-base64] urls is not array:", urls);
      return res.status(400).json({ error: "urls must be array" });
    }
    console.log(`[photos-base64] Procesando ${urls.length} fotos`);
    const results = await Promise.all(
      urls.map(async (url: string) => {
        try {
          const pdfUrl = url.replace("/upload/", "/upload/w_200,h_200,c_fill,f_jpg,q_70/");
          const r = await fetch(pdfUrl);
          if (!r.ok) {
            console.warn(`[photos-base64] Falló descarga ${pdfUrl}: HTTP ${r.status}`);
            return null;
          }
          const buf = await r.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          console.log(`[photos-base64] OK ${url.substring(url.lastIndexOf("/")+1, url.lastIndexOf("/")+20)}... (${(base64.length/1024).toFixed(1)}KB)`);
          return { url, base64 };
        } catch (err) {
          console.error(`[photos-base64] Error con ${url}:`, err);
          return null;
        }
      })
    );
    const filtered = results.filter(Boolean);
    console.log(`[photos-base64] Devolviendo ${filtered.length}/${urls.length}`);
    res.json(filtered);
  } catch (err) {
    console.error("[photos-base64] Error general:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

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
