/* =========================================================================
   dragon-game.js — HomeHub DEIN BEGLEITER (ersetzt den Drachen)
   Vanilla JS · Kontrakt: window.DRAGON_DEFAULTS, dragon, saveDragon(),
   loadDragon(d), rewardDragon(action), renderDragonCard()
   Speicher: localStorage 'vh_dragon' · Backup-Marker: dragon.egg === true
   Alte Drachen-Backups werden erkannt und starten das Ei frisch bei 0.
   ========================================================================= */

/* =========================================================================
   HomeHub — DEIN BEGLEITER  PROTOTYP-SANDBOX (egg-sandbox.jsx)  v1
   -------------------------------------------------------------------------
   Ein persönlicher Begleiter mit sechs Entwicklungsstufen.
     0 Ur-Ei            (0 XP)      leblos, geheimnisvoll
     1 Beobachtendes Ei (200)       Augen erscheinen, blinzeln im Dunkeln
     2 Watschelndes Ei  (700)       bekommt Füßchen, wackelt
     3 Greifendes Ei    (1.600)     bekommt Ärmchen, greift
     4 Rissiges Ei      (3.200)     riesig, leuchtende Risse, Drachen-Schatten innen
     5 Kosmisches Ei    (5.500)     funkelnde Entität, taucht den Raum in Licht
   Render-Stack 1:1 aus dragon-sandbox: buildSprite (Outline + manuelles AA +
   Rim-Light), Höhle/Fackel/Nest, drawDragonShadow (Bayer-AO).
   Abwesenheit erzeugt Entdeckungen und Ruhe. Pflege beeinflusst die Stimmung;
   echte HomeHub-Nutzung trägt Entwicklung, Persönlichkeit und Erinnerungen.
   ========================================================================= */

const PAL = {
  skyTop: "#2a1f44", skyMid: "#34264f", skyBot: "#120d1c",
  rock: "#3a2f4d", rockDark: "#251d33", moss: "#4a6a38", mossLt: "#73a04d",
  ground: "#2a2236", groundLt: "#3c3049", groundEdge: "#1a1424",
  torchWood: "#5a3a22", torchDk: "#3a2414",
  flame1: "#fff0a8", flame2: "#ffb02a", flame3: "#ff5e1f", glow: "#ffb04d",
  nestDk: "#4a2f18", nest: "#6e4a26", straw1: "#9a6a32", straw2: "#b88a4a", nestHollow: "#2e1c0e",
  shadow: "rgba(0,0,0,0.4)",
};
const CW = 180, CH = 156, FLOOR = 130;
var eggFrameScale=1,eggPreviousFrameTime=null;

/* ---------- Pixel-Primitive ---------- */
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pe(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); if (w <= 0) continue; ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); }
}
function tri(ctx, ax, ay, bx, by, cx2, cy2, col) {
  ctx.fillStyle = col;
  const minY = Math.floor(Math.min(ay, by, cy2)), maxY = Math.ceil(Math.max(ay, by, cy2));
  const edges = [[ax, ay, bx, by], [bx, by, cx2, cy2], [cx2, cy2, ax, ay]];
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (const [x1, y1, x2, y2] of edges) if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (x2 - x1) * ((y - y1) / (y2 - y1)));
    if (xs.length >= 2) { xs.sort((a, b) => a - b); ctx.fillRect(Math.round(xs[0]), y, Math.max(1, Math.round(xs[xs.length - 1] - xs[0])), 1); }
  }
}
function makeRng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- Sprite-Builder: flache Form -> 1px-Outline + manuelles AA + Rim-Light ---------- */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function buildSprite(W, H, draw, outline) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  draw(g);
  const img = g.getImageData(0, 0, W, H), a = img.data;
  const op = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) op[i] = a[i * 4 + 3] > 0 ? 1 : 0;
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const og = out.getContext("2d"); const oimg = og.createImageData(W, H), oa = oimg.data;
  const [orr, ogg, obb] = hexRgb(outline);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (op[i]) { oa[i * 4] = a[i * 4]; oa[i * 4 + 1] = a[i * 4 + 1]; oa[i * 4 + 2] = a[i * 4 + 2]; oa[i * 4 + 3] = 255; }
    else {
      let adj = false;
      if (x > 0 && op[i - 1]) adj = true; if (x < W - 1 && op[i + 1]) adj = true;
      if (y > 0 && op[i - W]) adj = true; if (y < H - 1 && op[i + W]) adj = true;
      if (adj) { oa[i * 4] = orr; oa[i * 4 + 1] = ogg; oa[i * 4 + 2] = obb; oa[i * 4 + 3] = 255; }
    }
  }
  // manuelles AA: konvexe Außenecken mit Zwischenfarbe (Kante + Höhlen-Violett)
  const BG = [0xd2, 0xd7, 0xe0];
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = oa[i * 4 + 3] === 255 ? 1 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (solid[i]) continue;
    const l = x > 0 && solid[i - 1], r = x < W - 1 && solid[i + 1], u = y > 0 && solid[i - W], dn = y < H - 1 && solid[i + W];
    const n = (l ? 1 : 0) + (r ? 1 : 0) + (u ? 1 : 0) + (dn ? 1 : 0);
    if (n === 2 && ((l && u) || (l && dn) || (r && u) || (r && dn))) {
      let rr = 0, gg2 = 0, bb = 0, k = 0;
      if (l) { rr += oa[(i - 1) * 4]; gg2 += oa[(i - 1) * 4 + 1]; bb += oa[(i - 1) * 4 + 2]; k++; }
      if (r) { rr += oa[(i + 1) * 4]; gg2 += oa[(i + 1) * 4 + 1]; bb += oa[(i + 1) * 4 + 2]; k++; }
      if (u) { rr += oa[(i - W) * 4]; gg2 += oa[(i - W) * 4 + 1]; bb += oa[(i - W) * 4 + 2]; k++; }
      if (dn) { rr += oa[(i + W) * 4]; gg2 += oa[(i + W) * 4 + 1]; bb += oa[(i + W) * 4 + 2]; k++; }
      oa[i * 4] = (rr / k + BG[0]) / 2; oa[i * 4 + 1] = (gg2 / k + BG[1]) / 2; oa[i * 4 + 2] = (bb / k + BG[2]) / 2; oa[i * 4 + 3] = 150;
    }
  }
  // Rim-Light: warme Lichtkante an der linken (Fackel-zugewandten) Silhouette
  const RIM = [0xff, 0xd6, 0x86];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!op[i]) continue;
    const leftEmpty = x === 0 || !op[i - 1];
    const upEmpty = y === 0 || !op[i - W];
    if (leftEmpty || (upEmpty && x < W * 0.5)) {
      oa[i * 4]     = Math.min(255, oa[i * 4] * 0.30 + RIM[0] * 0.78);
      oa[i * 4 + 1] = Math.min(255, oa[i * 4 + 1] * 0.34 + RIM[1] * 0.70);
      oa[i * 4 + 2] = Math.min(255, oa[i * 4 + 2] * 0.40 + RIM[2] * 0.52);
    }
  }
  og.putImageData(oimg, 0, 0);
  return out;
}

