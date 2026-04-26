import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Single client instance — handles auth automatically
const supabase = createClientComponentClient();

export { supabase };
export const supabaseAuth = supabase;