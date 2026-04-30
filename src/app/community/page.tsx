"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { supabase, supabaseAuth } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { CommunityTemplate } from "@/templates/CommunityTemplate";
import { Button, Card, Skeleton } from "@/ui";

interface Deal {
  id: string;
  brand: { name: string; slug: string; };
  location?: { branch_name: string; city: string; };
  posted_by: string;
  flyer_image_url: string | null;
  description: string | null;
  sale_end: string | null;
  created_at: string;
  items: any[];
  likes: number;
  comments: number;
  userLiked: boolean;
  posterName: string;
  posterAvatar: string;
}

const STORE_COLORS: Record<string,string> = {
  "patel-brothers":"#4caf72","india-bazaar":"#9b6fe8","apna-bazar":"#e08918",
  "swadesh-grocery":"#5b9dee","india-grocery-spices":"#e05c6e","india-cash-carry":"#e05c6e",
};

export default function CommunityPage() {
  const router = useRouter();
  const { user, addToCart, cart } = useAppStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState<Record<string,string>>({});
  const [showComments, setShowComments] = useState<Record<string,boolean>>({});
  const [comments, setComments] = useState<Record<string,any[]>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string,boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string|null>(null);

  useEffect(() => { fetchCurrentUser(); fetchDeals(); }, []);

  async function fetchCurrentUser() {
    const { data:{ session } } = await supabaseAuth.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
  }

  async function fetchDeals() {
    setLoading(true);
    const { data: dealRows } = await supabase
      .from("deals")
      .select("id,brand_id,location_id,posted_by,flyer_image_url,description,sale_end,created_at,applies_to_all_locations")
      .eq("status","approved").order("created_at",{ascending:false}).limit(20);

    if (!dealRows?.length) { setLoading(false); return; }

    const dealIds  = dealRows.map((d:any)=>d.id);
    const brandIds = [...new Set(dealRows.map((d:any)=>d.brand_id).filter(Boolean))];
    const locIds   = [...new Set(dealRows.map((d:any)=>d.location_id).filter(Boolean))];

    const [{ data: brands },{ data: items },{ data: likes },{ data: commentCounts }] = await Promise.all([
      supabase.from("brands").select("id,name,slug").in("id",brandIds as string[]),
      supabase.from("deal_items").select("id,deal_id,name,price,unit,category").in("deal_id",dealIds).order("price",{ascending:true}),
      supabase.from("deal_likes").select("deal_id,user_id").in("deal_id",dealIds),
      supabase.from("deal_comments").select("deal_id").in("deal_id",dealIds),
    ]);

    const { data: locs } = locIds.length>0
      ? await supabase.from("store_locations").select("id,branch_name,city").in("id",locIds as string[])
      : { data:[] };

    const bMap:Record<string,any>={};(brands||[]).forEach((b:any)=>{bMap[b.id]=b;});
    const locMap:Record<string,any>={};(locs||[]).forEach((l:any)=>{locMap[l.id]=l;});
    const itemMap:Record<string,any[]>={};
    (items||[]).forEach((i:any)=>{if(!itemMap[i.deal_id])itemMap[i.deal_id]=[];itemMap[i.deal_id].push(i);});
    const likeMap:Record<string,any[]>={};
    (likes||[]).forEach((l:any)=>{if(!likeMap[l.deal_id])likeMap[l.deal_id]=[];likeMap[l.deal_id].push(l);});
    const commentMap:Record<string,number>={};
    (commentCounts||[]).forEach((c:any)=>{commentMap[c.deal_id]=(commentMap[c.deal_id]||0)+1;});

    const { data:{ session } } = await supabaseAuth.auth.getSession();
    const userId = session?.user?.id;

    setDeals(dealRows.map((d:any)=>({
      id:d.id, brand:bMap[d.brand_id]||{name:"Unknown Store",slug:""},
      location:locMap[d.location_id], posted_by:d.posted_by,
      flyer_image_url:d.flyer_image_url, description:d.description,
      sale_end:d.sale_end, created_at:d.created_at,
      items:(itemMap[d.id]||[]).slice(0,5),
      likes:(likeMap[d.id]||[]).length,
      comments:commentMap[d.id]||0,
      userLiked:userId?(likeMap[d.id]||[]).some((l:any)=>l.user_id===userId):false,
      posterName:d.posted_by?`User ${d.posted_by.slice(0,6)}`:"Anonymous",
      posterAvatar:"🧑‍🛒",
    })));
    setLoading(false);
  }

  async function toggleLike(dealId: string, liked: boolean) {
    if (!currentUserId) { toast.error("Sign in to like"); return; }
    if (liked) await supabase.from("deal_likes").delete().eq("deal_id",dealId).eq("user_id",currentUserId);
    else await supabase.from("deal_likes").insert({deal_id:dealId,user_id:currentUserId});
    setDeals(prev=>prev.map(d=>d.id===dealId?{...d,likes:liked?d.likes-1:d.likes+1,userLiked:!liked}:d));
  }

  async function loadComments(dealId: string) {
    const { data } = await supabase.from("deal_comments").select("id,comment,user_id,created_at").eq("deal_id",dealId).order("created_at",{ascending:true});
    setComments(prev=>({...prev,[dealId]:data||[]}));
    setShowComments(prev=>({...prev,[dealId]:!prev[dealId]}));
  }

  async function postComment(dealId: string) {
    const text = commentText[dealId]?.trim();
    if (!text) return;
    if (!currentUserId) { toast.error("Sign in to comment"); return; }
    await supabase.from("deal_comments").insert({deal_id:dealId,user_id:currentUserId,comment:text});
    setCommentText(prev=>({...prev,[dealId]:""}));
    setDeals(prev=>prev.map(d=>d.id===dealId?{...d,comments:d.comments+1}:d));
    loadComments(dealId);
    toast.success("Comment posted!");
  }

  function addAllToCart(deal: Deal) {
    let added = 0;
    deal.items.forEach(item=>{
      if (!cart.find(c=>c.id===item.id)) {
        addToCart({id:item.id,name:item.name,price:item.price,unit:item.unit||"ea",store:deal.brand.name,store_slug:deal.brand.slug,category:item.category||"Other",icon:"🛒"});
        added++;
      }
    });
    toast.success(`✦ ${added} items added from ${deal.brand.name}`);
  }

  function daysLeft(saleEnd: string|null) {
    if (!saleEnd) return null;
    return Math.ceil((new Date(saleEnd).getTime()-Date.now())/86400000);
  }
  function timeAgo(ts: string) {
    const m = Math.floor((Date.now()-new Date(ts).getTime())/60000);
    if (m<60) return `${m}m ago`;
    const h = Math.floor(m/60);
    if (h<24) return `${h}h ago`;
    return `${Math.floor(h/24)}d ago`;
  }
  function share(deal: Deal) {
    const text = `🏷️ ${deal.brand.name} has ${deal.items.length} deals!\nTop: ${deal.items[0]?.name} for $${deal.items[0]?.price?.toFixed(2)}\nFind more on KNOWBOTH.AI`;
    if (typeof navigator!=="undefined"&&typeof navigator.share==="function") navigator.share({title:"Deal Alert!",text});
    else { navigator.clipboard.writeText(text); toast.success("Copied to clipboard!"); }
  }

  return (
    <CommunityTemplate>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,color:"var(--text)",letterSpacing:-0.8}}>Community</h1>
          <p style={{fontSize:13,color:"var(--text2)",marginTop:3}}>Latest deals posted by the community</p>
        </div>
        <Button onClick={()=>router.push("/post-deal")} style={{boxShadow:"0 4px 12px rgba(255,159,10,.3)"}}>📷 Post Deal</Button>
      </div>

      {loading&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {[1,2,3].map(i=><Skeleton key={i} h={200} radius={16}/>)}
        </div>
      )}

      {!loading&&deals.length===0&&(
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:44,marginBottom:12}}>🏪</div>
          <div style={{fontSize:16,fontWeight:700,color:"var(--text)",marginBottom:8}}>No posts yet</div>
          <p style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Be the first to post a deal!</p>
          <Button onClick={()=>router.push("/post-deal")} size="lg" style={{boxShadow:"0 4px 12px rgba(255,159,10,.3)"}}>📷 Post First Deal</Button>
        </div>
      )}

      {/* Feed */}
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {deals.map((deal,idx)=>{
          const color = STORE_COLORS[deal.brand.slug]||"#FF9F0A";
          const dl = daysLeft(deal.sale_end);
          const isExpanded = expandedItems[deal.id];
          return (
            <Card key={deal.id} className="fade-up" pad={0} style={{overflow:"hidden",animationDelay:`${idx*0.06}s`}}>

              {/* Post header */}
              <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`1.5px solid ${color}33`}}>
                  {deal.posterAvatar}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{deal.posterName}</span>
                    <span style={{fontSize:11,fontWeight:600,color,background:`${color}15`,borderRadius:20,padding:"2px 8px"}}>{deal.brand.name}</span>
                  </div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                    {deal.location&&<span>📍 {deal.location.branch_name}, {deal.location.city}</span>}
                    <span>{timeAgo(deal.created_at)}</span>
                    {dl!==null&&dl>=0&&<span style={{color:dl<=2?"#FF3B30":"#FF9F0A",fontWeight:600}}>⏰ {dl===0?"Last day!":`${dl}d left`}</span>}
                    {dl!==null&&dl<0&&<span style={{color:"var(--text3)"}}>Expired</span>}
                  </div>
                </div>
                <div style={{fontSize:12,fontWeight:700,color,background:`${color}12`,borderRadius:20,padding:"4px 10px"}}>
                  {deal.items.length}+ deals
                </div>
              </div>

              {/* Flyer */}
              {deal.flyer_image_url&&(
                <div style={{padding:"0 16px 12px"}}>
                  <img src={deal.flyer_image_url} alt="Flyer" style={{width:"100%",borderRadius:12,objectFit:"cover",maxHeight:280,cursor:"pointer"}} onClick={()=>window.open(deal.flyer_image_url!,"_blank")}/>
                </div>
              )}

              {deal.description&&<div style={{padding:"0 16px 12px",fontSize:14,color:"var(--text)",lineHeight:1.5}}>{deal.description}</div>}

              {/* Items */}
              <div style={{margin:"0 16px 12px",background:"var(--bg3)",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"8px 14px",borderBottom:"0.5px solid var(--border2)",fontSize:11,fontWeight:700,color:"var(--text3)",letterSpacing:0.5,textTransform:"uppercase"}}>
                  🔥 Top Deals
                </div>
                {(isExpanded?deal.items:deal.items.slice(0,3)).map((item,i)=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:i<(isExpanded?deal.items.length:Math.min(3,deal.items.length))-1?"0.5px solid var(--border2)":"none"}}>
                    <div style={{width:3,height:28,borderRadius:2,background:color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"var(--text3)"}}>{item.category}</div>
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:"#FF9F0A",flexShrink:0}}>${item.price?.toFixed(2)}<span style={{fontSize:10,color:"var(--text3)",fontWeight:400}}>/{item.unit||"ea"}</span></div>
                  </div>
                ))}
                {deal.items.length>3&&(
                  <button onClick={()=>setExpandedItems(prev=>({...prev,[deal.id]:!prev[deal.id]}))}
                    style={{width:"100%",padding:"9px",background:"none",border:"none",fontSize:12,fontWeight:600,color:"#FF9F0A",cursor:"pointer",borderTop:"0.5px solid var(--border2)",fontFamily:"inherit"}}>
                    {isExpanded?"Show less ▲":`View all ${deal.items.length} deals ▼`}
                  </button>
                )}
              </div>

              {/* Action bar */}
              <div style={{padding:"10px 16px",borderTop:"0.5px solid var(--border2)",display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>toggleLike(deal.id,deal.userLiked)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,border:"none",background:deal.userLiked?"rgba(255,59,48,.1)":"var(--bg)",color:deal.userLiked?"#FF3B30":"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .15s",fontFamily:"inherit"}}>
                  {deal.userLiked?"❤️":"🤍"} {deal.likes}
                </button>
                <button onClick={()=>loadComments(deal.id)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,border:"none",background:showComments[deal.id]?"rgba(10,132,255,.1)":"var(--bg)",color:showComments[deal.id]?"#0A84FF":"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  💬 {deal.comments}
                </button>
                <button onClick={()=>share(deal)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,border:"none",background:"var(--bg)",color:"var(--text2)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  📤 Share
                </button>
                <div style={{flex:1}}/>
                <Button size="sm" onClick={()=>addAllToCart(deal)} style={{borderRadius:20,boxShadow:"0 2px 6px rgba(255,159,10,.3)"}}>🛒 Add All</Button>
              </div>

              {/* Comments */}
              {showComments[deal.id]&&(
                <div style={{borderTop:"0.5px solid var(--border2)",padding:"12px 16px"}}>
                  {(comments[deal.id]||[]).length===0&&<div style={{fontSize:13,color:"var(--text3)",textAlign:"center",padding:"8px 0"}}>No comments yet — be first!</div>}
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
                    {(comments[deal.id]||[]).map((c:any)=>(
                      <div key={c.id} style={{display:"flex",gap:10}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🧑</div>
                        <div style={{flex:1}}>
                          <div style={{background:"var(--bg3)",borderRadius:"0 12px 12px 12px",padding:"8px 12px"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:3}}>User {c.user_id?.slice(0,6)}</div>
                            <div style={{fontSize:13,color:"var(--text)"}}>{c.comment}</div>
                          </div>
                          <div style={{fontSize:10,color:"var(--text3)",marginTop:3,paddingLeft:4}}>{timeAgo(c.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,159,10,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                      {user?.avatar||"🧑"}
                    </div>
                    <div style={{flex:1,display:"flex",gap:6}}>
                      <input
                        style={{flex:1,background:"var(--bg)",border:"none",borderRadius:20,padding:"8px 14px",fontSize:16,color:"var(--text)",outline:"none"}}
                        value={commentText[deal.id]||""} onChange={e=>setCommentText(prev=>({...prev,[deal.id]:e.target.value}))}
                        placeholder="Write a comment..." onKeyDown={e=>e.key==="Enter"&&postComment(deal.id)}
                        aria-label="Comment input"
                      />
                      <Button size="sm" onClick={()=>postComment(deal.id)} style={{borderRadius:20}}>Post</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </CommunityTemplate>
  );
}
