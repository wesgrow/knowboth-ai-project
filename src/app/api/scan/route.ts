import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { b64, mime } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
            { type: "text", text: `Extract all items from this receipt/bill. Support any language, any currency, any store.
Return ONLY valid JSON, no markdown, no backticks:
{"store_name":"Store Name","store_city":"City","store_zip":"12345","purchase_date":"YYYY-MM-DD","currency":"USD","total":45.99,"items":[{"name":"Toor Dal 4lb","unit_price":4.99,"actual_price":9.98,"quantity":2,"unit":"bag","category":"Lentils & Dals"}]}

Rules:
- unit_price = price per single unit (used for price comparison)
- actual_price = total charged for this line item = unit_price x quantity (used for expense tracking)
- If only one price visible, use it for both unit_price and actual_price
- quantity = number of units purchased (integer)
- unit = measurement unit: use "lb" for pounds, "kg" for kilograms, "oz" for ounces, "L" for liters, "ml" for milliliters, "bag" for bags, "pack" for packs, "box" for boxes, "bottle" for bottles, "bunch" for bunches, "dozen" for eggs/dozen items, "ea" only when no clear unit applies
- name = full descriptive product name — always expand abbreviations and short codes. Examples: "T DAL 4LB" → "Toor Dal 4lb", "BAS RCE 20L" → "Basmati Rice 20lb", "CHK BRST" → "Chicken Breast", "AML GHE 1L" → "Amul Ghee 1L", "PTL ATTA 20" → "Patel Chakki Atta 20lb". Always include brand name and size/weight if visible on receipt.
- category must be exactly one of: Grocery, Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Meat & Fish, Bakery, Gas, Restaurant, Pharmacy, Household, Electronics, Other
- Include ALL line items from the receipt — do not skip any
- Remove trailing commas from JSON output` }
          ]
        }]
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude API error");

    let text = data.content?.[0]?.text || "";
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    text = text.replace(/,(\s*[}\]])/g, "$1");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response");
    const parsed = JSON.parse(text.substring(start, end + 1));

    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
