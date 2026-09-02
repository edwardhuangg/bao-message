import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Keep-alive: Supabase free projects pause after ~7 days without DB activity.
// Hit daily by Vercel Cron (see vercel.json).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.PING_SECRET;
  if (secret && secret !== "change-me") {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ ok: !error, at: new Date().toISOString() });
}
