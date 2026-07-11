import { Router } from "express";

const router = Router();

type Item = {
  name: string;
  color: string;
  colorHex: string;
  category: string;
};

function isLightColor(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

function contrastText(hex: string): string {
  return isLightColor(hex) ? "#1a1a1a" : "#ffffff";
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const MOOD_THEMES: Record<string, { bgTop: string; bgBottom: string; accent: string; vibe: string; shadowColor: string }> = {
  casual: { bgTop: "#FEF3C7", bgBottom: "#FDE68A", accent: "#C8906A", vibe: "cozy", shadowColor: "rgba(0,0,0,0.08)" },
  minimal: { bgTop: "#F1F5F9", bgBottom: "#E2E8F0", accent: "#78716C", vibe: "clean", shadowColor: "rgba(0,0,0,0.06)" },
  streetwear: { bgTop: "#1C1512", bgBottom: "#2D1F1A", accent: "#FF6B35", vibe: "urban", shadowColor: "rgba(0,0,0,0.25)" },
  formal: { bgTop: "#0F172A", bgBottom: "#1E293B", accent: "#F59E0B", vibe: "elegant", shadowColor: "rgba(0,0,0,0.2)" },
  sporty: { bgTop: "#ECFDF5", bgBottom: "#D1FAE5", accent: "#6B7C4D", vibe: "energetic", shadowColor: "rgba(0,0,0,0.07)" },
  boho: { bgTop: "#FFF7ED", bgBottom: "#FFEDD5", accent: "#C19A6B", vibe: "earthy", shadowColor: "rgba(0,0,0,0.07)" },
  chic: { bgTop: "#1A0A0E", bgBottom: "#2D1219", accent: "#E8A0B4", vibe: "luxe", shadowColor: "rgba(0,0,0,0.2)" },
};

const HAIR_STYLES = [
  'd="M155,-58 Q200,-85 245,-58 Q250,-30 240,-15 Q230,-28 218,-25 Q200,-33 182,-25 Q170,-28 160,-15 Q150,-30 155,-58Z" fill="{c}"',
  'd="M155,-55 Q200,-90 245,-55 Q248,-20 242,-10 Q232,-24 218,-22 Q200,-30 182,-22 Q168,-24 158,-10 Q152,-20 155,-55Z" fill="{c}" opacity="0.9"',
  'd="M158,-50 Q200,-75 242,-50 Q245,-25 238,-18 L230,-22 Q218,-20 200,-28 182,-20 Q170,-22 162,-18 Q155,-25 158,-50Z" fill="{c}"',
  'd="M0,0 M160,-52 Q200,-70 240,-52 Q248,-30 238,-5 L230,-20 Q218,-18 200,-25 182,-18 Q170,-20 162,-5 Q152,-30 160,-52Z" fill="{c}" rx="4"',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function renderMannequinSVG(items: Item[], temperature: number, weather: string, mood: string): string {
  const skinPalette = ["#E8C39E", "#D4A574", "#C9A87C", "#F0D5B8", "#DEB887"];
  const hairColors = ["#4A3728", "#2C1810", "#5C4033", "#1A0F0A", "#6B4226", "#3E2723"];

  const seed = hashString(items.map((i) => i.name + i.colorHex).join("|"));
  const skin = skinPalette[seed % skinPalette.length];
  const hair = hairColors[(seed * 7 + 3) % hairColors.length];

  const top = items.find((i) => i.category === "top" || i.category === "tops");
  const bottom = items.find((i) => i.category === "bottom" || i.category === "bottoms");
  const dress = items.find((i) => i.category === "dress" || i.category === "dresses");
  const outer = items.find((i) => i.category === "outerwear");
  const shoes = items.find((i) => i.category === "shoes");
  const accessory = items.find((i) => i.category === "accessory" || i.category === "accessories");

  const torsoColor = dress?.colorHex ?? outer?.colorHex ?? top?.colorHex ?? skin;
  const armColor = outer?.colorHex ?? top?.colorHex ?? skin;
  const legColor = dress?.colorHex ?? bottom?.colorHex ?? skin;
  const shoeColor = shoes?.colorHex ?? "#333333";
  const accColor = accessory?.colorHex;
  const accName = accessory?.name;

  const skinShadow = lerpColor(skin, "#000000", 0.15);
  const skinDark = lerpColor(skin, "#000000", 0.25);

  const theme = MOOD_THEMES[mood] ?? MOOD_THEMES.casual;

  const tempLabel =
    temperature >= 30 ? "Hot"
    : temperature >= 20 ? "Warm"
    : temperature >= 10 ? "Cool"
    : "Cold";

  const pose = (seed * 13) % 3;
  const hairIdx = (seed * 5 + 2) % HAIR_STYLES.length;
  const hairPath = HAIR_STYLES[hairIdx].replace("{c}", hair);

  const itemTags = items
    .map((i) => {
      const idx = items.indexOf(i);
      return `<rect x="30" y="${60 + idx * 36}" width="340" height="28" rx="6" fill="${i.colorHex}" opacity="0.9"/>
      <text x="200" y="${60 + idx * 36 + 19}" text-anchor="middle" fill="${contrastText(i.colorHex)}" font-family="system-ui, sans-serif" font-size="13" font-weight="600">${i.name}</text>
      <text x="365" y="${60 + idx * 36 + 19}" text-anchor="end" fill="${isLightColor(theme.bgTop) ? "#999" : "#888"}" font-family="system-ui, sans-serif" font-size="11">${i.color}</text>`;
    })
    .join("\n");

  const itemTagsStartY = 60;
  const tagsHeight = items.length * 36 + 10;
  const mannequinTopY = itemTagsStartY + tagsHeight + 10;

  // Pose variants
  const armLeft = pose === 0
    ? `<rect x="60" y="55" width="40" height="140" rx="16" fill="${armColor}" filter="url(#shadow)"/>`
    : pose === 1
    ? `<rect x="55" y="55" width="40" height="100" rx="16" fill="${armColor}" filter="url(#shadow)"/>
       <rect x="50" y="140" width="35" height="50" rx="12" fill="${armColor}" filter="url(#shadow)"/>`
    : `<rect x="65" y="55" width="38" height="145" rx="16" fill="${armColor}" filter="url(#shadow)"/>`;

  const armRight = pose === 0
    ? `<rect x="300" y="55" width="40" height="140" rx="16" fill="${armColor}" filter="url(#shadow)"/>`
    : pose === 1
    ? `<rect x="305" y="55" width="40" height="100" rx="16" fill="${armColor}" filter="url(#shadow)"/>
       <rect x="315" y="140" width="35" height="50" rx="12" fill="${armColor}" filter="url(#shadow)"/>`
    : `<rect x="297" y="55" width="38" height="145" rx="16" fill="${armColor}" filter="url(#shadow)"/>`;

  // Background decoration - mood-based overlay shapes
  const bgDecor = pose === 0
    ? `<circle cx="50" cy="120" r="80" fill="${theme.accent}" opacity="0.04"/>
       <circle cx="350" cy="180" r="60" fill="${theme.accent}" opacity="0.04"/>`
    : pose === 1
    ? `<rect x="-20" y="80" width="100" height="100" rx="20" fill="${theme.accent}" opacity="0.04" transform="rotate(-15 30 130)"/>
       <rect x="320" y="140" width="100" height="80" rx="20" fill="${theme.accent}" opacity="0.04" transform="rotate(10 370 180)"/>`
    : `<circle cx="60" cy="160" r="50" fill="${theme.accent}" opacity="0.04"/>
       <circle cx="340" cy="100" r="70" fill="${theme.accent}" opacity="0.04"/>`;

  // Weather emoji
  const weatherEmoji = temperature >= 30 ? "☀️" : temperature >= 20 ? "⛅" : temperature >= 10 ? "🌤️" : "❄️";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700" viewBox="0 0 400 700">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
    </filter>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.bgTop}"/>
      <stop offset="100%" stop-color="${theme.bgBottom}"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="torsoShade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${torsoColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${lerpColor(torsoColor, "#000000", 0.08)}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="legShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${legColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${lerpColor(legColor, "#000000", 0.06)}" stop-opacity="1"/>
    </linearGradient>
  </defs>

  <rect width="400" height="700" fill="url(#bg)" rx="16"/>
  ${bgDecor}

  <!-- Header -->
  <rect x="0" y="0" width="400" height="50" fill="url(#headerGrad)" rx="16"/>
  <rect x="0" y="25" width="400" height="25" fill="url(#headerGrad)"/>
  <text x="200" y="32" text-anchor="middle" fill="${isLightColor(theme.accent) ? "#1a1a1a" : "#fff"}" font-family="system-ui, sans-serif" font-size="16" font-weight="700">Style Preview</text>
  <text x="370" y="32" text-anchor="end" fill="${isLightColor(theme.accent) ? "#333" : "#ccc"}" font-family="system-ui, sans-serif" font-size="11">${tempLabel} · ${weather ?? "Clear"} ${weatherEmoji}</text>

  <!-- Item tags -->
  <g transform="translate(0, ${itemTagsStartY})">
  ${itemTags}
  </g>

  <!-- Mannequin group -->
  <g transform="translate(0, ${mannequinTopY})">

    <!-- Background floor shadow -->
    <ellipse cx="200" cy="420" rx="90" ry="12" fill="${theme.shadowColor}"/>

    <!-- Legs -->
    <rect x="143" y="210" width="40" height="180" rx="16" fill="${legColor}" filter="url(#shadow)"/>
    <rect x="217" y="210" width="40" height="180" rx="16" fill="${legColor}" filter="url(#shadow)"/>

    <!-- Leg inner shadows -->
    <rect x="153" y="220" width="20" height="160" rx="10" fill="${legColor === skin ? skinShadow : lerpColor(legColor, "#000000", 0.12)}"/>
    <rect x="227" y="220" width="20" height="160" rx="10" fill="${legColor === skin ? skinShadow : lerpColor(legColor, "#000000", 0.12)}"/>

    <!-- Shoes -->
    <g filter="url(#shadow)">
      <rect x="130" y="388" width="58" height="24" rx="10" fill="${shoeColor}"/>
      <rect x="212" y="388" width="58" height="24" rx="10" fill="${shoeColor}"/>
      ${shoes ? `<rect x="134" y="392" width="50" height="6" rx="3" fill="${contrastText(shoeColor)}" opacity="0.15"/>
      <rect x="216" y="392" width="50" height="6" rx="3" fill="${contrastText(shoeColor)}" opacity="0.15"/>` : ""}
    </g>

    <!-- Arms (pose-aware) -->
    <g filter="url(#shadow)">
      ${armLeft}
      ${armRight}
    </g>

    <!-- Torso -->
    <rect x="128" y="44" width="144" height="180" rx="20" fill="url(#torsoShade)" filter="url(#shadow)"/>

    <!-- Neck -->
    <rect x="180" y="8" width="40" height="40" rx="8" fill="${skin}"/>

    <!-- Head -->
    <circle cx="200" cy="-32" r="40" fill="${skin}" filter="url(#shadow)"/>

    <!-- Hair -->
    <path ${hairPath}/>

    <!-- Face -->
    <circle cx="185" cy="-35" r="4" fill="#333" opacity="0.6"/>
    <circle cx="215" cy="-35" r="4" fill="#333" opacity="0.6"/>
    <ellipse cx="200" cy="-22" rx="6" ry="4" fill="#333" opacity="0.15"/>
    <path d="M190,-26 Q200,-20 210,-26" stroke="#c97b84" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>

    <!-- Outerwear overlap lines -->
    ${outer ? `
    <line x1="128" y1="44" x2="104" y2="50" stroke="${outer.colorHex}" stroke-width="3" opacity="0.5"/>
    <line x1="272" y1="44" x2="296" y2="50" stroke="${outer.colorHex}" stroke-width="3" opacity="0.5"/>
    <path d="M128,44 L128,224" stroke="rgba(0,0,0,0.06)" stroke-width="2" fill="none"/>
    <path d="M272,44 L272,224" stroke="rgba(0,0,0,0.06)" stroke-width="2" fill="none"/>` : ""}

    <!-- Accessory -->
    ${accessory ? `
    <g filter="url(#shadow)">
      <rect x="293" y="120" width="10" height="24" rx="4" fill="${accColor}"/>
      <circle cx="298" cy="132" r="7" fill="${contrastText(accColor!)}" opacity="0.3"/>
      <text x="298" y="135" text-anchor="middle" fill="${contrastText(accColor!)}" font-size="7" font-weight="bold" font-family="system-ui, sans-serif">●</text>
    </g>
    <text x="340" y="134" fill="${isLightColor(theme.bgTop) ? "#888" : "#aaa"}" font-family="system-ui, sans-serif" font-size="9">${accName ?? "Accessory"}</text>` : ""}
  </g>
</svg>`;

  return svg;
}

router.post("/outfit-preview", (req, res) => {
  const { items, weather, temperature, mood } = req.body as {
    items: Item[];
    weather: string;
    temperature: number;
    mood?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  const actualMood = mood ?? "casual";
  const theme = MOOD_THEMES[actualMood] ?? MOOD_THEMES.casual;

  const svg = renderMannequinSVG(items, temperature ?? 22, weather ?? "Clear", actualMood);
  const base64 = Buffer.from(svg, "utf-8").toString("base64");
  res.json({ image: base64 });
});

export default router;
