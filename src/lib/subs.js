// Abonelik verisi için saf yardımcılar. Firestore şeması değişmedi:
// { id, name, price, currency, cycle, paymentDay, paymentMonth, category, card, color, iconType, customIcon }

export const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
export const WEEKDAYS = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
export const CURRENCIES = ["TRY","USD","EUR"];
export const SWATCHES = ["#2563eb","#7c3aed","#db2777","#dc2626","#ea580c","#ca8a04","#16a34a","#0891b2","#475569"];

// Bilinen platformlar: renk + kategori + harf. Emoji yok; logo yerine monogram.
const PLATFORMS = {
  netflix:{mono:"N",color:"#e50914",category:"Film/Dizi"},
  spotify:{mono:"S",color:"#1db954",category:"Müzik"},
  icloud:{mono:"iC",color:"#3b82f6",category:"Bulut"},
  youtube:{mono:"YT",color:"#ff0033",category:"Video"},
  disney:{mono:"D+",color:"#113ccf",category:"Film/Dizi"},
  adobe:{mono:"A",color:"#fa0f00",category:"Tasarım"},
  chatgpt:{mono:"AI",color:"#10a37f",category:"Yapay Zeka"},
  claude:{mono:"C",color:"#d97757",category:"Yapay Zeka"},
  ps:{mono:"PS",color:"#006fcd",category:"Oyun"},
  xbox:{mono:"X",color:"#107c10",category:"Oyun"},
  prime:{mono:"P",color:"#00a8e1",category:"Alışveriş"},
  amazon:{mono:"P",color:"#00a8e1",category:"Alışveriş"},
  hepsiburada:{mono:"hb",color:"#ff6000",category:"Alışveriş"},
  trendyol:{mono:"T",color:"#f27a1a",category:"Alışveriş"},
  google:{mono:"G",color:"#4285f4",category:"Bulut"},
  apple:{mono:"A",color:"#1d1d1f",category:"Apple"},
  figma:{mono:"F",color:"#a259ff",category:"Tasarım"},
  exxen:{mono:"E",color:"#f5c400",category:"Film/Dizi"},
  blutv:{mono:"B",color:"#0f6fff",category:"Film/Dizi"},
  gain:{mono:"G",color:"#7b2ff7",category:"Film/Dizi"},
};
export const PLATFORM_NAMES = ["Netflix","Spotify","iCloud+","YouTube Premium","Disney+","Adobe","ChatGPT","Claude","PlayStation Plus","Xbox Game Pass","Amazon Prime","Hepsiburada Premium","Trendyol Plus","Google One","Apple Music","Figma","Exxen","BluTV","Gain"];

export function detectPlatform(name = ""){
  const n = name.toLowerCase().replace(/\s+/g,"");
  const key = Object.keys(PLATFORMS).find(k => n.includes(k));
  return key ? PLATFORMS[key] : null;
}

export function monogram(sub){
  if(sub.iconType === "emoji" && (sub.customIcon || "").trim()) return sub.customIcon.trim();
  const p = detectPlatform(sub.name);
  if(p) return p.mono;
  const words = (sub.name || "?").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0,2)).toUpperCase();
}

export function isImageIcon(sub){
  return sub.iconType === "image" && /^https:\/\//i.test((sub.customIcon || "").trim());
}

// Arka plana göre okunur yazı rengi (WCAG göreli parlaklık).
export function readableOn(hex = "#475569"){
  const m = hex.replace("#","").match(/.{2}/g);
  if(!m || m.length < 3) return "#fff";
  const [r,g,b] = m.slice(0,3).map(x => { const c = parseInt(x,16)/255; return c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4; });
  const L = .2126*r + .7152*g + .0722*b;
  return (L + .05) / .05 > 1.05 / (L + .05) ? "#0b1120" : "#ffffff";
}

/* ---------- Kur ---------- */
const DEFAULT_RATES = { TRY:1, USD:32.5, EUR:35 };
const RATES_KEY = "abonelik-kurlar";

export function loadRates(){
  try{
    const saved = JSON.parse(localStorage.getItem(RATES_KEY) || "null");
    if(saved?.rates) return saved;
  }catch{}
  return { rates:DEFAULT_RATES, source:"varsayılan", at:null };
}
export function saveRates(obj){ try{ localStorage.setItem(RATES_KEY, JSON.stringify(obj)); }catch{} }

// Günde bir kez ECB kaynaklı kur çeker; başarısız olursa eldekini korur.
export async function refreshRates(current){
  const today = new Date().toISOString().slice(0,10);
  if(current.source === "otomatik" && current.at === today) return current;
  try{
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR");
    if(!res.ok) throw new Error(res.status);
    const j = await res.json();
    const usd = j.rates.TRY, eur = j.rates.TRY / j.rates.EUR;
    if(!usd || !eur) throw new Error("eksik");
    const next = { rates:{ TRY:1, USD:+usd.toFixed(4), EUR:+eur.toFixed(4) }, source:"otomatik", at:today };
    saveRates(next);
    return next;
  }catch{
    return current;
  }
}

