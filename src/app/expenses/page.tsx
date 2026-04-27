"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase, supabaseAuth } from "@/lib/supabase";
import toast from "react-hot-toast";

const CAT_ICONS: Record<string, string> = {
  Grocery: "🛒",
  Vegetables: "🥦",
  Fruits: "🍎",
  Dairy: "🥛",
  "Rice & Grains": "🌾",
  "Lentils & Dals": "🫘",
  Spices: "🌶️",
  Snacks: "🍿",
  Beverages: "🧃",
  "Oils & Ghee": "🫙",
  Frozen: "❄️",
  "Meat & Fish": "🍗",
  Bakery: "🍞",
  Gas: "⛽",
  Restaurant: "🍽️",
  Pharmacy: "💊",
  Household: "🏠",
  Electronics: "💻",
  Other: "📦",
};

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: -1 },
];

interface Expense {
  id: string;
  store_name: string;
  store_city: string;
  purchase_date: string;
  currency: string;
  total: number;
  items_count: number;
  source: string;
  created_at: string;
  items?: ExpenseItem[];
}

interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  category: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("All");
  const [filterStore, setFilterStore] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, ExpenseItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const currency = user?.currency || "USD";

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session }, error: authError } = await supabaseAuth.auth.getSession();
      if (authError) throw new Error(`Auth error: ${authError.message}`);
      if (!session?.user?.id) {
        router.push("/auth");
        return;
      }

      let query = supabase
        .from("expenses")
        .select("id,store_name,store_city,purchase_date,currency,total,items_count,source,created_at")
        .eq("user_id", session.user.id)
        .order("purchase_date", { ascending: false });

      if (dateFrom) query = query.gte("purchase_date", dateFrom);
      if (dateTo) query = query.lte("purchase_date", dateTo);

      const { data, error: fetchError } = await query;
      if (fetchError) throw new Error(`Failed to load expenses: ${fetchError.message}`);
      setExpenses(data || []);
    } catch (e: any) {
      console.error("Expenses fetch error:", e);
      setError(e.message || "Failed to load expenses");
      toast.error(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  async function loadItems(expenseId: string) {
    if (expandedId === expenseId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(expenseId);
    if (expandedItems[expenseId]) return;

    setLoadingItems(expenseId);
    try {
      const { data, error } = await supabase
        .from("expense_items")
        .select("id,name,price,quantity,unit,category")
        .eq("expense_id", expenseId)
        .order("category");
      if (error) throw new Error(error.message);
      setExpandedItems(prev => ({ ...prev, [expenseId]: data || [] }));
    } catch (e: any) {
      toast.error(`Failed to load items: ${e.message}`);
    } finally {
      setLoadingItems(null);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Delete this bill? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success("Bill deleted");
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  function applyPreset(days: number) {
    if (days === -1) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateFrom(from.toISOString().split("T")[0]);
    setDateTo(to.toISOString().split("T")[0]);
  }

  const allStores = [...new Set(expenses.map(e => e.store_name))];
  const loadedCategories = [...new Set(Object.values(expandedItems).flat().map(i => i.category))];

  const filtered = expenses.filter(e => {
    if (filterStore !== "All" && e.store_name !== filterStore) return false;
    if (filterCat !== "All") {
      const items = expandedItems[e.id];
      if (items && !items.some(i => i.category === filterCat)) return false;
    }
    return true;
  });

  const totalSpent = filtered.reduce((s, e) => s + Number(e.total), 0);
  const avgBill = filtered.length > 0 ? totalSpent / filtered.length : 0;
  const thisMonth = filtered
    .filter(e => {
      const d = new Date(e.purchase_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, e) => s + Number(e.total), 0);

  const catTotals: Record<string, number> = {};
  Object.values(expandedItems).flat().forEach(item => {
    catTotals[item.category] = (catTotals[item.category] || 0) + item.price * item.quantity;
  });
  const maxCat = Math.max(...Object.values(catTotals), 1);

  function sourceIcon(source: string) {
    return source === "receipt" ? "🧾" : source === "manual" ? "✏️" : "📄";
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ padding: "20px 24px", maxWidth: 1200, width: "100%" }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.5 }}>Expenses</h1>
              <p style={{ fontSize: 13, color: "#6D6D72", marginTop: 3 }}>Track every bill · Scan to add</p>
            </div>
            <button
              onClick={() => router.push("/scan")}
              style={{
                background: "linear-gradient(135deg,#FF9F0A,#D4800A)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(255,159,10,0.3)",
              }}
            >
              🧾 Scan Bill
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
            {[
              { l: "Total Spent", v: fmt(totalSpent), c: "#FF9F0A", i: "💰" },
              { l: "This Month", v: fmt(thisMonth), c: "#0A84FF", i: "📅" },
              { l: "Avg Bill", v: fmt(avgBill), c: "#30D158", i: "📊" },
            ].map(s => (
              <div
                key={s.l}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "12px",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontSize: 18 }}>{s.i}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c, marginTop: 4, letterSpacing: -0.5 }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#AEAEB2", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  background: "#fff",
                  color: "#6D6D72",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {p.label}
              </button>
            ))}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                background: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 12,
                color: "#1C1C1E",
                outline: "none",
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                background: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 12,
                color: "#1C1C1E",
                outline: "none",
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const }}>
            <select
              value={filterStore}
              onChange={e => setFilterStore(e.target.value)}
              style={{
                flex: 1,
                minWidth: 140,
                background: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                color: "#1C1C1E",
                outline: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <option value="All">All Stores</option>
              {allStores.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              style={{
                flex: 1,
                minWidth: 140,
                background: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                color: "#1C1C1E",
                outline: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <option value="All">All Categories</option>
              {loadedCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div
              style={{
                fontSize: 12,
                color: "#AEAEB2",
                padding: "9px 12px",
                background: "#fff",
                borderRadius: 10,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                whiteSpace: "nowrap",
              }}
            >
              {filtered.length} bill{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "rgba(255,59,48,0.08)",
                border: "1px solid rgba(255,59,48,0.2)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, color: "#FF3B30" }}>⚠️ {error}</span>
              <button
                onClick={fetchExpenses}
                style={{
                  background: "#FF3B30",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#AEAEB2" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              Loading expenses...
            </div>
          )}

          {!loading && !error && expenses.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1E", marginBottom: 8 }}>No bills yet</div>
              <p style={{ fontSize: 13, color: "#AEAEB2", marginBottom: 20 }}>Scan your grocery receipts to track spending</p>
              <button
                onClick={() => router.push("/scan")}
                style={{
                  background: "linear-gradient(135deg,#FF9F0A,#D4800A)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🧾 Scan First Bill
              </button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {filtered.map(expense => {
                const isExpanded = expandedId === expense.id;
                const items = expandedItems[expense.id] || [];
                const isLoading = loadingItems === expense.id;
                const isDeleting = deletingId === expense.id;

                return (
                  <div
                    key={expense.id}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      onClick={() => loadItems(expense.id)}
                      style={{
                        padding: "14px 16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: "rgba(255,159,10,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          flexShrink: 0,
                        }}
                      >
                        {sourceIcon(expense.source)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#1C1C1E",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {expense.store_name}
                        </div>
                        <div style={{ fontSize: 12, color: "#6D6D72", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          <span>📅 {expense.purchase_date}</span>
                          {expense.store_city && <span>📍 {expense.store_city}</span>}
                          <span>🛍️ {expense.items_count} items</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#FF9F0A" }}>{fmt(Number(expense.total))}</div>
                        <div style={{ fontSize: 10, color: "#AEAEB2", marginTop: 1 }}>{expense.currency}</div>
                      </div>
                      <div style={{ fontSize: 16, color: "#AEAEB2", flexShrink: 0, marginTop: 4 }}>{isExpanded ? "▲" : "▼"}</div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "0.5px solid #F2F2F7" }}>
                        {isLoading ? (
                          <div style={{ padding: "16px", textAlign: "center", color: "#AEAEB2", fontSize: 13 }}>Loading items...</div>
                        ) : items.length === 0 ? (
                          <div style={{ padding: "16px", textAlign: "center", color: "#AEAEB2", fontSize: 13 }}>No items found for this bill</div>
                        ) : (
                          <>
                            <div style={{ padding: "10px 16px", background: "#F9F9F9", borderBottom: "0.5px solid #F2F2F7" }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                                {[...new Set(items.map(i => i.category))].map(cat => (
                                  <span
                                    key={cat}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background: "rgba(255,159,10,0.1)",
                                      color: "#FF9F0A",
                                      borderRadius: 20,
                                      padding: "2px 8px",
                                    }}
                                  >
                                    {CAT_ICONS[cat] || "📦"} {cat} ({items.filter(i => i.category === cat).length})
                                  </span>
                                ))}
                              </div>
                            </div>
                            {items.map((item, i) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "10px 16px",
                                  borderBottom: i < items.length - 1 ? "0.5px solid #F2F2F7" : "none",
                                }}
                              >
                                <div style={{ fontSize: 16, flexShrink: 0 }}>{CAT_ICONS[item.category] || "📦"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                                  <div style={{ fontSize: 11, color: "#AEAEB2" }}>{item.category} · qty {item.quantity} {item.unit}</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1E" }}>{fmt(item.price * item.quantity)}</div>
                                  {item.quantity > 1 && <div style={{ fontSize: 10, color: "#AEAEB2" }}>{fmt(item.price)}/ea</div>}
                                </div>
                              </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "#F9F9F9", borderTop: "0.5px solid #F2F2F7" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#6D6D72" }}>Items Total</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "#FF9F0A" }}>{fmt(items.reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                            </div>
                          </>
                        )}
                        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderTop: "0.5px solid #F2F2F7" }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              deleteExpense(expense.id);
                            }}
                            disabled={isDeleting}
                            style={{
                              flex: 1,
                              padding: "8px",
                              background: "rgba(255,59,48,0.08)",
                              border: "none",
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#FF3B30",
                              cursor: "pointer",
                              opacity: isDeleting ? 0.5 : 1,
                            }}
                          >
                            {isDeleting ? "Deleting..." : "🗑️ Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {Object.keys(catTotals).length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E", marginBottom: 14 }}>📊 Spending by Category</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#1C1C1E" }}>{CAT_ICONS[cat] || "📦"} {cat}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#FF9F0A" }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ height: 6, background: "#F2F2F7", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(amt / maxCat) * 100}%`,
                          background: "linear-gradient(90deg,#FF9F0A,#D4800A)",
                          borderRadius: 3,
                          transition: "width 0.5s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#AEAEB2", marginTop: 12, textAlign: "center" }}>Expand bills above to load category breakdown</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
