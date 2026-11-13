import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Edit3 } from "lucide-react";

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const WEEKDAYS = ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
const WEEKDAYS_LONG = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];

const wholeTl = (v) => Math.round(v).toLocaleString("tr-TR") + " ₺";
const exactTl = (v) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
const clampDay = (d) => Math.min(Math.max(Number(d || 1), 1), 28);

// Bir abonelik verilen ayda ödeniyor mu? Aylıklar her ay, yıllıklar sadece kendi ayında.
function paysInMonth(sub, month) {
  return sub.cycle !== "yearly" || Number(sub.paymentMonth || 1) === month + 1;
}

export default function Calendar({ subs, Logo, toTry, onEdit }) {
  const now = new Date();
  const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(now.getDate());

  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();

  // Gün → o günkü ödemeler
  const byDay = useMemo(() => {
    const map = {};
    subs.forEach((s) => {
      if (!paysInMonth(s, view.month)) return;
      const d = clampDay(s.paymentDay);
      (map[d] ||= []).push(s);
    });
    return map;
  }, [subs, view.month]);

  const monthTotal = useMemo(
    () => Object.values(byDay).flat().reduce((sum, s) => sum + toTry(s.price, s.currency), 0),
    [byDay, toTry]
  );
  const paymentCount = Object.values(byDay).flat().length;

  // Bu aydaki en yakın (bugün veya sonrası) ödeme günü
  const nextDay = useMemo(() => {
    const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    return days.find((d) => new Date(view.year, view.month, d).getTime() >= todayKey) ?? null;
  }, [byDay, view, todayKey]);

  const firstOffset = (new Date(view.year, view.month, 1).getDay() + 6) % 7; // Pazartesi başlangıç
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  function goMonth(delta) {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    const isNowMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    setSelected(isNowMonth ? now.getDate() : null);
  }
  function goToday() {
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(now.getDate());
  }

  const selectedList = selected ? byDay[selected] || [] : [];
  const selectedDate = selected ? new Date(view.year, view.month, selected) : null;
  const selectedTotal = selectedList.reduce((sum, s) => sum + toTry(s.price, s.currency), 0);

  return (
    <section className="calendarCard glassPanel" aria-label="Ödeme takvimi">
      <header className="calHeader">
        <div className="calTitle">
          <CalendarDays size={20} />
          <h2>{MONTHS[view.month]} <span>{view.year}</span></h2>
        </div>
        <div className="calSummary">
          <strong>{wholeTl(monthTotal)}</strong>
          <span>{paymentCount ? `bu ay ${paymentCount} ödeme` : "bu ay ödeme yok"}</span>
        </div>
        <div className="calNav">
          {!isCurrentMonth && <button className="calToday" onClick={goToday}>Bugün</button>}
          <button className="calArrow" onClick={() => goMonth(-1)} aria-label="Önceki ay"><ChevronLeft size={20} /></button>
          <button className="calArrow" onClick={() => goMonth(1)} aria-label="Sonraki ay"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="calBody">
        <div className="calMonth">
          <div className="calWeekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="calGrid">
            {cells.map((day, i) => {
              if (!day) return <div className="calCell calBlank" key={`b${i}`} />;
              const list = byDay[day] || [];
              const time = new Date(view.year, view.month, day).getTime();
              const total = list.reduce((sum, s) => sum + toTry(s.price, s.currency), 0);
              const cls = [
                "calCell",
                list.length && "hasPay",
                time < todayKey && "isPast",
                time === todayKey && "isToday",
                day === nextDay && "isNext",
                day === selected && "isSelected",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={day}
                  className={cls}
                  onClick={() => setSelected(day)}
                  aria-pressed={day === selected}
                  aria-label={`${day} ${MONTHS[view.month]}${list.length ? `, ${list.length} ödeme, ${wholeTl(total)}` : ""}`}
                  style={list.length ? { "--pay": list[0].color } : undefined}
                >
                  <span className="calNum">{day}</span>
                  {list.length > 0 && (
                    <>
                      <span className="calLogos">
                        {list.slice(0, 3).map((s) => <Logo key={s.id} sub={s} small />)}
                        {list.length > 3 && <em>+{list.length - 3}</em>}
                      </span>
                      <span className="calDots">{list.slice(0, 4).map((s) => <i key={s.id} style={{ background: s.color }} />)}</span>
                      <span className="calAmount">{wholeTl(total)}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="calDetail" aria-live="polite">
          {selectedDate ? (
            <>
              <div className="calDetailHead">
                <span>{WEEKDAYS_LONG[selectedDate.getDay()]}</span>
                <h3>{selected} {MONTHS[view.month]}</h3>
              </div>
              {selectedList.length ? (
                <>
                  <ul className="calPayList">
                    {selectedList.map((s) => (
                      <li key={s.id}>
                        <Logo sub={s} small />
                        <div>
                          <strong>{s.name}</strong>
                          <span>{s.card && s.card !== "Belirtilmedi" ? s.card : s.category}</span>
                        </div>
                        <b>{s.currency === "TRY" ? exactTl(Number(s.price)) : `${s.price} ${s.currency}`}</b>
                        <button className="calEdit" onClick={() => onEdit(s)} aria-label={`${s.name} düzenle`} title="Düzenle"><Edit3 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                  {selectedList.length > 1 && <div className="calDayTotal"><span>Gün toplamı</span><strong>{exactTl(selectedTotal)}</strong></div>}
                </>
              ) : (
                <p className="calEmpty">
                  Bu gün ödeme yok.
                  {nextDay && nextDay > selected && <> Sıradaki ödeme <button onClick={() => setSelected(nextDay)}>{nextDay} {MONTHS[view.month]}</button>.</>}
                </p>
              )}
            </>
          ) : (
            <p className="calEmpty">Ödemeleri görmek için takvimden bir gün seç.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
