import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Search, Wallet, Bell, CalendarDays, Download, CreditCard,
  PieChart, ListFilter, Smartphone, Laptop, AlertTriangle, LogIn, LogOut,
  Cloud, CloudOff, Upload, Edit3, X, Check
} from "lucide-react";
import { auth, db, googleProvider, firebaseReady } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const platformMap = {
  hepsiburada:{icon:"HB",color:"#ff6000",category:"Alışveriş"},
  amazon:{icon:"a",color:"#00a8e1",category:"Alışveriş"},
  prime:{icon:"P",color:"#00a8e1",category:"Alışveriş"},
  netflix:{icon:"N",color:"#e50914",category:"Film/Dizi"}, spotify:{icon:"♬",color:"#1db954",category:"Müzik"},
  icloud:{icon:"☁",color:"#60a5fa",category:"Bulut"}, youtube:{icon:"▶",color:"#ff0033",category:"Video"},
  disney:{icon:"D+",color:"#113ccf",category:"Film/Dizi"}, adobe:{icon:"A",color:"#fa0f00",category:"Tasarım"},
  chatgpt:{icon:"AI",color:"#10a37f",category:"Yapay Zeka"}, figma:{icon:"F",color:"#a259ff",category:"Tasarım"},
  apple:{icon:"",color:"#f5f5f7",category:"Apple"}, google:{icon:"G",color:"#4285f4",category:"Bulut"},
  playstation:{icon:"PS",color:"#006fcd",category:"Oyun"}, ps:{icon:"PS",color:"#006fcd",category:"Oyun"}
};

const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const emptyForm = { name:"", price:"", currency:"TRY", cycle:"monthly", paymentDay:"", paymentMonth:new Date().getMonth() + 1, category:"Dijital", card:"", color:"#8b5cf6" };
const rates = { TRY:1, USD:32.5, EUR:35 };