/* ---------- statischer Raum (dunkles Zimmer, elektrische Wandlampe) ---------- */
const ROOM = (() => {
  const rng = makeRng(424242), dots = [], floorBits = [];
  for (let i = 0; i < 30; i++) dots.push({ x: 12 + Math.floor(rng() * (CW - 24)), y: 14 + Math.floor(rng() * (FLOOR - 28)) });
  for (let i = 0; i < 22; i++) floorBits.push({ x: Math.floor(rng() * CW), y: FLOOR + 3 + Math.floor(rng() * 14), s: 1 + Math.floor(rng() * 2) });
  return { dots, floorBits };
})();
/* ---------- niedliche, animierte Kulleraugen (Blick wandert, blinzelt, rollt) ---------- */
function gaze(t) {
  const blink = (t % 3400 > 3250) || (t % 5300 > 5180);
  const n = Math.floor(t / 2000), h = (Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0) / 4294967296;
  let dx = 0, dy = 0;
  if (h < 0.34) { dx = 0; dy = 0; }                 // geradeaus
  else if (h < 0.48) { dx = -2; dy = 0; }           // nach links
  else if (h < 0.62) { dx = 2; dy = 0; }            // nach rechts
  else if (h < 0.72) { dx = 0; dy = -2; }           // nach oben
  else if (h < 0.82) { dx = -2; dy = 1; }           // in die Ecke starren
  else if (h < 0.90) { dx = 2; dy = 1; }
  else { const ph = (t % 2000) / 2000 * Math.PI * 2; dx = Math.round(Math.cos(ph) * 2); dy = Math.round(Math.sin(ph) * 1.5); } // Augenrollen
  return { dx, dy, blink };
}
function brokenHole(ctx, cx, cy, R, P, seed, cracks) {
  const N = 16, rng = makeRng(seed), rad = [];
  for (let i = 0; i < N; i++) rad.push(R + rng() * 2.6 - 0.6);                    // unregelmäßiger Radius je Sektor -> zackig
  const D = "#0c0913", maxR = Math.ceil(R + 3);
  for (let y = -maxR; y <= maxR; y++) for (let x = -maxR; x <= maxR; x++) {
    const d = Math.sqrt(x * x + y * y);
    let ai = (Math.atan2(y, x) / (Math.PI * 2)) * N; ai = ((ai % N) + N) % N;
    const br = rad[Math.floor(ai)];                                              // gestufte (zackige) Bruchkante
    const px = Math.round(cx + x), py = Math.round(cy + y);
    if (d < br - 0.5) { ctx.fillStyle = D; ctx.fillRect(px, py, 1, 1); }          // dunkles Inneres
    else if (d < br + 0.85) { ctx.fillStyle = (x + y < -1) ? P.hi : (x + y > 1 ? P.dk : P.base); ctx.fillRect(px, py, 1, 1); } // Schalenbruch: oben-links hell, unten-rechts dunkel
  }
  if (cracks !== false) {                                                        // Stressrisse nur bei Augenlöchern
    const r2 = makeRng((seed ^ 0x55) >>> 0);
    for (let c = 0; c < 3; c++) {
      let a = r2() * Math.PI * 2, len = 3 + Math.floor(r2() * 4), x = Math.cos(a) * R, y = Math.sin(a) * R;
      for (let i = 0; i < len; i++) { x += Math.cos(a) * 1.3; y += Math.sin(a) * 1.3; a += (r2() - 0.5) * 0.8; ctx.fillStyle = P.dk; ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1); }
    }
  }
}
/* ---------- Stimmung: sichtbarer Ausdruck statt nur Balken ---------- */
function eggMood(S) {
  if (S.krank) return "sick";                    // eigener Ausdruck über die Augen (Lider)
  const avg = (Math.max(0, S.hunger) + Math.max(0, S.sauberkeit) + Math.max(0, S.power)) / 3;
  if (avg >= 65) return "happy";
  if (avg >= 30) return "neutral";
  return "sad";
}
function isNightTime() {
  const h = new Date().getHours();
  return h >= 23 || h < 6;
}
// Rein atmosphärische Zufallsmomente beim Wiederkehren — keine Belohnung, kein
// Stat-Effekt, nur eine kleine Überraschung statt immer derselben Meldung.
const FLAVOR_MOMENTS = [
  "🪨 Hat einen glänzenden Kiesel entdeckt und beäugt ihn misstrauisch.",
  "🎵 Irgendwo im Labor summt eine alte Melodie.",
  "🔬 Ein Kollege huscht mit einem Klemmbrett vorbei.",
  "✨ Für einen Moment schimmert die Schale in einem ungewohnten Ton.",
  "🐜 Etwas Kleines krabbelt kurz über den Boden und verschwindet wieder.",
  "📻 Aus der Wand kommt kurz ein Rauschen — dann wieder Stille.",
  "🫧 Eine einzelne Blase steigt aus dem Nährbecken auf.",
  "🌡 Das Thermometer zeigt heute einen besonders gemütlichen Wert.",
];
function drawEyes(ctx, cx, ey, t, P, mode, track, prof, sick, sleeping, mood) {
  const sep0 = Math.round(P.rb * 0.30), R0 = Math.max(4, Math.round(P.rb * 0.24)), shell = mode !== "dark";
  const pd = prof ? Math.sign(prof) : 0, pm = prof ? Math.min(1, Math.abs(prof)) : 0;
  const expression = mood || "neutral";
  let dx2, dy2, blink;
  if (track) {                                                    // Fliege mit den Augen verfolgen
    const a = Math.atan2(track.y - ey, track.x - cx), m = Math.min(1, Math.hypot(track.x - cx, track.y - ey) / 24);
    dx2 = Math.cos(a) * (R0 - 1.5) * m; dy2 = Math.sin(a) * (R0 - 1.5) * m; blink = (t % 6000) > 5900;
  } else { const G = gaze(t); dx2 = G.dx * (R0 / 4); dy2 = G.dy * (R0 / 4); blink = G.blink; }
  if (sleeping) blink = true;
  if (expression === "happy") dy2 -= Math.max(1, Math.round(R0 * 0.24));
  else if (expression === "sad") dy2 += Math.max(1, Math.round(R0 * 0.34));
  const eyeOrder = pd !== 0 ? [-pd, pd] : [-1, 1];                // hinteres Auge zuerst -> vorderes überdeckt es
  for (const sign of eyeOrder) {
    const isBack = pd !== 0 && sign !== pd;
    const sep = Math.round(sep0 * (isBack ? 1 - pm * 0.34 : 1));
    const R = Math.max(3, Math.round(R0 * (isBack ? 1 - pm * 0.22 : 1)));
    const pr = R * 0.5;
    const ex = cx + sign * sep;
    if (shell) brokenHole(ctx, ex, ey, R + 1, P, sign < 0 ? 11 : 12, true);
    if (blink) { rect(ctx, ex - (R - 1), ey + 1, 2 * (R - 1), 1, "#cdc7da"); continue; }
    if (mode === "glow") {
      const [r, g, b] = hexRgb(P.eyeCol);
      const gl = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 2.4);
      gl.addColorStop(0, `rgba(${r},${g},${b},0.55)`); gl.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = gl; ctx.fillRect(ex - R * 2.4, ey - R * 2.4, R * 4.8, R * 4.8);
      pe(ctx, ex, ey, R - 1, R - 1, P.eyeCol);
      pe(ctx, ex + dx2, ey + dy2, pr, pr, "#16121f");
      rect(ctx, ex + dx2 - 1, ey + dy2 - 1, 1, 1, "#fff");
    } else {
      const scl = mode === "lit" ? "#f4efe2" : "#cdc7dc";
      pe(ctx, ex, ey, R - 0.6, R - 0.6, scl);
      pe(ctx, ex + dx2, ey + dy2, pr, pr + 0.3, "#15121f");
      rect(ctx, ex + dx2 - 1, ey + dy2 - 2, 1, 1, "#fff");
    }
    if (!blink && expression === "happy") {
      // Kleine nach oben gewölbte Lidlinie: Freude wird ausschließlich über
      // die Augen gelesen, ohne einen Mund unterhalb der Augen zu zeichnen.
      const col = P.outline || "#2a2014", y = Math.round(ey + R - 2);
      rect(ctx, ex - 2, y + 1, 1, 1, col);
      rect(ctx, ex - 1, y, 2, 1, col);
      rect(ctx, ex + 1, y + 1, 1, 1, col);
    } else if (!blink && expression === "sad") {
      // Traurigkeit bleibt innerhalb der Augen: tiefere Pupillen und schwere Lider.
      const lid = P.outline || "#5a5260";
      rect(ctx, ex - R + 1, ey - R + 1, 2 * R - 2, Math.max(1, Math.round(R * 0.45)), lid);
    }
  }
  if (sick) {                                                        // kränklicher Blick: Lider halb zu
    for (const sign of (pd !== 0 ? [-pd, pd] : [-1, 1])) {
      const isBack = pd !== 0 && sign !== pd;
      const sep = Math.round(sep0 * (isBack ? 1 - pm * 0.34 : 1));
      const R = Math.max(3, Math.round(R0 * (isBack ? 1 - pm * 0.22 : 1)));
      const ex = cx + sign * sep;
      rect(ctx, Math.round(ex) - R + 1, Math.round(ey) - R, R * 2 - 1, Math.round(R * 0.8), "#8aa668");   // grünliches Lid
      rect(ctx, Math.round(ex) - R + 1, Math.round(ey) - R + Math.round(R * 0.8) - 1, R * 2 - 1, 1, "#5a7444");   // Lidkante
      pe(ctx, ex, ey + R + 2, 2.4, 1.3, "rgba(120,180,90,0.55)");   // grünliche Wange
    }
  }
}
/* ---------- Wärmelampe (Brutkasten) + Steuerbox ---------- */
function drawHeatLamp(ctx, t, stage, power) {
  const lx = 32, ly = 24, red = stage === 0;
  const pw = Math.max(0, Math.min(100, power === undefined ? 100 : power)) / 100;   // Lampen-Intensität
  // Decken-Kabel (leicht durchhängend) + Klemmhalter
  for (let i = 0; i <= 10; i++) {
    const q = i / 10, kx = 10 + q * 4, ky = q * 8 + Math.sin(q * Math.PI) * 1.5;
    rect(ctx, Math.round(kx), Math.round(ky), 1, 1, "#2e3240");
  }
  rect(ctx, 8, 8, 9, 5, "#5a5e70"); rect(ctx, 8, 8, 9, 1, "#9aa0b2"); rect(ctx, 8, 12, 9, 1, "#33363f");   // Klemme
  rect(ctx, 10, 10, 2, 1, "#22242e");                                                                        // Klemmschraube
  rect(ctx, 15, 9, lx - 17, 3, "#4a4e5e"); rect(ctx, 15, 9, lx - 17, 1, "#7a8092");                          // Arm
  rect(ctx, lx - 3, 11, 3, ly - 12, "#4a4e5e"); rect(ctx, lx - 3, 11, 1, ly - 12, "#6a6e80");                // Hals
  rect(ctx, lx - 4, ly - 13, 5, 3, "#33363f");                                                               // Gelenk
  // Glocken-Reflektor: gestufte Kuppel statt Dreieck
  const RW = [8, 12, 15, 17, 18], top = ly - 10;
  for (let r = 0; r < RW.length; r++) {
    const w = RW[r], y = top + r * 4;
    rect(ctx, lx - w, y, w * 2, 4, "#4a4e5e");                                    // Korpus
    rect(ctx, lx - w, y, 3, 4, "#2e323e");                                        // Schattenseite links
    rect(ctx, lx + w - 4, y, 3, 4, "#7a8092");                                    // Lichtkante rechts
    rect(ctx, lx - Math.round(w * 0.35), y, 2, 4, "#8a90a2");                     // Glanzstreifen
  }
  rect(ctx, lx - 18, top + 20, 36, 2, "#22242e");                                  // Öffnungsrand dunkel
  rect(ctx, lx - 18, top + 20, 36, 1, "#6a6e80");
  // Innenseite (warm angeleuchtet je nach Power)
  ctx.globalAlpha = 0.25 + 0.45 * pw;
  rect(ctx, lx - 14, top + 16, 28, 4, red ? "#8a3a18" : "#8a8468");
  ctx.globalAlpha = 1;
  // Fassung + Birne
  const by = top + 24, pulse = 0.82 + 0.18 * Math.sin(t / 280);
  rect(ctx, lx - 2, top + 21, 4, 3, "#8a8a96"); rect(ctx, lx - 2, top + 22, 4, 1, "#55555f");   // Gewinde
  const bright = pw * pulse;
  const glass = red ? "#ff5a1e" : "#dfeafc", core = red ? "#ffd28a" : "#ffffff";
  pe(ctx, lx, by, 5, 5.4, "#2a2e3a");
  ctx.globalAlpha = 0.25 + 0.75 * bright; pe(ctx, lx, by, 4.4, 4.8, glass); ctx.globalAlpha = 1;
  if (bright > 0.12) { ctx.globalAlpha = bright; pe(ctx, lx, by, 2.4, 2.6, core); ctx.globalAlpha = 1; }
  rect(ctx, lx - 2, by - 3, 1, 2, "rgba(255,255,255,0.8)");                        // Glasreflex
  if (bright > 0.06) {                                                             // Glühwendel
    ctx.globalAlpha = Math.min(1, bright + 0.2);
    rect(ctx, Math.round(lx) - 1, Math.round(by), 2, 1, "#fff7d8");
    rect(ctx, Math.round(lx), Math.round(by) - 1, 1, 3, "#ffe9b0");
    ctx.globalAlpha = 1;
  }
  // Lichtkegel + Glow — Intensität folgt dem Strom
  if (bright > 0.03) {
    const cone = red ? "255,140,60" : "255,238,200";
    ctx.fillStyle = `rgba(${cone},${0.16 * bright})`;
    ctx.beginPath(); ctx.moveTo(lx - 8, by + 4); ctx.lineTo(lx + 9, by + 2); ctx.lineTo(130, FLOOR); ctx.lineTo(52, FLOOR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${cone},${0.08 * bright})`;
    ctx.beginPath(); ctx.moveTo(lx - 8, by + 4); ctx.lineTo(lx + 9, by + 2); ctx.lineTo(158, FLOOR); ctx.lineTo(30, FLOOR); ctx.closePath(); ctx.fill();
    const gl = ctx.createRadialGradient(lx, by, 4, lx, by, 96);
    gl.addColorStop(0, `rgba(${cone},${0.26 * bright})`); gl.addColorStop(1, `rgba(${cone},0)`);
    ctx.fillStyle = gl; ctx.fillRect(0, 0, CW, CH);
  }
}
function drawPowerTube(ctx, power, t) {
  const bx = 3, by = 34, bw = 9, bh = 88;                            // vertikale Batterie links
  const pw = Math.max(0, Math.min(100, power));
  rect(ctx, bx + 2, by - 4, bw - 4, 3, "#8a90a2");                   // Pluspol
  rect(ctx, bx + 2, by - 4, bw - 4, 1, "#c8ccd8");
  rect(ctx, bx - 1, by - 1, bw + 2, bh + 2, "#22242e");              // Gehäuse
  rect(ctx, bx, by, bw, bh, "#3a3e4c");
  rect(ctx, bx, by, 1, bh, "#565a6a");                                // Kante links hell
  rect(ctx, bx + bw - 1, by, 1, bh, "#1a1c24");                       // Kante rechts dunkel
  const SEG = 5, segH = Math.floor((bh - (SEG + 1) * 2) / SEG);       // 5 Segmente
  const filled = pw <= 0 ? 0 : Math.max(1, Math.round(pw / 100 * SEG));
  const blink = pw <= 12 && Math.floor(t / 420) % 2 === 0;
  for (let k = 0; k < SEG; k++) {
    const sy = by + bh - 2 - (k + 1) * (segH + 2) + 2;
    const on = k < filled;
    let col = "#14161e";
    if (on) col = pw > 50 ? "#3ee08a" : pw > 25 ? "#f0c030" : "#f05040";
    if (on && k === filled - 1 && blink) col = "#5a2020";
    rect(ctx, bx + 1, sy, bw - 2, segH, col);
    if (on) rect(ctx, bx + 1, sy, 2, segH, "rgba(255,255,255,0.25)"); // Segment-Glanz
  }
  if (pw > 0) {                                                       // kleiner Blitz auf dem Gehäuse
    const zx = bx + 3, zy = by + Math.floor(bh / 2) - 4;
    ctx.globalAlpha = 0.9;
    rect(ctx, zx + 2, zy, 2, 3, "#fff6c0"); rect(ctx, zx + 1, zy + 3, 2, 2, "#fff6c0");
    rect(ctx, zx + 2, zy + 5, 1, 3, "#fff6c0");
    ctx.globalAlpha = 1;
  }
}

/* ---------- HUD: Status im Laborboden (Tamagotchi-Display) ---------- */
function drawHud(ctx, S, t) {
  const hy = CH - 17, hh = 15;
  ctx.fillStyle = "rgba(10,10,18,0.78)";                              // Panel im Boden
  ctx.fillRect(2, hy, CW - 4, hh);
  rect(ctx, 2, hy, CW - 4, 1, "rgba(255,255,255,0.10)");
  rect(ctx, 2, hy + hh - 1, CW - 4, 1, "rgba(0,0,0,0.5)");
  ctx.font = '8px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.textBaseline = "top";
  const segs = (x0, v, col) => {
    for (let k = 0; k < 5; k++) {
      const on = v > k * 20;
      rect(ctx, x0 + k * 8, hy + 4, 7, 7, on ? col : "#232433");
      if (on) rect(ctx, x0 + k * 8, hy + 4, 7, 1, "rgba(255,255,255,0.3)");
    }
  };
  ctx.fillText(S.stage < 2 ? "💧" : "🍖", 6, hy + 3);
  segs(19, S.hunger, S.hunger > 50 ? "#8ac83e" : S.hunger > 25 ? "#e0a030" : "#e04040");
  ctx.fillText("🧼", 66, hy + 3);
  segs(79, S.sauberkeit, S.krank ? "#7aa040" : "#4ec8c0");
  ctx.fillText("🔥", 126, hy + 3);
  ctx.fillStyle = (S.streak || 0) > 0 ? "#ffb050" : "#5a5878";
  ctx.fillText(String(S.streak || 0), 138, hy + 4);
  ctx.fillText("✨", 152, hy + 3);
  ctx.fillStyle = "#cfb8ff";
  ctx.fillText(String(Math.min(99, S.stardust || 0)), 164, hy + 4);
}
function drawDim(ctx, power, t, deko) {
  const pw = Math.max(0, Math.min(100, power));
  const nightDim = isNightTime() ? 0.32 : 0;
  if (pw >= 99.5 && nightDim === 0) return;                                        // nur bei ganz vollem Akku + Tag hell
  let dim = Math.max(nightDim, Math.min(0.86, (100 - pw) / 100 * 0.86));           // dunkelt ab dem ersten Prozent stetig ab
  if (deko && deko.nightlight) dim = Math.min(dim, 0.74);                            // Nachtlicht hält Restlicht
  ctx.fillStyle = `rgba(5,7,16,${dim})`;
  ctx.fillRect(0, 0, CW, CH);
  const glow = Math.max(0.05, pw / 100);                                           // leichter Restschein um die Lampe
  const g = ctx.createRadialGradient(32, 38, 3, 32, 38, 84);
  g.addColorStop(0, `rgba(255,232,180,${0.30 * glow * dim})`);
  g.addColorStop(1, "rgba(255,232,180,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  if (deko && deko.nightlight) {                                                     // warmer Schein an der Steckdose
    const g2 = ctx.createRadialGradient(CW - 22, FLOOR - 12, 2, CW - 22, FLOOR - 12, 42);
    g2.addColorStop(0, `rgba(255,190,110,${0.34 * dim})`);
    g2.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = g2; ctx.fillRect(0, 0, CW, CH);
  }
}
function drawLabBox(ctx, t) {
  const bx = CW - 32, by = 38;                                // Brutkasten-Steuerbox
  rect(ctx, bx, by, 20, 16, "#2a2440"); rect(ctx, bx, by, 20, 1, "#3a3252"); rect(ctx, bx, by, 1, 16, "#3a3252");
  rect(ctx, bx + 3, by + 4, 2, 2, Math.sin(t / 420) > 0 ? "#5ad06a" : "#1c3a22");        // LED grün
  rect(ctx, bx + 7, by + 4, 2, 2, Math.sin(t / 260 + 1) > 0.3 ? "#ff7a4a" : "#3a1c12");  // LED orange
  pe(ctx, bx + 15, by + 6, 2, 2, "#8a8498"); rect(ctx, bx + 15, by + 4, 1, 2, "#15101f"); // Drehregler
  rect(ctx, bx + 3, by + 9, 13, 4, "#0c241a");                                            // Display
  for (let i = 0; i < 3; i++) rect(ctx, bx + 4 + i * 3, by + 10, 2, 2, "#5ad0b0");
}
function drawRoom(ctx, t, stage, power) {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, "#e8ebf1"); g.addColorStop(1, "#d2d7e0");                  // helle, fast weiße Laborwand
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, FLOOR);
  ctx.fillStyle = "#c2c7d2";                                                   // weiße Kacheln mit hellgrauer Fuge
  for (let x = 0; x <= CW; x += 22) ctx.fillRect(x, 6, 1, FLOOR - 6);
  for (let y = 12; y < FLOOR; y += 20) ctx.fillRect(0, y, CW, 1);
  rect(ctx, 0, 0, CW, 6, "#aeb4c2"); rect(ctx, 0, 6, CW, 1, "#9aa0b0");        // Deckenleiste
  rect(ctx, 0, FLOOR - 3, CW, 3, "#b6bcc8"); rect(ctx, 0, FLOOR - 3, CW, 1, "#9aa0b0"); // Sockel
  rect(ctx, 0, FLOOR, CW, CH - FLOOR, "#c6cad4"); rect(ctx, 0, FLOOR, CW, 2, "#dde1e8"); // heller Boden
  for (const f of ROOM.floorBits) rect(ctx, f.x, f.y, f.s, f.s, "#aab0bc");
  drawHeatLamp(ctx, t, stage, power);
  drawLabBox(ctx, t);
  rect(ctx, CW - 27, FLOOR - 10, 8, 7, "#9aa0b0"); rect(ctx, CW - 26, FLOOR - 9, 6, 5, "#c6cad4"); // Steckdose
  rect(ctx, CW - 24, FLOOR - 8, 1, 2, "#5a6070"); rect(ctx, CW - 22, FLOOR - 8, 1, 2, "#5a6070");
  const vg = ctx.createRadialGradient(CW / 2, FLOOR - 16, 80, CW / 2, FLOOR - 16, 150);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(40,46,70,0.12)");   // nur sehr dezente Vignette
  ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
}
// Strom AUS: ganzer Bildschirm schwarz, nur die Augen glimmen & blinzeln
function drawPowerOff(ctx, S, t) {
  if (expAnim.st === "away" || expAnim.st === "leaving") {           // Ei ist unterwegs: nur dunkler Raum
    ctx.fillStyle = "#050508"; ctx.fillRect(0, 0, CW, CH);
    return;
  }
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH);
  const P = EGG_PAL[stg(S.stage)]; if (!P.eyes) return;                         // Ur-Ei hat noch keine Augen -> komplett dunkel
  const cx = 92, floorY = FLOOR - 1, eb = S.stage < 2 ? floorY - 12 : floorY, breath = Math.sin(t / 900) * 0.4;
  // frühe Stufen leuchten NICHT -> nur im Dunkeln sichtbar; rissig/kosmisch glimmen
  drawEyes(ctx, cx, eb - (P.rb + P.ht * 0.34) + breath, t, P, S.stage === 5 ? "glow" : "dark", null, 0, false, false, "neutral");
}

/* ---------- Shop & Deko ---------- */
function drawDeko(ctx, t, deko, prestige) {
  if (deko.rug) {                                                    // gestreifter ovaler Läufer mit Fransen
    const rx = 92, ry = FLOOR + 3;
    pe(ctx, rx, ry, 33, 5.5, "#5a3020");
    pe(ctx, rx, ry, 31, 4.6, "#a05a32");
    rect(ctx, rx - 24, ry - 2, 48, 1, "#d89a58");
    rect(ctx, rx - 28, ry,     56, 1, "#7a3a22");
    rect(ctx, rx - 24, ry + 2, 48, 1, "#d89a58");
    for (let k = -1; k <= 1; k++) { rect(ctx, rx - 35, ry + k, 2, 1, "#c8b090"); rect(ctx, rx + 33, ry + k, 2, 1, "#c8b090"); }   // Fransen
  }
  if (deko.plant) {                                                  // rechts — kollidiert nicht mit dem Prestige-Portal
    const ox = 127;
    rect(ctx, 7 + ox, 119, 18, 11, "#7a4820"); rect(ctx, 9 + ox, 117, 14, 3, "#9a6030");
    rect(ctx, 8 + ox, 119, 17, 1, "#b07840");
    rect(ctx, 15 + ox, 104, 2, 16, "#2a6a20"); rect(ctx, 11 + ox, 109, 2, 11, "#358a28"); rect(ctx, 19 + ox, 111, 2, 9, "#358a28");
    pe(ctx, 15 + ox, 103, 7, 5, "#3a9a28"); pe(ctx, 11 + ox, 109, 6, 4, "#4aaa30"); pe(ctx, 20 + ox, 111, 5, 4, "#4aaa30"); pe(ctx, 15 + ox, 100, 5, 4, "#2a8a20");
  }
  if (deko.poster) {                                                 // Ei-Poster: Nachthimmel mit Ei-Motiv
    const px = 146, py = 60;
    rect(ctx, px, py, 20, 28, "#3a2c18"); rect(ctx, px + 1, py + 1, 18, 26, "#141030");   // Holzrahmen + Nachthimmel
    pe(ctx, px + 10, py + 16, 5.5, 7, "#c8bca0");                                          // Ei-Silhouette
    pe(ctx, px + 9.5, py + 15.5, 4.5, 6, "#efe6cc");
    rect(ctx, px + 8, py + 13, 1, 1, "#c8bca0"); rect(ctx, px + 12, py + 18, 1, 1, "#c8bca0");   // Sprenkel
    rect(ctx, px + 5, py + 5, 1, 1, "#fff7d0"); rect(ctx, px + 14, py + 7, 1, 1, "#cfe0ff");     // Sterne
    rect(ctx, px + 4, py + 22, 1, 1, "#cfe0ff");
    if (Math.sin(t / 480) > 0.3) rect(ctx, px + 15, py + 3, 1, 1, "#ffffff");                     // blinkender Stern
  }
  if (deko.mobile) {
    const mx = 110, sway = Math.sin(t / 950) * 3;
    rect(ctx, mx, 0, 1, 11, "#9090a0");
    rect(ctx, Math.round(mx - 10 + sway * 0.4), 11, 20, 1, "#c0b070");
    const arms = [{ dx: -9, len: 9 }, { dx: 0, len: 7 }, { dx: 9, len: 11 }];
    const cols2 = ["#f0d050", "#bfa8ff", "#5ad0ff"];
    for (let i = 0; i < arms.length; i++) {
      const ix = Math.round(mx + arms[i].dx + sway * (arms[i].len / 12));
      const iy = 12 + arms[i].len;
      rect(ctx, Math.round(mx + arms[i].dx + sway * 0.3), 12, 1, arms[i].len, "#9090a0");
      if (i === 0) { pe(ctx, ix, iy + 3, 4, 5, cols2[i]); pe(ctx, ix + 2, iy + 2, 3, 3, "#d2d7e0"); }
      else { rect(ctx, ix - 1, iy + 1, 3, 1, cols2[i]); rect(ctx, ix, iy, 1, 3, cols2[i]); }
    }
  }
  if (deko.nightlight) {                                             // steckt in der Steckdose
    const nx = CW - 23, ny = FLOOR - 14;
    rect(ctx, nx - 3, ny, 7, 5, "#d8dce4"); rect(ctx, nx - 3, ny, 7, 1, "#f0f2f6"); rect(ctx, nx - 3, ny + 4, 7, 1, "#a0a6b2");
    const pulse = 0.6 + 0.4 * Math.sin(t / 900);
    ctx.globalAlpha = pulse; pe(ctx, nx + 0.5, ny + 2, 1.7, 1.7, "#ffca70"); ctx.globalAlpha = 1;
  }
  /* ---- Wanddeko (ab Prestige 1) ---- */
  if (deko.wallclock) {                                             // echte Uhrzeit
    const ux = 92, uy = 36;
    pe(ctx, ux, uy, 7.5, 7.5, "#4a3a20"); pe(ctx, ux, uy, 6.3, 6.3, "#efe8d4");
    rect(ctx, ux, uy - 5, 1, 1, "#4a3a20"); rect(ctx, ux, uy + 4, 1, 1, "#4a3a20");
    rect(ctx, ux - 5, uy, 1, 1, "#4a3a20"); rect(ctx, ux + 4, uy, 1, 1, "#4a3a20");
    const dn = new Date();
    const ha = ((dn.getHours() % 12) + dn.getMinutes() / 60) / 12 * 6.2832 - 1.5708;
    const ma = dn.getMinutes() / 60 * 6.2832 - 1.5708;
    for (let k = 1; k <= 3; k++) rect(ctx, Math.round(ux + Math.cos(ha) * k), Math.round(uy + Math.sin(ha) * k), 1, 1, "#2a2016");
    for (let k = 1; k <= 5; k++) rect(ctx, Math.round(ux + Math.cos(ma) * k * 0.9), Math.round(uy + Math.sin(ma) * k * 0.9), 1, 1, "#5a4a30");
    rect(ctx, ux, uy, 1, 1, "#2a2016");
  }
  if (deko.photo) {                                                 // Erinnerung ans erste Ei
    const fx = 66, fy = 50;
    rect(ctx, fx, fy, 17, 15, "#6a4a24"); rect(ctx, fx + 1, fy + 1, 15, 13, "#f2ead6");
    pe(ctx, fx + 6, fy + 8, 3.2, 4.2, "#d8cca8"); pe(ctx, fx + 5.7, fy + 7.7, 2.6, 3.6, "#efe6cc");   // großes Ei
    pe(ctx, fx + 12, fy + 9.5, 2, 2.8, "#d8cca8"); pe(ctx, fx + 11.8, fy + 9.3, 1.6, 2.2, "#efe6cc"); // kleines Ei
    rect(ctx, fx + 9, fy + 4, 1, 1, "#e05070"); rect(ctx, fx + 8, fy + 3, 1, 1, "#e05070"); rect(ctx, fx + 10, fy + 3, 1, 1, "#e05070");   // Herz
  }
  if (deko.trophy) {                                                // Pokalregal: wächst mit Prestige
    const rx0 = 118, ry0 = 42;
    rect(ctx, rx0, ry0 + 8, 26, 2, "#7a5828"); rect(ctx, rx0, ry0 + 8, 26, 1, "#9a7438");
    rect(ctx, rx0 + 2, ry0 + 10, 2, 3, "#5a4020"); rect(ctx, rx0 + 22, ry0 + 10, 2, 3, "#5a4020");   // Konsolen
    const nT = Math.max(1, Math.min(prestige || 1, 4));
    for (let i = 0; i < nT; i++) {
      const tx1 = rx0 + 4 + i * 6;
      rect(ctx, tx1, ry0 + 6, 4, 1, "#c89010");                     // Sockel
      rect(ctx, tx1 + 1, ry0 + 3, 2, 3, "#f0c030");                 // Kelch
      rect(ctx, tx1, ry0 + 2, 4, 1, "#f0c030");
      rect(ctx, tx1 + 1, ry0 + 2, 1, 1, "#fff0a0");                 // Glanz
    }
  }
  if (deko.lights) {                                                // Lichterkette quer über die Wand
    for (let i = 0; i <= 20; i++) {
      const q = i / 20, lxp = 56 + q * 84, lyp = 22 + Math.sin(q * Math.PI) * 7;
      rect(ctx, Math.round(lxp), Math.round(lyp), 1, 1, "#3a3448");                 // Kabel
      if (i % 3 === 1) {
        const ci = Math.floor(i / 3), on = Math.floor(t / 600 + ci) % 2 === 0;
        const cols3 = ["#ff5060", "#ffd040", "#50c860", "#50a0ff", "#d060e0", "#ff9040", "#60e0d0"];
        ctx.globalAlpha = on ? 1 : 0.35;
        rect(ctx, Math.round(lxp), Math.round(lyp) + 1, 2, 2, cols3[ci % 7]);
        ctx.globalAlpha = 1;
      }
    }
  }
  const mon = curMonth();
  /* ---- Saisonale Wanddeko (Prestige-Kategorie) ---- */
  if (deko.eggarland && [2, 3].includes(mon)) {                     // Oster-Girlande am Wand-Spot
    for (let i = 0; i <= 12; i++) {
      const q = i / 12;
      rect(ctx, Math.round(94 + q * 26), Math.round(53 + Math.sin(q * Math.PI) * 5), 1, 1, "#8a7050");
    }
    const eggC = ["#f0a0c0", "#90c8f0", "#f0dc70", "#a0e0a0"];
    for (let k = 0; k < 4; k++) {
      const q = 0.2 + k * 0.2, ex = Math.round(94 + q * 26), ey = Math.round(55 + Math.sin(q * Math.PI) * 5);
      pe(ctx, ex, ey + 2, 1.9, 2.5, eggC[k]);
      rect(ctx, ex - 1, ey + 1, 1, 1, "#ffffff");
    }
  }
  if (deko.bunting && [5, 6, 7].includes(mon)) {                    // Sommer-Wimpelkette
    for (let i = 0; i <= 12; i++) {
      const q = i / 12;
      rect(ctx, Math.round(94 + q * 26), Math.round(53 + Math.sin(q * Math.PI) * 4), 1, 1, "#6a6a80");
    }
    const wc = ["#ff5060", "#ffd040", "#50c860", "#50a0ff", "#d060e0"];
    for (let k = 0; k < 5; k++) {
      const q = 0.1 + k * 0.2, wx2 = Math.round(94 + q * 26), wy2 = Math.round(54 + Math.sin(q * Math.PI) * 4);
      tri(ctx, wx2 - 2, wy2, wx2 + 2, wy2, wx2, wy2 + 5, wc[k]);
    }
  }
  if (deko.web && mon === 9) {                                      // Spinnennetz in der oberen rechten Ecke
    for (const [ex2, ey2] of [[CW - 14, 0], [CW - 1, 12], [CW - 10, 9]])
      for (let k = 0; k <= 8; k++) rect(ctx, Math.round(CW - 1 + (ex2 - (CW - 1)) * k / 8), Math.round((ey2) * k / 8), 1, 1, "#b8bcc8");
    for (const rr of [5, 9]) for (let a = 0; a < 6; a++) {
      const ang = 1.5708 + a * 0.16;
      rect(ctx, Math.round(CW - 1 - Math.cos(ang - 1.5708 + 3.1416) * rr), Math.round(Math.sin(ang) * rr * 0.9), 1, 1, "#c8ccd8");
    }
    const sy2 = 13 + Math.sin(t / 700) * 3;                          // Spinne pendelt
    rect(ctx, CW - 8, 9, 1, Math.round(sy2) - 9, "#9a9eae");
    pe(ctx, CW - 8, sy2 + 1, 2, 2, "#2a2430");
    rect(ctx, CW - 10, Math.round(sy2) + 1, 1, 1, "#2a2430"); rect(ctx, CW - 6, Math.round(sy2) + 1, 1, 1, "#2a2430");
  }
  if (deko.wreath && xmasTime()) {                                  // Adventskranz
    const kx = 106, ky = 62;
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * 6.2832;
      pe(ctx, kx + Math.cos(ang) * 5.5, ky + Math.sin(ang) * 5.5, 2.3, 2.3, a % 2 ? "#1e5428" : "#2a7034");
    }
    rect(ctx, kx - 1, ky + 5, 3, 2, "#c02030");                      // Schleife
    tri(ctx, kx - 1, ky + 6, kx - 4, ky + 9, kx - 1, ky + 8, "#c02030");
    tri(ctx, kx + 1, ky + 6, kx + 4, ky + 9, kx + 1, ky + 8, "#c02030");
    rect(ctx, kx + 3, ky - 5, 1, 1, "#f0c030"); rect(ctx, kx - 5, ky - 2, 1, 1, "#f0c030"); rect(ctx, kx + 4, ky + 2, 1, 1, "#f0c030");   // Kugeln
  }
  /* ---- Saison-Deko: erscheint nur in der jeweiligen Saison ---- */
  const sx0 = 66, gy = FLOOR - 1;
  if (deko.easternest && [2, 3].includes(mon)) {                      // Ostern
    pe(ctx, sx0, gy - 2, 10, 4.5, "#7a5828"); pe(ctx, sx0, gy - 3, 8.5, 3.5, "#9a7438");
    for (let k = 0; k < 5; k++) rect(ctx, sx0 - 9 + k * 4, gy - 6, 2, 1, "#b89050");   // Halme
    pe(ctx, sx0 - 4, gy - 6, 2.2, 3, "#f0a0c0"); rect(ctx, sx0 - 5, gy - 7, 1, 1, "#ffffff");   // rosa Ei
    pe(ctx, sx0,     gy - 7, 2.2, 3, "#90c8f0"); rect(ctx, sx0 - 1, gy - 8, 1, 1, "#ffffff");   // blaues Ei
    pe(ctx, sx0 + 4, gy - 6, 2.2, 3, "#f0dc70"); rect(ctx, sx0 + 3, gy - 7, 1, 1, "#ffffff");   // gelbes Ei
  }
  if (deko.palm && [5, 6, 7].includes(mon)) {                          // Sommer: Palme
    pe(ctx, sx0, gy - 1, 9, 3, "#c8a860"); pe(ctx, sx0, gy - 1.6, 7.5, 2.2, "#e0c078");   // Sandhügel
    for (let k = 0; k < 8; k++) rect(ctx, Math.round(sx0 - 3 + k * 0.6), gy - 4 - k * 3, 3, 3, k % 2 ? "#8a5a28" : "#7a4e20");   // gebogener Stamm
    const px2 = sx0 + 2, py2 = gy - 28;
    const sway2 = Math.sin(t / 1100) * 1.5;
    for (const [dx2, dy2, ln] of [[-9, -2, 8], [9, -2, 8], [-6, -6, 7], [7, -6, 7], [0, -8, 6]]) {   // Wedel
      for (let k = 0; k <= ln; k++) {
        const q = k / ln;
        rect(ctx, Math.round(px2 + dx2 * q + sway2 * q), Math.round(py2 + dy2 * q + q * q * 5), 2, 1, k < 2 ? "#2a7a30" : "#3a9a3c");
      }
    }
    pe(ctx, px2 - 2, py2 + 2, 1.6, 1.6, "#6a4418"); pe(ctx, px2 + 2, py2 + 3, 1.6, 1.6, "#6a4418");   // Kokosnüsse
  }
  if (deko.pumpkin && mon === 9) {                                    // Halloween
    pe(ctx, sx0, gy - 5, 8, 6.5, "#a04808"); pe(ctx, sx0, gy - 5, 7, 5.8, "#e07018");
    rect(ctx, Math.round(sx0) - 4, gy - 10, 1, 5, "#c05810"); rect(ctx, Math.round(sx0) + 3, gy - 10, 1, 5, "#c05810");   // Rillen
    rect(ctx, Math.round(sx0) - 1, gy - 13, 2, 3, "#4a6a20");                             // Stiel
    const glow = 0.55 + 0.45 * Math.sin(t / 600);
    ctx.globalAlpha = glow;
    rect(ctx, Math.round(sx0) - 4, gy - 8, 2, 2, "#ffd040"); rect(ctx, Math.round(sx0) + 2, gy - 8, 2, 2, "#ffd040");     // Augen
    rect(ctx, Math.round(sx0) - 3, gy - 4, 2, 1, "#ffd040"); rect(ctx, Math.round(sx0), gy - 3, 2, 1, "#ffd040"); rect(ctx, Math.round(sx0) + 2, gy - 4, 1, 1, "#ffd040");   // Zackenmund
    ctx.globalAlpha = 1;
  }
  if (deko.xmastree && xmasTime()) {                                  // Weihnachten
    rect(ctx, Math.round(sx0) - 2, gy - 6, 4, 6, "#6a4018");                              // Stamm
    tri(ctx, sx0, gy - 34, sx0 - 8, gy - 22, sx0 + 8, gy - 22, "#1e6428");
    tri(ctx, sx0, gy - 28, sx0 - 11, gy - 13, sx0 + 11, gy - 13, "#2a7a34");
    tri(ctx, sx0, gy - 22, sx0 - 14, gy - 5, sx0 + 14, gy - 5, "#358a3e");
    rect(ctx, Math.round(sx0) - 1, gy - 37, 2, 3, "#ffd83a"); rect(ctx, Math.round(sx0) - 2, gy - 36, 4, 1, "#ffd83a");   // Stern
    const LP = [[-6, -10], [4, -8], [-3, -17], [6, -15], [0, -24], [-7, -20]];
    for (let i = 0; i < LP.length; i++) {
      const on = Math.floor(t / 450 + i) % 2 === 0;
      rect(ctx, Math.round(sx0) + LP[i][0], gy + LP[i][1], 1, 1, on ? ["#ff5050", "#ffd040", "#50a0ff"][i % 3] : "#183a20");   // Lichterkette blinkt
    }
  }
}
/* ---------- geformter AO-Bodenschatten (Bayer-Dithering) ---------- */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function drawDragonShadow(ctx, feet, bodyCx, bodyRx, fy) {
  for (let yy = 0; yy <= 9; yy++) for (let xx = -bodyRx - 4; xx <= bodyRx + 4; xx++) {
    const x = bodyCx + xx, y = fy + yy;
    const bodyD = (xx * xx) / (bodyRx * bodyRx) + (yy * yy) / 16;     // flache Körper-Ellipse
    let fe = 0;
    for (const f of feet) { const d = ((x - f.x) * (x - f.x)) / (f.r * f.r) + (yy * yy) / (f.r * f.r * 0.55); if (d < 1) fe = Math.max(fe, 1 - d); }
    let dens = 0;
    if (bodyD < 1) dens = 0.4 * (1 - bodyD);
    dens = Math.max(dens, 0.62 * fe + 0.55 * fe);                     // dunkelste AO unter den "Füßen"
    if (dens <= 0.02) continue;
    const th = BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;
    if (dens > th) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, 0.32 + dens * 0.3)})`; ctx.fillRect(x, y, 1, 1); }
  }
}

/* =======================================================================
   EI-SPRITES
   ======================================================================= */
