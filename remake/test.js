// Tests der Engine gegen die aus dem Original rekonstruierten Formeln + Bot-Simulation.
const assert = require('assert');
const JC = require('./engine.js');
const seeded = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const fixed = (...v) => { let i = 0; return () => v[i++ % v.length]; };

// --- Startwerte je Spielstaerke
let g = JC.createGame(1, seeded(1));
assert.equal(g.rv, 30000); assert.equal(g.legions[1].le, 4500); assert.equal(g.legions[1].mv, 5);
assert.equal(g.tribes[20].br, 10);                                  // Remer
g = JC.createGame(3, seeded(1)); assert.equal(g.legions[4].le, 2500);
g = JC.createGame(4, seeded(1)); assert.equal(g.rv, 8000); assert.equal(g.tribes[20].br, 9);
g = JC.createGame(2, seeded(1)); assert.equal(g.tribes[10].br, 0);  // Helvetier 0 -> bleibt 0
g = JC.createGame(5, seeded(1)); assert.equal(g.rv, 50000); assert.equal(g.tribes[20].br, 10);

// --- Geldzuwendung: Schwellen (BE+1)/(BR+1) und /3
g = JC.createGame(1, seeded(1));
let t = g.tribes[1];                                               // Allobroger BE 154392 BR 6
let thr1 = Math.floor((t.be + 1) / (t.br + 1)), thr2 = Math.floor(((t.be + 1) / 3) / (t.br + 1));
assert.equal(thr1, 22056); assert.equal(thr2, 7352);
g.rv = 100000; let r = JC.negotiate(g, 1, 2, thr1 + 1); assert.equal(r.ef, 2); assert.equal(t.br, 8);
r = JC.negotiate(g, 2, 2, 0); assert.equal(r.ef, 0);
assert.equal(g.vx, 2);
// pro Jahr max. 5 Verhandlungen, jeder Stamm einmal
assert.equal(JC.negotiate(g, 1, 2, 1).ef, null);
// Freundschaftsvertrag nur bei BR>10
g = JC.createGame(1, seeded(1)); assert.equal(JC.negotiate(g, 1, 1).ef, null);
g.tribes[1].br = 11; assert.equal(JC.negotiate(g, 1, 1).ef, 1); assert.equal(g.tribes[1].vt, 2); assert.equal(g.tribes[1].hi, 1000);
// Tributerhoehung auf Stamm mit BR 6: BR 2, Tribut 2000
g = JC.createGame(1, seeded(1)); JC.negotiate(g, 1, 6); assert.equal(g.tribes[1].br, 2); assert.equal(g.tribes[1].tr, 2000);
// ... bei BR<=4 kippt der Stamm in den Krieg und der Tribut verfaellt
g = JC.createGame(1, seeded(1)); JC.negotiate(g, 2, 6); assert.equal(g.tribes[2].br, 0); assert.equal(g.tribes[2].tr, 0);

// --- Kampf: Kapitulation
g = JC.createGame(1, seeded(7)); g.tribes[8].br = 3;
let b = JC.beginBattle(g, 1, 8); assert.equal(b.G, Math.floor(34912 / 5)); assert.equal(g.tribes[8].br, 0);
let ev; for (let i = 0; i < 100; i++) { ev = JC.stepBattle(g, b); if (ev.type !== 'round') break; }
assert(['capitulation', 'conquered', 'lost', 'flee'].includes(ev.type), ev.type);
if (ev.type === 'capitulation') {
  const rv0 = g.rv, be = g.tribes[8].be; JC.acceptCapitulation(g, b);
  assert.equal(g.rv, rv0 + Math.floor(be / 2)); assert.equal(g.tribes[8].vt, 1); assert.equal(g.tribes[8].tr, 1000); assert.equal(g.tribes[8].br, 5);
}
// --- Sold -> Moral
g = JC.createGame(1, seeded(1)); const L = g.legions[1]; g.rv = 1e6;
JC.payLegion(g, 1, 0); assert.equal(L.mv, 3); L.mv = 5; JC.payLegion(g, 1, 4500); assert.equal(L.mv, 4);
L.mv = 5; JC.payLegion(g, 1, 4500 * 2); assert.equal(L.mv, 5); L.mv = 5; JC.payLegion(g, 1, 4500 * 3.2); assert.equal(L.mv, 6);
// --- Haushalt / Rekrutierung
g = JC.createGame(1, seeded(1)); g.tribes[3].tr = 1000;
let bud = JC.budget(g); assert.equal(bud.cost, 9000); assert.equal(bud.income, 1000); assert.equal(bud.total, 30000 + 1000 - 9000);
g.tribes[1].hi = 1000; g.tribes[2].hi = 1000; assert.equal(JC.auxiliaries(g), 500);
assert.equal(JC.recruit(g, 1, 99999), 4500 + 500 + 5 * 250);       // gedeckelt durch Moral*250
g.legions[2].le = 8700; assert.equal(JC.recruit(g, 2, 50), 9000);

