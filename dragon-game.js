
/* =========================================================================
   HomeHub — EI-EVOLUTION  PROTOTYP-SANDBOX (egg-sandbox.jsx)  v1
   -------------------------------------------------------------------------
   Langzeit-Gamification: EIN Ei, 6 Evolutionsstufen über ~2 Jahre.
     0 Ur-Ei            (0 XP)      leblos, geheimnisvoll
     1 Beobachtendes Ei (300)       Augen erscheinen, blinzeln im Dunkeln
     2 Watschelndes Ei  (1.200)     bekommt Füßchen, wackelt
     3 Greifendes Ei    (3.000)     bekommt Ärmchen, greift
     4 Rissiges Ei      (6.000)     riesig, leuchtende Risse, Drachen-Schatten innen
     5 Kosmisches Ei    (10.000)    funkelnde Entität, taucht den Raum in Licht
   Render-Stack 1:1 aus dragon-sandbox: buildSprite (Outline + manuelles AA +
   Rim-Light), Höhle/Fackel/Nest, drawDragonShadow (Bayer-AO).
   XP steigt nur (nie runter). "Strom" = reiner Engagement-Puffer: bei 0 geht
   nur das Licht aus (Ei friert optisch ein) – KEIN XP-Verlust.
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
function drawEyes(ctx, cx, ey, t, P, mode, track) {
  const sep = Math.round(P.rb * 0.30), R = Math.max(4, Math.round(P.rb * 0.24)), pr = R * 0.5, shell = mode !== "dark";
  let dx2, dy2, blink;
  if (track) {                                                    // Fliege mit den Augen verfolgen
    const a = Math.atan2(track.y - ey, track.x - cx), m = Math.min(1, Math.hypot(track.x - cx, track.y - ey) / 24);
    dx2 = Math.cos(a) * (R - 1.5) * m; dy2 = Math.sin(a) * (R - 1.5) * m; blink = (t % 6000) > 5900;
  } else { const G = gaze(t); dx2 = G.dx * (R / 4); dy2 = G.dy * (R / 4); blink = G.blink; }
  for (const sign of [-1, 1]) {
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
  }
}
/* ---------- Wärmelampe (Brutkasten) + Steuerbox ---------- */
function drawHeatLamp(ctx, t, stage) {
  const lx = 32, ly = 24, red = stage === 0;                    // obere linke Ecke, größer
  // Klemme + Arm aus der Ecke
  rect(ctx, 8, 8, 8, 4, "#6a6e80"); rect(ctx, 8, 8, 8, 1, "#9aa0b2"); rect(ctx, 8, 11, 8, 1, "#3a3e4c");
  rect(ctx, 14, 9, lx - 16, 3, "#4a4e5e"); rect(ctx, 14, 9, lx - 16, 1, "#7a8092");
  rect(ctx, lx - 3, 11, 3, ly - 12, "#4a4e5e");                                  // Hals zum Schirm
  // Reflektor-Schirm (Metall, mit Verlauf + Glanz)
  tri(ctx, lx - 14, ly + 10, lx + 15, ly + 3, lx - 1, ly - 12, "#3a3e4c");       // Außen-/Schattenseite
  tri(ctx, lx - 13, ly + 9, lx + 13, ly + 3, lx - 1, ly - 11, "#5a5e6e");        // Korpus
  tri(ctx, lx - 10, ly + 6, lx + 2, ly + 1, lx - 4, ly - 6, "#8a90a2");          // Metall-Glanz oben-links
  rect(ctx, lx - 14, ly + 9, 30, 3, "#33363f"); rect(ctx, lx - 14, ly + 9, 30, 1, "#6a6e80"); // Öffnungsrand
  rect(ctx, lx - 2, ly + 8, 4, 3, "#9a9aa6"); rect(ctx, lx - 2, ly + 9, 4, 1, "#5a5a66");      // Fassung/Gewinde
  // Glasbirne (größer, realistischer)
  const pulse = 0.82 + 0.18 * Math.sin(t / 280), by = ly + 14;
  const glass = red ? "#ff5a1e" : "#dfeafc", core = red ? "#ffd28a" : "#ffffff";
  pe(ctx, lx, by, 5, 5.4, "#2a2e3a");                            // Glas-Kontur
  pe(ctx, lx, by, 4.4, 4.8, glass);                             // Glaskolben
  pe(ctx, lx, by, 2.4, 2.6, core);                              // heller Kern (Wärme/Filament)
  rect(ctx, lx - 2, by - 3, 1, 2, "#ffffff");                   // Glas-Reflex
  pe(ctx, lx, by, 1, 1, "#fff7d8");                             // Filament-Punkt
  // Lichtkegel + Glow auf die Birnenmitte
  const cone = red ? "255,140,60" : "210,228,255";
  ctx.fillStyle = `rgba(${cone},${0.13 * pulse})`;
  ctx.beginPath(); ctx.moveTo(lx - 7, by + 4); ctx.lineTo(lx + 9, by + 2); ctx.lineTo(126, FLOOR); ctx.lineTo(56, FLOOR); ctx.closePath(); ctx.fill();
  const gl = ctx.createRadialGradient(lx, by, 4, lx, by, 92);
  gl.addColorStop(0, `rgba(${cone},${0.22 * pulse})`); gl.addColorStop(1, `rgba(${cone},0)`);
  ctx.fillStyle = gl; ctx.fillRect(0, 0, CW, CH);
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
function drawRoom(ctx, t, stage) {
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
  drawHeatLamp(ctx, t, stage);
  drawLabBox(ctx, t);
  rect(ctx, CW - 27, FLOOR - 10, 8, 7, "#9aa0b0"); rect(ctx, CW - 26, FLOOR - 9, 6, 5, "#c6cad4"); // Steckdose
  rect(ctx, CW - 24, FLOOR - 8, 1, 2, "#5a6070"); rect(ctx, CW - 22, FLOOR - 8, 1, 2, "#5a6070");
  const vg = ctx.createRadialGradient(CW / 2, FLOOR - 16, 80, CW / 2, FLOOR - 16, 150);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(40,46,70,0.12)");   // nur sehr dezente Vignette
  ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
}
// Strom AUS: ganzer Bildschirm schwarz, nur die Augen glimmen & blinzeln
function drawPowerOff(ctx, S, t) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CW, CH);
  const P = EGG_PAL[S.stage]; if (!P.eyes) return;                         // Ur-Ei hat noch keine Augen -> komplett dunkel
  const cx = 92, floorY = FLOOR - 1, eb = S.stage < 2 ? floorY - 12 : floorY, breath = Math.sin(t / 900) * 0.4;
  // frühe Stufen leuchten NICHT -> nur im Dunkeln sichtbar; rissig/kosmisch glimmen
  drawEyes(ctx, cx, eb - (P.rb + P.ht * 0.34) + breath, t, P, S.stage === 5 ? "glow" : "dark");
}

