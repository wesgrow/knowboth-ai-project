"use client";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/lib/store";
import { PriceSource } from "@/components/PriceSource";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQty, togglePurchased, clearCart, moveToPantry, user } = useAppStore();

  const groups: Record<string, any[]> = {};
  cart.forEach(item => {
    const s = item.store || "Other";
    if (!groups[s]) groups[s] = [];
    groups[s].push(item);
  });

  const pending = cart.filter(i => !i.purchased);
  const total = pending.reduce((s, i) => (i.price || 0) * i.qty + s, 0);
  const currency = user?.currency || "USD";
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  function handleMoveToPantry(item: any) {
    moveToPantry(item); // moves item and removes from cart
    toast.success(`🏠 ${item.name} → Pantry`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }} className="page-body">
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>My Cart</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {pending.length} pending · {cart.filter(i => i.purchased).length} purchased
            </p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => { if (confirm("Clear all?")) clearCart(); }} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 12 }}>
              Clear All
            </button>
          )}
        </div>

        {cart.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Cart is empty</div>
            <button onClick={() => router.push("/deals")} className="btn-gold" style={{ padding: "10px 24px" }}>Browse Deals →</button>
          </div>
        )}

        {Object.keys(groups).map(storeName => {
          const items = groups[storeName];
          const storeTotal = items.filter(i => !i.purchased).reduce((s, i) => (i.price || 0) * i.qty + s, 0);
          return (
            <div key={storeName} style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ background: "var(--surf2)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>📍 {storeName}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{fmt(storeTotal)}</span>
              </div>
              {[...items.filter(i => !i.purchased), ...items.filter(i => i.purchased)].map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)", opacity: item.purchased ? 0.55 : 1 }}>
                  <div onClick={() => togglePurchased(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${item.purchased ? "var(--teal)" : "var(--border2)"}`, background: item.purchased ? "var(--teal)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, color: "#000", flexShrink: 0 }}>
                    {item.purchased ? "✓" : ""}
                  </div>
                  <div style={{ fontSize: 18, width: 28, textAlign: "center" }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textDecoration: item.purchased ? "line-through" : "none", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{item.unit} · {item.category}</div>
                    <PriceSource storeName={item.store} size="sm" />
                  </div>
                  {!item.purchased && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surf2)", color: "var(--text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center", color: "var(--text)" }}>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surf2)", color: "var(--text)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)", minWidth: 50, textAlign: "right", flexShrink: 0 }}>{fmt((item.price || 0) * item.qty)}</div>
                  {item.purchased
                    ? <button onClick={() => handleMoveToPantry(item)} style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)", color: "var(--teal)", borderRadius: 7, padding: "5px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>→ Pantry</button>
                    : <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14, padding: 3, flexShrink: 0 }}>✕</button>
                  }
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div style={{ position: "fixed", bottom: 56, left: 0, right: 0, background: "var(--surf)", borderTop: "1px solid var(--border)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 99 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>ESTIMATED TOTAL</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--gold)" }}>{fmt(total)}</div>
          </div>
          <button onClick={() => router.push("/scan")} className="btn-gold" style={{ padding: "10px 20px" }}>Upload Bill →</button>
        </div>
      )}
    </div>
  );
}
