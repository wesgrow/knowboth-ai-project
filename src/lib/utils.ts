export function getFreshness(lastUpdated: string | null) {
  if (!lastUpdated) return { label: "Unknown", level: 4 };
  const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000);
  if (days === 0) return { label: "Fresh · Today", level: 0 };
  if (days === 1) return { label: "Good · Yesterday", level: 1 };
  if (days === 2) return { label: "Fair · 2d ago", level: 2 };
  if (days <= 5) return { label: `Stale · ${days}d ago`, level: 3 };
  return { label: `Unverified · ${days}d`, level: 4 };
}
export function getLevel(points: number): string {
  if (points >= 1000) return "✦ Legend";
  if (points >= 500) return "🏆 Hero";
  if (points >= 300) return "⭐ Expert";
  if (points >= 150) return "🎯 Hunter";
  if (points >= 50) return "👀 Spotter";
  return "🌱 Newcomer";
}
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
export const STORE_COLORS: Record<string, string> = {
  "patel-brothers": "#4caf72","india-bazaar": "#9b6fe8",
  "apna-bazar": "#e08918","swadesh-grocery": "#5b9dee","india-grocery-spices": "#e05c6e",
};
export const CAT_ICONS: Record<string, string> = {
  Vegetables:"🥬",Fruits:"🍎",Dairy:"🥛","Rice & Grains":"🌾","Lentils & Dals":"🫘",
  Spices:"🌶️",Snacks:"🍪",Beverages:"☕","Oils & Ghee":"🫙",Frozen:"🧊",
  Bakery:"🍞","Meat & Fish":"🐟",Household:"🏠",Other:"🛒",
  Grocery:"🛒",Gas:"⛽",Restaurant:"🍽️",Pharmacy:"💊",Clothing:"👗",
  Home:"🏠",Entertainment:"🎉",Medical:"🏥",Electronics:"📱",
};