/* ---------- Nest ---------- */
function drawNestBack(ctx, cx, fy) {
  pe(ctx, cx, fy + 5, 36, 7, PAL.shadow);
  pe(ctx, cx, fy - 1, 34, 13, PAL.nestDk); pe(ctx, cx, fy - 3, 32, 11, PAL.nest);
  for (let i = 0; i <= 14; i++) { const ang = Math.PI + (i / 14) * Math.PI, ex = cx + Math.cos(ang) * 31, ey = fy - 3 + Math.sin(ang) * 9; rect(ctx, ex - 2, ey - 2, 4, 2, i % 2 ? PAL.straw1 : PAL.straw2); }
  pe(ctx, cx, fy - 5, 21, 7, PAL.nestHollow);
}
function drawNestFront(ctx, cx, fy) {
  for (let i = 0; i < 11; i++) { const ex = cx - 28 + i * 6, ey = fy + 1 + (i % 2) * 2; rect(ctx, ex, ey, 5, 2, i % 2 ? PAL.straw2 : PAL.straw1); }
  pe(ctx, cx, fy + 7, 31, 5, "#3a2412");
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
  pe(ctx, hx, hy, 6.5, 6, o);                                     // große runde Handfläche (Mickey-Handschuh)
  pe(ctx, hx, hy - 0.6, 5.4, 5, f);
  const up = 3 - Math.round(grab * 0.4);                          // Finger krümmen sich beim Greifen
  for (const k of [-1, 0, 1]) {                                   // 3 dicke Finger oben
    const fx = hx + k * 3.4, ft = hy - 5;
    pe(ctx, fx, ft, 2, 2.6 + up * 0.3, o);
    pe(ctx, fx, ft, 1.4, 2 + up * 0.3, f);
  }
  pe(ctx, hx - sign * 5.5, hy + 1, 2.4, 2.8, o);                  // Daumen seitlich (innen)
  pe(ctx, hx - sign * 5.5, hy + 1, 1.7, 2.1, f);
  rect(ctx, hx - 4, hy + 3, 8, 1, o);                            // Handschuh-Naht
  rect(ctx, hx - 3, hy - 2, 2, 1, hl);                           // Glanz
}
function drawFeet(ctx, cx, eb, floorY, t, P, face, idleAct) {
  const walking = Math.abs(face) > 0.15, spread = Math.round(P.rb * 0.34), dir = Math.sign(face) || 1;
  for (const sign of [-1, 1]) {
    let footX, soleY, hx;
    if (walking) {
      const ph = Math.sin(t / 165 + (sign > 0 ? 0 : Math.PI));
      footX = cx + face * (ph * 8) + sign * 2;
      soleY = floorY - Math.max(0, ph) * 3;
      hx = cx + sign * Math.round(spread * 0.5);
    } else {
      footX = cx + sign * (spread + 4); hx = cx + sign * spread;
      if (idleAct === "tap" && sign > 0) soleY = floorY - Math.max(0, Math.sin(t / 80)) * 2.5;
      else { const bob = Math.sin(t / 240); soleY = floorY - (sign < 0 ? (bob > 0 ? 1 : 0) : (bob < 0 ? 1 : 0)); }
    }
    brokenHole(ctx, hx, eb - 3, 4, P, sign < 0 ? 31 : 32, false);
    limbSeg(ctx, hx, eb - 2, footX, soleY - 5, 4, LIMB.armDk, LIMB.arm);
    drawFoot(ctx, footX, soleY, walking ? dir : sign);
  }
}
function drawArms(ctx, cx, armY, t, P, skip, face) {
  const grab = Math.round(Math.sin(t / 300) * 2 + 2), shoulder = Math.round(P.rb * 0.86), swing = Math.abs(face || 0) > 0.15;
  for (const sign of [-1, 1]) {
    if (sign === skip) continue;
    const sx = cx + sign * shoulder, sy = armY;
    brokenHole(ctx, sx, sy, 4, P, sign < 0 ? 21 : 22, false);
    const sw = swing ? Math.sin(t / 165 + (sign > 0 ? Math.PI : 0)) * 3 : 0;     // Arme schwingen gegen die Beine
    const hx = sx + sign * 7, hy = sy + 6 + grab + sw;
    limbSeg(ctx, sx, sy, hx, hy - 2, 4, LIMB.armDk, LIMB.arm);
    drawHand(ctx, hx, hy, sign, grab);
  }
}
function drawTentacles(ctx, cx, eb, t, P) {
  const topY = eb - (P.ht + P.rb);                                 // ganz oben am Ei
  brokenHole(ctx, cx, topY + 4, 6, P, 41, false);                  // kleines Bruchloch oben
  const cols = ["#6a86c8", "#7a96d6", "#6a86c8"], tip = ["#9eb8ec", "#aec4f0", "#9eb8ec"], base = [-4, 1, 5];
  for (let h = 0; h < 3; h++) {
    let x = cx + base[h], y = topY + 1, ang = -Math.PI / 2 + base[h] * 0.04;
    for (let i = 0; i < 6; i++) {
      ang += Math.sin(t / 420 + h * 1.6 + i * 0.6) * 0.16;         // weiches, niedliches Wabern
      x += Math.cos(ang) * 2.4; y += Math.sin(ang) * 2.4;
      const w = 2.8 - i * 0.16;                                    // bleibt dick -> rund, nicht spitz
      pe(ctx, x, y, w + 0.7, w + 0.7, "#33406a"); pe(ctx, x - 0.4, y - 0.5, w, w, cols[h]);
    }
    pe(ctx, x, y, 3.2, 3.2, "#33406a"); pe(ctx, x - 0.4, y - 0.5, 2.5, 2.5, tip[h]);   // runder Knubbel-Kopf (niedlich)
    rect(ctx, x - 1, y - 1, 1, 1, "#e6eeff");                      // Glanzpunkt
  }
}
function drawShells(ctx, cx, floorY, n) {
  const spots = [[-36, 3], [-24, 7], [-10, 4], [12, 6], [26, 3], [37, 7], [-30, 9], [18, 9]];
  for (let i = 0; i < n && i < spots.length; i++) {
    const x = cx + spots[i][0], y = floorY + spots[i][1];
    pe(ctx, x, y, 4, 2.2, "#2a2014"); pe(ctx, x, y - 0.5, 3.2, 1.6, "#e3d3a0"); pe(ctx, x + 1, y + 0.3, 2, 1, "#bfa970"); rect(ctx, x - 2, y - 1, 1, 1, "#f2e8c4");
  }
}
function drawCracks(ctx, cx, baseY, t, integrity) {
  const topY = baseY - (EGG_PAL[4].ht + EGG_PAL[4].rb), cy = topY + 26;
  const pulse = 0.5 + 0.45 * Math.sin(t / 260), dmg = 1 - integrity / 100;
  ctx.save();
  ctx.globalAlpha = 0.5; pe(ctx, cx + 1, cy + 4, 11, 14, "#120e08"); ctx.globalAlpha = 1;   // Drachen-Schatten innen
  const eg = 0.35 + 0.5 * Math.abs(Math.sin(t / 200));
  ctx.globalAlpha = eg; rect(ctx, cx - 4, cy, 2, 2, "#ff7a1e"); rect(ctx, cx + 3, cy, 2, 2, "#ff7a1e"); ctx.globalAlpha = 1;
  ctx.restore();
  const seg = (a, b, al) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; ctx.fillStyle = `rgba(255,120,30,${0.5 * al})`; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); ctx.fillStyle = `rgba(255,240,180,${al})`; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); } };
  const al = pulse * (0.6 + dmg * 0.4);
  const lines = [[[cx - 2, cy - 16], [cx - 1, cy - 8], [cx - 4, cy - 2], [cx - 2, cy + 6]], [[cx + 3, cy - 14], [cx + 2, cy - 6], [cx + 5, cy + 1], [cx + 3, cy + 9]], [[cx - 1, cy + 2], [cx + 4, cy + 4]]];
  for (const L of lines) for (let i = 0; i < L.length - 1; i++) seg(L[i], L[i + 1], al);
  const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
  gl.addColorStop(0, `rgba(255,150,50,${0.18 * pulse + dmg * 0.12})`); gl.addColorStop(1, "rgba(255,150,50,0)");
  ctx.fillStyle = gl; ctx.fillRect(cx - 30, cy - 30, 60, 60);
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
  else if (laser.st === "fire") { laser.st = "holster"; laser.until = t + 520; fly.st = "idle"; fly.until = t + 12000 + Math.random() * 9000; }
  else { laser.st = "none"; }
}
function updateFly(t, stage) {
  if (laser.st !== "none") { updateLaser(t); return; }
  if (fly.spawn) { fly.spawn = false; fly.st = "buzz"; fly.x = Math.random() < 0.5 ? -8 : CW + 8; fly.y = 16 + Math.random() * 46; fly.until = t + 9000 + Math.random() * 9000; newWP(t); }
  const f = fly;
  if (f.st === "idle") { if (t > f.until) { f.st = "buzz"; f.x = Math.random() < 0.5 ? -8 : CW + 8; f.y = 16 + Math.random() * 46; f.until = t + 9000 + Math.random() * 9000; newWP(t); } return; }
  if (f.st === "leave") { f.x += (f.tx - f.x) * 0.05; f.y += (f.ty - f.y) * 0.05; if (f.x < -12 || f.x > CW + 12) { f.st = "idle"; f.until = t + 9000 + Math.random() * 16000; } return; }
  if (f.st === "land") { if (t > f.landUntil) { f.st = "buzz"; newWP(t); } return; }
  f.x += (f.wx - f.x) * 0.06 + (Math.random() - 0.5) * 1.8;       // wuseln
  f.y += (f.wy - f.y) * 0.06 + (Math.random() - 0.5) * 1.8;
  if (Math.hypot(f.wx - f.x, f.wy - f.y) < 6 || t > f.wpUntil) {
    if (Math.random() < 0.22 && f.y < FLOOR - 50) { f.st = "land"; f.landUntil = t + 1400 + Math.random() * 2600; } else newWP(t);
  }
  if (stage === 5 && t > f.until - 5000 && Math.random() < 0.012) { laser.st = "draw"; laser.until = t + 600; return; } // Laser ziehen
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
/* ---------- Herumlaufen (ab Beinen): Ziel suchen, hinwatscheln, mal stehen bleiben ---------- */
let walk = { x: 92, tx: 92, until: 0, face: 0 };
function updateWalk(t, canWalk) {
  let target = 0;
  if (canWalk) {
    if (Math.abs(walk.x - walk.tx) < 1.5) {
      if (t > walk.until) {
        if (Math.random() < 0.45) walk.until = t + 1500 + Math.random() * 3500;          // kurz stehen (nach vorne schauen)
        else { walk.tx = 44 + Math.random() * (CW - 88); walk.until = t + 7000; }          // neues Ziel
      }
    } else { walk.x += Math.sign(walk.tx - walk.x) * 0.5; target = Math.sign(walk.tx - walk.x); }
  }
  walk.face += (target - walk.face) * 0.16;                                                  // sanft zur Seite drehen / zurück nach vorne
}
/* ---------- Leerlauf-Gesten: nervöses Fußwippen / auf imaginäre Uhr schauen ---------- */
let idle = { act: "none", until: 0, next: 4000 };
function updateIdle(t, canIdle, hasArms) {
  if (!canIdle) { idle.act = "none"; return; }
  if (idle.act === "none") {
    if (t > idle.next) {
      const opts = hasArms ? ["tap", "watch", "tap"] : ["tap"];   // Uhr erst ab Armen
      idle.act = opts[Math.floor(Math.random() * opts.length)];
      idle.until = t + (idle.act === "watch" ? 2800 : 1600 + Math.random() * 1600);
    }
  } else if (t > idle.until) { idle.act = "none"; idle.next = t + 4000 + Math.random() * 7000; }
}
function drawWatchArm(ctx, sx, sy, sign, P, t) {
  const wx = sx - sign * 12, wy = sy - 3;                          // Handgelenk vor die Brust, leicht angehoben
  limbSeg(ctx, sx, sy, wx, wy, 4, LIMB.armDk, LIMB.arm);
  rect(ctx, wx + sign - 2, wy - 2, 4, 4, "#2a2e3a");              // Uhr-Gehäuse
  rect(ctx, wx + sign - 1, wy - 1, 2, 2, "#cfe6ff");             // Zifferblatt
  rect(ctx, Math.round(wx + sign), Math.round(wy - 1 + Math.sin(t / 500)), 1, 1, "#2a2e3a"); // Zeiger
  drawHand(ctx, wx, wy, -sign, 2);
}
/* ---------- Expedition: Portal, wenn das Ei unterwegs ist ---------- */
function drawPortal(ctx, cx, floorY, t) {
  const cy = floorY - 24;
  for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.10 * i; pe(ctx, cx, cy, 12 + i * 2, 22 + i * 2, "#6a4dd0"); }
  ctx.globalAlpha = 1;
  pe(ctx, cx, cy, 13, 24, "#3a2470");                       // Rand
  pe(ctx, cx, cy, 11, 21, "#1a0f38");                       // dunkler Schlund
  for (let r = 0; r < 4; r++) {                              // wirbelnde Lichtpunkte
    const a = t / 280 + r * 1.7, rr = 1 - r * 0.22;
    pe(ctx, cx + Math.cos(a) * 6 * rr, cy + Math.sin(a) * 12 * rr, 2, 2, r % 2 ? "#bfa8ff" : "#7fe9ff");
  }
  for (let k = 0; k < 5; k++) { const ph = (t / 650 + k * 0.7) % 1; ctx.globalAlpha = 1 - ph; rect(ctx, Math.round(cx - 8 + (k * 5 % 16)), Math.round(cy - ph * 30), 1, 1, "#dfe9ff"); }
  ctx.globalAlpha = 1;
}
function drawEgg(ctx, S, t) {
  const floorY = FLOOR - 1, P = EGG_PAL[S.stage], lit = S.power > 0;
  if (S.expActive) { drawPortal(ctx, 92, floorY, t); return; }   // Ei ist auf Expedition
  const onStand = S.stage < 2;                                  // Stufen 1-2: Halterung, ab Stufe 3 eigene Beine
  const eb = onStand ? floorY - 12 : floorY - 11;  // angehoben für Beine + große Füße
  updateFly(t, S.stage);
  const flyActive = fly.st !== "idle", watching = flyActive && S.stage >= 1;   // ab Stufe 2 innehalten & verfolgen
  const lasering = S.stage === 5 && laser.st !== "none";
  updateWalk(t, !onStand && P.feet && !watching && !lasering);
  const cx = onStand ? 92 : Math.round(walk.x);
  updateIdle(t, !onStand && P.feet && Math.abs(walk.face) < 0.1 && !watching && !lasering, P.arms);                    // Ei-Unterkante
  if (lit) stageGlow(ctx, cx, eb - Math.round(P.rb + P.ht * 0.5), S.stage, t);
  if (onStand) drawStandBack(ctx, cx, floorY, eb);
  else drawDragonShadow(ctx, [{ x: cx - Math.round(P.rb * 0.30) - 3, r: 6 }, { x: cx + Math.round(P.rb * 0.30) + 3, r: 6 }], cx, 16, floorY);
  ensureEgg(S.stage);
  const spr = EGG[S.stage];
  const face = walk.face, walking = !onStand && P.feet && Math.abs(face) > 0.15;   // zur Seite gedreht = gehen
  const breath = Math.sin(t / 700) * 0.5, sway = 0, rot = face * 0.06;             // Neigung in Laufrichtung
  const eyeY = eb - (P.rb + P.ht * 0.34) + breath;
  ctx.save();
  ctx.translate(cx + sway, eb + breath); ctx.rotate(rot);
  ctx.drawImage(spr.open, -EGG_CX, -BUF_BASE);
  ctx.restore();
  const armY = eb - Math.round((P.ht + P.rb) * 0.5);   // breiteste Stelle -> Arme kommen seitlich raus
  if (P.feet && !onStand) drawFeet(ctx, cx, eb, floorY, t, P, face, idle.act);
  if (P.arms) {
    const flySide = fly.x < cx ? -1 : 1;
    const shooing = watching && (S.stage === 3 || S.stage === 4) && (t % 2600) > 2100;
    drawArms(ctx, cx, armY, t, P, (lasering || shooing) ? flySide : 0, face);   // Fliegen-Seite aussparen -> keine dritte Hand
    const ssx = cx + sway + flySide * Math.round(P.rb * 0.86), ssy = armY;
    if (lasering) drawGun(ctx, ssx, ssy, fly.x, fly.y, laser.st, flySide, t);
    else if (shooing) drawShoo(ctx, ssx, ssy, fly.x, fly.y, flySide);
  }
  if (P.eyes) {
    const track = watching ? { x: fly.x, y: fly.y } : (idle.act === "watch" ? { x: cx, y: armY - 2 } : (walking ? { x: cx + face * 50, y: eyeY } : null));
    drawEyes(ctx, cx + face * Math.round(P.rb * 0.4), eyeY, t, P, S.stage === 5 ? "glow" : "lit", track);  // Augen/Kopf drehen mit
  }
  if (S.stage === 5) drawCosmic(ctx, cx + sway, eb, t, lit);            // Stufe 6 bleibt kosmisch
  if (S.stage >= 4) drawTentacles(ctx, cx + sway, eb, t, P);            // Tentakel ab Stufe 5, bleiben in Stufe 6
  if (onStand) drawStandFront(ctx, cx, eb);
  if (S.shards > 0) drawShells(ctx, 92, floorY, S.shards);   // abgebrochene Schalenstücke liegen am Boden
  drawFly(ctx, t);
}