export const toTry = (price, currency, rates) => Number(price || 0) * (rates[currency || "TRY"] || 1);
export const monthlyTry = (sub, rates) => toTry(sub.price, sub.currency, rates) / (sub.cycle === "yearly" ? 12 : 1);

/* ---------- Biçim ---------- */
const tl = new Intl.NumberFormat("tr-TR",{ style:"currency", currency:"TRY", minimumFractionDigits:2, maximumFractionDigits:2 });
export const money = v => tl.format(v || 0);
export function priceLabel(sub){
  const cur = sub.currency || "TRY";
  return new Intl.NumberFormat("tr-TR",{ style:"currency", currency:cur, minimumFractionDigits:2, maximumFractionDigits:2 }).format(Number(sub.price || 0));
}
export const cycleLabel = c => c === "yearly" ? "yıllık" : "aylık";

/* ---------- Tarih ---------- */
export function startOfDay(d = new Date()){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
const clampDay = d => Math.min(Math.max(Number(d || 1),1),28);
const clampMonth = m => Math.min(Math.max(Number(m || 1),1),12);

export function nextPaymentDate(sub, from = new Date()){
  const today = startOfDay(from);
  const day = clampDay(sub.paymentDay);
  if(sub.cycle === "yearly"){
    const month = clampMonth(sub.paymentMonth) - 1;
    let d = new Date(today.getFullYear(), month, day);
    if(d < today) d = new Date(today.getFullYear()+1, month, day);
    return d;
  }
  let d = new Date(today.getFullYear(), today.getMonth(), day);
  if(d < today) d = new Date(today.getFullYear(), today.getMonth()+1, day);
  return d;
}
export const daysUntil = (sub, from = new Date()) => Math.round((nextPaymentDate(sub, from) - startOfDay(from)) / 86400000);

export function dueLabel(days){
  if(days === 0) return "Bugün";
  if(days === 1) return "Yarın";
  return `${days} gün`;
}
export const fmtDate = (d, opts = { day:"numeric", month:"long" }) => d.toLocaleDateString("tr-TR", opts);

// Belirli bir ayda ödemesi düşen abonelikler (takvim için).
export function paymentsInMonth(subs, year, month){
  const map = {};
  for(const s of subs){
    if(s.cycle === "yearly" && clampMonth(s.paymentMonth) - 1 !== month) continue;
    const d = clampDay(s.paymentDay);
    (map[d] ||= []).push(s);
  }
  return map;
}

/* ---------- Özetler ---------- */
export function summarize(subs, rates){
  const today = startOfDay();
  const monthly = subs.reduce((t,s) => t + monthlyTry(s, rates), 0);
  const next30 = subs.reduce((t,s) => daysUntil(s, today) <= 30 ? t + toTry(s.price, s.currency, rates) : t, 0);
  const dueSoon = subs.filter(s => daysUntil(s, today) <= 7);
  const byCat = {};
  subs.forEach(s => { const c = s.category || "Diğer"; byCat[c] = (byCat[c] || 0) + monthlyTry(s, rates); });
  const categories = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
  return { monthly, yearly: monthly * 12, next30, dueSoon, categories };
}

export const emptyForm = () => ({
  name:"", price:"", currency:"TRY", cycle:"monthly", paymentDay:"",
  paymentMonth:new Date().getMonth() + 1, category:"", card:"", color:SWATCHES[0],
  iconType:"auto", customIcon:""
});

export function validate(form){
  const e = {};
  if(!form.name.trim()) e.name = "Platform adını yaz.";
  const p = Number(String(form.price).replace(",", "."));
  if(!form.price || !(p > 0)) e.price = "0'dan büyük bir tutar gir.";
  const d = Number(form.paymentDay);
  if(!form.paymentDay || !Number.isInteger(d) || d < 1 || d > 28) e.paymentDay = "1 ile 28 arasında bir gün seç.";
  if(form.iconType === "image" && !/^https:\/\//i.test(form.customIcon.trim())) e.customIcon = "Görsel adresi https:// ile başlamalı.";
  return e;
}

export function toCsv(subs){
  const rows = [["Platform","Tutar","Para Birimi","Periyot","Ödeme Günü","Ödeme Ayı","Kategori","Kart","İkon Tipi","İkon"],
    ...subs.map(s => [s.name,s.price,s.currency,s.cycle,s.paymentDay,s.paymentMonth || "",s.category,s.card,s.iconType || "auto",s.customIcon || ""])];
  return rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
}

export function download(name, content, type){
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
