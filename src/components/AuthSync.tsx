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
  const { setUser, clearUser, setCart, setCartLoading, updateBudget } = useAppStore();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Prevents the realtime-received update from triggering a write-back to DB
  const fromRemoteRef = useRef(false);

  // Subscribe to cart changes — debounce-save to DB (skip if change came from remote)
  useEffect(() => {
    let prevCart = useAppStore.getState().cart;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.cart !== prevCart) {
        prevCart = state.cart;
        if (fromRemoteRef.current) {
          fromRemoteRef.current = false;
          return;
        }
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
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    async function setupSession(session: any, isSignIn: boolean) {
      const { profile, monthly_budget } = await syncUserProfile(session);
      setUser(profile);
      if (monthly_budget !== undefined) updateBudget(monthly_budget);

      if (isSignIn) {
        setCartLoading(true);
        const dbCart = await loadUserCart();
        setCart(dbCart);
        setCartLoading(false);
      }

      // Real-time: watch cart changes from other devices on this user's profile row
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
      realtimeChannel = supabase
        .channel(`cart-sync:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_profiles",
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload: any) => {
            const remoteCart = payload.new?.cart_items;
            if (!Array.isArray(remoteCart)) return;
            const currentCart = useAppStore.getState().cart;
            // Skip if the cart is identical (our own write echoed back)
            if (JSON.stringify(currentCart) === JSON.stringify(remoteCart)) return;
            fromRemoteRef.current = true;
            useAppStore.getState().setCart(remoteCart);
          }
        )
        .subscribe();
    }

    supabaseAuth.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await setupSession(session, true);
      else setCartLoading(false); // not logged in — nothing to load
    });

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        await setupSession(session, event === "SIGNED_IN");
      }
      if (event === "SIGNED_OUT") {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        clearUser();
        window.location.href = "/auth";
      }
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return null;
}