function detectPlatform(name){ const key = platformKey(name); return key ? platformMap[key] : null; }
function toTry(price,currency){ return Number(price || 0) * (rates[currency || "TRY"] || 1); }
function money(v){ return v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺"; }
function nextPaymentDate(sub){
  const now = new Date();
  const day = Math.min(Math.max(Number(sub.paymentDay || 1),1),28);
  if(sub.cycle === "yearly"){
    const month = Math.min(Math.max(Number(sub.paymentMonth || 1),1),12) - 1;
    let date = new Date(now.getFullYear(), month, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if(date < today) date = new Date(now.getFullYear()+1, month, day);
    return date;
  }
  let date = new Date(now.getFullYear(), now.getMonth(), day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(date < today) date = new Date(now.getFullYear(), now.getMonth()+1, day);
  return date;
}
function daysUntil(sub){ const today = new Date(); const clean = new Date(today.getFullYear(), today.getMonth(), today.getDate()); return Math.ceil((nextPaymentDate(sub)-clean)/86400000); }
function formatDate(sub){ return nextPaymentDate(sub).toLocaleDateString("tr-TR",{day:"numeric",month:"long"}); }
function cycleLabel(cycle){ return cycle === "yearly" ? "Yıllık" : "Aylık"; }

function platformKey(name=""){
  const text = name.toLowerCase().trim();
  if(text.includes("hepsiburada")) return "hepsiburada";
  if(text.includes("amazon") || text.includes("prime")) return "amazon";
  if(text.includes("apple")) return "apple";
  if(text.includes("chatgpt") || text.includes("openai")) return "chatgpt";
  if(text.includes("youtube")) return "youtube";
  if(text.includes("spotify")) return "spotify";
  if(text.includes("icloud")) return "icloud";
  if(text.includes("adobe")) return "adobe";
  if(text.includes("netflix")) return "netflix";
  if(text.includes("figma")) return "figma";
  if(text.includes("playstation") || text === "ps" || text.includes(" ps ")) return "playstation";
  return Object.keys(platformMap).find(k => text.includes(k)) || null;
}

function BrandLogo({ sub }){
  const key = platformKey(sub.name);
  const fallback = (sub.name || "?").slice(0,2).toUpperCase();

  if(key === "apple") return <span className="brandMark appleMark"></span>;
  if(key === "chatgpt") return <span className="brandMark chatgptMark">AI</span>;
  if(key === "amazon") return <span className="brandMark amazonMark">a</span>;
  if(key === "youtube") return <span className="brandMark youtubeMark">▶</span>;
  if(key === "adobe") return <span className="brandMark adobeMark">A</span>;
  if(key === "hepsiburada") return <span className="brandMark hepsiMark">HB</span>;
  if(key === "spotify") return <span className="brandMark spotifyMark">♬</span>;
  if(key === "icloud") return <span className="brandMark icloudMark">☁</span>;
  if(key === "netflix") return <span className="brandMark netflixMark">N</span>;
  if(key === "figma") return <span className="brandMark figmaMark">F</span>;
  if(key === "playstation") return <span className="brandMark psMark">PS</span>;
  return <span className="brandMark">{fallback}</span>;
}

export default function App(){
  const [user,setUser]=useState(null);
  const [subs,setSubs]=useState(() => JSON.parse(localStorage.getItem("abonelik-takip-local") || "null") || []);
  const [form,setForm]=useState(emptyForm);
  const [query,setQuery]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("Tümü");
  const [cardFilter,setCardFilter]=useState("Tümü");
  const [syncState,setSyncState]=useState("local");
  const [isFormOpen,setIsFormOpen]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [toast,setToast]=useState("");

  useEffect(() => { if(!firebaseReady) return; return onAuthStateChanged(auth, current => setUser(current)); }, []);
  useEffect(() => { if(!user || !db) localStorage.setItem("abonelik-takip-local", JSON.stringify(subs)); }, [subs,user]);
  useEffect(() => {
    if(!user || !db) return;
    setSyncState("syncing");
    const ref = collection(db, "users", user.uid, "subscriptions");
    return onSnapshot(ref, snap => {
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      setSubs(data);
      setSyncState("cloud");
    }, () => setSyncState("error"));
  }, [user]);

  function showToast(message){ setToast(message); setTimeout(() => setToast(""), 2400); }
  async function googleLogin(){ if(firebaseReady) await signInWithPopup(auth, googleProvider); }
  async function logout(){ await signOut(auth); }
  function handleNameChange(value){ const p=detectPlatform(value); setForm({...form,name:value,category:p?.category||form.category,color:p?.color||form.color}); }

  async function persistSub(sub){
    if(user && db) await setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt: serverTimestamp()});
    else setSubs(current => current.some(item => item.id === sub.id) ? current.map(item => item.id === sub.id ? sub : item) : [...current, sub]);
  }

  async function submitSub(e){
    e.preventDefault();
    if(!form.name.trim() || !form.price || !form.paymentDay) return;
    const p=detectPlatform(form.name);
    const sub={...form,id:editingId || crypto.randomUUID(),name:form.name.trim(),price:Number(form.price),paymentDay:Number(form.paymentDay),paymentMonth:Number(form.paymentMonth || new Date().getMonth()+1),category:form.category.trim()||p?.category||"Dijital",card:form.card.trim()||"Belirtilmedi",color:p?.color||form.color};
    await persistSub(sub);
    setForm(emptyForm); setEditingId(null); setIsFormOpen(false);
    showToast(editingId ? "Abonelik güncellendi" : "Abonelik eklendi");
  }

  function startEdit(sub){
    setEditingId(sub.id);
    setForm({ ...emptyForm, ...sub, price:String(sub.price), paymentDay:String(sub.paymentDay), paymentMonth:sub.paymentMonth || new Date().getMonth()+1 });
    setIsFormOpen(true);
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  function cancelForm(){ setForm(emptyForm); setEditingId(null); setIsFormOpen(false); }
  async function removeSub(id){ if(user && db) await deleteDoc(doc(db,"users",user.uid,"subscriptions",id)); else setSubs(subs.filter(s=>s.id!==id)); showToast("Abonelik silindi"); }
  async function migrateLocal(){ if(!user || !db) return; for(const sub of subs) await setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt:serverTimestamp()}); showToast("Buluta aktarıldı"); }

  const categories=useMemo(()=>["Tümü",...new Set(subs.map(s=>s.category))],[subs]);
  const cards=useMemo(()=>["Tümü",...new Set(subs.map(s=>s.card||"Belirtilmedi"))],[subs]);
  const filtered=useMemo(()=>subs.filter(s=>{
    const text=`${s.name} ${s.category} ${s.card}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (categoryFilter==="Tümü"||s.category===categoryFilter) && (cardFilter==="Tümü"||(s.card||"Belirtilmedi")===cardFilter);
  }).sort((a,b)=>daysUntil(a)-daysUntil(b)),[subs,query,categoryFilter,cardFilter]);
  const monthlyTotal=useMemo(()=>subs.reduce((sum,s)=>sum+(s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency)),0),[subs]);
  const yearlyTotal=monthlyTotal*12;
  const upcoming=useMemo(()=>[...subs].sort((a,b)=>daysUntil(a)-daysUntil(b)).slice(0,4),[subs]);
  const categoryTotals=useMemo(()=>{ const map={}; subs.forEach(s=>{ const v=s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency); map[s.category]=(map[s.category]||0)+v; }); return Object.entries(map).sort((a,b)=>b[1]-a[1]); },[subs]);
  const maxCat=Math.max(...categoryTotals.map(([,v])=>v),1);

  function exportCsv(){
    const rows=[["Platform","Tutar","Para Birimi","Periyot","Ödeme Günü","Ödeme Ayı","Kategori","Kart"],...subs.map(s=>[s.name,s.price,s.currency,s.cycle,s.paymentDay,s.paymentMonth||"",s.category,s.card])];
    const csv=rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a"); a.href=url; a.download="abonelikler.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportJson(){ const url=URL.createObjectURL(new Blob([JSON.stringify(subs,null,2)],{type:"application/json"})); const a=document.createElement("a"); a.href=url; a.download="abonelikler-yedek.json"; a.click(); URL.revokeObjectURL(url); }
  function importJson(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async()=>{ try{ const arr=JSON.parse(reader.result); if(Array.isArray(arr)){ if(user&&db){ for(const s of arr) await setDoc(doc(db,"users",user.uid,"subscriptions",s.id||crypto.randomUUID()), s); } else setSubs(arr); showToast("Yedek içe aktarıldı"); }}catch{ showToast("Yedek okunamadı"); } };
    reader.readAsText(file);
  }

  return <main className="app">
    <div className="aurora a"/><div className="aurora b"/>
    <AnimatePresence>{toast && <motion.div className="toast" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}><Check size={18}/>{toast}</motion.div>}</AnimatePresence>

    <section className="hero compact glass">
      <div className="heroTop">
        <div className="brand"><div className="appIcon"><Wallet/></div><h1>Abonelik Takibi</h1></div>
        <div className="topRight">
          <span className="badge"><Smartphone size={15}/> iPhone</span><span className="badge"><Laptop size={15}/> Mac</span>
          {user ? <button className="ghost small" onClick={logout}><LogOut size={17}/> Çıkış</button> : <button className="ghost small" onClick={googleLogin}><LogIn size={17}/> Google ile gir</button>}
        </div>
      </div>
      <div className="syncPill">{syncState==="cloud"?<Cloud size={16}/>:<CloudOff size={16}/>} {user ? "Bulut senkronizasyonu aktif" : "Yerel kullanım"}</div>
    </section>

    <section className="metric single featured"><span>Aylık tutar</span><strong>{money(monthlyTotal)}</strong><small>Yıllık karşılığı: {money(yearlyTotal)}</small></section>

    <section className="panel glass">
      <div className="title"><div><h2>Yaklaşan ödemeler</h2><p>En yakın yenileme tarihleri</p></div><Bell/></div>
      <div className="upcomingRow">{upcoming.length ? upcoming.map(s => <article className="upcomingCard" key={s.id}><div className="logo mini" style={{background:s.color,color:s.color==="#f5f5f7"?"#111":"#fff"}}><BrandLogo sub={s} /></div><strong>{s.name}</strong><span>{daysUntil(s)} gün</span><small>{formatDate(s)}</small></article>) : <div className="empty">Yaklaşan ödeme yok.</div>}</div>
    </section>

    {user && <section className="notice glass"><Cloud size={18}/> Yerel verileri buluta taşımak için <button onClick={migrateLocal}>Buluta aktar</button></section>}

    <section className="panel glass addPanel">
      <div className="title split"><div><h2>{editingId ? "Aboneliği düzenle" : "Yeni abonelik"}</h2><p>Detayları açmak için + ikonunu kullan.</p></div><button className="roundButton" onClick={() => isFormOpen ? cancelForm() : setIsFormOpen(true)}>{isFormOpen ? <X/> : <Plus/>}</button></div>
      <AnimatePresence>{isFormOpen && <motion.form className="form" onSubmit={submitSub} initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}>
        <input placeholder="Platform adı" value={form.name} onChange={e=>handleNameChange(e.target.value)}/>
        <div className="row"><input type="number" step="0.01" placeholder="Tutar" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>TRY</option><option>USD</option><option>EUR</option></select></div>
        <div className="row"><select value={form.cycle} onChange={e=>setForm({...form,cycle:e.target.value})}><option value="monthly">Aylık</option><option value="yearly">Yıllık</option></select><input type="number" min="1" max="28" placeholder="Ödeme günü" value={form.paymentDay} onChange={e=>setForm({...form,paymentDay:e.target.value})}/></div>
        {form.cycle === "yearly" && <select value={form.paymentMonth} onChange={e=>setForm({...form,paymentMonth:e.target.value})}>{monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select>}
        <input placeholder="Kategori" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
        <input placeholder="Kart / ödeme yöntemi" value={form.card} onChange={e=>setForm({...form,card:e.target.value})}/>
        <div className="row"><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/><button>{editingId ? <><Check size={18}/> Güncelle</> : <><Plus size={18}/> Ekle</>}</button></div>
      </motion.form>}</AnimatePresence>
    </section>

    <section className="panel glass"><div className="title"><div><h2>Takvim görünümü</h2><p>Ayın 1-28 arası ödeme yoğunluğu</p></div><CalendarDays/></div><div className="calendar">{Array.from({length:28},(_,i)=>i+1).map(day=>{const list=subs.filter(s=>Number(s.paymentDay)===day); return <div className={list.length?"day active":"day"} key={day}><span>{day}</span><em>{list.slice(0,4).map(s=><i key={s.id} style={{background:s.color}}/> )}</em></div>})}</div></section>

    <section className="panel glass"><div className="title"><div><h2>Kategoriler</h2><p>Aylık gider kırılımı</p></div><PieChart/></div><div className="bars">{categoryTotals.length ? categoryTotals.map(([c,v])=><div className="bar" key={c}><div><span>{c}</span><strong>{money(v)}</strong></div><i><motion.b initial={{width:0}} animate={{width:`${v/maxCat*100}%`}}/></i></div>) : <div className="empty">Kategori verisi yok.</div>}</div></section>

    <section className="panel glass">
      <div className="title split"><div><h2>Abonelikler</h2><p>Arama, filtre, düzenleme ve dışa aktarma</p></div><div className="actions"><button className="ghost" onClick={exportCsv}><Download size={17}/> CSV</button><button className="ghost" onClick={exportJson}><Download size={17}/> JSON</button><label className="ghost upload"><Upload size={17}/> İçe aktar<input type="file" accept="application/json" onChange={importJson}/></label></div></div>
      <div className="toolbar"><label className="search"><Search size={18}/><input placeholder="Ara" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="select"><ListFilter size={17}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="select"><CreditCard size={17}/><select value={cardFilter} onChange={e=>setCardFilter(e.target.value)}>{cards.map(c=><option key={c}>{c}</option>)}</select></label></div>
      <div className="subs"><AnimatePresence>{filtered.map(s=>{const urgent=daysUntil(s)<=3; return <motion.article className="sub" key={s.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-10}}><div className="logo" style={{background:s.color,color:s.color==="#f5f5f7"?"#111":"#fff"}}><BrandLogo sub={s} /></div><div><h3>{s.name}</h3><p>{s.category} · {s.card||"Belirtilmedi"}</p></div><span className={urgent?"pill urgent":"pill"}>{urgent&&<AlertTriangle size={14}/>} {daysUntil(s)} gün</span><div className="right"><b>{formatDate(s)}</b><small>Ödeme günü</small></div><div className="right"><b>{s.currency==="TRY"?money(s.price):`${s.price} ${s.currency}`}</b><small>{cycleLabel(s.cycle)}</small></div><div className="rowActions"><button className="iconAction" onClick={()=>startEdit(s)}><Edit3 size={17}/></button><button className="delete" onClick={()=>removeSub(s.id)}><Trash2 size={18}/></button></div></motion.article>})}</AnimatePresence>{!filtered.length&&<div className="empty">Kayıt bulunamadı.</div>}</div>
    </section>
  </main>;
}