// --- Komfort-Regel Soeldner (nicht im Original)
g = JC.createGame(1, seeded(1)); assert.equal(JC.hireMercenaries(g, 1, 100), 0);              // klassisch: aus
g = JC.createGame(1, seeded(1), { mercs: true }); assert.equal(JC.hireMercenaries(g, 1, 99999), 4500);
assert.equal(g.legions[1].le, 9000); assert.equal(g.rv, 30000 - 4500 * JC.MERC_COST);
g.rv = 10; assert.equal(JC.hireMercenaries(g, 2, 99999), 3);
const as = JC.assess(JC.createGame(1, seeded(3)), 1, 10, 40); assert.equal(as.defeat, 100);   // Helvetier brechen eine Legion

// --- Verband: Summe der Staerken, Verluste anteilig
g = JC.createGame(1, seeded(5), { combined: true });
let vb = JC.beginBattle(g, [1, 2, 3, 4], 10); assert.equal(vb.R, 18000); assert.deepEqual(vb.ys, [1, 2, 3, 4]);
vb.RO = 17000; vb.GA = vb.G - 100; vb.n = 0; assert.equal(JC.finishBattle(g, vb).lost, 1000);
assert.equal(g.legions[1].le + g.legions[2].le + g.legions[3].le + g.legions[4].le, 17000); assert.equal(g.legions[2].sl, 1);
assert.equal(JC.assess(JC.createGame(1, seeded(3)), [1, 2, 3, 4], 10, 40).capitulation, 100);      // 4 Legionen zwingen die Helvetier
g.rv = 1000; JC.payLegions(g, [1, 2], 1000); assert.equal(g.rv, 0);

// --- Reichtum und Geisel-Freiwillige (nicht im Original)
g = JC.createGame(1, seeded(1), { wealth: true, slaves: true });
assert.equal(JC.tributeBase(g, g.tribes[10]), 2100); assert.equal(JC.tributeBase(g, g.tribes[8]), 300);
assert.equal(JC.tributeBase(JC.createGame(1, seeded(1)), g.tribes[10]), 1000);                  // klassisch: immer 1000
assert.equal(g.tribes.slice(1).reduce((a, t) => a + JC.tributeBase(g, t), 0), 27800);
g.tribes[10].gr = 1000; g.year = 3; let lv = JC.levyVolunteers(g);
assert.equal(lv.total, 50); assert.equal(g.tribes[10].gr, 950);                                  // 5 % der Geiseln
assert.equal(g.legions.slice(1).reduce((a, l) => a + l.le, 0), 18050);
g.year = 7; assert.equal(JC.budget(g).discharged, 0);                                            // erst nach 5 Jahren
g.year = 8; let bd = JC.budget(g); assert.equal(bd.discharged, 50); assert.equal(bd.discharge, 50 * 6);   // doppelter Betrag (6 statt 3)
const rv0 = g.rv; JC.closeBudget(g); assert.equal(g.legions.slice(1).reduce((a, l) => a + l.le, 0), 18000);
assert.equal(g.tribes[10].be, g.tribes[10].pop0 + 50); assert.equal(g.cohorts.length, 0); assert.equal(g.rv, rv0 + bd.income - bd.cost - 300);
// Verluste im Kampf treffen die Freiwilligen anteilig
g = JC.createGame(1, seeded(1), { slaves: true }); g.cohorts.push({ tribe: 10, n: 1000, legion: 1, year: 1 });
g.legions[1].le = 4000; vb = JC.beginBattle(g, 1, 8); vb.RO = 2000; vb.GA = vb.G - 10; vb.n = 0; JC.finishBattle(g, vb);
assert.equal(g.legions[1].le, 2000); assert.equal(g.cohorts[0].n, 500);

