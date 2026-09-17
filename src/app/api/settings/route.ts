import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'tenant_name'").get() as
    | { value: string }
    | undefined;
  return NextResponse.json({ tenantName: row?.value ?? null });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const tenantName = typeof body?.tenantName === "string" ? body.tenantName.trim() : "";

  const db = getDb();
  if (tenantName) {
    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('tenant_name', @value) ON CONFLICT(key) DO UPDATE SET value = @value"
    ).run({ value: tenantName });
  } else {
    db.prepare("DELETE FROM meta WHERE key = 'tenant_name'").run();
  }

  return NextResponse.json({ tenantName: tenantName || null });
}
