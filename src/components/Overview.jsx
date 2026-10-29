import { CalendarClock, Plus } from "lucide-react";
import Logo from "./Logo";
import { daysUntil, dueLabel, fmtDate, money, nextPaymentDate, priceLabel } from "../lib/subs";

export function DueChip({ days }){
  const tone = days <= 1 ? "danger" : days <= 7 ? "warn" : "calm";
  return <span className={`chip chip--${tone}`}>{dueLabel(days)}</span>;
}

export default function Overview({ subs, summary, onEdit, onAdd }){
  const upcoming = [...subs].sort((a,b) => daysUntil(a) - daysUntil(b)).slice(0, 5);
  const max = Math.max(...summary.categories.map(([,v]) => v), 1);

  if(!subs.length){
    return <section className="emptyHero">
      <span className="emptyHero__icon" aria-hidden="true"><CalendarClock size={28}/></span>
      <h2>İlk aboneliğini ekle</h2>
      <p>Ödeme günlerini, aylık ve yıllık toplamını tek yerde gör. Ödemeden önce bildirim al.</p>
      <button type="button" className="btn btn--primary" onClick={onAdd}><Plus size={18} aria-hidden="true"/> Abonelik ekle</button>
    </section>;
  }

  return <div className="overview">
    <section className="hero card" aria-labelledby="hero-title">
      <h2 id="hero-title" className="hero__label">Aylık toplam</h2>
      <p className="hero__value num">{money(summary.monthly)}</p>
      <p className="hero__sub">{subs.length} aktif abonelik · yıllık {money(summary.yearly)}</p>
      <dl className="stats">
        <div><dt>30 gün içinde</dt><dd className="num">{money(summary.next30)}</dd></div>
        <div><dt>7 gün içinde</dt><dd className="num">{summary.dueSoon.length} ödeme</dd></div>
      </dl>
    </section>

    <section className="card" aria-labelledby="up-title">
      <div className="cardHead"><h2 id="up-title">Yaklaşan ödemeler</h2><a href="#abonelikler" className="link">Tümü</a></div>
      <ul className="rows">
        {upcoming.map(s => {
          const d = daysUntil(s);
          return <li key={s.id}>
            <button type="button" className="row" onClick={() => onEdit(s)} aria-label={`${s.name}, ${priceLabel(s)}, ${fmtDate(nextPaymentDate(s))}. Düzenle`}>
              <Logo sub={s}/>
              <span className="row__main"><strong>{s.name}</strong><span>{fmtDate(nextPaymentDate(s), { day:"numeric", month:"long", weekday:"long" })}</span></span>
              <span className="row__end"><strong className="num">{priceLabel(s)}</strong><DueChip days={d}/></span>
            </button>
          </li>;
        })}
      </ul>
    </section>

    <section className="card" aria-labelledby="cat-title">
      <div className="cardHead"><h2 id="cat-title">Kategoriler</h2><span className="muted">aylık karşılık</span></div>
      <ul className="bars">
        {summary.categories.map(([c, v]) => <li key={c}>
          <div className="bars__label"><span>{c}</span><span className="num">{money(v)} <small>%{summary.monthly ? Math.round(v / summary.monthly * 100) : 0}</small></span></div>
          <div className="bars__track" aria-hidden="true"><span style={{ transform:`scaleX(${v / max})` }}/></div>
        </li>)}
      </ul>
    </section>
  </div>;
}