const BUF_BASE = 80, EGG_W = 80, EGG_H = 92, EGG_CX = 40, EGG_VER = 8;
const LIMB = { arm: "#5a8ad0", armDk: "#34588f", armLt: "#9ec2ec", hand: "#2e4a82", handDk: "#1d3160" };
const EGG_PAL = [
  { name: "Ur-Ei", rb: 24, ht: 34, base: "#b4ab93", dk: "#8d8470", lt: "#d2cab2", hi: "#e8e2cf", spot: "#938a74", claw: "#cfc7b0", outline: "#2a2418", eyes: false, feet: false, arms: false, eyeCol: null },
  { name: "Beobachtendes Ei", rb: 24, ht: 35, base: "#d9c78c", dk: "#ad9659", lt: "#efe1a8", hi: "#fbf3d4", spot: "#a87a48", claw: "#efe6c4", outline: "#2a2014", eyes: true, feet: false, arms: false, eyeCol: "#f0b020" },
  { name: "Watschelndes Ei", rb: 25, ht: 36, base: "#dcc888", dk: "#b09655", lt: "#f1e3a6", hi: "#fdf4d2", spot: "#a07a4a", claw: "#efe6c4", outline: "#2a2014", eyes: true, feet: true, arms: false, eyeCol: "#f0b020" },
  { name: "Greifendes Ei", rb: 26, ht: 38, base: "#dfca86", dk: "#b39755", lt: "#f3e5a6", hi: "#fdf5d0", spot: "#9c7a4c", claw: "#efe6c4", outline: "#2a2014", eyes: true, feet: true, arms: true, eyeCol: "#f4b41e" },
  { name: "Wucherndes Ei", rb: 27, ht: 42, base: "#e6cf8e", dk: "#bf9c52", lt: "#f8ecae", hi: "#fff7d6", spot: "#b07c40", claw: "#efe6c4", outline: "#2a1e10", eyes: true, feet: true, arms: true, eyeCol: "#f4b41e" },
  { name: "Kosmisches Ei", rb: 28, ht: 44, base: "#2c2552", dk: "#1a1538", lt: "#4a3f7a", hi: "#8a7ad0", spot: "#6a5ab0", claw: "#cfc7ff", outline: "#0d0a20", eyes: true, feet: true, arms: true, eyeCol: "#bff0ff", cosmic: true },
];

function eggBody(g, P) {
  const cx = EGG_CX, base = BUF_BASE, topY = base - (P.ht + P.rb), yc = topY + P.ht;
  g.fillStyle = P.base;
  for (let y = topY; y <= base; y++) {
    let w;
    if (y < yc) w = P.rb * Math.sqrt(Math.max(0, 1 - ((yc - y) / P.ht) ** 2));     // getaperte Oberseite
    else w = P.rb * Math.sqrt(Math.max(0, 1 - ((y - yc) / P.rb) ** 2));            // runde Unterseite
    if (w <= 0) continue;
    g.fillRect(Math.round(cx - w), y, Math.round(w * 2), 1);
  }
  pe(g, cx + P.rb * 0.34, yc + P.rb * 0.10, P.rb * 0.62, (P.ht + P.rb) * 0.30, P.dk);  // Kernschatten unten-rechts
  pe(g, cx - P.rb * 0.40, yc - P.ht * 0.42, P.rb * 0.44, P.ht * 0.34, P.lt);           // Licht oben-links (Fackel)
  rect(g, cx - Math.round(P.rb * 0.5), topY + Math.round(P.ht * 0.30), 4, 5, P.hi);    // Glanzpunkt
  for (const [sx, sy] of [[-7, -2], [6, -8], [-9, 7], [8, 10], [0, 14], [-3, 4], [9, -1]]) rect(g, cx + sx, yc + sy, 2, 2, P.spot);
  if (P.cosmic) { const rng = makeRng(77); for (let i = 0; i < 26; i++) { const ax = cx + (rng() * 2 - 1) * P.rb * 0.8, ay = topY + 4 + rng() * (P.ht + P.rb - 8); rect(g, ax, ay, 1, 1, rng() < 0.5 ? "#bfe0ff" : "#e8d8ff"); } }
}
function drawEggShapes(g, stage) {
  eggBody(g, EGG_PAL[stage]);   // Augen werden live gezeichnet (animierter Blick), nicht ins Sprite gebacken
}
let EGG = Array.from({ length: 6 }, () => ({ open: null, blink: null, ver: -1 }));
function ensureEgg(stage) {
  stage = stg(stage);
  const e = EGG[stage]; if (e.ver === EGG_VER) return;
  const P = EGG_PAL[stage];
  e.open = buildSprite(EGG_W, EGG_H, g => drawEggShapes(g, stage), P.outline);
  e.ver = EGG_VER;
}

/* ---------- Live-Overlays (animiert) ---------- */
function limbSeg(ctx, x1, y1, x2, y2, w, colDk, col) {
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; pe(ctx, x, y, w / 2 + 0.6, w / 2 + 0.6, colDk); }       // dunkle Kontur
  for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; pe(ctx, x - 0.4, y - 0.3, w / 2 - 0.3, w / 2 - 0.3, col); } // heller Kern
}
function drawFoot(ctx, fcx, soleY, sign) {
  const o = LIMB.handDk, f = LIMB.hand, hl = LIMB.armLt;
  const cx2 = fcx + sign * 2, cy = soleY - 3;                      // großer runder Cartoon-Schuh, Sohle auf soleY
  pe(ctx, cx2, cy, 8.5, 4.2, o);
  pe(ctx, cx2, cy - 0.6, 7.4, 3.4, f);
  pe(ctx, cx2 + sign * 5, cy + 0.5, 4.5, 3.4, o);                  // runde Schuhspitze nach außen
  pe(ctx, cx2 + sign * 5, cy, 3.6, 2.6, f);
  rect(ctx, cx2 - 6, soleY, 15, 1, o);                            // Sohle
  rect(ctx, cx2 - 4, cy - 2.5, 3, 1, hl);                         // Glanz
}
function drawHand(ctx, hx, hy, sign, grab) {
  const o = LIMB.handDk, f = LIMB.hand, hl = LIMB.armLt;
  const x = Math.round(hx), y = Math.round(hy);
  // Pixel-Faust: oktagonaler Umriss aus Rects
  rect(ctx, x - 2, y - 5, 6, 1, o);                               // oben Kante
  rect(ctx, x - 4, y - 4, 9, 6, o);                               // Mitte breit
  rect(ctx, x - 2, y + 2, 6, 1, o);                               // unten Kante
  // Füllung
  rect(ctx, x - 3, y - 4, 7, 6, f);
  rect(ctx, x - 1, y - 5, 4, 1, f);
  rect(ctx, x - 1, y + 2, 4, 1, f);
  // Fingerknöchel: 3 dunkle Pixel-Punkte oben
  if (grab < 2) {
    rect(ctx, x - 2, y - 3, 1, 1, o);
    rect(ctx, x,     y - 3, 1, 1, o);
    rect(ctx, x + 2, y - 3, 1, 1, o);
  }
  // Daumen: kleines Pixel-Rect auf der Innenseite
  const tx = x - sign * 4;
  rect(ctx, tx - 1, y - 1, 4, 3, o);
  rect(ctx, tx,     y - 1, 2, 2, f);
  // Glanz
  rect(ctx, x - 1, y - 4, 3, 1, hl);
}
function drawFeet(ctx, cx, eb, floorY, t, P, face, idleAct) {
  const walking = Math.abs(face) > 0.15, dir = Math.sign(face) || 1;
  const spread = Math.round(P.rb * 0.22);
  // Profil: das gerade hintere Bein zuerst zeichnen (wird vom vorderen überdeckt)
  for (const sign of [-1, 1]) {
    let footX, soleY, hx;
    if (walking) {
      hx = cx + sign * spread;                                // beide Beine nebeneinander (frontal)
      footX = hx + sign * 2;                                   // Füße frontal wie im Stand
      soleY = Math.min(floorY, eb + 12);                       // hängen am Körper, landen am Boden
    } else {
      hx = cx + sign * spread;
      footX = hx + sign * 2;               // Fuß fast senkrecht unter dem Loch
      if (idleAct === "tap" && sign > 0) soleY = floorY - Math.max(0, Math.sin(t / 80)) * 2.5;
      else { const bob = Math.sin(t / 240); soleY = floorY - (sign < 0 ? (bob > 0 ? 1 : 0) : (bob < 0 ? 1 : 0)); }
    }
    brokenHole(ctx, hx, eb - 3, 4, P, sign < 0 ? 31 : 32, false);
    limbSeg(ctx, hx, eb - 2, footX, soleY - 5, 4, LIMB.armDk, LIMB.arm);
    drawFoot(ctx, footX, soleY, sign);
  }
}
function drawArms(ctx, cx, armY, t, P, skip, face) {
  const grab = Math.round(Math.sin(t / 300) * 2 + 2), shoulder = Math.round(P.rb * 0.97), swing = Math.abs(face || 0) > 0.15;
  for (const sign of [-1, 1]) {
    if (sign === skip) continue;
    const sx = cx + sign * shoulder, sy = armY;
    brokenHole(ctx, sx, sy, 4, P, sign < 0 ? 21 : 22, false);
    if (swing) {
      const sw = Math.sin(t / 185 + (sign > 0 ? Math.PI : 0));      // gegenphasig zu den Beinen
      const hx = sx + sign * 4 + Math.round(face * sw * 6);          // schwingt vor/zurück in Gehrichtung
      const hy = sy + 11 - Math.abs(sw);                             // bleibt klar unter Augenhöhe
      limbSeg(ctx, sx, sy, hx, hy - 2, 4, LIMB.armDk, LIMB.arm);
      drawHand(ctx, hx, hy, sign, 2);
    } else {
      const hx = sx + sign * 11, hy = sy + 3 + grab;
      limbSeg(ctx, sx, sy, hx, hy - 2, 4, LIMB.armDk, LIMB.arm);
      drawHand(ctx, hx, hy, sign, grab);
    }
  }
}
function drawShells(ctx, cx, floorY, n) {
  const spots = [[-36, 3], [-24, 7], [-10, 4], [12, 6], [26, 3], [37, 7], [-30, 9], [18, 9]];
  for (let i = 0; i < n && i < spots.length; i++) {
    const x = cx + spots[i][0], y = floorY + spots[i][1];
    pe(ctx, x, y, 4, 2.2, "#2a2014"); pe(ctx, x, y - 0.5, 3.2, 1.6, "#e3d3a0"); pe(ctx, x + 1, y + 0.3, 2, 1, "#bfa970"); rect(ctx, x - 2, y - 1, 1, 1, "#f2e8c4");
  }
}

/* ---------- Biolumineszenz-Flecken (Stufe 5) ---------- */
function drawBioSpots(ctx, cx, eb, t, P, prog) {
  const eCy = eb - P.rb;   // Ei-Mittelpunkt
  const SPOTS = [
    { dx: -10, dy: -14, ph: 0.0, r: 6.0 },
    { dx:  12, dy:  -4, ph: 2.1, r: 4.5 },
    { dx:  -7, dy:   8, ph: 1.2, r: 5.0 },
    { dx:   6, dy: -26, ph: 3.5, r: 3.5 },
    { dx: -13, dy:  -2, ph: 2.8, r: 3.0 },
    { dx:   9, dy:  10, ph: 0.8, r: 4.0 },
    { dx:  -3, dy: -33, ph: 1.9, r: 3.0 },
    { dx:  13, dy: -16, ph: 3.1, r: 3.5 },
    { dx:  -1, dy:  -8, ph: 0.4, r: 2.5 },
    { dx:   3, dy:  14, ph: 2.4, r: 3.2 },
  ];
  const n = Math.max(2, Math.min(SPOTS.length, 2 + Math.round((prog || 0) * 8)));   // je näher an Stufe 6, desto mehr
  for (let i = 0; i < n; i++) {
    const sp = SPOTS[i];
    const grow = 0.7 + 0.3 * Math.sin(t / 1600 + sp.ph);
    const r = sp.r * grow, sx = cx + sp.dx, sy = eCy + sp.dy;
    ctx.globalAlpha = 0.35; pe(ctx, sx, sy, r + 2, r + 1.4, "#3a2a68");
    ctx.globalAlpha = 0.75; pe(ctx, sx, sy, r + 0.6, r * 0.95, "#2a1f52");
    ctx.globalAlpha = 1;
    pe(ctx, sx + r * 0.45, sy + r * 0.3, r * 0.6, r * 0.5, "#241a48");
    pe(ctx, sx - r * 0.2, sy - r * 0.2, r * 0.62, r * 0.55, "#181040");
    if (Math.sin(t / 900 + sp.ph * 2) > 0.2) rect(ctx, Math.round(sx), Math.round(sy) - 1, 1, 1, "#cfe0ff");
    if (r > 4 && Math.sin(t / 700 + sp.ph) > 0.55) rect(ctx, Math.round(sx) - 2, Math.round(sy) + 1, 1, 1, "#8aa0e8");
  }
}
function drawShellCracks(ctx, cx, topY, ht, stage) {
  if (stage < 2 || stage >= 4) return;                               // Stage 2-3: feine Risse; 4+ hat eigene Cracks
  ctx.save(); ctx.globalAlpha = stage === 2 ? 0.22 : 0.34;
  ctx.fillStyle = "#1a140a";
  const mid = topY + ht * 0.5;
  const paths = stage === 2 ? [
    [[cx - 3, mid - 7], [cx - 1, mid - 1], [cx - 4, mid + 4]],
    [[cx + 6, mid - 2], [cx + 8, mid + 5]],
  ] : [
    [[cx - 4, mid - 10], [cx - 2, mid - 2], [cx - 6, mid + 5]],
    [[cx + 6, mid - 6], [cx + 9, mid + 1], [cx + 5, mid + 7]],
    [[cx - 1, mid + 7], [cx + 3, mid + 13]],
  ];
  for (const path of paths) for (let i = 0; i < path.length - 1; i++) {
    const [x1, y1] = path[i], [x2, y2] = path[i + 1];
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let j = 0; j <= n; j++) ctx.fillRect(Math.round(x1 + (x2-x1)*j/n), Math.round(y1 + (y2-y1)*j/n), 1, 1);
  }
  ctx.globalAlpha = 1; ctx.restore();
}
/* ---------- Dreck auf dem Boden ---------- */
function drawMess(ctx, mess) {
  for (const m of mess) {
    const x = m.x, y = FLOOR + 3, d = m.seed % 5;
    if (m.type === "poop") {
      const col = "#5a2200", dk = "#2a0e00", hl = "#8a3e10";
      // Klassischer Kothaufen: 4 gestapelte Humps, breite Basis, Spitze oben
      pe(ctx, x, y + 1, 7, 3.0, dk);   pe(ctx, x, y,     6, 2.5, col);   // Basis (breit + flach)
      pe(ctx, x, y - 3, 5, 3.5, dk);   pe(ctx, x, y - 4, 4, 2.8, col);   // 2. Hump
      pe(ctx, x, y - 7, 3.5, 3.2, dk); pe(ctx, x, y - 8, 2.8, 2.5, col); // 3. Hump
      pe(ctx, x, y-11, 2, 2.5, dk);    pe(ctx, x, y-12, 1.4, 1.8, col);  // Spitze
      rect(ctx, Math.round(x)-1, Math.round(y)-7, 2, 1, hl);              // Glanz
      // Dampf
      rect(ctx, Math.round(x)-1+d, Math.round(y)-14, 1, 3, "rgba(180,150,130,0.35)");
      rect(ctx, Math.round(x)+2,   Math.round(y)-13, 1, 2, "rgba(180,150,130,0.22)");
    } else if (m.type === "slime") {
      pe(ctx, x, y + 1, 7, 3.5, "#1a5008"); pe(ctx, x - 2, y - 1, 4, 3, "#258010");
      pe(ctx, x + 3, y - 1, 3, 2.5, "#30a018"); rect(ctx, x, y - 3, 2, 2, "#50c828");
      rect(ctx, x - 1, y - 2, 1, 1, "rgba(120,255,60,0.5)"); // Glanzpunkt
    } else { // shell
      rect(ctx, x - 4, y, 9, 2, "#c8bfa0"); rect(ctx, x - 2, y - 2, 7, 2, "#ddd3b0");
      rect(ctx, x + 2, y - 3, 3, 1, "#b8ae90"); rect(ctx, x - 1, y - 1, 2, 1, "#ece4c4");
    }
  }
}
function drawCosmic(ctx, cx, baseY, t, lit) {
  const topY = baseY - (EGG_PAL[5].ht + EGG_PAL[5].rb), cy = topY + 28;
  for (let i = 0; i < 14; i++) { const sx = cx + (((i * 53) % 97) / 97 * 2 - 1) * 14, sy = cy - 18 + ((i * 37) % 40), tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 200 + i)); ctx.fillStyle = `rgba(220,240,255,${tw})`; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
  if (lit) {
    const r = 46 + Math.sin(t / 400) * 6;
    const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    gl.addColorStop(0, "rgba(120,200,255,0.22)"); gl.addColorStop(0.5, "rgba(150,110,255,0.12)"); gl.addColorStop(1, "rgba(150,110,255,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 5; i++) { const ang = t / 300 + i * 1.3, px = cx + Math.cos(ang) * 22, py = cy + Math.sin(ang * 1.3) * 16; ctx.fillStyle = "rgba(230,245,255,0.9)"; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); }
  }
}
function stageGlow(ctx, cx, cy, stage, t) {
  if (stage === 5) return;
  const p = 0.5 + 0.5 * Math.sin(t / 500);
  let col, r;
  if (stage === 0) { col = "255,120,60"; r = 48; }        // Stufe 1: Wärme (rot)
  else if (stage === 4) { col = "255,150,60"; r = 56; }   // rissig: Energie warm
  else { col = "200,220,255"; r = 44; }                   // Labor: kaltweiß, dezent
  const gl = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
  gl.addColorStop(0, `rgba(${col},${0.08 + 0.05 * p})`); gl.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gl; ctx.fillRect(0, 0, CW, CH);
}

/* ---------- Orchestrierung ---------- */
/* ---------- Labor-Halterung (ersetzt das Nest, Stufen 1-2) ---------- */
function drawStandBack(ctx, cx, floorY, eb) {
  drawDragonShadow(ctx, [{ x: cx, r: 12 }], cx, 16, floorY);
  pe(ctx, cx, floorY - 1, 18, 4, "#2a2646"); pe(ctx, cx, floorY - 2, 15, 3, "#4a4668");      // Standfuß
  rect(ctx, cx - 3, eb + 2, 6, floorY - (eb + 2), "#3a3658"); rect(ctx, cx - 3, eb + 2, 2, floorY - (eb + 2), "#56527a"); // Säule
  pe(ctx, cx, eb - 1, 19, 8, "#4a4668");                                                      // Halteschale hinten
}
function drawStandFront(ctx, cx, eb) {
  pe(ctx, cx, eb, 19, 7, "#5a5678");                                                          // Schale vorn umschließt Ei-Unterseite
  pe(ctx, cx, eb + 2, 19, 5, "#3a3658");
  pe(ctx, cx, eb - 3, 18, 1, "#7a7698");                                                      // Schalenrand-Glanz
  rect(ctx, cx - 19, eb - 6, 2, 9, "#6a6688"); rect(ctx, cx + 17, eb - 6, 2, 9, "#6a6688");   // seitliche Klammern
}
/* ---------- Fliege: fliegt rein, wuselt, setzt sich an die Wand, verschwindet ---------- */
let fly = { st: "idle", x: -20, y: 36, wx: 90, wy: 36, wpUntil: 0, until: 4500, landUntil: 0, tx: 0, ty: 0 };
let laser = { st: "none", until: 0 };
function newWP(t) { fly.wx = 22 + Math.random() * (CW - 44); fly.wy = 16 + Math.random() * (FLOOR - 56); fly.wpUntil = t + 700 + Math.random() * 1500; }
function updateLaser(t) {
  if (t <= laser.until) return;
  if (laser.st === "draw") { laser.st = "aim"; laser.until = t + 520; }
  else if (laser.st === "aim") { laser.st = "fire"; laser.until = t + 320; }
  else if (laser.st === "fire") { laser.st = "holster"; laser.until = t + 520; fly.st = "idle"; fly.until = t + 38000 + Math.random() * 27000; }
  else { laser.st = "none"; }
}
function updateFly(t, stage) {
  if (laser.st !== "none") { updateLaser(t); return; }
  if (!flyEnabled) { fly.st = "idle"; fly.spawn = false; return; }
  if (fly.spawn) { fly.spawn = false; fly.st = "buzz"; fly.x = Math.random() < 0.5 ? -8 : CW + 8; fly.y = 16 + Math.random() * 46; fly.until = t + 8000 + Math.random() * 7000; newWP(t); }
  const f = fly;
  if (f.st === "idle") { if (t > f.until) { f.st = "buzz"; f.x = Math.random() < 0.5 ? -8 : CW + 8; f.y = 16 + Math.random() * 46; f.until = t + 8000 + Math.random() * 7000; newWP(t); } return; }
  if (f.st === "leave") { f.x += (f.tx-f.x)*(1-Math.pow(.95,eggFrameScale)); f.y += (f.ty-f.y)*(1-Math.pow(.95,eggFrameScale)); if (f.x < -12 || f.x > CW + 12) { f.st = "idle"; f.until = t + 9000 + Math.random() * 16000; } return; }
  if (f.st === "land") { if (t > f.landUntil) { f.st = "buzz"; newWP(t); } return; }
  f.x += (f.wx-f.x)*(1-Math.pow(.94,eggFrameScale))+(Math.random()-.5)*1.8*Math.sqrt(eggFrameScale);       // wuseln
  f.y += (f.wy-f.y)*(1-Math.pow(.94,eggFrameScale))+(Math.random()-.5)*1.8*Math.sqrt(eggFrameScale);
  if (Math.hypot(f.wx - f.x, f.wy - f.y) < 6 || t > f.wpUntil) {
    if (Math.random() < 0.15 && f.y < FLOOR - 50) { f.st = "land"; f.landUntil = t + 1400 + Math.random() * 2600; } else newWP(t);
  }
  if (stage === 5 && idle.act!=="play" && !idle.invited && t > f.until - 5000 && Math.random() < 1-Math.pow(1-.012,eggFrameScale)) { laser.st = "draw"; laser.until = t + 600; return; } // Laser ziehen
  if (t > f.until) { f.st = "leave"; f.tx = Math.random() < 0.5 ? -14 : CW + 14; f.ty = 16 + Math.random() * 44; }
}
function drawFly(ctx, t) {
  if (fly.st === "idle") return;
  const x = Math.round(fly.x), y = Math.round(fly.y), landed = fly.st === "land";
  if (!landed) { const w = (Math.floor(t / 45) % 2) ? 1 : 0; rect(ctx, x - 3 + w, y - 2, 2, 1, "rgba(80,90,110,0.7)"); rect(ctx, x + 2 - w, y - 2, 2, 1, "rgba(80,90,110,0.7)"); }
  else { rect(ctx, x - 2, y - 2, 2, 1, "rgba(80,90,110,0.5)"); rect(ctx, x + 1, y - 2, 2, 1, "rgba(80,90,110,0.5)"); }
  rect(ctx, x - 1, y - 1, 3, 2, "#15131a"); rect(ctx, x, y - 1, 1, 1, "#3a3640");   // Körper
}
function drawShoo(ctx, sx, sy, fx, fy, sign) {                    // mit der Hand wegscheuchen
  const a = Math.atan2(fy - sy, fx - sx), r = 16, hx = sx + Math.cos(a) * r, hy = sy + Math.sin(a) * r;
  limbSeg(ctx, sx, sy, hx, hy, 4, LIMB.armDk, LIMB.arm);
  drawHand(ctx, hx, hy, sign, 0);
}
function drawGun(ctx, sx, sy, fx, fy, phase, sign, t) {           // Laserpistole (letzte Stufe)
  if (phase === "draw") { pe(ctx, sx, sy, 3, 3, LIMB.handDk); return; }   // Arm noch eingezogen
  const a = Math.atan2(fy - sy, fx - sx), r = phase === "holster" ? 8 : 15;
  const hx = sx + Math.cos(a) * r, hy = sy + Math.sin(a) * r;
  limbSeg(ctx, sx, sy, hx, hy, 4, LIMB.armDk, LIMB.arm);
  pe(ctx, hx, hy, 3, 3, LIMB.handDk);
  const gx = hx + Math.cos(a) * 3, gy = hy + Math.sin(a) * 3;
  rect(ctx, Math.round(hx) - 1, Math.round(hy) - 1, 4, 3, "#2a2e3a"); rect(ctx, Math.round(gx), Math.round(gy) - 1, 4, 2, "#4a4e5e"); // Lauf
  rect(ctx, Math.round(hx) - 1, Math.round(hy) + 1, 2, 2, "#2a2e3a"); // Griff
  if (phase === "fire") {
    const mx = gx + Math.cos(a) * 4, my = gy + Math.sin(a) * 4;
    ctx.strokeStyle = "#ff3030"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = "#ffd6d6"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(fx, fy); ctx.stroke();
    pe(ctx, mx, my, 2, 2, "#fff"); pe(ctx, fx, fy, 3, 3, "rgba(255,90,90,0.85)");
  }
}
/* ---------- Rollen/Hüpfen (Stufen 1-2): Ei hüpft vom Ständer, rollt, hüpft zurück ---------- */
let roll = { phase: "idle", startT: 0, nextT: 10000 };
function updateRoll(t, canRoll) {
  if (!canRoll) { roll.phase = "idle"; return; }
  if (roll.phase !== "idle") {
    const dur = roll.phase === "hop" ? 700 : 2200;
    if (t - roll.startT > dur) { roll.phase = "idle"; roll.nextT = t + 18000 + Math.random() * 22000; }
    return;
  }
  if (t > roll.nextT && Math.random() < 1-Math.pow(1-.0005,eggFrameScale)) {
    roll.phase = Math.random() < 0.38 ? "hop" : "wobble";
    roll.startT = t;
  }
}

