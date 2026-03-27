import type { ErrorRequestHandler } from "express";
import type { ErrorResponse } from "shared";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const body: ErrorResponse = {
    ok: false,
    error: err instanceof Error ? err.message : "Internal server error",
  };
  res.status(500).json(body);
};
