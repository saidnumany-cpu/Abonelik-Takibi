import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Search, Wallet, Bell, CalendarDays, Download, CreditCard,
  PieChart, ListFilter, AlertTriangle, LogIn, LogOut, Cloud, CloudOff,
  Upload, Edit3, X, Check, User, ChevronRight
} from "lucide-react";
import { auth, db, googleProvider, firebaseReady } from "./firebase";
import { enableNotifications, startForegroundNotifications } from "./notifications";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const platformMap = {
  netflix:{icon:"N",color:"#e50914",category:"Film/Dizi"}, spotify:{icon:"♬",color:"#1db954",category:"Müzik"},
  icloud:{icon:"☁",color:"#60a5fa",category:"Bulut"}, youtube:{icon:"▶",color:"#ff0033",category:"Video"},
  disney:{icon:"D+",color:"#113ccf",category:"Film/Dizi"}, adobe:{icon:"A",color:"#fa0f00",category:"Tasarım"},
  chatgpt:{icon:"AI",color:"#10a37f",category:"Yapay Zeka"}, ps:{icon:"PS",color:"#006fcd",category:"Oyun"},
  prime:{icon:"P",color:"#00a8e1",category:"Alışveriş"}, amazon:{icon:"P",color:"#00a8e1",category:"Alışveriş"},
  hepsiburada:{icon:"hb",color:"#ff6000",category:"Alışveriş"}, google:{icon:"G",color:"#4285f4",category:"Bulut"},
  apple:{icon:"",color:"#f5f5f7",category:"Apple"}, figma:{icon:"F",color:"#a259ff",category:"Tasarım"}
};

const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const emptyForm = {
  name:"", price:"", currency:"TRY", cycle:"monthly", paymentDay:"",
  paymentMonth:new Date().getMonth() + 1, category:"Dijital", card:"", color:"#8b5cf6",
  iconType:"auto", customIcon:""
};
const rates = { TRY:1, USD:32.5, EUR:35 };

