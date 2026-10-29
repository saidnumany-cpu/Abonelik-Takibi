import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Cloud, CloudOff, Home, List, Loader2, Plus, Settings, Undo2, Wallet } from "lucide-react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider, firebaseReady } from "./firebase";
import { enableNotifications, startForegroundNotifications } from "./notifications";
import { download, loadRates, refreshRates, saveRates, summarize, toCsv } from "./lib/subs";
import Sheet from "./components/Sheet";
import SubscriptionForm from "./components/SubscriptionForm";
import Overview from "./components/Overview";
import SubscriptionList from "./components/SubscriptionList";
import CalendarView from "./components/CalendarView";
import SettingsBody from "./components/SettingsSheet";

const LOCAL_KEY = "abonelik-takip-local";
const VIEWS = [
  { id:"ozet", label:"Özet", Icon:Home },
  { id:"abonelikler", label:"Abonelikler", Icon:List },
  { id:"takvim", label:"Takvim", Icon:CalendarDays },
];
const viewFromHash = () => VIEWS.find(v => `#${v.id}` === location.hash)?.id || "ozet";
const readLocal = () => { try{ return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") || []; }catch{ return []; } };

export default function App(){
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseReady);
  const [subs, setSubs] = useState(readLocal);
  const [sync, setSync] = useState("local"); // local | syncing | cloud | error
  const [view, setView] = useState(viewFromHash);
  const [sheet, setSheet] = useState(null);   // { kind:"form", sub? } | { kind:"settings" }
  const [toast, setToast] = useState(null);
  const [rates, setRates] = useState(loadRates);
  const toastTimer = useRef();

  /* --- auth + veri --- */
  useEffect(() => {
    if(!firebaseReady) return;
    return onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
  }, []);

  useEffect(() => { startForegroundNotifications(); }, []);

  useEffect(() => {
    if(!user || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if(sessionStorage.getItem("notification-token-refreshed") === user.uid) return;
    sessionStorage.setItem("notification-token-refreshed", user.uid);
    enableNotifications(user);
  }, [user]);

  useEffect(() => {
    if(!user || !db){ setSync("local"); if(authReady) setSubs(readLocal()); return; }
    setSync("syncing");
    return onSnapshot(collection(db, "users", user.uid, "subscriptions"),
      snap => { setSubs(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setSync("cloud"); },
      () => setSync("error"));
  }, [user, authReady]);

  useEffect(() => {
    if(!user) try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(subs)); }catch{}
  }, [subs, user]);

  useEffect(() => {
    if(rates.source === "elle") return;
    refreshRates(rates).then(r => r !== rates && setRates(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- gezinme: hash = görünüm, history.state = açık sayfa (geri tuşu kapatır) --- */
  useEffect(() => {
    const onPop = () => { setView(viewFromHash()); setSheet(history.state?.sheet || null); };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("hashchange", onPop); };
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const openSheet = useCallback(s => { history.pushState({ sheet:s }, ""); setSheet(s); }, []);
  const closeSheet = useCallback(() => { if(history.state?.sheet) history.back(); else setSheet(null); }, []);

  /* --- bildirim balonu --- */
  const notify = useCallback((message, action) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action, id:Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2800);
  }, []);

  /* --- CRUD --- */
  async function persist(sub){
    if(user && db) await setDoc(doc(db, "users", user.uid, "subscriptions", sub.id), { ...sub, updatedAt:serverTimestamp() });
    else setSubs(cur => cur.some(s => s.id === sub.id) ? cur.map(s => s.id === sub.id ? sub : s) : [...cur, sub]);
  }
  async function save(data){
    const editing = sheet?.sub;
    const sub = { ...data, id: editing?.id || crypto.randomUUID() };
    delete sub.updatedAt;
    try{
      await persist(sub);
      closeSheet();
      notify(editing ? `${sub.name} güncellendi` : `${sub.name} eklendi`);
    }catch(e){ notify("Kaydedilemedi: " + e.message); }
  }
  async function remove(sub){
    try{
      if(user && db) await deleteDoc(doc(db, "users", user.uid, "subscriptions", sub.id));
      else setSubs(cur => cur.filter(s => s.id !== sub.id));
      closeSheet();
      const { updatedAt, ...restore } = sub;
      notify(`${sub.name} silindi`, { label:"Geri al", run:() => persist(restore).then(() => notify(`${sub.name} geri getirildi`)) });
    }catch(e){ notify("Silinemedi: " + e.message); }
  }

  /* --- ayarlar --- */
  const localForMigration = user ? readLocal() : [];
  async function migrate(){
    for(const s of localForMigration) await setDoc(doc(db, "users", user.uid, "subscriptions", s.id), { ...s, updatedAt:serverTimestamp() });
    localStorage.removeItem(LOCAL_KEY);
    notify(`${localForMigration.length} abonelik hesabına aktarıldı`);
    closeSheet();
  }
  function importFile(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try{
        const arr = JSON.parse(reader.result);
        if(!Array.isArray(arr)) throw new Error();
        const clean = arr.filter(s => s && s.name).map(s => ({ ...s, id:s.id || crypto.randomUUID() }));
        if(user && db) for(const s of clean) await setDoc(doc(db, "users", user.uid, "subscriptions", s.id), s);
        else setSubs(cur => [...cur.filter(c => !clean.some(n => n.id === c.id)), ...clean]);
        notify(`${clean.length} abonelik yüklendi`);
      }catch{ notify("Yedek dosyası okunamadı"); }
    };
    reader.readAsText(file);
  }
  async function turnOnNotifications(){ const r = await enableNotifications(user); if(r?.message) notify(r.message); }
  function setRatesAndSave(r){ saveRates(r); setRates(r); }
  async function forceRefresh(){
    const r = await refreshRates({ ...rates, source:"zorla" });
    if(r.source === "otomatik"){ setRates(r); notify("Kurlar güncellendi"); } else notify("Kur alınamadı, mevcut değerler korunuyor");
  }
  const stamp = new Date().toISOString().slice(0, 10);

  /* --- türetilmiş --- */
  const summary = useMemo(() => summarize(subs, rates.rates), [subs, rates]);
  const categories = useMemo(() => [...new Set(subs.map(s => s.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, "tr")), [subs]);
  const cards = useMemo(() => [...new Set(subs.map(s => s.card || "Belirtilmedi"))].sort((a,b) => a.localeCompare(b, "tr")), [subs]);

  const addNew = () => openSheet({ kind:"form" });
  const edit = sub => openSheet({ kind:"form", sub });
  const syncInfo = {
    local:{ Icon:CloudOff, text:"Bu cihazda" },
    syncing:{ Icon:Loader2, text:"Eşitleniyor" },
    cloud:{ Icon:Cloud, text:"Eşitlendi" },
    error:{ Icon:CloudOff, text:"Eşitleme hatası" },
  }[sync];

  return <MotionConfig reducedMotion="user">
    <a href="#icerik" className="skip">İçeriğe geç</a>
    <div className="shell">
      <aside className="side" aria-label="Ana menü">
        <div className="brand"><span className="brand__mark" aria-hidden="true"><Wallet size={20}/></span><span>Abonelik Takip</span></div>
        <nav className="nav">
          {VIEWS.map(({ id, label, Icon }) => <a key={id} href={`#${id}`} className="nav__item" aria-current={view === id ? "page" : undefined}>
            <Icon size={20} aria-hidden="true"/><span>{label}</span>
          </a>)}
        </nav>
        <button type="button" className="btn btn--primary side__add" onClick={addNew}><Plus size={18} aria-hidden="true"/> Abonelik ekle</button>
      </aside>

      <header className="top">
        <h1 className="top__title">{VIEWS.find(v => v.id === view).label}</h1>
        <div className="top__actions">
          <button type="button" className={`sync sync--${sync}`} onClick={() => openSheet({ kind:"settings" })} aria-label={`Eşitleme: ${syncInfo.text}. Hesap ayarları`}><syncInfo.Icon size={16} aria-hidden="true" className={sync === "syncing" ? "spin" : undefined}/><span>{syncInfo.text}</span></button>
          <button type="button" className="iconBtn" onClick={() => openSheet({ kind:"settings" })} aria-label="Ayarlar ve hesap"><Settings size={20} aria-hidden="true"/></button>
          <button type="button" className="iconBtn iconBtn--primary top__add" onClick={addNew} aria-label="Abonelik ekle"><Plus size={22} aria-hidden="true"/></button>
        </div>
      </header>

      <main id="icerik" className="main" tabIndex={-1}>
        {!authReady ? <div className="loading" role="status"><Loader2 className="spin" aria-hidden="true"/> Yükleniyor…</div>
          : view === "ozet" ? <Overview subs={subs} summary={summary} onEdit={edit} onAdd={addNew}/>
          : view === "abonelikler" ? <SubscriptionList subs={subs} rates={rates.rates} categories={categories} cards={cards} onEdit={edit} onAdd={addNew}/>
          : <CalendarView subs={subs} rates={rates.rates} onEdit={edit}/>}
      </main>

      <nav className="tabs" aria-label="Sekmeler">
        {VIEWS.map(({ id, label, Icon }) => <a key={id} href={`#${id}`} className="tabs__item" aria-current={view === id ? "page" : undefined}>
          <Icon size={22} aria-hidden="true"/><span>{label}</span>
        </a>)}
      </nav>
    </div>

    <Sheet open={sheet?.kind === "form"} title={sheet?.sub ? "Aboneliği düzenle" : "Yeni abonelik"} onClose={closeSheet}
      footer={<>
        <button type="button" className="btn btn--ghost" onClick={closeSheet}>Vazgeç</button>
        <button type="submit" form="sub-form" className="btn btn--primary">{sheet?.sub ? "Kaydet" : "Ekle"}</button>
      </>}>
      {sheet?.kind === "form" && <SubscriptionForm key={sheet.sub?.id || "new"} initial={sheet.sub} categories={categories} cards={cards} rates={rates.rates} onSubmit={save} onDelete={remove}/>}
    </Sheet>

    <Sheet open={sheet?.kind === "settings"} title="Ayarlar" onClose={closeSheet}>
      {sheet?.kind === "settings" && <SettingsBody user={user} firebaseReady={firebaseReady} localCount={localForMigration.length}
        rates={rates} onRates={setRatesAndSave} onRefreshRates={forceRefresh}
        onLogin={() => signInWithPopup(auth, googleProvider).catch(e => notify("Giriş yapılamadı: " + e.code))}
        onLogout={() => signOut(auth).then(() => notify("Çıkış yapıldı"))}
        onNotify={turnOnNotifications}
        onExportCsv={() => download(`abonelikler-${stamp}.csv`, "﻿" + toCsv(subs), "text/csv;charset=utf-8")}
        onExportJson={() => download(`abonelikler-yedek-${stamp}.json`, JSON.stringify(subs.map(({ updatedAt, ...s }) => s), null, 2), "application/json")}
        onImport={importFile} onMigrate={migrate}/>}
    </Sheet>

    <div className="toastWrap" aria-live="polite">
      <AnimatePresence>
        {toast && <motion.div key={toast.id} className="toast" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }} transition={{ duration:.18 }}>
          <span>{toast.message}</span>
          {toast.action && <button type="button" onClick={() => { toast.action.run(); setToast(null); }}><Undo2 size={16} aria-hidden="true"/> {toast.action.label}</button>}
        </motion.div>}
      </AnimatePresence>
    </div>
  </MotionConfig>;
}
