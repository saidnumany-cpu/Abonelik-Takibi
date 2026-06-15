import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Search, Wallet, Bell, CalendarDays, Download, CreditCard,
  PieChart, ListFilter, Smartphone, Laptop, AlertTriangle, Sparkles, LogIn,
  LogOut, Cloud, CloudOff, Upload, RotateCcw
} from "lucide-react";
import { auth, db, googleProvider, firebaseReady } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const platformMap = {
  netflix:{icon:"N",color:"#e50914",category:"Film/Dizi"}, spotify:{icon:"♬",color:"#1db954",category:"Müzik"},
  icloud:{icon:"☁",color:"#60a5fa",category:"Bulut"}, youtube:{icon:"▶",color:"#ff0033",category:"Video"},
  disney:{icon:"D+",color:"#113ccf",category:"Film/Dizi"}, adobe:{icon:"A",color:"#fa0f00",category:"Tasarım"},
  chatgpt:{icon:"AI",color:"#10a37f",category:"Yapay Zeka"}, ps:{icon:"PS",color:"#006fcd",category:"Oyun"},
  prime:{icon:"P",color:"#00a8e1",category:"Alışveriş"}, google:{icon:"G",color:"#4285f4",category:"Bulut"},
  apple:{icon:"",color:"#f5f5f7",category:"Apple"}, figma:{icon:"F",color:"#a259ff",category:"Tasarım"}
};

const demo = [
  { id:"1", name:"iCloud+", price:24.99, currency:"TRY", cycle:"monthly", paymentDay:5, category:"Bulut", card:"Ziraat", color:"#60a5fa" },
  { id:"2", name:"Spotify", price:59.99, currency:"TRY", cycle:"monthly", paymentDay:12, category:"Müzik", card:"Ziraat", color:"#1db954" },
  { id:"3", name:"Adobe", price:400, currency:"TRY", cycle:"monthly", paymentDay:18, category:"Tasarım", card:"İş Bankası", color:"#fa0f00" }
];

const emptyForm = { name:"", price:"", currency:"TRY", cycle:"monthly", paymentDay:"", category:"Dijital", card:"", color:"#8b5cf6" };
const rates = { TRY:1, USD:32.5, EUR:35 };

