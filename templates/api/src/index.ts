import cors from "cors";
import express from "express";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/hello", (_req, res) => {
  res.json({ message: "Hello from api (create-mono-init)!" });
});

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
