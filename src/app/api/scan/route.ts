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
            { type: "text", text: `Extract all items from this receipt/bill. Support any language, any currency, any store type.
You MUST respond with ONLY valid JSON. No explanation, no markdown, no backticks.
{"store_name":"Store Name","store_city":"City","store_zip":"12345","purchase_date":"YYYY-MM-DD","currency":"USD","total":45.99,"items":[{"name":"Item Name","price":4.99,"quantity":1,"unit":"ea","category":"Grocery"}]}
Categories: Grocery, Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Meat & Fish, Bakery, Gas, Restaurant, Pharmacy, Household, Electronics, Other
If currency is not USD, still extract prices as numbers. Include all line items.` }
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
