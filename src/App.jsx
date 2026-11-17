import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Plus, Search, Bell, Download, LayoutGrid, List, CalendarDays, LogIn, LogOut,
  Cloud, CloudOff, Upload, Check, User, ChevronRight, MoreHorizontal, X, RefreshCw, Inbox
} from "lucide-react";
import { auth, db, googleProvider, firebaseReady } from "./firebase";
import Calendar from "./Calendar.jsx";
import SubscriptionSheet from "./SubscriptionSheet.jsx";
import { Logo, Sheet, detectPlatform } from "./ui.jsx";
// Bildirim kodu (firebase/messaging) ayrı parçada; ilk açılışı hızlandırır
const loadNotifications = () => import("./notifications");
const enableNotifications = (...args) => loadNotifications().then(m => m.enableNotifications(...args));
const startForegroundNotifications = () => loadNotifications().then(m => m.startForegroundNotifications());
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const rates = { TRY:1, USD:32.5, EUR:35 };
const LOCAL_KEY = "abonelik-takip-local";
function readLocalSubs(){ try { const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); return Array.isArray(arr) ? arr : []; } catch { return []; } }

function toTry(price,currency){ return Number(price || 0) * (rates[currency || "TRY"] || 1); }
function money(v){ return v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₺"; }
function moneyParts(v){ const [int,dec] = v.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).split(","); return { int, dec }; }
function priceLabel(s){ return s.currency==="TRY" ? money(Number(s.price)) : `${Number(s.price).toLocaleString("tr-TR",{maximumFractionDigits:2})} ${s.currency==="USD"?"$":"€"}`; }
function nextPaymentDate(sub){
  const now = new Date();
  const day = Math.min(Math.max(Number(sub.paymentDay || 1),1),28);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if(sub.cycle === "yearly"){
    const month = Math.min(Math.max(Number(sub.paymentMonth || 1),1),12) - 1;
    let date = new Date(now.getFullYear(), month, day);
    if(date < today) date = new Date(now.getFullYear()+1, month, day);
    return date;
  }
  let date = new Date(now.getFullYear(), now.getMonth(), day);
  if(date < today) date = new Date(now.getFullYear(), now.getMonth()+1, day);
  return date;
}
function daysUntil(sub){ const today = new Date(); const clean = new Date(today.getFullYear(), today.getMonth(), today.getDate()); return Math.round((nextPaymentDate(sub)-clean)/86400000); }
function shortDate(sub){ return nextPaymentDate(sub).toLocaleDateString("tr-TR",{day:"numeric",month:"long"}); }
function dayLabel(days){ return days === 0 ? "Bugün" : days === 1 ? "Yarın" : `${days} gün`; }
function cycleLabel(cycle){ return cycle === "yearly" ? "yıllık" : "aylık"; }

const VIEWS = [
  { id:"ozet", label:"Özet", Icon:LayoutGrid },
  { id:"abonelikler", label:"Abonelikler", Icon:List },
  { id:"takvim", label:"Takvim", Icon:CalendarDays },
];
const viewFromHash = () => { const h = location.hash.replace("#",""); return VIEWS.some(v=>v.id===h) ? h : "ozet"; };

function DuePill({ days }){
  const tone = days <= 1 ? "pill pillDanger" : days <= 7 ? "pill pillWarn" : "pill";
  return <span className={tone}>{dayLabel(days)}</span>;
}

