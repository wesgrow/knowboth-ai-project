import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Single client instance — handles auth automatically
const supabase = createClientComponentClient();

export { supabase };
export const supabaseAuth = supabase;

// Wraps a Supabase call with a timeout + automatic retries.
// Free-tier Supabase projects can take up to 60s to wake from pause.
// 60s × 4 attempts + 8s gaps = ~276s max coverage.
export async function timedRetry<T>(fn: () => PromiseLike<T>, timeoutMs = 60000, maxRetries = 4): Promise<T> {
  const attempt = (): Promise<T> => Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("__timeout__")), timeoutMs)
    ),
  ]);

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await attempt();
    } catch (e: any) {
      if (e.message !== "__timeout__") throw e; // real error, don't retry
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 8000)); // wait 8s between retries
      }
    }
  }
  throw new Error("Server is not responding. Please check your connection and try again.");
}
