import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Single client instance — handles auth automatically
const supabase = createClientComponentClient();

export { supabase };
export const supabaseAuth = supabase;

// Wraps a Supabase call with a timeout + one automatic retry.
// On free-tier projects, the first request after inactivity can hang while
// the DB wakes up. The retry fires after a 3-second pause, by which point
// Supabase is usually awake and the second attempt succeeds.
export async function timedRetry<T>(fn: () => Promise<T>, timeoutMs = 12000): Promise<T> {
  const attempt = () => Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("__timeout__")), timeoutMs)
    ),
  ]);

  try {
    return await attempt();
  } catch (e: any) {
    if (e.message !== "__timeout__") throw e;
    // First attempt timed out — wait for Supabase to wake up, then retry once
    await new Promise(r => setTimeout(r, 3000));
    try {
      return await attempt();
    } catch (e2: any) {
      throw new Error(
        e2.message === "__timeout__"
          ? "Request timed out — check your connection and try again"
          : e2.message
      );
    }
  }
}