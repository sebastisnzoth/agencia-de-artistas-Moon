import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { ToolPermissionError } from "@/lib/tool-policy";
import { AuthorizationError } from "@/lib/workspace";

export function apiError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorizationError || error instanceof ToolPermissionError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", issues: error.issues },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
