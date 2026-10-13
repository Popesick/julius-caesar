// Taktische Hexfeld-Schlachten. Reine Logik (Node und Browser), keine UI.
// Jede Einheit steht fuer bis zu 500 Mann; Roemer sind diszipliniert (Verbund, Moral), Gallier kaempfen ohne feste Struktur.
(function (root) {
  const COLS = 16, ROWS = 12, UNIT_MEN = 500, MAX_UNITS = 40, MAX_TURNS = 14;
  // Stellschrauben der Kalibrierung
  const K = { melee: 0.085, shoot: 0.07, moraleLoss: 38, routR: 15, routG: 24, shock: 5, shockG: 2, gaulAtt: 0.94, gaulDef: 0.96, panicAt: 0.45, moraleG: 70, hostileG: 80, ret: 0.7 };

  // ---------------------------------------------------------------- Gelaende
  // mv: Bewegungskosten zu Fuss, cmv: fuer Reiter, def: Verteidigungsfaktor, high: erhoehte Position
  const TERR = {
    plain:    { name: 'Ebene',        mv: 1,  cmv: 1,  def: 1.0,  color: '#6e7b46' },
    forest:   { name: 'Wald',         mv: 2,  cmv: 3,  def: 1.3,  color: '#35532f', cavAtt: 0.7, shootDef: 1.6, cut: { melee: 0.85, shoot: 0.7 } },   // doppelter Schutz gegen Pfeile, weniger Schaden
    hill:     { name: 'Hügel',        mv: 2,  cmv: 2,  def: 1.3,  color: '#a08f5a', high: true },
    marsh:    { name: 'Sumpf',        mv: 3,  cmv: 4,  def: 0.9,  color: '#4f6c61' },
    ford:     { name: 'Furt',         mv: 2,  cmv: 2,  def: 0.85, color: '#82a6ba' },
    palisade: { name: 'Palisadenwall', mv: 2, cmv: 3,  def: 1.6,  color: '#80603b', high: true },
    water:    { name: 'Wasser',       mv: 99, cmv: 99, def: 1,    color: '#2c4d6e', impass: true },
    rock:     { name: 'Fels',         mv: 99, cmv: 99, def: 1,    color: '#707070', impass: true },
  };

  // ---------------------------------------------------------------- Einheitentypen
  const UT = {
    legion: { name: 'Legionäre', ab: 'L', att: 6, def: 7, shoot: 0, rng: 1, mv: 3, desc: 'Schwere Infanterie mit Pilum und Gladius. Diszipliniert, hält die Linie, wirft zu Beginn eine Pilum-Salve.' },
    archer: { name: 'Bogenschützen', ab: 'B', att: 2, def: 3, shoot: 5, rng: 3, mv: 3, desc: 'Hilfstruppen mit Bogen, Reichweite 3. Schwach im Nahkampf; schießen nur nach höchstens 1 Feld Bewegung.' },
    cav: { name: 'Reiter', ab: 'R', att: 7, def: 4, shoot: 0, rng: 1, mv: 6, cav: true, desc: 'Schnelle Kavallerie. Der Anritt (ab 3 Feldern) gibt +30 %; Lanzenträger und Wald sind gefährlich für sie.' },
    spear: { name: 'Lanzenträger', ab: 'S', att: 5, def: 5, shoot: 0, rng: 1, mv: 3, antiCav: true, desc: 'Gallische Speerkämpfer. Der Speerwall schützt stark gegen Reiter.' },
    sword: { name: 'Schwertkämpfer', ab: 'W', att: 8, def: 3, shoot: 0, rng: 1, mv: 3, desc: 'Gallische Krieger und Adelige. Furchtbarer Sturmangriff (ab 2 Feldern +15 %), aber schlecht gepanzert.' },
    sling: { name: 'Schleuderer', ab: 'Sl', att: 2, def: 3, shoot: 4, rng: 2, mv: 4, desc: 'Leichte gallische Fernkämpfer, Reichweite 2.' },
  };
  const FAR = { archer: 1, sling: 1 };

  // ---------------------------------------------------------------- Zufall
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- Hex-Geometrie (odd-r, spitze Hexfelder)
  const inB = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
  const DIRS = [[[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]], [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]]];
  function nbrs(c, r) { return DIRS[r & 1].map(([dc, dr]) => [c + dc, r + dr]).filter(([a, b]) => inB(a, b)); }
  const cube = (c, r) => { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; };
  function dist(c1, r1, c2, r2) { const a = cube(c1, r1), b = cube(c2, r2); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
  const key = (c, r) => r * COLS + c;

  // ---------------------------------------------------------------- Gelaendegenerierung (je Schlachtfeld individuell, historisch angelehnt)
  const SITES = {  // Stamm-Nr -> Gelaendeform und Name des Schlachtfelds
    1: ['valley', 'Tal der Isère'], 2: ['oppidum', 'Plateau von Gergovia'], 3: ['bocage', 'Heckenland der Aulercer'], 4: ['forestmarsh', 'Waldsumpf der Bellovaker'],
    5: ['marshoppidum', 'Sümpfe vor Avaricum'], 6: ['gorge', 'Uxellodunum am Dordogne-Fluss'], 7: ['river', 'Ufer der Loire bei Cenabum'], 8: ['forest', 'Ardennenwälder'],
    9: ['slope', 'Hügel von Bibracte'], 10: ['slope', 'Hang bei Bibracte'], 11: ['rolling', 'Hügelland des Limousin'], 12: ['foothills', 'Vorland der Vogesen'],
    13: ['bocage', 'Hecken der Normandie'], 14: ['plateau', 'Plateau von Langres'], 15: ['river', 'Ufer der Marne'], 16: ['marsh', 'Sümpfe des Rheindeltas'],
    17: ['coastmarsh', 'Küstensümpfe an der Kanalküste'], 18: ['coast', 'Granitküste der Bretagne'], 19: ['plain', 'Ebene des Poitou'], 20: ['river', 'Ufer der Aisne'],
    21: ['gorge', 'Kalkplateau der Causses'], 22: ['plainriver', 'Charente-Ebene'], 23: ['rivermarsh', 'Yonne-Ufer bei Agedincum'], 24: ['foothills', 'Jura-Vorland'],
    25: ['foothills', 'Pyrenäenvorland'], 26: ['forestriver', 'Moseltal'], 27: ['coast', 'Küste des Cotentin'], 28: ['coastmarsh', 'Küste der Veneter'],
    29: ['pines', 'Kiefernwälder der Landes'], 30: ['alpine', 'Alpentäler der Vocontier'],
  };
  function genTerrain(tribeId, seed) {
    const R = rng(seed * 7919 + tribeId * 104729 + 17), tpl = (SITES[tribeId] || ['plain', 'Schlachtfeld'])[0];
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill('plain'));
    const put = (c, r, t) => { if (inB(c, r)) g[r][c] = t; };
    const blob = (t, n, rad) => { for (let i = 0; i < n; i++) { const c0 = Math.floor(R() * COLS), r0 = 2 + Math.floor(R() * (ROWS - 4)), rr = 1 + Math.floor(R() * rad);
      for (let r = r0 - rr; r <= r0 + rr; r++) for (let c = c0 - rr; c <= c0 + rr; c++) if (inB(c, r) && dist(c0, r0, c, r) <= rr && R() < 0.85) put(c, r, t); } };
    const band = (t, r0, r1, p) => { for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) if (R() < p) put(c, r, t); };
    const edgeBlobs = (t, n, rad) => { for (let i = 0; i < n; i++) { const left = R() < 0.5, c0 = left ? Math.floor(R() * 3) : COLS - 1 - Math.floor(R() * 3), r0 = 2 + Math.floor(R() * (ROWS - 4)), rr = 1 + Math.floor(R() * rad);
      for (let r = r0 - rr; r <= r0 + rr; r++) for (let c = c0 - rr; c <= c0 + rr; c++) if (inB(c, r) && dist(c0, r0, c, r) <= rr) put(c, r, t); } };
    const river = (row, fords) => { let r = row; const cols = []; for (let c = 0; c < COLS; c++) { const nr = Math.max(4, Math.min(7, r + (R() < 0.35 ? (R() < 0.5 ? -1 : 1) : 0)));
        for (let rr = Math.min(r, nr); rr <= Math.max(r, nr); rr++) put(c, rr, 'water'); cols.push([c, Math.min(r, nr), Math.max(r, nr)]); r = nr; }
      for (let i = 0; i < fords; i++) { const [c, a, b] = cols[2 + Math.floor(R() * (COLS - 4))]; for (let rr = a; rr <= b; rr++) put(c, rr, 'ford'); put(c + 1, a, g[a][c + 1] === 'water' ? 'ford' : g[a][c + 1]); } };
    const coast = (left, depth) => { for (let r = 0; r < ROWS; r++) { const d = depth + (R() < 0.4 ? 1 : 0); for (let k = 0; k < d; k++) put(left ? k : COLS - 1 - k, r, 'water'); } };
    switch (tpl) {
      case 'hills': blob('hill', 5, 2); blob('forest', 3, 2); break;
      case 'slope': band('hill', 7, 8, 0.9); band('hill', 6, 6, 0.4); blob('forest', 3, 2); edgeBlobs('forest', 2, 2); break;
      case 'oppidum': band('hill', 0, 1, 0.95); for (let c = 0; c < COLS; c++) if (c % 3 !== 1) put(c, 2, 'palisade'); edgeBlobs('forest', 3, 2); blob('marsh', 2, 1); break;
      case 'marshoppidum': band('hill', 0, 1, 0.9); for (let c = 2; c < COLS - 2; c++) if (c % 4 !== 1) put(c, 2, 'palisade'); blob('marsh', 6, 2); break;
      case 'gorge': band('hill', 0, 2, 0.5); edgeBlobs('rock', 4, 2); river(5, 2); blob('forest', 2, 1); break;
      case 'river': river(5, 2); blob('forest', 3, 1); blob('hill', 1, 1); break;
      case 'plainriver': river(6, 3); blob('forest', 1, 1); break;
      case 'rivermarsh': river(5, 2); blob('marsh', 4, 2); break;
      case 'forestriver': river(5, 2); blob('forest', 6, 2); break;
      case 'forest': blob('forest', 8, 2); blob('marsh', 1, 1); break;
      case 'forestmarsh': blob('forest', 6, 2); blob('marsh', 5, 2); break;
      case 'marsh': blob('marsh', 8, 2); blob('forest', 1, 1); break;
      case 'coast': coast(R() < 0.5, 2); blob('hill', 2, 1); blob('marsh', 1, 1); break;
      case 'coastmarsh': coast(R() < 0.5, 2); blob('marsh', 5, 2); break;
      case 'bocage': for (let i = 0; i < 11; i++) { const c0 = Math.floor(R() * COLS), r0 = 2 + Math.floor(R() * (ROWS - 4)), horiz = R() < 0.5; for (let k = 0; k < 3 + Math.floor(R() * 3); k++) if (R() < 0.8) put(horiz ? c0 + k : c0, horiz ? r0 : r0 + k, 'forest'); } break;
      case 'plain': blob('forest', 2, 1); blob('hill', 1, 1); break;
      case 'rolling': blob('hill', 6, 2); blob('forest', 2, 1); break;
      case 'plateau': band('hill', 3, 8, 0.55); edgeBlobs('forest', 3, 2); break;
      case 'foothills': blob('hill', 5, 2); blob('forest', 4, 2); edgeBlobs('rock', 1, 1); break;
      case 'valley': edgeBlobs('rock', 5, 2); river(5, 2); break;
      case 'alpine': edgeBlobs('rock', 7, 2); blob('hill', 3, 2); blob('forest', 2, 1); break;
      case 'pines': blob('forest', 9, 2); band('marsh', 5, 5, 0.15); break;
      default: blob('hill', 2, 1);
    }
    // Aufmarschzonen: begehbar machen
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((r <= 2 || r >= ROWS - 3) && TERR[g[r][c]].impass) g[r][c] = 'plain';
    // Verbindung sichern: alle Felder, die nicht erreichbar sind, aber Wasser/Fels blockieren, zu Furten machen
    for (let guard = 0; guard < 6; guard++) {
      const seen = new Set([key(0, ROWS - 1)]), st = [[0, ROWS - 1]];
      while (st.length) { const [c, r] = st.pop(); for (const [a, b] of nbrs(c, r)) if (!seen.has(key(a, b)) && !TERR[g[b][a]].impass) { seen.add(key(a, b)); st.push([a, b]); } }
      let fixed = false;
      for (let c = 0; c < COLS; c++) if (!seen.has(key(c, 0)) && !TERR[g[0][c]].impass) { for (let r = 1; r < ROWS - 1; r++) if (TERR[g[r][c]].impass) { g[r][c] = 'ford'; fixed = true; } }
      if (!fixed) break;
    }
    return g;
  }
  const siteName = tribeId => (SITES[tribeId] || ['plain', 'Schlachtfeld'])[1];

  // ---------------------------------------------------------------- Armeen
  // Einheitengroesse je Heer: bis 15 000 Mann 500, ueber 15 000 Mann 1 000, ueber 25 000 Mann 2 000 (Rest als kleinere Einheit)
  const unitScale = total => total > 25000 ? 2000 : total > 15000 ? 1000 : UNIT_MEN;
  function splitUnits(total, scale) {
    const sc = scale || unitScale(total), out = []; let left = Math.min(total, MAX_UNITS * sc);
    while (left > 0 && out.length < MAX_UNITS) { const m = Math.min(sc, left); if (m >= 60 || !out.length) out.push(m); left -= m; }      // Reste unter 60 Mann bilden keine Einheit
    return out;
  }
  function allot(n, shares) {                                     // groesster Rest
    const keys = Object.keys(shares), raw = keys.map(k => shares[k] * n), out = {}; let used = 0;
    keys.forEach((k, i) => { out[k] = Math.floor(raw[i]); used += out[k]; });
    keys.map((k, i) => [k, raw[i] - Math.floor(raw[i])]).sort((a, b) => b[1] - a[1]).slice(0, n - used).forEach(([k]) => { out[k]++; });
    return out;
  }
  // Roemisches Heer: Legionaere (Pilum-Infanterie) mit Bogenschuetzen-Hilfstruppen, ab Tribun Kavallerie.
  function romanComposition(totalMen, cavalry, scale) {
    const n = splitUnits(totalMen, scale).length;
    return allot(n, { archer: 0.12, cav: cavalry ? 0.10 : 0, legion: 1 - 0.12 - (cavalry ? 0.10 : 0) });
  }
  // Gallische Heere nach Volksgruppe (0 Belger, 1 Gallier, 2 Aquitaner, 3 Volcer); einzelne Staemme mit Besonderheiten.
  const GAUL_PROFILE = [
    { spear: 0.50, sword: 0.30, sling: 0.08, cav: 0.12 },        // Belger: wilde Fusskrieger
    { spear: 0.47, sword: 0.26, sling: 0.10, cav: 0.17 },        // Gallier: Adelsreiterei
    { spear: 0.33, sword: 0.12, archer: 0.20, sling: 0.15, cav: 0.20 },   // Aquitaner: leichte Schuetzen
    { spear: 0.48, sword: 0.15, archer: 0.12, cav: 0.25 },       // Volcer: romanisierte Reiterei
  ];
  const GAUL_SPECIAL = { 26: { spear: 0.40, sword: 0.24, sling: 0.08, cav: 0.28 }, 9: { spear: 0.40, sword: 0.20, sling: 0.10, cav: 0.30 }, 2: { spear: 0.42, sword: 0.24, sling: 0.08, cav: 0.26 } };
  function gaulComposition(totalMen, group, tribeId, scale) { return allot(splitUnits(totalMen, scale).length, GAUL_SPECIAL[tribeId] || GAUL_PROFILE[group] || GAUL_PROFILE[1]); }

  // ---------------------------------------------------------------- Zustand
  function newBattle(opts) {
    // opts: {tribeId, seed, romanMen, romanMorale (0-9 mv), cavalry, gaulMen, group, hostile}
    const R = rng((opts.seed || 1) * 31 + 7);
    const s = { cols: COLS, rows: ROWS, tribeId: opts.tribeId, siteName: siteName(opts.tribeId), terrain: genTerrain(opts.tribeId, opts.seed || 1), units: [], turn: 1, maxTurns: MAX_TURNS, phase: 'deploy', side: 'R', over: null, log: [], rnd: R, nextId: 1, startUnits: { R: 0, G: 0 }, panicG: false };
    const sc = unitScale(Math.max(opts.romanMen, opts.gaulMen)); s.scale = { R: sc, G: sc };         // beide Seiten gleiche Einheitengroesse: bestimmt vom groesseren Heer
    const rc = romanComposition(opts.romanMen, !!opts.cavalry, sc), rm = splitUnits(opts.romanMen, sc), gc = gaulComposition(opts.gaulMen, opts.group, opts.tribeId, sc), gm = splitUnits(opts.gaulMen, sc);
    const moraleR = Math.min(100, 52 + (opts.romanMorale == null ? 5 : opts.romanMorale) * 5), moraleG = opts.hostile ? K.hostileG : K.moraleG;
    const mk = (side, type, men, morale) => ({ id: s.nextId++, side, type, men, max: s.scale[side], form: 'phalanx', morale: Math.max(20, Math.min(100, morale + (side === 'G' ? Math.round((R() - 0.5) * 10) : 0))), col: -1, row: -1, acted: false, moved: 0, routed: false, gone: false, killed: 0, fledMen: 0, pilum: false, placed: false });
    let k = 0;
    for (const t of ['legion', 'archer', 'cav']) for (let i = 0; i < (rc[t] || 0); i++) s.units.push(mk('R', t, rm[k++] || UNIT_MEN, moraleR));
    k = 0; for (const t of ['spear', 'sword', 'sling', 'archer', 'cav']) for (let i = 0; i < (gc[t] || 0); i++) s.units.push(mk('G', t, gm[k++] || UNIT_MEN, moraleG));
    s.startUnits.R = s.units.filter(u => u.side === 'R').length; s.startUnits.G = s.units.filter(u => u.side === 'G').length;
    return s;
  }
  const alive = (s, side) => s.units.filter(u => u.side === side && !u.gone && u.men > 0);
  const fighting = (s, side) => alive(s, side).filter(u => !u.routed);
  const unitAt = (s, c, r) => s.units.find(u => !u.gone && u.men > 0 && u.col === c && u.row === r);
  const ground = (s, c, r) => TERR[s.terrain[r][c]];
  const zone = (side, r) => side === 'R' ? r >= ROWS - 3 : r <= 2;
  const enemyOf = side => side === 'R' ? 'G' : 'R';

  // ---------------------------------------------------------------- Aufstellung
  function place(s, u, c, r) {
    if (s.phase !== 'deploy' || !inB(c, r) || !zone(u.side, r) || ground(s, c, r).impass) return false;
    const o = unitAt(s, c, r); if (o && o !== u) return false;
    u.col = c; u.row = r; u.placed = true; return true;
  }
  function pickUp(s, u) { u.col = -1; u.row = -1; u.placed = false; }
  function freeZoneHexes(s, side) { const out = []; for (let r = 0; r < ROWS; r++) if (zone(side, r)) for (let c = 0; c < COLS; c++) if (!ground(s, c, r).impass && !unitAt(s, c, r)) out.push([c, r]); return out; }
  function autoDeploy(s, side) {
    const us = s.units.filter(u => u.side === side && !u.placed), R = s.rnd;
    const order = Array.from({ length: COLS }, (_, i) => i).sort((a, b) => Math.abs(a - 7.5) - Math.abs(b - 7.5));
    const rows = side === 'R' ? [ROWS - 3, ROWS - 2, ROWS - 1] : [2, 1, 0];
    const free = (c, r) => !ground(s, c, r).impass && !unitAt(s, c, r);
    const putFirst = (u, r, cols, skip) => { for (const c of cols) { if (skip && R() < skip) continue; if (free(c, r)) { place(s, u, c, r); return true; } } return false; };
    const melee = us.filter(u => !FAR[u.type] && !UT[u.type].cav), far = us.filter(u => FAR[u.type]), cav = us.filter(u => UT[u.type].cav);
    const gaul = side === 'G', skip = gaul ? 0.18 : 0;                                  // Gallier stehen ohne feste Ordnung (Luecken)
    const flank = [0, 1, 2, COLS - 1, COLS - 2, COLS - 3];
    for (const u of cav) if (!putFirst(u, rows[1], flank, 0)) putFirst(u, rows[2], flank, 0) || putFirst(u, rows[1], order, 0);
    for (const u of melee) { if (!putFirst(u, rows[0], gaul ? shuffle(order, R) : order, skip)) if (!putFirst(u, rows[1], order, 0)) putFirst(u, rows[2], order, 0); }
    for (const u of far) { if (!putFirst(u, rows[1], order, 0)) if (!putFirst(u, rows[2], order, 0)) putFirst(u, rows[0], order, 0); }
    for (const u of us) if (!u.placed) { const f = freeZoneHexes(s, side); if (f.length) place(s, u, f[0][0], f[0][1]); }
  }
  function shuffle(a, R) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  const allPlaced = (s, side) => s.units.filter(u => u.side === side).every(u => u.placed);
  function startFight(s) {
    if (!allPlaced(s, 'R')) return false;
    autoDeploy(s, 'G'); s.phase = 'fight'; s.side = 'R'; s.turn = 1; resetSide(s, 'R'); return true;
  }

  // ---------------------------------------------------------------- Bewegung
  const moveCost = (s, u, c, r) => UT[u.type].cav ? ground(s, c, r).cmv : ground(s, c, r).mv;
  const enemyAdj = (s, u, c, r) => nbrs(c, r).some(([a, b]) => { const o = unitAt(s, a, b); return o && o.side !== u.side && !o.routed; });
  // Erreichbare Felder (Dijkstra). ZOC: Betreten eines Feldes neben einem Feind beendet die Bewegung.
  function reach(s, u) {
    const mp = UT[u.type].mv * (u.form === 'march' ? 2 : 1), best = new Map(), prev = new Map(), open = [[0, u.col, u.row]]; best.set(key(u.col, u.row), 0);   // Marschformation: doppelte Bewegung
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]); const [cost, c, r] = open.shift(); if (cost > best.get(key(c, r))) continue;
      if (!(c === u.col && r === u.row) && enemyAdj(s, u, c, r)) continue;                       // Feindberuehrung: stoppt
      for (const [a, b] of nbrs(c, r)) {
        const T = ground(s, a, b); if (T.impass) continue; const o = unitAt(s, a, b); if (o) continue;
        const nc = cost + moveCost(s, u, a, b); if (nc > mp) continue;
        if (nc < (best.get(key(a, b)) ?? 99)) { best.set(key(a, b), nc); prev.set(key(a, b), key(c, r)); open.push([nc, a, b]); }
      }
    }
    return { best, prev };
  }
  function pathTo(r, c, row) { const out = []; let k = key(c, row); while (k !== undefined) { out.push([k % COLS, Math.floor(k / COLS)]); k = r.prev.get(k); } return out.reverse(); }

  // ---------------------------------------------------------------- Kampf
  function adjacentFriends(s, u, c, r) { return nbrs(c, r).filter(([a, b]) => { const o = unitAt(s, a, b); return o && o.side === u.side && o !== u && !o.routed; }).length; }
  function adjacentEnemies(s, u, c, r) { return nbrs(c, r).filter(([a, b]) => { const o = unitAt(s, a, b); return o && o.side !== u.side && !o.routed; }).length; }
  // Angriffsstaerke und Verteidigung; kind: 'melee' | 'shoot'. from: [c,r], moved: gelaufene Kosten
  function power(s, u, t, kind, moved, from, st) {
    const U = UT[u.type]; let p = (kind === 'shoot' ? U.shoot : U.att) * Math.pow(u.men / u.max, 0.85) * (u.max / UNIT_MEN);   // groessenunabhaengig: zaehlt die Mannzahl
    if (u.side === 'G') p *= K.gaulAtt;                                                   // fehlende Struktur
    p *= 0.7 + 0.3 * (u.morale / 100);
    if (u.form === 'march') p *= 0.5;                                              // Marschformation: halber Angriff
    const th = ground(s, t.col, t.row), fh = ground(s, from[0], from[1]);
    if (kind === 'melee') {
      if (U.cav && moved >= 3) p *= 1.3 * (th.cavAtt || 1);
      if (u.type === 'legion' && moved >= 1 && !u.pilum) p *= 1.2;                  // Pilum-Salve
      if (u.type === 'sword' && moved >= 2) p *= 1.15;                              // ungestuemer Sturm
      if (u.type === 'archer' || u.type === 'sling') p *= 0.8;
      const flankers = adjacentEnemies(s, t, t.col, t.row) - 1;                      // andere Gegner um das Ziel (Flankenbonus)
      p *= 1 + 0.18 * Math.max(0, Math.min(2, flankers + (st && st.adjTarget ? 0 : 0)));
      if (fh.high && !th.high) p *= 1.1;
    } else { if (fh.high) p *= 1.15; if (fh.shootDef) p *= 0.7; }               // Schuetzen im Wald: Baeume fangen Pfeile
    return p;
  }
  function defense(s, t, u, kind) {
    const U = UT[t.type], th = ground(s, t.col, t.row); let d = U.def * Math.pow(t.men / t.max, 0.5) * (t.max / UNIT_MEN);
    if (t.side === 'G') d *= K.gaulDef;
    d *= (kind === 'shoot' && th.shootDef) ? th.shootDef : th.def;
    if (t.form === 'march') d *= 0.5;                                              // Marschformation: halbe Verteidigung
    if (t.side === 'R') d *= 1 + 0.06 * Math.min(3, adjacentFriends(s, t, t.col, t.row));        // Verbund der Kohorten
    if (U.antiCav && UT[u.type].cav) d *= 1.6;
    d *= 0.8 + 0.2 * (t.morale / 100);
    if (t.routed) d *= 0.6;
    return d;
  }
  function expected(s, u, t, kind, moved, from) {
    const P = power(s, u, t, kind, moved, from), D = defense(s, t, u, kind), ratio = P / (P + D);
    const k = u.men * (kind === 'shoot' ? K.shoot : K.melee) * 2 * ratio * (t.routed ? 1.5 : 1) * cut(s, t, kind);
    let ret = 0;
    if (kind === 'melee' && !t.routed && UT[t.type].att > 0) { const P2 = power(s, t, u, 'melee', 0, [t.col, t.row]) * K.ret, D2 = defense(s, u, t, 'melee'); ret = t.men * K.melee * 2 * (P2 / (P2 + D2)) * cut(s, u, 'melee'); }
    return { kills: Math.min(t.men, k), ret: Math.min(u.men, ret) };
  }
  // Fernkampfreichweite: Huegel +1, Wald -1 (Baeume fangen Pfeile ab); Schuetzen im Wald mit Reichweite 1 koennen nicht schiessen
  function rangeOf(s, u, c, r) { const U = UT[u.type]; if (!(U.shoot > 0)) return 1; const tt = s.terrain[r][c]; return U.rng + (tt === 'hill' ? 1 : 0) - (tt === 'forest' ? 1 : 0); }
  const marchable = u => u.side === 'R' && (u.type === 'legion' || u.type === 'archer');
  function setFormation(s, u, form) {                                               // Phalanx <-> Marsch (nur roemische Infanterie)
    if (!marchable(u) || u.gone || u.routed || u.form === form) return false;
    if (s.phase === 'deploy') { u.form = form; return true; }
    if (u.acted || u.moved > 0) return false;
    u.form = form; if (form === 'phalanx') u.acted = true;                         // Aufbau der Phalanx kostet die Aktion
    note(s, `${UT[u.type].name}: ${form === 'march' ? 'Marschformation' : 'Phalanx'}`); return true;
  }
  const cut = (s, t, kind) => { const T = ground(s, t.col, t.row); return (T.cut && T.cut[kind]) || 1; };
  function targetsFrom(s, u, c, r, moved) {
    const U = UT[u.type], out = [];
    for (const t of s.units) {
      if (t.gone || t.men <= 0 || t.side === u.side) continue;
      const d = dist(c, r, t.col, t.row);
      if (d === 1) out.push({ t, kind: 'melee' });
      else if (U.shoot > 0 && d >= 2 && d <= rangeOf(s, u, c, r) && moved <= 1) out.push({ t, kind: 'shoot' });
    }
    return out;
  }
  function note(s, text) { s.log.push({ turn: s.turn, side: s.side, text }); if (s.log.length > 200) s.log.shift(); }
  // Roemische Einheiten mit Nachbarn halten zusammen: je Nachbar -12 % Moralverlust (max. 3)
  const cohesion = (s, t) => t.side === 'R' ? 1 - 0.12 * Math.min(3, adjacentFriends(s, t, t.col, t.row)) : 1;
  function applyDamage(s, t, kills, moraleScale, flanked) {
    const frac = kills / Math.max(1, t.men); t.men = Math.max(0, t.men - kills); t.killed += kills;
    t.morale -= frac * K.moraleLoss * moraleScale * cohesion(s, t) + (flanked ? 4 : 0) + (t.men > 0 && t.men < t.max * 0.4 ? 3 : 0);
  }
  function attack(s, u, t, kind) {
    const from = [u.col, u.row], moved = u.moved, U = UT[u.type];
    const P = power(s, u, t, kind, moved, from), D = defense(s, t, u, kind), ratio = P / (P + D);
    const flanked = kind === 'melee' && adjacentEnemies(s, t, t.col, t.row) >= 2;
    let kills = Math.max(1, Math.round(u.men * (kind === 'shoot' ? K.shoot : K.melee) * 2 * ratio * (0.75 + 0.5 * s.rnd()) * (t.routed ? 1.5 : 1) * cut(s, t, kind)));
    kills = Math.min(kills, t.men); if (u.type === 'legion' && moved >= 1) u.pilum = true;
    const tmen = t.men; applyDamage(s, t, kills, 1, flanked);
    let ret = 0;
    if (kind === 'melee' && t.men > 0 && !t.routed && UT[t.type].att > 0) {
      const P2 = power(s, t, u, 'melee', 0, [t.col, t.row]) * K.ret, D2 = defense(s, u, t, 'melee');
      ret = Math.min(u.men, Math.max(0, Math.round(t.men * K.melee * 2 * (P2 / (P2 + D2)) * (0.75 + 0.5 * s.rnd()) * cut(s, u, 'melee')))); applyDamage(s, u, ret, 0.8, false);
    }
    if (kills > tmen * 0.12) u.morale = Math.min(100, u.morale + 3);
    u.acted = true;
    note(s, `${UT[u.type].name} ${kind === 'shoot' ? 'schießen auf' : 'greifen an:'} ${UT[t.type].name} (−${kills}${ret ? ', Gegenschlag −' + ret : ''})`);
    for (const x of [t, u]) checkBreak(s, x);
    checkEnd(s);
    return { kills, ret };
  }
  const routLimit = u => u.side === 'R' ? K.routR : K.routG;
  function checkBreak(s, u) {
    if (u.gone) return;
    if (u.men <= 0) { u.gone = true; shock(s, u, 6); return; }
    if (!u.routed && (u.morale <= routLimit(u) || u.men < u.max * 0.08)) { u.routed = true; note(s, `${UT[u.type].name} fliehen vom Schlachtfeld`); shock(s, u, 8); }
  }
  function shock(s, u, base) {                                                       // Nachbarn sehen den Zusammenbruch
    for (const o of s.units) { if (o.gone || o === u || o.men <= 0) continue; const d = dist(u.col, u.row, o.col, o.row);
      if (d > 2) continue; if (o.side === u.side) { o.morale -= (K.shock + (o.side === 'G' ? K.shockG : 0)) * (d === 1 ? 1 : 0.5) * cohesion(s, o); checkBreakSoft(s, o); } else o.morale = Math.min(100, o.morale + 2); }
  }
  function checkBreakSoft(s, o) { if (!o.routed && !o.gone && (o.morale <= routLimit(o) || o.men < o.max * 0.08)) { o.routed = true; note(s, `${UT[o.type].name} fliehen vom Schlachtfeld`); } }
  function moveUnit(s, u, c, r) {
    const R = reach(s, u), cost = R.best.get(key(c, r)); if (cost === undefined || u.acted || u.moved > 0 && cost > 0 && false) return false;
    u.col = c; u.row = r; u.moved = cost; return true;
  }
  // ---------------------------------------------------------------- Zugablauf
  function resetSide(s, side) { for (const u of s.units) if (u.side === side) { u.acted = false; u.moved = 0; } }
  function rallyAndFlee(s, side) {
    for (const u of s.units.filter(x => x.side === side && x.routed && !x.gone && x.men > 0)) {
      const near = s.units.some(o => !o.gone && o.men > 0 && o.side !== side && !o.routed && dist(u.col, u.row, o.col, o.row) <= 3);
      if (!near) { u.morale = Math.min(100, u.morale + (side === 'R' ? 9 : 3)); if (u.morale >= routLimit(u) + 18 && u.men >= u.max * 0.12) { u.routed = false; note(s, `${UT[u.type].name} sammeln sich wieder`); continue; } }
      const edgeRow = side === 'R' ? ROWS - 1 : 0;
      if (u.row === edgeRow) { u.gone = true; u.fledMen = u.men; note(s, `${UT[u.type].name} entkommen vom Schlachtfeld`); continue; }
      // Flucht: zum eigenen Rand, weg vom Feind
      const R = reach2(s, u); let bestHex = null, bestScore = -1e9;
      for (const [k, cost] of R) { const c = k % COLS, r = Math.floor(k / COLS); const occ = unitAt(s, c, r); if (occ && occ !== u) continue; let d = 99; for (const o of s.units) if (!o.gone && o.men > 0 && o.side !== side && !o.routed) d = Math.min(d, dist(c, r, o.col, o.row));
        const sc = d * 2 + (side === 'R' ? r : ROWS - 1 - r) * 3 - cost * 0.3; if (sc > bestScore) { bestScore = sc; bestHex = [c, r]; } }
      if (bestHex) { u.col = bestHex[0]; u.row = bestHex[1]; if (u.row === edgeRow) { u.gone = true; u.fledMen = u.men; note(s, `${UT[u.type].name} entkommen vom Schlachtfeld`); } }
    }
  }
  function reach2(s, u) {                                                            // Fluchtbewegung: die eigene Linie darf durchquert werden, Feinde sperren
    const mp = UT[u.type].mv, best = new Map([[key(u.col, u.row), 0]]), open = [[0, u.col, u.row]];
    while (open.length) { open.sort((a, b) => a[0] - b[0]); const [cost, c, r] = open.shift();
      for (const [a, b] of nbrs(c, r)) { if (ground(s, a, b).impass) continue; const o = unitAt(s, a, b); if (o && o.side !== u.side) continue; const nc = cost + moveCost(s, u, a, b); if (nc > mp) continue; if (nc < (best.get(key(a, b)) ?? 99)) { best.set(key(a, b), nc); open.push([nc, a, b]); } } }
    return best;
  }
  // Wer von fliehenden Kameraden umgeben ist, verliert den Mut: mind. 2 fliehende Nachbarn, oder alle Nachbarn fliehen
  function panicCheck(s, side) {
    for (const u of fighting(s, side)) {
      let nr = 0, fr = 0; for (const [a, b] of nbrs(u.col, u.row)) { const o = unitAt(s, a, b); if (o && o.side === side) { if (o.routed) nr++; else fr++; } }
      if (nr >= 2 || (nr >= 1 && fr === 0)) { u.morale -= (side === 'R' ? 7 : 11) * nr; note(s, `${UT[u.type].name} geraten in Panik`); checkBreakSoft(s, u); }
    }
  }
  function endSide(s) {                                                              // Seite beendet ihren Zug
    if (s.over) return;
    if (s.side === 'R') { s.side = 'G'; resetSide(s, 'G'); rallyAndFlee(s, 'G'); panicCheck(s, 'G'); }
    else { s.turn++; s.side = 'R'; resetSide(s, 'R'); rallyAndFlee(s, 'R'); panicCheck(s, 'R'); if (s.turn > s.maxTurns) { s.over = decide(s, 'turns'); } }
    checkEnd(s);
  }
  const strength = (s, side) => s.units.filter(u => u.side === side && !u.gone && u.men > 0).reduce((a, u) => a + u.men * (u.routed ? 0.2 : 1), 0);
  function decide(s, why) {
    const r = strength(s, 'R'), g = strength(s, 'G');
    return { winner: r > g * 1.2 ? 'R' : g > r * 1.2 ? 'G' : null, why };
  }
  function checkEnd(s) {
    if (s.over || s.phase !== 'fight') return;
    for (const side of ['R', 'G']) {
      const start = s.startUnits[side], fit = fighting(s, side).length;
      if (side === 'G' && !s.panicG && fit <= start * K.panicAt) { s.panicG = true; for (const u of fighting(s, 'G')) { u.morale -= 12; checkBreakSoft(s, u); } note(s, 'Panik unter den Galliern'); }
      if (fit === 0 || fit <= start * 0.2) {
        for (const u of fighting(s, side)) u.routed = true;
        s.over = { winner: enemyOf(side), why: fit === 0 ? 'vernichtet oder geflohen' : 'Heer bricht zusammen' }; return;
      }
    }
  }
  function retreatAll(s) {                                                           // Rueckzug des roemischen Heeres
    for (const u of s.units) if (u.side === 'R' && !u.gone && u.men > 0) { u.routed = true; }
    s.over = { winner: 'G', why: 'Rückzug' , retreat: true };
  }
  // Ergebnis in Mann: Gefallene und Fluechtige je Seite
  function result(s) {
    const o = { rKilled: 0, rFled: 0, gKilled: 0, gFled: 0, turns: s.turn, winner: s.over ? s.over.winner : null, retreat: !!(s.over && s.over.retreat), why: s.over ? s.over.why : '' };
    for (const u of s.units) {
      const fled = u.gone && u.fledMen ? u.fledMen : (u.routed && !u.gone && u.men > 0 ? u.men : 0);
      if (u.side === 'R') { o.rKilled += u.killed; o.rFled += fled; } else { o.gKilled += u.killed; o.gFled += fled; }
    }
    return o;
  }

  // ---------------------------------------------------------------- KI
  const VAL = { archer: 1.25, sling: 1.1, cav: 1.2, sword: 1.0, spear: 1.0, legion: 1.15 };
  function nearestEnemyDist(s, u, c, r) { let d = 99; for (const o of s.units) if (!o.gone && o.men > 0 && o.side !== u.side && !o.routed) d = Math.min(d, dist(c, r, o.col, o.row)); return d; }
  function bestAction(s, u) {
    const R = reach(s, u), side = u.side; let best = null;
    const cavNear = s.units.some(o => !o.gone && o.men > 0 && !o.routed && o.side !== side && UT[o.type].cav && dist(u.col, u.row, o.col, o.row) <= 5);
    for (const [k, cost] of R.best) {
      const c = k % COLS, r = Math.floor(k / COLS); if (!(c === u.col && r === u.row) && unitAt(s, c, r)) continue;
      const saved = [u.col, u.row, u.moved]; u.col = c; u.row = r; u.moved = cost;
      const tg = targetsFrom(s, u, c, r, cost); let score = 0, choice = null;
      for (const { t, kind } of tg) {
        const e = expected(s, u, t, kind, cost, [c, r]);
        let sc = e.kills * (VAL[t.type] || 1) - e.ret * (VAL[u.type] || 1) * (side === 'R' ? 0.8 : 0.45);
        if (e.kills >= t.men * 0.85) sc += 25; if (t.routed) sc += 12;
        if (UT[u.type].shoot > 0 && kind === 'shoot') sc += 6;
        if (!choice || sc > choice.sc) choice = { t, kind, sc };
      }
      if (choice) score = 60 + choice.sc; else score = -nearestEnemyDist(s, u, c, r) * 5 - cost * 0.2;
      const T = ground(s, c, r); score += (T.def - 1) * 18 + (T.high ? 6 : 0);
      if (UT[u.type].shoot > 0 && enemyAdj(s, u, c, r)) score -= 25;                // Fernkaempfer meiden den Nahkampf
      if (UT[u.type].cav && ground(s, c, r).cmv > 1) score -= 8;
      if (cavNear && UT[u.type].antiCav) score += 6 * adjacentFriends(s, u, c, r);
      if (side === 'R') { const af = adjacentFriends(s, u, c, r); score += af >= 1 ? 4 + af : -12; if (u.type === 'archer') score += adjacentFriends(s, u, c, r) * 2; }   // Disziplin: Verbund halten
      else if (u.type === 'sword' && !choice) score -= nearestEnemyDist(s, u, c, r) * 4;                        // Gallier: ungestuemer Sturm
      u.col = saved[0]; u.row = saved[1]; u.moved = saved[2];
      if (!best || score > best.score) best = { score, c, r, cost, choice };
    }
    return best;
  }
  // Naechste Einheit der Seite handelt (fuer animierte Zuege); liefert die Einheit oder null
  function aiNext(s, side) {
    if (s.over) return null;
    const u = fighting(s, side).filter(x => !x.acted).sort((a, b) => nearestEnemyDist(s, a, a.col, a.row) - nearestEnemyDist(s, b, b.col, b.row))[0];
    if (!u) return null;
    const a = bestAction(s, u);
    if (a) { if (a.c !== u.col || a.r !== u.row) { u.col = a.c; u.row = a.r; u.moved = a.cost; } if (a.choice && !s.over) attack(s, u, a.choice.t, a.choice.kind); }
    u.acted = true; return u;
  }
  function aiPlay(s, side, cb) { let u; while ((u = aiNext(s, side))) { if (cb) cb(u); } }
  // Komplette Schlacht ohne Spielerzug (Tests, "Auto-Kampf")
  function autoPlay(s, maxSteps = 200) {
    if (s.phase === 'deploy') { autoDeploy(s, 'R'); startFight(s); }
    let guard = 0;
    while (!s.over && guard++ < maxSteps) { aiPlay(s, s.side); endSide(s); }
    if (!s.over) s.over = decide(s, 'turns');
    return result(s);
  }

  const API = { K, unitScale, rangeOf, marchable, setFormation, cut, panicCheck, cohesion, rallyAndFlee, COLS, ROWS, UNIT_MEN, MAX_UNITS, MAX_TURNS, TERR, UT, FAR, SITES, rng, nbrs, dist, key, inB, genTerrain, siteName, splitUnits, romanComposition, gaulComposition, newBattle,
    alive, fighting, unitAt, ground, zone, enemyOf, place, pickUp, freeZoneHexes, autoDeploy, allPlaced, startFight, reach, pathTo, targetsFrom, expected, attack, moveUnit,
    resetSide, endSide, checkEnd, retreatAll, result, aiPlay, aiNext, autoPlay, power, defense, strength, routLimit, enemyAdj, adjacentFriends, adjacentEnemies };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TAC = API;
})(typeof window !== 'undefined' ? window : globalThis);
