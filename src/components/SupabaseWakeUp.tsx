"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export function SupabaseWakeUp() {
  useEffect(() => {
    let toastId: string | undefined;
    const timer = setTimeout(() => {
      toastId = toast.loading("Connecting to server...", { duration: 300000 });
    }, 4000);

    supabase.from("brands").select("id").limit(1).then(() => {
      clearTimeout(timer);
      if (toastId) toast.dismiss(toastId);
    }).catch(() => {
      clearTimeout(timer);
      if (toastId) toast.dismiss(toastId);
    });

    return () => {
      clearTimeout(timer);
      if (toastId) toast.dismiss(toastId);
    };
  }, []);

  return null;
}