/* =======================================================================
   ÖKONOMIE
   ======================================================================= */
const EGG_XP = [0, 300, 1200, 3000, 6000, 10000];
const FEEL = ["leblos & geheimnisvoll", "es nimmt dich wahr", "watschelt durchs Nest", "greift nach der Welt", "etwas wächst heraus", "kosmische Entität"];
function clampI(v, a, b) { return Math.max(a, Math.min(b, v)); }
function stageForXp(xp) { let s = 0; for (let i = 0; i < 6; i++) if (xp >= EGG_XP[i]) s = i; return s; }
// gewichtete HomeHub-Aktionen (Aufwand/Seltenheit)
const ACTIONS = [
  { label: "Artikel abhaken", xp: 1 }, { label: "Ausgabe erfassen", xp: 3 }, { label: "Rezept anlegen", xp: 5 },
  { label: "Zähler eintragen", xp: 8 }, { label: "Vertrag prüfen", xp: 15 },
];


/* =======================================================================
   VANILLA HOMEHUB DRAGON INTEGRATION
   This file is loaded by index.html as a classic script.
   Required globals for HomeHub: DRAGON_DEFAULTS, dragon, loadDragon,
   saveDragon, rewardDragon, renderDragonCard.
   ======================================================================= */

const DRAGON_XP = EGG_XP;
const DRAGON_ACTION_XP = {
  expense: 3,
  shopping: 1,
  contractCreate: 15,
  contractUpdate: 5,
  meter: 8,
  recipe: 5,
  recipeCooked: 10,
  backup: 3,
  manual: 5,
  expedition: 0,
  clean: 2
};

