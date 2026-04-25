"use client";
import { useEffect } from "react";
import { supabaseAuth } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

function buildUser(session: any) {
  return {
    name: session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split("@")[0] || "User",
    avatar: "🧑‍🍳",
    currency: "USD",
    zip: "75074",
    city: "DFW",
    theme: "light" as const,
    points: 0,
  };
}

export function AuthSync() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session && !user) setUser(buildUser(session));
    });

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && !user) setUser(buildUser(session));
      if (event === "SIGNED_OUT") window.location.href = "/auth";
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
