"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function SupabaseWakeUp() {
  useEffect(() => {
    supabase.from("brands").select("id").limit(1).then(() => {});
  }, []);
  return null;
}
