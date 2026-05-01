import { supabase, supabaseAuth } from "./supabase";
import type { CartItem } from "./store";

export async function loadUserCart(): Promise<CartItem[]> {
  try {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) return [];
    const { data } = await supabase
      .from("user_profiles")
      .select("cart_items")
      .eq("user_id", session.user.id)
      .single();
    return Array.isArray(data?.cart_items) ? (data.cart_items as CartItem[]) : [];
  } catch { return []; }
}

export async function saveUserCart(cart: CartItem[]): Promise<void> {
  try {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) return;
    await supabase.from("user_profiles").update({
      cart_items: cart,
      updated_at: new Date().toISOString(),
    }).eq("user_id", session.user.id);
  } catch(e: any) {
    console.error("saveUserCart:", e);
  }
}