var DRAGON_DEFAULTS = {
  stage: 0,
  xp: 0,
  power: 100,
  integrity: 100,
  shards: 0,
  expActive: false,
  expProgress: 0,
  expGoal: 5,
  stardust: 0,
  lastRewardAt: 0
};

var dragon = Object.assign({}, DRAGON_DEFAULTS);
var dragonToast = '';
var dragonToastUntil = 0;
var dragonCanvas = null;
var dragonCtx = null;
var dragonRaf = null;
var dragonLastDecay = 0;

function dragonClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dragonLoadStorage() {
  try {
    const raw = localStorage.getItem('vh_dragon');
    if (!raw) return Object.assign({}, DRAGON_DEFAULTS);
    return Object.assign({}, DRAGON_DEFAULTS, JSON.parse(raw) || {});
  } catch (e) {
    return Object.assign({}, DRAGON_DEFAULTS);
  }
}
function saveDragon() {
  try { localStorage.setItem('vh_dragon', JSON.stringify(dragon)); }
  catch (e) { console.warn('[HomeHub Dragon] Speichern fehlgeschlagen:', e); }
}
function dragonLoadData(data) {
  dragon = Object.assign({}, DRAGON_DEFAULTS, data && typeof data === 'object' ? data : {});
  dragon.stage = stageForXp(Number(dragon.xp || 0));
  dragon.power = dragonClamp(Number(dragon.power || 0), 0, 100);
  dragon.integrity = dragonClamp(Number(dragon.integrity || 100), 0, 100);
  dragon.expGoal = Number(dragon.expGoal || 5);
  dragon.expProgress = Number(dragon.expProgress || 0);
  dragon.stardust = Number(dragon.stardust || 0);
  saveDragon();
}
function dragonFlash(msg) {
  dragonToast = msg;
  dragonToastUntil = performance.now() + 1600;
  const el = document.getElementById('dragonToast');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function dragonAddXp(n, label) {
  const oldStage = dragon.stage;
  dragon.xp = Number(dragon.xp || 0) + Number(n || 0);
  dragon.power = dragonClamp(Number(dragon.power || 0) + 6, 0, 100);
  if (dragon.expActive) {
    dragon.expProgress = Number(dragon.expProgress || 0) + 1;
    if (dragon.expProgress >= Number(dragon.expGoal || 5)) {
      const bonus = 25 + dragon.stage * 20;
      const dust = 2 + dragon.stage;
      dragon.xp += bonus;
      dragon.stardust = Number(dragon.stardust || 0) + dust;
      dragon.expActive = false;
      dragon.expProgress = 0;
      dragonFlash('Expedition zurück: +' + bonus + ' XP / +' + dust + ' Sternenstaub');
    }
  }
  dragon.stage = stageForXp(dragon.xp);
  if (dragon.stage > oldStage) {
    dragon.shards = 5;
    dragonFlash(EGG_PAL[dragon.stage].name + ' erreicht');
  } else if (!dragonToast || performance.now() > dragonToastUntil) {
    dragonFlash(label + ': +' + n + ' XP');
  }
  dragon.lastRewardAt = Date.now();
  saveDragon();
  renderDragonStats();
}
function rewardDragon(type) {
  const xp = DRAGON_ACTION_XP[type] ?? DRAGON_ACTION_XP.manual;
  const labelMap = {
    expense: 'Ausgabe erfasst', shopping: 'Einkauf erledigt', contractCreate: 'Vertrag angelegt',
    contractUpdate: 'Vertrag aktualisiert', meter: 'Zähler erfasst', recipe: 'Rezept gespeichert',
    recipeCooked: 'Rezept gekocht', backup: 'Backup erstellt', manual: 'Drachenpflege'
  };
  dragonAddXp(xp, labelMap[type] || 'Aktion');
}
function startDragonExpedition() {
  if (dragon.stage < 2 || dragon.expActive || dragon.power <= 0) return;
  dragon.expActive = true;
  dragon.expProgress = 0;
  dragonFlash('Expedition gestartet');
  saveDragon();
  renderDragonStats();
}
function cleanDragonShells() {
  dragon.shards = 0;
  dragon.power = dragonClamp(Number(dragon.power || 0) + 8, 0, 100);
  dragonAddXp(DRAGON_ACTION_XP.clean, 'Schalenreste entfernt');
}
function chargeDragon() {
  dragon.power = 100;
  dragonFlash('Stromzelle geladen');
  saveDragon();
  renderDragonStats();
}
function dragonSetStage(delta) {
  const ns = dragonClamp(Number(dragon.stage || 0) + delta, 0, 5);
  dragon.stage = ns;
  dragon.xp = DRAGON_XP[ns];
  dragon.integrity = ns === 4 ? 100 : dragon.integrity;
  dragon.shards = 5;
  dragonFlash(EGG_PAL[ns].name);
  saveDragon();
  renderDragonStats();
}
function renderDragonStats() {
  const box = document.getElementById('dragonStats');
  if (!box) return;
  const next = dragon.stage < 5 ? DRAGON_XP[dragon.stage + 1] : null;
  const cur = DRAGON_XP[dragon.stage];
  const prog = next ? Math.round(((dragon.xp - cur) / (next - cur)) * 100) : 100;
  box.innerHTML = `
    <div class="dragon-status-row">
      <span class="dragon-name">${EGG_PAL[dragon.stage].name}</span>
      <span>Stufe ${dragon.stage + 1}/6</span>
    </div>
    <div class="dragon-feel">${FEEL[dragon.stage]}</div>
    <div class="dragon-bar-label">XP ${Number(dragon.xp || 0).toLocaleString('de-DE')}${next ? ' / ' + next.toLocaleString('de-DE') : ' · MAX'}</div>
    <div class="dragon-bar"><div style="width:${dragonClamp(prog, 0, 100)}%"></div></div>
    <div class="dragon-bar-label">Strom ${dragon.power > 0 ? dragon.power + '%' : 'AUS'}</div>
    <div class="dragon-bar"><div class="dragon-power" style="width:${dragonClamp(dragon.power, 0, 100)}%"></div></div>
    ${dragon.expActive ? `<div class="dragon-exp">Expedition: ${dragon.expProgress}/${dragon.expGoal} Aktionen</div>` : ''}
    ${dragon.stardust ? `<div class="dragon-exp">Sternenstaub: ${dragon.stardust}</div>` : ''}
  `;
}
function renderDragonCard() {
  const root = document.getElementById('dragonCard');
  if (!root) return;
  root.innerHTML = `
    <div class="dragon-head">
      <div>
        <div class="dragon-title">HomeHub Dragon</div>
        <div class="dragon-subtitle">Gamification · Aktionen sammeln XP</div>
      </div>
      <button class="dragon-mini-btn" id="dragonChargeBtn" type="button">Strom</button>
    </div>
    <div class="dragon-canvas-wrap">
      <canvas id="dragonCanvas" width="${CW}" height="${CH}"></canvas>
      <div class="dragon-toast" id="dragonToast" style="display:none"></div>
    </div>
    <div id="dragonStats"></div>
    ${dragon.shards > 0 ? '<button class="dragon-action dragon-clean" id="dragonCleanBtn" type="button">Schalenreste wegräumen</button>' : ''}
    <div class="dragon-actions">
      <button class="dragon-action" id="dragonPetBtn" type="button">Anstupsen</button>
      <button class="dragon-action" id="dragonExpBtn" type="button" ${dragon.stage < 2 || dragon.expActive || dragon.power <= 0 ? 'disabled' : ''}>Expedition</button>
      <button class="dragon-action" id="dragonFlyBtn" type="button">Fliege</button>
    </div>
  `;
  document.getElementById('dragonPetBtn')?.addEventListener('click', () => rewardDragon('manual'));
  document.getElementById('dragonChargeBtn')?.addEventListener('click', chargeDragon);
  document.getElementById('dragonExpBtn')?.addEventListener('click', startDragonExpedition);
  document.getElementById('dragonCleanBtn')?.addEventListener('click', cleanDragonShells);
  document.getElementById('dragonFlyBtn')?.addEventListener('click', () => { fly.spawn = true; laser.st = 'none'; });
  dragonCanvas = document.getElementById('dragonCanvas');
  dragonCtx = dragonCanvas ? dragonCanvas.getContext('2d') : null;
  if (dragonCtx) dragonCtx.imageSmoothingEnabled = false;
  renderDragonStats();
  startDragonLoop();
}
function startDragonLoop() {
  if (dragonRaf) cancelAnimationFrame(dragonRaf);
  const start = performance.now();
  const loop = (now) => {
    if (dragonCtx) {
      const t = now - start;
      if (!dragonLastDecay) dragonLastDecay = now;
      if (now - dragonLastDecay > 6000) {
        dragon.power = dragonClamp(Number(dragon.power || 0) - 1, 0, 100);
        if (dragon.stage === 4) dragon.integrity = dragonClamp(Number(dragon.integrity || 100) - 1, 0, 100);
        dragonLastDecay = now;
        saveDragon();
        renderDragonStats();
      }
      if (dragon.power > 0) { drawRoom(dragonCtx, t, dragon.stage); drawEgg(dragonCtx, dragon, t); }
      else { drawPowerOff(dragonCtx, dragon, t); }
      const toast = document.getElementById('dragonToast');
      if (toast) {
        if (dragonToast && now < dragonToastUntil) { toast.textContent = dragonToast; toast.style.display = 'block'; }
        else { toast.style.display = 'none'; }
      }
    }
    dragonRaf = requestAnimationFrame(loop);
  };
  dragonRaf = requestAnimationFrame(loop);
}

dragon = dragonLoadStorage();
if (typeof window !== 'undefined') {
  window.DRAGON_DEFAULTS = DRAGON_DEFAULTS;
  window.dragon = dragon;
  window.loadDragon = function(data) { dragonLoadData(data); window.dragon = dragon; };
  window.saveDragon = saveDragon;
  window.rewardDragon = rewardDragon;
  window.renderDragonCard = renderDragonCard;
  window.dragonSetStage = dragonSetStage;
}
