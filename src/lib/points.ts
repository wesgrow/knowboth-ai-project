// src/lib/points.ts
// Centralized points management — reads/writes to Supabase user_profiles

import { supabase } from "./supabase";
import { supabaseAuth } from "./supabase";

export const POINTS = {
  SCAN_BILL: 5,
  SCAN_PER_ITEM: 2,
  POST_DEAL: 10,
  POST_PER_ITEM: 1,
  COMPARE_PRICE: 1,
  SHARE_PRICE: 3,
  COMMENT: 2,
  LIKE: 1,
};

export async function getPoints(): Promise<number> {
  try {
    const { data:{ session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) return 0;
    const { data } = await supabase
      .from("user_profiles")
      .select("points")
      .eq("user_id", session.user.id)
      .single();
    return data?.points || 0;
  } catch { return 0; }
}

export async function addPoints(pts: number, reason?: string): Promise<number> {
  try {
    const { data:{ session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) return 0;
    const userId = session.user.id;

    // Upsert profile with incremented points
    const { data:existing } = await supabase
      .from("user_profiles")
      .select("points")
      .eq("user_id", userId)
      .single();

    const currentPoints = existing?.points || 0;
    const newPoints = currentPoints + pts;

    await supabase.from("user_profiles").upsert({
      user_id: userId,
      points: newPoints,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    console.log(`Points: +${pts} (${reason || "action"}) → Total: ${newPoints}`);
    return newPoints;
  } catch(e: any) {
    console.error("addPoints error:", e);
    return 0;
  }
}

export async function syncProfile(): Promise<any> {
  try {
    const { data:{ session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) return null;
    const userId = session.user.id;
    const name = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User";

    // Upsert profile — create if not exists
    const { data } = await supabase.from("user_profiles").upsert({
      user_id: userId,
      name: name.split(" ")[0],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id", ignoreDuplicates: true }).select().single();

    // Read full profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    return profile;
  } catch(e: any) {
    console.error("syncProfile error:", e);
    return null;
  }
}
