import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartItem { id:string;name:string;price:number;unit:string;store:string;store_slug?:string;store_id?:string;category:string;icon:string;qty:number;purchased:boolean;notes?:string;manually_added?:boolean; }
export type { CartItem };
interface PantryItem { id:string;name:string;price:number;unit:string;store:string;category:string;icon:string;qty:number;purchaseDate:string; }
interface User { name:string;avatar:string;zip:string;city:string;currency:string;theme:"dark"|"light"|"auto";points:number; }

interface AppStore {
  user:User|null; cart:CartItem[]; pantry:PantryItem[]; radius:number;
  setUser:(u:User)=>void;
  updateLocation:(zip:string,city:string)=>void;
  updateRadius:(r:number)=>void;
  updateTheme:(t:"dark"|"light"|"auto")=>void;
  setCart:(items:CartItem[])=>void;
  addToCart:(item:Omit<CartItem,"qty"|"purchased">, qty?:number, notes?:string)=>void;
  addCartItemManual:(item:{name:string;store:string;store_id?:string;price:number;qty:number;category:string;notes?:string})=>void;
  removeFromCart:(id:string)=>void;
  updateQty:(id:string,qty:number)=>void;
  updateNotes:(id:string,notes:string)=>void;
  togglePurchased:(id:string)=>void;
  clearCart:()=>void;
  moveToPantry:(item:CartItem)=>void;
  updatePantryQty:(id:string,qty:number)=>void;
  removeFromPantry:(id:string)=>void;
  restockItem:(item:PantryItem)=>void;
  clearUser:()=>void;
}

export const useAppStore = create<AppStore>()(persist((set,get)=>({
  user:null, cart:[], pantry:[], radius:25,
  setUser:(u)=>set({user:u}),
  updateLocation:(zip,city)=>set(s=>({user:s.user?{...s.user,zip,city}:null})),
  updateRadius:(r)=>set({radius:r}),
  updateTheme:(t)=>set(s=>({user:s.user?{...s.user,theme:t}:null})),
  setCart:(items)=>set({cart:items}),
  addToCart:(item,qty=1,notes)=>{const{cart}=get();if(cart.find(i=>i.id===item.id))return;set({cart:[...cart,{...item,qty:Math.max(0.01,qty),purchased:false,notes:notes||item.notes}]});},
  addCartItemManual:(item)=>{const id=`m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;set(s=>({cart:[...s.cart,{id,name:item.name,price:item.price,unit:"ea",store:item.store,store_slug:"",store_id:item.store_id,category:item.category,icon:"🛒",qty:item.qty,purchased:false,notes:item.notes,manually_added:true}]}));},
  removeFromCart:(id)=>set(s=>({cart:s.cart.filter(i=>i.id!==id)})),
  updateQty:(id,qty)=>set(s=>({cart:s.cart.map(i=>i.id===id?{...i,qty:Math.max(0.01,qty)}:i)})),
  updateNotes:(id,notes)=>set(s=>({cart:s.cart.map(i=>i.id===id?{...i,notes}:i)})),
  togglePurchased:(id)=>set(s=>({cart:s.cart.map(i=>i.id===id?{...i,purchased:!i.purchased}:i)})),
  clearCart:()=>set({cart:[]}),
  moveToPantry:(item)=>{
    const{pantry}=get();
    const today=new Date().toISOString().split("T")[0];
    const ex=pantry.find(p=>p.name===item.name);
    if(ex){set(s=>({pantry:s.pantry.map(p=>p.name===item.name?{...p,qty:p.qty+item.qty}:p),cart:s.cart.filter(i=>i.id!==item.id)}));}
    else{set(s=>({pantry:[...s.pantry,{id:item.id,name:item.name,price:item.price,unit:item.unit,store:item.store,category:item.category,icon:item.icon,qty:item.qty,purchaseDate:today}],cart:s.cart.filter(i=>i.id!==item.id)}));}
  },
  updatePantryQty:(id,qty)=>set(s=>({pantry:s.pantry.map(i=>i.id===id?{...i,qty:Math.max(0,qty)}:i)})),
  removeFromPantry:(id)=>set(s=>({pantry:s.pantry.filter(i=>i.id!==id)})),
  restockItem:(item)=>{
    const{cart}=get();
    const ex=cart.find(i=>i.name===item.name&&!i.purchased);
    if(ex){set(s=>({cart:s.cart.map(i=>i.name===item.name&&!i.purchased?{...i,qty:i.qty+1}:i)}));}
    else{set(s=>({cart:[...s.cart,{id:Date.now().toString(),name:item.name,price:item.price,unit:item.unit,store:item.store,store_slug:"",category:item.category,icon:item.icon,qty:1,purchased:false}]}));}
  },
  clearUser:()=>set({user:null}),
}),{
  name:"knowboth-v1",
  partialize:(state)=>({ cart:state.cart, pantry:state.pantry, radius:state.radius }),
}));
