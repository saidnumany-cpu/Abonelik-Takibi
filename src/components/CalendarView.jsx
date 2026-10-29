import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Logo from "./Logo";
import { MONTHS, WEEKDAYS, money, paymentsInMonth, priceLabel, startOfDay, toTry } from "../lib/subs";

export default function CalendarView({ subs, rates, onEdit }){
  const today = startOfDay();
  const [cursor, setCursor] = useState({ y:today.getFullYear(), m:today.getMonth() });
  const isThisMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();
  const [selected, setSelected] = useState(today.getDate());

  const byDay = useMemo(() => paymentsInMonth(subs, cursor.y, cursor.m), [subs, cursor]);
  const monthTotal = Object.values(byDay).flat().reduce((t, s) => t + toTry(s.price, s.currency, rates), 0);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Pazartesi başlangıç

  function shift(n){
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y:d.getFullYear(), m:d.getMonth() });
    const firstWithPayment = Object.keys(paymentsInMonth(subs, d.getFullYear(), d.getMonth())).map(Number).sort((a,b) => a - b)[0];
    setSelected(d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? today.getDate() : firstWithPayment || 1);
  }

  const dayList = byDay[selected] || [];

  return <section className="calView" aria-label="Ödeme takvimi">

    <div className="card cal">
      <div className="cal__head">
        <button type="button" className="iconBtn" onClick={() => shift(-1)} aria-label="Önceki ay"><ChevronLeft size={20} aria-hidden="true"/></button>
        <div className="cal__title" aria-live="polite">
          <strong>{MONTHS[cursor.m]} {cursor.y}</strong>
          <span className="num">{money(monthTotal)}</span>
        </div>
        <button type="button" className="iconBtn" onClick={() => shift(1)} aria-label="Sonraki ay"><ChevronRight size={20} aria-hidden="true"/></button>
      </div>

      <div className="cal__grid">
        <div className="cal__week" aria-hidden="true">
          {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
        </div>
        <div className="cal__days">
          {Array.from({ length:lead }, (_, i) => <span key={`l${i}`} className="cal__pad" aria-hidden="true"/>)}
          {Array.from({ length:daysInMonth }, (_, i) => {
            const day = i + 1;
            const list = byDay[day] || [];
            const isToday = isThisMonth && day === today.getDate();
            const isPast = isThisMonth && day < today.getDate();
            return <button type="button" key={day}
              className={["cal__day", list.length && "has", isToday && "today", isPast && "past", selected === day && "sel"].filter(Boolean).join(" ")}
              aria-pressed={selected === day}
              aria-label={`${day} ${MONTHS[cursor.m]}${list.length ? `, ${list.length} ödeme` : ""}${isToday ? ", bugün" : ""}`}
              onClick={() => setSelected(day)}>
              <span className="num">{day}</span>
              {!!list.length && <span className="cal__dots" aria-hidden="true">
                {list.slice(0, 3).map(s => <i key={s.id} style={{ background:s.color }}/>)}
                {list.length > 3 && <b>+{list.length - 3}</b>}
              </span>}
            </button>;
          })}
        </div>
      </div>
    </div>

    <div className="card">
      <div className="cardHead"><h2>{selected} {MONTHS[cursor.m]}</h2>
        {!!dayList.length && <span className="num muted">{money(dayList.reduce((t, s) => t + toTry(s.price, s.currency, rates), 0))}</span>}</div>
      {dayList.length ? <ul className="rows">
        {dayList.map(s => <li key={s.id}>
          <button type="button" className="row" onClick={() => onEdit(s)}>
            <Logo sub={s}/>
            <span className="row__main"><strong>{s.name}</strong><span>{s.card || "Belirtilmedi"}</span></span>
            <span className="row__end"><strong className="num">{priceLabel(s)}</strong></span>
          </button>
        </li>)}
      </ul> : <p className="muted pad">Bu gün ödeme yok.</p>}
    </div>
  </section>;
}
