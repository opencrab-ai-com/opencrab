import { NextResponse } from "next/server";
import {
  isOpenCrabError,
  type OpenCrabError,
} from "@/lib/shared/errors/opencrab-error";
import { logServerError } from "@/lib/server/observability";

export type RouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>;
};

type JsonInit = ResponseInit;
type ErrorMeta = {
  requestId?: string;
  code?: string;
};
type ErrorResponseOptions = {
  request?: Request;
  operation?: string;
};

type ErrorWithStatusCode = {
  statusCode?: number;
};

export function json<T>(body: T, init?: JsonInit) {
  return NextResponse.json(body, init);
}

export function noStoreJson<T>(body: T, init?: JsonInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return json(body, {
    ...(init ?? {}),
    headers,
  });
}

export function errorJson(
  message: string,
  status = 500,
  init?: JsonInit,
  meta: ErrorMeta = {},
) {
  return noStoreJson(
    {
      error: message,
      requestId: meta.requestId ?? createRequestId(),
      ...(meta.code ? { code: meta.code } : {}),
    },
    {
      status,
      ...(init ?? {}),
    },
  );
}

export function badRequestJson(message: string) {
  return errorJson(message, 400, undefined, {
    code: "bad_request",
  });
}

export function notFoundJson(message: string) {
  return errorJson(message, 404, undefined, {
    code: "not_found",
  });
}

export async function readJsonBody<T>(
  request: Request,
  fallback?: T,
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw error;
  }
}

export async function readRouteParams<TParams extends Record<string, string>>(
  context: RouteContext<TParams>,
) {
  return context.params;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function getErrorStatus(error: unknown, fallback = 500) {
  const statusCode = (error as ErrorWithStatusCode | null | undefined)
    ?.statusCode;

  return typeof statusCode === "number" ? statusCode : fallback;
}

export function getErrorCode(error: unknown, fallback = "internal_error") {
  if (isOpenCrabError(error)) {
    return error.code;
  }

  return fallback;
}

export function errorResponse(
  error: unknown,
  fallback: string,
  fallbackStatus = 500,
  options: ErrorResponseOptions = {},
) {
  const status = getErrorStatus(error, fallbackStatus);
  const requestId = createRequestId();
  const message = getErrorMessage(error, fallback);
  const code = getErrorCode(
    error,
    status >= 500 ? "internal_error" : "bad_request",
  );

  logServerError({
    event: options.operation || "route_error",
    requestId,
    method: options.request?.method,
    pathname: options.request
      ? new URL(options.request.url).pathname
      : undefined,
    status,
    code,
    message,
    details: isOpenCrabError(error)
      ? (error as OpenCrabError).details
      : null,
  });

  return errorJson(message, status, undefined, {
    requestId,
    code,
  });
}

function createRequestId() {
  return `req-${crypto.randomUUID()}`;
}
