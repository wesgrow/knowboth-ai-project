"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { supabase, supabaseAuth } from "@/lib/supabase";
import { STORE_COLORS, getLevel, formatCurrency } from "@/lib/utils";
import { HomeTemplate } from "@/templates/HomeTemplate";
import { Card, Skeleton } from "@/ui";

const CATEGORY_ICONS: Record<string, string> = {
  Vegetables:"🥦",Fruits:"🍎",Dairy:"🥛","Meat & Fish":"🐟",
  "Rice & Grains":"🌾","Lentils & Dals":"🫘",Spices:"🌶️",
  Snacks:"🍿",Beverages:"🧃","Oils & Ghee":"🫙",Frozen:"🧊",Bakery:"🍞",Household:"🧹",Grocery:"🛒",
};

export default function HomePage() {
  const router = useRouter();
  const { user, cart, updateBudget, monthly_budget } = useAppStore();
  const [deals, setDeals] = useState<any[]>([]);
  const [thisMonthSpent, setThisMonthSpent] = useState(0);
  const [lastMonthSpent, setLastMonthSpent] = useState(0);
  const [totalBills, setTotalBills] = useState(0);
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [tip, setTip] = useState("Add items to cart before shopping to stay on budget.");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const currency = user?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, currency);
  const cartCount = cart?.filter((i: any) => !i.purchased)?.length || 0;
  const level = getLevel(user?.points || 0);
  const isNewUser = !loadingStats && totalBills === 0;
  const spendDiff = thisMonthSpent - lastMonthSpent;
  const spendPct = lastMonthSpent > 0 ? Math.abs(Math.round((spendDiff / lastMonthSpent) * 100)) : 0;

  useEffect(() => { fetchStats(); fetchDeals(); rotateTip(); }, []);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const [{ data: thisMonth }, { data: lastMonth }, { count: bills }] = await Promise.all([
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", thisMonthStart),
        supabase.from("expenses").select("total").eq("user_id", userId).gte("purchase_date", lastMonthStart).lte("purchase_date", lastMonthEnd),
        supabase.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      setThisMonthSpent((thisMonth || []).reduce((s: number, e: any) => s + Number(e.total), 0));
      setLastMonthSpent((lastMonth || []).reduce((s: number, e: any) => s + Number(e.total), 0));
      setTotalBills(bills || 0);

      const { data: latestExp } = await supabase
        .from("expenses").select("id,store_name,purchase_date")
        .eq("user_id", userId).order("purchase_date", { ascending: false }).limit(1).single();
      if (latestExp?.id) {
        const { data: latestItems } = await supabase.from("expense_items")
          .select("id,name,quantity,unit,category")
          .eq("expense_id", latestExp.id)
          .in("category", ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Household"])
          .limit(5);
        setRecentItems((latestItems || []).map((i: any) => ({ ...i, store: latestExp.store_name, date: latestExp.purchase_date })));
      }

      const { data: dealRows } = await supabase.from("deals").select("id,sale_end").eq("status", "approved").not("sale_end", "is", null);
      setExpiringCount((dealRows || []).filter((d: any) => {
        const days = Math.ceil((new Date(d.sale_end).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 3;
      }).length);
    } catch (e) { console.error("Stats error:", e); }
    setLoadingStats(false);
  }

  async function fetchDeals() {
    setLoadingDeals(true);
    try {
      const { data: dealRows } = await supabase.from("deals").select("id,brand_id").eq("status", "approved");
      if (!dealRows?.length) { setLoadingDeals(false); return; }
      const dealIds = dealRows.map((d: any) => d.id);
      const brandIds = [...new Set(dealRows.map((d: any) => d.brand_id).filter(Boolean))] as string[];
      const { data: brands } = await supabase.from("brands").select("id,name,slug").in("id", brandIds);
      const { data: items } = await supabase.from("deal_items").select("id,deal_id,name,price,regular_price,unit,category,created_at").in("deal_id", dealIds).order("created_at", { ascending: false }).limit(6);
      const bMap: Record<string, any> = {}; (brands || []).forEach((b: any) => { bMap[b.id] = b; });
      const dMap: Record<string, any> = {}; dealRows.forEach((d: any) => { dMap[d.id] = d; });
      setDeals((items || []).map((i: any) => ({ ...i, brand: bMap[dMap[i.deal_id]?.brand_id] })));
    } catch (e) { console.error("Deals error:", e); }
    setLoadingDeals(false);
  }

  async function saveBudget() {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) return;
    updateBudget(val);
    setEditingBudget(false);
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (session?.user?.id) {
      await supabase.from("user_profiles").update({ monthly_budget: val }).eq("user_id", session.user.id);
    }
  }

  function rotateTip() {
    const tips = [
      "Compare prices before shopping — deals change weekly.",
      "Scan your bills to track spending patterns over time.",
      "Check expiring deals before they disappear.",
      "Buy lentils and rice in bulk for maximum savings.",
      "Use the Expenses page to spot your biggest spending categories.",
      "Add items to cart before shopping to stay on budget.",
    ];
    setTip(tips[new Date().getDay() % tips.length]);
  }

  return (
    <HomeTemplate>
      <style>{`
        .hb-action{display:flex;align-items:center;gap:8px;border:none;border-radius:50px;padding:10px 18px;cursor:pointer;font-family:inherit;transition:transform .15s,box-shadow .15s;flex-shrink:0}
        .hb-stat{flex:1;background:var(--surf);border-radius:16px;padding:14px 10px;text-align:center;cursor:pointer;box-shadow:var(--shadow);transition:transform .15s}
        .hb-deal-card{flex-shrink:0;width:152px;background:var(--surf);border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:var(--shadow);transition:transform .15s}
        .hb-step{background:var(--surf);border-radius:14px;padding:16px 12px;text-align:center;box-shadow:var(--shadow)}
        .hb-badge{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;background:var(--surf);border:1px solid var(--border);border-radius:20px;font-size:11px;font-weight:600;color:var(--text2);white-space:nowrap}
        .hb-pill-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;-ms-overflow-style:none;scrollbar-width:none}
        .hb-pill-row::-webkit-scrollbar{display:none}
        .hb-deals-row{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;-ms-overflow-style:none;scrollbar-width:none}
        .hb-deals-row::-webkit-scrollbar{display:none}
        .expiring-pulse{animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @media(hover:hover) and (pointer:fine){
          .hb-action:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.12)}
          .hb-stat:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.12)}
          .hb-deal-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.12)}
        }
        @media(hover:none){.hb-action:hover,.hb-stat:hover,.hb-deal-card:hover{transform:none!important}}
        @media(prefers-reduced-motion:reduce){.expiring-pulse{animation:none!important}}
      `}</style>

      {/* ── HEADER ── */}
      <div className="fade-up" style={{ marginBottom: 24 }}>
        {/* Top row: location + avatar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(48,209,88,.1)", border: "1px solid rgba(48,209,88,.2)", borderRadius: 50, padding: "6px 14px" }}>
            <span style={{ fontSize: 13 }}>📍</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>{user?.city || "DFW"} 25mi</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: 1, textTransform: "uppercase" }}>KNOWBOTH.AI</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>Smart Grocery AI</div>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surf)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "var(--shadow)" }}>
              {user?.avatar || "🧑‍🍳"}
            </div>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: -0.6, lineHeight: 1.2, marginBottom: 6 }}>
          Hi, {user?.name?.split(" ")[0] || "there"} 👋
        </div>
        <div style={{ fontSize: 15, color: "var(--text2)", fontWeight: 500, marginBottom: 10 }}>
          Know Your Savings. Know Your Spending.
        </div>

        {/* User badge pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surf)", border: "1px solid var(--border)", borderRadius: 50, padding: "6px 14px", boxShadow: "var(--shadow)" }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{level}</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border)" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{user?.points || 0} pts</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{user?.city || "DFW"}</span>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="fade-up hb-pill-row" style={{ marginBottom: 24, animationDelay: "0.08s" }}>
        {[
          { l: "Scan Bill",      i: "🧾", h: "/scan",      bg: "rgba(255,159,10,.12)", border: "rgba(255,159,10,.35)", c: "#B45309" },
          { l: "Post Deal",      i: "📷", h: "/post-deal", bg: "rgba(48,209,88,.12)",  border: "rgba(48,209,88,.35)",  c: "#15803D" },
          { l: "Deals", i: "🏷️", h: "/deals",     bg: "rgba(10,132,255,.12)", border: "rgba(10,132,255,.35)", c: "#1D4ED8" },
        ].map(a => (
          <button key={a.l} className="hb-action" onClick={() => router.push(a.h)}
            style={{ background: a.bg, border: `1.5px solid ${a.border}` }}>
            <span style={{ fontSize: 18 }}>{a.i}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>{a.l}</span>
          </button>
        ))}
        <button className="hb-action" onClick={() => router.push("/expenses")}
          style={{ background: "rgba(255,159,10,.08)", border: "1.5px solid rgba(255,159,10,.25)" }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>Expenses</span>
        </button>
      </div>

      {/* ── STATUS ROW ── */}
      <div className="fade-up" style={{ display: "flex", gap: 10, marginBottom: 24, animationDelay: "0.12s" }}>
        {[
          { l: "Cart",     v: cartCount,     i: "🛒", c: "var(--gold)", h: "/cart",     pulse: false },
          { l: "Bills",    v: totalBills,    i: "🧾", c: "var(--text)", h: "/expenses", pulse: false },
          { l: "Expiring", v: expiringCount, i: "⏰", c: "var(--red)",  h: "/deals",    pulse: expiringCount > 0 },
        ].map(s => (
          <div key={s.l} className="hb-stat" onClick={() => router.push(s.h)} role="button" tabIndex={0}
            onKeyDown={e => e.key === "Enter" && router.push(s.h)} aria-label={`${s.l}: ${s.v}`}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.i}</div>
            {loadingStats
              ? <Skeleton h={26} w="50%" style={{ margin: "0 auto 4px" }} />
              : <div className={s.pulse ? "expiring-pulse" : ""} style={{ fontSize: 26, fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</div>
            }
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── HOW IT WORKS (new users) ── */}
      {isNewUser && (
        <div className="fade-up" style={{ marginBottom: 24, animationDelay: "0.14s" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>How It Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
            {[
              { i: "📸", t: "Scan Bill",      d: "Upload your grocery receipt" },
              { i: "📊", t: "Track Spending", d: "See where your money goes" },
              { i: "💰", t: "Save More",      d: "Catch deals before they expire" },
            ].map((step, idx) => (
              <div key={idx} className="hb-step">
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,159,10,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 8px" }}>{step.i}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>{step.t}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4 }}>{step.d}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["🔒 No bank login", "🤖 AI-powered", "🛡️ Private", "🇮🇳 South Asian groceries"].map(b => (
              <span key={b} className="hb-badge">{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── THIS MONTH + BUDGET ── */}
      {!isNewUser && (
        <Card className="fade-up" style={{ marginBottom: 20, animationDelay: "0.16s" }} pad={18} radius={18}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>💰 This Month</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
            <div>
              {loadingStats
                ? <Skeleton h={34} w={110} style={{ marginBottom: 4 }} />
                : <div style={{ fontSize: 30, fontWeight: 800, color: "var(--gold)", letterSpacing: -1, lineHeight: 1 }}>{fmt(thisMonthSpent)}</div>}
              {loadingStats
                ? <Skeleton h={13} w={80} style={{ marginTop: 6 }} />
                : <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}><span style={{ fontWeight: 700, color: "var(--text)" }}>{totalBills}</span> bills scanned</div>}
            </div>
            {!loadingStats && lastMonthSpent > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: spendDiff <= 0 ? "var(--green)" : "var(--red)" }}>{spendDiff <= 0 ? "↓" : "↑"} {spendPct}% vs last month</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{fmt(lastMonthSpent)} last month</div>
              </div>
            )}
          </div>

          {!loadingStats && lastMonthSpent > 0 && spendDiff < 0 && (
            <div style={{ padding: "8px 12px", background: "rgba(48,209,88,.08)", border: "1px solid rgba(48,209,88,.2)", borderRadius: 10, fontSize: 12, color: "var(--green)", fontWeight: 700, marginBottom: 10 }}>
              ✦ Saving {fmt(Math.abs(spendDiff))} more than last month
            </div>
          )}

          {/* Budget */}
          {!loadingStats && (() => {
            const budget = monthly_budget;
            if (editingBudget) return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Monthly Budget</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="number" min="1" step="1" autoFocus value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveBudget(); if (e.key === "Escape") setEditingBudget(false); }}
                    placeholder="e.g. 500"
                    style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 15, color: "var(--text)", outline: "none", fontFamily: "inherit" }} />
                  <button onClick={saveBudget} style={{ background: "var(--gold)", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 }}>Save</button>
                  <button onClick={() => setEditingBudget(false)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text2)", cursor: "pointer", flexShrink: 0 }}>✕</button>
                </div>
              </div>
            );
            if (!budget) return (
              <button onClick={() => { setBudgetInput(""); setEditingBudget(true); }}
                style={{ width: "100%", marginBottom: 10, padding: "9px 12px", background: "none", border: "1px dashed var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                + Set Monthly Budget
              </button>
            );
            const pct = Math.min(100, Math.round((thisMonthSpent / budget) * 100));
            const remaining = budget - thisMonthSpent;
            const over = remaining < 0;
            const barColor = pct >= 100 ? "var(--red)" : pct >= 80 ? "#FF9F0A" : "var(--green)";
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: 0.5, textTransform: "uppercase" }}>Monthly Budget</div>
                  <button onClick={() => { setBudgetInput(String(budget)); setEditingBudget(true); }}
                    style={{ background: "none", border: "none", fontSize: 12, color: "var(--text3)", cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}>✎ Edit</button>
                </div>
                <div style={{ height: 8, background: "var(--bg)", borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 6, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: over ? "var(--red)" : barColor }}>
                    {over ? `Over by ${fmt(Math.abs(remaining))}` : `${fmt(remaining)} left`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{pct}% of {fmt(budget)}</div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => router.push("/expenses")}
              style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit" }}>
              View all expenses →
            </button>
          </div>
        </Card>
      )}

      {/* ── DAILY TIP ── */}
      <div className="fade-up" style={{ background: "linear-gradient(135deg,#FEF9C3,#FEF3C7)", border: "1px solid #FDE68A", borderRadius: 16, padding: "14px 16px", marginBottom: 22, animationDelay: "0.2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#92400E", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>💡 Daily Tip</div>
            <div style={{ fontSize: 13, color: "#78350F", lineHeight: 1.6, fontWeight: 500 }}>{tip}</div>
          </div>
          <button onClick={rotateTip}
            style={{ background: "rgba(146,64,14,.1)", border: "1px solid rgba(146,64,14,.2)", borderRadius: 20, padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "#92400E", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>
            ↻ Next
          </button>
        </div>
      </div>

      {/* ── LATEST DEALS ── */}
      <div className="fade-up" style={{ marginBottom: 22, animationDelay: "0.24s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>🔥 Latest Deals</div>
          <button onClick={() => router.push("/deals")}
            style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit" }}>
            View all →
          </button>
        </div>

        {/* Horizontal scroll card row */}
        <div className="hb-deals-row">
          {loadingDeals && [...Array(4)].map((_, i) => (
            <div key={i} style={{ flexShrink: 0, width: 152, background: "var(--surf)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow)" }}>
              <Skeleton h={90} w="100%" radius={0} />
              <div style={{ padding: "10px 12px" }}>
                <Skeleton h={13} w="80%" style={{ marginBottom: 6 }} />
                <Skeleton h={11} w="55%" style={{ marginBottom: 8 }} />
                <Skeleton h={16} w="40%" />
              </div>
            </div>
          ))}

          {!loadingDeals && deals.length === 0 && (
            <div style={{ flex: 1, textAlign: "center", padding: "28px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏷️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No deals yet</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>Be the first to post a deal from a store flyer</div>
              <button onClick={() => router.push("/post-deal")}
                style={{ background: "var(--gold)", border: "none", borderRadius: 20, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                📷 Post First Deal
              </button>
            </div>
          )}

          {!loadingDeals && deals.map((item) => {
            const color = STORE_COLORS[item.brand?.slug] || "#FF9F0A";
            const sav = item.regular_price ? Math.round((1 - item.price / item.regular_price) * 100) : null;
            const catIcon = CATEGORY_ICONS[item.category] || "🛒";
            return (
              <div key={item.id} className="hb-deal-card" onClick={() => router.push("/deals")} role="button" tabIndex={0}
                onKeyDown={e => e.key === "Enter" && router.push("/deals")}>
                {/* Image / icon area */}
                <div style={{ height: 88, background: `linear-gradient(135deg,${color}18,${color}35)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, position: "relative" }}>
                  <span style={{ fontSize: 34 }}>{catIcon}</span>
                  {sav && (
                    <div style={{ position: "absolute", top: 8, right: 8, background: "var(--green)", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px" }}>-{sav}%</div>
                  )}
                </div>
                {/* Card body */}
                <div style={{ padding: "10px 11px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 7 }}>{item.brand?.name || "—"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--gold)" }}>${item.price?.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", background: "var(--bg)", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>{item.category}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LAST BILL ── */}
      {recentItems.length > 0 && (
        <div className="fade-up" style={{ marginBottom: 22, animationDelay: "0.28s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              🛍️ Last Bill — <span style={{ color: "var(--text2)", fontWeight: 600 }}>{recentItems[0]?.store}</span>
            </div>
            <button onClick={() => router.push("/stock")}
              style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit" }}>
              View all →
            </button>
          </div>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {recentItems.map((item: any, i: number) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < recentItems.length - 1 ? "0.5px solid var(--border2)" : "none" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,159,10,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {CATEGORY_ICONS[item.category] || "🛒"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{item.category}</div>
                </div>
                <span style={{ background: "var(--bg)", color: "var(--text2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>× {item.quantity}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="fade-up" style={{ animationDelay: "0.32s", borderTop: "1px solid var(--border2)", paddingTop: 18, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
          © {new Date().getFullYear()} KnowBoth.AI — Smart grocery tracking for your community
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          {[{ l: "Privacy", h: "/privacy" }, { l: "Feedback", h: "mailto:dineshraina.94@gmail.com" }, { l: "Deals", h: "/deals" }, { l: "Scan Bill", h: "/scan" }].map(lnk => (
            <a key={lnk.l} href={lnk.h} style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none", fontWeight: 500 }}>{lnk.l}</a>
          ))}
        </div>
      </footer>
    </HomeTemplate>
  );
}
