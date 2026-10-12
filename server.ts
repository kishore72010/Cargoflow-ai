import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiRouter from "./backend/routes.js";
import { getDb, isMongoAlive } from "./backend/db.js";
import { initSocket } from "./backend/socket.js";

import cookieParser from "cookie-parser";

async function startServer() {
  // Pre-initialize database
  try {
    await getDb();
    console.log("[CargoFlow Server] Database connected and verified.");
  } catch (err) {
    console.error("[CargoFlow Server] Database pre-init error:", err);
  }

  const app = express();
  const httpServer = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize Socket.IO on the HTTP server
  initSocket(httpServer);
  console.log("[CargoFlow Server] Socket.IO real-time engine initialized.");

  // Request parsers
  app.use(cookieParser());
  app.use(express.json());

  // Mount API routes FIRST
  app.use("/api", apiRouter);

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    const mongoAlive = await isMongoAlive();
    res.json({
      status: "ok",
      server: "Express + Vite (CargoFlow AI)",
      mongo: mongoAlive ? "connected" : "disconnected",
      socket: "active",
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[CargoFlow Server] Live at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[CargoFlow Server] Startup error:", err);
});

