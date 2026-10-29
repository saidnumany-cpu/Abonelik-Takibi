import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import Logo from "./Logo";
import { DueChip } from "./Overview";
import { cycleLabel, daysUntil, fmtDate, money, monthlyTry, nextPaymentDate, priceLabel } from "../lib/subs";

const SORTS = {
  date: { label:"Yaklaşan tarih", fn:(a,b) => daysUntil(a) - daysUntil(b) },
  price: { label:"Aylık tutar", fn:null },
  name: { label:"Ad", fn:(a,b) => a.name.localeCompare(b.name, "tr") },
};

export default function SubscriptionList({ subs, rates, categories, cards, onEdit, onAdd }){
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tümü");
  const [card, setCard] = useState("Tümü");
  const [sort, setSort] = useState("date");

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const out = subs.filter(s =>
      `${s.name} ${s.category} ${s.card}`.toLocaleLowerCase("tr").includes(needle) &&
      (cat === "Tümü" || s.category === cat) &&
      (card === "Tümü" || (s.card || "Belirtilmedi") === card));
    const fn = sort === "price" ? (a,b) => monthlyTry(b, rates) - monthlyTry(a, rates) : SORTS[sort].fn;
    return out.sort(fn);
  }, [subs, q, cat, card, sort, rates]);

  const total = list.reduce((t, s) => t + monthlyTry(s, rates), 0);
  const filtered = q || cat !== "Tümü" || card !== "Tümü";

  return <section className="listView" aria-label="Abonelik listesi">

    <div className="filters card">
      <label className="search">
        <Search size={18} aria-hidden="true"/>
        <span className="visually-hidden">Ara</span>
        <input type="search" placeholder="Ad, kategori veya kart ara" value={q} onChange={e => setQ(e.target.value)}/>
      </label>
      <div className="filters__row">
        <label className="select"><span>Kategori</span>
          <select value={cat} onChange={e => setCat(e.target.value)}><option>Tümü</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="select"><span>Kart</span>
          <select value={card} onChange={e => setCard(e.target.value)}><option>Tümü</option>{cards.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="select"><span>Sırala</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </label>
      </div>
    </div>

    <p className="listMeta" aria-live="polite">
      {list.length} abonelik · <span className="num">{money(total)}</span> / ay
      {filtered && <button type="button" className="link" onClick={() => { setQ(""); setCat("Tümü"); setCard("Tümü"); }}>Filtreleri temizle</button>}
    </p>

    {list.length ? <ul className="rows card">
      {list.map(s => {
        const foreign = s.currency !== "TRY" || s.cycle === "yearly";
        return <li key={s.id}>
          <button type="button" className="row" onClick={() => onEdit(s)} aria-label={`${s.name}, ${priceLabel(s)} ${cycleLabel(s.cycle)}, sonraki ödeme ${fmtDate(nextPaymentDate(s))}. Düzenle`}>
            <Logo sub={s}/>
            <span className="row__main">
              <strong>{s.name}</strong>
              <span>{fmtDate(nextPaymentDate(s))} · {s.category}<span className="row__card"> · {s.card || "Belirtilmedi"}</span></span>
            </span>
            <span className="row__end">
              <strong className="num">{priceLabel(s)} <small>/{s.cycle === "yearly" ? "yıl" : "ay"}</small></strong>
              <DueChip days={daysUntil(s)}/>
              {foreign && <span className="num muted row__eq">≈ {money(monthlyTry(s, rates))}/ay</span>}
            </span>
          </button>
        </li>;
      })}
    </ul> : <div className="empty card">
      <p>{subs.length ? "Bu filtrelere uyan abonelik yok." : "Henüz abonelik eklemedin."}</p>
      {!subs.length && <button type="button" className="btn btn--primary" onClick={onAdd}><Plus size={18} aria-hidden="true"/> Abonelik ekle</button>}
    </div>}
  </section>;
}
