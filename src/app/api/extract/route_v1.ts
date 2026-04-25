import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { store, b64, mime, url } = await req.json();

    const content: any[] = [];
    if (b64 && mime) {
      content.push({ type:"image", source:{ type:"base64", media_type:mime, data:b64 } });
    }
    content.push({ type:"text", text:`Extract ALL deal items from this grocery flyer for store: ${store}.
Category must be one of: Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Bakery, Meat & Fish, Household, Other.
Return ONLY a raw JSON object with no markdown, no backticks, no explanation:
{"items":[{"name":"Product name with size","normalized_name":"lowercase name","price":4.99,"regular_price":6.99,"unit":"bag","category":"Lentils & Dals","notes":""}]}
${url ? `URL: ${url}` : ""}` });

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
        messages: [{ role:"user", content }]
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude API error");

    let text = data.content?.[0]?.text || "";
text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
text = text.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error("No JSON found in response");
const parsed = JSON.parse(jsonMatch[0]);
return NextResponse.json({ items: parsed.items || [] });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
