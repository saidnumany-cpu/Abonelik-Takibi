import { useState } from "react";
import { detectPlatform, isImageIcon, monogram, readableOn } from "../lib/subs";

export default function Logo({ sub, size = 44 }){
  const [broken, setBroken] = useState(false);
  const bg = detectPlatform(sub.name)?.color || sub.color || "#475569";
  const style = { width:size, height:size, fontSize: Math.round(size * .36) };

  if(isImageIcon(sub) && !broken){
    return <span className="logo logo--image" style={style} aria-hidden="true">
      <img src={sub.customIcon.trim()} alt="" loading="lazy" width={size} height={size} onError={() => setBroken(true)}/>
    </span>;
  }
  return <span className="logo" style={{ ...style, background:bg, color:readableOn(bg) }} aria-hidden="true">{monogram(sub)}</span>;
}
