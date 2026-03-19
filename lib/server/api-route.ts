import { NextResponse } from "next/server";

export type RouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>;
};

type JsonInit = ResponseInit;

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

export function errorJson(message: string, status = 500, init?: JsonInit) {
  return json(
    { error: message },
    {
      status,
      ...(init ?? {}),
    },
  );
}

export function badRequestJson(message: string) {
  return errorJson(message, 400);
}

export function notFoundJson(message: string) {
  return errorJson(message, 404);
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

export function errorResponse(
  error: unknown,
  fallback: string,
  fallbackStatus = 500,
) {
  return errorJson(
    getErrorMessage(error, fallback),
    getErrorStatus(error, fallbackStatus),
  );
}
