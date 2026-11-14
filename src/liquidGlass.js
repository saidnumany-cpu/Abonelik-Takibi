// Liquid Glass: iOS 26 tarzı cam katmanı için küçük yardımcılar.
// 1) Chromium'da arka planı büken SVG kırılma filtresi (Safari backdrop-filter:url() desteklemiyor,
//    orada saf CSS cam kullanılır).
// 2) Fare/parmak hareketine göre cam yüzeydeki parlamanın yerini günceller (--lx / --ly).

const GLASS_SELECTOR =
  ".glassPanel,.syncBadge,.roundGhost,.loginButton,.softButton,.primaryButton,.fullGhost,.calArrow,.calToday,.toast,.subRow,.iconAction,.calCell";

function supportsBackdropUrl() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|CriOS|FxiOS|Firefox/i.test(ua)) return false; // iOS'ta tüm tarayıcılar WebKit
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return false;
  return /Chrome|Chromium|Edg/i.test(ua);
}

function injectRefractionFilter() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML = `
    <filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise"/>
      <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
      <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" result="bent"/>
      <feGaussianBlur in="bent" stdDeviation="14" result="frost"/>
      <feColorMatrix in="frost" type="saturate" values="1.7"/>
    </filter>
    <filter id="lg-refract-sm" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="1" seed="3" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="16" xChannelSelector="R" yChannelSelector="G" result="bent"/>
      <feGaussianBlur in="bent" stdDeviation="8" result="frost"/>
      <feColorMatrix in="frost" type="saturate" values="1.6"/>
    </filter>`;
  document.body.appendChild(svg);
  document.documentElement.classList.add("lg-refract");
}

function trackLight() {
  if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  let frame = 0;
  let last = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = e.target instanceof Element ? e.target.closest(GLASS_SELECTOR) : null;
        if (last && last !== el) {
          last.style.removeProperty("--lx");
          last.style.removeProperty("--ly");
        }
        last = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--lx", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--ly", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    },
    { passive: true }
  );
}

export function initLiquidGlass() {
  document.documentElement.classList.add("lg");
  if (supportsBackdropUrl()) injectRefractionFilter();
  trackLight();
}