function detectPlatform(name=""){ const key = Object.keys(platformMap).find(k => name.toLowerCase().includes(k)); return key ? platformMap[key] : null; }
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
function formatDate(sub){ return nextPaymentDate(sub).toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"}); }
function shortDate(sub){ return nextPaymentDate(sub).toLocaleDateString("tr-TR",{day:"numeric",month:"long"}); }
function cycleLabel(cycle){ return cycle === "yearly" ? "Yıllık" : "Aylık"; }
function isImageIcon(sub){ return sub.iconType === "image" && /^https?:\/\//i.test((sub.customIcon || "").trim()); }
function iconText(sub){
  if(sub.iconType === "emoji" && (sub.customIcon || "").trim()) return sub.customIcon.trim();
  return detectPlatform(sub.name)?.icon || sub.name.slice(0,2).toUpperCase();
}

function Logo({ sub, small=false }){
  const image = isImageIcon(sub);
  return (
    <div className={`${small ? "logo smallLogo" : "logo"} ${image ? "imageLogo" : ""}`} style={image ? undefined : {background:sub.color,color:sub.color==="#f5f5f7"?"#111":"#fff"}}>
      {image ? <img src={sub.customIcon.trim()} alt={sub.name} onError={(e)=>{ e.currentTarget.style.display = "none"; }}/> : <span>{iconText(sub)}</span>}
    </div>
  );
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

  useEffect(() => {
    if(!firebaseReady) return;
    return onAuthStateChanged(auth, current => setUser(current));
  }, []);

  useEffect(() => {
    startForegroundNotifications();
  }, []);

  useEffect(() => {
    if(!user) return;
    if(!("Notification" in window)) return;
    if(Notification.permission !== "granted") return;

    const lastAutoRefresh = sessionStorage.getItem("notification-token-refreshed");

    if(lastAutoRefresh === user.uid) return;

    sessionStorage.setItem("notification-token-refreshed", user.uid);
    enableNotifications(user);
  }, [user]);

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
    const sub={
      ...form,
      id:editingId || crypto.randomUUID(),
      name:form.name.trim(),
      price:Number(form.price),
      paymentDay:Number(form.paymentDay),
      paymentMonth:Number(form.paymentMonth || new Date().getMonth()+1),
      category:form.category.trim()||p?.category||"Dijital",
      card:form.card.trim()||"Belirtilmedi",
      color:p?.color||form.color,
      iconType:form.iconType || "auto",
      customIcon:(form.customIcon || "").trim()
    };
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
  const upcoming=useMemo(()=>[...subs].sort((a,b)=>daysUntil(a)-daysUntil(b)).slice(0,3),[subs]);
  const categoryTotals=useMemo(()=>{ const map={}; subs.forEach(s=>{ const v=s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency); map[s.category]=(map[s.category]||0)+v; }); return Object.entries(map).sort((a,b)=>b[1]-a[1]); },[subs]);
  const maxCat=Math.max(...categoryTotals.map(([,v])=>v),1);
  const dueSoonCount=useMemo(()=>subs.filter(s=>daysUntil(s)<=7).length,[subs]);
  const thisMonthTotal=useMemo(()=>subs.reduce((sum,s)=>sum+(s.cycle==="yearly"?0:toTry(s.price,s.currency)),0),[subs]);

  function exportCsv(){
    const rows=[["Platform","Tutar","Para Birimi","Periyot","Ödeme Günü","Ödeme Ayı","Kategori","Kart","İkon Tipi","İkon"],...subs.map(s=>[s.name,s.price,s.currency,s.cycle,s.paymentDay,s.paymentMonth||"",s.category,s.card,s.iconType||"auto",s.customIcon||""])];
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

  return <main className="appShell">
    <div className="ambient ambientOne"/><div className="ambient ambientTwo"/>
    <AnimatePresence>{toast && <motion.div className="toast" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}><Check size={18}/>{toast}</motion.div>}</AnimatePresence>

    <header className="topbar">
      <div className="brandBlock"><div className="brandIcon"><Wallet size={23}/></div><h1>Abonelik Takip</h1></div>
      <div className="topActions">
        <span className="syncBadge">{syncState==="cloud"?<Cloud size={17}/>:<CloudOff size={17}/>}<span>{user ? "Senkronize" : "Yerel"}<small>{syncState==="syncing" ? "Aktarılıyor" : syncState==="cloud" ? "Az önce" : "Bu cihaz"}</small></span></span>

        {user ? (
          <>
            <button className="roundGhost" onClick={() => enableNotifications(user)} title="Bildirimleri Aç">
              <Bell size={20}/>
            </button>
            <button className="roundGhost" onClick={logout} title="Çıkış">
              <LogOut size={20}/>
            </button>
          </>
        ) : (
          <button className="loginButton" onClick={googleLogin}>
            <LogIn size={18}/> Google ile gir
          </button>
        )}

        <button className="roundGhost" title="Profil"><User size={20}/></button>
      </div>
    </header>

    <section className="summaryCard glassPanel">
      <div className="summaryMetric big"><span>Toplam aylık harcama</span><strong>{money(monthlyTotal)}</strong><small>{subs.length} aktif abonelik</small></div>
      <div className="summaryMetric"><span>Bu ay ödenecek</span><strong className="blueText">{money(thisMonthTotal || monthlyTotal)}</strong></div>
      <div className="summaryMetric"><span>Yaklaşan ödemeler</span><strong className="orangeText">{dueSoonCount}</strong><small>7 gün içinde</small></div>
      <div className="summaryMetric"><span>Yıllık toplam</span><strong className="purpleText">{money(yearlyTotal)}</strong></div>
    </section>

    {user && <section className="notice glassPanel"><Cloud size={18}/> Yerel verileri buluta taşımak için <button onClick={migrateLocal}>Buluta aktar</button></section>}

    <section className="mainGrid">
      <aside className="sideColumn">
        <div className="sideCard glassPanel">
          <div className="sectionHead"><h2>Yaklaşan ödemeler</h2><Bell size={19}/></div>
          <div className="upcomingList">
            {upcoming.length ? upcoming.map(s => <article className="upcomingItem" key={s.id}>
              <Logo sub={s} small/>
              <div><strong>{s.name}</strong><span>{shortDate(s)}</span></div>
              <b>{s.currency==="TRY"?money(s.price):`${s.price} ${s.currency}`}</b>
            </article>) : <div className="empty">Yaklaşan ödeme yok.</div>}
          </div>
          <button className="fullGhost" onClick={() => { setCategoryFilter("Tümü"); setCardFilter("Tümü"); setQuery(""); document.getElementById("subscriptions-section")?.scrollIntoView({ behavior:"smooth", block:"start" }); }}>Tümünü görüntüle <ChevronRight size={18}/></button>
        </div>

        <div className="sideCard glassPanel">
          <div className="sectionHead"><h2>Kategorilere göre dağılım</h2><PieChart size={19}/></div>
          <div className="categoryList">
            {categoryTotals.length ? categoryTotals.map(([c,v],i)=><div className="categoryRow" key={c}>
              <div><span>{c}</span><b>%{monthlyTotal ? Math.round((v/monthlyTotal)*100) : 0}</b></div>
              <i><motion.em initial={{width:0}} animate={{width:`${v/maxCat*100}%`}}/></i>
              <small>{money(v)}</small>
            </div>) : <div className="empty">Kategori verisi yok.</div>}
          </div>
        </div>
      </aside>

      <section className="contentCard glassPanel" id="subscriptions-section">
        <div className="contentHeader">
          <h2>Aboneliklerim</h2>
          <label className="searchBox"><Search size={18}/><input placeholder="Ara..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <label className="filterBox"><ListFilter size={16}/><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <button className="primaryButton" onClick={() => setIsFormOpen(true)}><Plus size={18}/> Abonelik Ekle</button>
        </div>

        <AnimatePresence>{isFormOpen && <motion.form className="formCard" onSubmit={submitSub} initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}>
          <div className="formTitle"><h3>{editingId ? "Aboneliği düzenle" : "Yeni abonelik"}</h3><button type="button" className="miniGhost" onClick={cancelForm}><X size={18}/></button></div>
          <div className="formGrid">
            <input placeholder="Platform adı" value={form.name} onChange={e=>handleNameChange(e.target.value)}/>
            <input type="number" step="0.01" placeholder="Tutar" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/>
            <select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>TRY</option><option>USD</option><option>EUR</option></select>
            <select value={form.cycle} onChange={e=>setForm({...form,cycle:e.target.value})}><option value="monthly">Aylık</option><option value="yearly">Yıllık</option></select>
            <input type="number" min="1" max="28" placeholder="Ödeme günü" value={form.paymentDay} onChange={e=>setForm({...form,paymentDay:e.target.value})}/>
            {form.cycle === "yearly" && <select value={form.paymentMonth} onChange={e=>setForm({...form,paymentMonth:e.target.value})}>{monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select>}
            <input placeholder="Kategori" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
            <input placeholder="Kart / ödeme yöntemi" value={form.card} onChange={e=>setForm({...form,card:e.target.value})}/>
            <select value={form.iconType} onChange={e=>setForm({...form,iconType:e.target.value,customIcon:e.target.value==="auto"?"":form.customIcon})}><option value="auto">Otomatik ikon</option><option value="emoji">Emoji</option><option value="image">Görsel URL</option></select>
            <input placeholder={form.iconType==="emoji" ? "Örn: 🎵" : form.iconType==="image" ? "https://...png" : "Otomatik ikon aktif"} value={form.customIcon} disabled={form.iconType==="auto"} onChange={e=>setForm({...form,customIcon:e.target.value})}/>
            <input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/>
          </div>
          <button className="primaryButton submitButton">{editingId ? <><Check size={18}/> Güncelle</> : <><Plus size={18}/> Ekle</>}</button>
        </motion.form>}</AnimatePresence>

        <div className="tableControls">
          <label className="filterBox"><CreditCard size={16}/><select value={cardFilter} onChange={e=>setCardFilter(e.target.value)}>{cards.map(c=><option key={c}>{c}</option>)}</select></label>
          <button className="softButton" onClick={exportCsv}><Download size={17}/> CSV</button>
          <button className="softButton" onClick={exportJson}><Download size={17}/> JSON</button>
          <label className="softButton uploadBtn"><Upload size={17}/> İçe aktar<input type="file" accept="application/json" onChange={importJson}/></label>
        </div>

        <div className="tableHead"><span></span><span></span><span>Süre</span><span>Son ödeme</span><span>Tutar</span><span>Durum</span><span>İşlemler</span></div>
        <div className="subsTable">
          <AnimatePresence>{filtered.map(s=>{const urgent=daysUntil(s)<=3; return <motion.article className="subRow" key={s.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-10}}>
            <Logo sub={s}/>
            <div className="subName"><strong>{s.name}</strong><span>{s.category}</span></div>
            <div className="subCell">{daysUntil(s)} gün</div>
            <div className="subCell">{formatDate(s)}</div>
            <div className="subPrice"><strong>{s.currency==="TRY"?money(s.price):`${s.price} ${s.currency}`}</strong><span>{cycleLabel(s.cycle)}</span></div>
            <div><span className={urgent?"status warning":"status"}>{urgent ? "Yakında" : "Aktif"}</span></div>
            <div className="rowActions"><button className="iconAction" onClick={()=>startEdit(s)}><Edit3 size={17}/></button><button className="delete" onClick={()=>removeSub(s.id)}><Trash2 size={18}/></button></div>
          </motion.article>})}</AnimatePresence>
          {!filtered.length&&<div className="empty">Kayıt bulunamadı.</div>}
        </div>
      </section>
    </section>

    <section className="calendarCard glassPanel">
      <div className="sectionHead"><h2>Takvim görünümü</h2><CalendarDays size={19}/></div>
      <div className="calendarGrid">{Array.from({length:28},(_,i)=>i+1).map(day=>{const list=subs.filter(s=>Number(s.paymentDay)===day); return <div className={list.length?"day active":"day"} key={day}><span>{day}</span><em>{list.slice(0,4).map(s=><i key={s.id} style={{background:s.color}}/> )}</em></div>})}</div>
    </section>
  </main>;
}
