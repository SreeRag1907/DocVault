import "dotenv/config";
import express from "express";
import cors from "cors";

import { initSchema } from "./db";
import authRoutes, { seedAdminIfNeeded } from "./routes/auth";
import documentRoutes from "./routes/documents";
import shareRoutes from "./routes/share";

const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/share", shareRoutes); // public - no auth, see routes/share.ts

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  await initSchema();
  await seedAdminIfNeeded();

  app.listen(PORT, () => {
    console.log(`DocVault API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
