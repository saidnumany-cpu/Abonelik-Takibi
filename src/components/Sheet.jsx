import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Native <dialog>: odak hapsi, Esc ile kapanma ve kapanınca odağın geri dönmesi tarayıcıdan gelir.
export default function Sheet({ open, title, onClose, children, footer }){
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if(!d) return;
    if(open && !d.open) d.showModal();
    if(!open && d.open) d.close();
  }, [open]);

  return <dialog
    ref={ref}
    className="sheet"
    aria-labelledby="sheet-title"
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => { if(e.target === ref.current) onClose(); }}
  >
    {open && <div className="sheet__panel">
      <header className="sheet__head">
        <span className="sheet__grip" aria-hidden="true"/>
        <h2 id="sheet-title">{title}</h2>
        <button type="button" className="iconBtn" onClick={onClose} aria-label="Kapat"><X size={20} aria-hidden="true"/></button>
      </header>
      <div className="sheet__body">{children}</div>
      {footer && <footer className="sheet__foot">{footer}</footer>}
    </div>}
  </dialog>;
}
