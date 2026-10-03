import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { RequestTimeoutError } from "@/lib/api/request-timeout";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly statusCode = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static notFound(entity = "Resource") {
    return new ApiError("NOT_FOUND", `${entity} not found`, 404);
  }

  static conflict(message: string) {
    return new ApiError("CONFLICT", message, 409);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError("BAD_REQUEST", message, 400, details);
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, meta, 201);
}

export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json<ApiFailure>({ success: false, error: { code, message, details } }, { status });
}

/** Single translation point from thrown errors to the JSON error envelope. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.code, error.message, error.statusCode, error.details);
  }
  if (error instanceof UnauthorizedError) {
    return fail("UNAUTHORIZED", error.message, 401);
  }
  if (error instanceof ForbiddenError) {
    return fail("FORBIDDEN", error.message, 403);
  }
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "The submitted data is invalid", 422, error.flatten().fieldErrors);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "value";
      return fail("CONFLICT", `A record with this ${target} already exists`, 409);
    }
    if (error.code === "P2025") return fail("NOT_FOUND", "Record not found", 404);
    if (error.code === "P2003") return fail("CONFLICT", "Related record constraint failed", 409);
  }
  if (error instanceof RequestTimeoutError) {
    return fail("INTERNAL_ERROR", "Database unavailable. Check that MySQL is running and configured correctly.", 503);
  }
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") ||
    (error instanceof Error && /timeout|timed out|database.*unavailable|ECONNREFUSED|connection.*failed/i.test(error.message))
  ) {
    return fail("INTERNAL_ERROR", "Database unavailable. Check that MySQL is running and configured correctly.", 503);
  }

  console.error("[api] unhandled error", error);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Wraps a route handler so every failure returns a consistent envelope. */
export function withErrorHandling(handler: Handler): Handler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
