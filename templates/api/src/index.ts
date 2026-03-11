import cors from "cors";
import express from "express";
import type { HealthResponse, HelloResponse } from "shared";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  const body: HealthResponse = { ok: true };
  res.json(body);
});

app.get("/api/hello", (_req, res) => {
  const body: HelloResponse = { message: "Hello from api (create-mono-init)!" };
  res.json(body);
});

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
