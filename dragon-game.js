/* =========================================================================
   dragon-game.js — HomeHub Drache
   -------------------------------------------------------------------------
   Tamagotchi-Modul: wachsender Pixel-Drache in einer Höhle, vollständig per
   Canvas gezeichnet (keine externen Bild-Assets). Integriert sich ohne jede
   Änderung an index.html über folgende globale Schnittstelle:

     window.dragon           // State-Objekt
     window.DRAGON_DEFAULTS  // Startwerte
     window.loadDragon(data) // gespeicherten State laden
     window.saveDragon()     // in localStorage 'vh_dragon' speichern
     window.rewardDragon(a)  // Belohnung bei App-Aktionen (XP + Glück)
     window.renderDragonCard()// Card in #dragonCard rendern + Animation starten

   index.html nutzt zusätzlich:
     - dragon = Object.assign({}, DRAGON_DEFAULTS) + saveDragon()  (Löschen)
     - dragon im Backup (Export)  /  loadDragon(data.dragon) (Import)
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     1) FARBPALETTE
     ======================================================================= */
  var PAL = {
    skyTop:"#2a1f44", skyMid:"#34264f", skyBot:"#120d1c",
    rock:"#3a2f4d", rockDark:"#251d33", rockLight:"#4e3f66",
    moss:"#4a6a38", mossLt:"#73a04d",
    ground:"#2a2236", groundLt:"#3c3049", groundEdge:"#1a1424",
    torchWood:"#5a3a22", torchDk:"#3a2414",
    flame1:"#fff0a8", flame2:"#ffb02a", flame3:"#ff5e1f", glow:"#ffb04d",
    body:"#5fb35b", bodyDk:"#3a8246", bodyLt:"#93dc81",
    belly:"#ecdca8", bellyDk:"#c9b784",
    wing:"#7a4fae", wingMem:"#a878d6", wingDk:"#553084",
    eyeW:"#ffffff", pupil:"#16121f",
    horn:"#ecdca8", hornDk:"#c9b784", spike:"#4070a0",
    claw:"#ecdca8", nostril:"#1a1320",
    egg:"#ead8b0", eggDk:"#cbb586", eggSpot:"#a6794a", eggSpot2:"#6f9a45",
    eggHi:"#fbf0d4", crack:"#3a2f1f",
    shadow:"rgba(0,0,0,0.35)", grime:"#5a4a2a", fly:"#1a1320"
  };

  var CW = 180, CH = 120, FLOOR = 104; // interne Canvas-Auflösung + Bodenhöhe

  /* =======================================================================
     2) ZEICHEN-HELFER (chunky pixel primitives)
     ======================================================================= */
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function pe(ctx, cx, cy, rx, ry, col) { // gefüllte Pixel-Ellipse
    ctx.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (w <= 0) continue;
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }
  function tri(ctx, ax, ay, bx, by, cx2, cy2, col) { // Dreieck via Scanlines
    ctx.fillStyle = col;
    var minY = Math.floor(Math.min(ay, by, cy2)), maxY = Math.ceil(Math.max(ay, by, cy2));
    var edges = [[ax,ay,bx,by],[bx,by,cx2,cy2],[cx2,cy2,ax,ay]];
    for (var y = minY; y <= maxY; y++) {
      var xs = [];
      for (var e = 0; e < edges.length; e++) {
        var x1=edges[e][0], y1=edges[e][1], x2=edges[e][2], y2=edges[e][3];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (x2 - x1) * ((y - y1) / (y2 - y1)));
      }
      if (xs.length >= 2) { xs.sort(function(a,b){return a-b;}); ctx.fillRect(Math.round(xs[0]), y, Math.max(1, Math.round(xs[xs.length-1]-xs[0])), 1); }
    }
  }

  /* =======================================================================
     3) STATISCHE HÖHLEN-GEOMETRIE (einmalig, deterministisch)
     ======================================================================= */
  function makeRng(seed){ var s = seed>>>0; return function(){ s = (s*1664525+1013904223)>>>0; return s/4294967296; }; }
  var CAVE = (function () {
    var rng = makeRng(20260623), stal = [], rocks = [], moss = [], pebbles = [], x, i;
    for (x = 6; x < CW; x += 16 + Math.floor(rng()*8)) stal.push({ x:x, w:5+Math.floor(rng()*5), h:6+Math.floor(rng()*12) });
    for (i = 0; i < 10; i++) rocks.push({ x: rng()<0.5 ? Math.floor(rng()*26) : CW-26+Math.floor(rng()*22), y:20+Math.floor(rng()*70), r:6+Math.floor(rng()*12) });
    for (i = 0; i < 34; i++) moss.push({ x:Math.floor(rng()*CW), y:14+Math.floor(rng()*(FLOOR-10)), s:1+Math.floor(rng()*2), lt: rng()<0.4 });
    for (i = 0; i < 22; i++) pebbles.push({ x:Math.floor(rng()*CW), y:FLOOR+2+Math.floor(rng()*12), s:1+Math.floor(rng()*2) });
    return { stal:stal, rocks:rocks, moss:moss, pebbles:pebbles };
  })();
  var embers = [];
  for (var ei = 0; ei < 10; ei++) embers.push({ x:26+Math.random()*6, y:30+Math.random()*20, vy:0.15+Math.random()*0.25, life:Math.random() });

  /* =======================================================================
     4) SZENE ZEICHNEN
     ======================================================================= */
  function drawScene(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, PAL.skyTop); g.addColorStop(0.5, PAL.skyMid); g.addColorStop(1, PAL.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

    var i, r, s, m, p;
    for (i = 0; i < CAVE.rocks.length; i++) { r = CAVE.rocks[i]; pe(ctx, r.x, r.y, r.r, r.r*0.8, PAL.rockDark); }

    rect(ctx, 0, 0, CW, 12, PAL.rock);
    for (i = 0; i < CAVE.stal.length; i++) {
      s = CAVE.stal[i];
      tri(ctx, s.x, 12, s.x+s.w, 12, s.x+s.w/2, 12+s.h, PAL.rock);
      tri(ctx, s.x+1, 12, s.x+s.w-1, 12, s.x+s.w/2, 12+s.h-2, PAL.rockDark);
    }
    rect(ctx, 0, 0, 10, CH, PAL.rock); rect(ctx, CW-10, 0, 10, CH, PAL.rock);
    rect(ctx, 0, 0, 4, CH, PAL.rockDark); rect(ctx, CW-4, 0, 4, CH, PAL.rockDark);

    rect(ctx, 0, FLOOR, CW, CH-FLOOR, PAL.ground);
    rect(ctx, 0, FLOOR, CW, 2, PAL.groundLt);
    for (i = 0; i < CAVE.pebbles.length; i++) { p = CAVE.pebbles[i]; rect(ctx, p.x, p.y, p.s, p.s, PAL.groundEdge); }
    for (i = 0; i < CAVE.moss.length; i++) { m = CAVE.moss[i]; rect(ctx, m.x, m.y, m.s, m.s, m.lt ? PAL.mossLt : PAL.moss); }

    // Fackel
    var fx = 24, fy = 40;
    rect(ctx, fx-1, fy+6, 3, 18, PAL.torchDk); rect(ctx, fx, fy+6, 2, 18, PAL.torchWood);
    rect(ctx, fx-3, fy+4, 7, 3, PAL.torchDk);
    var fl = Math.sin(t/90)*0.5 + Math.sin(t/37)*0.5, fh = 10 + fl*3;
    tri(ctx, fx-4, fy+5, fx+4, fy+5, fx+0.5+fl, fy+5-fh, PAL.flame3);
    tri(ctx, fx-3, fy+4, fx+3, fy+4, fx+0.5+fl, fy+4-fh*0.7, PAL.flame2);
    tri(ctx, fx-1.5, fy+3, fx+1.5, fy+3, fx+0.5+fl*0.5, fy+3-fh*0.4, PAL.flame1);

    var gl = ctx.createRadialGradient(fx, fy, 2, fx, fy, 70+fl*6);
    gl.addColorStop(0, "rgba(255,176,77,"+(0.22+fl*0.05)+")"); gl.addColorStop(1, "rgba(255,176,77,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, CW, CH);

    for (i = 0; i < embers.length; i++) {
      var em = embers[i]; em.y -= em.vy; em.life += 0.02;
      if (em.y < fy-16 || em.life > 1) { em.x = fx-2+Math.random()*6; em.y = fy+2; em.life = 0; }
      rect(ctx, em.x, em.y, 1, 1, Math.random()<0.5 ? PAL.flame2 : PAL.glow);
    }

    var vg = ctx.createRadialGradient(CW/2, FLOOR-10, 30, CW/2, FLOOR-10, 120);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
  }

  /* =======================================================================
     5) DRACHE ZEICHNEN (4 Stufen + Idle-Animationen)
     ======================================================================= */
  function drawWing(ctx, px, py, dir, len, angle, spread) {
    var a = (dir < 0 ? Math.PI : 0) - dir*angle;
    var tipX = px + Math.cos(a)*len, tipY = py + Math.sin(a)*len;
    var lowX = px + Math.cos(a + dir*spread)*len*0.7, lowY = py + Math.sin(a + dir*spread)*len*0.7 + 4;
    tri(ctx, px, py-2, tipX, tipY, lowX, lowY, PAL.wingDk);
    tri(ctx, px+dir, py-1, tipX-dir, tipY+1, lowX, lowY-1, PAL.wingMem);
    var fingers = [0.45, 0.8];
    for (var k = 0; k < fingers.length; k++) {
      var ex = px + (tipX-px)*fingers[k], ey = py + (tipY-py)*fingers[k];
      tri(ctx, px, py-1, ex, ey, ex, ey+2, PAL.wingDk);
    }
  }

  function drawDragon(ctx, stage, t, dirty, fx) {
    var breath = Math.sin(t/600), pop = fx.feedPop;
    var cx = 92, baseY = FLOOR - 1 - Math.max(0, pop)*6;
    if (stage === 0) { drawEgg(ctx, cx, baseY, t); return; }
    var flap = Math.sin(t/280), wag = Math.sin(t/230), blink = (t % 3600) > 3460;
    var scl = stage === 1 ? 0.7 : stage === 2 ? 0.9 : 1.15;
    pe(ctx, cx, FLOOR+6, 22*scl, 4*scl, PAL.shadow);
    if (stage === 1) drawBaby(ctx, cx, baseY, breath, flap, wag, blink, dirty, fx, t);
    else if (stage === 2) drawYoung(ctx, cx, baseY, breath, flap, wag, blink, dirty, fx, t);
    else drawAdult(ctx, cx, baseY, breath, flap, wag, blink, dirty, fx, t);
  }

  function drawEgg(ctx, cx, baseY, t) { // Stufe 0
    var wob = Math.sin(t/380)*1.6;
    pe(ctx, cx, FLOOR+6, 16, 3, PAL.shadow);
    ctx.save(); ctx.translate(cx+wob, baseY-18); ctx.rotate(Math.sin(t/380)*0.05);
    pe(ctx, 0, 2, 13, 17, PAL.egg); pe(ctx, 0, -8, 9, 9, PAL.egg);
    pe(ctx, 4, 6, 9, 12, PAL.eggDk); rect(ctx, -8, -10, 5, 4, PAL.eggHi);
    var spots = [[-4,-2,"eggSpot2"],[3,-6,"eggSpot"],[-6,6,"eggSpot"],[5,8,"eggSpot2"],[0,12,"eggSpot"],[-2,4,"eggSpot2"]];
    for (var i = 0; i < spots.length; i++) rect(ctx, spots[i][0], spots[i][1], 3, 3, PAL[spots[i][2]]);
    ctx.restore();
  }

  function drawBaby(ctx, cx, baseY, breath, flap, wag, blink, dirty, fx, t) { // Stufe 1
    var by = baseY - 12 + breath*0.5;
    tri(ctx, cx+7, by+3, cx+14+wag*3, by+6+wag, cx+7, by+9, PAL.body);
    rect(ctx, cx+13+wag*3, by+5+wag, 2, 2, PAL.bodyDk);
    drawWing(ctx, cx-4, by-1, -1, 8, 0.5+flap*0.25, 0.7);
    drawWing(ctx, cx+4, by-1, 1, 8, 0.5+flap*0.25, 0.7);
    pe(ctx, cx, by+2, 9, 8+breath*0.6, PAL.body);
    pe(ctx, cx, by+4, 6, 5, PAL.belly);
    pe(ctx, cx-3, by-1, 4, 4, PAL.bodyLt);
    rect(ctx, cx-6, by+8, 4, 3, PAL.body); rect(ctx, cx-6, by+11, 4, 1, PAL.claw);
    rect(ctx, cx+2, by+8, 4, 3, PAL.body); rect(ctx, cx+2, by+11, 4, 1, PAL.claw);
    pe(ctx, cx, by-7, 8, 7, PAL.body); pe(ctx, cx-2, by-9, 3, 3, PAL.bodyLt);
    rect(ctx, cx-5, by-13, 2, 3, PAL.horn); rect(ctx, cx+3, by-13, 2, 3, PAL.horn);
    var eyes = [-4, 3];
    for (var i = 0; i < eyes.length; i++) {
      pe(ctx, cx+eyes[i], by-7, 3, blink ? 0.6 : 3.2, PAL.eyeW);
      if (!blink) rect(ctx, cx+eyes[i], by-7, 2, 2, PAL.pupil);
    }
    rect(ctx, cx-2, by-3, 1, 1, PAL.nostril); rect(ctx, cx+1, by-3, 1, 1, PAL.nostril);
    if (dirty) drawDirt(ctx, cx, by, t);
  }

  function drawYoung(ctx, cx, baseY, breath, flap, wag, blink, dirty, fx, t) { // Stufe 2
    var by = baseY - 18 + breath*0.6, txp = cx + 16 + wag*5;
    tri(ctx, cx+9, by+6, txp, by+10+wag*2, cx+9, by+14, PAL.body);
    tri(ctx, txp-1, by+8+wag*2, txp+5, by+6+wag*2, txp+1, by+13+wag*2, PAL.bodyDk);
    drawWing(ctx, cx-5, by-2, -1, 18, 0.35+flap*0.35, 0.85);
    drawWing(ctx, cx+5, by-2, 1, 18, 0.35+flap*0.35, 0.85);
    rect(ctx, cx-8, by+12, 5, 5, PAL.body); rect(ctx, cx-9, by+17, 6, 2, PAL.claw);
    rect(ctx, cx+3, by+12, 5, 5, PAL.body); rect(ctx, cx+3, by+17, 6, 2, PAL.claw);
    pe(ctx, cx, by+5, 12, 11+breath*0.8, PAL.body);
    pe(ctx, cx, by+8, 8, 7, PAL.belly);
    for (var b = -1; b <= 2; b++) rect(ctx, cx-6+b*4, by+5, 7, 1, PAL.bellyDk);
    pe(ctx, cx-5, by, 4, 4, PAL.bodyLt);
    for (var s = 0; s < 4; s++) tri(ctx, cx-8+s*4, by-4, cx-4+s*4, by-4, cx-6+s*4, by-9, PAL.spike);
    pe(ctx, cx-2, by-6, 6, 6, PAL.body); pe(ctx, cx-4, by-12, 9, 7, PAL.body);
    pe(ctx, cx-7, by-13, 3, 3, PAL.bodyLt);
    rect(ctx, cx-9, by-18, 2, 4, PAL.horn); rect(ctx, cx-2, by-18, 2, 4, PAL.horn);
    var eyes = [-8, -2];
    for (var i = 0; i < eyes.length; i++) {
      pe(ctx, cx+eyes[i], by-12, 2.4, blink ? 0.6 : 2.6, PAL.eyeW);
      if (!blink) rect(ctx, cx+eyes[i]-1, by-12, 2, 2, PAL.pupil);
    }
    rect(ctx, cx-11, by-10, 3, 2, PAL.bodyDk); rect(ctx, cx-11, by-11, 1, 1, PAL.nostril);
    if (dirty) drawDirt(ctx, cx, by, t);
  }

  function drawAdult(ctx, cx, baseY, breath, flapFast, wag, blink, dirty, fx, t) { // Stufe 3
    var flap = Math.sin(t/520), by = baseY - 26 + breath*0.8;
    var txp = cx + 22 + wag*6, typ = by + 14 + wag*3;
    tri(ctx, cx+11, by+8, txp, typ, cx+11, by+20, PAL.body);
    tri(ctx, txp-2, typ-2, txp+8, typ+(wag>0?-3:3), txp-2, typ+6, PAL.bodyDk);
    drawWing(ctx, cx-6, by-4, -1, 28, 0.2+flap*0.4, 0.95);
    drawWing(ctx, cx+6, by-4, 1, 28, 0.2+flap*0.4, 0.95);
    rect(ctx, cx-11, by+16, 7, 7, PAL.body); rect(ctx, cx-13, by+23, 9, 3, PAL.claw);
    rect(ctx, cx+4, by+16, 7, 7, PAL.body); rect(ctx, cx+4, by+23, 9, 3, PAL.claw);
    pe(ctx, cx, by+8, 16, 14+breath, PAL.body);
    pe(ctx, cx, by+12, 11, 9, PAL.belly);
    for (var b = 0; b < 5; b++) rect(ctx, cx-9, by+6+b*3, 18, 1, PAL.bellyDk);
    pe(ctx, cx-7, by+2, 5, 5, PAL.bodyLt);
    for (var s = 0; s < 5; s++) tri(ctx, cx-11+s*5, by-5, cx-6+s*5, by-5, cx-8+s*5, by-13, PAL.spike);
    pe(ctx, cx-3, by-8, 8, 8, PAL.body); pe(ctx, cx-7, by-17, 12, 9, PAL.body);
    pe(ctx, cx-11, by-18, 4, 4, PAL.bodyLt);
    tri(ctx, cx-13, by-24, cx-9, by-24, cx-14, by-30, PAL.horn);
    tri(ctx, cx-4, by-24, cx, by-24, cx+1, by-31, PAL.horn);
    rect(ctx, cx-13, by-18, 5, 1, PAL.bodyDk);
    var eyes = [-12, -4];
    for (var i = 0; i < eyes.length; i++) {
      pe(ctx, cx+eyes[i], by-16, 2.6, blink ? 0.6 : 2.8, PAL.eyeW);
      if (!blink) rect(ctx, cx+eyes[i]-1, by-16, 2, 2, PAL.pupil);
    }
    rect(ctx, cx-16, by-13, 4, 3, PAL.bodyDk);
    rect(ctx, cx-16, by-14, 1, 1, PAL.nostril); rect(ctx, cx-13, by-14, 1, 1, PAL.nostril);
    // Feueratem
    var fireOn = fx.fireBurst > 0 || (t % 5200) > 4600;
    if (fireOn) {
      var mx = cx-17, my = by-11;
      for (var f = 0; f < 14; f++) {
        var pr = f/14, fx2 = mx-4 - pr*(16+Math.sin(t/60)*3), fy2 = my + Math.sin(t/50+f)*(1+pr*4);
        var col = pr<0.4 ? PAL.flame1 : pr<0.75 ? PAL.flame2 : PAL.flame3;
        rect(ctx, fx2, fy2, 2+(1-pr)*2, 2+(1-pr)*2, col);
      }
    }
    if (dirty) drawDirt(ctx, cx, by, t);
  }

  function drawDirt(ctx, cx, by, t) {
    rect(ctx, cx-2, by+4, 3, 2, PAL.grime); rect(ctx, cx+4, by+7, 2, 2, PAL.grime); rect(ctx, cx-6, by+9, 2, 2, PAL.grime);
    var a = t/300; rect(ctx, cx+Math.cos(a)*12, by-8+Math.sin(a*1.7)*5, 1, 1, PAL.fly);
  }

  /* =======================================================================
     6) FUTTER-SPRITES
     ======================================================================= */
  var FOODS = {
    beere:   { label:"Beere",     emoji:"\uD83E\uDED0" },
    fleisch: { label:"Fleisch",   emoji:"\uD83C\uDF56" },
    pilz:    { label:"Pilz",      emoji:"\uD83C\uDF44" },
    funke:   { label:"Goldfunke", emoji:"\u2728" }
  };
  function drawFood(ctx, type) {
    ctx.clearRect(0, 0, 16, 16);
    var P = function(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
    if (type === "beere") {
      P(5,1,2,2,"#4a8a3a"); P(7,2,2,1,"#6fae4f");
      P(3,6,4,4,"#b8324a"); P(8,7,4,4,"#b8324a"); P(5,9,4,4,"#9a2840");
      P(4,6,1,1,"#e06a7a"); P(9,7,1,1,"#e06a7a");
    } else if (type === "fleisch") {
      P(3,5,9,6,"#8a4a2a"); P(3,5,9,2,"#a86a3a"); P(5,7,3,2,"#c98a5a");
      P(11,4,3,2,"#ecdca8"); P(12,3,2,2,"#ecdca8");
    } else if (type === "pilz") {
      P(4,4,8,4,"#c64a3a"); P(3,6,10,2,"#a83a2a");
      P(5,5,2,2,"#f0e0c0"); P(9,5,1,1,"#f0e0c0"); P(6,8,4,5,"#e0d2b0");
    } else {
      P(7,1,2,14,"#e0b020"); P(1,7,14,2,"#e0b020");
      P(4,4,8,8,"#f0d850"); P(6,6,4,4,"#fff0a0");
      P(2,2,1,1,"#fff0a0"); P(13,12,1,1,"#fff0a0");
    }
  }

  /* =======================================================================
     7) STATE + SPIEL-LOGIK
     ======================================================================= */
  var DRAGON_DEFAULTS = {
    hunger: 30, happiness: 70, cleanliness: 80, xp: 0, stage: 0,
    lastSaved: 0, inventory: { beere: 3, fleisch: 2, pilz: 2, funke: 1 }
  };
  var STAGES = [
    { name:"Ei", min:0 },
    { name:"Baby-Drache", min:10 },
    { name:"Junger Drache", min:40 },
    { name:"Ausgewachsener Drache", min:100 }
  ];
  var STORAGE_KEY = "vh_dragon";
  // Verfallsraten pro Stunde (echtzeit)
  var DECAY = { hunger: 6, happiness: 4, cleanliness: 5 };

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function stageForXp(xp){ var s = 0; for (var i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].min) s = i; return s; }

  function moodOf(d){
    if (d.cleanliness < 30) return { key:"dirty",  label:"Schmutzig" };
    if (d.hunger > 70)      return { key:"hungry", label:"Hungrig" };
    if (d.happiness < 30)   return { key:"sad",    label:"Traurig" };
    if (d.happiness > 85)   return { key:"proud",  label:"Stolz" };
    if (d.happiness > 60)   return { key:"happy",  label:"Glücklich" };
    return { key:"ok", label:"Zufrieden" };
  }

  // Verfall seit letztem Speichern anwenden (max. 48h, damit es nicht eskaliert)
  function applyOfflineDecay(d){
    if (!d.lastSaved) { d.lastSaved = Date.now(); return; }
    var hours = Math.min(48, (Date.now() - d.lastSaved) / 3600000);
    if (hours <= 0) return;
    d.hunger      = clamp(d.hunger      + DECAY.hunger      * hours);
    d.happiness   = clamp(d.happiness   - DECAY.happiness   * hours);
    d.cleanliness = clamp(d.cleanliness - DECAY.cleanliness * hours);
  }

  /* ---- Persistenz ---- */
  function readStorage(){
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function saveDragon(){
    try {
      window.dragon.lastSaved = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.dragon));
    } catch (e) { /* localStorage evtl. nicht verfügbar – still ignorieren */ }
  }

  function normalize(saved){
    var base = Object.assign({}, DRAGON_DEFAULTS, { inventory: Object.assign({}, DRAGON_DEFAULTS.inventory) });
    if (saved && typeof saved === "object") {
      ["hunger","happiness","cleanliness","xp","stage","lastSaved"].forEach(function(k){
        if (typeof saved[k] === "number") base[k] = saved[k];
      });
      if (saved.inventory && typeof saved.inventory === "object") base.inventory = Object.assign({}, DRAGON_DEFAULTS.inventory, saved.inventory);
    }
    base.stage = stageForXp(base.xp);
    return base;
  }

  function loadDragon(saved){
    var d = normalize(saved);
    applyOfflineDecay(d);
    window.dragon = d;
    if (cardBuilt && document.getElementById("dragonCard")) updateDragonUI();
    return d;
  }

  /* ---- Aktionen ---- */
  function checkGrowth(prevStage){
    var d = window.dragon;
    d.stage = stageForXp(d.xp);
    if (d.stage > prevStage) showToast("🎉 Dein Drache wächst zur Stufe: " + STAGES[d.stage].name + "!");
  }

  function rewardDragon(action){
    var d = window.dragon, prev = d.stage;
    d.xp += 8;
    d.happiness = clamp(d.happiness + 8);
    var drop = "";
    if (Math.random() < 0.4) { // gelegentlich Futter als Belohnung
      var keys = Object.keys(FOODS), k = keys[Math.floor(Math.random() * keys.length)];
      d.inventory[k] = (d.inventory[k] || 0) + 1;
      drop = " (+1 " + FOODS[k].label + ")";
    }
    checkGrowth(prev);
    saveDragon(); updateDragonUI();
    showToast("Gut gemacht: " + (action || "Aktion") + "! +8 XP" + drop);
  }

  function feedDragon(type){
    var d = window.dragon;
    if ((d.inventory[type] || 0) <= 0) { showToast("Vorrat leer! 📭"); return; }
    var prev = d.stage;
    d.inventory[type] -= 1;
    fx.feedPop = 1;
    d.hunger = clamp(d.hunger - (type === "fleisch" ? 30 : 20));
    d.xp += (type === "funke" ? 12 : 5);
    d.happiness = clamp(d.happiness + (type === "funke" ? 12 : 5));
    checkGrowth(prev);
    saveDragon(); updateDragonUI();
    showToast("Mampf! " + FOODS[type].emoji);
  }

  function cleanDragon(){
    var d = window.dragon;
    d.cleanliness = clamp(d.cleanliness + 45);
    saveDragon(); updateDragonUI();
    showToast("Blitzeblank! 🧼✨");
  }

  /* =======================================================================
     8) UI / DOM
     ======================================================================= */
  var selectedFood = "beere";
  var cardBuilt = false;
  var rafId = null;
  var canvas = null, cctx = null;
  var fx = { feedPop: 0, fireBurst: 0 };
  var toastTimer = null;
  var decayTimer = null;

  function statusCardHTML(label, key){
    return '' +
      '<div class="dragon-status-card" data-stat="' + key + '">' +
        '<div class="dragon-status-label">' + label + '</div>' +
        '<div class="dragon-status-val">0</div>' +
        '<div class="dragon-status-bar-track"><div class="dragon-status-bar-fill"></div></div>' +
      '</div>';
  }

  function inventoryHTML(){
    var html = '';
    Object.keys(FOODS).forEach(function(k){
      html += '' +
        '<button type="button" class="dragon-inv-item" data-food="' + k + '" title="' + FOODS[k].label + '">' +
          '<span class="dragon-food-sprite">' +
            '<canvas class="dragon-food-canvas" width="16" height="16"></canvas>' +
            '<span class="dragon-food-emoji">' + FOODS[k].emoji + '</span>' +
          '</span>' +
          '<span class="dragon-inv-count">×0</span>' +
        '</button>';
    });
    return html;
  }

  function renderDragonCard(){
    var card = document.getElementById("dragonCard");
    if (!card) return;

    card.innerHTML = '' +
      '<div class="dragon-header">' +
        '<div class="dragon-title">🐉 HomeHub Drache</div>' +
        '<div class="dragon-mood-badge mood-ok">Zufrieden</div>' +
      '</div>' +
      '<div class="dragon-status-grid">' +
        statusCardHTML("Hunger", "hunger") +
        statusCardHTML("Glück", "happiness") +
        statusCardHTML("Sauberkeit", "cleanliness") +
        '<div class="dragon-status-card" data-stat="stage">' +
          '<div class="dragon-status-label">Stufe</div>' +
          '<div class="dragon-stage-name">Ei</div>' +
          '<div class="dragon-xp">XP 0</div>' +
        '</div>' +
      '</div>' +
      '<div class="dragon-body">' +
        '<div class="dragon-scene-wrap">' +
          '<canvas id="dragonSceneCanvas" width="' + CW + '" height="' + CH + '"></canvas>' +
          '<div class="dragon-dirty-warn" hidden>⚠ Drache braucht ein Bad!</div>' +
          '<div class="dragon-toast"></div>' +
        '</div>' +
        '<div class="dragon-sidebar">' +
          '<div class="dragon-inv-label">Futtervorrat</div>' +
          '<div class="dragon-inv-grid">' + inventoryHTML() + '</div>' +
          '<button type="button" class="dragon-feed-btn">Füttern</button>' +
          '<button type="button" class="dragon-clean-btn">🧼 Putzen</button>' +
        '</div>' +
      '</div>';

    // Futter-Sprites zeichnen (mit Emoji-Fallback bei fehlendem Canvas-Kontext)
    var items = card.querySelectorAll(".dragon-inv-item");
    for (var i = 0; i < items.length; i++) {
      var fcanvas = items[i].querySelector(".dragon-food-canvas");
      var fctx = fcanvas && fcanvas.getContext ? fcanvas.getContext("2d") : null;
      if (fctx) { fctx.imageSmoothingEnabled = false; drawFood(fctx, items[i].getAttribute("data-food")); }
      else { card.classList.add("no-canvas"); }
    }

    // Events
    card.querySelectorAll(".dragon-inv-item").forEach(function(btn){
      btn.addEventListener("click", function(){
        var food = btn.getAttribute("data-food");
        if ((window.dragon.inventory[food] || 0) <= 0) return;
        selectedFood = food;
        updateDragonUI();
      });
    });
    var feedBtn = card.querySelector(".dragon-feed-btn");
    if (feedBtn) feedBtn.addEventListener("click", function(){ feedDragon(selectedFood); });
    var cleanBtn = card.querySelector(".dragon-clean-btn");
    if (cleanBtn) cleanBtn.addEventListener("click", cleanDragon);

    cardBuilt = true;
    updateDragonUI();
    startLoop();
    startDecayTimer();
  }

  function barColor(fill){ return fill > 60 ? "#6ec06a" : fill > 30 ? "#e0b020" : "#d8543a"; }

  function updateStat(card, key, val, good){
    var el = card.querySelector('[data-stat="' + key + '"]');
    if (!el) return;
    var fill = good ? val : 100 - val; // Hunger: niedrig = gut
    el.querySelector(".dragon-status-val").textContent = Math.round(val);
    var fillEl = el.querySelector(".dragon-status-bar-fill");
    fillEl.style.width = fill + "%";
    fillEl.style.background = barColor(fill);
  }

  function updateDragonUI(){
    var card = document.getElementById("dragonCard");
    if (!card || !cardBuilt) return;
    var d = window.dragon;

    updateStat(card, "hunger", d.hunger, false);
    updateStat(card, "happiness", d.happiness, true);
    updateStat(card, "cleanliness", d.cleanliness, true);

    var stageCard = card.querySelector('[data-stat="stage"]');
    if (stageCard) {
      stageCard.querySelector(".dragon-stage-name").textContent = STAGES[d.stage].name;
      stageCard.querySelector(".dragon-xp").textContent = "XP " + d.xp;
    }

    var mood = moodOf(d);
    var badge = card.querySelector(".dragon-mood-badge");
    if (badge) { badge.className = "dragon-mood-badge mood-" + mood.key; badge.textContent = mood.label; }

    // Inventar
    card.querySelectorAll(".dragon-inv-item").forEach(function(btn){
      var food = btn.getAttribute("data-food");
      var count = d.inventory[food] || 0;
      btn.querySelector(".dragon-inv-count").textContent = "×" + count;
      btn.classList.toggle("empty", count <= 0);
      btn.classList.toggle("selected", food === selectedFood && count > 0);
      btn.disabled = count <= 0;
    });
    var feedBtn = card.querySelector(".dragon-feed-btn");
    if (feedBtn) feedBtn.disabled = (d.inventory[selectedFood] || 0) <= 0;

    // Schmutz-Warnung
    var warn = card.querySelector(".dragon-dirty-warn");
    if (warn) warn.hidden = d.cleanliness >= 30;
  }

  function showToast(msg){
    var card = document.getElementById("dragonCard");
    if (!card) return;
    var el = card.querySelector(".dragon-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove("show"); }, 1900);
  }

  /* ---- Animationsschleife ---- */
  function startLoop(){
    canvas = document.getElementById("dragonSceneCanvas");
    if (!canvas || !canvas.getContext) return;
    cctx = canvas.getContext("2d");
    cctx.imageSmoothingEnabled = false;
    if (rafId) cancelAnimationFrame(rafId);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var start = (typeof performance !== "undefined" ? performance.now() : Date.now());
    function loop(now){
      now = now || (typeof performance !== "undefined" ? performance.now() : Date.now());
      var t = reduce ? (now - start) * 0.4 : (now - start);
      var d = window.dragon;
      drawScene(cctx, t);
      drawDragon(cctx, d.stage, t, d.cleanliness < 30, fx);
      if (fx.feedPop > 0) fx.feedPop = Math.max(0, fx.feedPop - 0.05);
      if (fx.fireBurst > 0) fx.fireBurst -= 1;
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ---- Echtzeit-Verfall, solange die Seite offen ist (sanft) ---- */
  function startDecayTimer(){
    if (decayTimer) return;
    decayTimer = setInterval(function(){
      var d = window.dragon;
      d.hunger      = clamp(d.hunger      + DECAY.hunger      / 60);
      d.happiness   = clamp(d.happiness   - DECAY.happiness   / 60);
      d.cleanliness = clamp(d.cleanliness - DECAY.cleanliness / 60);
      saveDragon();
      updateDragonUI();
    }, 60000); // jede Minute = 1/60 der Stundenrate
  }

  /* =======================================================================
     9) INITIALISIERUNG + GLOBALE EXPORTS
     ======================================================================= */
  window.DRAGON_DEFAULTS = DRAGON_DEFAULTS;
  window.dragon          = normalize(readStorage());
  applyOfflineDecay(window.dragon);

  window.loadDragon      = loadDragon;
  window.saveDragon      = saveDragon;
  window.rewardDragon    = rewardDragon;
  window.renderDragonCard = renderDragonCard;

  // Falls #dragonCard schon im DOM ist, automatisch rendern (schadet nicht,
  // index.html ruft renderDragonCard() ohnehin nach dem Rendern erneut auf).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){
      if (document.getElementById("dragonCard")) renderDragonCard();
    });
  } else {
    if (document.getElementById("dragonCard")) renderDragonCard();
  }
})();