// --- Karte: Erreichbarkeit und Unruhe
g = JC.createGame(1, seeded(2), { map: true, diplomacy: true });
assert(JC.reachable(g, 1) && JC.reachable(g, 10) && JC.reachable(g, 21));                         // Nachbarn der Provinz
assert(!JC.reachable(g, 16) && !JC.reachable(g, 17));                                              // Menapier, Moriner: weit weg
assert.equal(JC.attackCheck(g, 1, 16).reason, 'unreachable'); assert.equal(JC.canNegotiate(g, 16), false);
g.tribes[9].vt = 1; assert(JC.reachable(g, 14) && JC.reachable(g, 23));                          // Haeduer kontrolliert -> Lingonen, Senonen erreichbar
g.tribes[14].vt = 1; g.tribes[23].vt = 1; g.tribes[15].vt = 1; g.tribes[20].vt = 1;
assert(JC.reachable(g, 4)); g.tribes[4].vt = 1; assert(JC.reachable(g, 17));                       // Bellovacer -> Moriner
const wo = JC.createGame(1, seeded(2)); assert(JC.reachable(wo, 16));                              // ohne Regel: alles erreichbar
// Unruheherd: Helvetier (feindlich) stecken Nachbarn an
g = JC.createGame(1, seeded(11), { map: true }); for (let k = 0; k < 40; k++) { g.tribes[24].br = 3; g.tribes[1].br = 3; JC.beginYear(g); }
assert(g.tribes[24].br <= 3);                                                                        // Sequaner/Allobroger grenzen an Helvetier
let spread = 0; for (let k = 0; k < 200; k++) { g = JC.createGame(1, Math.random, { map: true }); g.tribes[24].br = 6; JC.beginYear(g); if (g.unrest.some(u => u.from === 10 && u.to === 24)) spread++; }
assert(spread > 20 && spread < 100, 'Ausbreitungsrate ' + spread);                                  // ca. 30 %
// --- Diplomatie: Friedensbedingungen
g = JC.createGame(1, seeded(1), { diplomacy: true, wealth: true });
const t8 = g.tribes[8];
let off = JC.peaceOffer(g, 8, 'balanced'); assert.equal(off.br, 5); assert.equal(off.hostages, Math.floor(t8.be / 10));
assert.equal(JC.peaceOffer(g, 8, 'tribute').tribute, 2 * off.tribute); assert(JC.peaceOffer(g, 8, 'hostages').hostages > 2 * off.hostages);
assert.equal(JC.peaceOffer(g, 8, 'gold').denars, 2 * off.denars); assert.equal(JC.peaceOffer(g, 8, 'mild').br, 7);
assert.equal(JC.peaceOffer(JC.createGame(1, seeded(1)), 8, 'gold').denars, off.denars);          // klassisch: nur ausgewogen
// Ultimatum: Chance
g.legions[1].le = g.legions[2].le = g.legions[3].le = g.legions[4].le = 9000;
assert(JC.ultimatumChance(g, [1, 2, 3, 4], 8) >= 0.89); assert.equal(JC.ultimatumChance(g, 1, 10), 0);   // Uebermacht vs Riese
let okc = 0, br0 = 0; for (let k = 0; k < 300; k++) { const h = JC.createGame(1, Math.random, { diplomacy: true }); h.legions[1].le = 9000; const u = JC.ultimatum(h, 1, 8); if (u.ok) okc++; else if (h.tribes[8].br === 0) br0++; }
assert(okc > 0 && okc + br0 === 300);
g = JC.createGame(1, seeded(3), { diplomacy: true }); g.tribes[9].br = 9; JC.ultimatum(g, 1, 9); // Misserfolg gegen Haeduer (Riesen? 56432 pop) -> Aufruhr der Gallier
assert(g.tribes[9].br === 0 || g.tribes[9].br === 9);
// Sondierung und Geiseln fordern
g = JC.createGame(1, seeded(4), { diplomacy: true }); let efs = []; for (let k = 0; k < 200; k++) { const h = JC.createGame(1, Math.random, { diplomacy: true }); h.tribes[9].br = 9; efs.push(JC.negotiate(h, 9, 8).ef); }
assert(efs.includes(1) && efs.includes(0));
g = JC.createGame(1, seeded(4), { diplomacy: true }); g.tribes[8].vt = 1; g.tribes[8].br = 5; const be0 = g.tribes[8].be; assert.equal(JC.negotiate(g, 8, 10).ef, 1); assert.equal(g.tribes[8].gr, Math.floor(be0 / 40)); assert.equal(g.tribes[8].br, 3);

