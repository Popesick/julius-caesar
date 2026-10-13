// Spiel-Engine "Julius Caesar" – Nachbau auf Basis der rekonstruierten Regeln des
// C64-Originals (Kingsoft 1989). Reine Logik, keine UI. Siehe ../DESIGN.md.
// Namen in Klammern verweisen auf die BASIC-Variablen bzw. Zeilen des Originals (HP-Programm).
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : { TRIBES, LEGION_START };
  const DATA_TRIBES = D.TRIBES, START = D.LEGION_START;

  const MAX_LEGION = 9000, MAX_MONEY = 990000, N_TRIBES = 30;

  // ---------------------------------------------------------------- Start
  function createGame(sp = 1, rnd = Math.random, rules = {}) {
    const g = {
      sp, rnd, rules: { mercs: false, combined: false, wealth: false, slaves: false, ...rules }, cohorts: [], year: 1, rv: 30000,                       // RV: Vermoegen in Denaren
      kf: 0, lastX: 0, vs: 0, ga: 0,                     // KF: Winterangriff im Vorjahr, VS/GA: laufende Belagerung
      vx: 0, negotiated: [],                             // VX/V(): Verhandlungen dieses Jahres
      tribes: [null], legions: [null], over: null,
    };
    for (const t of DATA_TRIBES) g.tribes[t.id] = {
      id: t.id, name: t.name, group: t.group, x: t.x, y: t.y,
      be: t.pop, pop0: t.pop,                            // BE: Bevoelkerung (Krieger = BE/5); pop0: Ausgangsgroesse
      br: t.attitude,                                    // BR: Haltung gegenueber Rom (0 = Krieg)
      vt: 0,                                             // VT: 0 frei, 1 Friedensvertrag, 2 Freundschaftsvertrag
      gr: 0, ex: 0, rk: 0, rs: 0, tr: 0, hi: 0,          // Geiseln, zerstoert, Kriege, Roemer-Siege, Tribut, Hilfstruppen
    };
    for (let i = 1; i <= 4; i++) g.legions[i] = { le: 4500, mv: 5, kl: 0, sl: 0, at: 0, x: START.x, y: START.y };
    // Spielstaerke (SP 1..5), Zeilen 190-240
    if (sp === 5) { for (let i = 1; i <= N_TRIBES; i++) g.tribes[i].br = Math.floor(rnd() * 6); g.tribes[20].br = 10; g.rv = 50000; }
    if (sp === 3) for (let i = 1; i <= 4; i++) g.legions[i].le = 2500;
    if (sp === 2 || sp === 4) { if (sp === 4) g.rv = 8000; for (let i = 1; i <= N_TRIBES; i++) lowerRaw(g, i); }
    return g;
  }

  // BR-1 mit den Aufraeum-Regeln des Originals (Zeilen 4770-4790 / 1840-1845)
  function lowerRaw(g, i) { const t = g.tribes[i]; t.br -= 1; if (t.br < 1) { t.br = 0; t.vt = 0; } }
  function cleanup(t) { if (t.br < 1) { t.br = 0; t.vt = 0; t.tr = 0; } if (t.br < 11 && t.vt === 2) { t.vt = 0; t.hi = 0; } }

  // ---------------------------------------------------------------- Jahresanfang
  // Zeilen 2535-2538: SP zufaellige Staemme verlieren 1 Haltung (ausser Freunde, VT=2)
  function beginYear(g) {
    const events = [];
    for (let i = 0; i < g.sp; i++) {
      const o = Math.floor(g.rnd() * 30) + 1, t = g.tribes[o];
      if (t.vt < 2) t.br -= 1;
      if (t.br < 1) { t.vt = 0; t.tr = 0; t.br = 0; }
      events.push(o);
    }
    g.vx = 0; g.negotiated = []; g.vs = 0;
    return events;
  }

  // ---------------------------------------------------------------- Hilfen
  const pacified = g => g.tribes.reduce((n, t) => n + (t && t.vt > 0 ? 1 : 0), 0);
  function checkVictory(g) { if (pacified(g) === N_TRIBES) g.over = 'win'; return g.over === 'win'; }

  // Zeilen 1810/1820: Aufruhr unter den Staemmen der gleichen Volksgruppe
  function angerGroup(g, x) {
    const gx = g.tribes[x].group;
    for (let i = 1; i <= N_TRIBES; i++) {
      if (i === x) continue; const t = g.tribes[i];
      if (t.group === gx) { t.br -= 1; if (t.br < 1) { t.br = 0; t.vt = 0; t.tr = 0; } }
      if (t.br < 11 && t.vt === 2) { t.vt = 0; t.hi = 0; }
    }
  }
  // Zeilen 1930/1940: allgemeiner Unmut (alle ausser x)
  function angerAll(g, x) {
    for (let i = 1; i <= N_TRIBES; i++) {
      if (i === x) continue; const t = g.tribes[i];
      t.br -= 1; if (t.br < 1) { t.br = 0; t.vt = 0; t.tr = 0; }
      if (t.br < 11 && t.vt === 2) { t.vt = 0; t.hi = 0; }
    }
  }

  const attitudeLabel = br => br > 10 ? 'freundschaftlich' : br > 7 ? 'wohlgesonnen' : br > 3 ? 'neutral' : br > 0 ? 'feindselig' : 'kriegerisch';

  // ---------------------------------------------------------------- Verhandlungen
  // Aktionen (SA): 1 Freundschaftsvertrag, 2 Geld, 3 Konferenz, 4 Geiseln frei, 5 Tribut erlassen,
  //                6 Tribut erhoehen, 7 Geiseln hinrichten.  Rueckgabe EF: 2 hoechst erfolgreich, 1 erfolgreich,
  //                0 erfolglos, -1 katastrophal; null = Aktion nicht moeglich (kostet keinen Versuch).
  function canNegotiate(g, x) {
    const t = g.tribes[x];
    return !t.ex && g.vx < 5 && !g.negotiated.includes(x);
  }
  function negotiate(g, x, sa, amount = 0) {
    const t = g.tribes[x]; if (!canNegotiate(g, x)) return { ef: null };
    g.lastX = x; let ef = null;
    if (sa === 1 && t.br > 10 && t.vt < 2) { t.hi = 1000; t.vt = 2; ef = 1; }
    else if (sa === 2) {
      amount = Math.min(Math.max(0, Math.floor(amount)), g.rv); g.rv -= amount;
      if (amount > Math.floor((t.be + 1) / (t.br + 1))) { t.br += 2; ef = 2; }
      else { ef = 0; if (amount > Math.floor(((t.be + 1) / 3) / (t.br + 1))) { t.br += 1; ef = 1; } }
    }
    else if (sa === 3 && t.br > 7) { if (Math.floor(g.rnd() * 2) === 1) { t.br += 1; ef = 1; } else ef = 0; }
    else if (sa === 4 && t.br !== 0 && t.gr > 0) { t.br += 2; t.be += t.gr; t.gr = 0; ef = 2; }
    else if (sa === 5 && t.br !== 0 && t.tr > 0) { t.tr = 0; t.br += 2; ef = 2; }
    else if (sa === 6 && t.tr < 4 * tributeBase(g, t)) { t.br -= 4; t.tr += 2 * tributeBase(g, t); ef = -1; }
    else if (sa === 7 && t.gr > 0) { t.gr = 0; t.br = 0; angerGroup(g, x); ef = -1; }
    if (ef === null) return { ef: null };
    g.vx += 1; g.negotiated.push(x);
    cleanup(t);
    return { ef };
  }
  function negotiationOptions(g, x) {
    const t = g.tribes[x];
    return [
      { sa: 1, label: 'Freundschaftsvertrag schließen', ok: t.br > 10 && t.vt < 2 },
      { sa: 2, label: 'Geldzuwendungen', ok: true, amount: true },
      { sa: 3, label: 'Einberufung einer Konferenz', ok: t.br > 7 },
      { sa: 4, label: 'Freilassung der Geiseln', ok: t.br !== 0 && t.gr > 0 },
      { sa: 5, label: 'Verzicht auf die Tributforderungen', ok: t.br !== 0 && t.tr > 0 },
      { sa: 6, label: 'Erhöhung der Tributforderungen', ok: t.tr < 4 * tributeBase(g, t) },
      { sa: 7, label: 'Hinrichtung der Geiseln', ok: t.gr > 0 },
    ];
  }

  // ---------------------------------------------------------------- Kampf
  // Ablauf: attackCheck -> beginBattle -> stepBattle (wiederholt) -> [capitulation | conquest | end] -> finishBattle -> payLegion
  function attackCheck(g, y, x) {
    const t = g.tribes[x];
    if (t.ex) return { ok: false, reason: 'destroyed' };
    if (t.vt > 0) return { ok: false, reason: 'treaty' };
    if (![].concat(y).some(i => g.legions[i].le > 0)) return { ok: false, reason: 'empty' };
    return { ok: true };
  }
  function beginBattle(g, y, x) {
    const t = g.tribes[x];
    if (t.br === 0) g.kf = 0;                                       // Zeile 630
    const G = x === g.vs ? g.ga : Math.floor(t.be / 5);             // laufende Belagerung bleibt geschwaecht
    g.ga = G; g.vs = x; g.lastX = x;
    if (t.br > 3) angerGroup(g, x);                                 // Zeile 700
    t.br = 0; t.vt = 0; t.tr = 0;                                   // Zeile 705: Krieg
    // y: eine Legion oder ein Verband (Array). Ein Verband kaempft mit der Summe der Staerken als eine Einheit.
    const ys = [].concat(y).filter(i => g.legions[i].le > 0);
    const les = ys.map(i => g.legions[i].le), R = les.reduce((a, c) => a + c, 0);
    return { y: ys[0], ys, les, x, R, G, GA: G, RO: R, KA: 0, n: 0, loot: 0 };
  }
  function applyLosses(g, b) { const t = g.tribes[b.x]; t.be = Math.max(0, t.be - (b.G - b.GA)); }  // Zeile 1000 (zaehlt kumulativ, wie im Original)

  function stepBattle(g, b) {
    const rnd = g.rnd, r = n => Math.floor(rnd() * n);
    const id = b.RO * 3 - b.GA;                                     // Zeile 720
    if (id < -800) { b.GA -= r(150) + 20; b.RO -= r(150) + 20; }
    else if (id > 500) { b.GA -= r(300) + 20; b.RO -= r(50) + 20; }
    else { b.GA -= r(150) + 20; b.RO -= r(50) + 20; }
    if (b.GA < 201) return conquered(g, b);
    if (b.KA === 0 && b.G - b.GA > b.G / 3) {                       // Kapitulationsangebot (nur solange KA=0)
      applyLosses(g, b); const t = g.tribes[b.x];
      return { type: 'capitulation', hostages: Math.floor(t.be / 10), denars: Math.floor(t.be / 2) };
    }
    if (b.R - b.RO > b.R / 2) {                                     // Roemer fliehen
      const rf = Math.floor(rnd() * b.RO); b.RO -= rf; b.n = 1;
      if (b.RO < 101) { b.RO = 0; applyLosses(g, b); return { type: 'lost', fled: rf }; }
      applyLosses(g, b); return { type: 'flee', fled: rf };
    }
    if (b.RO < 101) { b.RO = 0; b.n = 1; applyLosses(g, b); return { type: 'lost' }; }
    return { type: 'round' };
  }
  function retreat(g, b) {                                          // Zeile 1020: Feuerknopf
    const rf = Math.floor(g.rnd() * b.RO / 3); b.RO -= rf; b.n = 1; applyLosses(g, b);
    return { type: 'retreat', fled: rf };
  }
  function acceptCapitulation(g, b) {                               // Zeilen 1450-1520
    const t = g.tribes[b.x];
    t.br = 5; t.vt = 1;
    g.rv = Math.min(MAX_MONEY, g.rv + Math.floor(t.be / 2));
    t.gr += Math.floor(t.be / 10); t.be -= Math.floor(t.be / 10);
    t.tr = tributeBase(g, t); b.n = 0;
    return { type: 'peace' };
  }
  function conquered(g, b) {                                        // Zeilen 1530-1555
    if (b.GA < 0) b.GA = 0;
    applyLosses(g, b); angerGroup(g, b.x); b.n = 0;
    const t = g.tribes[b.x];
    return { type: 'conquered', maxLoot: Math.floor(t.be * 2.3), prisoners: t.be };
  }
  // Beute (0..maxLoot) und Geiseln (0..Bevoelkerung) waehlen, Zeilen 1610-1800
  function resolveConquest(g, b, loot, hostages) {
    const t = g.tribes[b.x];
    loot = Math.max(0, Math.min(Math.floor(loot), Math.floor(t.be * 2.3)));
    hostages = Math.max(0, Math.min(Math.floor(hostages), t.be));
    if (loot > Math.floor(t.be * 2.3) / 2) angerGroup(g, b.x);
    g.rv = Math.min(MAX_MONEY, g.rv + loot);
    let destroyed = false;
    if (hostages === t.be) {                                        // Stamm ausgeloescht
      t.ex = 1; t.br = 1000; t.vt = 1; angerAll(g, b.x); angerAll(g, b.x); destroyed = true;
    } else {
      if (hostages > t.be / 10) angerGroup(g, b.x);
      t.gr += hostages; t.tr = Math.round(tributeBase(g, t) / 100) * 50; t.br = 4; t.vt = 1; t.be -= hostages;
    }
    return { destroyed, loot, hostages };
  }
  // Zeilen 2010-2160: Gefechtsabschluss; Rueckgabe: Summe der eigenen Verluste
  function finishBattle(g, b) {
    const t = g.tribes[b.x];
    const total = Math.max(0, b.R - Math.max(0, b.RO));
    let left = total;
    b.ys.forEach((y, k) => {
      const L = g.legions[y];
      const lost = k === b.ys.length - 1 ? left : Math.min(left, Math.round(total * b.les[k] / b.R));   // Verluste anteilig zur Staerke
      left -= lost;
      if (b.n === 1) L.mv = Math.max(0, L.mv - 1);
      else { L.mv = Math.min(9, L.mv + 1); L.sl += 1; }
      L.kl += 1; setLe(g, y, L.le - lost);
      L.at = b.x; L.x = t.x; L.y = t.y;
    });
    if (b.n !== 1) t.rs += 1;
    t.rk += 1;
    checkVictory(g);
    return { lost: total };
  }
  // Zeilen 3790-3880: Sold -> Moral
  function payLegion(g, y, amount) {
    const L = g.legions[y]; amount = Math.max(0, Math.min(Math.floor(amount), g.rv)); g.rv -= amount;
    if (amount < L.le * 0.5) L.mv -= 2;
    else if (amount < L.le * 1.1) L.mv -= 1;
    else if (amount < L.le * 2.1) { /* unveraendert */ }
    else if (amount > L.le * 3.1) L.mv = Math.min(9, L.mv + 1);
    L.mv = Math.max(0, L.mv);
    return amount;
  }
  // Sold fuer einen Verband: Betrag anteilig zur Staerke aufgeteilt (die Moral reagiert je Legion auf ihr Verhaeltnis).
  function payLegions(g, ys, amount) {
    ys = [].concat(ys); amount = Math.max(0, Math.min(Math.floor(amount), g.rv));
    const total = ys.reduce((a, i) => a + g.legions[i].le, 0) || 1; let left = amount;
    ys.forEach((y, k) => { const share = k === ys.length - 1 ? left : Math.round(amount * g.legions[y].le / total); left -= share; payLegion(g, y, share); });
    return amount;
  }
  // Legion ohne Kampf verlegen (Zeile 5030)
  function moveLegion(g, y, x) { const t = g.tribes[x]; [].concat(y).forEach(i => { const L = g.legions[i]; L.at = x; L.x = t.x; L.y = t.y; }); }

  // ---------------------------------------------------------------- Winterlager / Jahresabschluss
  // Teil 1 (Zeilen 3940-4150): Angriffe auf das Winterlager. Teil 2 (4160-4410): Haushalt.
  function winterAttack(g) {
    const hostile = [];
    for (let i = 1; i <= N_TRIBES; i++) if (g.tribes[i].br < 1) hostile.push(i);
    if (!hostile.length) { g.kf = 0; return { attackers: [], loss: 0, size: null }; }
    g.tribes[hostile[0]].vt = 0;
    if (g.kf > 0) angerAll(g, g.lastX);
    const attackers = hostile.filter(i => !g.tribes[i].ex);
    const xz = attackers.length; g.kf = xz ? 1 : g.kf;
    let mz = 0;
    for (let i = 1; i <= 4; i++) {
      const mn = Math.floor(g.rnd() * (xz * 600));
      setLe(g, i, g.legions[i].le - mn); mz += mn;
    }
    return { attackers, loss: mz, size: mz < 2000 ? 'gering' : mz > 4000 ? 'gewaltig' : 'groß' };
  }
  function budget(g) {
    const income = g.tribes.reduce((s, t) => s + (t ? t.tr : 0), 0);
    const soldiers = g.legions.reduce((s, l) => s + (l ? l.le : 0), 0);
    const cost = Math.floor(soldiers / 2);
    const due = dischargeDue(g), discharged = due.reduce((a, c) => a + c.n, 0), discharge = discharged * DISCHARGE_PAY;
    const total = Math.min(MAX_MONEY, g.rv + income - cost - discharge);
    return { income, cost, soldiers, total, pacified: pacified(g), discharge, discharged };
  }
  function closeBudget(g) {
    const b = budget(g);
    if (b.soldiers === 0 || b.total < 1) { g.over = 'lose'; return b; }
    g.rv = b.total;
    for (const c of dischargeDue(g)) {                              // Freiwillige scheiden aus und kehren zu ihrem Stamm zurueck
      const L = g.legions[c.legion], n = Math.min(c.n, L.le); L.le -= n;
      const t = g.tribes[c.tribe]; if (t && !t.ex) t.be += n;
      g.cohorts.splice(g.cohorts.indexOf(c), 1);
    }
    return b;
  }
  // Rekrutierung je Legion (Zeilen 4430-4680)
  function auxiliaries(g) { return g.tribes.reduce((s, t) => s + (t ? t.hi : 0), 0) / 4; }
  function recruitInfo(g, i) {
    const L = g.legions[i], hi = auxiliaries(g);
    const full = L.le + hi > MAX_LEGION - 1;
    return { hi, full, maxVolunteers: L.mv * 250, free: MAX_LEGION - L.le - hi };
  }
  function recruit(g, i, n) {
    const L = g.legions[i], info = recruitInfo(g, i);
    if (info.full) { L.le = MAX_LEGION; return L.le; }
    n = Math.max(0, Math.min(Math.floor(n), info.maxVolunteers, info.free));
    L.le = L.le + info.hi + n; return L.le;
  }

  // ---------------------------------------------------------------- Erweiterte Regeln (nicht im Original)
  // Reichtum: Groesse des Landes und Volksgruppe bestimmen den Tribut. Original: immer 1000 / 500 / +2000 / Grenze 4000.
  const WEALTH_MULT = [0.8, 1.0, 0.9, 1.3];                         // Belger, Gallier, Aquitaner, Volcer (romanisiert, Handel)
  function wealthFactor(g, t) { return g.rules && g.rules.wealth ? Math.max(0.25, t.pop0 / 100000 * WEALTH_MULT[t.group]) : 1; }
  function tributeBase(g, t) { return Math.round(1000 * wealthFactor(g, t) / 50) * 50; }       // Tribut bei Friedensvertrag
  function wealthStars(g, t) { return Math.max(1, Math.min(5, Math.round(wealthFactor(g, t) * 2))); }
  // ---------------------------------------------------------------- Komfort-Regeln (nicht im Original)
  const MERC_COST = 3;                                              // Denare pro angeworbenem Soeldner
  // Soeldner jederzeit anwerben: Legion bis max. 9000 Mann auffuellen. Original: nur Winter-Freiwillige.
  function hireMercenaries(g, i, n) {
    if (!g.rules || !g.rules.mercs) return 0;
    const L = g.legions[i];
    n = Math.max(0, Math.min(Math.floor(n), MAX_LEGION - L.le, Math.floor(g.rv / MERC_COST)));
    L.le += n; g.rv -= n * MERC_COST;
    if (n > 0) L.mv = Math.max(0, L.mv - 0);                        // Moral bleibt unveraendert
    return n;
  }
  // ---- Geiseln als Freiwillige: jaehrlich 5 % der Geiseln jedes Stammes schliessen sich kostenlos den Legionen an,
  // dienen 5 Jahre, kehren dann zu ihrem Stamm zurueck und erhalten den doppelten Anwerbebetrag (2 x MERC_COST).
  const SERVICE_YEARS = 5, VOLUNTEER_RATE = 0.05, DISCHARGE_PAY = 2 * 3;
  function setLe(g, y, newLe) {                                    // Verluste treffen die Freiwilligen anteilig
    const L = g.legions[y], old = L.le; L.le = Math.max(0, newLe);
    if (g.cohorts && newLe < old && old > 0) for (const c of g.cohorts) if (c.legion === y) c.n = Math.floor(c.n * L.le / old);
  }
  function veteranCount(g, y) { return (g.cohorts || []).filter(c => c.legion === y).reduce((a, c) => a + c.n, 0); }
  function dischargeDue(g) { return (g.cohorts || []).filter(c => g.year >= c.year + SERVICE_YEARS); }
  function levyVolunteers(g) {
    const out = { total: 0, list: [] };
    if (!g.rules || !g.rules.slaves) return out;
    for (const t of g.tribes) {
      if (!t || t.gr <= 0) continue;
      const raw = t.gr * VOLUNTEER_RATE; let n = Math.floor(raw) + (g.rnd() < raw - Math.floor(raw) ? 1 : 0); n = Math.min(n, t.gr);
      let placed = 0;
      while (placed < n) {                                         // auf die Legion mit der geringsten Staerke verteilen
        const ys = [1, 2, 3, 4].filter(i => g.legions[i].le < MAX_LEGION).sort((a, b) => g.legions[a].le - g.legions[b].le);
        if (!ys.length) break; const y = ys[0], k = Math.min(n - placed, MAX_LEGION - g.legions[y].le, Math.max(1, Math.ceil(n / 4)));
        g.legions[y].le += k; placed += k; g.cohorts.push({ tribe: t.id, n: k, legion: y, year: g.year });
      }
      if (placed) { t.gr -= placed; out.total += placed; out.list.push({ tribe: t.id, n: placed }); }
    }
    return out;
  }
  // Lageeinschaetzung: simuliert Gefechte auf einer Kopie (veraendert g nicht).
  function assess(g, y, x, runs = 150) {
    const out = { capitulation: 0, conquered: 0, defeat: 0, loss: 0, theirLoss: 0 };
    for (let k = 0; k < runs; k++) {
      const c = JSON.parse(JSON.stringify({ ...g, rnd: undefined })); c.rnd = Math.random;
      const b = beginBattle(c, y, x); let ev;
      for (let i = 0; i < 600; i++) { ev = stepBattle(c, b); if (ev.type !== 'round') break; }
      if (ev.type === 'capitulation') out.capitulation++; else if (ev.type === 'conquered') out.conquered++; else out.defeat++;
      out.loss += b.R - Math.max(0, b.RO); out.theirLoss += b.G - Math.max(0, b.GA);
    }
    for (const k of ['capitulation', 'conquered', 'defeat']) out[k] = Math.round(out[k] / runs * 100);
    out.loss = Math.round(out.loss / runs); out.theirLoss = Math.round(out.theirLoss / runs);
    return out;
  }
  function nextYear(g) { g.year += 1; return beginYear(g); }

  const API = { createGame, beginYear, nextYear, pacified, checkVictory, attitudeLabel,
    canNegotiate, negotiate, negotiationOptions, attackCheck, beginBattle, stepBattle, retreat,
    acceptCapitulation, resolveConquest, finishBattle, payLegion, payLegions, moveLegion,
    winterAttack, budget, closeBudget, auxiliaries, recruitInfo, recruit, hireMercenaries, assess, MERC_COST, MAX_LEGION, tributeBase, wealthStars, wealthFactor, levyVolunteers, veteranCount, SERVICE_YEARS, VOLUNTEER_RATE, DISCHARGE_PAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JC = API;
})(typeof window !== 'undefined' ? window : globalThis);
