import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUserProgressSnapshot } from "@/lib/progress-db";

export async function GET(request: NextRequest) {
  const patternId = request.nextUrl.searchParams.get("patternId");

  return NextResponse.json(
    await getCurrentUserProgressSnapshot(patternId ?? undefined),
  );
}
