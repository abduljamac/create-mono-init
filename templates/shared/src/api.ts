/** Standard API response wrapper */
export type ApiResponse<T> = {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
};

/** GET /health */
export type HealthResponse = {
  ok: boolean;
};

/** GET /api/hello */
export type HelloResponse = {
  message: string;
};
