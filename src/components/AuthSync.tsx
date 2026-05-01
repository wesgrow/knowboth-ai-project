"use client";
import { useEffect, useRef } from "react";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";
import { loadUserCart, saveUserCart } from "@/lib/cart";

async function syncUserProfile(session: any) {
  const userId = session.user.id;
  const rawName = session.user.user_metadata?.name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] || "User";
  const firstName = rawName.split(" ")[0];

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    await supabase.from("user_profiles").insert({
      user_id: userId,
      name: firstName,
      avatar: "🧑‍🍳",
      currency: "USD",
      points: 0,
    });
  }

  return {
    profile: {
      name: profile?.name || firstName,
      avatar: profile?.avatar || "🧑‍🍳",
      currency: profile?.currency || "USD",
      city: profile?.city || "DFW",
      zip: profile?.zip || "75074",
      theme: "light" as const,
      points: profile?.points || 0,
    },
    monthly_budget: profile?.monthly_budget != null ? Number(profile.monthly_budget) : undefined,
  };
}

export function AuthSync() {
  const { setUser, clearUser, setCart, updateBudget } = useAppStore();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Subscribe to cart changes — debounce-save to DB
  useEffect(() => {
    let prevCart = useAppStore.getState().cart;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.cart !== prevCart) {
        prevCart = state.cart;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveUserCart(state.cart), 1500);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Auth sync — load user profile + cart from DB on session
  useEffect(() => {
    supabaseAuth.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { profile, monthly_budget } = await syncUserProfile(session);
        setUser(profile);
        if (monthly_budget !== undefined) updateBudget(monthly_budget);
        const dbCart = await loadUserCart();
        setCart(dbCart);
      }
    });

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        const { profile, monthly_budget } = await syncUserProfile(session);
        setUser(profile);
        if (monthly_budget !== undefined) updateBudget(monthly_budget);
        if (event === "SIGNED_IN") {
          const dbCart = await loadUserCart();
          setCart(dbCart);
        }
      }
      if (event === "SIGNED_OUT") {
        clearUser();
        window.location.href = "/auth";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