function detectPlatform(name){ const key = Object.keys(platformMap).find(k => name.toLowerCase().includes(k)); return key ? platformMap[key] : null; }
function toTry(price,currency){ return Number(price) * (rates[currency || "TRY"] || 1); }
function nextPaymentDate(day){ const now = new Date(); const d=Math.min(Math.max(Number(day||1),1),28); let date=new Date(now.getFullYear(),now.getMonth(),d); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()); if(date<today) date=new Date(now.getFullYear(),now.getMonth()+1,d); return date; }
function daysUntil(day){ const today=new Date(); const clean=new Date(today.getFullYear(),today.getMonth(),today.getDate()); return Math.ceil((nextPaymentDate(day)-clean)/86400000); }
function formatDate(day){ return nextPaymentDate(day).toLocaleDateString("tr-TR",{day:"numeric",month:"long"}); }
function money(v){ return v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺"; }

export default function App(){
  const [user,setUser]=useState(null);
  const [subs,setSubs]=useState(() => JSON.parse(localStorage.getItem("abonelik-takip-local") || "null") || demo);
  const [form,setForm]=useState(emptyForm);
  const [query,setQuery]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("Tümü");
  const [cardFilter,setCardFilter]=useState("Tümü");
  const [syncState,setSyncState]=useState("local");

  useEffect(() => {
    if(!firebaseReady) return;
    return onAuthStateChanged(auth, (current) => setUser(current));
  }, []);

  useEffect(() => {
    if(!user || !db) {
      localStorage.setItem("abonelik-takip-local", JSON.stringify(subs));
      return;
    }
  }, [subs,user]);

  useEffect(() => {
    if(!user || !db) return;
    setSyncState("syncing");
    const ref = collection(db, "users", user.uid, "subscriptions");
    return onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setSubs(data.length ? data : []);
      setSyncState("cloud");
    }, () => setSyncState("error"));
  }, [user]);

  async function googleLogin(){ if(firebaseReady) await signInWithPopup(auth, googleProvider); }
  async function logout(){ await signOut(auth); }

  function handleNameChange(value){
    const p=detectPlatform(value);
    setForm({...form,name:value,category:p?.category||form.category,color:p?.color||form.color});
  }

  async function saveSub(sub){
    if(user && db) await setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt: serverTimestamp()});
    else setSubs(current => [...current, sub]);
  }

  async function addSub(e){
    e.preventDefault();
    if(!form.name.trim() || !form.price || !form.paymentDay) return;
    const p=detectPlatform(form.name);
    const sub={...form,id:crypto.randomUUID(),name:form.name.trim(),price:Number(form.price),paymentDay:Number(form.paymentDay),category:form.category.trim()||p?.category||"Dijital",card:form.card.trim()||"Belirtilmedi",color:p?.color||form.color};
    await saveSub(sub);
    setForm(emptyForm);
  }

  async function removeSub(id){
    if(user && db) await deleteDoc(doc(db,"users",user.uid,"subscriptions",id));
    else setSubs(subs.filter(s=>s.id!==id));
  }

  async function migrateLocal(){
    if(!user || !db) return;
    for(const sub of subs) await setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt:serverTimestamp()});
  }

  const categories=useMemo(()=>["Tümü",...new Set(subs.map(s=>s.category))],[subs]);
  const cards=useMemo(()=>["Tümü",...new Set(subs.map(s=>s.card||"Belirtilmedi"))],[subs]);

  const filtered=useMemo(()=>subs.filter(s=>{
    const text=`${s.name} ${s.category} ${s.card}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (categoryFilter==="Tümü"||s.category===categoryFilter) && (cardFilter==="Tümü"||(s.card||"Belirtilmedi")===cardFilter);
  }).sort((a,b)=>daysUntil(a.paymentDay)-daysUntil(b.paymentDay)),[subs,query,categoryFilter,cardFilter]);

  const monthlyTotal=useMemo(()=>subs.reduce((sum,s)=>sum+(s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency)),0),[subs]);
  const yearlyTotal=monthlyTotal*12;
  const closest=[...subs].sort((a,b)=>daysUntil(a.paymentDay)-daysUntil(b.paymentDay))[0];

  const categoryTotals=useMemo(()=>{
    const map={};
    subs.forEach(s=>{ const v=s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency); map[s.category]=(map[s.category]||0)+v; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[subs]);
  const maxCat=Math.max(...categoryTotals.map(([,v])=>v),1);

  function exportCsv(){
    const rows=[["Platform","Tutar","Para Birimi","Periyot","Ödeme Günü","Kategori","Kart"],...subs.map(s=>[s.name,s.price,s.currency,s.cycle,s.paymentDay,s.category,s.card])];
    const csv=rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(",")).join("\\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a"); a.href=url; a.download="abonelikler.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function exportJson(){
    const url=URL.createObjectURL(new Blob([JSON.stringify(subs,null,2)],{type:"application/json"}));
    const a=document.createElement("a"); a.href=url; a.download="abonelikler-yedek.json"; a.click(); URL.revokeObjectURL(url);
  }

  function importJson(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async()=>{ try{ const arr=JSON.parse(reader.result); if(Array.isArray(arr)){ if(user&&db){ for(const s of arr) await setDoc(doc(db,"users",user.uid,"subscriptions",s.id||crypto.randomUUID()), s); } else setSubs(arr); }}catch{} };
    reader.readAsText(file);
  }

  function logo(s){ return detectPlatform(s.name)?.icon || s.name.slice(0,2).toUpperCase(); }

  return <main className="app">
    <div className="aurora a"/><div className="aurora b"/>
    <section className="hero glass">
      <div className="heroTop">
        <div className="appIcon"><Wallet/></div>
        <div className="topRight">
          <span className="badge"><Smartphone size={15}/> iPhone</span><span className="badge"><Laptop size={15}/> Mac</span>
          {user ? <button className="ghost small" onClick={logout}><LogOut size={17}/> Çıkış</button> : <button className="ghost small" onClick={googleLogin}><LogIn size={17}/> Google ile gir</button>}
        </div>
      </div>
      <div>
        <p className="eyebrow"><Sparkles size={16}/> Abonelik Takip</p>
        <h1>Ödemelerini Mac ve iPhone’da senkronize yönet.</h1>
        <p className="desc">Firebase ile gerçek zamanlı bulut eşitleme, PWA, Liquid Glass arayüz, CSV/JSON yedekleme.</p>
      </div>
    </section>

    <section className="metrics">
      <article className="metric featured"><span>Aylık toplam</span><strong>{money(monthlyTotal)}</strong><small>Yıllık: {money(yearlyTotal)}</small></article>
      <article className="metric"><Bell/><span>Yaklaşan ödeme</span><strong>{closest?closest.name:"Yok"}</strong><small>{closest?`${daysUntil(closest.paymentDay)} gün · ${formatDate(closest.paymentDay)}`:"Kayıt ekle"}</small></article>
      <article className="metric">{syncState==="cloud"?<Cloud/>:<CloudOff/>}<span>Senkronizasyon</span><strong>{user?"Bulut":"Yerel"}</strong><small>{user?user.email:"Google ile giriş yap"}</small></article>
    </section>

    {user && <section className="notice glass"><Cloud size={18}/> Yerel verileri buluta taşımak için <button onClick={migrateLocal}>Buluta aktar</button></section>}

    <section className="grid">
      <section className="panel glass">
        <h2>Yeni abonelik</h2><p>Platform adı yazınca renk/kategori otomatik algılanır.</p>
        <form className="form" onSubmit={addSub}>
          <input placeholder="Platform adı" value={form.name} onChange={e=>handleNameChange(e.target.value)}/>
          <div className="row"><input type="number" step="0.01" placeholder="Tutar" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>TRY</option><option>USD</option><option>EUR</option></select></div>
          <div className="row"><select value={form.cycle} onChange={e=>setForm({...form,cycle:e.target.value})}><option value="monthly">Aylık</option><option value="yearly">Yıllık</option></select><input type="number" min="1" max="28" placeholder="Ödeme günü" value={form.paymentDay} onChange={e=>setForm({...form,paymentDay:e.target.value})}/></div>
          <input placeholder="Kategori" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
          <input placeholder="Kart / ödeme yöntemi" value={form.card} onChange={e=>setForm({...form,card:e.target.value})}/>
          <div className="row"><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/><button><Plus size={18}/> Ekle</button></div>
        </form>
      </section>

      <section className="panel glass">
        <div className="title"><div><h2>Kategori dağılımı</h2><p>Aylık gider kırılımı</p></div><PieChart/></div>
        <div className="bars">{categoryTotals.map(([c,v])=><div className="bar" key={c}><div><span>{c}</span><strong>{money(v)}</strong></div><i><motion.b initial={{width:0}} animate={{width:`${v/maxCat*100}%`}}/></i></div>)}</div>
      </section>
    </section>

    <section className="panel glass">
      <div className="title"><div><h2>Ödeme takvimi</h2><p>Ayın 1-28 arası ödeme yoğunluğu</p></div><CalendarDays/></div>
      <div className="calendar">{Array.from({length:28},(_,i)=>i+1).map(day=>{const list=subs.filter(s=>Number(s.paymentDay)===day); return <div className={list.length?"day active":"day"} key={day}><span>{day}</span><em>{list.slice(0,4).map(s=><i key={s.id} style={{background:s.color}}/> )}</em></div>})}</div>
    </section>

    <section className="panel glass">
      <div className="title split"><div><h2>Abonelikler</h2><p>Arama, filtre, dışa aktarma</p></div><div className="actions"><button className="ghost" onClick={exportCsv}><Download size={17}/> CSV</button><button className="ghost" onClick={exportJson}><Download size={17}/> JSON</button><label className="ghost upload"><Upload size={17}/> İçe aktar<input type="file" accept="application/json" onChange={importJson}/></label><button className="ghost" onClick={()=>setSubs(demo)}><RotateCcw size={17}/> Demo</button></div></div>
      <div className="toolbar"><label className="search"><Search size={18}/><input placeholder="Ara" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="select"><ListFilter size={17}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="select"><CreditCard size={17}/><select value={cardFilter} onChange={e=>setCardFilter(e.target.value)}>{cards.map(c=><option key={c}>{c}</option>)}</select></label></div>
      <div className="subs"><AnimatePresence>{filtered.map(s=>{const urgent=daysUntil(s.paymentDay)<=3; return <motion.article className="sub" key={s.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-10}}><div className="logo" style={{background:s.color,color:s.color==="#f5f5f7"?"#111":"#fff"}}>{logo(s)}</div><div><h3>{s.name}</h3><p>{s.category} · {s.card||"Belirtilmedi"}</p></div><span className={urgent?"pill urgent":"pill"}>{urgent&&<AlertTriangle size={14}/>} {daysUntil(s.paymentDay)} gün</span><div className="right"><b>{formatDate(s.paymentDay)}</b><small>Ödeme günü</small></div><div className="right"><b>{s.currency==="TRY"?money(s.price):`${s.price} ${s.currency}`}</b><small>{s.cycle==="monthly"?"Aylık":"Yıllık"}</small></div><button className="delete" onClick={()=>removeSub(s.id)}><Trash2 size={18}/></button></motion.article>})}</AnimatePresence>{!filtered.length&&<div className="empty">Kayıt bulunamadı.</div>}</div>
    </section>
  </main>;
}
