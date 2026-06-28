import { NextRequest, NextResponse } from "next/server";
import { RouteClassification } from "@/server/authz/types";

export type CustomMiddleware = (args: {
  request: NextRequest;
  classification: RouteClassification;
  requestId: string;
}) => Promise<NextResponse | null> | NextResponse | null;

export const CUSTOM_MIDDLEWARE: CustomMiddleware[] = [
  // Add custom middleware functions here
];
