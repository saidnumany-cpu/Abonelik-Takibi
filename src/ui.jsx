import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/* ---------- Abonelik logosu ---------- */

export const platformMap = {
  netflix:{icon:"N",color:"#e50914",category:"Film/Dizi"}, spotify:{icon:"S",color:"#1db954",category:"Müzik"},
  icloud:{icon:"iC",color:"#3b82f6",category:"Bulut"}, youtube:{icon:"YT",color:"#ff0033",category:"Video"},
  disney:{icon:"D+",color:"#113ccf",category:"Film/Dizi"}, adobe:{icon:"A",color:"#fa0f00",category:"Tasarım"},
  chatgpt:{icon:"AI",color:"#10a37f",category:"Yapay Zeka"}, ps:{icon:"PS",color:"#006fcd",category:"Oyun"},
  prime:{icon:"P",color:"#00a8e1",category:"Alışveriş"}, amazon:{icon:"P",color:"#00a8e1",category:"Alışveriş"},
  hepsiburada:{icon:"hb",color:"#ff6000",category:"Alışveriş"}, google:{icon:"G",color:"#4285f4",category:"Bulut"},
  apple:{icon:"A",color:"#f5f5f7",category:"Apple"}, figma:{icon:"F",color:"#a259ff",category:"Tasarım"}
};

// En uzun eşleşen anahtar kazanır ("hepsiburada" içindeki "ps" PlayStation sanılmasın)
const platformKeys = Object.keys(platformMap).sort((a,b)=>b.length-a.length);
export function detectPlatform(name=""){ const lower = name.toLowerCase(); const key = platformKeys.find(k => lower.includes(k)); return key ? platformMap[key] : null; }

function isImageIcon(sub){ return sub.iconType === "image" && /^https?:\/\//i.test((sub.customIcon || "").trim()); }
function iconText(sub){
  if(sub.iconType === "emoji" && (sub.customIcon || "").trim()) return sub.customIcon.trim();
  return detectPlatform(sub.name)?.icon || (sub.name || "?").slice(0,2).toUpperCase();
}
// Açık renk zeminde koyu yazı (ör. Apple'ın açık grisi), diğerlerinde beyaz
export function readableOn(hex="#000"){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if(!m) return "#fff";
  const n = parseInt(m[1],16); const ch = [n>>16, (n>>8)&255, n&255].map(v => { v/=255; return v<=.03928 ? v/12.92 : ((v+.055)/1.055)**2.4; });
  const L = .2126*ch[0] + .7152*ch[1] + .0722*ch[2];
  return L > .45 ? "#0b1220" : "#fff";
}

// Görsel yüklenemezse sırayla: doğrudan adres → görsel proxy'si (hotlink engeli / http adresleri için) → harf ikonu
function imageSources(url){
  const clean = url.trim();
  const https = clean.replace(/^http:\/\//i, "https://");
  return [https, `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=128&h=128&fit=cover&output=png`];
}

export function Logo({ sub, size="md" }){
  const url = isImageIcon(sub) ? sub.customIcon.trim() : "";
  const [attempt,setAttempt] = useState(0);
  useEffect(()=>{ setAttempt(0); },[url]);
  const sources = url ? imageSources(url) : [];
  const image = attempt < sources.length;
  const color = sub.color || "#64748b";
  return (
    <span className={`logo logo-${size}${image ? " logo-image" : ""}`} aria-hidden="true"
      style={image ? undefined : { background: color, color: readableOn(color) }}>
      {image
        ? <img key={sources[attempt]} src={sources[attempt]} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={()=>setAttempt(a=>a+1)}/>
        : <span>{iconText(sub)}</span>}
    </span>
  );
}

/* ---------- Diyalog / alt sayfa ----------
   Masaüstünde ortada, telefonda alttan açılan sayfa. Esc kapatır,
   odak içeride kalır, kapanınca açan düğmeye geri döner. */

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onClose, title, description, children, footer, labelledBy="sheet-title", initialFocus }){
  const panelRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if(!open) return;
    lastFocus.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const panel = panelRef.current; if(!panel) return;
      const target = (initialFocus && panel.querySelector(initialFocus)) || panel.querySelector(FOCUSABLE);
      target?.focus({ preventScroll:true });
    }, 30);
    function onKey(e){
      if(e.key === "Escape"){ e.preventDefault(); onClose(); return; }
      if(e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if(!items.length) return;
      const first = items[0], last = items[items.length-1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      lastFocus.current?.focus?.({ preventScroll:true });
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <div className="sheetLayer">
          <motion.div className="scrim" onClick={onClose}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0, transition:{duration:.15}}} transition={{duration:.2}}/>
          <motion.div ref={panelRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}
            initial={{opacity:0, y:32}} animate={{opacity:1, y:0}} exit={{opacity:0, y:24, transition:{duration:.15, ease:"easeIn"}}}
            transition={{type:"spring", stiffness:420, damping:38}}>
            <div className="sheetGrip" aria-hidden="true"/>
            <header className="sheetHead">
              <div>
                <h2 id={labelledBy}>{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button type="button" className="iconBtn" onClick={onClose} aria-label="Kapat"><X size={20} aria-hidden="true"/></button>
            </header>
            <div className="sheetBody">{children}</div>
            {footer && <footer className="sheetFoot">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Segment kontrol (radyo grubu) ---------- */
export function Segmented({ label, value, options, onChange, name }){
  return (
    <fieldset className="field">
      <legend className="fieldLabel">{label}</legend>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <label key={o.value} className={value === o.value ? "seg isOn" : "seg"}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)}/>
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
