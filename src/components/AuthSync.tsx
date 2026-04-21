"use client";
import { useEffect } from "react";
import { supabaseAuth } from "@/lib/supabase";
import { useAppStore } from "@/lib/store";

export function AuthSync() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    // On mount check existing session
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session && !user) {
        // User is logged in via Supabase but no profile in store yet
        // Set a default profile so Navbar renders
        setUser({
          name: session.user.email?.split("@")[0] || "User",
          avatar: "🧑‍🍳",
          currency: "USD",
          zip: "75074",
          city: "DFW",
          theme: "dark",
          points: 0,
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session && !user) {
          setUser({
            name: session.user.email?.split("@")[0] || "User",
            avatar: "🧑‍🍳",
            currency: "USD",
            zip: "75074",
            city: "DFW",
            theme: "dark",
            points: 0,
          });
        }
        if (event === "SIGNED_OUT") {
          // Clear store on logout
          window.location.href = "/auth";
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