export default function App(){
  const [user,setUser]=useState(null);
  const [subs,setSubs]=useState(readLocalSubs);
  const [query,setQuery]=useState("");
  const [categoryFilter,setCategoryFilter]=useState("Tümü");
  const [cardFilter,setCardFilter]=useState("Tümü");
  const [syncState,setSyncState]=useState("local");
  const [sheet,setSheet]=useState({ open:false, editing:null });
  const [menuOpen,setMenuOpen]=useState(false);
  const [view,setViewState]=useState(viewFromHash);
  const [toast,setToast]=useState("");
  const toastTimer=useRef(null);
  const importRef=useRef(null);

  // Sekmeler adres çubuğuna yazılır; tarayıcının geri tuşu beklendiği gibi çalışır
  useEffect(() => { const on = () => setViewState(viewFromHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  function setView(id){ if(id === view) return; history.pushState(null, "", `#${id}`); setViewState(id); window.scrollTo({ top:0 }); }

  useEffect(() => { if(!firebaseReady) return; return onAuthStateChanged(auth, current => setUser(current)); }, []);
  useEffect(() => { startForegroundNotifications(); }, []);
  useEffect(() => {
    if(!user || !("Notification" in window) || Notification.permission !== "granted") return;
    if(sessionStorage.getItem("notification-token-refreshed") === user.uid) return;
    sessionStorage.setItem("notification-token-refreshed", user.uid);
    enableNotifications(user, { silent:true });
  }, [user]);

  useEffect(() => { if(!user || !db) localStorage.setItem(LOCAL_KEY, JSON.stringify(subs)); }, [subs,user]);
  useEffect(() => {
    if(!user || !db) return;
    setSyncState("syncing");
    const ref = collection(db, "users", user.uid, "subscriptions");
    return onSnapshot(ref, snap => { setSubs(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setSyncState("cloud"); }, () => setSyncState("error"));
  }, [user]);
  useEffect(() => { if(!user) setSyncState("local"); }, [user]);

  function showToast(message){ clearTimeout(toastTimer.current); setToast(message); toastTimer.current=setTimeout(() => setToast(""), 2600); }
  async function googleLogin(){ if(firebaseReady) await signInWithPopup(auth, googleProvider).catch(()=>{}); }
  async function logout(){ setMenuOpen(false); await signOut(auth); }

  async function persistSub(sub){
    if(user && db) await setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt: serverTimestamp()});
    else setSubs(current => current.some(item => item.id === sub.id) ? current.map(item => item.id === sub.id ? sub : item) : [...current, sub]);
  }

  async function saveSub(form){
    const p = detectPlatform(form.name);
    const editingId = sheet.editing?.id;
    const sub = {
      ...form,
      id: editingId || crypto.randomUUID(),
      name: form.name.trim(),
      price: Number(form.price),
      paymentDay: Number(form.paymentDay),
      paymentMonth: Number(form.paymentMonth || new Date().getMonth()+1),
      category: form.category.trim() || p?.category || "Dijital",
      card: form.card.trim() || "Belirtilmedi",
      color: form.color || p?.color || "#2563eb",
      iconType: form.iconType || "auto",
      customIcon: (form.customIcon || "").trim()
    };
    delete sub.updatedAt;
    await persistSub(sub);
    setSheet({ open:false, editing:null });
    showToast(editingId ? "Abonelik güncellendi" : "Abonelik eklendi");
  }
  async function removeSub(sub){
    if(user && db) await deleteDoc(doc(db,"users",user.uid,"subscriptions",sub.id)); else setSubs(current=>current.filter(s=>s.id!==sub.id));
    setSheet({ open:false, editing:null });
    showToast(`${sub.name} silindi`);
  }
  const openNew = () => setSheet({ open:true, editing:null });
  const openEdit = (sub) => setSheet({ open:true, editing:sub });

  const daysMap=useMemo(()=>new Map(subs.map(s=>[s.id,daysUntil(s)])),[subs]);
  const daysOf=s=>daysMap.get(s.id) ?? daysUntil(s);
  const monthlyCost=s=>s.cycle==="yearly"?toTry(s.price,s.currency)/12:toTry(s.price,s.currency);
  // Girişten önce bu cihazda eklenmiş ve bulutta henüz olmayan kayıtlar
  const pendingLocal=useMemo(()=>{
    if(!user || syncState!=="cloud") return [];
    const cloudIds=new Set(subs.map(s=>s.id));
    return readLocalSubs().filter(l=>l && l.id && l.name && !cloudIds.has(l.id));
  },[user,subs,syncState]);
  async function migrateLocal(){
    if(!user || !db || !pendingLocal.length) return;
    await Promise.all(pendingLocal.map(sub=>setDoc(doc(db,"users",user.uid,"subscriptions",sub.id), {...sub, updatedAt:serverTimestamp()})));
    showToast(`${pendingLocal.length} kayıt buluta aktarıldı`);
  }

  const categories=useMemo(()=>[...new Set(subs.map(s=>s.category).filter(Boolean))],[subs]);
  const cards=useMemo(()=>[...new Set(subs.map(s=>s.card||"Belirtilmedi"))],[subs]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("tr");
    return subs.filter(s=>{
      const text=`${s.name} ${s.category} ${s.card}`.toLocaleLowerCase("tr");
      return text.includes(q) && (categoryFilter==="Tümü"||s.category===categoryFilter) && (cardFilter==="Tümü"||(s.card||"Belirtilmedi")===cardFilter);
    }).sort((a,b)=>daysOf(a)-daysOf(b));
  },[subs,daysMap,query,categoryFilter,cardFilter]);
  const filtersActive = query || categoryFilter!=="Tümü" || cardFilter!=="Tümü";
  const clearFilters = () => { setQuery(""); setCategoryFilter("Tümü"); setCardFilter("Tümü"); };

  const monthlyTotal=useMemo(()=>subs.reduce((sum,s)=>sum+monthlyCost(s),0),[subs]);
  const yearlyTotal=monthlyTotal*12;
  const upcoming=useMemo(()=>[...subs].sort((a,b)=>daysOf(a)-daysOf(b)).slice(0,5),[subs,daysMap]);
  const categoryTotals=useMemo(()=>{ const map={}; subs.forEach(s=>{ map[s.category]=(map[s.category]||0)+monthlyCost(s); }); return Object.entries(map).sort((a,b)=>b[1]-a[1]); },[subs]);
  const maxCat=Math.max(...categoryTotals.map(([,v])=>v),1);
  const dueSoon=useMemo(()=>subs.filter(s=>daysOf(s)<=7),[subs,daysMap]);
  const dueSoonTotal=dueSoon.reduce((sum,s)=>sum+toTry(s.price,s.currency),0);
  // Bu ay: tüm aylıklar + ödeme ayı bu ay olan yıllıklar
  const thisMonthTotal=useMemo(()=>{ const m=new Date().getMonth()+1; return subs.reduce((sum,s)=>sum+(s.cycle==="yearly"?(Number(s.paymentMonth)===m?toTry(s.price,s.currency):0):toTry(s.price,s.currency)),0); },[subs]);

  function download(blob,name){ const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
  function exportCsv(){
    const rows=[["Platform","Tutar","Para Birimi","Periyot","Ödeme Günü","Ödeme Ayı","Kategori","Kart","İkon Tipi","İkon"],...subs.map(s=>[s.name,s.price,s.currency,s.cycle,s.paymentDay,s.paymentMonth||"",s.category,s.card,s.iconType||"auto",s.customIcon||""])];
    const csv=rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
    download(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}),"abonelikler.csv"); showToast("CSV indirildi");
  }
  function exportJson(){ download(new Blob([JSON.stringify(subs,null,2)],{type:"application/json"}),"abonelikler-yedek.json"); showToast("Yedek indirildi"); }
  function importJson(e){
    const input=e.target; const file=input.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const parsed=JSON.parse(reader.result);
        if(!Array.isArray(parsed)){ showToast("Yedek okunamadı"); return; }
        const arr=parsed.filter(s=>s && s.name).map(s=>({...s, id:s.id||crypto.randomUUID()}));
        if(user&&db) await Promise.all(arr.map(s=>setDoc(doc(db,"users",user.uid,"subscriptions",s.id), s)));
        else setSubs(arr);
        setMenuOpen(false); showToast(`${arr.length} kayıt içe aktarıldı`);
      }catch{ showToast("Yedek okunamadı"); }
      finally{ input.value=""; }
    };
    reader.readAsText(file);
  }

  const sync = user
    ? syncState==="cloud" ? { Icon:Cloud, label:"Senkronize", tone:"ok" }
      : syncState==="error" ? { Icon:CloudOff, label:"Bağlantı hatası", tone:"err" }
      : { Icon:RefreshCw, label:"Eşitleniyor", tone:"busy" }
    : { Icon:CloudOff, label:"Bu cihazda", tone:"local" };
  const total = moneyParts(monthlyTotal);

  /* ---------- Görünümler ---------- */

  const overview = (
    <div className="stack">
      <section className="hero card" aria-labelledby="hero-label">
        <div className="heroMain">
          <span className="eyebrow" id="hero-label">Aylık toplam</span>
          <p className="heroValue num"><span>{total.int}</span><small>,{total.dec} ₺</small></p>
          <p className="heroSub">{subs.length ? `${subs.length} aktif abonelik` : "Henüz abonelik yok"}</p>
        </div>
        <dl className="stats">
          <div className="stat"><dt>Bu ay ödenecek</dt><dd className="num">{money(thisMonthTotal)}</dd></div>
          <div className="stat"><dt>7 gün içinde</dt><dd className="num">{dueSoon.length} ödeme</dd>{dueSoon.length>0 && <span className="statNote num">{money(dueSoonTotal)}</span>}</div>
          <div className="stat"><dt>Yıllık toplam</dt><dd className="num">{money(yearlyTotal)}</dd></div>
        </dl>
      </section>

      {pendingLocal.length>0 && (
        <div className="banner" role="status">
          <Cloud size={20} aria-hidden="true"/>
          <p>Bu cihazda bulutta olmayan <strong>{pendingLocal.length} kayıt</strong> var.</p>
          <button className="btn btnPrimary btnSm" onClick={migrateLocal}>Buluta aktar</button>
        </div>
      )}

      {!subs.length ? <EmptyStart onAdd={openNew}/> : (
        <div className="split">
          <section className="card" aria-labelledby="up-title">
            <header className="cardHead"><h2 id="up-title">Sıradaki ödemeler</h2>
              <button className="btn btnLink" onClick={()=>{ clearFilters(); setView("abonelikler"); }}>Tümü <ChevronRight size={16} aria-hidden="true"/></button>
            </header>
            <ul className="rows">
              {upcoming.map(s => (
                <li key={s.id}>
                  <button className="row" onClick={()=>openEdit(s)}>
                    <Logo sub={s}/>
                    <span className="rowMain"><strong>{s.name}</strong><span>{shortDate(s)}</span></span>
                    <span className="rowEnd"><strong className="num">{priceLabel(s)}</strong><DuePill days={daysOf(s)}/></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="cat-title">
            <header className="cardHead"><h2 id="cat-title">Kategoriler</h2><span className="muted">aylık</span></header>
            <ul className="bars">
              {categoryTotals.map(([c,v]) => (
                <li key={c}>
                  <button className="barRow" onClick={()=>{ clearFilters(); setCategoryFilter(c); setView("abonelikler"); }} aria-label={`${c}: ${money(v)}, toplamın yüzde ${monthlyTotal ? Math.round(v/monthlyTotal*100) : 0}'i. Bu kategorideki abonelikleri göster`}>
                    <span className="barTop"><span>{c}</span><span className="num">{money(v)}</span></span>
                    <span className="barTrack"><motion.span className="barFill" initial={{scaleX:0}} animate={{scaleX:v/maxCat}} transition={{duration:.5, ease:[.2,.8,.2,1]}}/></span>
                    <span className="barPct num">%{monthlyTotal ? Math.round(v/monthlyTotal*100) : 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );

  const list = (
    <div className="stack">
      <header className="pageHead">
        <div><h1 className="pageTitle">Abonelikler</h1><p className="muted">{subs.length} kayıt · aylık {money(monthlyTotal)}</p></div>
        <button className="btn btnPrimary hideMobile" onClick={openNew}><Plus size={18} aria-hidden="true"/> Abonelik ekle</button>
      </header>

      {subs.length>0 && (
        <div className="toolbar">
          <label className="search">
            <Search size={18} aria-hidden="true"/>
            <span className="sr">Aboneliklerde ara</span>
            <input type="search" placeholder="Platform, kategori ya da kart ara" value={query} onChange={e=>setQuery(e.target.value)}/>
            {query && <button className="iconBtn iconBtnSm" onClick={()=>setQuery("")} aria-label="Aramayı temizle"><X size={16} aria-hidden="true"/></button>}
          </label>
          {cards.length>1 && (
            <label className="selectWrap">
              <span className="sr">Ödeme yöntemine göre filtrele</span>
              <select className="input" value={cardFilter} onChange={e=>setCardFilter(e.target.value)}>
                <option value="Tümü">Tüm kartlar</option>
                {cards.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          <div className="chips" role="group" aria-label="Kategori filtresi">
            {["Tümü",...categories].map(c => (
              <button key={c} className={categoryFilter===c ? "chip isOn" : "chip"} aria-pressed={categoryFilter===c} onClick={()=>setCategoryFilter(c)}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {!subs.length ? <EmptyStart onAdd={openNew}/> : filtered.length ? (
        <section className="card cardFlush" aria-label="Abonelik listesi">
          <ul className="rows">
            <AnimatePresence initial={false}>
              {filtered.map(s => {
                const days = daysOf(s);
                return (
                  <motion.li key={s.id} layout="position" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, transition:{duration:.12}}}>
                    <button className="row rowLg" onClick={()=>openEdit(s)} aria-label={`${s.name}, ${priceLabel(s)} ${cycleLabel(s.cycle)}, ${dayLabel(days)} sonra. Düzenle`}>
                      <Logo sub={s}/>
                      <span className="rowMain">
                        <strong>{s.name}</strong>
                        <span>{[s.category, s.card && s.card!=="Belirtilmedi" ? s.card : null].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="rowDate"><DuePill days={days}/><span className="muted">{shortDate(s)}</span></span>
                      <span className="rowEnd"><strong className="num">{priceLabel(s)}</strong><span className="muted">{cycleLabel(s.cycle)}</span></span>
                      <ChevronRight className="rowChevron" size={18} aria-hidden="true"/>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </section>
      ) : (
        <div className="empty card">
          <Inbox size={28} aria-hidden="true"/>
          <p><strong>Eşleşen abonelik yok.</strong></p>
          <button className="btn btnGhost" onClick={clearFilters}>Filtreleri temizle</button>
        </div>
      )}
      {filtersActive && filtered.length>0 && <p className="muted center">{filtered.length} sonuç · <button className="btn btnLink inline" onClick={clearFilters}>filtreleri temizle</button></p>}
    </div>
  );

  return <MotionConfig reducedMotion="user">
    <a href="#main" className="skip">İçeriğe geç</a>
    <div className="app">
      <header className="topbar">
        <div className="topbarInner">
          <div className="brand"><img src="/icon.svg" alt="" width="32" height="32"/><span>Abonelik Takip</span></div>
          <nav className="tabs tabsTop" aria-label="Bölümler">
            {VIEWS.map(({id,label,Icon}) => (
              <a key={id} href={`#${id}`} className={view===id ? "tab isOn" : "tab"} aria-current={view===id ? "page" : undefined}
                onClick={e=>{ e.preventDefault(); setView(id); }}><Icon size={18} aria-hidden="true"/>{label}</a>
            ))}
          </nav>
          <div className="topActions">
            <span className={`syncPill sync-${sync.tone}`} role="status"><sync.Icon size={16} aria-hidden="true"/><span>{sync.label}</span></span>
            {user ? (
              <button className="avatarBtn" onClick={()=>setMenuOpen(true)} aria-label="Hesap ve ayarlar" aria-haspopup="dialog">
                {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer"/> : <User size={20} aria-hidden="true"/>}
              </button>
            ) : (
              <>
                {firebaseReady && <button className="btn btnGhost btnSm hideMobile" onClick={googleLogin}><LogIn size={18} aria-hidden="true"/> Google ile gir</button>}
                <button className="iconBtn" onClick={()=>setMenuOpen(true)} aria-label="Daha fazla" aria-haspopup="dialog"><MoreHorizontal size={22} aria-hidden="true"/></button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="content" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, transition:{duration:.1}}} transition={{duration:.2, ease:"easeOut"}}>
            {view==="ozet" && overview}
            {view==="abonelikler" && list}
            {view==="takvim" && <Calendar subs={subs} Logo={Logo} toTry={toTry} onEdit={openEdit}/>}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="tabs tabsBottom" aria-label="Bölümler">
        {VIEWS.slice(0,2).map(({id,label,Icon}) => (
          <a key={id} href={`#${id}`} className={view===id ? "tab isOn" : "tab"} aria-current={view===id ? "page" : undefined} onClick={e=>{ e.preventDefault(); setView(id); }}><Icon size={22} aria-hidden="true"/><span>{label}</span></a>
        ))}
        <button className="fab" onClick={openNew} aria-label="Abonelik ekle"><Plus size={26} aria-hidden="true"/></button>
        {VIEWS.slice(2).map(({id,label,Icon}) => (
          <a key={id} href={`#${id}`} className={view===id ? "tab isOn" : "tab"} aria-current={view===id ? "page" : undefined} onClick={e=>{ e.preventDefault(); setView(id); }}><Icon size={22} aria-hidden="true"/><span>{label}</span></a>
        ))}
        <button className="tab" onClick={()=>setMenuOpen(true)} aria-haspopup="dialog"><MoreHorizontal size={22} aria-hidden="true"/><span>Daha fazla</span></button>
      </nav>
    </div>

    <SubscriptionSheet open={sheet.open} editing={sheet.editing} onClose={()=>setSheet({open:false, editing:null})}
      onSave={saveSub} onDelete={removeSub} categories={categories} cards={cards.filter(c=>c!=="Belirtilmedi")}/>

    <Sheet open={menuOpen} onClose={()=>setMenuOpen(false)} title={user ? (user.displayName || "Hesabın") : "Ayarlar"} labelledBy="menu-title"
      description={user ? user.email : "Kayıtların şu an yalnızca bu cihazda."}>
      <div className="menu">
        {user ? (
          <>
            <button className="menuItem" onClick={()=>{ enableNotifications(user); }}><Bell size={20} aria-hidden="true"/><span><strong>Bildirimleri aç</strong><small>Ödeme gününden önce hatırlat</small></span></button>
            {pendingLocal.length>0 && <button className="menuItem" onClick={migrateLocal}><Cloud size={20} aria-hidden="true"/><span><strong>Buluta aktar</strong><small>{pendingLocal.length} yerel kayıt</small></span></button>}
          </>
        ) : firebaseReady && (
          <button className="menuItem" onClick={()=>{ setMenuOpen(false); googleLogin(); }}><LogIn size={20} aria-hidden="true"/><span><strong>Google ile gir</strong><small>Cihazların arasında eşitle, bildirim al</small></span></button>
        )}
        <p className="menuLabel">Veri</p>
        <button className="menuItem" onClick={exportCsv} disabled={!subs.length}><Download size={20} aria-hidden="true"/><span><strong>CSV olarak indir</strong><small>Excel ve Numbers için</small></span></button>
        <button className="menuItem" onClick={exportJson} disabled={!subs.length}><Download size={20} aria-hidden="true"/><span><strong>Yedek indir</strong><small>JSON dosyası</small></span></button>
        <button className="menuItem" onClick={()=>importRef.current?.click()}><Upload size={20} aria-hidden="true"/><span><strong>Yedekten geri yükle</strong><small>JSON dosyası seç</small></span></button>
        <input ref={importRef} type="file" accept="application/json" onChange={importJson} hidden/>
        {user && <><p className="menuLabel">Hesap</p><button className="menuItem menuDanger" onClick={logout}><LogOut size={20} aria-hidden="true"/><span><strong>Çıkış yap</strong></span></button></>}
      </div>
    </Sheet>

    <div className="toastRegion" aria-live="polite">
      <AnimatePresence>{toast && <motion.div className="toast" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8,transition:{duration:.15}}}><Check size={18} aria-hidden="true"/>{toast}</motion.div>}</AnimatePresence>
    </div>
  </MotionConfig>;
}

function EmptyStart({ onAdd }){
  return (
    <div className="empty card emptyStart">
      <span className="emptyIcon" aria-hidden="true"><CalendarDays size={28}/></span>
      <h2>İlk aboneliğini ekle</h2>
      <p>Netflix, Spotify, iCloud… Ödeme günü yaklaşınca burada ve takvimde görünür.</p>
      <button className="btn btnPrimary" onClick={onAdd}><Plus size={18} aria-hidden="true"/> Abonelik ekle</button>
    </div>
  );
}
