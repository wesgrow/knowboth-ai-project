import { NextResponse } from "next/server";

const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg","image/jpg","image/png","image/webp","image/gif","application/pdf"];
const VALID_CATEGORIES = ["Grocery","Vegetables","Fruits","Dairy","Rice & Grains","Lentils & Dals","Spices","Snacks","Beverages","Oils & Ghee","Frozen","Meat & Fish","Bakery","Gas","Restaurant","Pharmacy","Household","Electronics","Other"];
const VALID_UNITS = ["lb","kg","oz","g","L","ml","bag","pack","box","bottle","jar","bunch","dozen","ea","gallon","pint","quart","count","roll","sheet","pair","set"];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${ms/1000}s`)), ms)),
  ]);
}

function extractJSON(text: string): any {
  if (!text?.trim()) throw new Error("Empty AI response");
  let c = text.replace(/```json/gi,"").replace(/```/g,"").trim();
  c = c.replace(/[\u0000-\u001F\u007F-\u009F]/g,"");
  c = c.replace(/,(\s*[}\]])/g,"$1");
  const s = c.indexOf("{"), e = c.lastIndexOf("}");
  if (s === -1 || e === -1 || s >= e) throw new Error("No valid JSON in AI response");
  try { return JSON.parse(c.substring(s, e+1)); }
  catch (err: any) { throw new Error(`JSON parse error: ${err.message}`); }
}

function normalizeUnit(unit: string, name: string): string {
  if (!unit) return inferUnitFromName(name);
  const u = unit.toLowerCase().trim();
  // Weight
  if (["lb","lbs","pound","pounds"].includes(u)) return "lb";
  if (["kg","kilogram","kilograms"].includes(u)) return "kg";
  if (["oz","ounce","ounces"].includes(u)) return "oz";
  if (["g","gram","grams"].includes(u)) return "g";
  // Volume
  if (["l","liter","liters","litre","litres"].includes(u)) return "L";
  if (["ml","milliliter","milliliters"].includes(u)) return "ml";
  if (["gal","gallon","gallons"].includes(u)) return "gallon";
  if (["pt","pint"].includes(u)) return "pint";
  if (["qt","quart"].includes(u)) return "quart";
  // Packaging
  if (["bag","bags"].includes(u)) return "bag";
  if (["pack","packs","packet","packets","pk"].includes(u)) return "pack";
  if (["box","boxes","bx"].includes(u)) return "box";
  if (["bottle","bottles","btl"].includes(u)) return "bottle";
  if (["jar","jars"].includes(u)) return "jar";
  if (["bunch","bunches"].includes(u)) return "bunch";
  if (["dozen","doz","dz"].includes(u)) return "dozen";
  if (["roll","rolls"].includes(u)) return "roll";
  if (["ct","count","pc","pcs","piece","pieces","each","ea"].includes(u)) return "ea";
  // Try to infer from name if unit is unrecognized
  return inferUnitFromName(name);
}

function inferUnitFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\d+\s*lb/.test(n)) return "lb";
  if (/\d+\s*kg/.test(n)) return "kg";
  if (/\d+\s*oz/.test(n)) return "oz";
  if (/\d+\s*l\b/.test(n)) return "L";
  if (/\d+\s*ml/.test(n)) return "ml";
  if (/\d+\s*g\b/.test(n)) return "g";
  if (/bag|bags/.test(n)) return "bag";
  if (/bottle|btl/.test(n)) return "bottle";
  if (/pack|pk/.test(n)) return "pack";
  if (/box|bx/.test(n)) return "box";
  if (/jar/.test(n)) return "jar";
  if (/bunch/.test(n)) return "bunch";
  if (/dozen|doz/.test(n)) return "dozen";
  return "ea";
}

function cleanStr(v: any): string {
  return String(v||"").replace(/[\n\r\t]+/g," ").replace(/\s{2,}/g," ").trim();
}

function cleanPrice(v: any): number {
  return Math.max(0, parseFloat(String(v||"").replace(/[$,₹€£\s]/g,"")) || 0);
}

function sanitizeItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter(i => i && typeof i === "object")
    .map((item, idx) => {
      const name = cleanStr(item.name || `Item ${idx+1}`).slice(0,200);
      const unitPrice = cleanPrice(item.unit_price) || cleanPrice(item.price);
      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      const discount = cleanPrice(item.discount);
      const rawActual = cleanPrice(item.actual_price) || cleanPrice(item.price) || (unitPrice * quantity);
      const actualPrice = Math.max(0, rawActual - discount);
      const unit = normalizeUnit(cleanStr(item.unit), name);
      const category = VALID_CATEGORIES.includes(item.category) ? item.category : "Other";
      return { name, unit_price: unitPrice, actual_price: actualPrice, quantity, unit, category, discount };
    })
    .filter(i => i.name.length > 0);
}

async function callClaude(b64: string, mime: string, attempt = 1): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  try {
    const res = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        messages: [{
          role: "user",
          content: [
            { type:"image", source:{ type:"base64", media_type:mime, data:b64 } },
            { type:"text", text:`You are an expert grocery receipt scanner. Follow every rule exactly.

━━━ STEP 1 — CLASSIFY ━━━
Is this a receipt, bill, or invoice from a store/restaurant/service?
- NO (selfie, ID, passport, blank, screenshot): return ONLY {"is_receipt":false}
- YES: continue to Step 2.

━━━ STEP 2 — READ RAW TEXT FIRST ━━━
Before extracting any field, read each item line exactly as printed. Note the raw text.
Then apply the rules below to produce clean output.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON — no markdown, no explanation:
{"is_receipt":true,"store_name":"","store_city":"","store_zip":"","bill_number":"","purchase_date":"YYYY-MM-DD","currency":"USD","total":0.00,"items":[{"raw_name":"","name":"","unit_price":0.00,"actual_price":0.00,"quantity":1,"unit":"","category":"","discount":0.00}]}

━━━ RULE 1 — ITEM NAME (most important) ━━━
A. Read the raw text verbatim first, store it in "raw_name".
B. Expand abbreviations ONLY if you are ≥90% certain. If uncertain, keep the original text.
   WRONG approach: guess a plausible word. RIGHT approach: leave the abbreviation as-is.
   Example: "GV WHOLE HG" — if unsure what HG means, output "GV Whole HG", NOT "Great Value Whole Hog".

C. KNOWN STORE BRAND CODES (expand these confidently):
   GV → Great Value (Walmart)      KR → Kroger brand
   SE → Simple Enjoy               SF → Signature Select (Safeway)
   KS → Kirkland Signature         NV → Nice! (Walgreens)
   GE → Great Eats                 WM → Walmart store
   PL → Private Label              OB → O Organics

D. KNOWN SIZE/UNIT CODES (expand these confidently):
   HG / HF GAL → Half Gallon       1G / 1GL / GL → 1 Gallon
   QT → Quart                      PT → Pint
   LB / LBS → lb                   OZ → oz
   KG → kg                         ML → ml
   CT / CNT → count                PK / PKG → pack
   BT / BTL → bottle               JR → jar
   BG → bag                        DZ → dozen

E. KNOWN PRODUCT ABBREVIATIONS (expand these confidently):
   MLK / MK → Milk                 ORG / ORGN → Organic
   WHL / WH → Whole                FF → Fat Free
   2% / LF → 2% / Low Fat         SK → Skim
   CHK / CKN / CHKN → Chicken     BF → Beef
   TRK → Turkey                   PK → Pork
   GRN → Green                    VEG → Vegetable
   FRZ / FRN → Frozen             FRSH → Fresh
   YO / YOG → Yogurt              CHZ / CHS → Cheese
   BTR → Butter                   EGG → Eggs
   BRD → Bread                    JUC / JC → Juice
   WTR → Water                    SOD → Soda
   DAL / DL → Dal                 RCE / RC → Rice
   ATT / ATTA → Atta (wheat flour) GHE → Ghee
   MSR / MSTR → Mustard           TOM → Tomatoes
   POT → Potatoes                 BAN → Bananas
   APP → Apples                   ONG → Onions

F. NOISE TO STRIP from item names (do not include in name):
   - Leading PLU/barcode numbers (5–13 digits)
   - Trailing single letters that are tax codes: F, T, N, E, O, A, B
   - Asterisk (*) prefix — just means weekly special
   - Department codes like "D1", "D2", "GR", "PR" at end of line

━━━ RULE 2 — UNIT OF MEASUREMENT ━━━
Extract the unit from BOTH the product name AND the receipt line.
Priority order: (1) explicit unit in name like "1 GAL", "4 LB", "32 OZ" → use that
               (2) unit code from the lookup above
               (3) "ea" only as absolute last resort
NEVER use "ea" if any weight, volume, or packaging indicator is visible anywhere on that line.

For WEIGHT-PRICED items (format: "1.43 lb @ $0.49/lb  $0.70"):
  quantity = actual weight (1.43), unit = "lb", unit_price = price-per-lb (0.49), actual_price = 0.70

━━━ RULE 3 — PRICES & MATH VERIFICATION ━━━
- unit_price = price for ONE unit (after any per-unit deal)
- actual_price = line total charged BEFORE discount
- discount = saving applied to this line (0 if none, always positive)
- VERIFY: unit_price × quantity must equal actual_price (within $0.02).
  If it does not match, re-read the line — you have the wrong quantity or misread a digit.
  Fix it before outputting.

━━━ RULE 4 — MULTI-BUY DEALS (X for $Y) ━━━
"2 for $1"   → unit_price=0.50, quantity=2, actual_price=1.00
"3 for $5"   → unit_price=1.67, quantity=3, actual_price=5.00
"7 for $1"   → unit_price=0.14, quantity=7, actual_price=1.00
If only 1 unit bought at deal price: quantity=1, unit_price=deal_total/deal_count, actual_price=unit_price

━━━ RULE 5 — DISCOUNTS ━━━
Lines like "DISC", "SAVE", "MEMBER SAVINGS", "COUPON", "LOYALTY", negative amounts:
- Attach to the item directly above it
- discount = the saving amount as a positive number
- Do NOT create a separate line item for the discount

━━━ RULE 6 — RECEIPT LAYOUT ━━━
Identify the format before parsing:
- Format A: ITEM  QTY  UNIT_PRICE  TOTAL on one line
- Format B: Item name line 1 / QTY × PRICE on line 2
- Format C: Single price per line, no explicit quantity (quantity=1)
Apply the same format rule consistently across all items.

━━━ RULE 7 — CATEGORY ━━━
Exactly one of: Grocery, Vegetables, Fruits, Dairy, Rice & Grains, Lentils & Dals, Spices, Snacks, Beverages, Oils & Ghee, Frozen, Meat & Fish, Bakery, Gas, Restaurant, Pharmacy, Household, Electronics, Other

━━━ RULE 8 — OTHER FIELDS ━━━
- total: final receipt total after all discounts and tax
- bill_number: receipt/transaction number, "" if not visible
- purchase_date: YYYY-MM-DD format
- Include ALL product lines. Skip tax lines, subtotal lines, total summary lines.

━━━ PII — NEVER CAPTURE ━━━
Customer name, loyalty member name, cashier name, card numbers (VISA ****1234), CVV, PINs, loyalty card IDs, customer phone, customer address.
Store name, store address, store phone are fine.` }
          ]
        }]
      }),
    }), TIMEOUT_MS);

    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      const msg = err?.error?.message || `HTTP ${res.status}`;
      if ((res.status===529||res.status===500) && attempt<=MAX_RETRIES) {
        await new Promise(r=>setTimeout(r,1000*attempt));
        return callClaude(b64, mime, attempt+1);
      }
      throw new Error(`Claude API: ${msg}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text) throw new Error("Empty Claude response");
    return text;
  } catch(e: any) {
    if (attempt<=MAX_RETRIES && (e.message.includes("fetch")||e.message.includes("network")||e.message.includes("timed out"))) {
      await new Promise(r=>setTimeout(r,1000*attempt));
      return callClaude(b64, mime, attempt+1);
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    let body: any;
    try { body = await req.json(); }
    catch { return NextResponse.json({error:"Invalid JSON body"},{status:400}); }

    const { b64, mime } = body;

    if (!b64||typeof b64!=="string"||b64.trim().length===0)
      return NextResponse.json({error:"Missing image data (b64)"},{status:400});
    if (!mime||typeof mime!=="string")
      return NextResponse.json({error:"Missing MIME type"},{status:400});
    if (!ALLOWED_MIME_TYPES.includes(mime.toLowerCase()))
      return NextResponse.json({error:`Unsupported file type: ${mime}`},{status:400});
    const approxBytes = (b64.length*3)/4;
    if (approxBytes>MAX_FILE_SIZE)
      return NextResponse.json({error:`File too large (${Math.round(approxBytes/1024/1024)}MB). Max 10MB.`},{status:400});

    const rawText = await callClaude(b64, mime);
    const parsed = extractJSON(rawText);

    if (parsed.is_receipt === false)
      return NextResponse.json({error:"This doesn't look like a receipt or bill. Please upload a store receipt, invoice, or bill."},{status:422});

    const items = sanitizeItems(parsed.items||[]);

    if (items.length===0)
      return NextResponse.json({error:"No items found. Please try a clearer image."},{status:422});

    // Calculate items total
    const itemsTotal = items.reduce((s,i)=>s+(i.actual_price),0);
    const receiptTotal = Math.max(0, parseFloat(parsed.total)||0);

    // Validate total — flag if mismatch > 5%
    const totalMismatch = receiptTotal > 0
      ? Math.abs(receiptTotal - itemsTotal) / receiptTotal > 0.05
      : false;

    return NextResponse.json({
      store_name: String(parsed.store_name||"Unknown Store").trim().slice(0,200),
      store_city: String(parsed.store_city||"").trim().slice(0,100),
      store_zip: String(parsed.store_zip||"").trim().slice(0,20),
      bill_number: String(parsed.bill_number||"").trim().slice(0,100),
      purchase_date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchase_date)
        ? parsed.purchase_date
        : new Date().toISOString().split("T")[0],
      currency: ["USD","CAD","GBP","EUR","INR","AUD"].includes(parsed.currency) ? parsed.currency : "USD",
      total: receiptTotal || itemsTotal,
      items_total: parseFloat(itemsTotal.toFixed(2)),
      total_mismatch: totalMismatch,
      items,
    });

  } catch(e: any) {
    console.error("Scan API error:", e);
    const msg = e.message||"Unknown error";
    if (msg.includes("timed out")) return NextResponse.json({error:"Scan timed out. Try a smaller image."},{status:504});
    if (msg.includes("API key")||msg.includes("configured")) return NextResponse.json({error:"AI service not configured."},{status:503});
    if (msg.includes("JSON")) return NextResponse.json({error:"Could not read receipt. Try a clearer image."},{status:422});
    return NextResponse.json({error:`Scan failed: ${msg}`},{status:500});
  }
}
