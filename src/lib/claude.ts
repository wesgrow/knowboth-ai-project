const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function call(messages: any[], system: string, max = 2000) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

export async function extractFromImage(b64: string, mime: string, store: string) {
  const sys = `Extract grocery deals from flyer. Return ONLY valid JSON no markdown:
{"store":"","items":[{"name":"","normalized_name":"","price":0,"regular_price":null,"unit":"","category":"Vegetables|Fruits|Dairy|Rice & Grains|Lentils & Dals|Spices|Snacks|Beverages|Oils & Ghee|Frozen|Bakery|Meat & Fish|Household|Other","notes":null}]}`;
  const text = await call([{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:`Store: ${store}. Extract all deals.`}]}], sys, 2500);
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

export async function extractFromUrl(url: string, store: string) {
  const sys = `Extract grocery deals from webpage. Return ONLY valid JSON no markdown:
{"store":"","items":[{"name":"","normalized_name":"","price":0,"regular_price":null,"unit":"","category":"Vegetables|Fruits|Dairy|Rice & Grains|Lentils & Dals|Spices|Snacks|Beverages|Oils & Ghee|Frozen|Bakery|Meat & Fish|Household|Other","notes":null}]}`;
  const text = await call([{role:"user",content:`Store: ${store}. URL: ${url}. Extract all grocery deals.`}], sys, 2500);
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

export async function scanBill(b64: string, mime: string) {
  const sys = `Extract all items from receipt. Return ONLY valid JSON no markdown:
{"store_name":"","store_address":"","store_city":"","store_zip":"","store_country":"","purchase_date":"YYYY-MM-DD","currency":"USD","items":[{"name":"","normalized_name":"","price":0,"unit":"","quantity":1,"category":"Grocery|Gas|Restaurant|Pharmacy|Clothing|Home|Entertainment|Medical|Electronics|Other"}],"subtotal":0,"tax":0,"total":0}`;
  const text = await call([{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:"Extract all items from this receipt."}]}], sys, 2000);
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}
