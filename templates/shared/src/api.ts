/** Standard API response wrapper */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** GET /health */
export type HealthResponse = {
  ok: boolean;
};

/** Error response with optional error code */
export type ErrorResponse = {
  ok: false;
  error: string;
  code?: string;
};

/** Paginated list response */
export type PaginatedResponse<T> = {
  ok: true;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
