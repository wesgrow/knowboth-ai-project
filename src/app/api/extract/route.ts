import { NextResponse } from "next/server";
import { extractFromImage, extractFromUrl } from "@/lib/claude";
export async function POST(req: Request) {
  try {
    const { b64, mime, url, store } = await req.json();
    let result;
    if(url) result = await extractFromUrl(url, store||"Unknown");
    else if(b64) result = await extractFromImage(b64, mime, store||"Unknown");
    else return NextResponse.json({error:"Missing input"},{status:400});
    return NextResponse.json(result);
  } catch(e:any) {
    return NextResponse.json({error:e.message},{status:500});
  }
}
