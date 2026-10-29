import { useRef } from "react";
import { Bell, CloudUpload, Download, FileJson, LogIn, LogOut, RefreshCw, Upload } from "lucide-react";

export default function SettingsBody({ user, firebaseReady, localCount, rates, onRates, onRefreshRates, onLogin, onLogout, onNotify, onExportCsv, onExportJson, onImport, onMigrate }){
  const fileRef = useRef(null);
  const r = rates.rates;

  return <div className="settings">
    <section aria-labelledby="s-acc">
      <h3 id="s-acc">Hesap</h3>
      {user ? <div className="account">
        {user.photoURL ? <img src={user.photoURL} alt="" width="44" height="44" referrerPolicy="no-referrer"/> : <span className="account__ph" aria-hidden="true">{(user.displayName || user.email || "?")[0]}</span>}
        <div><strong>{user.displayName || "Google hesabı"}</strong><span>{user.email}</span></div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout}><LogOut size={18} aria-hidden="true"/> Çıkış</button>
      </div> : <div className="stack">
        <p className="muted">Şu an veriler yalnızca bu cihazda. Giriş yaparak iPhone ve Mac arasında eşitle.</p>
        <button type="button" className="btn btn--primary" onClick={onLogin} disabled={!firebaseReady}><LogIn size={18} aria-hidden="true"/> Google ile giriş yap</button>
        {!firebaseReady && <p className="field__hint">Firebase yapılandırması bulunamadı (.env).</p>}
      </div>}
    </section>

    <section aria-labelledby="s-not">
      <h3 id="s-not">Bildirimler</h3>
      <p className="muted">Ödemeden önce bu cihaza hatırlatma gönderilir. iPhone'da önce uygulamayı ana ekrana eklemelisin.</p>
      <button type="button" className="btn btn--ghost" onClick={onNotify} disabled={!user}><Bell size={18} aria-hidden="true"/> Bu cihazda bildirimleri aç</button>
      {!user && <p className="field__hint">Bildirimler için giriş gerekli.</p>}
    </section>

    {user && localCount > 0 && <section aria-labelledby="s-mig">
      <h3 id="s-mig">Bu cihazdaki kayıtlar</h3>
      <p className="muted">Giriş yapmadan önce eklediğin {localCount} abonelik bu cihazda duruyor.</p>
      <button type="button" className="btn btn--ghost" onClick={onMigrate}><CloudUpload size={18} aria-hidden="true"/> Hesabıma aktar</button>
    </section>}

    <section aria-labelledby="s-rate">
      <h3 id="s-rate">Döviz kuru</h3>
      <div className="row2">
        {["USD","EUR"].map(c => <div className="field" key={c}>
          <label htmlFor={`rate-${c}`}>1 {c} = ₺</label>
          <input id={`rate-${c}`} key={`${c}-${r[c]}`} inputMode="decimal" defaultValue={String(r[c]).replace(".", ",")}
            onBlur={e => { const v = Number(e.target.value.replace(",", ".")); if(v > 0 && v !== r[c]) onRates({ rates:{ ...r, [c]:v }, source:"elle", at:null }); else e.target.value = String(r[c]).replace(".", ","); }}/>
        </div>)}
      </div>
      <div className="inline">
        <p className="field__hint">{rates.source === "otomatik" ? `ECB kuru, ${rates.at}` : rates.source === "elle" ? "Elle girildi" : "Varsayılan değer, güncellemen önerilir"}</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRefreshRates}><RefreshCw size={16} aria-hidden="true"/> Güncel kuru al</button>
      </div>
    </section>

    <section aria-labelledby="s-data">
      <h3 id="s-data">Veri</h3>
      <div className="btnGrid">
        <button type="button" className="btn btn--ghost" onClick={onExportCsv}><Download size={18} aria-hidden="true"/> CSV indir</button>
        <button type="button" className="btn btn--ghost" onClick={onExportJson}><FileJson size={18} aria-hidden="true"/> Yedek al (JSON)</button>
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}><Upload size={18} aria-hidden="true"/> Yedekten yükle</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { onImport(e.target.files?.[0]); e.target.value = ""; }}/>
      </div>
    </section>
  </div>;
}
