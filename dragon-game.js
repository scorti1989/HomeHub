/* =========================================================================
   dragon-game.js — HomeHub EI-EVOLUTION (ersetzt den Drachen)
   Vanilla JS · Kontrakt: window.DRAGON_DEFAULTS, dragon, saveDragon(),
   loadDragon(d), rewardDragon(action), renderDragonCard()
   Speicher: localStorage 'vh_dragon' · Backup-Marker: dragon.egg === true
   Alte Drachen-Backups werden erkannt und starten das Ei frisch bei 0.
   ========================================================================= */

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
function drawEyes(ctx, cx, ey, t, P, mode, track, prof, sick) {
  const sep0 = Math.round(P.rb * 0.30), R0 = Math.max(4, Math.round(P.rb * 0.24)), shell = mode !== "dark";
  const pd = prof ? Math.sign(prof) : 0, pm = prof ? Math.min(1, Math.abs(prof)) : 0;
  let dx2, dy2, blink;
  if (track) {                                                    // Fliege mit den Augen verfolgen
    const a = Math.atan2(track.y - ey, track.x - cx), m = Math.min(1, Math.hypot(track.x - cx, track.y - ey) / 24);
    dx2 = Math.cos(a) * (R0 - 1.5) * m; dy2 = Math.sin(a) * (R0 - 1.5) * m; blink = (t % 6000) > 5900;
  } else { const G = gaze(t); dx2 = G.dx * (R0 / 4); dy2 = G.dy * (R0 / 4); blink = G.blink; }
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
  ctx.font = '8px "Press Start 2P", monospace';
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
  if (pw >= 99.5) return;                                                          // nur bei ganz vollem Akku hell
  let dim = Math.min(0.86, (100 - pw) / 100 * 0.86);                               // dunkelt ab dem ersten Prozent stetig ab
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
  const P = EGG_PAL[S.stage]; if (!P.eyes) return;                         // Ur-Ei hat noch keine Augen -> komplett dunkel
  const cx = 92, floorY = FLOOR - 1, eb = S.stage < 2 ? floorY - 12 : floorY, breath = Math.sin(t / 900) * 0.4;
  // frühe Stufen leuchten NICHT -> nur im Dunkeln sichtbar; rissig/kosmisch glimmen
  drawEyes(ctx, cx, eb - (P.rb + P.ht * 0.34) + breath, t, P, S.stage === 5 ? "glow" : "dark");
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
  if (f.st === "leave") { f.x += (f.tx - f.x) * 0.05; f.y += (f.ty - f.y) * 0.05; if (f.x < -12 || f.x > CW + 12) { f.st = "idle"; f.until = t + 9000 + Math.random() * 16000; } return; }
  if (f.st === "land") { if (t > f.landUntil) { f.st = "buzz"; newWP(t); } return; }
  f.x += (f.wx - f.x) * 0.06 + (Math.random() - 0.5) * 1.8;       // wuseln
  f.y += (f.wy - f.y) * 0.06 + (Math.random() - 0.5) * 1.8;
  if (Math.hypot(f.wx - f.x, f.wy - f.y) < 6 || t > f.wpUntil) {
    if (Math.random() < 0.15 && f.y < FLOOR - 50) { f.st = "land"; f.landUntil = t + 1400 + Math.random() * 2600; } else newWP(t);
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
/* ---------- Rollen/Hüpfen (Stufen 1-2): Ei hüpft vom Ständer, rollt, hüpft zurück ---------- */
let roll = { phase: "idle", startT: 0, nextT: 10000 };
function updateRoll(t, canRoll) {
  if (!canRoll) { roll.phase = "idle"; return; }
  if (roll.phase !== "idle") {
    const dur = roll.phase === "hop" ? 700 : 2200;
    if (t - roll.startT > dur) { roll.phase = "idle"; roll.nextT = t + 9000 + Math.random() * 12000; }
    return;
  }
  if (t > roll.nextT && Math.random() < 0.003) {
    roll.phase = Math.random() < 0.38 ? "hop" : "wobble";
    roll.startT = t;
  }
}

/* ---------- Herumlaufen (ab Beinen): Ziel suchen, hinwatscheln, mal stehen bleiben ---------- */
let walk = { x: 92, tx: 92, until: 0, face: 0 };
let expAnim = { st: "in" };   // in | leaving | away | returning
let prestigeAnim = { st: "none", startT: 0 };   // none | walk | suck | flash | wait
function updateWalk(t, canWalk) {
  let target = 0;
  if (canWalk) {
    if (Math.abs(walk.x - walk.tx) < 1.5) {
      if (t > walk.until) {
        if (Math.random() < 0.45) walk.until = t + 1500 + Math.random() * 3500;          // kurz stehen (nach vorne schauen)
        else { walk.tx = 44 + Math.random() * (CW - 88); walk.until = t + 7000; }          // neues Ziel
      }
    } else {
      const hp = (t % 520) / 520;                                     // Hop-Zyklus: 72% Flug, 28% Boden
      if (hp < 0.72) walk.x += Math.sign(walk.tx - walk.x) * 0.66;    // bewegt sich nur im Flug
      target = Math.sign(walk.tx - walk.x);
    }
  }
  walk.face += (target - walk.face) * 0.16;                                                  // sanft zur Seite drehen / zurück nach vorne
}
/* ---------- Leerlauf-Gesten: nervöses Fußwippen / auf imaginäre Uhr schauen ---------- */
let idle = { act: "none", until: 0, next: 4000, toy: null, startT: 0 };
function updateIdle(t, canIdle, hasArms, toys) {
  if (!canIdle) { idle.act = "none"; return; }
  if (idle.act === "none") {
    if (t > idle.next) {
      const opts = ["tap", "tap", "wobble"];
      if (hasArms) opts.push("watch");
      if (hasArms && toys && toys.length) { opts.push("play"); opts.push("play"); }
      idle.act = opts[Math.floor(Math.random() * opts.length)];
      if (idle.act === "play") idle.toy = toys[Math.floor(Math.random() * toys.length)];
      idle.startT = t;
      idle.until = t + (idle.act === "watch" ? 2800 : idle.act === "play" ? (idle.toy === "top" ? 9500 : idle.toy === "balloon" ? 5400 : 3600 + Math.random() * 2000) : idle.act === "wobble" ? 4200 : 1600 + Math.random() * 1600);
    }
  } else if (t > idle.until) { idle.act = "none"; idle.next = t + 3000 + Math.random() * 7000; }
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
  const phase = ((t - ball.startT) % BALL_CYCLE) / BALL_CYCLE;
  return ball.armY + (ball.floorY - ball.armY - 5) * Math.abs(Math.sin(phase * Math.PI));
}
function updateBall(t, armX, armY, floorY) {
  const should = idle.act === "play" && idle.toy === "ball";
  if (!should || t - idle.startT < 780 || idle.until - t < 560) { ball.active = false; if (!should) ball.done = false; return; }
  if (!ball.active) {
    ball.active = true; ball.startT = t; ball.done = false;
    ball.bx = armX; ball.armX = armX; ball.armY = armY + 5; ball.floorY = floorY;   // dribbelt direkt unter der Hand
  }
  const totalBounces = Math.floor((t - ball.startT) / BALL_CYCLE);
  if (totalBounces >= ball.maxB && !ball.done) {
    ball.done = true; ball.active = false;
    idle.until = Math.min(idle.until, t + 560);                    // löst das Zurückstecken aus
  }
}
function drawBall(ctx, t) {
  if (!ball.active) return;
  const by = ballY(t), floorY = ball.floorY;
  const sh = Math.max(0, 0.5 * (1 - (floorY - by) / (floorY - ball.armY)));
  ctx.globalAlpha = sh * 0.6; pe(ctx, ball.bx, floorY - 2, Math.max(1, 4 - sh * 2), 1, "#000"); ctx.globalAlpha = 1;
  pe(ctx, ball.bx, by, 4.5, 4.5, "#b89018");
  pe(ctx, ball.bx, by, 3.5, 3.5, "#e8c030");
  rect(ctx, Math.round(ball.bx) - 1, Math.round(by) - 2, 2, 1, "#fffcc0");
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
    const hw = Math.round(P.rb * 0.92), hy = topY + Math.round(P.ht * 0.42);
    pe(ctx, cx, topY + 6, hw, Math.round(P.ht * 0.5), "#f2f2f0");    // Laken-Kapuze
    pe(ctx, cx - 2, topY + 4, hw * 0.8, Math.round(P.ht * 0.4), "#fbfbfa");
    for (let k = 0; k < 6; k++) {                                    // Zackenrand
      const zx = Math.round(cx - hw + 2 + k * (hw * 2 - 4) / 5);
      tri(ctx, zx - 2, hy, zx + 2, hy, zx, hy + 4, "#f2f2f0");
    }
    rect(ctx, Math.round(cx) - 5, topY + 8, 2, 3, "#2a2430");        // Gucklöcher
    rect(ctx, Math.round(cx) + 3, topY + 8, 2, 3, "#2a2430");
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
    if (b.r < 4) b.r += 0.06;                                     // wächst am Ring
    else { b.y -= 0.28; b.x += Math.sin(t / 300 + b.drift) * 0.25; }   // steigt & wobbelt
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
      pe(ctx, dwx + sign * 4, dwy - 3, 4.5, 4.5, "#b89018");
      pe(ctx, dwx + sign * 4, dwy - 4, 3.5, 3.5, "#e8c030");
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
      tx0 += sign * Math.round(Math.pow(w, 1.3) * 16) + Math.round(Math.sin(el / 260) * 6);   // driftet beschleunigend + Zickzack
      tilt = Math.sin(t / 130) * 0.12;
      if (tx0 < -14 || tx0 > CW + 14) { idle.act = "none"; idle.next = t + 5000; return; }    // aus dem Bild -> Geste endet
    }
    topPos = { x: tx0, y: topY - 6 };
    ctx.save();
    ctx.translate(tx0, topY); ctx.rotate(tilt); ctx.translate(-tx0, -topY);
    const c1 = spinFast ? (Math.floor(t / 55) % 2 ? "#e04040" : "#f0c030") : "#e04040";
    const c2 = spinFast ? (Math.floor(t / 55) % 2 ? "#f0c030" : "#e04040") : "#f0c030";
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
    const spr = EGG[S.stage].open;
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
  return { x: cx - 22, y: armY - 4 };
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
  const prog = Math.max(0, Math.min(1, (S.xp || 0) / 1200));         // Silhouette wächst mit (verstecktem) Fortschritt
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
const BROOD_FOOD = [
  { id: "spray", label: "💧 Besprühen",  cost: 1, hunger: 25, xp: 0, power: 0, desc: "Hält die Membran feucht" },
  { id: "broth", label: "🥣 Nährlösung", cost: 3, hunger: 60, xp: 2, power: 0, desc: "+2 XP" },
];
var knockAnim = { on: false, startT: 0 };
var candleAnim = { on: false, startT: 0 };
function drawEgg(ctx, S, t) {
  lastT = t;
  const floorY = FLOOR - 1, P = EGG_PAL[S.stage], lit = S.power > 0;
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
  const rollAngle = onStand && roll.phase === "wobble" ? Math.sin(rollEl / 145) * 0.09 * Math.max(0, 1 - rollEl / 2200) : 0;
  const eb = onStand ? floorY - 12 - Math.round(rollYOff) : floorY - 11;
  updateFly(t, S.stage);
  const flyActive = fly.st !== "idle", watching = flyActive && S.stage >= 1 ;
  const lasering = S.stage === 5 && laser.st !== "none";
  const expMoving = expAnim.st === "leaving" || expAnim.st === "returning" || prestigeAnim.st === "walk";
  updateWalk(t, (!onStand && P.feet && !watching && !lasering && idle.act !== "wobble") || expMoving);
  const cx = onStand ? 92 : Math.round(walk.x);
  const ownedToys = S.toys ? Object.keys(S.toys).filter(k => S.toys[k]) : [];
  updateIdle(t, !onStand && P.feet && Math.abs(walk.face) < 0.1 && !watching && !lasering , P.arms, ownedToys);
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
  const spr = EGG[S.stage];
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
  const rot = wobRot + knockRot;
  const ebDrop = wobbling ? Math.round((1 - limbK) * 10) : 0;           // Ei sinkt auf den Boden
  const eyeY = eb + ebDrop - (P.rb + P.ht * 0.34) + breath;
  const armY = eb + ebDrop - P.rb + 1 + Math.round(walkBob);
  ctx.save();
  ctx.translate(cx + sway, eb + ebDrop + breath);
  ctx.rotate(rot + rollAngle);
  ctx.scale(sqx * turnSq, sqy);
  ctx.drawImage(spr.open, -EGG_CX, -BUF_BASE);
  ctx.restore();
  const ebA = eb + ebDrop + Math.round(breath);
  const ovAng = rot + rollAngle, ovAy = eb + ebDrop + breath;
  const ovOn = Math.abs(ovAng) > 0.001;
  if (ovOn) { ctx.save(); ctx.translate(cx, ovAy); ctx.rotate(ovAng); ctx.translate(-cx, -ovAy); }   // Overlays rotieren mit der Schale
  drawShellCracks(ctx, cx, ebA - Math.round(P.ht + P.rb), P.ht, S.stage);
  if (S.stage === 4) drawBioSpots(ctx, cx, ebA, t, P, Math.min(1, Math.max(0, (S.xp - 6000) / 4000)));
  if (S.prestige > 0) drawPrestigeBadge(ctx, cx, ebA - Math.round(P.ht + P.rb) + 5, S.prestige);
  if (S.krank) {                                                     // kränklich-grüner Teint über der Schale
    const eCy2 = ebA - Math.round((P.ht + P.rb) / 2);
    ctx.globalAlpha = 0.20; pe(ctx, cx, eCy2, P.rb * 0.98, (P.ht + P.rb) / 2 * 0.98, "#78c858");
    ctx.globalAlpha = 0.16; pe(ctx, cx - P.rb * 0.3, eCy2 - 6, P.rb * 0.45, 8, "#58a840");
    pe(ctx, cx + P.rb * 0.35, eCy2 + 8, P.rb * 0.4, 7, "#58a840");
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
    const watching2 = idle.act === "watch", playing = idle.act === "play" && idle.toy, pSign = -1;
    const skip = (lasering || shooing) ? flySide : (watching2 ? 1 : (playing ? pSign : 0));
    drawArms(ctx, cx, armY, t, P, skip, 0);
    const ssx = cx + flySide * Math.round(P.rb * 0.86);
    if (lasering) drawGun(ctx, ssx, armY, fly.x, fly.y, laser.st, flySide, t);
    else if (shooing) drawShoo(ctx, ssx, armY, fly.x, fly.y, flySide);
    else if (watching2) drawWatchArm(ctx, cx + Math.round(P.rb * 0.86), armY, 1, P, t);
    else if (playing) drawPlayArm(ctx, cx + pSign * Math.round(P.rb * 0.86), armY, pSign, t, idle.toy, P);
  }
  if (idle.act === "play" && idle.toy === "ball") { const hx = cx - Math.round(P.rb * 0.86) - 7; updateBall(t, hx, armY + 13, floorY); drawBall(ctx, t); }
  if (P.eyes) {
    const track = watching ? { x: fly.x, y: fly.y } : (idle.act === "watch" ? { x: cx, y: armY - 2 } : (idle.act === "play" ? playTrackPoint(cx, armY, t) : null));
    let eyeDrawX = cx, eyeDrawY = eyeY;
    const bodyRot = rot + rollAngle;
    if (Math.abs(bodyRot) > 0.001) {                      // Augen-Loch rotiert mit der Schale (auch beim Gehen)
      const ecy = eb + ebDrop + breath, dx = eyeDrawX - cx, dy = eyeDrawY - ecy;
      const ca = Math.cos(bodyRot), sa = Math.sin(bodyRot);
      eyeDrawX = cx + ca * dx - sa * dy;
      eyeDrawY = ecy + sa * dx + ca * dy;
    }
    drawEyes(ctx, eyeDrawX, eyeDrawY, t, P, S.stage === 5 ? "glow" : "lit", track, 0, S.krank);
  }
  if (S.stage === 5) drawCosmic(ctx, cx + sway, eb, t, lit);            // Stufe 6 bleibt kosmisch
            // Tentakel ab Stufe 5, bleiben in Stufe 6
  if (onStand) drawStandFront(ctx, cx, floorY - 12);
  if (S.shards > 0) drawShells(ctx, 92, floorY, S.shards);   // abgebrochene Schalenstücke liegen am Boden
  drawFly(ctx, t);
  if (sprayAnim.on) {
    const sp = (t - sprayAnim.startT) / 1100;
    if (sp >= 1) sprayAnim.on = false;
    else {
      const topEgg = eb + ebDrop - Math.round(P.ht + P.rb);
      ctx.globalAlpha = Math.min(1, (1 - sp) * 1.4);
      for (let i = 0; i < 8; i++) {
        const dx3 = (i - 3.5) * 4 + Math.sin(i * 2.1 + t / 90) * 2;
        const dy3 = -10 + sp * (16 + (i % 3) * 5);
        rect(ctx, Math.round(cx + dx3), Math.round(topEgg + dy3), 1, 1, i % 2 ? "#bfe6ff" : "#8ecfef");
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
const EGG_XP = [0, 300, 1200, 3000, 6000, 10000];
const FEEL = ["leblos & geheimnisvoll", "es nimmt dich wahr", "watschelt durchs Nest", "greift nach der Welt", "etwas wächst heraus", "kosmische Entität"];
function clampI(v, a, b) { return Math.max(a, Math.min(b, v)); }
function stageForXp(xp) { let s = 0; for (let i = 0; i < 6; i++) if (xp >= EGG_XP[i]) s = i; return s; }
// gewichtete HomeHub-Aktionen (Aufwand/Seltenheit)
// Balancing (aus HomeHub-Backup 07/2026): ~70 Artikel, ~40 Ausgaben, ~3 Rezepte, ~2 Zähler, ~1.5 Verträge pro Monat
// Ziel: ~880 XP/Monat -> voller Zyklus (10.000 XP) in ~1 Jahr
const ACTIONS = [
  { label: "Artikel abhaken", xp: 1 }, { label: "Ausgabe erfassen", xp: 3 }, { label: "Rezept anlegen", xp: 10 },
  { label: "Zähler eintragen", xp: 25 }, { label: "Vertrag prüfen", xp: 40 },
];
const FOOD_ITEMS = [
  { id:"ei",     label:"🍳 Spiegelei",    cost:1, hunger:25, xp:0,  power:0,  desc:"Klassiker" },
  { id:"goldei", label:"🥚 Goldei",        cost:3, hunger:50, xp:2,  power:0,  desc:"+2 XP" },
  { id:"matsch", label:"🌟 Sternenmatsch", cost:5, hunger:80, xp:0,  power:25, desc:"+Strom" },
  { id:"torte",  label:"🍰 Ei-Torte",      cost:4, hunger:60, xp:3,  power:0,  desc:"+3 XP" },
];
const TOY_ITEMS = [
  { id:"ball",    label:"🎾 Ball",         cost:4,  xp:8,  cd:6*3600*1000,  desc:"+8 XP · 6h" },
  { id:"yoyo",    label:"🪀 Jo-Jo",        cost:6,  xp:14, cd:12*3600*1000, desc:"+14 XP · 12h" },
  { id:"bubbles", label:"🫧 Seifenblasen", cost:8,  xp:20, cd:24*3600*1000, desc:"+20 XP · 24h" },
  { id:"balloon", label:"🎈 Luftballon",   cost:10, xp:26, cd:36*3600*1000, desc:"+26 XP · 36h" },
  { id:"top",     label:"🌀 Brummkreisel", cost:12, xp:34, cd:48*3600*1000, desc:"+34 XP · 48h" },
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
const COSTUMES = [                                              // saisonale Kostüme — kosten XP, Minus erlaubt
  { id: "bunnyears", label: "🐰 Hasenohren",       cost: 150, months: [2, 3],    desc: "Wackeln beim Hüpfen" },
  { id: "strawhat",  label: "👒 Strohhut",         cost: 150, months: [5, 6, 7], desc: "Für die Sommersonne" },
  { id: "ghost",     label: "👻 Geisterkostüm",    cost: 150, months: [9],       desc: "Buuuh!" },
  { id: "santahat",  label: "🎅 Weihnachtsmütze",  cost: 150, months: [11], xmas: true, desc: "Mit Bommel" },
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
  if (!costumes) return null;
  const c = COSTUMES.find(c => costumes[c.id] && inSeason(c));
  return c ? c.id : null;
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
const KRANK_DEVOLVE_MS = 3 * 86400 * 1000;                       // 3 Tage krank -> eine Stufe zurück
function applyKrankDevolve(p, now) {
  if (!p.krank || !p.krankSeit) return p;
  let stage = p.stage, xp = p.xp, seit = p.krankSeit, hit = false;
  while (now - seit >= KRANK_DEVOLVE_MS && stage > 0) {
    stage -= 1; xp = EGG_XP[stage]; seit += KRANK_DEVOLVE_MS; hit = true;
  }
  if (!hit) return p;
  setTimeout(() => flash("💔 Zu lange krank — das Ei ist eine Stufe zurückgefallen!"), 60);
  return { ...p, stage, xp, krankSeit: seit };
}
const DECAY_PS = { power: 1/432, hunger: 1/3456, sauberkeit: 1/4320 };   // Strom 12h (!), Hunger ~4 Tage, Sauberkeit ~5 Tage


/* =========================================================================
   HOMEHUB-INTEGRATION (Vanilla) — Kontrakt wie dragon-game.js:
   window.DRAGON_DEFAULTS, var dragon, saveDragon(), loadDragon(d),
   rewardDragon(action), renderDragonCard()
   Speicher-Key: 'vh_dragon' · Marker: dragon.egg === true
   ========================================================================= */

const EGG_ACTIONS = {
  shopping:       { xp: 1,  label: "Artikel abhaken" },
  expense:        { xp: 3,  label: "Ausgabe erfassen" },
  recipe:         { xp: 10, label: "Rezept angelegt" },
  recipeCooked:   { xp: 10, label: "Rezept gekocht" },
  meter:          { xp: 25, label: "Zähler eingetragen" },
  contractCreate: { xp: 40, label: "Vertrag angelegt" },
  contractUpdate: { xp: 40, label: "Vertrag geprüft" },
  backup:         { xp: 5,  label: "Backup", daily: true },
};

window.DRAGON_DEFAULTS = {
  egg: true, stage: 0, xp: 0, power: 100, integrity: 100, shards: 0,
  expActive: false, expProgress: 0, expGoal: 12, stardust: 0, deko: {},
  hunger: 100, sauberkeit: 100, krank: false, krankSeit: 0, mess: [],
  toys: {}, toyCooldown: {}, streak: 0, lastLogin: 0, prestige: 0,
  statLog: { acts: 0, byAction: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 },
  lastReview: "", lastNudge: "", lastBackupReward: "", lastTurn: 0, lastKnock: "", costumes: {}, unlocked: {}, lastSeen: 0,
};
var dragon = JSON.parse(JSON.stringify(window.DRAGON_DEFAULTS));

var uiDirty = true;
function markDirty() { uiDirty = true; }

function saveDragon() {
  try { dragon.lastSeen = Date.now(); localStorage.setItem("vh_dragon", JSON.stringify(dragon)); } catch (_) {}
}

function migrateUnlocked(d) {
  const u = Object.assign({}, d.unlocked || {});
  for (const k of Object.keys(d.deko || {}))     if (d.deko[k])     u[k] = true;
  for (const k of Object.keys(d.toys || {}))     if (d.toys[k])     u[k] = true;
  for (const k of Object.keys(d.costumes || {})) if (d.costumes[k]) u[k] = true;
  return u;
}

function loadDragon(d) {
  const base = JSON.parse(JSON.stringify(window.DRAGON_DEFAULTS));
  if (d && typeof d === "object" && d.egg === true) {
    dragon = Object.assign(base, d);
    dragon.statLog  = Object.assign({ acts: 0, byAction: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 }, d.statLog || {});
    dragon.mess     = Array.isArray(d.mess) ? d.mess : [];
    dragon.deko     = d.deko || {}; dragon.toys = d.toys || {};
    dragon.costumes = d.costumes || {}; dragon.toyCooldown = d.toyCooldown || {};
    dragon.unlocked = migrateUnlocked(dragon);
  } else {
    dragon = base;                                    // altes Drachen-Format oder leer -> Neustart bei 0
  }
  eggCheckIn(); markDirty();   // eggCheckIn liest lastSeen und speichert am Ende selbst
}

/* ---------- Toast ---------- */
var flashTimer = 0;
function flash(msg) {
  const el = document.getElementById("eggToast");
  if (!el) return;
  el.textContent = msg; el.classList.add("on");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove("on"), 2600);
}

/* ---------- Kernlogik ---------- */
function eggAddXp(n, label) {
  const p = dragon;
  if (p.power <= 0) { flash("🔌 Kein Strom! Erst die Stromzelle laden."); return; }
  if (p.krank) {
    flash("🤒 Krank! Erst Medizin geben.");
    if (p.expActive) p.expProgress += 1;
    checkExpDone(); saveDragon(); markDirty(); return;
  }
  let xp = p.xp + n, stardust = p.stardust || 0, luckyDust = 0;
  if (Math.random() < 0.15) { luckyDust = 1; setTimeout(() => flash("✨ Glücksfund! +1 Protein"), 1400); }
  if (p.expActive) p.expProgress += 1;
  const L0 = p.statLog || { acts: 0, byAction: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 };
  L0.acts = (L0.acts || 0) + 1;
  L0.byAction = L0.byAction || {};
  L0.byAction[label] = (L0.byAction[label] || 0) + 1;
  p.statLog = L0;
  p.stardust = stardust + luckyDust;
  const newStage = Math.max(p.stage, stageForXp(xp));
  if (newStage > p.stage) {
    p.shards = 5;
    setTimeout(() => flash("🎉 Entwicklung! " + EGG_PAL[newStage].name), 500);
  }
  p.xp = xp; p.stage = newStage;
  flash("+" + n + " XP · " + label);
  checkExpDone(); saveDragon(); markDirty();
}

function checkExpDone() {
  const p = dragon;
  if (!p.expActive || p.expProgress < p.expGoal) return;
  const ds = 6 + p.stage, xpB = 15 + p.stage * 5, found = nextExpItem(p);
  p.stardust = (p.stardust || 0) + ds;
  p.xp += xpB; p.stage = Math.max(p.stage, stageForXp(p.xp));
  p.expActive = false; p.expProgress = 0;
  if (found) { p.unlocked = Object.assign({}, p.unlocked, { [found.id]: true }); }
  p.statLog = p.statLog || {}; p.statLog.exps = (p.statLog.exps || 0) + 1;
  setTimeout(() => flash(found ? "🎁 Mitbringsel: " + found.label + "! Jetzt im Shop · +" + xpB + " XP · +" + ds + " ✨" : "🎁 Expedition zurück! +" + xpB + " XP · +" + ds + " ✨"), 60);
}

function rewardDragon(action) {
  const a = EGG_ACTIONS[action];
  if (!a) return;
  if (a.daily) {
    const today = new Date().toDateString();
    if (dragon.lastBackupReward === today) return;
    dragon.lastBackupReward = today;
  }
  eggAddXp(a.xp, a.label);
}
window.rewardDragon = rewardDragon;
window.loadDragon = loadDragon;
window.saveDragon = saveDragon;


/* ---------- Brutphase (Stufe 1-2): Wenden, Anklopfen, Durchleuchten ---------- */
function eggTurn() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon, now = Date.now();
  if (p.stage >= 2) return;
  const cd = 6 * 3600 * 1000, left = (p.lastTurn || 0) + cd - now;
  if (left > 0) { flash("⏳ Schon gewendet — in " + Math.ceil(left / 3600000) + "h wieder."); return; }
  p.lastTurn = now;
  turnAnim = { on: true, startT: lastT };
  eggAddXp(2, "Ei gewendet");
}
function eggKnock() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  if (p.stage >= 2) return;
  const today = new Date().toDateString();
  if (p.lastKnock === today) { flash("Es hat heute schon zurückgeklopft! 👂"); return; }
  p.lastKnock = today;
  knockAnim = { on: true, startT: lastT + 450 };                      // klopft mit kleiner Verzögerung zurück
  if (Math.random() < 0.5) {
    p.stardust = (p.stardust || 0) + 1;
    setTimeout(() => flash("👂 Es klopft zurück … ✨ +1 Protein!"), 700);
  } else {
    setTimeout(() => flash("👂 … klopf, klopf — es lebt!"), 700);
  }
  eggAddXp(3, "Angeklopft");
}
function eggCandle() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  if (dragon.stage >= 2 || candleAnim.on) return;
  candleAnim = { on: true, startT: lastT };
  flash("🔦 Du hältst das Ei vor die Lampe …");
}
function eggNudge() {
  const today = new Date().toDateString();
  if (dragon.lastNudge === today) { flash("Schon angestupst heute! Morgen wieder 🥚"); return; }
  dragon.lastNudge = today;
  eggAddXp(5, "Anstupsen");
}

function eggFeed(id) {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon, item = FOOD_ITEMS.find(f => f.id === id) || BROOD_FOOD.find(f => f.id === id);
  if (!item) return;
  if ((p.stardust || 0) < item.cost) { flash("Zu wenig ✨!"); return; }
  if (p.krank) { flash("🤒 Krank — erst Medizin!"); return; }
  p.stardust -= item.cost;
  p.hunger = clampI(p.hunger + item.hunger, 0, 100);
  if (item.power) p.power = clampI(p.power + item.power, 0, 100);
  if (item.xp) { p.xp += item.xp; p.stage = Math.max(p.stage, stageForXp(p.xp)); }
  p.statLog = p.statLog || {}; p.statLog.feeds = (p.statLog.feeds || 0) + 1;
  if (item.id === "spray" || item.id === "broth") {
    sprayAnim = { on: true, startT: lastT };
    flash(item.id === "spray" ? "💧 Fein benebelt — die Schale glänzt!" : "🥣 Nährlösung — es gluckert zufrieden! +2 XP");
  } else {
    flash(item.label + " · lecker!" + (item.xp ? " +" + item.xp + " XP" : ""));
  }
  saveDragon(); markDirty();
}

function eggCharge() {
  const p = dragon;
  if (p.power >= 100) return;
  const cost = Math.max(1, Math.ceil((100 - p.power) / 50));
  if ((p.stardust || 0) < cost) {
    if (p.power <= 5) { p.power = 30; flash("⚡ Notstrom aktiviert — lädt auf 30%"); saveDragon(); markDirty(); return; }
    flash("Zu wenig ✨! Laden kostet " + cost + " ✨"); return;
  }
  p.power = 100; p.stardust -= cost;
  flash("🔋 Aufgeladen! (−" + cost + " ✨)");
  saveDragon(); markDirty();
}

function eggClean() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  p.statLog = p.statLog || {};
  if (p.mess.length > 0) {
    const cost = (p.stardust || 0) >= 1 ? 1 : 0;
    p.mess = p.mess.slice(1);
    p.sauberkeit = clampI(p.sauberkeit + 14, 0, 100);
    p.stardust = (p.stardust || 0) - cost;
    p.statLog.cleans = (p.statLog.cleans || 0) + 1;
    flash("🧹 Haufen entfernt" + (cost ? " (−1 ✨)" : "") + " — noch " + p.mess.length);
  } else if (p.sauberkeit < 100) {
    const cost = p.sauberkeit > 60 ? 1 : p.sauberkeit > 30 ? 2 : 3;
    if ((p.stardust || 0) < cost) { flash("Wischen kostet " + cost + " ✨"); return; }
    p.sauberkeit = 100; p.stardust -= cost;
    p.statLog.cleans = (p.statLog.cleans || 0) + 1;
    flash("🧼 Blitzblank! (−" + cost + " ✨)");
  }
  saveDragon(); markDirty();
}

function eggHeal() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  if (!p.krank) return;
  if ((p.stardust || 0) < 5) { flash("Zu wenig ✨ für Medizin! (5 ✨)"); return; }
  p.krank = false; p.krankSeit = 0; p.stardust -= 5;
  flash("💊 Medizin gegeben — Erholt!");
  saveDragon(); markDirty();
}

function eggFix() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  if (p.stage !== 4 || p.integrity >= 100) return;
  if ((p.stardust || 0) < 2) { flash("Zu wenig ✨! (2 ✨)"); return; }
  p.integrity = 100; p.stardust -= 2;
  flash("🩹 Schale geflickt!");
  saveDragon(); markDirty();
}

function eggCleanShells() {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  if (p.shards <= 0) return;
  p.shards = 0; p.power = clampI(p.power + 8, 0, 100); p.xp += 2;
  flash("🧹 Aufgeräumt! +2 XP");
  saveDragon(); markDirty();
}

function eggBuyDeko(id, cost) {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon;
  if ((p.stardust || 0) < cost || (p.deko && p.deko[id])) return;
  const it = SHOP_ITEMS.find(x => x.id === id) || SEASON_ITEMS.find(x => x.id === id) || WALL_ITEMS.find(x => x.id === id) || WALL_SEASON_ITEMS.find(x => x.id === id);
  p.stardust -= cost;
  p.deko = Object.assign({}, p.deko, { [id]: true });
  flash("✨ " + (it ? it.label : id) + " dekoriert!");
  saveDragon(); markDirty();
}

function eggBuyToy(id) {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon, toy = TOY_ITEMS.find(t => t.id === id);
  if (!toy || (p.toys && p.toys[id])) return;
  if ((p.stardust || 0) < toy.cost) { flash("Zu wenig ✨!"); return; }
  p.stardust -= toy.cost;
  p.toys = Object.assign({}, p.toys, { [id]: true });
  flash("🎁 " + toy.label + " gekauft!");
  saveDragon(); markDirty();
}

function eggBuyCostume(id) {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon, it = COSTUMES.find(x => x.id === id);
  if (!it || (p.costumes && p.costumes[id])) return;
  p.xp -= it.cost;                                     // Minus erlaubt, Stufe bleibt
  p.costumes = Object.assign({}, p.costumes, { [id]: true });
  flash("🎭 " + it.label + " gekauft!" + (p.xp < 0 ? " (XP im Minus — aufholen!)" : ""));
  saveDragon(); markDirty();
}

function eggPlay(id) {
  if (dragon.power <= 0) { flash("🔌 Alles dunkel — erst die Batterie laden!"); return; }
  const p = dragon, toy = TOY_ITEMS.find(t => t.id === id);
  if (!toy || !p.toys || !p.toys[id]) return;
  if (p.krank) { flash("🤒 Zu krank zum Spielen."); return; }
  if (p.stage < 3) { flash("🔒 Braucht Arme (Stufe 4)."); return; }
  const now = Date.now(), cd = (p.toyCooldown || {})[id] || 0;
  if (now < cd) { flash("⏳ " + toy.label + " braucht noch " + Math.ceil((cd - now) / 3600000) + "h Pause."); return; }
  p.xp += toy.xp; p.stage = Math.max(p.stage, stageForXp(p.xp));
  const ds = Math.random() < 0.3 ? 1 : 0;
  p.stardust = (p.stardust || 0) + ds;
  p.toyCooldown = Object.assign({}, p.toyCooldown, { [id]: now + toy.cd });
  p.statLog = p.statLog || {}; p.statLog.plays = (p.statLog.plays || 0) + 1;
  idle.act = "play"; idle.toy = id; idle.startT = lastT;
  idle.until = lastT + (id === "top" ? 9500 : id === "balloon" ? 5400 : 5000);
  ball.active = false; ball.done = false;
  flash("🎮 Gespielt! +" + toy.xp + " XP" + (ds ? " · +1 ✨" : ""));
  saveDragon(); markDirty();
}

function eggStartExp() {
  const p = dragon;
  if (p.stage < 2 || p.expActive || p.power <= 0) return;
  const goal = [0, 0, 12, 16, 20, 25][p.stage] || 12;
  p.expActive = true; p.expProgress = 0; p.expGoal = goal;
  flash("🚪 Expedition! Sammle " + goal + " Aktionen");
  saveDragon(); markDirty();
}

/* ---------- Rückblick ---------- */
function buildReview(p, n) {
  const L = p.statLog || {}, by = L.byAction || {};
  const lines = Object.entries(by).map(([k, v]) => "  • " + k + ": " + v + "×").join("\n");
  return "🥚 EI-RÜCKBLICK — Prestige " + n + "\n" + "=".repeat(34) +
    "\n\nDein Ei hat die volle Evolution durchlaufen!\n\n⭐ Gesamt-XP: " + p.xp +
    "\n🔥 Login-Streak: " + (p.streak || 0) + " Tage\n\n📋 HomeHub-Taten (" + (L.acts || 0) + " gesamt):\n" + (lines || "  –") +
    "\n\n🍳 Fütterungen: " + (L.feeds || 0) + "\n🎮 Spielrunden: " + (L.plays || 0) +
    "\n🚪 Expeditionen: " + (L.exps || 0) + "\n🧹 Reinigungen: " + (L.cleans || 0) +
    "\n✨ Protein übrig: " + (p.stardust || 0) + "\n\nWeiter geht's mit Ei Nr. " + (n + 1) + "! 🌀";
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

var prestigeConfirm = false;
function eggPrestige() {
  const p = dragon;
  if (p.xp < 10000 || prestigeAnim.st !== "none" || p.expActive) return;
  if (!prestigeConfirm) { prestigeConfirm = true; markDirty(); return; }
  prestigeConfirm = false;
  prestigeAnim = { st: "walk", startT: lastT };
  walk.tx = 40; walk.until = lastT + 30000; idle.act = "none";
  setTimeout(() => {
    const n = (dragon.prestige || 0) + 1, bonus = n * 10;
    const review = buildReview(dragon, n);
    Object.assign(dragon, {
      xp: 0, stage: 0, shards: 0, hunger: 100, sauberkeit: 100, krank: false, krankSeit: 0, mess: [],
      power: 100, integrity: 100, expActive: false, expProgress: 0, prestige: n,
      stardust: (dragon.stardust || 0) + bonus, lastReview: review,
      statLog: { acts: 0, byAction: {}, feeds: 0, plays: 0, exps: 0, cleans: 0 },
    });
    prestigeAnim = { st: "none", startT: 0 };
    walk.x = 92; walk.tx = 92; walk.face = 0;
    flash("🌀 PRESTIGE " + n + "! +" + bonus + " Protein · Rückblick bereit 📜");
    saveDragon(); markDirty();
  }, 5200);
  markDirty();
}

/* ---------- Check-in (Offline-Zeit) ---------- */
function eggCheckIn() {
  const p = dragon, now = Date.now();
  const last = p.lastSeen || now;
  const elapsed = Math.max(0, (now - last) / 1000);
  p.power = clampI(p.power - DECAY_PS.power * elapsed, 0, 100);
  p.hunger = clampI(p.hunger - DECAY_PS.hunger * elapsed, 0, 100);
  const altS = p.sauberkeit;
  p.sauberkeit = clampI(p.sauberkeit - DECAY_PS.sauberkeit * elapsed, 0, 100);
  const wasKrank = p.krank;
  p.krank = p.krank || ((p.sauberkeit <= 0 || p.hunger <= 0) && elapsed > 43200);
  p.krankSeit = p.krank ? (p.krankSeit || now) : 0;
  const mess = Array.isArray(p.mess) ? p.mess.slice() : [];
  const lost = altS - p.sauberkeit;
  const neu = Math.max(0, Math.min(6 - mess.length, Math.floor(lost / 10)));
  for (let i = 0; i < neu; i++) {
    const types = p.stage < 2 ? ["shell", "shell", "slime"] : p.sauberkeit < 20 ? ["poop", "slime", "poop"] : ["poop", "shell", "poop"];
    mess.push({ type: types[Math.floor(Math.random() * types.length)], x: 18 + Math.floor(Math.random() * 140), seed: Math.floor(Math.random() * 200) });
  }
  p.mess = mess;
  // Streak
  const today = new Date().toDateString();
  const lastDate = p.lastLogin ? new Date(p.lastLogin).toDateString() : "";
  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    p.streak = lastDate === yesterday ? (p.streak || 0) + 1 : 1;
    const starBonus = p.streak >= 7 ? 3 : 2, xpBonus = p.streak >= 7 ? 5 : 3;
    p.stardust = (p.stardust || 0) + starBonus;
    p.xp += xpBonus; p.stage = Math.max(p.stage, stageForXp(p.xp));
    p.lastLogin = now;
    if (p.streak > 1) setTimeout(() => flash("🔥 " + p.streak + "-Tage-Streak! +" + xpBonus + " XP · +" + starBonus + " ✨"), 900);
  }
  Object.assign(p, applyKrankDevolve(p, now));
  if (elapsed > 7200) setTimeout(() => flash("👋 Willkommen zurück!"), 400);
  saveDragon(); markDirty();
}

/* ---------- UI ---------- */
var eggCanvas = null, eggCtx = null, eggRafId = 0, eggStart = 0;

function esc(x) { return String(x).replace(/</g, "&lt;"); }

function eggStatusRow() {
  const p = dragon;
  const mini = (v, col) => '<span class="eg-mini"><span style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + col + '"></span></span>';
  return (p.stage < 2 ? "💧" : "🍖") + mini(p.hunger, p.hunger > 50 ? "#a0c840" : p.hunger > 25 ? "#e0a030" : "#e04040") +
    "🧼" + mini(p.sauberkeit, p.krank ? "#e04040" : "#5ad0b0") +
    '<span class="eg-chip" style="color:' + (p.streak > 0 ? "#ff9a30" : "#6a5a8a") + '">🔥' + (p.streak || 0) + "</span>" +
    '<span class="eg-chip" style="color:#bfa8ff">✨' + (p.stardust || 0) + "</span>";
}

function eggSections() {
  const p = dragon, un = p.unlocked || {};
  let h = "";
  // Status
  h += '<details class="eg-sec"><summary style="color:#ffcf6a">📊 Status</summary><div class="eg-pane">';
  h += '<div class="eg-row"><span style="color:#ffcf6a">' + esc(EGG_PAL[p.stage].name) + "</span>" +
       (p.prestige > 0 ? '<span class="eg-dim">Ei Nr. ' + (p.prestige + 1) + "</span>" : "") + "</div>";
  if (EGG_PAL[p.stage].motto) h += '<div class="eg-dim" style="margin:3px 0 6px">„' + esc(EGG_PAL[p.stage].motto) + '"</div>';
  if (p.power <= 0) h += '<div style="color:#e0843a;font-size:7px;margin:5px 0">🔌 Licht erloschen — Stromzelle laden! (kein XP-Verlust)</div>';
  if (p.krank) h += '<div style="color:#ff4a4a;font-size:7px;margin:5px 0">KRANK — braucht Medizin! 💊 (3 Tage → Stufe zurück)</div>';
  if (p.stage === 4) h += '<div class="eg-dim" style="margin:5px 0 3px">Schalen-Integrität ' + p.integrity + '%</div>';
  if (p.lastReview) h += '<button class="eg-btn eg-wide" data-act="review">📜 Ei-Rückblick herunterladen</button>';
  if (p.xp >= 10000) h += '<button class="eg-btn eg-wide eg-gold" data-act="prestige">' + (prestigeConfirm ? "🌀 Wirklich? Nochmal tippen!" : "🌀 Durchs Portal (neues Ei)") + "</button>";
  h += '<button class="eg-btn eg-wide" data-act="nudge">👉 Anstupsen (+5 XP · 1×/Tag)</button>';
  if (p.stage < 2) {
    const tLeft = (p.lastTurn || 0) + 6 * 3600 * 1000 - Date.now();
    h += '<div class="eg-dim" style="margin:7px 0 4px">🥚 BRUTPFLEGE</div><div class="eg-grid2">';
    h += '<button class="eg-btn" data-act="turn"' + (tLeft > 0 ? " disabled" : "") + '>🔄 Wenden<br><small>' + (tLeft > 0 ? "in " + Math.ceil(tLeft / 3600000) + "h" : "+2 XP · 6h") + "</small></button>";
    h += '<button class="eg-btn" data-act="knock"' + (p.lastKnock === new Date().toDateString() ? " disabled" : "") + '>👆 Anklopfen<br><small>+3 XP · 1×/Tag</small></button>';
    h += '</div><button class="eg-btn eg-wide" data-act="candle">🔦 Durchleuchten<br><small>Was wächst da drin?</small></button>';
  }
  h += "</div></details>";
  // Pflege
  h += '<details class="eg-sec"><summary style="color:#5ad0b0">🍳 Pflege</summary><div class="eg-pane">';
  if (p.power <= 0) {
    h += '<div class="eg-dim" style="margin:2px 0 6px">🔌 Stromausfall — im Dunkeln geht nichts. Zuerst laden!</div>';
    h += '<button class="eg-btn eg-wide eg-gold" data-act="charge">🔋 Stromzelle (2✨)</button>';
    h += "</div></details>";
    return h;
  }
  if (p.shards > 0) h += '<button class="eg-btn eg-wide" data-act="shells">🧹 Schalenreste wegräumen (' + p.shards + ")</button>";
  h += '<div class="eg-grid2">';
  if (p.power < 100) h += '<button class="eg-btn" data-act="charge">🔋 Stromzelle (' + Math.max(1, Math.ceil((100 - p.power) / 50)) + "✨)</button>";
  if (p.mess.length > 0 || p.sauberkeit < 85)
    h += '<button class="eg-btn" data-act="clean">' + (p.mess.length > 0 ? "🧹 Haufen weg (" + p.mess.length + " da · 1✨)" : "🧼 Wischen (" + (p.sauberkeit > 60 ? 1 : p.sauberkeit > 30 ? 2 : 3) + "✨)") + "</button>";
  if (p.krank) h += '<button class="eg-btn" data-act="heal">💊 Medizin (5✨)</button>';
  if (p.stage === 4 && p.integrity < 100) h += '<button class="eg-btn" data-act="fix">🩹 Schale flicken (2✨)</button>';
  h += "</div>";
  if (p.stage < 2) {
    h += '<div class="eg-dim" style="margin:7px 0 4px">💧 VERSORGUNG</div><div class="eg-grid2">';
    for (const f of BROOD_FOOD) h += '<button class="eg-btn" data-act="feed" data-id="' + f.id + '">' + f.label + "<br><small>" + f.cost + "✨ · " + f.desc + "</small></button>";
  } else {
    h += '<div class="eg-dim" style="margin:7px 0 4px">🍽 FÜTTERN</div><div class="eg-grid4">';
    for (const f of FOOD_ITEMS) h += '<button class="eg-btn" data-act="feed" data-id="' + f.id + '">' + f.label.split(" ")[0] + "<br><small>" + f.cost + "✨</small></button>";
  }
  h += "</div></div></details>";
  // Shop & Expedition — existiert erst, wenn das Ei laufen kann (Überraschungsprinzip)
  if (p.stage >= 2) {
    h += '<details class="eg-sec"><summary style="color:#bfa8ff">🎮 Shop & Expedition</summary><div class="eg-pane">';
    if (p.expActive) h += '<div class="eg-dim">🚪 Unterwegs … ' + p.expProgress + "/" + p.expGoal + ' Aktionen<br><small>Es kehrt mit einem Fund zurück.</small></div>';
    else h += '<button class="eg-btn eg-wide" data-act="exp">🚪 Expedition starten</button>';
    const shopGrid = (items, act, ownedMap, ownTxt) => {
      let g = '<div class="eg-grid2">';
      for (const it of items) {
        const owned = ownedMap && ownedMap[it.id];
        g += '<button class="eg-btn' + (owned ? " eg-owned" : "") + '" data-act="' + act + '" data-id="' + it.id + '"' + (owned && act !== "playtoy" ? " disabled" : "") + ">" +
          it.label + "<br><small>" + (owned ? ownTxt : it.cost + (act === "costume" ? " XP" : " ✨")) + "</small></button>";
      }
      return g + "</div>";
    };
    const cat = (title, html2) => '<div class="eg-cat"><div class="eg-dim eg-cattitle">' + title + "</div>" + html2 + "</div>";
    const toysU = TOY_ITEMS.filter(t2 => un[t2.id]);
    const dekoU = SHOP_ITEMS.filter(it => un[it.id]);
    const seasU = SEASON_ITEMS.filter(it => inSeason(it) && un[it.id]);
    const cosU  = COSTUMES.filter(it => inSeason(it) && un[it.id]);
    const wallU = (p.prestige || 0) >= 1 ? [...WALL_ITEMS, ...WALL_SEASON_ITEMS.filter(inSeason)].filter(it => un[it.id]) : [];
    if (toysU.length) h += cat("🧸 SPIELZEUG", shopGrid(toysU, "toy", p.toys, "▶ Spielen"));
    if (dekoU.length) h += cat("🛍 DEKO", shopGrid(dekoU, "deko", p.deko, "✓"));
    if (seasU.length) h += cat("🗓 SAISON", shopGrid(seasU, "deko", p.deko, "✓"));
    if (cosU.length)  h += cat("🎭 KOSTÜME <small>· XP, Minus erlaubt</small>", shopGrid(cosU, "costume", p.costumes, "✓ getragen"));
    if (wallU.length) h += cat("🖼 WANDDEKO", shopGrid(wallU, "deko", p.deko, "✓ hängt"));
    if (!toysU.length && !dekoU.length && !seasU.length && !cosU.length && !wallU.length)
      h += '<div class="eg-dim" style="margin-top:7px"><small>🎒 Von Expeditionen bringt das Ei Funde mit …</small></div>';
    h += "</div></details>";
  }
  return h;
}

function updateEggUI() {
  const se = document.getElementById("eggSections");
  if (!se) return;
  const open = Array.from(se.querySelectorAll("details")).map(d => d.open);
  se.innerHTML = eggSections();
  se.querySelectorAll("details").forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
  uiDirty = false;
}

function eggHandleClick(e) {
  const b = e.target.closest("[data-act]");
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
  else if (act === "exp") eggStartExp();
  else if (act === "deko") { const it = SHOP_ITEMS.concat(SEASON_ITEMS, WALL_ITEMS, WALL_SEASON_ITEMS).find(x => x.id === id); if (it) eggBuyDeko(id, it.cost); }
  else if (act === "toy") { if (dragon.toys && dragon.toys[id]) eggPlay(id); else eggBuyToy(id); }
  else if (act === "costume") eggBuyCostume(id);
  else if (act === "review") eggDownloadReview();
  else if (act === "prestige") eggPrestige();
}

function renderDragonCard() {
  const card = document.getElementById("dragonCard");
  if (!card) return;
  card.innerHTML =
    '<div class="eg-head">HomeHub · <span style="color:#ffcf6a">EI-EVOLUTION</span></div>' +
    '<div class="eg-canvas-wrap"><canvas id="eggCanvas" width="180" height="156"></canvas><div id="eggToast" class="eg-toast"></div></div>' +
    '' +
    '<div id="eggSections"></div>';
  card.removeEventListener("click", eggHandleClick);
  card.addEventListener("click", eggHandleClick);
  eggCanvas = document.getElementById("eggCanvas");
  eggCtx = eggCanvas.getContext("2d");
  eggCtx.imageSmoothingEnabled = false;
  updateEggUI();
  if (!eggRafId) { eggStart = performance.now(); eggLoop(); }
}
window.renderDragonCard = renderDragonCard;

function eggLoop() {
  eggRafId = requestAnimationFrame(eggLoop);
  if (!eggCtx || document.hidden) return;
  if (!document.getElementById("eggCanvas")) { eggCanvas = null; eggCtx = null; return; }
  const t = performance.now() - eggStart;
  const St = dragon;
  eggCtx.clearRect(0, 0, CW, CH);
  if (St.power > 0) {
    drawRoom(eggCtx, t, St.stage, St.power);
    if (St.deko) drawDeko(eggCtx, t, St.deko, St.prestige || 0);
    if (St.mess && St.mess.length) drawMess(eggCtx, St.mess);
    if ((St.xp || 0) >= 10000) drawPrestigePortal(eggCtx, t);
    drawEgg(eggCtx, St, t);
    drawDim(eggCtx, St.power, t, St.deko);
    drawPowerTube(eggCtx, St.power, t);
    drawHud(eggCtx, St, t);
  } else {
    drawPowerOff(eggCtx, St, t);
    drawPowerTube(eggCtx, St.power, t);
    drawHud(eggCtx, St, t);
  }
  if (uiDirty) updateEggUI();
}

/* ---------- Intervalle & Lifecycle ---------- */
setInterval(() => {                                        // Strom: nach 12h komplett leer
  const p = dragon;
  p.power = clampI(p.power - 1, 0, 100);
  saveDragon(); markDirty();
}, 432000);
setInterval(() => {                                        // Hunger (~2,5 Tage)
  const p = dragon;
  p.hunger = clampI(p.hunger - 1, 0, 100);
  if (p.stage === 4) p.integrity = clampI(p.integrity - 1, 0, 100);
  const krank = p.krank || p.sauberkeit <= 0 || p.hunger <= 1;
  p.krankSeit = krank ? (p.krankSeit || Date.now()) : 0;
  p.krank = krank;
  Object.assign(p, applyKrankDevolve(p, Date.now()));
  saveDragon(); markDirty();
}, 3456000);
setInterval(() => {                                        // Sauberkeit (~4 Tage) + Dreck
  const p = dragon;
  p.sauberkeit = clampI(p.sauberkeit - 1, 0, 100);
  if (p.sauberkeit < 96 && p.mess.length < 6 && Math.random() < 0.6) {
    const types = p.stage < 2 ? ["shell", "shell", "slime"] : p.sauberkeit < 20 ? ["poop", "slime", "poop"] : ["poop", "shell", "shell"];
    p.mess = [...p.mess, { type: types[Math.floor(Math.random() * types.length)], x: 18 + Math.floor(Math.random() * 140), seed: Math.floor(Math.random() * 200) }];
  }
  saveDragon(); markDirty();
}, 4320000);
setInterval(saveDragon, 60000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveDragon();
  else { eggCheckIn(); }
});

/* ---------- Boot ---------- */
(function eggBoot() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("vh_dragon") || "null"); } catch (_) {}
  loadDragon(stored);
})();
