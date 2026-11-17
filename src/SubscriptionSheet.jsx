import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Sheet, Segmented, Logo, detectPlatform } from "./ui.jsx";

const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const SWATCHES = ["#2563eb","#7c3aed","#db2777","#e11d48","#ea580c","#ca8a04","#16a34a","#0891b2","#475569"];
const DEFAULT_CATEGORIES = ["Film/Dizi","Müzik","Video","Bulut","Yapay Zeka","Tasarım","Oyun","Alışveriş","Dijital"];

export const emptyForm = () => ({
  name:"", price:"", currency:"TRY", cycle:"monthly", paymentDay:"",
  paymentMonth:new Date().getMonth() + 1, category:"Dijital", card:"", color:"#2563eb",
  iconType:"auto", customIcon:""
});

function validate(f){
  const e = {};
  if(!f.name.trim()) e.name = "Platform adını yaz.";
  if(f.price === "" || Number(f.price) <= 0) e.price = "0'dan büyük bir tutar gir.";
  const d = Number(f.paymentDay);
  if(!f.paymentDay || !Number.isInteger(d) || d < 1 || d > 28) e.paymentDay = "1 ile 28 arasında bir gün gir.";
  if(f.iconType === "image" && f.customIcon && !/^https?:\/\//i.test(f.customIcon.trim())) e.customIcon = "Adres http:// ya da https:// ile başlamalı.";
  return e;
}

export default function SubscriptionSheet({ open, editing, onClose, onSave, onDelete, categories, cards }){
  const [form,setForm] = useState(emptyForm);
  const [errors,setErrors] = useState({});
  const [saving,setSaving] = useState(false);
  const [confirmDelete,setConfirmDelete] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if(!open) return;
    setErrors({}); setSaving(false); setConfirmDelete(false);
    setForm(editing
      ? { ...emptyForm(), ...editing, price:String(editing.price), paymentDay:String(editing.paymentDay), paymentMonth:Number(editing.paymentMonth) || new Date().getMonth()+1, card: editing.card === "Belirtilmedi" ? "" : (editing.card || "") }
      : emptyForm());
  }, [open, editing]);

  const set = (patch) => { setForm(f => ({ ...f, ...patch })); setErrors(e => { const n = { ...e }; Object.keys(patch).forEach(k => delete n[k]); return n; }); };

  function handleName(value){
    const p = detectPlatform(value);
    set(p ? { name:value, category:p.category, color:p.color } : { name:value });
  }

  async function submit(e){
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if(Object.keys(errs).length){
      const first = Object.keys(errs)[0];
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
      return;
    }
    setSaving(true);
    try{ await onSave(form); }
    catch{ setSaving(false); setErrors({ form:"Kaydedilemedi. Bağlantını kontrol edip tekrar dene." }); }
  }

  async function doDelete(){
    setSaving(true);
    try{ await onDelete(editing); }
    catch{ setSaving(false); setErrors({ form:"Silinemedi. Tekrar dene." }); }
  }

  const err = (k) => errors[k] ? { "aria-invalid":true, "aria-describedby":`${k}-err` } : {};
  const Msg = ({ k }) => errors[k] ? <p className="fieldError" id={`${k}-err`}><AlertCircle size={14} aria-hidden="true"/>{errors[k]}</p> : null;
  const categoryOptions = [...new Set([...categories, ...DEFAULT_CATEGORIES])];
  const preview = { ...form, name: form.name || "?" };

  const footer = confirmDelete ? (
    <div className="confirmRow" role="alert">
      <p><strong>{editing?.name}</strong> silinsin mi? Bu işlem geri alınamaz.</p>
      <div className="btnRow">
        <button type="button" className="btn btnGhost" onClick={() => setConfirmDelete(false)} disabled={saving}>Vazgeç</button>
        <button type="button" className="btn btnDanger" onClick={doDelete} disabled={saving}>
          {saving ? <Loader2 className="spin" size={18} aria-hidden="true"/> : <Trash2 size={18} aria-hidden="true"/>} Sil
        </button>
      </div>
    </div>
  ) : (
    <div className="btnRow">
      {editing && <button type="button" className="btn btnGhost btnDangerText" onClick={() => setConfirmDelete(true)} disabled={saving}><Trash2 size={18} aria-hidden="true"/> Sil</button>}
      <button type="submit" form="sub-form" className="btn btnPrimary grow" disabled={saving}>
        {saving ? <><Loader2 className="spin" size={18} aria-hidden="true"/> Kaydediliyor…</>
          : editing ? <><Check size={18} aria-hidden="true"/> Değişiklikleri kaydet</>
          : <><Plus size={18} aria-hidden="true"/> Aboneliği ekle</>}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Aboneliği düzenle" : "Yeni abonelik"} labelledBy="sub-sheet-title" footer={footer}>
      <form id="sub-form" ref={formRef} onSubmit={submit} noValidate className="formStack">
        {errors.form && <p className="formError" role="alert"><AlertCircle size={16} aria-hidden="true"/>{errors.form}</p>}

        <div className="previewRow">
          <Logo sub={preview} size="lg"/>
          <label className="field grow">
            <span className="fieldLabel">Platform</span>
            <input name="name" className="input" placeholder="Örn: Netflix" autoComplete="off" value={form.name} onChange={e=>handleName(e.target.value)} {...err("name")}/>
            <Msg k="name"/>
          </label>
        </div>

        <div className="grid2">
          <label className="field">
            <span className="fieldLabel">Tutar</span>
            <input name="price" className="input num" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" value={form.price} onChange={e=>set({price:e.target.value})} {...err("price")}/>
            <Msg k="price"/>
          </label>
          <Segmented label="Para birimi" name="currency" value={form.currency} onChange={v=>set({currency:v})}
            options={[{value:"TRY",label:"₺"},{value:"USD",label:"$"},{value:"EUR",label:"€"}]}/>
        </div>

        <Segmented label="Periyot" name="cycle" value={form.cycle} onChange={v=>set({cycle:v})}
          options={[{value:"monthly",label:"Aylık"},{value:"yearly",label:"Yıllık"}]}/>

        <div className="grid2">
          <label className="field">
            <span className="fieldLabel">Ödeme günü</span>
            <input name="paymentDay" className="input num" type="number" min="1" max="28" inputMode="numeric" placeholder="1–28" value={form.paymentDay} onChange={e=>set({paymentDay:e.target.value})} {...err("paymentDay")} aria-describedby={errors.paymentDay ? "paymentDay-err" : "paymentDay-hint"}/>
            {errors.paymentDay ? <Msg k="paymentDay"/> : <p className="fieldHint" id="paymentDay-hint">Her ay aynı gün; en fazla 28.</p>}
          </label>
          {form.cycle === "yearly" && (
            <label className="field">
              <span className="fieldLabel">Ödeme ayı</span>
              <select name="paymentMonth" className="input" value={form.paymentMonth} onChange={e=>set({paymentMonth:Number(e.target.value)})}>
                {monthNames.map((m,i)=><option value={i+1} key={m}>{m}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="grid2">
          <label className="field">
            <span className="fieldLabel">Kategori</span>
            <input name="category" className="input" list="category-list" placeholder="Örn: Müzik" value={form.category} onChange={e=>set({category:e.target.value})}/>
            <datalist id="category-list">{categoryOptions.map(c=><option key={c} value={c}/>)}</datalist>
          </label>
          <label className="field">
            <span className="fieldLabel">Kart <em>isteğe bağlı</em></span>
            <input name="card" className="input" list="card-list" placeholder="Örn: Kredi kartı" value={form.card} onChange={e=>set({card:e.target.value})}/>
            <datalist id="card-list">{cards.map(c=><option key={c} value={c}/>)}</datalist>
          </label>
        </div>

        <details className="moreOptions" open={form.iconType !== "auto" || undefined}>
          <summary>Görünüm <span>ikon ve renk</span></summary>
          <div className="formStack">
            <Segmented label="İkon" name="iconType" value={form.iconType} onChange={v=>set({iconType:v, customIcon: v==="auto" ? "" : form.customIcon})}
              options={[{value:"auto",label:"Otomatik"},{value:"emoji",label:"Emoji"},{value:"image",label:"Görsel"}]}/>
            {form.iconType !== "auto" && (
              <label className="field">
                <span className="fieldLabel">{form.iconType === "image" ? "Görsel adresi" : "Emoji"}</span>
                <input name="customIcon" className="input" inputMode={form.iconType==="image" ? "url" : "text"} placeholder={form.iconType==="emoji" ? "Örn: 🎵" : "https://…/logo.png"} value={form.customIcon} onChange={e=>set({customIcon:e.target.value})} {...err("customIcon")}/>
                <Msg k="customIcon"/>
              </label>
            )}
            <fieldset className="field">
              <legend className="fieldLabel">Renk</legend>
              <div className="swatches">
                {SWATCHES.map(c => (
                  <label key={c} className={form.color.toLowerCase()===c ? "swatch isOn" : "swatch"} style={{"--sw":c}}>
                    <input type="radio" name="color" value={c} checked={form.color.toLowerCase()===c} onChange={()=>set({color:c})}/>
                    <span className="sr">{c}</span>
                  </label>
                ))}
                <label className={SWATCHES.includes(form.color.toLowerCase()) ? "swatch custom" : "swatch custom isOn"} style={{"--sw":form.color}} title="Özel renk">
                  <input type="color" value={form.color} onChange={e=>set({color:e.target.value})} aria-label="Özel renk seç"/>
                </label>
              </div>
            </fieldset>
          </div>
        </details>
      </form>
    </Sheet>
  );
}
