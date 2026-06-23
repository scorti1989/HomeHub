/* dragon-game.js */
(function () {
  "use strict";

  var STORAGE_KEY = "vh_dragon";
  var rafStarted = false;
  var selectedFood = "emberberry";
  var toastTimer = null;

  window.DRAGON_DEFAULTS = {
    hunger: 28,
    happiness: 62,
    cleanliness: 76,
    xp: 0,
    stage: 0,
    lastSaved: Date.now(),
    inventory: [
      { id: "emberberry", label: "Glutbeere", count: 5, power: 16, xp: 6, emoji: "●" },
      { id: "mosscake", label: "Mooskuchen", count: 3, power: 24, xp: 9, emoji: "■" },
      { id: "crystalfish", label: "Kristallfisch", count: 2, power: 34, xp: 14, emoji: "◆" },
      { id: "goldapple", label: "Goldapfel", count: 1, power: 46, xp: 22, emoji: "✦" }
    ]
  };

  window.dragon = mergeDragon(loadStoredDragon());

  window.loadDragon = function (savedData) {
    window.dragon = mergeDragon(savedData || loadStoredDragon());
    applyOfflineDecay();
    updateStage();
    window.saveDragon();
    window.renderDragonCard();
    return window.dragon;
  };

  window.saveDragon = function () {
    window.dragon.lastSaved = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.dragon));
    return window.dragon;
  };

  window.rewardDragon = function (action) {
    var rewards = {
      expense: 8,
      einkauf: 10,
      contract: 18,
      counter: 6,
      backup: 12,
      recipe: 14,
      default: 7
    };

    var key = String(action || "default").toLowerCase();
    var xp = rewards[key] || rewards.default;

    changeDragon({
      xp: xp,
      happiness: Math.max(3, Math.round(xp / 2)),
      hunger: 3,
      cleanliness: -1
    });

    maybeAddFood();
    showDragonToast("Drache freut sich: +" + xp + " XP");
    window.renderDragonCard();
  };

  window.renderDragonCard = function () {
    var root = document.getElementById("dragonCard");
    if (!root) return;

    applyOfflineDecay();
    updateStage();

    var mood = getMood();
    var inv = ensureInventory();

    root.className = "dragon-card";
    root.innerHTML =
      '<div class="dragon-header">' +
        '<div class="dragon-title">' + escapeHtml(getStageName()) + '</div>' +
        '<div class="dragon-mood-badge ' + mood.cls + '">' + mood.text + '</div>' +
      '</div>' +
      '<div class="dragon-status-grid">' +
        statusCard("Hunger", window.dragon.hunger, true) +
        statusCard("Freude", window.dragon.happiness, false) +
        statusCard("Sauber", window.dragon.cleanliness, false) +
        statusCard("XP", window.dragon.xp, false, nextXpText()) +
      '</div>' +
      '<div class="dragon-body">' +
        '<div class="dragon-scene-wrap"><canvas id="dragonSceneCanvas" width="640" height="360"></canvas></div>' +
        '<aside class="dragon-sidebar">' +
          '<div class="dragon-title" style="font-size:10px;margin-bottom:8px;">Inventar</div>' +
          '<div class="dragon-inv-grid">' + inv.map(inventoryButton).join("") + '</div>' +
          '<button class="dragon-clean-btn" type="button" data-dragon-clean>Höhle putzen</button>' +
          dirtyWarning() +
        '</aside>' +
      '</div>';

    root.querySelectorAll("[data-food-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.classList.contains("empty")) return;
        selectedFood = btn.getAttribute("data-food-id");
        feedDragon();
      });
    });

    var cleanBtn = root.querySelector("[data-dragon-clean]");
    if (cleanBtn) cleanBtn.addEventListener("click", cleanDragon);

    window.saveDragon();
    startDragonLoop();
  };

  function feedDragon() {
    var item = ensureInventory().find(function (x) { return x.id === selectedFood; });
    if (!item || item.count <= 0) {
      showDragonToast("Davon ist nichts mehr da.");
      return;
    }

    item.count -= 1;
    changeDragon({
      hunger: -item.power,
      happiness: 8,
      cleanliness: -3,
      xp: item.xp
    });

    showDragonToast(item.label + " gefüttert: +" + item.xp + " XP");
    window.renderDragonCard();
  }

  function cleanDragon() {
    changeDragon({
      cleanliness: 30,
      happiness: 4,
      xp: 5
    });
    showDragonToast("Die Höhle glänzt. +5 XP");
    window.renderDragonCard();
  }

  function mergeDragon(data) {
    var base = JSON.parse(JSON.stringify(window.DRAGON_DEFAULTS));
    var merged = Object.assign(base, data || {});
    merged.inventory = mergeInventory(data && data.inventory);
    merged.hunger = clamp(Number(merged.hunger) || 0, 0, 100);
    merged.happiness = clamp(Number(merged.happiness) || 0, 0, 100);
    merged.cleanliness = clamp(Number(merged.cleanliness) || 0, 0, 100);
    merged.xp = Math.max(0, Number(merged.xp) || 0);
    merged.stage = clamp(Number(merged.stage) || 0, 0, 3);
    merged.lastSaved = Number(merged.lastSaved) || Date.now();
    return merged;
  }

  function mergeInventory(oldInv) {
    return window.DRAGON_DEFAULTS.inventory.map(function (def) {
      var old = Array.isArray(oldInv) && oldInv.find(function (x) { return x.id === def.id; });
      return Object.assign({}, def, { count: old ? Math.max(0, Number(old.count) || 0) : def.count });
    });
  }

  function loadStoredDragon() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function applyOfflineDecay() {
    var now = Date.now();
    var hours = Math.max(0, (now - (window.dragon.lastSaved || now)) / 36e5);
    if (hours < 0.08) return;

    window.dragon.hunger = clamp(window.dragon.hunger + Math.floor(hours * 2), 0, 100);
    window.dragon.happiness = clamp(window.dragon.happiness - Math.floor(hours * 1.4), 0, 100);
    window.dragon.cleanliness = clamp(window.dragon.cleanliness - Math.floor(hours * 1.7), 0, 100);
    window.dragon.lastSaved = now;
  }

  function changeDragon(delta) {
    window.dragon.hunger = clamp(window.dragon.hunger + (delta.hunger || 0), 0, 100);
    window.dragon.happiness = clamp(window.dragon.happiness + (delta.happiness || 0), 0, 100);
    window.dragon.cleanliness = clamp(window.dragon.cleanliness + (delta.cleanliness || 0), 0, 100);
    window.dragon.xp = Math.max(0, window.dragon.xp + (delta.xp || 0));
    updateStage();
    window.saveDragon();
  }

  function updateStage() {
    var xp = window.dragon.xp;
    window.dragon.stage = xp >= 360 ? 3 : xp >= 160 ? 2 : xp >= 60 ? 1 : 0;
  }

  function ensureInventory() {
    window.dragon.inventory = mergeInventory(window.dragon.inventory);
    return window.dragon.inventory;
  }

  function maybeAddFood() {
    if (Math.random() > 0.32) return;
    var inv = ensureInventory();
    var item = inv[Math.floor(Math.random() * inv.length)];
    item.count += 1;
  }

  function statusCard(label, value, inverted, customText) {
    var percent = clamp(value, 0, 100);
    var good = inverted ? 100 - percent : percent;
    var color = good < 35 ? "#c9554a" : good < 70 ? "#d97b38" : "#72b06f";

    return '<div class="dragon-status-card">' +
      '<div class="dragon-status-val"><span>' + label + '</span><span>' + (customText || value) + '</span></div>' +
      '<div class="dragon-status-bar-track">' +
        '<div class="dragon-status-bar-fill" style="width:' + percent + '%;background:' + color + ';"></div>' +
      '</div>' +
    '</div>';
  }

  function inventoryButton(item) {
    var empty = item.count <= 0;
    return '<button type="button" class="dragon-inv-item ' +
      (item.id === selectedFood ? "selected " : "") +
      (empty ? "empty" : "") +
      '" data-food-id="' + item.id + '">' +
      '<span class="dragon-inv-count">x' + item.count + '</span>' +
      '<span class="dragon-food-emoji">' + item.emoji + '</span>' +
      '<span class="dragon-inv-label">' + escapeHtml(item.label) + '</span>' +
    '</button>';
  }

  function dirtyWarning() {
    if (window.dragon.cleanliness >= 35) return "";
    return '<div class="dragon-dirty-warn">Die Höhle ist rußig. Putzen erhöht Freude und XP.</div>';
  }

  function getStageName() {
    return ["Drachenei", "Baby-Drache", "Junger Drache", "Ausgewachsener Drache"][window.dragon.stage] || "Drache";
  }

  function nextXpText() {
    var next = [60, 160, 360, null][window.dragon.stage];
    return next ? window.dragon.xp + "/" + next : window.dragon.xp + " MAX";
  }

  function getMood() {
    if (window.dragon.hunger > 75) return { text: "Hungrig", cls: "mood-hungry" };
    if (window.dragon.cleanliness < 35) return { text: "Rußig", cls: "mood-dirty" };
    if (window.dragon.stage >= 3) return { text: "Stolz", cls: "mood-proud" };
    if (window.dragon.happiness > 70) return { text: "Fröhlich", cls: "mood-happy" };
    return { text: "Müde", cls: "mood-sleepy" };
  }

  function showDragonToast(text) {
    var el = document.querySelector(".dragon-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "dragon-toast";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 2200);
  }

  function startDragonLoop() {
    if (rafStarted) return;
    rafStarted = true;

    function frame(time) {
      var canvas = document.getElementById("dragonSceneCanvas");
      if (canvas) drawScene(canvas, time || 0);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function drawScene(canvas, time) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    drawCave(ctx, w, h, time);
    drawDragon(ctx, w / 2, 230, time);
  }

  function drawCave(ctx, w, h, time) {
    ctx.fillStyle = "#10091e";
    ctx.fillRect(0, 0, w, h);

    for (var y = 0; y < h; y += 24) {
      for (var x = 0; x < w; x += 32) {
        var shade = (x * 7 + y * 3) % 4;
        ctx.fillStyle = ["#171025", "#21142f", "#2a1938", "#120b1f"][shade];
        ctx.fillRect(x, y, 32, 24);
      }
    }

    ctx.fillStyle = "#080610";
    ctx.fillRect(0, 292, w, 68);

    ctx.fillStyle = "#243622";
    ctx.fillRect(36, 84, 44, 8);
    ctx.fillRect(58, 92, 18, 18);
    ctx.fillRect(520, 104, 58, 8);
    ctx.fillRect(534, 112, 24, 22);

    var flicker = Math.sin(time / 120) * 8;
    ctx.fillStyle = "#4c2a21";
    ctx.fillRect(88, 158, 12, 76);
    ctx.fillStyle = "#ffcb66";
    ctx.fillRect(80, 130 - flicker / 4, 28, 34);
    ctx.fillStyle = "#e36a2f";
    ctx.fillRect(88, 140 + flicker / 6, 14, 25);
    ctx.fillStyle = "#fff0a6";
    ctx.fillRect(93, 134, 6, 12);

    ctx.fillStyle = "rgba(255,140,52,.12)";
    ctx.fillRect(52, 110, 112 + flicker, 116);

    ctx.fillStyle = "#5c392f";
    ctx.fillRect(264, 280, 112, 10);
    ctx.fillStyle = "#d36b32";
    ctx.fillRect(286, 270, 16, 10);
    ctx.fillRect(320, 266, 20, 14);
    ctx.fillStyle = "#ffbf54";
    ctx.fillRect(294, 262, 8, 8);
    ctx.fillRect(328, 256, 8, 10);
  }

  function drawDragon(ctx, x, y, time) {
    var stage = window.dragon.stage;
    if (stage === 0) return drawEgg(ctx, x, y, time);
    if (stage === 1) return drawBaby(ctx, x, y, time);
    if (stage === 2) return drawYoung(ctx, x, y, time);
    drawAdult(ctx, x, y, time);
  }

  function px(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }

  function block(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawEgg(ctx, x, y, time) {
    var wobble = Math.sin(time / 180) * 4;
    x += wobble;

    block(ctx, x - 34, y - 50, 68, 74, "#e8d6a2");
    block(ctx, x - 46, y - 26, 92, 50, "#f4e5b8");
    block(ctx, x - 26, y - 66, 52, 20, "#f4e5b8");
    block(ctx, x - 38, y + 18, 76, 14, "#b39b72");

    px(ctx, x - 18, y - 30, 10, "#7d5ba6");
    px(ctx, x + 14, y - 10, 10, "#7d5ba6");
    px(ctx, x - 4, y + 10, 8, "#d97b38");
    px(ctx, x + 24, y - 38, 8, "#72b06f");
  }

  function drawBaby(ctx, x, y, time) {
    var breath = Math.sin(time / 260) * 3;
    var c = "#5ca86d", d = "#2e6b48", b = "#173b2c";

    block(ctx, x - 34, y - 36 - breath, 68, 54 + breath, c);
    block(ctx, x - 42, y - 26, 84, 34, c);
    block(ctx, x - 22, y - 58 - breath, 44, 26, c);
    block(ctx, x - 30, y - 66 - breath, 18, 18, c);
    block(ctx, x + 12, y - 66 - breath, 18, 18, c);

    block(ctx, x - 16, y - 50 - breath, 8, 8, "#fff0d0");
    block(ctx, x + 8, y - 50 - breath, 8, 8, "#fff0d0");
    px(ctx, x - 12, y - 46 - breath, 4, "#080610");
    px(ctx, x + 12, y - 46 - breath, 4, "#080610");

    block(ctx, x - 62, y - 24, 24, 30, d);
    block(ctx, x + 38, y - 24, 24, 30, d);
    block(ctx, x - 22, y + 16, 12, 24, b);
    block(ctx, x + 10, y + 16, 12, 24, b);
    block(ctx, x + 34, y + 2, 34, 12, d);
  }

  function drawYoung(ctx, x, y, time) {
    var tail = Math.sin(time / 160) * 10;
    var c = "#4f9a62", d = "#276143", wing = "#7a4d80";

    block(ctx, x - 52, y - 58, 104, 70, c);
    block(ctx, x - 22, y - 88, 62, 42, c);
    block(ctx, x + 36, y - 74, 28, 22, c);

    block(ctx, x - 92, y - 54, 42, 46, wing);
    block(ctx, x + 50, y - 58, 50, 50, wing);
    block(ctx, x - 78, y - 42, 24, 26, "#4e315c");
    block(ctx, x + 62, y - 44, 24, 28, "#4e315c");

    block(ctx, x - 4, y - 74, 8, 8, "#fff0d0");
    block(ctx, x + 26, y - 74, 8, 8, "#fff0d0");
    px(ctx, x, y - 70, 4, "#080610");
    px(ctx, x + 30, y - 70, 4, "#080610");

    block(ctx, x + 48, y - 4, 42, 14, d);
    block(ctx, x + 82, y + tail / 3, 30, 10, d);
    block(ctx, x - 34, y + 10, 16, 32, d);
    block(ctx, x + 20, y + 10, 16, 32, d);
  }

  function drawAdult(ctx, x, y, time) {
    var flap = Math.sin(time / 320) * 16;
    var fire = Math.sin(time / 90) > 0.45;
    var c = "#3f8f58", d = "#22573b", wing = "#684279";

    block(ctx, x - 72, y - 76, 144, 86, c);
    block(ctx, x - 28, y - 118, 82, 54, c);
    block(ctx, x + 50, y - 102, 44, 28, c);

    block(ctx, x - 146, y - 92 + flap, 76, 70 - flap / 2, wing);
    block(ctx, x + 70, y - 92 - flap, 86, 74 + flap / 2, wing);
    block(ctx, x - 126, y - 70 + flap, 44, 40, "#472b58");
    block(ctx, x + 90, y - 66 - flap, 48, 42, "#472b58");

    block(ctx, x - 6, y - 100, 10, 10, "#fff0d0");
    block(ctx, x + 36, y - 100, 10, 10, "#fff0d0");
    px(ctx, x - 2, y - 96, 5, "#080610");
    px(ctx, x + 40, y - 96, 5, "#080610");

    block(ctx, x - 14, y - 136, 12, 20, "#d8c56b");
    block(ctx, x + 20, y - 140, 12, 22, "#d8c56b");
    block(ctx, x + 52, y - 132, 12, 18, "#d8c56b");

    block(ctx, x + 68, y - 4, 68, 16, d);
    block(ctx, x + 130, y + Math.sin(time / 180) * 8, 42, 12, d);
    block(ctx, x - 46, y + 8, 20, 42, d);
    block(ctx, x + 34, y + 8, 20, 42, d);

    if (fire) {
      block(ctx, x + 94, y - 96, 34, 14, "#fff0a6");
      block(ctx, x + 124, y - 102, 44, 22, "#ffb347");
      block(ctx, x + 158, y - 96, 30, 12, "#e4572e");
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("dragonCard")) {
      window.renderDragonCard();
    }
  });
})();
