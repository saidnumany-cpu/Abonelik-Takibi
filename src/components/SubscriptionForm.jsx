import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import Logo from "./Logo";
import { CURRENCIES, MONTHS, PLATFORM_NAMES, SWATCHES, detectPlatform, emptyForm, money, monthlyTry, validate } from "../lib/subs";

function Field({ id, label, hint, error, children }){
  return <div className={`field ${error ? "field--error" : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error ? <p className="field__msg" id={`${id}-msg`} role="alert">{error}</p>
      : hint ? <p className="field__hint" id={`${id}-msg`}>{hint}</p> : null}
  </div>;
}

function Segmented({ name, legend, value, options, onChange }){
  return <fieldset className="segmented">
    <legend>{legend}</legend>
    <div className="segmented__track">
      {options.map(o => <label key={o.value} className={value === o.value ? "is-on" : ""}>
        <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)}/>
        <span>{o.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

export default function SubscriptionForm({ initial, categories, cards, rates, onSubmit, onDelete }){
  const [form, setForm] = useState(() => initial ? { ...emptyForm(), ...initial, price:String(initial.price ?? ""), paymentDay:String(initial.paymentDay ?? "") } : emptyForm());
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formRef = useRef(null);
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const platform = detectPlatform(form.name);

  useEffect(() => { if(!initial) formRef.current?.querySelector("#f-name")?.focus(); }, [initial]);

  const preview = useMemo(() => {
    const price = Number(String(form.price).replace(",", "."));
    return { ...form, price: price > 0 ? price : 0, name: form.name || "Yeni abonelik" };
  }, [form]);

  function onName(value){
    const p = detectPlatform(value);
    set({ name:value, ...(p && !initial ? { category: form.category || p.category, color: p.color } : {}) });
  }

  function submit(e){
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if(first){ formRef.current?.querySelector(`[data-field="${first}"]`)?.focus(); return; }
    onSubmit({
      ...form,
      name: form.name.trim(),
      price: Number(String(form.price).replace(",", ".")),
      paymentDay: Number(form.paymentDay),
      paymentMonth: Number(form.paymentMonth || new Date().getMonth() + 1),
      category: form.category.trim() || platform?.category || "Dijital",
      card: form.card.trim() || "Belirtilmedi",
      color: platform?.color || form.color,
      iconType: form.iconType || "auto",
      customIcon: form.iconType === "auto" ? "" : (form.customIcon || "").trim(),
    });
  }

  const aria = key => ({ "data-field":key, "aria-invalid": !!errors[key], "aria-describedby": `f-${key}-msg` });

  return <form id="sub-form" ref={formRef} className="form" onSubmit={submit} noValidate>
    <div className="preview" aria-hidden="true">
      <Logo sub={preview} size={52}/>
      <div>
        <strong>{preview.name}</strong>
        <span>{preview.price ? `${money(monthlyTry(preview, rates))} / ay` : "Tutar bekleniyor"}</span>
      </div>
    </div>

    <Field id="f-name" label="Platform" hint={platform ? `Tanındı: ${platform.category}` : "Örn. Netflix, Spotify, iCloud+"} error={errors.name}>
      <input id="f-name" list="platform-list" autoComplete="off" value={form.name} onChange={e => onName(e.target.value)} {...aria("name")}/>
      <datalist id="platform-list">{PLATFORM_NAMES.map(p => <option key={p} value={p}/>)}</datalist>
    </Field>

    <div className="row2">
      <Field id="f-price" label="Tutar" error={errors.price}>
        <input id="f-price" inputMode="decimal" autoComplete="off" placeholder="0,00" value={form.price} onChange={e => set({ price:e.target.value })} {...aria("price")}/>
      </Field>
      <Segmented name="currency" legend="Para birimi" value={form.currency} onChange={v => set({ currency:v })}
        options={CURRENCIES.map(c => ({ value:c, label:c === "TRY" ? "₺" : c === "USD" ? "$" : "€" }))}/>
    </div>

    <Segmented name="cycle" legend="Yenilenme" value={form.cycle} onChange={v => set({ cycle:v })}
      options={[{ value:"monthly", label:"Aylık" }, { value:"yearly", label:"Yıllık" }]}/>

    <div className="row2">
      <Field id="f-day" label="Ödeme günü" hint="Ay sonu ödemeleri için 28'i seç." error={errors.paymentDay}>
        <select id="f-day" value={form.paymentDay} onChange={e => set({ paymentDay:e.target.value })} {...aria("paymentDay")}>
          <option value="">Seç</option>
          {Array.from({ length:28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </Field>
      {form.cycle === "yearly" && <Field id="f-month" label="Ödeme ayı">
        <select id="f-month" value={form.paymentMonth} onChange={e => set({ paymentMonth:e.target.value })}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </Field>}
    </div>

    <div className="row2">
      <Field id="f-cat" label="Kategori">
        <input id="f-cat" list="cat-list" autoComplete="off" placeholder={platform?.category || "Dijital"} value={form.category} onChange={e => set({ category:e.target.value })}/>
        <datalist id="cat-list">{categories.map(c => <option key={c} value={c}/>)}</datalist>
      </Field>
      <Field id="f-card" label="Kart / ödeme yöntemi">
        <input id="f-card" list="card-list" autoComplete="off" placeholder="Örn. Bonus Kart" value={form.card === "Belirtilmedi" ? "" : form.card} onChange={e => set({ card:e.target.value })}/>
        <datalist id="card-list">{cards.filter(c => c !== "Belirtilmedi").map(c => <option key={c} value={c}/>)}</datalist>
      </Field>
    </div>

    <details className="more" open={form.iconType !== "auto" || undefined}>
      <summary>Görünüm</summary>
      <Segmented name="iconType" legend="Simge" value={form.iconType} onChange={v => set({ iconType:v })}
        options={[{ value:"auto", label:"Baş harfler" }, { value:"image", label:"Görsel" }, { value:"emoji", label:"Karakter" }]}/>
      {form.iconType !== "auto" && <Field id="f-icon" label={form.iconType === "image" ? "Görsel adresi" : "Karakter (1–2)"} error={errors.customIcon}>
        <input id="f-icon" inputMode={form.iconType === "image" ? "url" : "text"} maxLength={form.iconType === "image" ? 500 : 2}
          placeholder={form.iconType === "image" ? "https://…/logo.png" : "Örn. M"} value={form.customIcon} onChange={e => set({ customIcon:e.target.value })} {...aria("customIcon")}/>
      </Field>}
      <fieldset className="swatches" disabled={!!platform}>
        <legend>Renk {platform && <small>(platform rengi kullanılıyor)</small>}</legend>
        <div>
          {SWATCHES.map(c => <label key={c} className={form.color === c ? "is-on" : ""} style={{ "--sw":c }}>
            <input type="radio" name="color" value={c} checked={form.color === c} onChange={() => set({ color:c })}/>
            <span className="visually-hidden">{c}</span>
          </label>)}
          <label className="swatches__custom">
            <input type="color" value={form.color} onChange={e => set({ color:e.target.value })} aria-label="Özel renk"/>
          </label>
        </div>
      </fieldset>
    </details>

    {initial && onDelete && <div className="dangerZone">
      {confirmDelete
        ? <>
          <p>{initial.name} silinsin mi?</p>
          <div className="dangerZone__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>Vazgeç</button>
            <button type="button" className="btn btn--danger" onClick={() => onDelete(initial)}>Evet, sil</button>
          </div>
        </>
        : <button type="button" className="btn btn--dangerGhost" onClick={() => setConfirmDelete(true)}><Trash2 size={18} aria-hidden="true"/> Aboneliği sil</button>}
    </div>}
  </form>;
}
