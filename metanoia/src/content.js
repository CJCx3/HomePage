/* Metanoia — content.js (2D, v3)
 * Richer scenes + characters, real objectives, a full repeating day, a date
 * with Priya, a player-delivered letter, and a field-into-stars ending.
 */
(function () {
  "use strict";
  const MET = window.MET;
  const E = MET.engine, Grade = MET.grade, Blink = MET.blink, UI = MET.ui,
    Reader = MET.reader, Audio = MET.audio, Music = MET.music, wait = MET.wait;
  const { lerp, clamp } = MET.util;
  const draw = MET.engine.drawCharacter.bind(MET.engine);
  const lighten = MET.lighten;

  /* ---------------- drawing helpers ---------------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shadow(ctx, x, y, w, h, a) { ctx.fillStyle = "rgba(0,0,0," + (a || 0.22) + ")"; rr(ctx, x + 5, y + 7, w, h, 9); ctx.fill(); }
  // a top-down piece of furniture: drop shadow, shaded body, top highlight
  function furn(ctx, x, y, w, h, c1, c2, rad) {
    shadow(ctx, x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, c2 || lighten(c1, 20)); g.addColorStop(1, c1);
    ctx.fillStyle = g; rr(ctx, x, y, w, h, rad == null ? 7 : rad); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.07)"; rr(ctx, x + 3, y + 3, w - 6, Math.max(4, h * 0.24), 5); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1; rr(ctx, x, y, w, h, rad == null ? 7 : rad); ctx.stroke();
  }
  function block(ctx, x, y, w, h, c) {
    shadow(ctx, x, y, w, h); const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, lighten(c, 16)); g.addColorStop(1, c);
    ctx.fillStyle = g; rr(ctx, x, y, w, h, 5); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.05)"; rr(ctx, x + 3, y + 3, w - 6, h * 0.3, 4); ctx.fill();
  }
  function tree(ctx, x, y, r, c) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, r, r * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#5a3f28"; ctx.fillRect(x - 3, y - 4, 6, r * 0.7);
    for (const o of [[0, -0.4, 1], [-0.5, -0.2, 0.7], [0.5, -0.2, 0.7]]) {
      ctx.fillStyle = o[2] === 1 ? c : lighten(c, -14);
      ctx.beginPath(); ctx.arc(x + o[0] * r, y + o[1] * r * 1.6, r * (o[2] === 1 ? 1 : 0.7), 0, 7); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.7, r * 0.45, 0, 7); ctx.fill();
  }
  function rug(ctx, x, y, w, h, c) { ctx.fillStyle = c; rr(ctx, x, y, w, h, 14); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 3; rr(ctx, x + 10, y + 10, w - 20, h - 20, 8); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.05)"; rr(ctx, x + 18, y + 18, w - 36, h - 36, 6); ctx.fill(); }
  function frame(ctx, x, y, w, h, pic) { furn(ctx, x, y, w, h, "#caa86a", "#e0c184", 2); ctx.fillStyle = pic || "#9fb6d0"; ctx.fillRect(x + 4, y + 4, w - 8, h - 8); }
  function plantPot(ctx, x, y, s) { ctx.fillStyle = "#9a5a3a"; rr(ctx, x - s * 0.5, y, s, s * 0.7, 3); ctx.fill(); ctx.fillStyle = "#3f7d3a"; for (const o of [[-0.3, -0.5], [0, -0.8], [0.3, -0.5]]) { ctx.beginPath(); ctx.ellipse(x + o[0] * s, y + o[1] * s, s * 0.22, s * 0.42, o[0], 0, 7); ctx.fill(); } }
  function floorPlanks(base, line) {
    return function (ctx) {
      const w = E.world; ctx.fillStyle = base; ctx.fillRect(0, 0, w.w, w.h);
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); for (let y = 0; y <= w.h; y += 26) { ctx.moveTo(0, y); ctx.lineTo(w.w, y); }
      for (let x = 0; x <= w.w; x += 120) { for (let y = 0; y < w.h; y += 26) { const off = ((y / 26) % 2) * 60; ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + 26); } } ctx.stroke();
      drawWalls(ctx, w);
    };
  }
  function floorTile(base, grid, step) {
    return function (ctx) {
      const w = E.world; ctx.fillStyle = base; ctx.fillRect(0, 0, w.w, w.h);
      if (grid) { ctx.strokeStyle = grid; ctx.lineWidth = 1; const s = step || 48; ctx.beginPath(); for (let x = 0; x <= w.w; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, w.h); } for (let y = 0; y <= w.h; y += s) { ctx.moveTo(0, y); ctx.lineTo(w.w, y); } ctx.stroke(); }
      drawWalls(ctx, w);
    };
  }
  function drawWalls(ctx, w) {
    if (!w.wallColor || !w.walls) return;
    for (const r of w.walls) { const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, lighten(w.wallColor, 12)); g.addColorStop(1, lighten(w.wallColor, -14)); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.fillStyle = "rgba(255,255,255,0.06)"; for (const r of w.walls) ctx.fillRect(r.x, r.y, r.w, Math.min(5, r.h));
    ctx.fillStyle = "rgba(0,0,0,0.14)"; for (const r of w.walls) ctx.fillRect(r.x, r.y + r.h - 4, r.w, 4);
  }
  function glow(x, y, radius, color, alpha) {
    return function (ctx) { const g = ctx.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, color.replace("A", alpha)); g.addColorStop(1, color.replace("A", "0")); ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); };
  }
  function skyline(ctx, x0, y0, w, h, c) {
    let x = x0; const rng = (s) => { s = Math.sin(s) * 9999; return s - Math.floor(s); };
    let i = 0;
    while (x < x0 + w) { const bw = 26 + rng(i) * 40, bh = h * (0.4 + rng(i + 7) * 0.6); ctx.fillStyle = lighten(c, -8 + rng(i + 3) * 16); ctx.fillRect(x, y0 + h - bh, bw, bh); ctx.fillStyle = "rgba(255,240,180,0.5)"; for (let wy = y0 + h - bh + 6; wy < y0 + h - 6; wy += 12) for (let wx = x + 4; wx < x + bw - 4; wx += 9) if (rng(wx * wy) > 0.55) ctx.fillRect(wx, wy, 4, 6); x += bw + 4; i++; }
  }

  /* ---------------- character looks ---------------- */
  const LOOKS = {
    nate: { skin: "#e3b48f", hair: "#4b3a2a", hairStyle: "short", shirt: "#5c616c", pants: "#3a3946" },
    marcus: { skin: "#5b3b25", hair: "#140f0c", hairStyle: "afro", shirt: "#5d6b44", pants: "#3b4030", beard: true },
    sofia: { skin: "#ecc89c", hair: "#141414", hairStyle: "long", shirt: "#b5544a", pants: "#5a4a55" },
    david: { skin: "#f0cba6", hair: "#6b4a2c", hairStyle: "short", shirt: "#3f6a8a", pants: "#34404a", glasses: true },
    priya: { skin: "#c79463", hair: "#1c1410", hairStyle: "long", shirt: "#8a5a9a", pants: "#4a3a55" },
    kid: { skin: "#c79a72", hair: "#241810", hairStyle: "short", shirt: "#d8a23a", pants: "#5a4a3a" },
    woman: { skin: "#caa074", hair: "#241810", hairStyle: "bun", shirt: "#7a5a8a", pants: "#4a4055" },
    elder: { skin: "#b8916a", hair: "#b8b0a4", hairStyle: "short", shirt: "#6a5a4a", pants: "#4a423a", beard: true },
    soldier: { skin: "#caa07a", hair: "#181210", hairStyle: "short", shirt: "#4a5a3a", pants: "#3a4030" },
    elena: { skin: "#e6c39a", hair: "#221810", hairStyle: "long", shirt: "#c86a8a", pants: "#5a4a55" },
    marcus2: { skin: "#caa07a", hair: "#241810", hairStyle: "short", shirt: "#7a6a4a", pants: "#4a4030" },
  };
  function student(c) { return { skin: "#d8b48f", hair: "#241810", hairStyle: "short", shirt: c, pants: "#3a3a44" }; }

  /* ============================================================= *
   *  APARTMENT
   * ============================================================= */
  function buildApartment() {
    const W = 940, H = 660, T = 28;
    const walls = [
      { x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T },
      { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H },
    ];
    const colliders = [
      { x: 50, y: 60, w: 165, h: 220 }, { x: 110, y: 470, w: 250, h: 84 },
      { x: 740, y: 44, w: 110, h: 130 }, { x: 700, y: 320, w: 175, h: 92 },
      { x: 420, y: 320, w: 120, h: 120 }, { x: 60, y: 300, w: 60, h: 150 },
    ];
    const win = { color: "rgba(110,130,180,A)", alpha: 0.5, x: W - T, y: 330 };
    const time = { tint: "rgba(40,46,60,A)", alpha: 0.0 };
    const objects = [];
    objects.push({ y: 1, draw: (c) => rug(c, 360, 360, 250, 175, "#7a5b46") });
    // bed with sheets + pillow
    objects.push({ y: 70, draw: (c) => { furn(c, 50, 60, 165, 220, "#4f5a66", "#6c7888", 10); c.fillStyle = "#c9d2dc"; rr(c, 58, 130, 149, 145, 8); c.fill(); c.fillStyle = "#eef2f6"; rr(c, 62, 70, 140, 50, 8); c.fill(); } });
    // bookshelf
    objects.push({ y: 300, draw: (c) => { furn(c, 60, 300, 60, 150, "#5a4632", "#6e573f", 4); const cols = ["#8a3a2a", "#3a5a7a", "#6a7a3a", "#7a6a3a", "#5a3a6a"]; for (let i = 0; i < 12; i++) { c.fillStyle = cols[i % 5]; c.fillRect(66 + (i % 6) * 9, 308 + Math.floor(i / 6) * 70, 7, 64); } } });
    // couch + cushions
    objects.push({ y: 470, draw: (c) => { furn(c, 110, 470, 250, 84, "#5b4a3f", "#73604f"); c.fillStyle = "#6e5b4c"; rr(c, 122, 478, 100, 40, 6); c.fill(); rr(c, 232, 478, 100, 40, 6); c.fill(); } });
    objects.push({ y: 560, draw: (c) => { furn(c, 180, 580, 130, 28, "#1c1c1c", "#333", 4); c.fillStyle = MET.game.phase >= 1 ? "rgba(150,180,200,0.6)" : "rgba(90,110,120,0.4)"; rr(c, 188, 584, 114, 20, 3); c.fill(); } });
    // kitchen: fridge + counter + mug + kettle
    objects.push({ y: 44, draw: (c) => { furn(c, 740, 44, 100, 130, "#cfcabf", "#e2ddd2", 6); furn(c, 850, 44, 60, 120, "#8a7a64", "#a08f76", 4); c.fillStyle = "#c44"; rr(c, 860, 60, 14, 16, 2); c.fill(); c.fillStyle = "#888"; rr(c, 882, 58, 18, 20, 3); c.fill(); } });
    const photo = { y: 110, visible: false, draw: (c) => frame(c, 720, 96, 32, 40, "#9fb6d0") };
    objects.push({ y: 320, draw: (c) => { furn(c, 700, 320, 175, 92, "#4a3f34", "#5e5040"); c.fillStyle = "#2a2a2a"; rr(c, 760, 330, 56, 36, 2); c.fill(); } });
    objects.push({ y: 200, draw: (c) => { c.fillStyle = "#1e2735"; rr(c, W - T + 1, 248, 20, 176, 3); c.fill(); const g = c.createLinearGradient(0, 250, 0, 420); g.addColorStop(0, MET.game.phase >= 2 ? "#ffd89a" : "#9fc0e0"); g.addColorStop(1, MET.game.phase >= 2 ? "#ffb070" : "#6f93c0"); c.fillStyle = g; rr(c, W - T + 4, 254, 12, 164, 2); c.fill(); c.strokeStyle = "#1e2735"; c.lineWidth = 2; c.beginPath(); c.moveTo(W - T + 4, 336); c.lineTo(W - T + 16, 336); c.moveTo(W - T + 10, 254); c.lineTo(W - T + 10, 418); c.stroke(); } });
    const plant = { y: 250, visible: false, draw: (c) => plantPot(c, 872, 250, 30) };
    objects.push({ y: 320, draw: (c) => { furn(c, 420, 320, 120, 120, "#4a3f34", "#5e5040"); furn(c, 432, 300, 96, 18, "#3a3128", null, 3); if (MET.game.phase >= 3) { c.fillStyle = "#d8e0e0"; c.beginPath(); c.arc(470, 360, 16, 0, 7); c.fill(); c.fillStyle = "#c44"; c.beginPath(); c.arc(470, 360, 6, 0, 7); c.fill(); } } });
    // wall clock + calendar
    objects.push({ y: 30, draw: (c) => { c.fillStyle = "#e8e2d4"; c.beginPath(); c.arc(640, 70, 16, 0, 7); c.fill(); c.strokeStyle = "#333"; c.lineWidth = 2; c.beginPath(); c.moveTo(640, 70); c.lineTo(640, 60); c.moveTo(640, 70); c.lineTo(648, 72); c.stroke(); } });
    // corkboard for rereading letters
    const board = { y: 30, draw: (c) => { furn(c, 250, 22, 110, 70, "#9a7a4a", "#b89a64", 4); for (let i = 0; i < 3; i++) { c.fillStyle = i < MET.game.letterIndex ? "#f3ecd9" : "rgba(243,236,217,0.22)"; rr(c, 262 + i * 32, 34, 24, 30, 2); c.fill(); c.fillStyle = "#c33"; c.beginPath(); c.arc(274 + i * 32, 37, 2.5, 0, 7); c.fill(); } } };
    objects.push(board);
    const flag = { raised: false };
    const mailbox = { y: 30, draw: (c) => { furn(c, 470, 20, 54, 28, "#394a3a", "#4a5d4a", 4); c.fillStyle = "#2a3a2a"; rr(c, 478, 30, 38, 10, 2); c.fill(); if (flag.raised) { c.strokeStyle = "#cc4422"; c.lineWidth = 4; c.beginPath(); c.moveTo(524, 22); c.lineTo(524, 4); c.stroke(); c.fillStyle = "#cc4422"; rr(c, 524, 4, 12, 8, 1); c.fill(); } } };
    objects.push(mailbox);
    const page = { y: 320, visible: false, draw: (c) => { c.fillStyle = "#f3ecd9"; rr(c, 772, 338, 40, 52, 2); c.fill(); c.fillStyle = "rgba(0,0,0,0.2)"; for (let i = 0; i < 4; i++) c.fillRect(778, 346 + i * 8, 28, 1.5); c.fillStyle = "#222"; c.fillRect(816, 340, 4, 30); } };
    objects.push(plant, photo, page);

    const interactables = [
      { x: 497, y: 64, r: 64, glowR: 22, label: "the mailbox", repeat: true, onUse: () => MET.game.mailboxUse() },
      { x: 305, y: 64, r: 64, glowR: 22, label: "reread the letters", repeat: true, hidden: true, onUse: () => MET.game.openBoard() },
      { x: 135, y: 180, r: 78, glowR: 22, label: "the bed", repeat: true, onUse: () => UI.say(MET.game.phase >= 3 ? "I actually slept. Deep, dreamless, kind." : "If I lie down now I won't get up. I know that.", 4000) },
      { x: 790, y: 110, r: 80, glowR: 22, label: "the fridge", repeat: true, onUse: () => UI.say(MET.game.phase >= 2 ? "There's real food in here now. Color, even. When did I start shopping?" : "The same three things. A jar. Cold light.", 4200) },
      { x: 245, y: 560, r: 84, glowR: 22, label: "the tv", repeat: true, onUse: () => UI.say("Same channel. I never change it. ...Maybe tonight I'll turn it off.", 3800) },
      { x: 905, y: 320, r: 78, glowR: 22, label: "the window", repeat: true, onUse: () => UI.say(MET.game.phase >= 1 ? "I open the blinds. The street is waking up. People, going places." : "I keep the blinds shut. Less to see that way.", 4400) },
      { x: 90, y: 360, r: 72, glowR: 20, label: "the bookshelf", repeat: true, onUse: () => UI.say(MET.game.phase >= 2 ? "Spines I haven't cracked in years. I pull one down. I'll read tonight." : "Books I bought meaning to read. Dust on every one.", 4200) },
      { x: 640, y: 78, r: 64, glowR: 18, label: "the photos", repeat: true, hidden: true, onUse: () => UI.say("Three faces I'd half-forgotten. We were so young. So loud.", 4400) },
    ];
    const boardI = interactables[1], photosI = interactables[7];
    const deskWrite = { x: 792, y: 360, r: 70, glowR: 24, label: "sit and write", once: true, onUse: () => MET.game.writeFinalLetter() };

    const world = {
      w: W, h: H, spawn: { x: 470, y: 250 }, speed: 96, softSteps: true, music: "nate", bed: "apartment",
      wallColor: "#7d7468", walls: walls.concat(colliders), interactables, objects,
      refs: { plant, photo, flag, page, deskWrite, win, time, boardI, photosI, mailbox },
      drawFloor: floorPlanks("#6f5d4c", "rgba(0,0,0,0.08)"),
      drawOverlay: function (ctx) { glow(win.x, win.y, 420, win.color, win.alpha)(ctx); if (time.alpha > 0) { ctx.fillStyle = time.tint.replace("A", time.alpha); ctx.fillRect(0, 0, W, H); } },
    };
    world.armWrite = function () { if (interactables.indexOf(deskWrite) < 0) interactables.push(deskWrite); };
    world.setPhase = function (p) {
      const cfg = [{ c: "rgba(96,112,150,A)", a: 0.35 }, { c: "rgba(120,140,196,A)", a: 0.5 }, { c: "rgba(255,196,120,A)", a: 0.62 }, { c: "rgba(255,224,150,A)", a: 0.8 }][p];
      win.color = cfg.c; win.alpha = cfg.a; plant.visible = p >= 1; photo.visible = p >= 2;
      boardI.hidden = MET.game.letterIndex < 1; photosI.hidden = p < 2;
    };
    world.setTime = function (t) {
      if (t === "morning") { time.tint = "rgba(150,170,210,A)"; time.alpha = 0.10; }
      else if (t === "evening") { time.tint = "rgba(50,30,40,A)"; time.alpha = 0.22; }
      else { time.tint = "rgba(0,0,0,A)"; time.alpha = 0.0; }
    };
    return world;
  }

  /* ============================================================= *
   *  OFFICE
   * ============================================================= */
  function buildOffice(day) {
    const W = 860, H = 600, T = 24;
    const walls = [{ x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T }, { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H }];
    const objects = [];
    objects.push({ y: 1, draw: (c) => { c.fillStyle = "rgba(0,0,0,0.04)"; for (let x = 60; x < W; x += 120) c.fillRect(x, 0, 1, H); } });
    const cubes = [[140, 130], [380, 130], [620, 130], [140, 350], [380, 350], [620, 350]];
    cubes.forEach((p) => { walls.push({ x: p[0] - 52, y: p[1] - 42, w: 6, h: 130 }); walls.push({ x: p[0] - 52, y: p[1] - 42, w: 104, h: 6 }); objects.push({ y: p[1], draw: (c) => { furn(c, p[0] - 46, p[1] - 6, 92, 46, "#7a6a54", "#90806a", 3); c.fillStyle = "#1a2630"; rr(c, p[0] - 22, p[1] - 20, 44, 28, 2); c.fill(); c.fillStyle = "rgba(120,160,180,0.45)"; rr(c, p[0] - 18, p[1] - 16, 36, 20, 1); c.fill(); c.fillStyle = "#cfc8ba"; rr(c, p[0] - 8, p[1] + 8, 30, 14, 1); c.fill(); } }); });
    // water cooler + plant
    objects.push({ y: 120, draw: (c) => { furn(c, 60, 90, 30, 60, "#dfe6ea", "#f0f5f8", 4); c.fillStyle = "rgba(120,180,210,0.6)"; rr(c, 64, 96, 22, 28, 3); c.fill(); plantPot(c, 80, 470, 34); } });
    objects.push({ y: H - T, draw: (c) => { c.fillStyle = "#5a4632"; rr(c, W / 2 - 36, H - T - 8, 72, 14, 2); c.fill(); c.fillStyle = "#caa86a"; c.beginPath(); c.arc(W / 2 + 24, H - T - 1, 2.5, 0, 7); c.fill(); } });
    const refs = {};
    objects.push({ y: 360, hidden: day < 2, draw: (c) => draw(c, 470, 332, LOOKS.priya, Math.PI / 2 + 0.3, 0) });
    const door = { x: W / 2, y: H - T - 16, r: 60, glowR: 22, label: "head home", hidden: true, repeat: true, onUse: () => { MET.objectives.complete("Head home"); MET.game.pass(); } };
    const desk = {
      x: 140, y: 160, r: 64, glowR: 22, label: "sit at your desk", once: true, onUse: async () => {
        MET.objectives.complete("Sit at your desk");
        const lines = day === 0 ? "The same spreadsheet. The same fluorescent hum. My face, grey in a dark monitor."
          : day === 1 ? "The work is the same. But I caught myself watching the window. A bird on the ledge."
            : "I get it done. It doesn't swallow me whole today. There's a person at the next desk.";
        UI.say(lines, 5200); await wait(5400);
        if (day >= 2) { refs.coworker.hidden = false; E.world.interactables.push(refs.coworker); UI.setHint("someone's at the next desk"); }
        else { door.hidden = false; UI.setHint("head home — the door"); }
      },
    };
    refs.coworker = {
      x: 470, y: 352, r: 64, glowR: 24, label: "talk to Priya", once: true, hidden: true, onUse: async () => {
        MET.objectives.complete("Priya"); E.cinematic = true;
        await UI.converse([
          { name: "Priya", text: "Morning, Nate. You look... different lately. Lighter. Did something change?" },
          { name: "Nate", text: "Maybe. I've been getting letters. Old friends. They keep dragging me back to life." },
          { name: "Priya", text: "That's the nicest thing I've heard all week. We should get coffee. For real, this time." },
          { name: "Nate", text: "...Yeah. I'd like that. I really would." },
        ]);
        E.cinematic = false; door.hidden = false; UI.setHint("head home — the door");
      },
    };
    const interactables = [desk, door,
      { x: 80, y: 120, r: 56, glowR: 18, label: "the water cooler", repeat: true, onUse: () => UI.say("Cold water. The only weather in this building.", 3400) }];

    return {
      w: W, h: H, spawn: { x: W / 2, y: H - 70 }, speed: 110, softSteps: true, music: "nate", bed: "office",
      wallColor: "#9aa0a8", walls, objects, interactables, refs,
      drawFloor: floorTile("#b9bcc2", "rgba(0,0,0,0.05)", 60),
      drawOverlay: (ctx) => { ctx.fillStyle = "rgba(70,80,100,0.12)"; ctx.fillRect(0, 0, W, H); glow(W / 2, 0, 500, "rgba(200,210,230,A)", 0.08)(ctx); },
    };
  }

  /* ============================================================= *
   *  ROAD  — a more detailed commute.
   * ============================================================= */
  function buildRoad(day, returning) {
    // Wide world so the street fills the screen at any size (no black voids),
    // and everything is drawn in-bounds so nothing floats off the world.
    const W = 1600, H = 1000, C = W / 2, RH = 100, SW = 60;
    const blockEdgeL = C - RH - SW - 26, blockEdgeR = C + RH + SW + 26; // grass strip for trees between
    return {
      w: W, h: H, spawn: { x: C, y: H / 2 }, speed: 0, drawPlayer: false, music: "nate", bed: "car",
      walls: [], objects: [], interactables: [], scroll: 0,
      onUpdate: function (dt) { this.scroll = (this.scroll + dt * 240) % 12000; },
      drawFloor: function (ctx) {
        const E2 = MET.engine, sc = this.scroll;
        const vy = (E2.H / 2) / E2.scale + 60, yTop = E2.cam.y - vy, yBot = E2.cam.y + vy;
        // grass everywhere
        ctx.fillStyle = "#7d8a6e"; ctx.fillRect(0, 0, W, H);
        // city blocks on both sides (a base + scrolling cross-streets + windows, culled to view)
        const band = (x0, x1) => {
          ctx.fillStyle = "#67656e"; ctx.fillRect(x0, 0, x1 - x0, H);
          ctx.fillStyle = "rgba(0,0,0,0.07)"; for (let x = x0 + 100; x < x1; x += 100) ctx.fillRect(x, 0, 6, H);
          ctx.fillStyle = "#56545c"; for (let y = (sc % 200) - 200; y < H; y += 200) ctx.fillRect(x0, y, x1 - x0, 14);
          ctx.fillStyle = "rgba(255,235,170,0.30)";
          let y0 = yTop - ((yTop + sc) % 26) - 26;
          for (let y = y0; y < yBot + 26; y += 26) for (let x = x0 + 12; x < x1 - 8; x += 22) ctx.fillRect(x, y, 9, 11);
        };
        band(0, blockEdgeL - 20); band(blockEdgeR + 20, W);
        // sidewalks
        ctx.fillStyle = "#b8b2a4"; ctx.fillRect(C - RH - SW, 0, SW, H); ctx.fillRect(C + RH, 0, SW, H);
        // road
        ctx.fillStyle = "#33343a"; ctx.fillRect(C - RH, 0, RH * 2, H);
        ctx.fillStyle = "#6a6a70"; ctx.fillRect(C - RH, 0, 4, H); ctx.fillRect(C + RH - 4, 0, 4, H);
        ctx.fillStyle = "#d8c24a"; for (let y = -130 + (sc % 130); y < H; y += 130) ctx.fillRect(C - 3, y, 6, 64);
        // street trees lining the road (scrolling, in-bounds)
        const tx = blockEdgeL + 13, tx2 = blockEdgeR - 13;
        for (let y = -200 + (sc % 360); y < H + 100; y += 360) { tree(ctx, tx, y, 30, "#3f7d3a"); tree(ctx, tx2, y + 180, 28, "#4a8a44"); }
        if (returning && day >= 1) tree(ctx, tx, ((sc * 0.7) % 720) - 120, 36, "#e89ab8"); // the blooming tree
        // oncoming car (left lane)
        const ocy = ((sc * 1.7) % (H + 300)) - 150; ctx.fillStyle = "rgba(0,0,0,0.25)"; rr(ctx, C - 58, ocy, 44, 86, 10); ctx.fill(); ctx.fillStyle = "#3a5a8a"; rr(ctx, C - 60, ocy - 4, 44, 86, 10); ctx.fill(); ctx.fillStyle = "#cfe0ff"; rr(ctx, C - 54, ocy + 6, 32, 24, 4); ctx.fill();
        // streetlights
        for (let y = -100 + (sc % 260); y < H; y += 260) { ctx.fillStyle = "#4a4a4a"; ctx.fillRect(C - RH - 30, y, 5, 24); ctx.fillStyle = "rgba(255,220,150,0.5)"; ctx.beginPath(); ctx.arc(C - RH - 28, y, 7, 0, 7); ctx.fill(); }
        // the player's car (centered)
        const cx = C + 34, cy = H / 2;
        ctx.fillStyle = "rgba(0,0,0,0.3)"; rr(ctx, cx - 28, cy - 40, 56, 96, 12); ctx.fill();
        const cg = ctx.createLinearGradient(cx - 26, cy, cx + 26, cy); cg.addColorStop(0, "#8a3f38"); cg.addColorStop(1, "#5a2a26"); ctx.fillStyle = cg; rr(ctx, cx - 26, cy - 44, 52, 96, 12); ctx.fill();
        ctx.fillStyle = "#1a1f24"; rr(ctx, cx - 20, cy - 30, 40, 30, 6); ctx.fill();
        ctx.fillStyle = "#cfe2ff"; rr(ctx, cx - 18, cy + 8, 36, 24, 5); ctx.fill();
        ctx.fillStyle = "#e8d8b0"; ctx.beginPath(); ctx.arc(cx, cy - 6, 7, 0, 7); ctx.fill();
      },
      drawOverlay: () => {},
    };
  }

  /* ============================================================= *
   *  LETTER 1 — MARCUS + a friend + the typing-shooter.
   * ============================================================= */
  function buildMarcus() {
    const W = 1220, H = 880, T = 24;
    const walls = [{ x: -40, y: -40, w: W + 80, h: T + 40 }, { x: -40, y: H - T, w: W + 80, h: T + 40 }, { x: -40, y: -40, w: T + 40, h: H + 80 }, { x: W - T, y: -40, w: T + 40, h: H + 80 }];
    const huts = [[120, 150, 150], [860, 120, 160], [240, 470, 130], [940, 480, 150], [560, 100, 150]];
    huts.forEach((h) => walls.push({ x: h[0], y: h[1], w: h[2], h: h[2] }));
    const objects = [];
    objects.push({ y: -200, draw: (c) => { const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, "#f4c486"); g.addColorStop(1, "#caa36b"); c.fillStyle = g; c.fillRect(0, 0, W, 150); c.fillStyle = "rgba(120,90,50,0.25)"; for (let i = 0; i < 40; i++) { const x = (i * 73) % W; c.fillRect(x, 60 + (i % 5) * 12, 30, 3); } } });
    huts.forEach((h) => objects.push({ y: h[1] + h[2], draw: (c) => { block(c, h[0], h[1], h[2], h[2], "#b98a5e"); c.fillStyle = "#8a6038"; rr(c, h[0] + h[2] * 0.32, h[1] + h[2] - 32, h[2] * 0.36, 32, 3); c.fill(); c.fillStyle = "rgba(0,0,0,0.2)"; rr(c, h[0] + 12, h[1] + 16, h[2] * 0.3, h[2] * 0.22, 2); c.fill(); } }));
    // laundry line + crates + goats
    objects.push({ y: 250, draw: (c) => { c.strokeStyle = "#6a5a3a"; c.lineWidth = 2; c.beginPath(); c.moveTo(360, 220); c.lineTo(540, 250); c.stroke(); for (const col of [["#c33", 0], ["#36c", 0.33], ["#cc6", 0.66]]) { c.fillStyle = col[0]; c.fillRect(360 + col[1] * 180, 222 + col[1] * 30, 22, 28); } } });
    objects.push({ y: 250, draw: (c) => { block(c, 460, 220, 50, 50, "#8a8276"); c.fillStyle = "#3a2a1a"; c.beginPath(); c.arc(485, 245, 14, 0, 7); c.fill(); } });
    objects.push({ y: 360, draw: (c) => { c.strokeStyle = "#6a5a3a"; c.lineWidth = 5; c.beginPath(); c.moveTo(760, 360); c.lineTo(760, 290); c.stroke(); c.fillStyle = "#3a5a3a"; rr(c, 760, 288, 40, 26, 2); c.fill(); } });
    // campfire
    objects.push({ y: 430, draw: (c, t) => { c.fillStyle = "#2a1d12"; for (let i = 0; i < 5; i++) { c.save(); c.translate(330, 432); c.rotate(i * 1.25); c.fillRect(-18, -3, 36, 6); c.restore(); } const fl = 8 + Math.sin(t * 0.01) * 3; c.fillStyle = "#e08030"; c.beginPath(); c.arc(330, 426, fl + 4, 0, 7); c.fill(); c.fillStyle = "#ffd060"; c.beginPath(); c.arc(330, 424, fl, 0, 7); c.fill(); } });
    // family
    objects.push({ y: 400, draw: (c) => { draw(c, 270, 400, LOOKS.marcus, 0.5, 0); draw(c, 392, 404, LOOKS.woman, -0.5, 0); draw(c, 330, 350, LOOKS.elder, 1.5, 0); draw(c, 300, 470, LOOKS.kid, -1.0, 0); } });
    // friend (Hassan the translator) by the well
    objects.push({ y: 250, draw: (c) => draw(c, 540, 240, LOOKS.marcus2, Math.PI, 0) });
    // squad
    objects.push({ y: 560, draw: (c) => { block(c, 760, 560, 180, 40, "#9a8456"); draw(c, 785, 540, LOOKS.soldier, -1.2, 0); draw(c, 850, 536, LOOKS.soldier, -1.4, 0); draw(c, 915, 540, LOOKS.soldier, -1.0, 0); } });
    // the watch post (starts the defense)
    objects.push({ y: 640, draw: (c) => { block(c, 600, 620, 70, 40, "#7a6a4a"); c.fillStyle = "#3a3a3a"; rr(c, 612, 600, 46, 24, 3); c.fill(); } });
    // the drawing
    objects.push({ y: 700, draw: (c) => { block(c, 470, 680, 56, 56, "#8a6a3a"); c.fillStyle = "#f2ead2"; rr(c, 482, 688, 32, 40, 2); c.fill(); c.strokeStyle = "#b08a4a"; c.lineWidth = 2; c.beginPath(); c.moveTo(490, 700); c.lineTo(506, 700); c.moveTo(498, 696); c.lineTo(498, 718); c.stroke(); } });

    const interactables = [
      { x: 330, y: 410, r: 86, glowR: 32, label: "sit with the family", once: true, onUse: async () => { MET.game.mark("marcus", "family"); MET.objectives.complete("family"); E.cinematic = true; await UI.converse([{ name: "Marcus", text: "Nate! Get over here. Sit. Eat — they'll be offended if you don't." }, { name: "Local elder", text: "(hand on heart) You are family at this table. Always." }, { name: "Marcus", text: "They've got almost nothing, Nate. And they set a place for me every single night." }, { name: "Marcus", text: "Home was never a place. It's whoever shows up for you." }]); E.cinematic = false; Audio.sting("warm"); } },
      { x: 540, y: 245, r: 70, glowR: 28, label: "meet Hassan", once: true, onUse: async () => { E.cinematic = true; await UI.converse([{ name: "Hassan", text: "You are Nate? Marcus speaks of you. The clever one, he says." }, { name: "Hassan", text: "I translate for the unit. But Marcus — he translated this whole place into family for me." }, { name: "Nate", text: "He has a way of doing that." }, { name: "Hassan", text: "Stay close when the sun drops. Some nights are loud here. We watch out for each other." }]); E.cinematic = false; Audio.sting("warm"); } },
      { x: 845, y: 560, r: 80, glowR: 32, label: "sit with the squad", once: true, onUse: async () => { MET.game.mark("marcus", "squad"); MET.objectives.complete("squad"); E.cinematic = true; await UI.converse([{ name: "Squadmate", text: "You're the famous Nate? The LT won't shut up about you." }, { name: "Marcus", text: "These idiots stayed up all night telling me the worst jokes during a mortar attack." }, { name: "Marcus", text: "I'd die for any one of them. That's not a figure of speech out here." }]); E.cinematic = false; Audio.sting("warm"); } },
      { x: 635, y: 632, r: 60, glowR: 24, label: "take the watch post", once: true, onUse: () => MET.game.startMarcusDefense() },
      { x: 485, y: 245, r: 56, glowR: 18, label: "the well", repeat: true, onUse: () => UI.say("Cool water in the heat. The kids dare each other to drink fastest.", 4000) },
      { x: 760, y: 320, r: 56, glowR: 18, label: "the flag", repeat: true, onUse: () => UI.say("Hand-stitched. Someone's mother made it. It means everything to them.", 4200) },
      { x: 498, y: 708, r: 56, glowR: 24, label: "pick up the drawing", once: true, hidden: true, onUse: async () => { UI.say("The translator's kid drew this for me. Stick figures, big sun. I still carry it.", 5400); Audio.sting("warm"); await wait(5600); MET.game.endLetter(); } },
    ];
    const world = {
      w: W, h: H, spawn: { x: 600, y: 800 }, speed: 132, softSteps: false, music: "marcus", bed: "war",
      walls, objects, interactables, drawFloor: floorTile("#c9a36b", "rgba(120,80,30,0.06)", 64),
      drawOverlay: (ctx) => glow(W * 0.22, 70, 820, "rgba(255,170,90,A)", 0.18)(ctx),
    };
    world.refs = { drawing: interactables[6] };
    return world;
  }

  /* ============================================================= *
   *  LETTER 2 — SOFIA + a much clearer puzzle + a hidden inscription.
   * ============================================================= */
  function buildSofia() {
    const W = 1140, H = 1000, T = 24;
    const walls = [{ x: -40, y: -40, w: W + 80, h: T + 40 }, { x: -40, y: H - T, w: W + 80, h: T + 40 }, { x: -40, y: -40, w: T + 40, h: H + 80 }, { x: W - T, y: -40, w: T + 40, h: H + 80 }];
    walls.push({ x: 440, y: 150, w: 240, h: 180 });
    const objects = [];
    objects.push({ y: -200, draw: (c) => { const g = c.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, "#a9c8e6"); g.addColorStop(1, "#8d8678"); c.fillStyle = g; c.fillRect(0, 0, W, 220); const peaks = [[150, 240, 220], [400, 300, 280], [680, 220, 240], [920, 300, 250], [1060, 180, 200]]; peaks.forEach((p) => { c.fillStyle = "#6f6657"; c.beginPath(); c.moveTo(p[0] - p[2] / 2, 230); c.lineTo(p[0], 230 - p[1]); c.lineTo(p[0] + p[2] / 2, 230); c.closePath(); c.fill(); c.fillStyle = "#7a7264"; c.beginPath(); c.moveTo(p[0], 230 - p[1]); c.lineTo(p[0] + p[2] * 0.18, 230 - p[1] * 0.62); c.lineTo(p[0] + p[2] / 2, 230); c.lineTo(p[0], 230); c.closePath(); c.fill(); c.fillStyle = "#eef2f6"; c.beginPath(); c.moveTo(p[0] - p[2] * 0.18, 230 - p[1] * 0.62); c.lineTo(p[0], 230 - p[1]); c.lineTo(p[0] + p[2] * 0.18, 230 - p[1] * 0.62); c.closePath(); c.fill(); }); } });
    objects.push({ y: 300, draw: (c) => { c.fillStyle = "rgba(240,245,250,0.5)"; for (const p of [[210, 520], [840, 640], [320, 780], [720, 840], [560, 560]]) { c.beginPath(); c.ellipse(p[0], p[1], 64, 30, 0, 0, 7); c.fill(); } c.fillStyle = "#77705f"; for (const p of [[270, 620], [780, 700], [190, 840], [880, 560]]) { c.beginPath(); c.arc(p[0], p[1], 16, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(p[0] - 5, p[1] - 5, 7, 0, 7); c.fill(); c.fillStyle = "#77705f"; } } });
    objects.push({ y: 420, draw: (c) => { for (let i = 0; i < 10; i++) { const x = 560 + Math.sin(i * 0.7) * 52, y = 820 - i * 50; c.fillStyle = "#857a64"; rr(c, x - 17, y - 9, 36, 19, 4); c.fill(); c.fillStyle = "rgba(255,255,255,0.08)"; rr(c, x - 14, y - 7, 30, 6, 3); c.fill(); } } });
    objects.push({ y: 520, draw: (c) => { block(c, 110, 530, 120, 70, "#6a6253"); block(c, 150, 480, 36, 70, "#55503f"); draw(c, 210, 540, LOOKS.sofia, -0.6, 0); } });
    // temple
    objects.push({ y: 320, draw: (c) => { for (let i = 0; i < 4; i++) { const s = 240 - i * 46; block(c, 560 - s / 2, 150 + i * 34, s, 56, "#9a8f72"); } c.fillStyle = "rgba(74,107,58,0.7)"; rr(c, 480, 150, 160, 14, 4); c.fill(); c.fillStyle = "#1c1610"; rr(c, 540, 256, 40, 50, 4); c.fill(); c.fillStyle = "rgba(255,230,160,0.18)"; rr(c, 544, 260, 32, 44, 3); c.fill(); } });

    const interactables = [
      { x: 210, y: 545, r: 80, glowR: 26, label: "stand with Sofia at the overlook", once: true, onUse: async () => { MET.game.mark("sofia", "overlook"); MET.objectives.complete("overlook"); E.cinematic = true; await UI.converse([{ name: "Sofia", text: "I quit my job, Nate. Bought a one-way ticket and walked into these mountains with a backpack." }, { name: "Sofia", text: "Look at all of it. The world is so much bigger than the walls I built for myself." }, { name: "Nate", text: "...I think I built some walls too." }, { name: "Sofia", text: "Then knock one down. Start with a window. Then go through the door." }]); E.cinematic = false; Audio.sting("warm"); } },
      { x: 560, y: 300, r: 70, glowR: 28, label: "enter the temple", once: true, onUse: () => MET.game.enterTemple() },
      { x: 320, y: 770, r: 56, glowR: 18, label: "Sofia's backpack", repeat: true, onUse: () => UI.say("Everything she owns fits in here. She's never looked lighter.", 4200) },
      { x: 880, y: 560, r: 56, glowR: 18, label: "a strange rock", repeat: true, onUse: () => UI.say("Marine fossils. Seashells, this high in the mountains. The whole world used to be somewhere else.", 4600) },
    ];
    return {
      w: W, h: H, spawn: { x: 560, y: 920 }, speed: 150, softSteps: false, music: "sofia", bed: "wind",
      walls, objects, interactables, drawFloor: floorTile("#8d8678", "rgba(255,255,255,0.05)", 80),
      drawOverlay: (ctx) => glow(W / 2, 130, 860, "rgba(190,215,235,A)", 0.18)(ctx),
    };
  }

  function buildTemple() {
    const W = 800, H = 640, T = 30;
    const walls = [{ x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T }, { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H }];
    const glyphs = ["sun", "moon", "star", "mtn"]; const order = [2, 0, 3, 1]; const seq = [];
    function drawGlyph(c, x, y, g, lit, scale) {
      c.save(); c.translate(x, y); c.scale(scale || 1, scale || 1);
      c.fillStyle = lit ? "#ffe9a0" : "#9a8a64"; c.strokeStyle = lit ? "#ffe9a0" : "#9a8a64"; c.lineWidth = 3;
      if (lit) { c.shadowColor = "#ffd060"; c.shadowBlur = 14; }
      if (g === "sun") { c.beginPath(); c.arc(0, 0, 11, 0, 7); c.fill(); for (let i = 0; i < 8; i++) { const a = i / 8 * 7; c.beginPath(); c.moveTo(Math.cos(a) * 15, Math.sin(a) * 15); c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); c.stroke(); } }
      else if (g === "moon") { c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); c.fillStyle = lit ? "#caa84a" : "#5a5343"; if (lit) c.shadowBlur = 0; c.beginPath(); c.arc(6, -3, 12, 0, 7); c.fill(); }
      else if (g === "star") { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? 6 : 16; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.closePath(); c.fill(); }
      else { c.beginPath(); c.moveTo(-16, 13); c.lineTo(0, -15); c.lineTo(16, 13); c.closePath(); c.fill(); }
      c.restore();
    }
    const pedestals = [[220, 380], [360, 380], [500, 380], [640, 380]];
    const objects = [];
    // big, clearly-lit clue carving (much more visible now)
    objects.push({ y: 60, draw: (c) => { const g = c.createLinearGradient(180, 70, 180, 200); g.addColorStop(0, "#6a5d44"); g.addColorStop(1, "#4a4030"); c.fillStyle = g; rr(c, 180, 70, 440, 150, 8); c.fill(); c.strokeStyle = "#caa84a"; c.lineWidth = 3; rr(c, 188, 78, 424, 134, 6); c.stroke(); c.fillStyle = "#1c160e"; rr(c, 200, 92, 400, 78, 6); c.fill(); order.forEach((g2, i) => { drawGlyph(c, 270 + i * 90, 132, glyphs[g2], true, 1.35); c.fillStyle = "#caa84a"; c.font = "bold 22px Georgia"; c.textAlign = "center"; if (i < 3) c.fillText("→", 315 + i * 90, 138); }); c.fillStyle = "#e8d9a8"; c.font = "italic 15px Georgia"; c.textAlign = "center"; c.fillText("wake them in this order", 400, 198); } });
    // torches for atmosphere + light on the clue
    objects.push({ y: 50, draw: (c, t) => { for (const tx of [150, 650]) { c.fillStyle = "#3a2a18"; c.fillRect(tx - 3, 90, 6, 40); const fl = 7 + Math.sin(t * 0.012 + tx) * 3; c.fillStyle = "#e08030"; c.beginPath(); c.arc(tx, 86, fl + 3, 0, 7); c.fill(); c.fillStyle = "#ffd060"; c.beginPath(); c.arc(tx, 84, fl, 0, 7); c.fill(); } } });
    pedestals.forEach((p, idx) => objects.push({ y: p[1], draw: (c) => { block(c, p[0] - 24, p[1] - 16, 48, 38, "#6a6253"); drawGlyph(c, p[0], p[1] - 30, glyphs[idx], seq.indexOf(idx) >= 0, 1); } }));
    const chamber = { y: 250, visible: false, draw: (c) => { glow(W / 2, 250, 260, "rgba(255,230,150,A)", 0.55)(c); c.fillStyle = "#e9d9a0"; rr(c, W / 2 - 34, 250, 68, 44, 4); c.fill(); } };
    objects.push(chamber);
    // hidden inscription (Sofia's lore)
    objects.push({ y: 470, draw: (c) => { c.fillStyle = "rgba(255,230,160,0.10)"; rr(c, 90, 470, 90, 60, 4); c.fill(); c.strokeStyle = "rgba(202,168,74,0.5)"; c.lineWidth = 1; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(100, 482 + i * 12); c.lineTo(170, 482 + i * 12); c.stroke(); } } });

    const interactables = [];
    pedestals.forEach((p, idx) => interactables.push({
      x: p[0], y: p[1] - 8, r: 50, glowR: 22, label: "wake the glyph", repeat: true, onUse: () => {
        if (MET.game._templeSolved) return;
        seq.push(idx); Audio.click();
        if (!seq.every((v, i) => v === order[i])) { Audio.error(); UI.say("The glyphs dim and go cold. That wasn't the order. Look at the carving again.", 3200); seq.length = 0; return; }
        if (seq.length === order.length) { MET.game._templeSolved = true; chamber.visible = true; Audio.success(); MET.game.templeSolved(); }
        else UI.say("It glows, warm and alive under your hand. " + seq.length + " of 4.", 2200);
      },
    }));
    interactables.push({ x: 135, y: 490, r: 58, glowR: 20, label: "a hidden inscription", repeat: true, onUse: () => UI.say("Worn letters, barely there: “The traveler who arrives has already changed. Go home and tell them.”", 6200) });
    return {
      w: W, h: H, spawn: { x: W / 2, y: H - 70 }, speed: 120, softSteps: true, music: "sofia", bed: "room",
      wallColor: "#3a3024", walls, objects, interactables, drawFloor: floorTile("#4a4030", "rgba(0,0,0,0.12)", 50),
      drawOverlay: (ctx) => { ctx.fillStyle = "rgba(16,10,4,0.40)"; ctx.fillRect(0, 0, W, H); glow(400, 130, 320, "rgba(255,220,150,A)", 0.16)(ctx); glow(W / 2, H - 60, 280, "rgba(255,220,170,A)", 0.10)(ctx); },
    };
  }

  /* ============================================================= *
   *  LETTER 3 — DAVID: a classroom AND a separate gym.
   * ============================================================= */
  function buildClassroom() {
    const W = 900, H = 720, T = 26;
    const walls = [{ x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T }, { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H }, { x: 380, y: 540, w: 140, h: 70 }];
    const objects = [];
    // windows (with a picture taped in one), posters, world map
    objects.push({ y: 26, draw: (c) => { for (const x of [110, 690]) { const g = c.createLinearGradient(0, 30, 0, 76); g.addColorStop(0, "#cfe6ff"); g.addColorStop(1, "#9fc4e8"); c.fillStyle = g; rr(c, x, 30, 80, 46, 3); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(x, 30, 80, 46); c.beginPath(); c.moveTo(x + 40, 30); c.lineTo(x + 40, 76); c.moveTo(x, 53); c.lineTo(x + 80, 53); c.stroke(); } c.fillStyle = "#f5ead2"; rr(c, 150, 38, 26, 30, 1); c.fill(); c.fillStyle = "#d88"; c.beginPath(); c.arc(159, 50, 5, 0, 7); c.fill(); c.fillStyle = "#7a9a6a"; c.fillRect(150, 60, 26, 8); c.fillStyle = "#3a8a3a"; rr(c, 760, 32, 36, 42, 2); c.fill(); c.fillStyle = "#7ab8e0"; rr(c, 764, 36, 28, 34, 1); c.fill(); } });
    objects.push({ y: 28, draw: (c) => { c.fillStyle = "#2c3a30"; rr(c, 320, 30, 260, 70, 4); c.fill(); c.strokeStyle = "rgba(255,255,255,0.28)"; c.lineWidth = 2; c.beginPath(); c.moveTo(340, 56); c.lineTo(470, 52); c.moveTo(340, 72); c.lineTo(510, 70); c.moveTo(340, 86); c.lineTo(440, 84); c.stroke(); c.fillStyle = "#caa86a"; rr(c, 430, 96, 60, 8, 2); c.fill(); } });
    objects.push({ y: 1, draw: (c) => rug(c, 250, 180, 400, 250, "#7a5a3a") });
    const seats = [[260, 220, "#8a3a2a"], [430, 220, "#3a5a7a"], [600, 220, "#6a7a3a"], [260, 340, "#7a6a3a"], [600, 340, "#5a3a6a"]];
    seats.forEach((s) => objects.push({ y: s[1] + 40, draw: (c) => { furn(c, s[0] - 42, s[1], 84, 56, "#9a7b50", "#b8965f", 5); c.fillStyle = "#f3ecd9"; rr(c, s[0] - 14, s[1] + 8, 28, 20, 1); c.fill(); draw(c, s[0], s[1] - 16, student(s[2]), Math.PI / 2, 0); } }));
    objects.push({ y: 356, draw: (c) => { furn(c, 388, 340, 84, 56, "#b89160", "#d2ad75", 5); draw(c, 430, 324, LOOKS.elena, Math.PI / 2, 0); } });
    objects.push({ y: 540, draw: (c) => { furn(c, 380, 540, 140, 64, "#6a4a30", "#85603e"); draw(c, 450, 520, LOOKS.david, -Math.PI / 2, 0); c.fillStyle = "#fbf6e8"; rr(c, 400, 552, 28, 36, 2); c.fill(); c.fillStyle = "#c33"; c.beginPath(); c.arc(496, 556, 6, 0, 7); c.fill(); } });
    // door to the gym (right wall)
    objects.push({ y: 360, draw: (c) => { c.fillStyle = "#5a4632"; rr(c, W - T - 4, 320, 14, 80, 2); c.fill(); c.fillStyle = "#caa86a"; c.beginPath(); c.arc(W - T - 1, 360, 3, 0, 7); c.fill(); } });

    const interactables = [
      { x: 450, y: 545, r: 64, glowR: 24, label: "teach the class", once: true, onUse: () => MET.game.davidClass() },
      { x: 430, y: 340, r: 60, glowR: 24, label: "remember Elena", once: true, hidden: true, onUse: () => { MET.game.mark("david", "elena"); UI.say("Three months she didn't speak. Then her hand went up. The room held its breath.", 5600); Audio.sting("warm"); } },
      { x: W - T - 6, y: 360, r: 64, glowR: 26, label: "head to the gym", once: true, hidden: true, onUse: () => MET.game.enterGym() },
      { x: 159, y: 56, r: 56, glowR: 18, label: "a picture in the window", repeat: true, onUse: () => UI.say("A kid's crayon drawing taped to the glass. “Mr. D — best teacher.” Three red hearts.", 5200) },
      { x: 250, y: 50, r: 56, glowR: 16, label: "the chalkboard", repeat: true, onUse: () => UI.say("Long division, half-erased. The chalk dust never really washes out of you.", 4200) },
    ];
    const world = {
      w: W, h: H, spawn: { x: 450, y: 470 }, speed: 120, softSteps: true, music: "david", bed: "room",
      wallColor: "#cdbd9a", walls, objects, interactables, drawFloor: floorPlanks("#b89a6a", "rgba(90,60,30,0.08)"),
      drawOverlay: (ctx) => glow(W / 2, H / 2, 540, "rgba(255,220,160,A)", 0.13)(ctx),
    };
    world.refs = { elena: interactables[1], gym: interactables[2] };
    return world;
  }

  function buildGym() {
    const W = 980, H = 760, T = 28;
    const walls = [{ x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T }, { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H }];
    const objects = [];
    // court lines
    objects.push({ y: 1, draw: (c) => { c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 4; c.strokeRect(70, 70, W - 140, H - 140); c.beginPath(); c.moveTo(W / 2, 70); c.lineTo(W / 2, H - 70); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 70, 0, 7); c.stroke(); c.beginPath(); c.arc(W / 2, 70, 120, 0, Math.PI); c.stroke(); c.beginPath(); c.arc(W / 2, H - 70, 120, Math.PI, 2 * Math.PI); c.stroke(); } });
    // bleachers (top + sides) with a small crowd
    objects.push({ y: 28, draw: (c) => { for (let i = 0; i < 3; i++) { c.fillStyle = lighten("#6a6a72", i * 6); c.fillRect(70, 30 + i * 9, W - 140, 8); } const cols = ["#c33", "#3a6", "#36c", "#ca5", "#a5c", "#5ac"]; for (let i = 0; i < 16; i++) { const x = 110 + i * 50, y = 44 + (i % 2) * 6; c.fillStyle = cols[i % 6]; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.fillStyle = "#caa07a"; c.beginPath(); c.arc(x, y - 5, 4, 0, 7); c.fill(); } } });
    // hoops
    const hoop = (x, flip) => ({ y: 90, draw: (c) => { c.fillStyle = "#caa05a"; rr(c, x - 36, 60, 72, 12, 2); c.fill(); c.strokeStyle = "#dd6622"; c.lineWidth = 6; c.beginPath(); c.arc(x, 84, 24, 0.1, Math.PI - 0.1); c.stroke(); c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 7, 86); c.lineTo(x + i * 5, 104); c.stroke(); } } });
    objects.push(hoop(W / 2, false));
    objects.push({ y: H - 90, draw: (c) => { c.fillStyle = "#caa05a"; rr(c, W / 2 - 36, H - 72, 72, 12, 2); c.fill(); c.strokeStyle = "#dd6622"; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, H - 84, 24, Math.PI + 0.1, 2 * Math.PI - 0.1); c.stroke(); } });
    // the team warming up
    objects.push({ y: 420, draw: (c) => { draw(c, 360, 420, student("#c33"), 0.4, 0); draw(c, 560, 440, student("#c33"), -0.6, 0); draw(c, 470, 520, student("#c33"), Math.PI, 0); draw(c, 620, 520, LOOKS.david, -1.4, 0); } });
    // ball
    objects.push({ y: 560, draw: (c) => { c.fillStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.ellipse(440, 566, 14, 6, 0, 0, 7); c.fill(); c.fillStyle = "#c9622a"; c.beginPath(); c.arc(440, 558, 14, 0, 7); c.fill(); c.strokeStyle = "rgba(0,0,0,0.4)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(426, 556); c.lineTo(454, 560); c.moveTo(440, 545); c.lineTo(440, 571); c.stroke(); } });

    const interactables = [
      { x: 440, y: 558, r: 70, glowR: 26, label: "play with the team", once: true, onUse: () => MET.game.davidHoops() },
      { x: W / 2, y: 110, r: 80, glowR: 20, label: "the hoop", repeat: true, onUse: () => UI.say("Four years without a win. They still show up to every practice. So do I.", 4600) },
    ];
    return {
      w: W, h: H, spawn: { x: W / 2, y: H - 80 }, speed: 124, softSteps: true, music: "david", bed: "room",
      wallColor: "#c2a878", walls, objects, interactables, drawFloor: floorPlanks("#caa86a", "rgba(120,80,30,0.10)"),
      drawOverlay: (ctx) => glow(W / 2, H / 2, 620, "rgba(255,230,180,A)", 0.12)(ctx),
    };
  }

  /* ============================================================= *
   *  DATE  — Nate and Priya, a small restaurant terrace at dusk.
   * ============================================================= */
  function buildCafe() {
    const W = 760, H = 600, T = 24;
    const walls = [{ x: 0, y: 0, w: W, h: T }, { x: 0, y: H - T, w: W, h: T }, { x: 0, y: 0, w: T, h: H }, { x: W - T, y: 0, w: T, h: H }, { x: 330, y: 250, w: 120, h: 90 }];
    const objects = [];
    objects.push({ y: -100, draw: (c) => { const g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, "#3a3a6a"); g.addColorStop(1, "#a86a6a"); c.fillStyle = g; c.fillRect(0, 0, W, 90); skyline(c, 0, 30, W, 60, "#2a2a40"); for (let i = 0; i < 30; i++) { c.fillStyle = "rgba(255,255,255,0.6)"; c.fillRect((i * 91) % W, (i * 37) % 40, 1.5, 1.5); } } });
    // string lights
    objects.push({ y: 90, draw: (c) => { c.strokeStyle = "#5a4a3a"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(40, 100); c.quadraticCurveTo(W / 2, 130, W - 40, 100); c.stroke(); for (let i = 1; i < 12; i++) { const x = 40 + (W - 80) * i / 12, y = 100 + Math.sin(i / 12 * Math.PI) * 28; c.fillStyle = ["#ffd060", "#ffe9a0"][i % 2]; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } } });
    // potted plants
    objects.push({ y: 200, draw: (c) => { plantPot(c, 90, 200, 40); plantPot(c, W - 90, 220, 40); } });
    // their table for two + Priya
    objects.push({ y: 290, draw: (c) => { c.fillStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.ellipse(390, 300, 52, 26, 0, 0, 7); c.fill(); c.fillStyle = "#e8e0d2"; c.beginPath(); c.arc(390, 290, 46, 0, 7); c.fill(); c.fillStyle = "#c9b89a"; c.beginPath(); c.arc(390, 290, 46, 0, 7); c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.arc(372, 286, 7, 0, 7); c.fill(); c.beginPath(); c.arc(408, 286, 7, 0, 7); c.fill(); c.fillStyle = "#d44"; c.fillRect(388, 274, 4, 12); c.fillStyle = "#ffd060"; c.beginPath(); c.arc(390, 272, 3, 0, 7); c.fill(); draw(c, 390, 232, LOOKS.priya, Math.PI / 2, 0); } });
    const interactables = [
      { x: 390, y: 332, r: 78, glowR: 28, label: "join Priya", once: true, onUse: () => MET.game.dateScene() },
    ];
    return {
      w: W, h: H, spawn: { x: W / 2, y: H - 70 }, speed: 100, softSteps: true, music: "date", bed: "outside",
      wallColor: "#5a4a40", walls, objects, interactables, drawFloor: floorTile("#6a5648", "rgba(0,0,0,0.10)", 54),
      drawOverlay: (ctx) => { ctx.fillStyle = "rgba(40,30,50,0.28)"; ctx.fillRect(0, 0, W, H); glow(390, 290, 220, "rgba(255,210,140,A)", 0.22)(ctx); },
    };
  }

  /* ============================================================= *
   *  ENDING FIELD  — everyone, a city on the horizon, then the sky.
   * ============================================================= */
  function buildField() {
    const W = 1200, H = 760;
    const cast = [
      [360, 360, LOOKS.marcus, "Marcus"], [470, 410, LOOKS.sofia, "Sofia"], [600, 380, LOOKS.david, "David"],
      [720, 420, LOOKS.priya, "Priya"], [540, 470, LOOKS.kid, "the kid"], [820, 380, LOOKS.elena, "Elena"],
      [410, 470, LOOKS.elder, "the elder"], [690, 480, LOOKS.woman, "a friend"],
    ];
    const flowers = []; for (let i = 0; i < 120; i++) flowers.push([Math.random() * W, 300 + Math.random() * (H - 320), ["#e8d24a", "#e88ab0", "#ffffff", "#c86ad0"][i % 4]]);
    const objects = [{ y: 1, draw: (c) => { for (const f of flowers) { c.fillStyle = f[2]; c.beginPath(); c.arc(f[0], f[1], 2.4, 0, 7); c.fill(); } } }];
    cast.forEach((p) => objects.push({ y: p[1], draw: (c) => draw(c, p[0], p[1], p[2], Math.PI / 2, 0) }));
    const interactables = [{ x: 560, y: 420, r: 130, glowR: 30, label: "stand with everyone", once: true, onUse: () => MET.game.beginSkyPan() }];
    return {
      w: W, h: H, spawn: { x: 560, y: 660 }, speed: 92, softSteps: false, music: "credits", bed: "outside",
      panning: false, panY: 0, walls: [{ x: -40, y: -40, w: W + 80, h: 60 }, { x: -40, y: H - 16, w: W + 80, h: 56 }, { x: -40, y: -40, w: 20, h: H + 80 }, { x: W - 20, y: -40, w: 20, h: H + 80 }],
      objects, interactables,
      onUpdate: function (dt) { if (this.panning) { this.panY += dt * 360; E.cam.y -= dt * 360; } },
      drawFloor: function (ctx) {
        const g = ctx.createLinearGradient(0, -1600, 0, H); g.addColorStop(0, "#02030a"); g.addColorStop(0.18, "#0a1230"); g.addColorStop(0.34, "#36507e"); g.addColorStop(0.46, "#8fb6e0"); g.addColorStop(0.56, "#bfe0ff"); g.addColorStop(0.66, "#cfeaff"); g.addColorStop(0.72, "#bfe6a8"); g.addColorStop(1, "#8fc079");
        ctx.fillStyle = g; ctx.fillRect(0, -1700, W, H + 1700);
        // stars in the upper region
        for (let i = 0; i < 200; i++) { const sx = (i * 53) % W, sy = -1700 + (i * 71) % 1500; ctx.fillStyle = "rgba(255,255,255," + (0.4 + Math.sin(performance.now() / 600 + i) * 0.3) + ")"; ctx.fillRect(sx, sy, 1.6, 1.6); }
        // clouds
        ctx.fillStyle = "rgba(255,255,255,0.85)"; for (let i = 0; i < 10; i++) { const cx = (i * 137) % W, cy = -260 - (i % 4) * 90; ctx.beginPath(); ctx.ellipse(cx, cy, 70, 30, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx + 44, cy + 10, 50, 24, 0, 0, 7); ctx.fill(); }
        // city skyline on the horizon
        skyline(ctx, 0, 250, W, 70, "#6a6478");
        ctx.fillStyle = "rgba(255,250,220,0.0)";
        glow(W * 0.7, 230, 280, "rgba(255,245,210,A)", 0.7)(ctx);
        // grass field
        ctx.fillStyle = "#8fc079"; ctx.fillRect(0, 300, W, H - 300);
        ctx.fillStyle = "rgba(0,0,0,0.05)"; for (let x = 0; x < W; x += 16) ctx.fillRect(x, 300, 1, H);
      },
      drawOverlay: () => {},
    };
  }

  /* ============================================================= *
   *  MINIGAMES
   * ============================================================= */
  function shooterGame(onDone) {
    const LET = "ASDFGHJKLQWERTYUIOPZXCVBNM";
    return {
      enemies: [], spawnT: 0.6, killed: 0, lives: 3, target: 12, done: false, cx: 0, py: 0, flash: 0,
      start(E) { this.cx = E.W / 2; this.py = E.H - 150; UI.mg("INCOMING — type each letter to fire", "♥♥♥   0 / " + this.target); },
      update(dt, E) {
        if (this.done) return; this.flash = Math.max(0, this.flash - dt);
        this.cx = E.W / 2; this.py = E.H - 150; this.spawnT -= dt;
        if (this.spawnT <= 0 && this.killed + this.enemies.length < this.target) { this.spawn(E); this.spawnT = 0.9 + Math.random() * 0.6; }
        for (const en of this.enemies) { const dx = this.cx - en.x, dy = this.py - en.y, d = Math.hypot(dx, dy) || 1; en.x += dx / d * en.sp * dt; en.y += dy / d * en.sp * dt; if (d < 32) { en.hit = true; this.lives--; this.flash = 0.4; Audio.hit(); } }
        this.enemies = this.enemies.filter((e) => !e.hit && !e.dead);
        UI.mg(null, "♥".repeat(Math.max(0, this.lives)) + "   " + this.killed + " / " + this.target);
        if (this.lives <= 0) this.finish(E, false); else if (this.killed >= this.target) this.finish(E, true);
      },
      spawn(E) { this.enemies.push({ x: 60 + Math.random() * (E.W - 120), y: -20, sp: 34 + Math.random() * 18, ch: LET[Math.floor(Math.random() * LET.length)] }); },
      onKey(e) { const k = (e.key || "").toUpperCase(); if (k.length !== 1 || k < "A" || k > "Z") return; let best = null, bd = -1; for (const en of this.enemies) if (en.ch === k && en.y > bd) { bd = en.y; best = en; } if (best) { best.dead = true; this.killed++; Audio.gunshot(); } else Audio.error(); },
      drawScreen(ctx, W, H) {
        if (this.flash > 0) { ctx.fillStyle = "rgba(180,30,20," + this.flash * 0.5 + ")"; ctx.fillRect(0, 0, W, H); }
        ctx.fillStyle = "#3f434c"; ctx.beginPath(); ctx.arc(this.cx, this.py, 18, 0, 7); ctx.fill(); ctx.fillStyle = "#e3b48f"; ctx.beginPath(); ctx.arc(this.cx, this.py - 5, 9, 0, 7); ctx.fill();
        for (const en of this.enemies) { ctx.strokeStyle = "rgba(255,180,160,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.cx, this.py); ctx.lineTo(en.x, en.y); ctx.stroke(); ctx.fillStyle = "#7a2a20"; ctx.beginPath(); ctx.arc(en.x, en.y, 18, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(en.ch, en.x, en.y); }
      },
      finish(E, win) { if (this.done) return; this.done = true; E.endMinigame(); if (win) Audio.success(); onDone && onDone(win); },
    };
  }

  function hoopGame(onDone) {
    return {
      made: 0, need: 3, shots: 0, total: 8, power: 0, dir: 1, sp: 0.75, state: "aim", ball: null, msg: "", msgT: 0, done: false,
      start() { UI.mg("BASKETBALL — tap SPACE when the bar is in the green", "0 / " + this.need); },
      update(dt) {
        if (this.done) return; this.msgT = Math.max(0, this.msgT - dt);
        if (this.state === "aim") { this.power += this.dir * this.sp * dt; if (this.power >= 1) { this.power = 1; this.dir = -1; } if (this.power <= 0) { this.power = 0; this.dir = 1; } }
        else if (this.state === "shot") { this.ball.t += dt; if (this.ball.t >= 1) { if (this.ball.good) { this.made++; this.msg = ["SWISH!", "NICE!", "GOT IT!"][this.made % 3]; Audio.swish(); } else { this.msg = "off the rim"; Audio.bounce(); } this.msgT = 1.1; UI.mg(null, this.made + " / " + this.need); this.shots++; if (this.made >= this.need) return this.finish(true); if (this.shots >= this.total) return this.finish(this.made >= this.need); this.state = "aim"; this.sp = Math.min(1.3, this.sp + 0.06); this.ball = null; } }
      },
      shoot() { if (this.state !== "aim" || this.done) return; const good = this.power > 0.40 && this.power < 0.60; this.state = "shot"; this.ball = { t: 0, good, p: this.power }; },
      onKey(e) { if (e.key === " ") { e.preventDefault(); this.shoot(); } },
      onClick() { this.shoot(); },
      drawScreen(ctx, W, H) {
        const cx = W / 2, hoopY = H * 0.24;
        // backboard + rim + net
        ctx.fillStyle = "#e6ddc8"; rr(ctx, cx - 60, hoopY - 50, 120, 54, 4); ctx.fill(); ctx.strokeStyle = "#caa05a"; ctx.lineWidth = 3; rr(ctx, cx - 24, hoopY - 36, 48, 30, 2); ctx.stroke();
        ctx.strokeStyle = "#dd6622"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cx, hoopY + 8, 30, 0.05, Math.PI - 0.05); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 7, hoopY + 10); ctx.lineTo(cx + i * 4.5, hoopY + 34); ctx.stroke(); }
        // power bar
        const bw = 360, bx = cx - bw / 2, by = H * 0.76;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; rr(ctx, bx, by, bw, 22, 11); ctx.fill();
        ctx.fillStyle = "rgba(70,200,90,0.7)"; ctx.fillRect(bx + bw * 0.40, by, bw * 0.20, 22);
        ctx.fillStyle = "#fff"; ctx.fillRect(bx + bw * this.power - 2.5, by - 8, 5, 38);
        // ball
        if (this.state === "shot" && this.ball) { const p = this.ball.t, sx = cx + (this.ball.good ? 0 : (this.ball.p < 0.5 ? -1 : 1) * 40) * p, sy = by - (by - hoopY) * p - Math.sin(p * Math.PI) * 80; ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.beginPath(); ctx.arc(sx, by, 12 * (1 - p) + 3, 0, 7); ctx.fill(); ctx.fillStyle = "#c9622a"; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 15, sy); ctx.lineTo(sx + 15, sy); ctx.moveTo(sx, sy - 15); ctx.lineTo(sx, sy + 15); ctx.stroke(); }
        else { ctx.fillStyle = "#c9622a"; ctx.beginPath(); ctx.arc(cx, by - 30, 15, 0, 7); ctx.fill(); }
        if (this.msgT > 0) { ctx.fillStyle = "rgba(255,255,255," + Math.min(1, this.msgT) + ")"; ctx.font = "bold 30px Georgia"; ctx.textAlign = "center"; ctx.fillText(this.msg, cx, H * 0.5); }
      },
      finish(win) { if (this.done) return; this.done = true; setTimeout(() => { E.endMinigame(); if (win) Audio.success(); onDone && onDone(win); }, 1100); },
    };
  }

  /* ============================================================= *
   *  LETTERS — text.
   * ============================================================= */
  const LETTERS = {
    marcus: { name: "Marcus", scene: buildMarcus, phaseAfter: 1, song: "marcus",
      pages: ["Nate —\n\nBet you never thought you'd hear from me. I enlisted right out of school. What you don't know is what it gave me.",
        "It wasn't the war. It was the people. A squad that became brothers. A family with nothing who fed us anyway. A kid who drew me a picture I still keep.",
        "Come walk through it with me. You'll see.\n\nHome was never a place. It's whoever shows up for you."], sig: "— Marcus" },
    sofia: { name: "Sofia", scene: buildSofia, phaseAfter: 2, song: "sofia",
      pages: ["Nate,\n\nI quit. Bought a one-way ticket to Santiago and walked into the mountains with a backpack and no plan.",
        "Freezing nights under impossible stars. A guide who spoke no English and somehow said everything. And then — a temple, in a valley no map covers.",
        "Ancient. Overgrown. Forgotten. Go inside. See what I saw.\n\nThe world doesn't stop being magical because you stopped looking."], sig: "— Sofia" },
    david: { name: "David", scene: buildClassroom, phaseAfter: 3, song: "david",
      pages: ["Hey Nate,\n\nNo mountains here. No war stories. I stayed. I teach third grade in a town you've never heard of.",
        "There's a girl, Elena, who didn't speak for three months. A team that hadn't won in four years. A dad in muddy boots who cried thanking me.",
        "Spend a day in my school. You'll understand.\n\nI never climbed anything. But I matter to someone. That's the greatest adventure I can imagine."], sig: "— David" },
  };

  /* ============================================================= *
   *  GAME
   * ============================================================= */
  MET.game = {
    apartment: null, phase: 0, letterIndex: 0, day: 0,
    order: ["marcus", "sofia", "david"],
    choices: { marcus: null, sofia: null, david: null },
    _gate: null, _templeSolved: false, _carrying: false,

    gate() { return new Promise((r) => { this._gate = r; }); },
    pass() { const r = this._gate; this._gate = null; if (r) r(); },
    mark(letter, focus) { this.choices[letter] = focus; },

    async start() {
      Audio.start(); Music.init();
      this.phase = 0; this.letterIndex = 0; this.day = 0; this._carrying = false;
      this.choices = { marcus: null, sofia: null, david: null };
      E.running = true; E.startLoop();
      this.apartment = buildApartment(); this.apartment.setPhase(0); this.apartment.setTime("morning");
      Grade.setPhaseInstant(0);
      await E.enterWorld(this.apartment);
      Music.rebuildNate(0); Music.play("nate");
      document.getElementById("title").classList.add("hide");
      await wait(1100); document.getElementById("title").classList.add("hidden");
      await this.runDay(0);
    },

    async enterApartment(time) {
      if (!this.apartment) this.apartment = buildApartment();
      this.apartment.setPhase(this.phase); this.apartment.setTime(time || "day");
      await E.enterWorld(this.apartment);
    },

    async runDay(day) {
      this.day = day;
      await this.morning(day);
      await this.commute(day, false);
      await this.office(day);
      await this.commute(day, true);
      await this.evening(day);
      E.cinematic = false; this.armMail(true);
      MET.objectives.set("Today", ["Read the letter waiting in the mailbox"]);
      UI.setHint("a letter is in the mailbox — walk to it and press E"); setTimeout(() => UI.hideHint(), 7000);
    },

    async morning(day) {
      await this.enterApartment("morning"); MET.objectives.clear(); Music.rebuildNate(this.phase); Music.play("nate");
      E.cinematic = true; const rapid = day === 0;
      const beats = day === 0 ? [
        { p: [135, 180], s: "The alarm again. Tuesday. Or Wednesday. Does it matter?" },
        { p: [305, 130], s: "Bathroom mirror. I don't really look anymore." },
        { p: [790, 120], s: "Same fridge light. Same nothing inside." },
        { p: [470, 250], s: "Keys. Door. Go. Another day disappears." },
      ] : [
        { p: [135, 180], s: day >= 3 ? "I woke before the alarm. Because I wanted to." : "Morning. The light through the blinds is a little different." },
        { p: [305, 130], s: day >= 2 ? "I actually looked at myself today. Really looked." : "I splash water on my face. I breathe." },
        { p: [790, 120], s: day >= 3 ? "I make a real breakfast. Eggs. The yolk is so impossibly yellow." : "There's more in the fridge than I remembered buying." },
      ];
      for (const b of beats) { E.player.x = b.p[0]; E.player.y = b.p[1]; E.snapCamera(); UI.say(b.s, 0); await Blink.blink(rapid ? { close: 90, hold: 560, open: 170 } : { close: 170, hold: 280, open: 440 }); await wait((rapid ? 2900 : 1700) / MET.settings.textSpeed); }
      UI.hush();
    },

    async commute(day, returning) {
      await Blink.cover(async () => { await E.enterWorld(buildRoad(day, returning)); Music.play("nate"); }, { close: 520, hold: 200, open: 760 });
      E.cinematic = true;
      const out = ["The commute. Fifteen minutes I'll never remember.", "The drive in. I keep the radio off — but today I'm actually listening to the quiet.", "Traffic. I used to grip the wheel. Today I just watch the city slide by.", "The road downtown. People in every window, each one a whole life."];
      const home = ["Driving home. The same road, run backwards.", "Red light. ...The tree on the corner is blooming. When did that happen?", "Home, the long way. I rolled the window down. The air smelled like rain.", "The drive home. I waved at the crossing guard. She waved back."];
      UI.say((returning ? home : out)[Math.min(day, 3)], 0);
      await wait((day === 0 ? 3600 : 4600) / MET.settings.textSpeed); UI.hush();
    },

    async office(day) {
      await Blink.cover(async () => { await E.enterWorld(buildOffice(day)); }, { close: 520, hold: 200, open: 820 });
      E.cinematic = false;
      MET.objectives.set("At work", day >= 2 ? ["Sit at your desk", "Say hi to Priya", "Head home through the door"] : ["Sit at your desk", "Head home through the door"]);
      UI.setHint("get to your desk"); setTimeout(() => UI.hideHint(), 5000);
      await this.gate(); UI.hideHint(); MET.objectives.clear();
    },

    async evening(day) {
      MET.objectives.clear();
      await Blink.cover(async () => { await this.enterApartment("evening"); Music.rebuildNate(this.phase); Music.play("nate"); }, { close: 600, hold: 200, open: 900 });
      E.cinematic = true; E.player.x = 245; E.player.y = 510; E.snapCamera();
      UI.say(day >= 3 ? "I cooked tonight. Sat at the table. Actually tasted it." : "Microwave dinner on the couch. The TV talks to itself.", 0);
      await Blink.blink({ close: 150, hold: 320, open: 520 }); await wait(3200 / MET.settings.textSpeed); UI.hush();
      E.player.x = this.apartment.spawn.x; E.player.y = this.apartment.spawn.y; E.snapCamera();
    },

    armMail(on) { this.apartment.refs.flag.raised = on; this._mailReady = on; },
    mailboxUse() { if (this._carrying) return this.deliverLetter(); return this.checkMail(); },
    async checkMail() {
      if (this.letterIndex >= this.order.length) { UI.say("Empty. But that's all right now.", 2600); return; }
      if (!this._mailReady) { UI.say("Nothing yet today.", 2400); return; }
      this._mailReady = false; this.apartment.refs.flag.raised = false; UI.unfocus(); E.focusObj = null;
      await this.openLetter();
    },

    async openLetter() {
      const L = LETTERS[this.order[this.letterIndex]];
      E.cinematic = true; await Reader.read(L.pages, L.sig); Grade.toFull(0.1);
      await E.enterWorld(L.scene()); Music.play(L.song); await Reader.close();
      await UI.card(L.name, "a letter from " + L.name.toLowerCase(), 3000);
      E.cinematic = false; this._templeSolved = false;
      const objs = {
        marcus: ["Talk to the family at the campfire", "Talk to the squad", "When ready, take the watch post"],
        sofia: ["Find Sofia at the overlook", "Enter the temple"],
        david: ["Teach your class", "Then head down the hall to the gym"],
      }[this.order[this.letterIndex]];
      MET.objectives.set("In " + L.name + "'s letter", objs);
      UI.setHint("explore freely — glowing things are interactive (E). objectives: Tab"); setTimeout(() => UI.hideHint(), 8000);
    },

    /* Marcus */
    async startMarcusDefense() {
      MET.objectives.complete("watch post"); MET.objectives.set("Under attack", ["Type each enemy's letter to fend off the assault"]);
      E.cinematic = true; UI.hush(); await UI.card("INCOMING", "the base is under attack", 2400); Audio.error(); E.cinematic = false;
      E.startMinigame(shooterGame(async (win) => {
        E.cinematic = true; await wait(600);
        UI.say(win ? "We held. Everyone made it. Marcus claps me on the back, grinning through the dust." : "It was chaos. But Marcus pulled me clear without thinking. We made it. Together.", 5200);
        await wait(5200); UI.say("Home isn't a place, Nate. It's the people who'd run into the dark for you.", 5400);
        await wait(5400); E.world.refs.drawing.hidden = false; E.cinematic = false;
        MET.objectives.set("One last thing", ["Pick up the child's drawing"]);
        UI.setHint("pick up the drawing");
      }));
    },

    /* Sofia */
    async enterTemple() {
      E.cinematic = true; UI.unfocus(); E.focusObj = null;
      MET.objectives.complete("Enter the temple");
      await Blink.cover(async () => { await E.enterWorld(buildTemple()); }, { close: 700, hold: 200, open: 1000 });
      E.cinematic = false; UI.say("Four glyphs. The carving on the wall is lit, showing an order. Wake them in sequence.", 5800);
      MET.objectives.set("Inside the temple", ["Read the lit carving on the back wall", "Wake the four glyphs in that order"]);
      UI.setHint("read the lit carving, then wake the glyphs in that order"); setTimeout(() => UI.hideHint(), 8000);
    },
    async templeSolved() {
      E.cinematic = true; UI.hush(); await wait(800);
      UI.say("Stone grinds on stone. The inner chamber opens, and warm light spills across the floor.", 5200); await wait(5200);
      UI.say("Forgotten, breathtaking, and nobody told me it was still here.", 4600); await wait(4600);
      UI.say("The world doesn't stop being magical just because you stopped looking.", 5400); await wait(5400);
      this.mark("sofia", "temple"); this.endLetter();
    },

    /* David */
    async davidClass() {
      E.cinematic = true;
      await UI.converse([
        { name: "David", text: "Alright, eyes up here. Who can tell me what eight times seven is?" },
        { name: "(the room)", text: "(silence — a few hands hover, then drop)" },
        { name: "David", text: "Elena? ...It's okay. No rush. Take your time." },
        { name: "Elena", text: "(barely a whisper) ...fifty-six." },
        { name: "David", text: "Fifty-six. Exactly right. Well done, Elena. I knew you had it." },
        { name: "Nate", text: "(She hadn't spoken in three months. The whole room is holding its breath.)" },
      ]);
      this.mark("david", "elena"); Audio.sting("warm");
      MET.objectives.complete("Teach your class");
      const w = E.world; w.refs.elena.hidden = false; w.refs.gym.hidden = false;
      E.cinematic = false; UI.say("After class, the team's waiting in the gym down the hall.", 5000);
      UI.setHint("head to the gym when you're ready"); setTimeout(() => UI.hideHint(), 7000);
    },
    async enterGym() {
      MET.objectives.complete("gym");
      E.cinematic = true; UI.unfocus(); E.focusObj = null;
      await Blink.cover(async () => { await E.enterWorld(buildGym()); }, { close: 600, hold: 200, open: 900 });
      E.cinematic = false; UI.say("The gym. Squeaky floors, a banner from 2009, and a team that believes anyway.", 5000);
      MET.objectives.set("Game time", ["Play basketball with the team"]);
      UI.setHint("walk to the ball and play with the team"); setTimeout(() => UI.hideHint(), 7000);
    },
    async davidHoops() {
      E.cinematic = false;
      E.startMinigame(hoopGame(async (win) => {
        E.cinematic = true; await wait(500);
        if (win) { this.mark("david", "team"); UI.say("The gym ERUPTS. First win in four years. It sounds like a stadium in here.", 5400); }
        else UI.say("We lost by two. But they're laughing, breathless, alive. So am I.", 5400);
        await wait(5400); UI.say("I never climbed a mountain. But I matter to someone. That's the whole adventure.", 5800);
        await wait(5800); this.endLetter();
      }));
    },

    async endLetter() {
      const L = LETTERS[this.order[this.letterIndex]];
      UI.unfocus(); E.focusObj = null; UI.hush(); E.endMinigame(); E.cinematic = true; MET.objectives.clear();
      const newPhase = L.phaseAfter;
      await Blink.cover(async () => { this.phase = newPhase; this.letterIndex++; await this.enterApartment("day"); Music.rebuildNate(newPhase); Music.play("nate"); Grade.toPhase(newPhase, 4.5); }, { close: 900, hold: 500, open: 1900 });
      E.cinematic = false; this.afterReturnBeat(newPhase);
      await wait(6500);
      if (this.letterIndex < this.order.length) await this.runDay(this.letterIndex);
      else await this.dateDay();
    },

    afterReturnBeat(phase) {
      const lines = ["", "Something's different. There's a plant on the sill I don't remember buying.", "It's warmer in here. There's a photo on the fridge — us, years ago, mid-laugh.", "...color. All of it. The apartment that felt like a cell feels like home."];
      if (lines[phase]) setTimeout(() => UI.say(lines[phase], 6000), 2200);
    },

    /* ---- the date with Priya ---- */
    async dateDay() {
      this.day = 4;
      await this.morning(3);
      await this.enterApartment("day"); E.cinematic = true;
      UI.say("Priya called. She asked if I wanted to get dinner. I said yes before I could talk myself out of it.", 6000);
      await wait(6200); UI.hush();
      await Blink.cover(async () => { await E.enterWorld(buildCafe()); Music.play("date"); }, { close: 700, hold: 300, open: 1100 });
      await UI.card("that evening", "", 2600);
      E.cinematic = false; MET.objectives.set("A date", ["Walk over and join Priya at the table"]);
      UI.setHint("go and join Priya"); setTimeout(() => UI.hideHint(), 6000);
    },
    async dateScene() {
      MET.objectives.clear(); E.cinematic = true; UI.unfocus(); E.focusObj = null;
      await UI.converse([
        { name: "Priya", text: "You came. I half-thought you'd cancel." },
        { name: "Nate", text: "Old me would have. I'm trying not to be him anymore." },
        { name: "Priya", text: "I like this version. He looks at things. ...So what are these letters, really?" },
        { name: "Nate", text: "Three friends I lost touch with. They wrote to remind me I used to be alive." },
        { name: "Priya", text: "And? Are you?" },
        { name: "Nate", text: "(I look at her across the candle, the city humming behind us.) ...Yeah. I think I finally am." },
        { name: "Priya", text: "Good. Then write them back. Tell them. And then — call me tomorrow?" },
        { name: "Nate", text: "Tomorrow. I promise." },
      ]);
      UI.say("We talked until the lights came on across the whole city. I walked home smiling like an idiot.", 6000);
      await wait(6200);
      await this.finalDay();
    },

    /* ---- final day: write, then carry the letter to the mailbox ---- */
    async finalDay() {
      this.day = 5;
      await this.morning(3);
      await this.enterApartment("day"); Grade.toFull(1.5); Music.rebuildNate(3); Music.play("nate"); E.cinematic = false;
      UI.say("No letter today. No commute. Just a blank page on the desk. And a pen.", 6500);
      this.apartment.refs.page.visible = true; this.apartment.armWrite();
      MET.objectives.set("The last letter", ["Sit at the desk and write to your friends"]);
      UI.setHint("sit at the desk and write"); setTimeout(() => UI.hideHint(), 8000);
    },
    async writeFinalLetter() {
      UI.unfocus(); E.focusObj = null; UI.hush(); E.cinematic = true; Audio.sting("warm");
      await Reader.read(this.assembleLetter(), "— Nate", { noBleed: true }); Reader.hideNow();
      this._carrying = true; this.apartment.refs.flag.raised = false;
      this.apartment.refs.mailbox && (this.apartment.refs.mailbox.label = "mail your letter");
      const mb = this.apartment.interactables[0]; mb.label = "mail your letter";
      E.cinematic = false;
      MET.objectives.set("The last letter", ["Carry the sealed envelope to the mailbox"]);
      UI.say("The envelope is sealed and warm in your hand. Three names on the front.", 5200);
      UI.setHint("carry the letter to the mailbox and press E"); setTimeout(() => UI.hideHint(), 8000);
    },
    async deliverLetter() {
      this._carrying = false; MET.objectives.clear(); UI.unfocus(); E.focusObj = null; E.cinematic = true;
      this.apartment.refs.flag.raised = true;
      UI.say("You slide it in and lift the little red flag. Done. Sent. Out in the world.", 5000);
      await wait(5200);
      await this.ending();
    },

    /* ---- ending: the field, then up into the stars ---- */
    async ending() {
      await Blink.cover(async () => { await E.enterWorld(buildField()); E.cinematic = false; Music.play("credits"); }, { close: 1100, hold: 500, open: 1800 });
      UI.say("And then — a field, golden in the late sun. Everyone is here. Everyone who pulled me back.", 6500);
      MET.objectives.set("Home", ["Walk to your friends in the field"]);
      UI.setHint("walk to your friends"); setTimeout(() => UI.hideHint(), 7000);
      this._skyStarted = false;
      this._skyTimer = setTimeout(() => { if (!this._skyStarted) this.beginSkyPan(); }, 22000);
    },
    beginSkyPan() {
      if (this._skyStarted) return; this._skyStarted = true; clearTimeout(this._skyTimer);
      MET.objectives.clear(); UI.unfocus(); E.focusObj = null; UI.hush(); E.cinematic = true;
      E.world.panning = true;
      setTimeout(async () => {
        await UI.card("METANOIA", "the change of heart", 4800);
        await wait(900); await this.rollCredits(); await this.returnToMenu();
      }, 6500);
    },

    openBoard() {
      const list = document.getElementById("boardList"); list.innerHTML = "";
      const unlocked = this.order.slice(0, this.letterIndex);
      if (!unlocked.length) list.innerHTML = "<div style='color:#8b8478;font-style:italic'>No letters yet.</div>";
      unlocked.forEach((key) => { const L = LETTERS[key]; const el = document.createElement("div"); el.className = "board-letter"; el.textContent = "A letter from " + L.name; el.onclick = async () => { document.getElementById("board").classList.add("hidden"); E.cinematic = true; await Reader.read(L.pages, L.sig, { noBleed: true }); await Reader.close(); E.cinematic = false; this.openBoard(); }; list.appendChild(el); });
      document.getElementById("board").classList.remove("hidden"); E.cinematic = true;
    },
    closeBoard() { document.getElementById("board").classList.add("hidden"); E.cinematic = false; },

    assembleLetter() {
      const c = this.choices;
      const m = { family: "Marcus — you were right. Home was never a place. It's the people who show up. I forgot I had any.", squad: "Marcus — the brothers you found out there. I haven't let anyone stay up in the dark with me in years. I want to." }[c.marcus || "family"];
      const s = { overlook: "Sofia — the world really is bigger than these walls. I stopped looking. I'm going to start again.", temple: "Sofia — something beautiful is still out there, forgotten, waiting. You reminded me it's worth finding." }[c.sofia || "temple"];
      const d = { elena: "David — Elena raising her hand undid me. Courage is just speaking after a long silence. I've been silent a long time.", team: "David — your first win in four years. The small ones count. They might be the only ones that do." }[c.david || "elena"];
      return ["Marcus. Sofia. David.\n\nIt's Nate. I know it's been years. Your letters reached me at the bottom of something I couldn't name.",
        m + "\n\n" + s,
        d + "\n\nYou pulled me out of the dark without knowing I was in it. There's even someone new — her name is Priya. I'm writing my own story now. Thank you for reminding me there's one worth telling."];
    },

    rollCredits() {
      return new Promise((resolve) => {
        const cc = document.getElementById("credits"), roll = document.getElementById("creditsRoll");
        roll.innerHTML =
          "<h3>METANOIA</h3><div class='role'>a game about noticing</div><div class='sp'></div>" +
          "<div>Story &amp; game design document</div><div class='role'>written by</div><div style='font-size:24px'>Connor Corkum</div><div class='sp'></div>" +
          "<div>Nathan</div><div class='role'>who finally looked up</div><div class='sp'></div>" +
          "<div>Marcus &nbsp;·&nbsp; Sofia &nbsp;·&nbsp; David</div><div class='role'>who reminded him</div><div class='sp'></div>" +
          "<div>Priya</div><div class='role'>who was there all along</div><div class='sp'></div>" +
          "<div class='role'>art, music &amp; code</div><div>generated live, no assets</div><div class='sp'></div><div class='sp'></div>" +
          "<div>thank you for noticing.</div><div class='sp'></div><div class='sp'></div>";
        cc.classList.remove("hidden"); void cc.offsetWidth; cc.classList.add("show");
        roll.style.transition = "top 30s linear"; roll.style.top = "-" + roll.offsetHeight + "px";
        let done = false;
        const finish = () => { if (done) return; done = true; window.removeEventListener("keydown", skip); window.removeEventListener("mousedown", skip); cc.classList.remove("show"); setTimeout(() => { cc.classList.add("hidden"); roll.style.transition = "none"; roll.style.top = "100%"; resolve(); }, 1400); };
        const skip = () => finish();
        window.addEventListener("keydown", skip); window.addEventListener("mousedown", skip);
        setTimeout(finish, 31000);
      });
    },

    async returnToMenu() {
      await Blink.cover(async () => { E.stopGame(); MET.objectives.clear(); Music.play("menu"); this.phase = 0; this.letterIndex = 0; this.day = 0; this.apartment = null; this._carrying = false; this.choices = { marcus: null, sofia: null, david: null }; Grade.setPhaseInstant(0); document.getElementById("title").classList.remove("hide", "hidden"); }, { close: 900, hold: 300, open: 1400 });
    },
    quitToMenu() { E.hidePause(); this.returnToMenu(); },
  };

  // exposed for quick visual testing / debugging
  MET.scenes = { apartment: buildApartment, office: buildOffice, road: buildRoad, marcus: buildMarcus, sofia: buildSofia, temple: buildTemple, classroom: buildClassroom, gym: buildGym, cafe: buildCafe, field: buildField };
})();
