import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const item = searchParams.get("item")||"";
  const { data } = await supabase.from("deal_items")
    .select(`id,name,price,unit,deals!inner(status,brands(name,slug),store_locations(branch_name,city,zip))`)
    .ilike("normalized_name",`%${item}%`)
    .eq("deals.status","approved")
    .order("price",{ascending:true})
    .limit(5);
  return NextResponse.json({data:data||[]});
}
