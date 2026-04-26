"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { supabaseAuth } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

async function syncUserProfile(session: any) {
  const userId = session.user.id;
  const rawName = session.user.user_metadata?.name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] || "User";
  const firstName = rawName.split(" ")[0];

  // Try to get existing profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    // Create profile on first login
    await supabase.from("user_profiles").insert({
      user_id: userId,
      name: firstName,
      avatar: "🧑‍🍳",
      currency: "USD",
      points: 0,
    });
  }

  return {
    name: profile?.name || firstName,
    avatar: profile?.avatar || "🧑‍🍳",
    currency: profile?.currency || "USD",
    city: profile?.city || "DFW",
    theme: "light" as const,
    points: profile?.points || 0,
  };
}

export function AuthSync() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    supabaseAuth.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !user) {
        const profile = await syncUserProfile(session);
        setUser(profile);
      }
    });

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session && !user) {
        const profile = await syncUserProfile(session);
        setUser(profile);
      }
      if (event === "SIGNED_OUT") window.location.href = "/auth";
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