// --- Einsatzrhythmus und ausgewogene Finanzen
g = JC.createGame(1, seeded(8), { once: true, econ: true });
assert(JC.canAct(g, 1)); JC.moveLegion(g, 1, 10); assert(!JC.canAct(g, 1)); assert.equal(JC.attackCheck(g, [1, 2], 10).reason, 'acted');
assert.equal(JC.attackCheck(g, [2, 3], 10).ok, true); JC.beginBattle(g, [2, 3], 10); assert(!JC.canAct(g, 2) && !JC.canAct(g, 3) && JC.canAct(g, 4));
JC.beginYear(g); assert([1, 2, 3, 4].every(i => JC.canAct(g, i)));                                    // neues Jahr: alle bereit
const og = JC.createGame(1, seeded(8)); JC.moveLegion(og, 1, 10); assert(JC.canAct(og, 1));         // ohne Regel: beliebig oft
g.legions[1].acted = false; const u = JC.ultimatum(g, [1], 8, false); assert(JC.canAct(g, 1));        // Verhandlungs-Ultimatum bindet keine Legion
JC.ultimatum(g, [1], 8, true); assert(!JC.canAct(g, 1));
assert.equal(JC.soldThresholds(g, 4500).neutral, Math.ceil(4500 * 1.1 * 0.4)); assert.equal(JC.soldThresholds(og, 4500).neutral, Math.ceil(4500 * 1.1));
g.legions[1].mv = 5; g.rv = 99999; JC.payLegion(g, 1, JC.soldThresholds(g, 4500).neutral); assert.equal(g.legions[1].mv, 5);    // genug Sold: keine Moraleinbusse
JC.payLegion(g, 1, 0); assert.equal(g.legions[1].mv, 3);
assert.equal(JC.budget(g).province, 8000); assert.equal(JC.budget(g).income, 8000); assert.equal(JC.budget(og).province, 0);

// --- Bot-Simulation (Zufallsspiel, soll nie abstuerzen)
function bot(sp, seed) {
  const g = JC.createGame(sp, seeded(seed)); let years = 0;
  while (!g.over && years < 60) {
    years++;
    for (let a = 0; a < 12 && !g.over; a++) {                      // Angriffe dieses Jahres
      const y = 1 + (a % 4), L = g.legions[y];
      const cand = g.tribes.filter(t => t && !t.ex && t.vt === 0).sort((p, q) => p.be - q.be);
      if (!cand.length || L.le < 1500) continue;
      const x = cand[0].id; if (!JC.attackCheck(g, y, x).ok) continue;
      const bt = JC.beginBattle(g, y, x); let end = null;
      for (let i = 0; i < 100 && !end; i++) {
        const ev = JC.stepBattle(g, bt);
        if (ev.type === 'capitulation') { JC.acceptCapitulation(g, bt); end = 1; }
        else if (ev.type === 'conquered') { JC.resolveConquest(g, bt, ev.maxLoot / 2, Math.floor(g.tribes[x].be / 10)); end = 1; }
        else if (ev.type !== 'round') end = 1;
      }
      JC.finishBattle(g, bt); JC.payLegion(g, y, Math.min(g.rv, g.legions[y].le * 1.5));
    }
    if (JC.checkVictory(g)) break;
    JC.winterAttack(g); const bud = JC.closeBudget(g); if (g.over) break;
    for (let i = 1; i <= 4; i++) JC.recruit(g, i, 99999);
    JC.nextYear(g);
  }
  return { over: g.over || 'timeout', years, pac: JC.pacified(g), rv: g.rv };
}
const res = {};
for (const sp of [1, 2, 3, 4, 5]) {
  res[sp] = { win: 0, lose: 0, timeout: 0, years: 0, pac: 0 };
  for (let s = 1; s <= 200; s++) { const r = bot(sp, s); res[sp][r.over]++; res[sp].years += r.years; res[sp].pac += r.pac; }
  res[sp].years = (res[sp].years / 200).toFixed(1); res[sp].pac = (res[sp].pac / 200).toFixed(1);
}
console.log('Alle Assertions OK.\nBot (nur Angriff, 200 Spiele je Stufe):'); console.table(res);
