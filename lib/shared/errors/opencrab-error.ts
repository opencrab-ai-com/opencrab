export type OpenCrabErrorOptions = {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
};

export class OpenCrabError extends Error {
  statusCode: number;
  code: string;
  details: Record<string, unknown> | null;

  constructor(message: string, options: number | OpenCrabErrorOptions = 500) {
    super(message);
    this.name = "OpenCrabError";

    if (typeof options === "number") {
      this.statusCode = options;
      this.code = options >= 500 ? "internal_error" : "bad_request";
      this.details = null;
      return;
    }

    this.statusCode = options.statusCode ?? 500;
    this.code =
      options.code ??
      (this.statusCode >= 500 ? "internal_error" : "bad_request");
    this.details = options.details ?? null;
  }
}

export function isOpenCrabError(error: unknown): error is OpenCrabError {
  return error instanceof OpenCrabError;
}