/* ---------- Herumlaufen (ab Beinen): Ziel suchen, hinwatscheln, mal stehen bleiben ---------- */
let walk = { x: 92, tx: 92, until: 0, face: 0 };
let expAnim = { st: "in" };   // in | leaving | away | returning
let prestigeAnim = { st: "none", startT: 0 };
var prestigeVisual=null;   // none | walk | suck | flash | wait
function updateWalk(t, canWalk) {
  let target = 0;
  if (canWalk) {
    if (Math.abs(walk.x - walk.tx) < 1.5) {
      if (t > walk.until) {
        if (Math.random() < 0.45) walk.until = t + 1500 + Math.random() * 3500;          // kurz stehen (nach vorne schauen)
        else {
          const c=dragon.companion,favorite=c?.world.favorite,event=c?.events[0]?.type;
          const place=event||favorite, destinations={plant:136,rug:90,poster:46,nightlight:126,toy:112};
          walk.tx=destinations[place] && Math.random()<.45?destinations[place]:44+Math.random()*(CW-88);
          walk.until=t+(companionCharacter()==="gemütlich"?11000:7000);
        }          // neues Ziel
      }
    } else {
      const hp = (t % 520) / 520;                                     // Hop-Zyklus: 72% Flug, 28% Boden
      if (hp < 0.72) walk.x += Math.sign(walk.tx - walk.x) * 0.66 * eggFrameScale;    // bewegt sich nur im Flug
      target = Math.sign(walk.tx - walk.x);
    }
  }
  walk.face += (target-walk.face)*(1-Math.pow(.84,eggFrameScale));                                                  // sanft zur Seite drehen / zurück nach vorne
}
/* ---------- Leerlauf-Gesten: nervöses Fußwippen / auf imaginäre Uhr schauen ---------- */
let idle = { act: "none", until: 0, next: 4000, toy: null, startT: 0, invited:false };
function updateIdle(t, canIdle, hasArms, toys) {
  if (!canIdle && !((idle.act==="play" || idle.invited) && t<idle.until)) { idle.act = "none"; idle.invited=false; return; }
  if (idle.act === "none") {
    if (t > idle.next) {
      const opts = ["tap", "tap", "wobble"];
      const character=dragon.companion?companionCharacter():"";
      if(character==="verspielt" && toys?.length)opts.push("play","play");
      if(character==="gemütlich")opts.push("wobble");
      if (hasArms) opts.push("watch");
      if (toys && toys.length) { opts.push("play"); opts.push("play"); }
      idle.act = opts[Math.floor(Math.random() * opts.length)];
      if (idle.act === "play") idle.toy = toys[Math.floor(Math.random() * toys.length)];
      idle.startT = t;
      idle.until = t + (idle.act === "watch" ? 2800 : idle.act === "play" ? (idle.toy === "top" ? 9500 : idle.toy === "balloon" ? 5400 : 3600 + Math.random() * 2000) : idle.act === "wobble" ? 4200 : 1600 + Math.random() * 1600);
    }
  } else if (t > idle.until) { idle.act = "none"; idle.invited=false; idle.next = t + 3000 + Math.random() * 7000; }
}
function drawWatchArm(ctx, sx, sy, sign, P, t) {
  const wx = sx - sign * 12, wy = sy - 3;                          // Handgelenk vor die Brust, leicht angehoben
  limbSeg(ctx, sx, sy, wx, wy, 4, LIMB.armDk, LIMB.arm);
  rect(ctx, wx + sign - 2, wy - 2, 4, 4, "#2a2e3a");              // Uhr-Gehäuse
  rect(ctx, wx + sign - 1, wy - 1, 2, 2, "#cfe6ff");             // Zifferblatt
  rect(ctx, Math.round(wx + sign), Math.round(wy - 1 + Math.sin(t / 500)), 1, 1, "#2a2e3a"); // Zeiger
  drawHand(ctx, wx, wy, -sign, 2);
}
/* ---------- Dribbel-Ball ---------- */
let ball = { active: false, startT: 0, bx: 0, armX: 0, armY: 0, floorY: 0, maxB: 5, done: false };
let playToyIdx = 0;
let flyEnabled = true;
const BALL_CYCLE = 580;   // ms pro Auf-/Ab-Bewegung
function ballY(t) {
  if (!ball.active) return ball.armY;
  const floor=ball.floorY-4.5,top=Math.min(ball.armY,floor-5);
  const phase=Math.max(0,(t-ball.startT)%BALL_CYCLE)/BALL_CYCLE;
  // Accelerate towards the floor, then slow while returning to the hand.
  const q=phase<.5?phase*2:(phase-.5)*2;
  return phase<.5?top+(floor-top)*q*q:floor-(floor-top)*(1-(1-q)*(1-q));
}
function updateBall(t, armX, armY, floorY) {
  const should = idle.act === "play" && idle.toy === "ball";
  if (!should || t - idle.startT < 780 || idle.until - t < 560) { ball.active = false; if (!should) ball.done = false; return; }
  if (!ball.active) {
    ball.active = true; ball.startT = t; ball.done = false;
    ball.bx = armX; ball.armX = armX; ball.armY = armY + 5; ball.floorY = floorY;   // dribbelt direkt unter der Hand
  }
  ball.bx=armX;ball.armX=armX;ball.armY=armY+5;ball.floorY=floorY;
  const totalBounces = Math.floor((t - ball.startT) / BALL_CYCLE);
  if (totalBounces >= ball.maxB && !ball.done) {
    ball.done = true; ball.active = false;
    idle.until = Math.min(idle.until, t + 560);                    // löst das Zurückstecken aus
  }
}
function drawBall(ctx, t) {
  if (!ball.active) return;
  const by = ballY(t), floorY = ball.floorY;
  const sh = clampI(1-(floorY-4.5-by)/Math.max(1,floorY-4.5-ball.armY),0,1);
  ctx.globalAlpha = sh * 0.6; pe(ctx, ball.bx, floorY - 2, Math.max(1, 4 - sh * 2), 1, "#000"); ctx.globalAlpha = 1;
  pe(ctx, ball.bx, by, 4.5, 4.5, "#b89018");
  pe(ctx, ball.bx, by, 3.5, 3.5, "#e8c030");
  rect(ctx, Math.round(ball.bx) - 1, Math.round(by) - 2, 2, 1, "#fffcc0");
}
/* Spiel ohne Arme: am Fuß geführt, auf dem Boden statt frei schwebend. */
function groundToyPose(cx,floorY,t,toy) {
  const elapsed=Math.max(0,t-idle.startT),phase=(elapsed%1400)/1400;
  const radius=toy==='top'?4:4.5;
  const roll=toy==='ball'||toy==='yoyo'?12*Math.sin(phase*Math.PI)**2:0;
  const bounce=toy==='ball'&&phase<.32?5*4*(phase/.32)*(1-phase/.32):0;
  return {x:cx-16-roll,y:floorY-radius-bounce,radius,phase};
}
function drawGroundToy(ctx,cx,floorY,t,toy) {
  const p=groundToyPose(cx,floorY,t,toy);
  if(toy==='ball'||toy==='yoyo') {
    const lift=floorY-p.radius-p.y;
    ctx.globalAlpha=.28*(1-lift/9);pe(ctx,p.x,floorY,4,1,'#302737');ctx.globalAlpha=1;
    pe(ctx,p.x,p.y,p.radius,p.radius,toy==='ball'?'#b89018':'#801060');
    pe(ctx,p.x,p.y,p.radius-1,p.radius-1,toy==='ball'?'#e8c030':'#c02090');
    const angle=(cx-p.x)/p.radius;
    rect(ctx,p.x+Math.cos(angle)*2,p.y+Math.sin(angle)*2,1,1,toy==='ball'?'#fffcc0':'#ffd8f4');
    if(p.phase<.13){rect(ctx,cx-14,floorY-3,4,2,LIMB.hand);}
  } else if(toy==='top') {
    const x=p.x+Math.sin((t-idle.startT)/90)*1.5;
    pe(ctx,x,floorY-4,4,3,'#7952a6');rect(ctx,x-1,floorY-8,2,3,'#c9a5e8');rect(ctx,x,floorY-1,1,1,'#49305e');
    rect(ctx,x+Math.sin((t-idle.startT)/70)*2,floorY-4,1,2,'#ead9fb');
  } else if(toy==='balloon') {
    const x=p.x-2+Math.sin((t-idle.startT)/500)*2,y=floorY-24;
    ctx.strokeStyle='#c8b088';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-12,floorY-2);ctx.lineTo(x,y+5);ctx.stroke();
    pe(ctx,x,y,5,7,'#4080e0');rect(ctx,x-2,y-3,2,2,'#9ac0ff');
  } else if(toy==='bubbles') {
    rect(ctx,p.x-2,floorY-8,4,8,'#8ecfef');rect(ctx,p.x-1,floorY-10,2,2,'#c8b060');
    for(let i=0;i<3;i++){
      const age=((t-idle.startT+i*700)%2400+2400)%2400;
      const x=p.x+Math.sin(age/450+i)*3,y=floorY-12-age/85;
      ctx.globalAlpha=.6*(1-age/2600);pe(ctx,x,y,2,2,'#c9e9fb');rect(ctx,x-1,y-1,1,1,'#fff');ctx.globalAlpha=1;
    }
  }
}
const BAL_COLS = [
  { d: "#8a1830", m: "#d84060", h: "#ff9ab0" },   // rot
  { d: "#183a8a", m: "#4080e0", h: "#9ac0ff" },   // blau
  { d: "#186a2a", m: "#40b860", h: "#9af0b0" },   // grün
  { d: "#8a5a10", m: "#e0a030", h: "#ffd890" },   // gelb
  { d: "#5a1880", m: "#a050d8", h: "#d8a8ff" },   // lila
];
let balloonPos = { x: 0, y: 0 };
/* ---------- Kostüme: sitzen auf der Kuppe, rotieren mit der Schale ---------- */
function drawCostume(ctx, cx, topY, t, P, id) {
  if (id === "bunnyears") {
    const wig = Math.sin(t / 420) * 1.5;                            // Ohren wackeln
    for (const sg of [-1, 1]) {
      const ox = cx + sg * 5, tilt = sg * 2 + (sg > 0 ? wig : -wig);
      pe(ctx, ox + tilt * 0.4, topY - 9, 2.6, 8, "#e8e0d4");        // Ohr außen
      pe(ctx, ox + tilt * 0.4, topY - 8, 1.3, 5.5, "#f0a8c0");      // Innenohr rosa
    }
  } else if (id === "strawhat") {
    pe(ctx, cx, topY + 3, 13, 3.2, "#d8b860");                       // Krempe
    pe(ctx, cx, topY + 2.4, 12, 2.4, "#e8cc78");
    pe(ctx, cx, topY - 1, 7, 4.5, "#e8cc78");                        // Kuppel
    pe(ctx, cx - 1, topY - 2, 5.5, 3, "#f4dc94");
    rect(ctx, Math.round(cx) - 7, topY + 1, 14, 2, "#a05828");       // Hutband
  } else if (id === "ghost") {
    // A hood on the shell, with the egg's own eyes; no second floating face.
    const hw=Math.round(P.rb*.97),cy=topY+Math.round(P.ht*.45),ry=Math.round(P.ht*.55),hem=topY+Math.round(P.ht*.82);
    pe(ctx,cx,cy,hw,ry,'#c9cbd0');
    pe(ctx,cx,cy,hw-1,ry-1,'#f2f2f0');
    pe(ctx,cx-2,cy-1,hw*.78,ry*.86,'#fbfbfa');
    for(let k=0;k<6;k++){const x=Math.round(cx-hw+4+k*(hw*2-8)/5);tri(ctx,x-3,hem,x+3,hem,x,hem+4,'#f2f2f0');}
    rect(ctx,cx-hw+4,hem-6,1,6,'#dfe0e3');rect(ctx,cx+hw-5,hem-5,1,5,'#dfe0e3');
  } else if (id === "santahat") {
    const bob = Math.sin(t / 500) * 1;                               // Bommel wippt
    pe(ctx, cx, topY + 3, 10, 3, "#f4f0ea");                          // Pelzrand
    tri(ctx, cx - 9, topY + 2, cx + 9, topY + 2, cx + 3, topY - 11, "#c02030");   // Zipfel
    tri(ctx, cx - 6, topY + 1, cx + 6, topY + 1, cx + 2, topY - 8, "#e03848");
    pe(ctx, cx + 4 + bob, topY - 12, 2.5, 2.5, "#ffffff");            // Bommel
  }
}
/* ---------- Seifenblasen ---------- */
let bubbles = [];
function updateBubbles(t, ox, oy) {
  if (idle.act !== "play" || idle.toy !== "bubbles") { bubbles = []; return; }
  if ((!bubbles.length || t - bubbles[bubbles.length - 1].born > 850) && bubbles.length < 4) {
    bubbles.push({ x: ox, y: oy, r: 1.5, born: t, pop: 0, drift: Math.random() * 6.28 });
  }
  for (const b of bubbles) {
    if (b.pop) continue;
    if (b.r < 4) b.r += 0.06*eggFrameScale;                                     // wächst am Ring
    else { b.y -= 0.28*eggFrameScale; b.x += Math.sin(t / 300 + b.drift) * 0.25*eggFrameScale; }   // steigt & wobbelt
    if (t - b.born > 2600 + (b.drift * 300) || b.y < 14) b.pop = t;
  }
  bubbles = bubbles.filter(b => !b.pop || t - b.pop < 220);
}
function drawBubbles(ctx, t) {
  for (const b of bubbles) {
    if (b.pop) {                                                   // Platz-Sternchen
      const k = (t - b.pop) / 220, rr = b.r + k * 3;
      ctx.globalAlpha = 1 - k;
      for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1.4],[0,1.4],[-1.4,0],[1.4,0]])
        rect(ctx, Math.round(b.x + dx * rr), Math.round(b.y + dy * rr), 1, 1, "#dff4ff");
      ctx.globalAlpha = 1; continue;
    }
    ctx.globalAlpha = 0.30; pe(ctx, b.x, b.y, b.r + 0.8, b.r + 0.8, "#8ecfef");
    ctx.globalAlpha = 0.45; pe(ctx, b.x, b.y, b.r, b.r, "#c9e9fb");
    ctx.globalAlpha = 0.85;
    rect(ctx, Math.round(b.x - b.r * 0.5), Math.round(b.y - b.r * 0.6), 2, 1, "#ffffff");   // Glanz
    rect(ctx, Math.round(b.x + b.r * 0.4), Math.round(b.y + b.r * 0.3), 1, 1, "#ffd0e8");   // Schimmer rosa
    ctx.globalAlpha = 1;
  }
}
let topPos = { x: 0, y: 0 };
function drawPlayArm(ctx, sx, sy, sign, t, toy, P) {
  brokenHole(ctx, sx, sy, 4, P, 22, false);                        // Schulterloch bleibt immer sichtbar
  const elG = Math.max(0, t - idle.startT);
  const putBack = toy !== "balloon" && toy !== "top";               // Ballon fliegt weg, Kreisel wandert raus
  let reach = elG < 360 ? 0 : Math.min(1, (elG - 360) / 360);       // erst einziehen, dann mit Spielzeug rauskommen
  if (putBack && idle.until - t < 520) reach = Math.min(reach, Math.max(0, (idle.until - t) / 520));   // am Ende zurückstecken
  if (reach <= 0.06) return;                                        // Arm komplett im Ei -> nur das Loch
  if (reach < 0.95) {                                               // halb ausgefahren: verkürzter Arm, Hand geschlossen
    const wx0 = Math.round(sx + sign * 12 * reach), wy0 = Math.round(sy + 6 * reach);
    limbSeg(ctx, sx, sy, wx0, wy0, 4, LIMB.armDk, LIMB.arm);
    drawHand(ctx, wx0, wy0, sign, 3);
    return;
  }
  if (toy === "ball") {
    // Arm zeigt locker nach unten-vorne (Dribbelposition) — einziger Arm-Seg für Ball
    const dwx = Math.round(sx + sign * 7), dwy = Math.round(sy + 13);
    limbSeg(ctx, sx, sy, dwx, dwy, 4, LIMB.armDk, LIMB.arm);
    if (ball.active) {
      const by = ballY(t), catching = by < ball.armY + 12;
      drawHand(ctx, dwx, dwy, sign, catching ? 1 : 3);  // offen beim Fangen, leicht geschlossen beim Patchen
    } else {
      // Ball liegt in der Hand (Startposition)
      pe(ctx, dwx, Math.min(FLOOR-5.5,dwy+5), 4.5, 4.5, "#b89018");
      pe(ctx, dwx, Math.min(FLOOR-5.5,dwy+5), 3.5, 3.5, "#e8c030");
      drawHand(ctx, dwx, dwy, sign, 1);
    }
    return;
  }
  if (toy === "yoyo") {
    /* Realistischer Jojo-Zyklus: beschleunigter Fall -> Sleeper (dreht unten) -> Hand-Ruck -> Hochspulen */
    const T = 1400, ph = (t % T) / T;
    const jerk = (ph > 0.58 && ph < 0.72) ? Math.sin((ph - 0.58) / 0.14 * Math.PI) * 3 : 0;   // Hand ruckt hoch
    const wx = Math.round(sx + sign * 9), wy = Math.round(sy + 6 - jerk);
    limbSeg(ctx, sx, sy, wx, wy, 4, LIMB.armDk, LIMB.arm);
    const floorY2 = FLOOR - 1, maxLen = Math.max(8, floorY2 - 5 - (wy + 3));
    let drop;
    if (ph < 0.30)      { const q = ph / 0.30; drop = q * q; }                       // Gravitation: beschleunigt
    else if (ph < 0.60) drop = 1;                                                     // Sleeper: bleibt unten
    else if (ph < 0.88) { const q = (ph - 0.60) / 0.28; drop = (1 - q) * (1 - q); }  // spult schnell hoch, bremst
    else                drop = 0;                                                     // ruht in der Hand
    const jx = wx + sign * 2, jy = wy + 3 + Math.round(maxLen * drop);
    if (drop > 0.02) rect(ctx, jx, wy + 2, 1, jy - wy - 2, "#c8b088");               // gespannter Faden
    pe(ctx, jx, jy, 4.5, 4, "#801060");                                               // Scheibe außen
    pe(ctx, jx, jy, 3.5, 3, "#c02090");
    pe(ctx, jx, jy, 1.5, 1.2, "#f060b8");                                             // Nabe
    const spin = t / (drop >= 1 ? 28 : 75);                                           // Sleeper dreht schneller
    rect(ctx, Math.round(jx + Math.cos(spin) * 2), Math.round(jy + Math.sin(spin) * 1.6), 1, 1, "#ffd8f4");
    drawHand(ctx, wx, wy + 2, sign, 3);                                               // geschlossene Hand am Faden
    return;
  }
  if (toy === "bubbles") {
    // Hand vor den Mund: gebeugter Arm, Ring direkt vorm Gesicht, als würde es pusten
    const wx = Math.round(sx - sign * 9), wy = Math.round(sy - 7);
    limbSeg(ctx, sx, sy, wx, wy, 4, LIMB.armDk, LIMB.arm);
    const rx = wx - sign * 4, ry = wy - 3;
    rect(ctx, Math.round(Math.min(wx, rx)), Math.round(wy - 2), Math.abs(rx - wx) + 1, 1, "#8a6a30");   // Stab
    pe(ctx, rx, ry, 3.6, 3.6, "#c8b060");                                     // Ring
    pe(ctx, rx, ry, 2.4, 2.4, "rgba(185,230,252,0.45)");                      // Seifenfilm
    rect(ctx, Math.round(rx) - 1, Math.round(ry) - 2, 1, 1, "#ffffff");
    updateBubbles(t, rx - sign * 2, ry - 2);
    drawBubbles(ctx, t);
    drawHand(ctx, wx, wy + 1, -sign, 3);
    return;
  }
  const wx = sx + sign * 14, wy = sy + 3;
  limbSeg(ctx, sx, sy, wx, wy, 4, LIMB.armDk, LIMB.arm);
  if (toy === "balloon") {
    // Luftballon: jede Session eine andere Farbe, am Ende loslassen -> fliegt davon
    const C = BAL_COLS[Math.floor(idle.startT / 13) % BAL_COLS.length];
    const el = Math.max(0, t - idle.startT), REL = 3800;
    const released = el > REL;
    let bx, by;
    if (!released) {
      const tug = ((t % 4200) > 3900) ? Math.sin((t % 4200 - 3900) / 300 * Math.PI) * 4 : 0;
      bx = wx + Math.round(Math.sin(t / 800) * 4);
      by = wy - 32 + Math.round(Math.sin(t / 1300) * 2) + Math.round(tug);
      const n = 12;
      for (let i = 1; i < n; i++) {                                             // gespannte Schnur
        const q = i / n, mx = wx + (bx - wx) * q + Math.sin(q * Math.PI) * 1.5, my = wy - 1 + (by + 10 - wy + 1) * q;
        rect(ctx, Math.round(mx), Math.round(my), 1, 1, "#c8c0a8");
      }
    } else {
      const fq = (el - REL) / 1500;                                             // fliegt beschleunigt davon
      bx = wx + Math.round(Math.sin(t / 500) * 3 + sign * fq * 10);
      by = wy - 32 - Math.round(fq * fq * 95);
      for (let i = 0; i < 8; i++) rect(ctx, Math.round(bx + Math.sin(i * 0.9 + t / 200) * 1.5), Math.round(by + 10 + i * 2), 1, 1, "#c8c0a8");   // baumelnde Schnur
      if (fq >= 1) { idle.act = "none"; idle.next = t + 5000; }
    }
    balloonPos = { x: bx, y: by };
    rect(ctx, Math.round(bx) - 1, Math.round(by) + 9, 2, 2, C.d);               // Knoten
    pe(ctx, bx, by, 8, 10, C.d);                                                // GRÖSSER
    pe(ctx, bx - 0.7, by - 1, 6.8, 8.8, C.m);
    rect(ctx, Math.round(bx) - 3, Math.round(by) - 5, 3, 2, C.h);               // Glanz
    rect(ctx, Math.round(bx) - 4, Math.round(by) - 3, 1, 2, C.h);
  } else if (toy === "top") {
    // Brummkreisel: fällt aus der Hand, dreht und WANDERT zickzackend zum Rand hinaus
    const el = Math.max(0, t - idle.startT);
    const tyG = FLOOR - 2, handY = wy + 2;
    let topY = tyG, tilt = 0, spinFast = false, tx0 = wx + sign * 3;
    if (el < 780)        { topY = handY; tilt = 0; }                                 // in der Hand (nach dem Ausfahren)
    else if (el < 1130)  { const q = (el - 780) / 350; topY = handY + (tyG - handY) * q * q; tilt = Math.sin(t / 100) * 0.05; }   // fällt
    else {
      spinFast = true;
      const w = (el - 1130) / 1000;
      tx0 += sign*Math.round(8*(1-Math.exp(-w)))+Math.round(Math.sin(el/320)*3*Math.exp(-w/5));   // driftet beschleunigend + Zickzack
      tilt = Math.sin(t / 130) * 0.12;
      if (tx0 < -14 || tx0 > CW + 14) { idle.act = "none"; idle.next = t + 5000; return; }    // aus dem Bild -> Geste endet
    }
    topPos = { x: tx0, y: topY - 6 };
    ctx.save();
    ctx.translate(tx0, topY); ctx.rotate(tilt); ctx.translate(-tx0, -topY);
    const c1 = spinFast ? (Math.floor(t / 180) % 2 ? "#e04040" : "#f0c030") : "#e04040";
    const c2 = spinFast ? (Math.floor(t / 180) % 2 ? "#f0c030" : "#e04040") : "#f0c030";
    rect(ctx, Math.round(tx0) - 1, Math.round(topY) - 2, 2, 2, "#5a4028");           // Spitze
    rect(ctx, Math.round(tx0) - 4, Math.round(topY) - 5, 8, 3, c1);
    rect(ctx, Math.round(tx0) - 5, Math.round(topY) - 8, 10, 3, c2);
    rect(ctx, Math.round(tx0) - 3, Math.round(topY) - 10, 6, 2, c1);
    rect(ctx, Math.round(tx0) - 1, Math.round(topY) - 13, 2, 3, "#5a4028");
    if (spinFast) { ctx.globalAlpha = 0.5; rect(ctx, Math.round(tx0) - 6, Math.round(topY) - 7, 12, 1, "#ffffff"); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  drawHand(ctx, wx, wy + 1, sign, 1);
}
/* ---------- Prestige-Portal + Badge ---------- */
function drawPrestigePortal(ctx, t) {
  const px = 31, py = FLOOR - 1 - 37;                                  // Portal in voller Ei-Größe
  for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.09 * i; pe(ctx, px, py, 19 + i * 3.5, 34 + i * 3.5, "#e0a820"); }
  ctx.globalAlpha = 1;
  pe(ctx, px, py, 21, 36, "#2a1800"); pe(ctx, px, py, 18, 32, "#0e0800");   // Schlund
  for (let r = 0; r < 7; r++) {
    const a = t / 200 + r * 0.9, rr = 0.45 + 0.55 * Math.abs(Math.sin(a * 0.7));
    pe(ctx, px + Math.cos(a) * 13 * rr, py + Math.sin(a) * 22 * rr, 2, 2, r % 2 ? "#f0c020" : "#ff8820");
  }
  for (let k = 0; k < 9; k++) { const ph = (t / 650 + k * 0.27) % 1; ctx.globalAlpha = 1 - ph; rect(ctx, Math.round(px - 10 + (k * 4) % 20), Math.round(py + 14 - ph * 55), 1, 1, "#fff0a0"); }
  ctx.globalAlpha = 1;
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t / 500));
  ctx.globalAlpha = pulse * 0.45; pe(ctx, px, py, 24, 40, "#f0c020"); ctx.globalAlpha = 1;
}
function drawPrestigeBadge(ctx, cx, topY, count) {
  const n = Math.min(count, 3);
  for (let i = 0; i < n; i++) {
    const sx = Math.round(cx - (n - 1) * 8 + i * 16), sy = topY + 6;
    ctx.globalAlpha = 0.30; pe(ctx, sx, sy, 6, 6, "#f0c020"); ctx.globalAlpha = 1;   // Glow
    rect(ctx, sx - 3, sy + 1, 7, 1, "#7a5800"); rect(ctx, sx + 1, sy - 3, 1, 7, "#7a5800");   // Schattenkante
    rect(ctx, sx - 3, sy, 7, 1, "#ffd83a"); rect(ctx, sx, sy - 3, 1, 7, "#ffd83a");           // großes Kreuz
    rect(ctx, sx - 2, sy - 2, 1, 1, "#f0b020"); rect(ctx, sx + 2, sy - 2, 1, 1, "#f0b020");   // Diagonalen
    rect(ctx, sx - 2, sy + 2, 1, 1, "#f0b020"); rect(ctx, sx + 2, sy + 2, 1, 1, "#f0b020");
    rect(ctx, sx - 1, sy, 3, 1, "#ffe880"); rect(ctx, sx, sy, 1, 1, "#fffff4");               // heller Kern
  }
  if (count >= 4) {                                                    // größere Krone
    rect(ctx, cx - 7, topY + 7, 15, 4, "#f0c020"); rect(ctx, cx - 7, topY + 10, 15, 1, "#a87800");
    rect(ctx, cx - 7, topY + 3, 3, 5, "#f0c020"); rect(ctx, cx - 1, topY + 1, 3, 7, "#f0c020"); rect(ctx, cx + 5, topY + 3, 3, 5, "#f0c020");
    rect(ctx, cx - 6, topY + 3, 1, 1, "#fffff4"); rect(ctx, cx, topY + 1, 1, 1, "#fffff4"); rect(ctx, cx + 6, topY + 3, 1, 1, "#fffff4");
    rect(ctx, cx - 3, topY + 8, 2, 2, "#e04040"); rect(ctx, cx + 2, topY + 8, 2, 2, "#3070e0");   // Juwelen
  }
}
/* ---------- Prestige: Ei wird freaky ins Portal gesogen ---------- */
function drawPrestigeSuck(ctx, S, t) {
  const px = 31, py = FLOOR - 1 - 37;
  const el = t - prestigeAnim.startT;
  if (prestigeAnim.st === "suck") {
    const q = Math.min(1, el / 950);
    const ex = walk.x + (px - walk.x) * q;
    const ey = (FLOOR - 45) + (py - (FLOOR - 45)) * q;
    const sc = Math.max(0.02, 1 - q * 0.98);
    const wob = Math.sin(el / 26) * 0.5 * q;                       // Jelly-Verzerrung
    ensureEgg(S.stage);
    const spr = EGG[stg(S.stage)].open;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(q * q * 15 + Math.sin(el / 45) * 0.35);             // wirbelt immer schneller
    ctx.scale(sc * (1 + wob), sc * (1 - wob));
    ctx.globalAlpha = 0.30;                                         // Geister-Doppelbilder (freaky)
    ctx.drawImage(spr, -EGG_CX - 4, -BUF_BASE + 34);
    ctx.drawImage(spr, -EGG_CX + 4, -BUF_BASE + 34);
    ctx.globalAlpha = 1;
    ctx.drawImage(spr, -EGG_CX, -BUF_BASE + 34);
    ctx.restore();
    for (let i = 0; i < 9; i++) {                                   // Energie-Partikel spiralen ins Portal
      const pp = ((el / 700) + i * 0.13) % 1, a = i * 0.8 - el / 85;
      const r = (1 - pp) * 44;
      ctx.globalAlpha = pp;
      rect(ctx, Math.round(px + Math.cos(a) * r * 0.7), Math.round(py + Math.sin(a) * r), 1, 1, i % 2 ? "#ffe060" : "#ff9030");
    }
    ctx.globalAlpha = 1;
    if (q >= 1) { prestigeAnim.st = "flash"; prestigeAnim.startT = t; }
  } else if (prestigeAnim.st === "flash") {
    const q = Math.min(1, el / 450);
    if (q < 0.30) { ctx.fillStyle = `rgba(255,244,200,${0.55 * (1 - q / 0.30)})`; ctx.fillRect(0, 0, CW, CH); }   // greller Blitz
    for (let r = 0; r < 3; r++) {                                   // expandierende Ringe
      const rr = q * (26 + r * 14);
      ctx.globalAlpha = (1 - q) * 0.7;
      pe(ctx, px, py, rr, rr * 1.6, "rgba(0,0,0,0)");
      pe(ctx, px, py, rr + 1.5, rr * 1.6 + 1.5, "#f0c020");
      pe(ctx, px, py, rr, rr * 1.6, "#0e0800");
    }
    ctx.globalAlpha = 1;
    if (el > 450) prestigeAnim.st = "wait";
  }
}
function playTrackPoint(cx, armY, t) {
  if (idle.toy === "ball" && ball.active) return { x: Math.round(ball.bx), y: Math.round(ballY(t)) };
  if (idle.toy === "bubbles" && bubbles.length) { const b = bubbles[bubbles.length - 1]; return { x: Math.round(b.x), y: Math.round(b.y) }; }
  if (idle.toy === "balloon") return { x: Math.round(balloonPos.x), y: Math.round(balloonPos.y) };
  if (idle.toy === "top") return { x: Math.round(topPos.x), y: Math.round(topPos.y) };
  return { x: cx+(cx<CW/2?22:-22), y: armY-4 };
}
/* ---------- Durchleuchten (Schieren): Blick ins glühende Ei ---------- */
function drawCandling(ctx, S, t, cx, eb, P, k) {
  const eCy = eb - Math.round((P.ht + P.rb) / 2);
  ctx.fillStyle = `rgba(4,4,12,${0.74 * k})`;                        // Raum dunkelt ab
  ctx.fillRect(0, 0, CW, CH);
  const g = ctx.createRadialGradient(cx, eCy, 4, cx, eCy, 62);       // warmes Durchlicht
  g.addColorStop(0, `rgba(255,186,84,${0.55 * k})`);
  g.addColorStop(1, "rgba(255,186,84,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = 0.38 * k;                                        // Schale glüht durchscheinend
  pe(ctx, cx, eCy, P.rb * 0.96, (P.ht + P.rb) / 2 * 0.96, "#ffc060");
  ctx.globalAlpha = 1;
  const prog = Math.max(0, Math.min(1, (S.xp || 0) / 700));         // Silhouette wächst mit (verstecktem) Fortschritt
  const beat = 1 + Math.sin(t / 300) * 0.06;                          // Herzschlag
  const col = `rgba(74,40,16,${0.85 * k})`;
  ctx.fillStyle = col;
  if (prog < 0.25) {
    pe(ctx, cx, eCy + 4, 2.5 * beat, 2.5 * beat, col);               // Keimpunkt + Dottersack
    ctx.globalAlpha = 0.4 * k; pe(ctx, cx + 1, eCy + 6, 5, 4, col); ctx.globalAlpha = 1;
  } else if (prog < 0.55) {
    pe(ctx, cx, eCy + 2, 3.5 * beat, 3.5 * beat, col);               // Kopf + Schwänzchen
    pe(ctx, cx + 3, eCy + 6, 2, 4, col);
  } else {
    pe(ctx, cx, eCy + 1, 5 * beat, 6.5 * beat, col);                 // kleines Wesen, rundlich
    pe(ctx, cx - 2, eCy - 3, 2.2, 2.2, col);
    if (prog > 0.85) { ctx.globalAlpha = k; rect(ctx, Math.round(cx) - 3, Math.round(eCy) - 4, 1, 1, "#ffdf9a"); rect(ctx, Math.round(cx) - 1, Math.round(eCy) - 4, 1, 1, "#ffdf9a"); ctx.globalAlpha = 1; }   // erste Augen glimmen
  }
  if (prog > 0.35) {                                                  // Äderchen
    ctx.globalAlpha = 0.45 * k;
    for (const [a1, ln] of [[0.6, 11], [2.4, 9], [4.2, 12]]) {
      for (let q = 3; q < ln; q++) {
        rect(ctx, Math.round(cx + Math.cos(a1) * q + Math.sin(q * 1.7) * 1.2), Math.round(eCy + 2 + Math.sin(a1) * q * 0.8), 1, 1, "#8a4020");
      }
    }
    ctx.globalAlpha = 1;
  }
}

let lastT = 0;
var turnAnim = { on: false, startT: 0 };
var sprayAnim = { on: false, startT: 0 };
var cleanAnim = { on: false, startT: 0, x: 90, pileType: null };   // Teleskop-Saugarm beim Reinigen
const BROOD_FOOD = [
  { id: "spray", label: "💧 Besprühen",  cost: 0, hunger: 25, xp: 0, power: 0, desc: "" },
  { id: "broth", label: "🥣 Nährlösung", cost: 3, hunger: 60, xp: 2, power: 0, desc: "+2 XP" },
];
var knockAnim = { on: false, startT: 0 };
var candleAnim = { on: false, startT: 0 };
function drawEgg(ctx, S, t) {
  lastT = t;
  const floorY = FLOOR - 1, P = EGG_PAL[stg(S.stage)], lit = S.power > 0;
  if(companionReducedMotion()){
    if(S.expActive){expAnim.st="away";return;}
    if(expAnim.st!=="in"){expAnim.st="in";walk.x=92;walk.tx=92;walk.face=0;}
  }
  if (S.expActive) {                                                   // Expedition: Ei hüpft aus dem Bild
    if (expAnim.st === "in" || expAnim.st === "returning") {
      expAnim.st = "leaving";
      walk.tx = walk.x < CW / 2 ? -36 : CW + 36;
      walk.until = t + 60000; idle.act = "none";
    }
    if (expAnim.st === "leaving" && (walk.x < -26 || walk.x > CW + 26)) expAnim.st = "away";
    if (expAnim.st === "away") {
      if (S.shards > 0) drawShells(ctx, 92, floorY, S.shards);
      return;
    }
  } else if (expAnim.st !== "in") {
    if (expAnim.st === "away" || expAnim.st === "leaving") {
      expAnim.st = "returning";
      walk.tx = 92; walk.until = t + 60000;
    }
    if (expAnim.st === "returning" && Math.abs(walk.x - 92) < 3) { expAnim.st = "in"; walk.until = t + 2500; }
  }
  if (prestigeAnim.st === "walk" && Math.abs(walk.x - 44) < 9) { prestigeAnim.st = "suck"; prestigeAnim.startT = t; }
  if (prestigeAnim.st === "suck" || prestigeAnim.st === "flash") { drawPrestigeSuck(ctx, S, t); return; }
  if (prestigeAnim.st === "wait") return;
  updateRoll(t, S.stage < 2);
  const onStand = S.stage < 2;                                           // Ei bleibt immer auf dem Ständer
  const rollEl = t - roll.startT;
  const rollYOff = onStand && roll.phase === "hop"    ? Math.sin(Math.min(rollEl / 700, 1) * Math.PI) * 7 : 0;
  const rollAngle = onStand && roll.phase === "wobble" ? Math.sin(rollEl / 220) * 0.025 * Math.max(0, 1 - rollEl / 1800) : 0;
  const eb = onStand ? floorY - 12 - Math.round(rollYOff) : floorY - 11;
  updateFly(t, S.stage);
  const flyActive = fly.st !== "idle", watching = flyActive && S.stage >= 1 && idle.act!=="play" && !idle.invited && !isNightTime() && !S.krank;
  const lasering = S.stage === 5 && laser.st !== "none";
  const expMoving = expAnim.st === "leaving" || expAnim.st === "returning" || prestigeAnim.st === "walk";
  const resting=(isNightTime() || S.krank) && !idle.invited;
  updateWalk(t, (!resting && !onStand && P.feet && !watching && !lasering && idle.act !== "wobble" && idle.act !== "play") || expMoving);
  const cx = onStand ? 92 : Math.round(walk.x);
  const ownedToys = S.toys ? Object.keys(S.toys).filter(k => S.toys[k]) : [];
  updateIdle(t, !resting && !onStand && P.feet && Math.abs(walk.face) < 0.1 && !watching && !lasering , P.arms, ownedToys);
  if (lit) stageGlow(ctx, cx, eb - Math.round(P.rb + P.ht * 0.5), S.stage, t);
  if (onStand) drawStandBack(ctx, cx, floorY, floorY - 12);
  else {
    const shp = (t % 520) / 520;
    const shHop = (P.feet && Math.abs(walk.face) > 0.15 && shp < 0.72) ? Math.sin(shp / 0.72 * Math.PI) * 9 : 0;
    ctx.globalAlpha = 1 - Math.min(0.55, shHop / 14);   // Schatten verblasst mit Sprunghöhe
    drawDragonShadow(ctx, [{ x: cx - Math.round(P.rb * 0.30) - 3, r: 6 }, { x: cx + Math.round(P.rb * 0.30) + 3, r: 6 }], cx, 16, floorY);
    ctx.globalAlpha = 1;
  }
  ensureEgg(S.stage);
  const spr = EGG[stg(S.stage)];
  const face = walk.face, walking = !onStand && P.feet && Math.abs(face) > 0.15;
  const hp = (t % 520) / 520, inFlight = walking && hp < 0.72;         // Hüpf-Zyklus
  const hopY = inFlight ? Math.sin(hp / 0.72 * Math.PI) * 9 : 0;        // Parabel-Bogen
  const sqx = walking ? (inFlight ? 0.97 : 1.08) : 1;                   // Squash & Stretch:
  const sqy = walking ? (inFlight ? 1.05 : 0.92) : 1;                   // Flug gestreckt, Landung gestaucht
  const wobbling = idle.act === "wobble";
  let limbK = 1, wobRot = 0;
  if (wobbling) {
    const wp = Math.min(1, Math.max(0, (t - idle.startT) / 4200));
    const inK = Math.min(1, wp / 0.10), outK = Math.min(1, (1 - wp) / 0.10);
    limbK = 1 - Math.min(inK, outK);                              // 1 = Gliedmaßen draußen, 0 = eingezogen
    const env = Math.min(1, Math.min(wp, 1 - wp) / 0.15);
    if (limbK < 0.5) wobRot = Math.sin(t / 115) * 0.13 * env;     // wackelt am Boden hin und her
  }
  let turnHop = 0, turnSq = 1;
  if (turnAnim.on) {
    const tp = (t - turnAnim.startT) / 1100;
    if (tp >= 1) turnAnim.on = false;
    else { turnSq = Math.max(0.08, Math.abs(Math.cos(tp * Math.PI * 2))); turnHop = Math.sin(tp * Math.PI) * 4; }   // 360°-Wende
  }
  let knockRot = 0;
  if (knockAnim.on) {
    const kp = (t - knockAnim.startT) / 900;
    if (kp >= 1) knockAnim.on = false;
    else knockRot = Math.sin((t - knockAnim.startT) / 60) * 0.12 * (1 - kp);   // klopft zurück: kurzes Zittern
  }
  const walkBob = -hopY - turnHop;
  const breath = Math.sin(t / 700) * 0.5 + walkBob, sway = 0;
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shiver = S.krank && !reducedMotion && (t % 3600 < 900) ? Math.sin(t / 45) * 0.018 : 0;
  const rot = wobRot + knockRot + shiver;
  const ebDrop = wobbling ? Math.round((1 - limbK) * 10) : 0;           // Ei sinkt auf den Boden
  const eyeY = eb + ebDrop - (P.rb + P.ht * 0.34) + breath;
  const armY = eb + ebDrop - P.rb + 1 + Math.round(walkBob);
  ctx.save();
  ctx.translate(cx + sway, eb + ebDrop + breath);
  ctx.rotate(rot + rollAngle);
  ctx.scale(sqx * turnSq, sqy);
  if (S.krank) ctx.filter = "saturate(0.25) brightness(1.18)";
  ctx.drawImage(spr.open, -EGG_CX, -BUF_BASE);
  ctx.restore();
  const ebA = eb + ebDrop + Math.round(breath);
  const ovAng = rot + rollAngle, ovAy = eb + ebDrop + breath;
  const ovOn = Math.abs(ovAng) > 0.001;
  if (ovOn) { ctx.save(); ctx.translate(cx, ovAy); ctx.rotate(ovAng); ctx.translate(-cx, -ovAy); }   // Overlays rotieren mit der Schale
  drawShellCracks(ctx, cx, ebA - Math.round(P.ht + P.rb), P.ht, S.stage);
  if (S.stage === 4) drawBioSpots(ctx, cx, ebA, t, P, Math.min(1, Math.max(0, (S.xp - 3200) / 2300)));
  if (S.prestige > 0) drawPrestigeBadge(ctx, cx, ebA - Math.round(P.ht + P.rb) + 5, S.prestige);
  if (S.krank) {                                                     // kränklich-grüner Teint über der Schale
    const eCy2 = ebA - Math.round((P.ht + P.rb) / 2);
    ctx.globalAlpha = 0.20; pe(ctx, cx, eCy2, P.rb * 0.98, (P.ht + P.rb) / 2 * 0.98, "#d4d6be");
    ctx.globalAlpha = 0.16; pe(ctx, cx - P.rb * 0.3, eCy2 - 6, P.rb * 0.45, 8, "#a8b5a0");
    pe(ctx, cx + P.rb * 0.35, eCy2 + 8, P.rb * 0.4, 7, "#a8b5a0");
    ctx.globalAlpha = 1;
  }
  const wornC = costumeWorn(S.costumes);
  if (wornC) drawCostume(ctx, cx, ebA - Math.round(P.ht + P.rb), t, P, wornC);
  if (P.feet && !onStand && limbK <= 0.5) {                                       // eingezogene Gliedmaßen: nur die Löcher, fest in der Schale
    const sp2 = Math.round(P.rb * 0.22), sh2 = Math.round(P.rb * 0.97);
    brokenHole(ctx, cx - sp2, eb + ebDrop - 3, 4, P, 31, false);
    brokenHole(ctx, cx + sp2, eb + ebDrop - 3, 4, P, 32, false);
    if (P.arms) { brokenHole(ctx, cx - sh2, armY, 4, P, 21, false); brokenHole(ctx, cx + sh2, armY, 4, P, 22, false); }
  }
  if (ovOn) ctx.restore();
  if (P.feet && !onStand && limbK > 0.5) drawFeet(ctx, cx, eb + Math.round(walkBob), floorY, t, P, face, idle.act);
  if (P.arms && limbK > 0.5) {
    const flySide = fly.x < cx ? -1 : 1;
    const shooing = watching && (S.stage === 3 || S.stage === 4) && (t % 2600) > 2100;
    const watching2 = idle.act === "watch", playing = idle.act === "play" && idle.toy, pSign = cx<CW/2?1:-1;
    const skip = (lasering || shooing) ? flySide : (watching2 ? 1 : (playing ? pSign : 0));
    drawArms(ctx, cx, armY, t, P, skip, 0);
    const ssx = cx + flySide * Math.round(P.rb * 0.86);
    if (lasering) drawGun(ctx, ssx, armY, fly.x, fly.y, laser.st, flySide, t);
    else if (shooing) drawShoo(ctx, ssx, armY, fly.x, fly.y, flySide);
    else if (watching2) drawWatchArm(ctx, cx + Math.round(P.rb * 0.86), armY, 1, P, t);
    else if (playing) drawPlayArm(ctx, cx + pSign * Math.round(P.rb * 0.86), armY, pSign, t, idle.toy, P);
  }
  if (P.arms && idle.act === "play" && idle.toy === "ball") { const sign=cx<CW/2?1:-1;const hx = cx + sign*(Math.round(P.rb * 0.86)+7); updateBall(t, hx, armY + 13, floorY); drawBall(ctx, t); }
  if (P.feet && !P.arms && idle.act === "play") drawGroundToy(ctx,cx,floorY,t,idle.toy);
  if (P.eyes) {
    const sleeping = isNightTime() && !S.krank && !S.expActive && idle.act!=="play" && !idle.invited;
    const track = sleeping ? null : (watching ? { x: fly.x, y: fly.y } : (idle.act === "watch" ? { x: cx, y: armY - 2 } : (idle.act === "play" ? (!P.arms ? groundToyPose(cx,floorY,t,idle.toy) : playTrackPoint(cx, armY, t)) : null)));
    let eyeDrawX = cx, eyeDrawY = eyeY;
    const bodyRot = rot + rollAngle;
    if (Math.abs(bodyRot) > 0.001) {                      // Augen-Loch rotiert mit der Schale (auch beim Gehen)
      const ecy = eb + ebDrop + breath, dx = eyeDrawX - cx, dy = eyeDrawY - ecy;
      const ca = Math.cos(bodyRot), sa = Math.sin(bodyRot);
      eyeDrawX = cx + ca * dx - sa * dy;
      eyeDrawY = ecy + sa * dx + ca * dy;
    }
    const mood = sleeping ? "sleeping" : eggMood(S);
    drawEyes(ctx, eyeDrawX, eyeDrawY, t, P, S.stage === 5 ? "glow" : "lit", track, 0, S.krank, sleeping, mood);
    if (sleeping) {
      const zb = (t / 900) % 3, za = Math.max(0, 1 - zb / 3);
      ctx.globalAlpha = za * 0.8;
      ctx.fillStyle = "#dfe8ff"; ctx.font = "8px monospace";
      ctx.fillText("z", Math.round(eyeDrawX) + 12 + zb * 3, Math.round(eyeDrawY) - 6 - zb * 6);
      ctx.globalAlpha = 1;
    }
  }
  if (S.stage === 5) drawCosmic(ctx, cx + sway, eb, t, lit);            // Stufe 6 bleibt kosmisch
            // Tentakel ab Stufe 5, bleiben in Stufe 6
  if (onStand) drawStandFront(ctx, cx, floorY - 12);
  if (S.shards > 0) drawShells(ctx, 92, floorY, S.shards);   // abgebrochene Schalenstücke liegen am Boden
  drawFly(ctx, t);
  if (cleanAnim.on) {
    const cp = (t - cleanAnim.startT) / 1500;
    if (cp >= 1) cleanAnim.on = false;
    else {
      const tx = cleanAnim.x;
      const armLenMax = 96;
      let armLen;
      if (cp < 0.22) armLen = armLenMax * (cp / 0.22);
      else if (cp < 0.82) armLen = armLenMax;
      else armLen = armLenMax * (1 - (cp - 0.82) / 0.18);
      const nozzleY = 4 + armLen;
      // Teleskoprohr von der Decke
      rect(ctx, tx - 1, 4, 3, armLen, "#7a8290");
      for (let s = 8; s < armLen - 4; s += 8) rect(ctx, tx - 2, 4 + s, 5, 1, "#3a4048");
      // Düsenkopf
      rect(ctx, tx - 3, nozzleY, 7, 4, "#4a5058");
      rect(ctx, tx - 4, nozzleY + 3, 9, 2, "#20242a");
      // Saugwirbel + Partikel, solange die Düse unten ist
      if (cp > 0.22 && cp < 0.86) {
        const suckP = Math.min(1, (cp - 0.22) / 0.5);
        // Haufen sichtbar schrumpfen lassen, statt ihn schlagartig verschwinden zu lassen
        if (cleanAnim.pileType) {
          const scale = Math.max(0, 1 - suckP * 1.15);
          if (scale > 0.02) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - suckP * 0.9);
            ctx.translate(tx, FLOOR + 3);
            ctx.scale(scale, scale);
            ctx.translate(-tx, -(FLOOR + 3));
            drawMess(ctx, [{ type: cleanAnim.pileType, x: tx, seed: 2 }]);
            ctx.restore();
          }
        }
        ctx.globalAlpha = 0.9;
        const pcol = cleanAnim.pileType === "slime" ? ["#d4f5c8", "#9fd88a"]
                   : cleanAnim.pileType === "shell" ? ["#f5e6c8", "#d8bf8a"]
                   : ["#cfe8ff", "#8fbfe8"];
        for (let i = 0; i < 7; i++) {
          const ang = t / 55 + i * 1.15;
          const rad = 7 - suckP * 6;
          const py = FLOOR - suckP * (FLOOR - nozzleY - 5) + Math.sin(ang) * 1.5;
          const px = tx + Math.cos(ang) * rad;
          rect(ctx, Math.round(px), Math.round(py), 1, 1, i % 2 ? pcol[0] : pcol[1]);
        }
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t / 70);
        rect(ctx, tx - 1, nozzleY + 4, 2, 1, "#bfe6ff");
        ctx.globalAlpha = 1;
      }
    }
  }
  if (sprayAnim.on) {
    const sp = (t - sprayAnim.startT) / 1100;
    if (sp >= 1) sprayAnim.on = false;
    else {
      const topEgg = eb + ebDrop - Math.round(P.ht + P.rb);
      ctx.globalAlpha = Math.min(1, (1 - sp) * 1.4);
      for (let i = 0; i < 14; i++) {
        const dx3 = (i - 6.5) * 3.4 + Math.sin(i * 2.1 + t / 90) * 2;
        const dy3 = -14 + sp * (22 + (i % 3) * 6);
        rect(ctx, Math.round(cx + dx3), Math.round(topEgg + dy3), 2, 2, i % 2 ? "#d8f2ff" : "#7fd4f5");
      }
      // Kurzer Glanz-Impact auf der Schale, wenn die Tropfen auftreffen
      if (sp > 0.35 && sp < 0.8) {
        const shineA = Math.sin((sp - 0.35) / 0.45 * Math.PI);
        ctx.globalAlpha = shineA * 0.55;
        for (let i = 0; i < 5; i++) {
          const sx = cx + (i - 2) * 7;
          rect(ctx, Math.round(sx), Math.round(topEgg + 10 + (i % 2) * 5), 3, 3, "#eafcff");
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  if (candleAnim.on) {
    const cp = (t - candleAnim.startT) / 4200;
    if (cp >= 1) candleAnim.on = false;
    else drawCandling(ctx, S, t, cx, eb + ebDrop, P, Math.min(1, cp * 6) * (cp > 0.85 ? (1 - cp) / 0.15 : 1));
  }
}

/* =======================================================================
   ÖKONOMIE
   ======================================================================= */
const EGG_XP = [0, 200, 700, 1600, 3200, 5500];
const STAGE_REWARDS = [0, 5, 5, 8, 10, 15];
function localDayKey(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
function sameLocalDay(value, key) {
  if (!value) return false;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value === key;
  const d = new Date(value);
  return !isNaN(d.getTime()) && localDayKey(d) === key;
}
const FEEL = ["leblos & geheimnisvoll", "es nimmt dich wahr", "watschelt durchs Nest", "greift nach der Welt", "etwas wächst heraus", "kosmische Entität"];
function clampI(v, a, b) { return Math.max(a, Math.min(b, v)); }
function stg(n) { n = Math.round(Number(n)); return isFinite(n) ? Math.min(5, Math.max(0, n)) : 0; }
function stageForXp(xp) { let s = 0; for (let i = 0; i < 6; i++) if (xp >= EGG_XP[i]) s = i; return s; }
const FOOD_ITEMS = [
  { id:"ei",     label:"🍳 Spiegelei",    cost:0, hunger:25, xp:0,  power:0,  desc:"" },
  { id:"goldei", label:"🥚 Goldei",        cost:3, hunger:50, xp:2,  power:0,  desc:"+2 XP" },
  { id:"matsch", label:"🌟 Sternenmatsch", cost:5, hunger:80, xp:0,  power:25, desc:"+Strom" },
  { id:"torte",  label:"🍰 Ei-Torte",      cost:4, hunger:60, xp:3,  power:0,  desc:"+3 XP" },
];
const TOY_ITEMS = [
  { id:"ball",    label:"🎾 Ball",         cost:8,  xp:5,  cd:12*3600*1000, desc:"+5 XP · 12h" },
  { id:"yoyo",    label:"🪀 Jo-Jo",        cost:12, xp:8,  cd:24*3600*1000, desc:"+8 XP · 24h" },
  { id:"bubbles", label:"🫧 Seifenblasen", cost:16, xp:12, cd:36*3600*1000, desc:"+12 XP · 36h" },
  { id:"balloon", label:"🎈 Luftballon",   cost:20, xp:16, cd:48*3600*1000, desc:"+16 XP · 48h" },
  { id:"top",     label:"🌀 Brummkreisel", cost:25, xp:20, cd:72*3600*1000, desc:"+20 XP · 72h" },
];
const SHOP_ITEMS = [
  { id: "rug",        label: "🧶 Teppich",    cost: 3, desc: "Gestreifter Läufer" },
  { id: "plant",      label: "🌱 Pflanze",    cost: 4, desc: "Topfpflanze rechts" },
  { id: "poster",     label: "🖼 Ei-Poster",  cost: 5, desc: "Poster an der Wand" },
  { id: "mobile",     label: "🌙 Mobile",     cost: 6, desc: "Schwebt an der Decke" },
  { id: "nightlight", label: "💡 Nachtlicht", cost: 7, desc: "Glimmt bei wenig Strom" },
];
let seasonOverride = -1;                                       // Dev: Saison erzwingen (-1 = echtes Datum)
function curMonth() { return seasonOverride >= 0 ? seasonOverride : new Date().getMonth(); }
const SEASON_ITEMS = [
  { id: "easternest", label: "🐣 Osternest",     cost: 6, months: [2, 3],    desc: "Nest mit bunten Eiern" },
  { id: "palm",       label: "🌴 Palme",         cost: 6, months: [5, 6, 7], desc: "Südsee-Feeling" },
  { id: "pumpkin",    label: "🎃 Kürbis",        cost: 6, months: [9],       desc: "Leuchtet schaurig" },
  { id: "xmastree",   label: "🎄 Tannenbaum",    cost: 8, months: [11], xmas: true, desc: "Mit Lichterkette" },
];
const COSTUMES = [                                              // saisonale Kostüme — klare Stern-Währung, XP sinkt nie
  { id: "bunnyears", label: "🐰 Hasenohren",       cost: 20, months: [2, 3],    desc: "Wackeln beim Hüpfen" },
  { id: "strawhat",  label: "👒 Strohhut",         cost: 22, months: [5, 6, 7], desc: "Für die Sommersonne" },
  { id: "ghost",     label: "👻 Geisterkostüm",    cost: 25, months: [9],       desc: "Buuuh!" },
  { id: "santahat",  label: "🎅 Weihnachtsmütze",  cost: 25, months: [11], xmas: true, desc: "Mit Bommel" },
];
function nextExpItem(p) {
  const u = p.unlocked || {}, pr = p.prestige || 0;
  const chain = [
    ...COSTUMES.filter(inSeason),                                    // 1. Saison-Kostüm zuerst
    ...SEASON_ITEMS.filter(inSeason),                                // 2. Saison-Deko
    ...(pr >= 1 ? WALL_SEASON_ITEMS.filter(inSeason) : []),
    ...[...TOY_ITEMS, ...SHOP_ITEMS].sort((a, b) => a.cost - b.cost),   // 3. Spielzeug & Deko, günstig zuerst
    ...(pr >= 1 ? WALL_ITEMS : []),                                  // 4. Wanddeko (ab 2. Ei)
  ];
  return chain.find(it => !u[it.id]) || null;
}
function costumeWorn(costumes) {
  const chosen=dragon?.companion?.world?.equippedCostume;
  return chosen && costumes && costumes[chosen] ? chosen : null;
}
const WALL_SEASON_ITEMS = [                                     // saisonale Wanddeko, ab Prestige 1
  { id: "eggarland", label: "🥚 Eier-Girlande", cost: 8,  months: [2, 3],    desc: "Bunte Eier an der Schnur" },
  { id: "bunting",   label: "🎏 Wimpelkette",   cost: 8,  months: [5, 6, 7], desc: "Sommerliche Wimpel" },
  { id: "web",       label: "🕸 Spinnennetz",   cost: 8,  months: [9],      desc: "Mit pendelnder Spinne" },
  { id: "wreath",    label: "🎀 Adventskranz",  cost: 10, months: [11], xmas: true, desc: "Mit roter Schleife" },
];
function xmasTime() {
  if (seasonOverride === 11) return true;
  if (seasonOverride >= 0) return false;
  const d = new Date(), m = d.getMonth(), day = d.getDate();
  return (m === 10 && day >= 24) || m === 11 || (m === 0 && day <= 6);   // 24.11. bis 06.01.
}
function inSeason(it) { return it.xmas ? xmasTime() : it.months.includes(curMonth()); }
const WALL_ITEMS = [                                              // exklusiv ab dem 2. Ei (Prestige 1+)
  { id: "wallclock",  label: "🕰 Wanduhr",      cost: 10, desc: "Zeigt die echte Zeit" },
  { id: "photo",      label: "🖼 Erinnerung",   cost: 12, desc: "Foto vom ersten Ei" },
  { id: "trophy",     label: "🏆 Pokalregal",   cost: 15, desc: "Ein Pokal pro Prestige" },
  { id: "lights",     label: "🌈 Lichterkette", cost: 12, desc: "Bunt über die Wand" },
];

// Offline-Decay: % pro Sekunde
const KRANK_DEVOLVE_MS = 7 * 86400 * 1000;                       // erst nach 7 unbehandelten Tagen eine Stufe zurück
function applyKrankDevolve(p) { return p; } // Abwesenheit nimmt keine Entwicklung zurück.
const DECAY_PS = { power: 0, hunger: 4/86400, sauberkeit: 3/86400 };

/* =========================================================================
   HOMEHUB-INTEGRATION (Vanilla) — Kontrakt wie dragon-game.js:
   window.DRAGON_DEFAULTS, var dragon, saveDragon(), loadDragon(d),
   rewardDragon(action), renderDragonCard()
   Speicher-Key: 'vh_dragon' · Marker: dragon.egg === true
   ========================================================================= */

// Rebalance 07/2026 (Grundlage: reales Nutzerbackup, ~13 Tage Nutzung: ~25 Ausgaben/Monat,
// ~7 Artikel/Monat, Verträge/Zähler nur alle paar Monate, Rezepte selten):
// echte HomeHub-Aktionen geben jetzt GARANTIERTE Sterne (nicht mehr nur 15% Zufall),
// gestaffelt nach Seltenheit/Aufwand — dafür ist der reine "App geöffnet"-Streakbonus
// entfallen (siehe checkDailyStreak(), jetzt an echte Aktionen gekoppelt).
const EGG_ACTIONS = {
  expense: { xp:6, label:"Es sortiert einen kleinen Beleg.", limit:5, trait:"fleißig" },
  shoppingComplete: { xp:10, label:"Es untersucht neugierig die Einkaufstasche.", limit:2, trait:"neugierig" },
  recipe: { xp:16, label:"Ein neuer Duft weckt seine Neugier.", trait:"neugierig" },
  recipeCooked: { xp:12, label:"Es schaut zufrieden auf den fertigen Teller.", dailyPerItem:true, trait:"gemütlich" },
  meter: { xp:24, label:"Es verfolgt aufmerksam die Messanzeige.", trait:"fleißig" },
  contractCreate: { xp:24, label:"Es nimmt das neue Klemmbrett unter die Lupe.", trait:"fleißig" },
  contractUpdate: { xp:12, label:"Es hilft beim Ordnen der Unterlagen.", cooldownDays:30, trait:"fleißig" },
  backup: { xp:3, label:"Die Sicherung ist angekommen. Es lässt ein Kontrolllicht blinken.", trait:"fleißig" }
};

window.DRAGON_DEFAULTS = {
  egg: true, stage: 0, xp: 0, power: 100, integrity: 100, shards: 0,
  expActive: false, expProgress: 0, expGoal: 12, stardust: 0, deko: {},
  hunger: 100, sauberkeit: 100, krank: false, krankSeit: 0, mess: [],
  hungerZeroSince: 0, sauberkeitZeroSince: 0,
  toys: {}, toyCooldown: {}, streak: 0, lastLogin: 0, prestige: 0,
  statLog: { acts: 0, byAction: {}, xpEarned: {}, starsEarned: {}, starsSpent: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 },
  rewardCooldowns: {}, lastRealActionDay: "", lastCareBonusAt: 0,
  lastReview: "", lastNudge: "", lastBackupReward: "", lastTurn: 0, lastKnock: "", costumes: {}, unlocked: {}, lastSeen: 0,
};
var dragon = JSON.parse(JSON.stringify(window.DRAGON_DEFAULTS));
window.dragon = dragon;   // sofort exportieren; loadDragon aktualisiert die Referenz

var uiDirty = true;
var dragonDirty = false;
var lastSavedDragonJson = '';
function markDirty() { uiDirty = true; dragonDirty = true; }

// Speichert nur, wenn sich der Zustand wirklich geändert hat (oder force=true).
// touchLastSeen=true nur bei echten Ereignissen (Aktion, Hintergrund, Check-in),
// NICHT bei jedem Autosave — sonst wäre jeder Autosave selbst eine Änderung.
function saveDragon(opts) {
  if(companionSaveBlocked)return false;
  const force = opts === true || (opts && opts.force);
  const touchLastSeen = opts === true || (opts && opts.touchLastSeen);
  const silent = !!(opts && opts.silent);   // stille Buchhaltung (Verfall/lastSeen) löst KEINEN Cloud-Sync aus
  try {
    if (touchLastSeen) dragon.lastSeen = Date.now();
    const json = JSON.stringify(dragon);
    if (!force && !dragonDirty && json === lastSavedDragonJson) return false;
    // Flag für den localStorage-Monkeypatch in index.html: bei stiller Buchhaltung
    // nicht als "echte Änderung" werten und keinen Sync-Konflikt provozieren.
    if (silent) window.__eggSilentWrite = true;
    localStorage.setItem("vh_dragon", json);
    if(!silent && typeof onAppDataSaved === "function" && json!==lastSavedDragonJson){
      try{onAppDataSaved("vh_dragon");}catch(err){window.__hhCompanionMigrationPending=true;console.warn("[Begleiter] Online-Abgleich wird erneut vorgemerkt:",err.message);}
    }
    window.__eggSilentWrite = false;
    lastSavedDragonJson = json;
    dragonDirty = false;
    return true;
  } catch (err) {
    window.__eggSilentWrite = false;
    console.warn("[HomeHub Dragon] Speichern fehlgeschlagen:", err);
    if (!(opts && opts.silent)) setTimeout(() => flash("⚠️ Ei konnte nicht gespeichert werden."), 0);
    return false;
  }
}

function migrateUnlocked(d) {
  const u = Object.assign({}, d.unlocked || {});
  for (const k of Object.keys(d.deko || {}))     if (d.deko[k])     u[k] = true;
  for (const k of Object.keys(d.toys || {}))     if (d.toys[k])     u[k] = true;
  for (const k of Object.keys(d.costumes || {})) if (d.costumes[k]) u[k] = true;
  return u;
}

function sanitizeDragon() {
  const num = (v, d, min, max) => { const n = Number(v); return isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  dragon.stage       = stg(dragon.stage);
  dragon.xp          = isFinite(Number(dragon.xp)) ? Math.max(0, Number(dragon.xp)) : 0;
  dragon.power       = num(dragon.power, 100, 0, 100);
  dragon.hunger      = num(dragon.hunger, 100, 0, 100);
  dragon.sauberkeit  = num(dragon.sauberkeit, 100, 0, 100);
  dragon.integrity   = num(dragon.integrity, 100, 0, 100);
  dragon.shards      = num(dragon.shards, 0, 0, 99);
  dragon.stardust    = num(dragon.stardust, 0, 0, 999999);
  dragon.prestige    = num(dragon.prestige, 0, 0, 9999);
  dragon.expGoal     = num(dragon.expGoal, 12, 1, 999);
  dragon.expProgress = num(dragon.expProgress, 0, 0, 9999);
  dragon.rewardCooldowns = safePlainObject(dragon.rewardCooldowns);
  dragon.lastRealActionDay = typeof dragon.lastRealActionDay === "string" ? dragon.lastRealActionDay : "";
  dragon.lastCareBonusAt = num(dragon.lastCareBonusAt, 0, 0, 8.64e15);
  dragon.statLog = safePlainObject(dragon.statLog);
  dragon.statLog.byAction = safePlainObject(dragon.statLog.byAction);
  dragon.statLog.xpEarned = safePlainObject(dragon.statLog.xpEarned);
  dragon.statLog.starsEarned = safePlainObject(dragon.statLog.starsEarned);
  dragon.statLog.starsSpent = safePlainObject(dragon.statLog.starsSpent);
  dragon.krankSeit   = num(dragon.krankSeit, 0, 0, 8.64e15);
  dragon.hungerZeroSince     = num(dragon.hungerZeroSince, 0, 0, 8.64e15);
  dragon.sauberkeitZeroSince = num(dragon.sauberkeitZeroSince, 0, 0, 8.64e15);
  dragon.lastSeen    = num(dragon.lastSeen, 0, 0, 8.64e15);
  dragon.streak      = num(dragon.streak, 0, 0, 99999);
  dragon.krank       = !!dragon.krank;
  dragon.expActive   = !!dragon.expActive;
  const MESS_TYPES = { poop: 1, slime: 1, shell: 1 };
  if (!Array.isArray(dragon.mess)) dragon.mess = [];
  dragon.mess = dragon.mess
    .filter(m => m && typeof m === 'object' && !Array.isArray(m) && MESS_TYPES[m.type])
    .map(m => ({
      type: m.type,
      x:    Number(m.x) || 0,
      seed: Number(m.seed) || 0,
    }))
    .slice(0, 12);
  const stripProto = o => { delete o.__proto__; delete o.constructor; delete o.prototype; return o; };
  for (const k of ['deko', 'toys', 'costumes', 'unlocked', 'toyCooldown']) {
    if (!dragon[k] || typeof dragon[k] !== 'object' || Array.isArray(dragon[k])) dragon[k] = {};
    else stripProto(dragon[k]);
  }
  if (!dragon.statLog || typeof dragon.statLog !== 'object' || Array.isArray(dragon.statLog)) {
    dragon.statLog = { acts: 0, byAction: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 };
  }
  if (!dragon.statLog.byAction || typeof dragon.statLog.byAction !== 'object') dragon.statLog.byAction = {};
}

// Übernimmt nur echte Plain Objects (keine Arrays/Strings) und kopiert tief,
// damit keine Referenz aus dem Import bestehen bleibt. Gefährliche Schlüssel raus.
function safePlainObject(src,depth=0) {
  const clean=(v,n)=>{
    if(n>24)return null;
    if(Array.isArray(v))return v.slice(0,512).map(x=>clean(x,n+1));
    if(v&&typeof v==="object"){
      const out={};for(const k of Object.keys(v))if(!["__proto__","constructor","prototype"].includes(k))out[k]=clean(v[k],n+1);return out;
    }
    if(typeof v==="number")return Number.isFinite(v)?v:0;
    return ["string","boolean"].includes(typeof v)||v===null?v:null;
  };
  return src && typeof src==="object" && !Array.isArray(src)?clean(src,depth):{};
}
function loadDragon(d) {
  const previous=dragon;
  const base = JSON.parse(JSON.stringify(window.DRAGON_DEFAULTS));
  try {
  dragon = Object.assign(base, d && d.egg===true ? safePlainObject(d) : {});
  window.dragon=dragon; sanitizeDragon();
  dragon.unlocked=migrateUnlocked(dragon);
  companionNormalize(dragon);
  // Import and cloud hydration are pure: time advances only on a real contact/tick.
  uiDirty=true; dragonDirty=false;
  lastSavedDragonJson=JSON.stringify(dragon);
  const sameScene=previous.companion?.generationId===dragon.companion.generationId && previous.stage===dragon.stage && previous.expActive===dragon.expActive && prestigeAnim.st==="none";
  prestigeAnim={st:"none",startT:0};prestigeVisual=null;
  if(!sameScene){expAnim={st:"in",startT:0};idle.act="none";idle.invited=false;ball.active=false;bubbles=[];laser.st="none";walk.x=92;walk.tx=92;walk.face=0;walk.until=lastT+2000;}
  } catch(err){dragon=previous;window.dragon=previous;throw err;}
}

/* ---------- Toast ---------- */
var flashTimer = 0;
function flash(msg) {
  const el = document.getElementById("eggToast");
  if (!el) return;
  el.textContent = msg; el.classList.add("on");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {el.classList.remove("on");el.textContent="";}, 2600);
}

/* ---------- Kernlogik ---------- */
// Versionierter Begleiterzustand; alte Felder bleiben für Renderer und Backups erhalten.
const COMPANION_DAY=86400000;
const COMPANION_TRAITS=["neugierig","verspielt","gemütlich","fleißig","chaotisch","abenteuerlustig","anhänglich"];
const COMPANION_FINDS=["Glatter Kiesel","Schimmernde Feder","Kleiner Messingknopf","Sternsplitter","Duftendes Blatt","Winzige Muschel","Bernstein","Saisonales Andenken"];
const COMPANION_TRIPS={near:{label:"Runde ums Haus",hours:3},garden:{label:"Gartenpfad",hours:10},stars:{label:"Sternenweg",hours:22}};
var companionSaveBlocked=false;
function companionNumber(v,f,min=0,max=8.64e15) {return Number.isFinite(Number(v))?clampI(Number(v),min,max):f;}
function companionNormalize(p) {
  const now=Date.now(), old=p.companion;
  if(old && Number(old.version)>1)throw new Error("Dieser Begleiterstand benötigt eine neuere HomeHub-Version.");
  if(!old || old.version!==1) {
    const remaining=4*3600000*(1-clampI(p.expProgress/Math.max(1,p.expGoal),0,1));
    p.companion={version:1,generationId:"egg-"+p.prestige+"-"+now,migratedAt:now,
      clocks:{lastSimulatedAt:now,lastContactAt:now},personality:{scores:{},evidence:{}},
      events:[],reactions:[],world:{objects:{},favorite:"",equippedCostume:""},
      collection:{finds:[],events:[],forms:[{id:"form:"+p.stage,label:EGG_PAL[p.stage].name}],moments:[]},
      journey:{days:[],weeklyAt:0,highestStage:p.stage,generations:[],spontaneous:0},
      ledger:{processed:[],day:"",xp:0,counts:{},seq:0,backupAt:/^\d{4}-\d{2}-\d{2}$/.test(String(p.lastBackupReward))?Math.min(now,Date.parse(p.lastBackupReward+"T23:59:59"))||0:0},
      expedition:p.expActive?{id:"legacy-exp",type:"near",startedAt:now,returnAt:now+remaining,originalDuration:remaining,result:{find:0,item:"ball",stars:3,xp:20},status:"away"}:null};
    p.hunger=Math.max(65,p.hunger);p.sauberkeit=Math.max(70,p.sauberkeit);p.power=Math.max(75,p.power);
    p.krank=false;p.krankSeit=0;p.hungerZeroSince=0;p.sauberkeitZeroSince=0;
    if(p.stage>=2){p.toys.ball=true;p.deko.rug=true;p.deko.plant=true;Object.assign(p.unlocked,{ball:true,rug:true,plant:true});}
    p.unlocked.rug=true;p.unlocked.plant=true;
    p.mess=p.mess.slice(0,2);
    p.companion.reactions.push({id:"welcome",type:"welcome",at:now,text:"Dein Begleiter ist angekommen. Die nächste Entdeckung beginnt ganz nebenbei."});
  }
  const c=p.companion=safePlainObject(p.companion);
  c.version=1;c.generationId=String(c.generationId||"egg-"+p.prestige).slice(0,80);
  c.clocks=safePlainObject(c.clocks);
  for(const k of ["lastSimulatedAt","lastContactAt"])c.clocks[k]=companionNumber(c.clocks[k],now);
  c.personality=safePlainObject(c.personality);c.personality.scores=safePlainObject(c.personality.scores);c.personality.evidence=safePlainObject(c.personality.evidence);
  for(const k of COMPANION_TRAITS)c.personality.scores[k]=companionNumber(c.personality.scores[k],0,0,100);
  c.world=safePlainObject(c.world);c.world.objects=safePlainObject(c.world.objects);
  c.world.equippedCostume=String(c.world.equippedCostume||"").slice(0,40);
  c.collection=safePlainObject(c.collection);
  for(const k of ["finds","events","forms","moments"])c.collection[k]=(Array.isArray(c.collection[k])?c.collection[k]:[]).filter(x=>x&&typeof x.id==="string").map(x=>({id:x.id.slice(0,100),label:String(x.label||"").slice(0,220),at:companionNumber(x.at,0)})).slice(-50);
  c.events=(Array.isArray(c.events)?c.events:[]).filter(x=>x&&["plant","rug","toy","nightlight","poster","corner","season","chaos"].includes(x.type)&&[0,1].includes(x.phase)&&Number.isFinite(x.dueAt)).slice(-2);
  c.events=c.events.map(x=>({id:String(x.id||"event").slice(0,100),type:x.type,phase:x.phase,startedAt:companionNumber(x.startedAt,now),dueAt:companionNumber(x.dueAt,now),find:companionNumber(x.find,0,0,COMPANION_FINDS.length-1)|0}));
  c.reactions=(Array.isArray(c.reactions)?c.reactions:[]).filter(x=>x&&typeof x.type==="string"&&Number.isFinite(x.at)).map(x=>({id:String(x.id||"").slice(0,100),type:x.type.slice(0,40),at:x.at,text:String(x.text||"").slice(0,220)})).slice(-8);
  c.journey=safePlainObject(c.journey);c.journey.days=(Array.isArray(c.journey.days)?c.journey.days:[]).filter(x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-90);
  c.journey.generations=(Array.isArray(c.journey.generations)?c.journey.generations:[]).slice(-10);
  c.ledger=safePlainObject(c.ledger);c.ledger.processed=(Array.isArray(c.ledger.processed)?c.ledger.processed:[]).filter(x=>typeof x==="string").map(x=>x.slice(0,180)).slice(-300);
  c.ledger.counts=safePlainObject(c.ledger.counts);c.ledger.xp=companionNumber(c.ledger.xp,0,0,120);c.ledger.seq=companionNumber(c.ledger.seq,0,0,1e12);
  c.ledger.backupAt=companionNumber(c.ledger.backupAt,0);
  const e=c.expedition;
  if(e && (!COMPANION_TRIPS[e.type] || !Number.isFinite(e.returnAt) || !Number.isFinite(e.startedAt) || !e.result || !["away","returned"].includes(e.status)))c.expedition=null;
  if(c.expedition){c.expedition.originalDuration=companionNumber(c.expedition.originalDuration,4*3600000,0,24*3600000);c.expedition.shortened=companionNumber(c.expedition.shortened,0,0,c.expedition.originalDuration*.25);c.expedition.result.story=String(c.expedition.result.story||"Es hat einen neuen Weg erkundet.").slice(0,140);c.expedition.result.find=companionNumber(c.expedition.result.find,0,0,COMPANION_FINDS.length-1)|0;c.expedition.result.xp=companionNumber(c.expedition.result.xp,20,0,40);c.expedition.result.stars=companionNumber(c.expedition.result.stars,3,0,8);}
  while(new Blob([JSON.stringify(c)]).size>60000 && c.collection.moments.length)c.collection.moments.shift();
  while(new Blob([JSON.stringify(c)]).size>60000 && c.ledger.processed.length)c.ledger.processed.shift();
  if(new Blob([JSON.stringify(c)]).size>64000)throw new Error("Begleiterzustand ist zu groß.");
  p.expActive=!!(c.expedition&&c.expedition.status==="away");
  return p;
}
function companionCommit(fn,silent=false) {
  if(companionSaveBlocked || window.__hhApplying)return false;
  const previous=dragon, oldJson=lastSavedDragonJson,oldDirty=dragonDirty;
  dragon=JSON.parse(JSON.stringify(previous));window.dragon=dragon;
  try {
    companionAdvance(Date.now(),false);
    const result=fn(dragon);
    if(result===false){dragon=previous;window.dragon=dragon;return false;}
    sanitizeDragon();companionNormalize(dragon);markDirty();
    if(!saveDragon({force:true,silent}))throw new Error("Speichern fehlgeschlagen");
    try{updateEggUI();if(companionReducedMotion()&&eggCtx)eggFrame();}catch(err){console.warn("[Begleiter] Anzeige nach Speicherung:",err.message);}
    return true;
  } catch(err){dragon=previous;window.dragon=dragon;lastSavedDragonJson=oldJson;dragonDirty=oldDirty;uiDirty=true;console.warn("[Begleiter] Änderung zurückgenommen:",err.message);return false;}
}
function companionRemember(category,id,label,at=Date.now()) {
  const a=dragon.companion.collection[category];
  if(!a.some(x=>x.id===id)){a.push({id,label,at});if(a.length>50)a.shift();}
}
function companionReact(type,text,now=Date.now()) {
  const c=dragon.companion;
  c.reactions=c.reactions.filter(x=>now-x.at<7*COMPANION_DAY && x.type!==type);
  c.reactions.push({id:c.generationId+":"+(++c.ledger.seq),type,text,at:now});c.reactions=c.reactions.slice(-8);
}
function companionTrait(trait,now=Date.now()) {
  const p=dragon.companion.personality,key=localDayKey(now)+":"+trait;
  if(p.evidence[key])return;
  p.evidence[key]=true;p.scores[trait]=Math.min(100,p.scores[trait]+2);
  const keys=Object.keys(p.evidence);if(keys.length>56)for(const k of keys.slice(0,keys.length-56))delete p.evidence[k];
}
function companionCharacter() {
  const scores=dragon.companion.personality.scores;
  const top=COMPANION_TRAITS.slice().sort((a,b)=>scores[b]-scores[a])[0];
  return scores[top]>=6?top:"lernt dich kennen";
}
function companionSeed(id) {let n=2166136261;for(const ch of String(id))n=Math.imul(n^ch.charCodeAt(0),16777619);return (n>>>0)/4294967296;}
function recordStatBucket(bucket,key,amount) {
  const L=dragon.statLog;L[bucket]=L[bucket]||{};L[bucket][key]=(Number(L[bucket][key])||0)+amount;
}
function eggBookXp(n,label,options={}) {
  const p=dragon,old=p.stage,gain=Math.max(0,Number(n)||0);
  if(options.action){p.statLog.acts=(Number(p.statLog.acts)||0)+1;recordStatBucket("byAction",label,1);}
  p.xp+=gain;if(gain)recordStatBucket("xpEarned",label,gain);
  p.stage=Math.max(old,stageForXp(p.xp));
  if(p.stage>old) {
    let stars=0;for(let i=old+1;i<=p.stage;i++){stars+=STAGE_REWARDS[i];companionRemember("forms","form:"+i,EGG_PAL[i].name+(companionCharacter()!=="lernt dich kennen"?" · "+companionCharacter():""));}
    p.stardust+=stars;recordStatBucket("starsEarned","Entwicklung",stars);
    p.companion.journey.highestStage=Math.max(p.stage,p.companion.journey.highestStage||0);
    companionReact("development","Es hat sich entwickelt: "+EGG_PAL[p.stage].name+".");
    if(p.stage>=2&&!p.toys.ball){p.toys.ball=true;p.unlocked.ball=true;}
  }
  return gain;
}
function companionAdvance(now,contact=false) {
  const p=dragon,c=p.companion,last=c.clocks.lastSimulatedAt,elapsed=Math.max(0,now-last),days=elapsed/COMPANION_DAY;
  p.hunger=Math.max(35,p.hunger-days*4);p.sauberkeit=Math.max(40,p.sauberkeit-days*3);p.power=Math.min(100,Math.max(45,p.power)+days*12);
  c.clocks.lastSimulatedAt=Math.max(now,last);
  if(now-c.clocks.lastContactAt>=28*COMPANION_DAY && !p.krank){p.krank=true;p.krankSeit=now;}
  if(p.krank && c.recoveryAt && now>=c.recoveryAt){p.krank=false;p.krankSeit=0;delete c.recoveryAt;}
  if(contact){
    if(p.krank&&!c.recoveryAt)c.recoveryAt=now+COMPANION_DAY;
    if(now-c.clocks.lastContactAt>2*COMPANION_DAY)companionTrait("gemütlich",now);
    c.clocks.lastContactAt=Math.max(now,c.clocks.lastContactAt);p.lastSeen=now;
  }
  const ex=c.expedition;
  if(ex&&ex.status==="away") {
    p.expProgress=Math.round(clampI((now-ex.startedAt)/Math.max(1,ex.returnAt-ex.startedAt),0,1)*100);p.expGoal=100;
    if(now>=ex.returnAt){
      ex.status="returned";p.expActive=false;p.expProgress=0;
      const r=ex.result;p.stardust+=r.stars;eggBookXp(r.xp,"Abenteuer");recordStatBucket("starsEarned","Abenteuer",r.stars);
      if(r.item){const item=TOY_ITEMS.concat(SHOP_ITEMS,SEASON_ITEMS,COSTUMES,WALL_ITEMS,WALL_SEASON_ITEMS).find(x=>x.id===r.item);if(item){p.unlocked[r.item]=true;if(TOY_ITEMS.includes(item))p.toys[r.item]=true;else if(COSTUMES.includes(item))p.costumes[r.item]=true;else p.deko[r.item]=true;}}
      companionRemember("finds","find:"+r.find,COMPANION_FINDS[r.find],now);
      companionRemember("moments",ex.id,(r.story||"Ein kleiner Ausflug mit einer großen Entdeckung.")+" Fund: "+COMPANION_FINDS[r.find],now);
      p.statLog.exps=(Number(p.statLog.exps)||0)+1;
      companionReact("expedition","Wieder da! "+(r.story||"Es hat einen neuen Weg erkundet.")+" Fund: "+COMPANION_FINDS[r.find]+".",now);
      companionTrait("abenteuerlustig",now);
    }
  }
  for(const event of c.events.slice()) {
    if(now<event.dueAt)continue;
    if(event.phase===0){event.phase=1;event.dueAt+=COMPANION_DAY;companionReact("event",companionEventText(event.type,1),now);c.world.objects[event.type]={state:"Spuren entdeckt",since:now};}
    if(now>=event.dueAt && event.phase===1){
      companionRemember("finds","find:"+event.find,COMPANION_FINDS[event.find],now);
      companionRemember("events",event.type,companionEventText(event.type,2),now);
      companionRemember("moments",event.id,companionEventText(event.type,2),now);
      companionTrait(event.type==="chaos"?"chaotisch":event.type==="toy"?"verspielt":"neugierig",now);
      c.world.favorite=event.type;c.world.objects[event.type]={state:"Vertrauter Lieblingsplatz",since:now};
      companionReact("event",companionEventText(event.type,2)+" Fund: "+COMPANION_FINDS[event.find]+".",now);
      p.stardust+=2;eggBookXp(12,"Entdeckung");c.events=c.events.filter(x=>x.id!==event.id);
    }
  }
  // No catch-up farm: at most one new story per contact/day, two active chains.
  if(contact && c.events.length<2 && c.lastEventDay!==localDayKey(now)) {
    const types=["corner","season","chaos"];
    if(p.deko.plant)types.push("plant");if(p.deko.rug)types.push("rug");if(p.deko.nightlight)types.push("nightlight");if(p.deko.poster)types.push("poster");if(Object.values(p.toys).some(Boolean))types.push("toy");
    const id=c.generationId+":event:"+(++c.ledger.seq),seed=companionSeed(id);
    const trait=companionCharacter(),fav=trait==="verspielt"?"toy":trait==="gemütlich"?"rug":trait==="chaotisch"?"chaos":"plant";
    const type=seed<0.4&&types.includes(fav)?fav:types[Math.floor(seed*types.length)];
    if(!c.events.some(x=>x.type===type)){
      c.events.push({id,type,phase:0,startedAt:now,dueAt:now+(8+Math.floor(seed*16))*3600000,find:Math.floor(companionSeed(id+":find")*COMPANION_FINDS.length)});
      companionReact("event",companionEventText(type,0),now);c.world.objects[type]={state:"Wird untersucht",since:now};
    }
    c.lastEventDay=localDayKey(now);
  }
  if(contact && p.stage>=2 && Object.values(p.toys).some(Boolean) && c.lastPlayDay!==localDayKey(now)) {
    c.lastPlayDay=localDayKey(now);c.journey.spontaneous=(Number(c.journey.spontaneous)||0)+1;
    companionRemember("moments","play:"+localDayKey(now),"Es hat selbstständig mit seinem Spielzeug gespielt.",now);
    companionTrait("verspielt",now);companionSceneToy();
  }
  c.reactions=c.reactions.filter(x=>now-x.at<7*COMPANION_DAY);
}
function companionEventText(type,phase) {
  const stories={plant:["Es beobachtet die Pflanze.","Zwischen den Blättern schimmert etwas.","Es hat ein Versteck in der Pflanze entdeckt."],rug:["Es rollt sich auf dem Teppich ein.","Unter dem Teppich zeichnet sich eine kleine Beule ab.","Der Teppich ist jetzt sein Lieblingsplatz."],toy:["Es probiert sein Spielzeug selbst aus.","Das Spielzeug hat einen neuen Platz gefunden.","Es hat eine eigene Spielidee entwickelt."],nightlight:["Es wartet neben dem Nachtlicht.","Nachts tanzen kleine Schatten an der Wand.","Es hat sein Nachtlicht lieb gewonnen."],poster:["Es betrachtet das Poster.","Ein kleiner Abdruck klebt am Rahmen.","Das Poster erinnert es an eine Geschichte."],corner:["Es untersucht eine stille Ecke.","In der Ecke liegt eine geheimnisvolle Spur.","Es hat ein kleines Versteck entdeckt."],season:["Es beobachtet das Licht dieser Jahreszeit.","Draußen ist etwas Besonderes zu sehen.","Es bringt ein Andenken an die Jahreszeit mit."],chaos:["Es räumt auf seine eigene Art um.","Ein paar Dinge liegen überraschend anders.","Sein kleines Chaos hat einen Schatz freigelegt."]};
  return (stories[type]||stories.corner)[phase];
}
function rewardDragon(action,meta={}) {
  const a=EGG_ACTIONS[action];if(!a)return false;
  return companionCommit(p=>{
    const now=Date.now(),today=localDayKey(now),c=p.companion,L=c.ledger,id=String(meta.id||"").slice(0,120);
    if(action==="backup" && L.backupAt && now-L.backupAt<7*COMPANION_DAY)return false;
    const key=action+":"+id+(a.dailyPerItem?":"+today:"");
    if(id && action!=="contractUpdate" && L.processed.includes(key))return false;
    companionAdvance(now,true);
    if(L.day!==today){L.day=today;L.xp=0;L.counts={};}
    const cdKey=action+":"+(id||"global"),last=p.rewardCooldowns[cdKey]||0;
    let allowed=!(a.cooldownDays && now-last<a.cooldownDays*COMPANION_DAY) && !(a.dailyPerItem && sameLocalDay(last,today));
    if(action==="backup")allowed=(!L.backupAt || now-L.backupAt>=7*COMPANION_DAY);
    const count=Number(L.counts[action])||0;
    const gain=allowed && (!a.limit||count<a.limit)?Math.min(a.xp,120-L.xp):0;
    L.counts[action]=count+1;L.xp+=gain;
    if(id && action!=="contractUpdate"){L.processed.push(key);L.processed=L.processed.slice(-300);}
    if(allowed){p.rewardCooldowns[cdKey]=now;if(action==="backup"){L.backupAt=now;p.lastBackupReward=today;}}
    eggBookXp(gain,action,{action:true});companionReact(action,a.label,now);companionTrait(a.trait,now);
    const areas=new Set(c.reactions.filter(x=>x.at>=now-COMPANION_DAY && EGG_ACTIONS[x.type]).map(x=>x.type));if(areas.size>=3)companionTrait("neugierig",now);
    if(action!=="backup") {
      if(!c.journey.days.includes(today)){c.journey.days.push(today);c.journey.days=c.journey.days.slice(-90);p.stardust++;recordStatBucket("starsEarned","Aktiver Tag",1);p.streak=(p.streak||0)+1;p.lastLogin=now;}
      const recent=c.journey.days.filter(x=>new Date(x+"T12:00:00").getTime()>now-7*COMPANION_DAY);
      if(recent.length>=3 && now-(c.journey.weeklyAt||0)>=7*COMPANION_DAY){eggBookXp(15,"Gemeinsame Woche");c.journey.weeklyAt=now;}
      p.lastRealActionDay=today;
      const e=c.expedition;if(e && e.status==="away"){const max=e.originalDuration*.25,shortened=e.shortened||0,step=Math.min(10*60000,max-shortened);e.returnAt-=step;e.shortened=shortened+step;}
    }
    // Old contract cooldown maps are preserved; new buckets remain bounded.
    const ks=Object.keys(p.rewardCooldowns);if(ks.length>300)for(const k of ks.slice(0,ks.length-300))delete p.rewardCooldowns[k];
  });
}
function companionInteract(type="nudge") {
  if(companionCommit(p=>{companionAdvance(Date.now(),true);companionTrait("anhänglich");if(type!=="nudge")companionTrait("verspielt");companionReact("interaction",p.expActive?"Es ist unterwegs und bringt bald eine Geschichte mit.":type==="knock"?"Es antwortet mit einem leisen Klopfen.":type==="toy"?"Es reagiert neugierig auf sein Spielzeug.":"Es freut sich, dich zu sehen.");})){
    if(dragon.expActive)return;
    walk.tx=walk.x;walk.until=lastT+4600;walk.face=0;laser.st="none";
    if(companionReducedMotion())return;
    if(type==="candle"){candleAnim.on=true;candleAnim.startT=lastT;}
    else if(type==="turn"){turnAnim.on=true;turnAnim.startT=lastT;}
    else if(dragon.stage<2 || type==="knock"){knockAnim.on=true;knockAnim.startT=lastT;}
    else {idle.act="wobble";idle.invited=true;idle.startT=lastT;idle.until=lastT+4200;}
  }
}
function eggNudge(){companionInteract();}
function eggTurn(){companionInteract("turn");}
function eggKnock(){companionInteract("knock");}
function eggCandle(){companionInteract("candle");}
function eggFeed(id){
  const food=FOOD_ITEMS.concat(BROOD_FOOD).find(x=>x.id===id);if(!food)return;
  const ok=companionCommit(p=>{if(p.stardust<food.cost)return false;p.stardust-=food.cost;p.hunger=Math.min(100,p.hunger+(food.hunger||25));p.power=Math.min(100,p.power+(food.power||0));p.statLog.feeds=(Number(p.statLog.feeds)||0)+1;companionReact("care",p.expActive?"Eine kleine Aufmerksamkeit wartet auf seine Rückkehr.":"Es genießt die kleine Aufmerksamkeit.");});
  if(ok&&!dragon.expActive&&!companionReducedMotion()){if(dragon.stage<2){sprayAnim.on=true;sprayAnim.startT=lastT;}else{knockAnim.on=true;knockAnim.startT=lastT;}}
}
function eggCharge(){companionCommit(p=>{p.power=100;companionReact("care","Es macht es sich im warmen Licht gemütlich.");});}
function eggClean(){const pile=dragon.mess[0];const ok=companionCommit(p=>{p.mess=[];p.shards=0;p.sauberkeit=100;p.statLog.cleans=(Number(p.statLog.cleans)||0)+1;companionReact("care","Das ganze Nest ist wieder aufgeräumt.");});if(ok&&!dragon.expActive&&!companionReducedMotion()){cleanAnim={on:true,startT:lastT,x:clampI(pile?.x||92,16,164),pileType:pile?.type||null};}}
function eggCleanShells(){eggClean();}
function eggHeal(){companionCommit(p=>{p.krank=false;p.krankSeit=0;delete p.companion.recoveryAt;companionReact("care","Es fühlt sich wieder wohl.");});}
function eggFix(){companionCommit(p=>{p.integrity=100;});}
function companionBuy(id,kind) {
  const catalogs={toys:TOY_ITEMS,deko:SHOP_ITEMS.concat(SEASON_ITEMS,WALL_ITEMS,WALL_SEASON_ITEMS),costumes:COSTUMES},item=catalogs[kind].find(x=>x.id===id);
  if(!item)return false;
  return companionCommit(p=>{
    if(p[kind][id]){if(kind==="costumes")p.companion.world.equippedCostume=p.companion.world.equippedCostume===id?"":id;else if(kind==="deko"){p.companion.world.objects[id]={state:"Lieblingsplatz",since:Date.now()};p.companion.world.favorite=id;companionReact("room",p.expActive?"Sein Zuhause wartet auf die Rückkehr.":["plant","rug","poster","nightlight"].includes(id)?companionEventText(id,0):"Es hat einen neuen Lieblingsplatz in seinem Zuhause.");}return;}
    if(!p.unlocked[id] || p.stardust<item.cost)return false;
    p.stardust-=item.cost;p[kind][id]=true;recordStatBucket("starsSpent",kind,item.cost);
    if(kind==="costumes")p.companion.world.equippedCostume=id;
    companionReact("room",p.expActive?"Sein Zuhause wird für die Rückkehr vorbereitet.":"Ein neuer Gegenstand macht sein Zuhause vertrauter.");
  });
}
function eggBuyToy(id){return companionBuy(id,"toys");}
function eggBuyDeko(id){return companionBuy(id,"deko");}
function eggBuyCostume(id){return companionBuy(id,"costumes");}
function companionSceneToy(id) {
  id=id||Object.keys(dragon.toys).find(x=>dragon.toys[x]);if(!id || dragon.expActive)return;
  walk.tx=walk.x;walk.face=0;walk.until=lastT+6000;
  idle.act="play";idle.invited=true;laser.st="none";idle.toy=id;idle.startT=lastT;idle.until=lastT+(id==="top"?6200:5400);ball.active=false;ball.done=false;
}
function eggPlay(id) {
  if(!dragon.toys[id] || dragon.expActive)return false;
  if(dragon.stage<2){companionInteract("toy");return true;}
  if(companionCommit(p=>{p.statLog.plays=(Number(p.statLog.plays)||0)+1;companionTrait("verspielt");companionReact("play","Es freut sich über eure gemeinsame Spielidee.");}))companionSceneToy(id);
}
function eggStartExp(type="near") {
  const trip=COMPANION_TRIPS[type];if(!trip||dragon.stage<2||dragon.expActive)return false;
  return companionCommit(p=>{
    const c=p.companion,now=Date.now(),id=c.generationId+":trip:"+(++c.ledger.seq),seed=companionSeed(id);
    let find=Math.floor(seed*COMPANION_FINDS.length);
    if(companionCharacter()==="abenteuerlustig"&&seed>.65)find=6;
    if(type==="stars"&&seed>.8)find=3;
    if(seed>.92)find=7;
    const unknown=COMPANION_FINDS.map((_,i)=>i).filter(i=>!c.collection.finds.some(x=>x.id==="find:"+i));
    c.misses=unknown.includes(find)?0:(Number(c.misses)||0)+1;
    if((p.statLog.exps||0)<2 || c.misses>=4){if(unknown.length)find=unknown[Math.floor(seed*unknown.length)];c.misses=0;}
    const item=nextExpItem(p),character=companionCharacter();
    const stories={near:["Es ist einer raschelnden Spur bis zur Haustür gefolgt.","Es hat sich mit einem Vogel über den Weg unterhalten."],garden:["Zwischen Wurzeln hat es eine verborgene Mulde gefunden.","Es hat am Gartenpfad ein neues Versteck entdeckt."],stars:["Im stillen Abendlicht hat etwas zwischen den Steinen geglänzt.","Es ist einem funkelnden Licht über den Hügel gefolgt."]};
    const story=character==="abenteuerlustig"?"Es hat mutig einen unbekannten Abzweig erkundet.":character==="gemütlich"?"Nach einer gemütlichen Pause hat es einen Schatz direkt am Rastplatz bemerkt.":stories[type][seed>.5?1:0];
    c.expedition={id,type,startedAt:now,returnAt:now+trip.hours*3600000,originalDuration:trip.hours*3600000,shortened:0,status:"away",result:{find,story,item:item?item.id:"",stars:type==="stars"?5:3,xp:type==="stars"?30:20}};
    p.expActive=true;p.expGoal=100;p.expProgress=0;companionTrait("abenteuerlustig");companionReact("expedition","Es macht sich auf den Weg: "+trip.label+".");
  });
}
function checkExpDone() {} // Timed outcomes are committed with companionAdvance.
function eggCheckIn(){return companionCommit(()=>companionAdvance(Date.now(),true));}
var prestigeConfirm=false;
function eggPrestige() {
  if(dragon.xp<5500 || dragon.expActive || prestigeAnim.st!=="none")return;
  if(!prestigeConfirm){prestigeConfirm=true;uiDirty=true;updateEggUI();return;}
  prestigeConfirm=false;
  const visual=JSON.parse(JSON.stringify(dragon));
  const ok=companionCommit(p=>{
    const now=Date.now(),n=p.prestige+1,c=p.companion;
    p.lastReview=buildReview(p,n);c.journey.generations.push({generation:c.generationId,stage:p.stage,xp:p.xp,character:companionCharacter()});c.journey.generations=c.journey.generations.slice(-10);
    companionRemember("moments",c.generationId+":portal","Ein neues Ei beginnt. Die Erinnerungen bleiben.");
    p.prestige=n;p.stage=0;p.xp=0;p.hunger=100;p.sauberkeit=100;p.power=100;p.integrity=100;p.mess=[];p.shards=0;p.krank=false;p.krankSeit=0;p.stardust+=n*10;
    c.generationId="egg-"+n+"-"+now;c.events=[];c.expedition=null;c.clocks={lastSimulatedAt:now,lastContactAt:now};c.journey.days=[];c.journey.weeklyAt=0;c.journey.highestStage=0;delete c.recoveryAt;
    for(const k of COMPANION_TRAITS)c.personality.scores[k]=Math.round(c.personality.scores[k]*.2);
    c.personality.evidence={};companionReact("generation","Ein neues Ei ist da. Sein Zuhause und eure Erinnerungen bleiben.");
  });
  if(ok){if(companionReducedMotion()){walk.x=92;walk.tx=92;walk.face=0;uiDirty=true;return;}prestigeVisual=visual;const generation=dragon.companion.generationId;prestigeAnim={st:"walk",startT:lastT};walk.tx=40;walk.until=lastT+30000;setTimeout(()=>{if(dragon.companion.generationId!==generation)return;prestigeAnim={st:"none",startT:0};prestigeVisual=null;walk.x=92;walk.tx=92;walk.face=0;uiDirty=true;},5200);}
}
window.rewardDragon=rewardDragon;window.loadDragon=loadDragon;window.saveDragon=saveDragon;

function buildReview(p, n) {
  const L = p.statLog || {}, by = L.byAction || {};
  const lines = Object.entries(by).map(([k, v]) => "  • " + k + ": " + v + "×").join("\n");
  return "🥚 EI-RÜCKBLICK — Prestige " + n + "\n" + "=".repeat(34) +
    "\n\nDein Ei hat die volle Evolution durchlaufen!\n\n⭐ Gesamt-XP: " + p.xp +
    "\n🔥 Login-Streak: " + (p.streak || 0) + " Tage\n\n📋 HomeHub-Taten (" + (L.acts || 0) + " gesamt):\n" + (lines || "  –") +
    "\n\n🍳 Fütterungen: " + (L.feeds || 0) + "\n🎮 Spielrunden: " + (L.plays || 0) +
    "\n🚪 Expeditionen: " + (L.exps || 0) + "\n🧹 Reinigungen: " + (L.cleans || 0) +
    "\n✨ Sterne übrig: " + (p.stardust || 0) + "\n\nWeiter geht's mit Ei Nr. " + (n + 1) + "! 🌀";
}
function eggDownloadReview() {
  if (!dragon.lastReview) return;
  try {
    const blob = new Blob([dragon.lastReview], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ei-rueckblick.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  } catch (_) { flash("Download nicht möglich"); }
}

/* ---------- UI ---------- */
var eggCanvas = null, eggCtx = null, eggRafId = 0, eggStart = 0, eggElapsed = 0;
var eggOpenPanels=new Set();
function eggRememberPanel(e){const target=e.target;if(target?.tagName!=="DETAILS" || !document.getElementById("eggSections")?.contains(target))return;target.open?eggOpenPanels.add(target.dataset.panel):eggOpenPanels.delete(target.dataset.panel);}
function eggItemLabel(item){return String(item.label||"").replace(/^[^\p{L}\p{N}]+/u,"");}

// Ist die Ei-Karte tatsächlich sichtbar? (Home-Seite aktiv, Element im Layout)
function eggCardVisible() {
  try {
    const canvasEl = document.getElementById("eggCanvas");
    if (!canvasEl) return false;
    // offsetParent === null → Element oder ein Vorfahre ist display:none.
    // Nur Sichtbarkeit, keine Style-WERTE für die Spiellogik.
    if (typeof canvasEl.offsetParent !== "undefined" && canvasEl.offsetParent === null) return false;
    return true;
  } catch (e) { return true; }   // im Zweifel weiterzeichnen
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function eggStatusRow() {
  const p = dragon;
  const mini = (v, col) => '<span class="eg-mini"><span style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + col + '"></span></span>';
  return (p.stage < 2 ? "💧" : "🍖") + mini(p.hunger, p.hunger > 50 ? "#a0c840" : p.hunger > 25 ? "#e0a030" : "#e04040") +
    "🧼" + mini(p.sauberkeit, p.krank ? "#e04040" : "#5ad0b0") +
    '<span class="eg-chip" style="color:' + (p.streak > 0 ? "#ff9a30" : "#6a5a8a") + '">🔥' + (p.streak || 0) + "</span>" +
    '<span class="eg-chip" style="color:#bfa8ff">✨' + (p.stardust || 0) + "</span>";
}

// Farbige "Backlicht"-Zonen statt Textüberschriften — zusammengehörige Tasten
// bekommen eine dezente farbige Glut als gemeinsamen Rahmen (Labor-Bedienpanel
// mit unterschiedlich beleuchteten Funktionsbereichen), statt eines Textlabels.
function eggZone(color, glow, innerHtml) {
  return '<div class="eg-zone" style="--eg-zc:' + color + ";--eg-zg:" + glow + '">' + innerHtml + "</div>";
}
// Rasterbreite richtet sich nach dem längsten Label/Untertext der Gruppe statt
// fest 2 oder 4 Spalten — kurze Label stehen zu dritt nebeneinander, lange
// bekommen mehr Raum, nie wirkt der Text gequetscht.
function eggGrid(entries) {
  let maxLen = 6;
  entries.forEach(en => { if (en.len > maxLen) maxLen = en.len; });
  const minPx = Math.min(152, Math.max(72, Math.round(maxLen * 6.6 + 24)));
  return '<div class="eg-grid" style="--eg-mincol:' + minPx + 'px">' + entries.map(en => en.html).join("") + "</div>";
}

function companionMoment(){
  const r=dragon.companion.reactions,last=r[r.length-1];if(!last)return "Es sieht sich in seinem Zuhause um.";
  const development=r.find(x=>x.type==="development" && x.at===last.at);
  return development && development!==last?development.text+" "+last.text:last.text;
}
function eggSections() {
  if(companionSaveBlocked)return '<p class="eg-warn">Der Begleiterstand konnte nicht sicher übernommen werden. Deine gespeicherten Daten bleiben erhalten. Bitte Speicherplatz bzw. App-Version prüfen und neu laden.</p>';
  const p=dragon,c=p.companion,current=p.stage;
  const button=(act,label,id="",disabled=false,selected=null)=>'<button class="eg-btn" data-act="'+act+'" data-id="'+esc(id)+'"'+(disabled?' disabled':'')+(selected===null?'':' aria-pressed="'+selected+'"')+'>'+label+'</button>';
  let h='<div class="eg-pane"><div class="eg-row"><strong>'+esc(EGG_PAL[current].name)+'</strong><span>'+p.stardust+' Sterne</span></div>';
  h+='<p class="eg-moment" role="status" aria-live="polite">'+esc(companionMoment())+'</p>';
  h+='<p class="eg-dim">'+(p.krank?'Ruht sich aus · erholt sich nach der Rückkehr von selbst':p.hunger<50?'Gemütlich und etwas hungrig':'Fühlt sich wohl')+' · '+esc(companionCharacter())+(p.prestige?' · Ei '+(p.prestige+1):'')+'</p>';
  h+='<div class="eg-companion-nav">'+button("nudge",p.expActive?"Unterwegs":"Begrüßen","",p.expActive)+button("album","Album")+'</div>';
  const toys=TOY_ITEMS.filter(x=>p.unlocked[x.id]),deko=SHOP_ITEMS.concat(SEASON_ITEMS,WALL_ITEMS,WALL_SEASON_ITEMS).filter(x=>p.unlocked[x.id]),costumes=COSTUMES.filter(x=>p.unlocked[x.id]||p.costumes[x.id]);
  h+='<details data-panel="room"><summary>Raum und Spielzeug</summary><p class="eg-dim">Dein Begleiter nutzt seine Spielsachen auch selbstständig.</p>';
  if(toys.length){h+='<h4 class="eg-group-title">Spielzeug</h4><div class="eg-grid">';
    for(const it of toys)h+=button("toy",esc(eggItemLabel(it))+'<small>'+(p.toys[it.id]?(p.expActive?'Nach der Rückkehr':p.stage<2?'Zeigen':'Gemeinsam spielen'):it.cost+' Sterne')+'</small>',it.id,p.expActive || (!p.toys[it.id]&&p.stardust<it.cost));h+='</div>';}
  if(deko.length){h+='<h4 class="eg-group-title">Einrichtung</h4><div class="eg-grid">';
    for(const it of deko)h+=button("deko",esc(eggItemLabel(it))+'<small>'+(p.deko[it.id]?(c.world.favorite===it.id?'Lieblingsplatz':'Im Raum'):it.cost+' Sterne')+'</small>',it.id,!p.deko[it.id]&&p.stardust<it.cost);h+='</div>';}
  if(costumes.length){h+='<h4 class="eg-group-title">Kostüme</h4><div class="eg-grid">';
    for(const it of costumes)h+=button("costume",esc(eggItemLabel(it))+'<small>'+(p.costumes[it.id]?(c.world.equippedCostume===it.id?'Angezogen · ausziehen':'Anziehen'):it.cost+' Sterne')+'</small>',it.id,!p.costumes[it.id]&&p.stardust<it.cost,p.costumes[it.id]?c.world.equippedCostume===it.id:null);h+='</div>';}
  if(!toys.length&&!deko.length&&!costumes.length)h+='<p class="eg-dim">Mit der Zeit findet es neue Dinge für sein Zuhause.</p>';
  h+='</details><details data-panel="adventure"><summary>Abenteuer</summary>';
  if(p.expActive){const ex=c.expedition;h+='<p>'+esc(COMPANION_TRIPS[ex.type].label)+' · Rückkehr ungefähr '+esc(new Date(ex.returnAt).toLocaleString('de-DE',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}))+'</p><p class="eg-dim">Die Rückkehr und der Fund werden automatisch gespeichert.</p>';}
  else if(p.stage>=2){h+='<div class="eg-grid">';for(const [id,it] of Object.entries(COMPANION_TRIPS))h+=button('exp',it.label+'<small>Etwa '+it.hours+' Stunden</small>',id);h+='</div>';}
  else h+='<p class="eg-dim">Sobald es laufen kann, erkundet es die Umgebung.</p>';
  h+='</details><details data-panel="care"><summary>Kleine Aufmerksamkeiten · freiwillig</summary><div class="eg-grid">'+button('feed',p.stage<2?'Befeuchten':'Kleine Mahlzeit',p.stage<2?BROOD_FOOD[0].id:'ei')+button('clean','Ganzes Nest aufräumen')+button('charge','Warmes Licht')+(p.krank?button('heal','Erholung unterstützen'):'')+'</div><p class="eg-dim">Hunger '+Math.round(p.hunger)+' · Sauberkeit '+Math.round(p.sauberkeit)+'. Pflege ist keine Voraussetzung für Entwicklung oder Abenteuer.</p></details>';
  h+='<details data-panel="history"><summary>Erinnerungen und Verlauf</summary><p class="eg-dim">'+(p.statLog.acts||0)+' bisherige Aktionen · '+(p.statLog.plays||0)+' gemeinsame Spielrunden · '+(c.journey.spontaneous||0)+' selbstständige Spielmomente · '+(p.statLog.exps||0)+' Abenteuer. Aktivitätstage: '+p.streak+'.</p>'+(p.lastReview?button('review','Rückblick herunterladen'):'')+'</details>';
  if(p.xp>=5500)h+=button('prestige',prestigeConfirm?'Neues Ei wirklich beginnen?':'Durchs Portal · neues Ei','',p.expActive);
  return h+'</div>';
}

function updateEggUI() {
  try { updateEggUIInner(); } catch (err) {
    uiDirty = false;
    console.warn('[Ei] Menüfehler:', err);
    const se2 = document.getElementById("eggSections");
    if (se2) se2.innerHTML = '<div class="eg-dim" style="padding:8px">Anzeige konnte nicht aufgebaut werden. App neu laden.</div>';
  }
}
function updateEggUIInner() {
  const se = document.getElementById("eggSections");
  if (!se) return;
  const open=eggOpenPanels;
  se.querySelectorAll("details").forEach(x=>{x.open?open.add(x.dataset.panel):open.delete(x.dataset.panel);});
  const focus=document.activeElement, panel=focus?.tagName==="SUMMARY"?focus.parentElement.dataset.panel:null, act=focus && focus.dataset && focus.dataset.act, id=focus && focus.dataset && focus.dataset.id;
  se.innerHTML = eggSections();
  se.querySelectorAll("details").forEach(x=>{x.open=open.has(x.dataset.panel);});
  if(act){const target=Array.from(se.querySelectorAll("[data-act]")).find(x=>x.dataset.act===act&&x.dataset.id===id);if(target)target.focus({preventScroll:true});}
  if(panel){const summary=Array.from(se.querySelectorAll("details")).find(x=>x.dataset.panel===panel)?.querySelector("summary");if(summary)summary.focus({preventScroll:true});}
  uiDirty = false;
}

// ── Sammelalbum: alle Gegenstände, gefunden oder noch nicht ──────────────
function eggAlbumEntry(it, owned, note) {
  const html = '<div class="eg-btn eg-owned' + (owned ? '' : ' eg-locked') + '" style="cursor:default">' +
    (owned ? it.label : "🔒 " + it.label.replace(/^\S+\s/, "")) +
    '<br><small>' + (owned ? (note || "Gefunden") : (it.months || it.xmas ? "Saisonal" : "Noch nicht gefunden")) + '</small></div>';
  return { html, len: Math.max(it.label.length - 3, 12) };
}
function eggAlbumHtml() {
  const p=dragon,c=p.companion;
  let h='<div class="eg-album"><p>Einige Entdeckungen bleiben noch im Verborgenen.</p>';
  const section=(title,rows)=>'<h3>'+title+'</h3><div class="eg-grid">'+rows.map(x=>'<div class="eg-album-entry">'+x+'</div>').join('')+'</div>';
  for(const [title,items,map] of [["Spielzeuge",TOY_ITEMS,p.toys],["Dekoration",SHOP_ITEMS.concat(SEASON_ITEMS,WALL_ITEMS,WALL_SEASON_ITEMS),p.deko],["Kostüme",COSTUMES,p.costumes]]) {
    h+=section(title,items.map(it=>p.unlocked[it.id]||map[it.id]?esc(eggItemLabel(it))+'<small>'+(map[it.id]?(title==='Dekoration'?'Besitzt du · im Raum':'Besitzt du'):'Entdeckt · im Raum erhältlich')+'</small>':'<span class="eg-dim">Ein unbekannter '+(title==='Spielzeuge'?'Spielgefährte':'Gegenstand')+'</span>'));
  }
  for(const [key,title] of [["finds","Fundstücke"],["events","Besondere Ereignisse"],["forms","Entwicklungsformen"],["moments","Erinnerungen"]])h+=section(title,c.collection[key].length?c.collection[key].map(x=>esc(x.label)):['Noch eine verborgene Geschichte']);
  return h+'</div>';
}

function eggHandleClick(e) {
  try { eggHandleClickInner(e); } catch (err) { console.warn('[Ei] Aktion:', err); }
}
function eggHandleClickInner(e) {
  const b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
  if (!b) return;
  const act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
  if (act === "nudge") eggNudge();
  else if (act === "turn") eggTurn();
  else if (act === "knock") eggKnock();
  else if (act === "candle") eggCandle();
  else if (act === "charge") eggCharge();
  else if (act === "clean") eggClean();
  else if (act === "heal") eggHeal();
  else if (act === "fix") eggFix();
  else if (act === "shells") eggCleanShells();
  else if (act === "feed") eggFeed(id);
  else if (act === "exp") eggStartExp(id || "near");
  else if (act === "deko") { const it = SHOP_ITEMS.concat(SEASON_ITEMS, WALL_ITEMS, WALL_SEASON_ITEMS).find(x => x.id === id); if (it) eggBuyDeko(id, it.cost); }
  else if (act === "toy") { if (dragon.toys && dragon.toys[id]) eggPlay(id); else eggBuyToy(id); }
  else if (act === "costume") eggBuyCostume(id);
  else if (act === "review") eggDownloadReview();
  else if (act === "prestige") eggPrestige();
  else if (act === "album") { if (typeof openKasseModal === "function") openKasseModal("Sammelalbum", eggAlbumHtml()); }
}

function renderDragonCard() {
  try { renderDragonCardInner(); } catch (err) { console.warn('[Ei] Karte:', err); }
}
function renderDragonCardInner() {
  const card = document.getElementById("dragonCard");
  if (!card) return;
  card.innerHTML =
    '<div class="eg-head">HomeHub · <span style="color:#b3720a">DEIN BEGLEITER</span></div>' +
    '<div class="eg-canvas-wrap"><canvas id="eggCanvas" width="180" height="156"></canvas></div>' +
    '<div id="eggToast" class="eg-toast"></div>' +
    '<div id="eggSections"></div>';
  // Vor dem Neubinden die alte Schleife stoppen (kein zweiter RAF, keine Dopplung)
  eggStopLoop();
  card.removeEventListener("click", eggHandleClick);   // doppelte Listener vermeiden
  card.addEventListener("click", eggHandleClick);
  card.removeEventListener("toggle",eggRememberPanel,true);card.addEventListener("toggle",eggRememberPanel,true);
  updateEggUI();
  eggCanvas = document.getElementById("eggCanvas");
  if (!eggCanvas || !eggCanvas.getContext) { eggCtx = null; return; }
  eggCtx = eggCanvas.getContext("2d");
  if (!eggCtx) return;
  eggCtx.imageSmoothingEnabled = false;
  // Keep elapsed animation time: transient toy phases must not jump backwards.
  eggStartLoop();                                       // genau eine Schleife
}
window.renderDragonCard = renderDragonCard;

var eggRenderErrors = 0;

function eggStartLoop() {
  if (eggRafId) return;                       // schon aktiv → keine zweite Schleife
  if (typeof document !== "undefined" && document.hidden) return;
  if (!eggCtx || !document.getElementById("eggCanvas")) return;
  eggRenderErrors = 0;eggPreviousFrameTime=null;
  eggStart = (typeof performance !== "undefined" ? performance.now() : Date.now()) - (eggElapsed || 0);
  if(companionReducedMotion()){eggFrame();return;}
  eggRafId = requestAnimationFrame(eggLoop);
}

function eggStopLoop() {
  if (eggRafId && typeof cancelAnimationFrame === "function") cancelAnimationFrame(eggRafId);
  eggRafId = 0;
}

function eggLoop() {
  if (!eggRafId) return;                       // nach Stop nicht weiterlaufen
  if(companionReducedMotion()){eggStopLoop();eggFrame();return;}
  eggRafId = requestAnimationFrame(eggLoop);
  try {
    eggFrame();
    eggRenderErrors = 0;
  } catch (err) {
    eggRenderErrors++;
    if (eggRenderErrors <= 1) console.warn('[Ei] Anzeigefehler:', err);
    if (eggRenderErrors >= 5) {                // mehrere Fehler hintereinander → anhalten
      console.warn('[Ei] Animation nach wiederholten Fehlern gestoppt.');
      eggStopLoop();
    }
  }
}
function eggFrame() {
  // Pausiert, wenn Tab im Hintergrund, Canvas weg oder Karte unsichtbar
  if (typeof document !== "undefined" && document.hidden) { eggStopLoop(); return; }
  const canvasEl = document.getElementById("eggCanvas");
  if (!eggCtx || !canvasEl) {
    eggCanvas = null; eggCtx = null;
    eggStopLoop();
    return;
  }
  if (!eggCardVisible()) { eggStopLoop(); return; }
  const t = companionReducedMotion() ? 0 : (typeof performance !== "undefined" ? performance.now() : Date.now()) - eggStart;
  eggFrameScale=companionReducedMotion()?0:eggPreviousFrameTime===null?1:clampI((t-eggPreviousFrameTime)/(1000/60),0,3);
  eggPreviousFrameTime=t;eggElapsed = t;
  const St = prestigeVisual && prestigeAnim.st!=="none" ? prestigeVisual : dragon;
  eggCtx.clearRect(0, 0, CW, CH);
  {
    drawRoom(eggCtx, t, St.stage, St.power);
    if (St.deko) drawDeko(eggCtx, t, St.deko, St.prestige || 0);
    if (St.mess && St.mess.length) drawMess(eggCtx, St.mess);
    if ((St.xp || 0) >= 5500) drawPrestigePortal(eggCtx, t);
    drawEgg(eggCtx, St, t);
    drawDim(eggCtx, St.power, t, St.deko);
    drawCompanionScene(eggCtx, St, t);
  }
  if (uiDirty) updateEggUI();
}

/* ══════════════════════════════════════════════════════════════════════
   Timer-, Speicher- und RAF-Lifecycle

   • Alle Intervalle liegen zentral in eggTimers und werden nur EINMAL
     gestartet (Schutz gegen doppelte Skripteinbindung, s.u.).
   • Jeder Timer fängt Fehler lokal ab und sichert den Zustand vorher mit
     sanitizeDragon() ab, bevor er auf Arrays/Objekte zugreift.
   • Ein Minutentakt projiziert Bedürfnisse und Zeit lokal. Nur dauerhafte
     Ereignisabschlüsse lösen einen Cloud-Sync aus; kein Frame schreibt Daten.
   • lastSeen wird nur bei echten Ereignissen gesetzt (Hintergrund,
     Check-in) — nicht bei jedem Autosave.
   ══════════════════════════════════════════════════════════════════════ */

var eggTimers = [];

function eggEvery(ms, fn) {
  const id = setInterval(() => {
    try { sanitizeDragon(); fn(); }
    catch (e) { console.warn('[Ei] Timerfehler:', e); }
  }, ms);
  eggTimers.push(id);
  return id;
}

function eggStartTimers() {
  if(eggTimers.length)return;
  eggEvery(60000,()=>{
    if(document.hidden || window.__hhApplying)return;
    if(window.__hhCompanionMigrationPending && window.__hhReady){try{onAppDataSaved("vh_dragon");window.__hhCompanionMigrationPending=false;}catch(_) {}}
    const c=dragon.companion,now=Date.now();
    if(!c || companionSaveBlocked)return;
    const due=c.events.some(x=>now>=x.dueAt) || (c.expedition?.status==="away"&&now>=c.expedition.returnAt) || (c.recoveryAt&&now>=c.recoveryAt);
    companionCommit(()=>companionAdvance(now,false),!due);
    if(uiDirty)updateEggUI();
    if(companionReducedMotion()&&eggCtx)eggFrame();
  });
}
function eggApplyMotionPreference(){
  eggStopLoop();
  if(companionReducedMotion()){
    prestigeVisual=null;prestigeAnim={st:"none",startT:0};idle.act="none";idle.invited=false;ball.active=false;bubbles=[];laser.st="none";
    knockAnim.on=false;turnAnim.on=false;cleanAnim.on=false;sprayAnim.on=false;candleAnim.on=false;roll.phase="idle";roll.nextT=10000;fly.st="idle";fly.until=4500;walk.until=2000;walk.x=92;walk.tx=92;walk.face=0;
  }
  if(eggCtx)eggStartLoop();
}
function companionReducedMotion(){return typeof matchMedia==="function" && matchMedia("(prefers-reduced-motion: reduce)").matches;}
function drawCompanionScene(ctx,p,t) {
  const c=p.companion,r=c.reactions[c.reactions.length-1],type=r?.type;
  // Pixel props make real HomeHub activity visible without pop-ups.
  const colors={expense:"#f2dab1",shoppingComplete:"#c89760",recipe:"#8bb86d",recipeCooked:"#8bb86d",meter:"#67bec4",backup:"#67bec4",contractCreate:"#e4dfcc",contractUpdate:"#e4dfcc"};
  if(colors[type]){
    ctx.fillStyle=colors[type];ctx.fillRect(146,112,12,12);ctx.fillStyle="#5a4b66";
    if(type==='shoppingComplete'){ctx.strokeRect(149,108,6,4);ctx.fillRect(150,118,4,2);}
    else if(type==='recipe'||type==='recipeCooked'){ctx.fillStyle="#e4e7d5";ctx.fillRect(144,120,16,3);ctx.fillStyle="#91b966";ctx.fillRect(149,116,7,4);}
    else if(type==='backup'||type==='meter'){ctx.fillRect(148,114,8,5);ctx.fillStyle="#8ddd9f";ctx.fillRect(150,116,4,2);}
    else {ctx.fillRect(149,115,6,1);ctx.fillRect(149,118,5,1);if(type!=='expense')ctx.fillRect(150,110,4,3);}
  }
}

function eggHandleVisibility() {
  try {
    if (document.hidden) {
      eggStopLoop();
      companionCommit(()=>companionAdvance(Date.now(),false),true);
    } else {
      eggCheckIn();                           // aktualisiert lastSeen und speichert selbst
      if (document.getElementById("eggCanvas")) eggStartLoop();
    }
  } catch (e) { console.warn('[Ei] Sichtbarkeitswechsel:', e); }
}

/* ══════════════════════════════════════════════════════════════════════
   Initialisierungsschutz gegen doppelte Skripteinbindung:
   Timer, Listener und Boot laufen nur beim ersten Laden.
   ══════════════════════════════════════════════════════════════════════ */
if (window.__HOMEHUB_EGG_MODULE_INITIALIZED__) {
  console.warn('[Ei] Zweite Initialisierung verhindert.');
} else {
  window.__HOMEHUB_EGG_MODULE_INITIALIZED__ = true;

  document.addEventListener("visibilitychange", eggHandleVisibility);
  if(window.matchMedia){const motion=window.matchMedia("(prefers-reduced-motion: reduce)");if(motion.addEventListener)motion.addEventListener("change",eggApplyMotionPreference);}

  // Boot: gespeicherten Stand laden (loadDragon säubert selbst)
  (function eggBoot() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem("vh_dragon") || "null"); } catch (_) {}
    try {
      if(stored && stored.egg && !stored.companion && !localStorage.getItem("hh_dragon_before_companion"))localStorage.setItem("hh_dragon_before_companion",JSON.stringify({savedAt:new Date().toISOString(),dragon:stored}));
      loadDragon(stored);
      if(stored?.egg && !stored.companion)window.__hhCompanionMigrationPending=true;
      companionCommit(()=>companionAdvance(Date.now(),true),true);
    } catch(err){companionSaveBlocked=true;console.warn("[Begleiter] Migration angehalten:",err.message);}
    try { lastSavedDragonJson = JSON.stringify(dragon); } catch (_) {}
    eggStartTimers();
  })();
}
