import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cache the count for 5 minutes at the CDN/edge level
export const revalidate = 300;

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Prefer service role for unrestricted count; fall back to anon key
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { count, error } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });
    if (error) return NextResponse.json({ count: 0 });
    return NextResponse.json({ count: count ?? 0 }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
