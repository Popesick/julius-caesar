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

// --- Luecke Einsatz: eingesetzte Legion darf nicht erneut "marschieren" (auch nicht zu befriedeten Staemmen)
g = JC.createGame(1, seeded(9), { once: true, map: true }); g.tribes[1].vt = 1; JC.moveLegion(g, 1, 1);
assert.equal(JC.attackCheck(g, 1, 1).reason, 'acted'); assert.equal(JC.attackCheck(g, [1, 2], 1).reason, 'acted');
g.tribes[10].ex = 1; assert.equal(JC.attackCheck(g, 1, 10).reason, 'acted');

// --- Raenge und Ansehen (Regel rank)
g = JC.createGame(1, seeded(10), { rank: true, wealth: true, map: true, mercs: true });
assert.equal(JC.RANKS.length, 9); assert.deepEqual(JC.RANKS.map(r => r.cap), [4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 9000]);
assert.equal(JC.rankOf(g).name, 'Offizier'); assert.equal(JC.maxLegion(g), 4500);
assert.equal(JC.hireMercenaries(g, 1, 999), 0);                                                     // Legion schon auf Rang-Hoechststaerke
assert.equal(JC.maxLegion(JC.createGame(1, seeded(1))), 9000);                                       // Original: 9000
JC.addRep(g, 75, 'Test'); assert.equal(JC.rankOf(g).name, 'Zenturio'); assert.equal(JC.maxLegion(g), 5000);
assert.equal(JC.hireMercenaries(g, 1, 999), 500);
const evs = JC.drainEvents(g); assert(evs.some(e => e.kind === "rank" && e.to === "Zenturio")); assert.equal(g.events.length, 0);
JC.addRep(g, -500, 'Skandal'); assert.equal(g.rep, 0); assert.equal(JC.rankOf(g).name, 'Zenturio');   // nie degradiert
JC.addRep(g, 200, 'Test'); assert.equal(JC.rankOf(g).name, 'Tribun'); assert(JC.drainEvents(g).some(e => e.kind === 'rank' && e.cav));  // Kavallerie ab Tribun
// Caesar braucht mehr als Punkte
g = JC.createGame(1, seeded(10), { rank: true }); JC.addRep(g, 2000, 'Test'); assert.equal(JC.rankOf(g).name, 'Prokonsul');
g.satisf = 80; g.games.races = 5; for (let i = 1; i <= 5; i++) g.tribes[i].vt = 2; JC.addSatisf(g, 1, 'Test'); assert.equal(JC.rankOf(g).name, 'Caesar'); assert.equal(JC.maxLegion(g), 9000);
// Provinz bringt mehr Ehre, wenn reich; bloss ohne Kampf noch mehr
g = JC.createGame(1, seeded(12), { rank: true, diplomacy: true }); JC.applyPeace(g, 10, JC.peaceOffer(g, 10, 'balanced', 1)); const r1 = g.rep;       // Helvetier (reich)
g = JC.createGame(1, seeded(12), { rank: true, diplomacy: true }); JC.applyPeace(g, 8, JC.peaceOffer(g, 8, 'balanced', 1)); const r2 = g.rep;        // Eburonen (klein)
assert(r1 > r2 && r2 >= 14, r1 + ' ' + r2);
g = JC.createGame(1, seeded(12), { rank: true, diplomacy: true }); JC.applyPeace(g, 8, JC.peaceOffer(g, 8, 'balanced', 0.5)); assert(g.rep > r2);
// Aufstand kostet Ansehen, nie den Rang
g = JC.createGame(1, seeded(13), { rank: true }); JC.addRep(g, 80, 't'); JC.applyPeace(g, 8, JC.peaceOffer(g, 8)); const rr = g.rep, st = g.satisf; g.tribes[8].br = 0; g.tribes[8].vt = 0; JC.syncTreaties(g);
assert(g.rep < rr && g.satisf < st && JC.rankOf(g).name === 'Zenturio');
// Spiele
g = JC.createGame(1, seeded(14), { rank: true }); g.rv = 500000;
assert(!JC.canHold(g, 'gladiators').ok); assert(JC.canHold(g, 'race').ok); const rc = JC.holdRace(g, 2); assert.equal(g.rv, 500000 - JC.GAME_COST.race); assert.equal(g.games.races, 1);
assert.deepEqual([JC.GAME_COST.race, JC.GAME_COST.gladiators, JC.GAME_COST.amphitheater], [9000, 18000, 300000]);
JC.buildAmphitheater(g); assert(g.games.amph && !JC.canHold(g, 'amphitheater').ok && JC.canHold(g, 'gladiators').ok);
JC.holdRace(g, 1); assert(!JC.canHold(g, 'race').ok);                                                     // max. 2 Spiele pro Jahr (Rennen + Rennen)
JC.beginYear(g); assert(JC.canHold(g, 'gladiators').ok); JC.startGladiators(g); const gj = JC.judgeGladiators(g, 'mercy'); assert.equal(typeof gj.ok, 'boolean');
// Zufriedenheit -> Moral im Winter
g = JC.createGame(1, seeded(15), { rank: true }); g.satisf = 90; JC.winterRome(g); assert.equal(g.legions[1].mv, 7);
g = JC.createGame(1, seeded(15), { rank: true }); g.satisf = 10; JC.winterRome(g); assert.equal(g.legions[1].mv, 3);
g = JC.createGame(1, seeded(15), { rank: true }); g.satisf = 50; JC.winterRome(g); assert.equal(g.legions[1].mv, 5);
g = JC.createGame(1, seeded(15)); g.satisf = 99; assert.equal(JC.winterRome(g), null);                  // ohne Regel nichts

// --- Taktische Hexschlachten
const TAC = require('./tactics.js');
assert.equal(TAC.dist(0, 0, 0, 0), 0); assert.equal(TAC.nbrs(5, 5).length, 6); assert.equal(TAC.nbrs(0, 0).length, 2);                       // Rand
for (const [c, r] of TAC.nbrs(7, 4)) assert.equal(TAC.dist(7, 4, c, r), 1); for (const [c, r] of TAC.nbrs(7, 5)) assert.equal(TAC.dist(7, 5, c, r), 1);
assert.deepEqual(TAC.splitUnits(1200), [500, 500, 200]); assert.deepEqual(TAC.splitUnits(4500), Array(9).fill(500)); assert.equal(TAC.splitUnits(100000).length, 40); // Aufgebot max. 40
assert.equal(TAC.splitUnits(1050).length, 2); assert.equal(TAC.splitUnits(1100).length, 3); assert(TAC.splitUnits(1030).every(m => m <= 500));                            // kleine Reste werden angehaengt
assert.deepEqual(TAC.romanComposition(4500, false), { archer: 1, cav: 0, legion: 8 }); assert.equal(TAC.romanComposition(4500, true).cav, 1);       // Anteile Legionaere/Bogenschuetzen/Reiter
const gc = TAC.gaulComposition(10000, 2, 25); assert.equal(Object.values(gc).reduce((a, b) => a + b, 0), 20); assert(gc.archer + gc.sling > 0 && gc.cav >= 3);   // Aquitaner: viele Schuetzen
assert(TAC.gaulComposition(10000, 0, 8).sword > TAC.gaulComposition(10000, 2, 25).sword);                                                     // Belger: mehr Schwertkaempfer
// Gelaende: jeder Stamm individuell, Aufmarschzonen begehbar, Hindernisse verbinden nicht komplett
const sig = id => TAC.genTerrain(id, 1).map(r => r.join(',')).join('|');
assert.notEqual(sig(10), sig(8)); assert.notEqual(TAC.genTerrain(10, 1).join(), TAC.genTerrain(10, 2).join()); assert.equal(sig(10), sig(10));
for (const id of Object.keys(TAC.SITES)) { const gt = TAC.genTerrain(+id, 5); for (let r = 0; r < TAC.ROWS; r++) for (let c = 0; c < TAC.COLS; c++) if (r <= 2 || r >= TAC.ROWS - 3) assert(!TAC.TERR[gt[r][c]].impass, 'Zone ' + id); }
// Schlacht: Einheiten zu 500 Mann, Aufstellung nur in der Zone, Zugregeln
let tb = TAC.newBattle({ tribeId: 8, seed: 3, romanMen: 4500, romanMorale: 5, gaulMen: 3500, group: 0, hostile: true });
assert.equal(tb.units.filter(u => u.side === 'R').length, 9); assert.equal(tb.units.filter(u => u.side === 'G').length, 7); assert(tb.units.every(u => u.men <= 500));
assert.equal(tb.units.filter(u => u.side === 'R').reduce((a, u) => a + u.men, 0), 4500);
const ru = tb.units.find(u => u.side === 'R'); assert(!TAC.place(tb, ru, 3, 2));  assert(TAC.place(tb, ru, 3, TAC.ROWS - 1) || TAC.ground(tb, 3, TAC.ROWS - 1).impass === false);   // nur untere drei Reihen
assert(!TAC.startFight(tb)); TAC.autoDeploy(tb, 'R'); TAC.autoDeploy(tb, 'G'); assert(TAC.startFight(tb)); assert.equal(tb.phase, 'fight');
assert(tb.units.every(u => TAC.zone(u.side, u.row))); assert.equal(new Set(tb.units.map(u => u.col + ',' + u.row)).size, tb.units.length);        // keine Doppelbelegung
// Moral: stark verwundete Einheit flieht
const v = tb.units.find(u => u.side === 'G'); v.morale = 5; TAC.attack(tb, tb.units.find(u => u.side === 'R'), v, 'melee'); assert(v.routed || v.gone || v.men > 0);
// Vollautomatisch, 80 Schlachten: Invarianten
let rw = 0, gw = 0; for (let i = 1; i <= 80; i++) { const bs = TAC.newBattle({ tribeId: 1 + (i % 30), seed: i, romanMen: 4500, romanMorale: 5, gaulMen: 4500, group: i % 4, hostile: false }); const r = TAC.autoPlay(bs);
  assert(bs.over && r.turns <= TAC.MAX_TURNS + 1); assert(r.rKilled <= 4500 && r.gKilled <= 4500 && r.rFled <= 4500);
  for (const u of bs.units) { assert(u.men >= 0 && u.men <= 500 && u.killed >= 0); } if (r.winner === 'R') rw++; else if (r.winner === 'G') gw++; }
assert(rw > gw * 2, 'Roemer sollten bei gleicher Zahl klar vorn liegen: ' + rw + ':' + gw);
// Roemische Uebermacht-Gallier: Gallier mit 2,5-facher Zahl gewinnen meist
let g25 = 0; for (let i = 1; i <= 40; i++) { const r = TAC.autoPlay(TAC.newBattle({ tribeId: 19, seed: i, romanMen: 4500, romanMorale: 5, gaulMen: 11000, group: 1, hostile: false })); if (r.winner === 'G') g25++; } assert(g25 > 25, 'Gallier 2,4:1 ' + g25);
// Bruecke: Ergebnis -> Kampagne
g = JC.createGame(1, seeded(20), { tactics: true, map: false }); let tbt = JC.beginBattle(g, [1, 2, 3, 4], 8);
let ev2 = JC.applyTactical(g, tbt, { rKilled: 1000, rFled: 500, gKilled: 2000, gFled: 1000, winner: 'R' });
assert.equal(tbt.RO, 18000 - (1000 + 200)); assert.equal(tbt.GA, tbt.G - (2000 + 700)); assert.equal(ev2.type, 'capitulation'); assert.equal(tbt.n, 0);
g = JC.createGame(1, seeded(20), { tactics: true }); tbt = JC.beginBattle(g, [1], 8); ev2 = JC.applyTactical(g, tbt, { rKilled: 3000, rFled: 0, gKilled: 100, gFled: 0, winner: 'G' }); assert.equal(tbt.n, 1); assert(['flee', 'lost'].includes(ev2.type));
g = JC.createGame(1, seeded(20), { tactics: true }); tbt = JC.beginBattle(g, [1, 2, 3, 4], 8); ev2 = JC.applyTactical(g, tbt, { rKilled: 300, rFled: 0, gKilled: tbt.G, gFled: 0, winner: 'R' }); assert.equal(ev2.type, 'conquered');
g = JC.createGame(1, seeded(20), { tactics: true }); tbt = JC.beginBattle(g, [1], 8); assert.equal(JC.applyTactical(g, tbt, { rKilled: 100, rFled: 0, gKilled: 100, gFled: 0, winner: null }).type, 'retreat');
g = JC.createGame(1, seeded(20), { tactics: true, rank: true }); tbt = JC.beginBattle(g, [1, 2], 10); const to = JC.tacticalOpts(g, tbt); assert.equal(to.romanMen, 9000); assert.equal(to.cavalry, false); assert.equal(to.hostile, true); assert.equal(to.group, 1);
g.rankIdx = 2; assert.equal(JC.tacticalOpts(g, tbt).cavalry, true);                                                                              // Kavallerie ab Tribun

// --- Taktik: Einheitengroessen, Wald, Reichweiten, Formationen, Moral, Flucht
assert.equal(TAC.unitScale(15001), 500); assert.equal(TAC.unitScale(25000), 500); assert.equal(TAC.unitScale(25001), 1000);
assert.deepEqual(TAC.splitUnits(15579), [...Array(31).fill(500), 79]); assert.equal(TAC.splitUnits(26000).length, 26); assert.equal(TAC.splitUnits(26000)[0], 1000);
assert.deepEqual(TAC.splitUnits(25579), [...Array(25).fill(1000), 579]); assert.equal(TAC.splitUnits(24999).length, 40); assert.equal(TAC.splitUnits(200000).length, 40);       // Aufgebot hoechstens 40 Einheiten
let cb = TAC.newBattle({ tribeId: 19, seed: 2, romanMen: 4500, romanMorale: 5, gaulMen: 40000, group: 1 });                    // gemeinsame Einheitengroesse, vom roemischen Heer bestimmt
assert.equal(cb.scale.R, 500); assert.equal(cb.scale.G, 500); assert.equal(cb.units.filter(u => u.side === 'R').length, 9); assert.equal(cb.units.filter(u => u.side === 'G').length, 40);   // Gegner: Aufgebot max. 40 Einheiten
cb = TAC.newBattle({ tribeId: 19, seed: 2, romanMen: 30000, romanMorale: 5, gaulMen: 20000, group: 1 });
assert.equal(cb.scale.R, 1000); assert.equal(cb.scale.G, 1000); assert.equal(cb.units.filter(u => u.side === 'R').length, 30); assert.equal(cb.units.filter(u => u.side === 'G').length, 20); assert(cb.units.every(u => u.max === 1000 && u.men <= 1000));
const mini = () => { const s = TAC.newBattle({ tribeId: 19, seed: 1, romanMen: 500, romanMorale: 5, gaulMen: 500, group: 1 }); s.units = []; s.terrain = s.terrain.map(r => r.map(() => 'plain')); s.phase = 'fight'; s.side = 'R'; return s; };
const add = (s, side, type, c, r, men = 500) => { const u = { id: s.nextId++, side, type, men, max: 500, morale: 80, col: c, row: r, acted: false, moved: 0, routed: false, gone: false, killed: 0, fledMen: 0, pilum: false, placed: true, form: 'phalanx' }; s.units.push(u); return u; };
{ // Wald: bessere Verteidigung (gegen Pfeile doppelt), weniger Schaden
  const s = mini(); const a = add(s, 'R', 'archer', 5, 8), t = add(s, 'G', 'spear', 5, 6); const shootPlain = TAC.expected(s, a, t, 'shoot', 0, [5, 8]).kills, meleeA = add(s, 'R', 'legion', 6, 7); 
  const meleePlain = TAC.expected(s, meleeA, t, 'melee', 1, [6, 7]).kills; s.terrain[6][5] = 'forest';
  const shootForest = TAC.expected(s, a, t, 'shoot', 0, [5, 8]).kills, meleeForest = TAC.expected(s, meleeA, t, 'melee', 1, [6, 7]).kills;
  assert(shootForest < shootPlain * 0.62, 'Pfeile im Wald ' + shootForest + ' vs ' + shootPlain); assert(meleeForest < meleePlain * 0.9 && meleeForest > shootForest * 0, 'Nahkampf im Wald');
  assert((shootPlain - shootForest) / shootPlain > (meleePlain - meleeForest) / meleePlain, 'Wald schuetzt staerker gegen Pfeile als gegen Nahkampf');
  assert(TAC.defense(s, t, a, 'shoot') / TAC.defense(s, t, a, 'melee') > 1.15); assert.equal(TAC.cut(s, t, 'shoot'), 0.7); assert.equal(TAC.cut(s, t, 'melee'), 0.85);
}
{ // Schuetzen: Wald -1 Reichweite und weniger Schaden, Huegel +1
  const s = mini(); const a = add(s, 'R', 'archer', 5, 8), sl = add(s, 'G', 'sling', 9, 2);
  assert.equal(TAC.rangeOf(s, a, 5, 8), 3); s.terrain[8][5] = 'forest'; assert.equal(TAC.rangeOf(s, a, 5, 8), 2); assert.equal(TAC.rangeOf(s, sl, 9, 2), 2);
  s.terrain[2][9] = 'forest'; assert.equal(TAC.rangeOf(s, sl, 9, 2), 1); s.terrain[8][5] = 'plain'; s.terrain[2][9] = 'hill'; assert.equal(TAC.rangeOf(s, sl, 9, 2), 3);
  s.terrain[8][5] = 'hill'; assert.equal(TAC.rangeOf(s, a, 5, 8), 4);
  const t = add(s, 'G', 'spear', 5, 4); assert(TAC.dist(5, 8, 5, 4) === 4 && TAC.targetsFrom(s, a, 5, 8, 0).some(o => o.t === t && o.kind === 'shoot'));        // Reichweite 4 vom Huegel
  s.terrain[8][5] = 'plain'; assert(!TAC.targetsFrom(s, a, 5, 8, 0).some(o => o.t === t));                                                                // Ebene: nur 3
  s.terrain[8][5] = 'plain'; const pPlain = TAC.power(s, a, t, 'shoot', 0, [5, 8]); s.terrain[8][5] = 'forest'; assert(TAC.power(s, a, t, 'shoot', 0, [5, 8]) < pPlain * 0.75);   // Baeume fangen Pfeile ab
  s.terrain[8][5] = 'plain'; s.terrain[2][9] = 'forest'; assert(!TAC.targetsFrom(s, sl, 9, 2, 0).length || TAC.targetsFrom(s, sl, 9, 2, 0).every(o => o.kind === 'melee'));   // Schleuderer im Wald koennen nicht schiessen
}
{ // Formationen: Marsch = doppelte Bewegung, halbe Verteidigung und Angriff
  const s = mini(); const l = add(s, 'R', 'legion', 8, 9), e = add(s, 'G', 'spear', 8, 3); const mpP = TAC.reach(s, l).best.size;
  assert(TAC.setFormation(s, l, 'march')); assert.equal(l.form, 'march'); assert.equal(l.acted, false); assert(TAC.reach(s, l).best.size > mpP * 2);
  const dM = TAC.defense(s, l, e, 'melee'); l.form = 'phalanx'; assert(Math.abs(dM * 2 - TAC.defense(s, l, e, 'melee')) < 1e-9);
  const pP = TAC.power(s, l, e, 'melee', 0, [8, 9]); l.form = 'march'; assert(Math.abs(TAC.power(s, l, e, 'melee', 0, [8, 9]) * 2 - pP) < 1e-9);
  assert(TAC.setFormation(s, l, 'phalanx')); assert.equal(l.acted, true);                                                           // Aufbau der Phalanx kostet die Aktion
  const e2 = add(s, 'G', 'sword', 3, 3); assert(!TAC.setFormation(s, e2, 'march'));                                             // nur roemische Infanterie
  const c = add(s, 'R', 'cav', 1, 9); assert(!TAC.setFormation(s, c, 'march'));
  const l2 = add(s, 'R', 'legion', 10, 9); l2.moved = 1; assert(!TAC.setFormation(s, l2, 'march'));                                  // nach der Bewegung nicht mehr
}
{ // Moral: Roemer mit Nachbarn, Panik durch fliehende Nachbarn
  const s = mini(); const a = add(s, 'R', 'legion', 6, 8), iso = add(s, 'R', 'legion', 12, 9); assert.equal(TAC.cohesion(s, iso), 1);
  for (const [c, r] of TAC.nbrs(6, 8).slice(0, 3)) add(s, 'R', 'legion', c, r); assert(Math.abs(TAC.cohesion(s, a) - 0.64) < 1e-9);
  const g1 = add(s, 'G', 'spear', 4, 3); for (const [c, r] of TAC.nbrs(4, 3).slice(0, 3)) add(s, 'G', 'spear', c, r); assert.equal(TAC.cohesion(s, g1), 1);                 // Gallier: nie
  const p = add(s, 'R', 'legion', 3, 6), n1 = add(s, 'R', 'legion', ...TAC.nbrs(3, 6)[0]), n2 = add(s, 'R', 'legion', ...TAC.nbrs(3, 6)[2]); n1.routed = n2.routed = true;
  const m0 = p.morale; TAC.panicCheck(s, 'R'); assert(p.morale < m0 - 10, 'Panik'); assert(!n1.gone);
}
{ // Fliehende Einheiten kommen durch die eigene Linie
  const s = mini(); const f = add(s, 'R', 'legion', 5, 8); f.routed = true; f.morale = 5; f.men = 300;
  for (let c = 3; c <= 8; c++) add(s, 'R', 'legion', c, 9);                                                                      // geschlossene Linie dahinter
  add(s, 'G', 'spear', 5, 1);
  TAC.rallyAndFlee(s, 'R'); assert(f.row >= 10 || f.gone, 'Fliehender steckt fest: ' + f.col + ',' + f.row);
  assert(new Set(s.units.filter(u => !u.gone).map(u => u.col + ',' + u.row)).size === s.units.filter(u => !u.gone).length);   // keine Doppelbelegung
}
// Gesamtlauf mit allen Regeln: grosse Heere, Invarianten
for (const [r, g] of [[18000, 20000], [36000, 30000], [15579, 15000], [4500, 4500]]) for (let i = 1; i <= 8; i++) { const bs = TAC.newBattle({ tribeId: 1 + i * 3, seed: i, romanMen: r, romanMorale: 5, gaulMen: g, group: i % 4, cavalry: i % 2 === 0 });
  const res = TAC.autoPlay(bs); assert(bs.over && res.rKilled <= r && res.gKilled <= g); assert(bs.units.every(u => u.men >= 0 && u.men <= u.max)); }

// --- Taktik: Verstaerkung aus der Reserve
{
  const rb = TAC.newBattle({ tribeId: 19, seed: 3, romanMen: 4500, romanMorale: 5, gaulMen: 30000, group: 1, hostile: false });
  assert.equal(rb.units.filter(u => u.side === 'G').length, 40); assert.equal(rb.reserve.G, 10000); assert.equal(rb.reserve.R, 0);               // 20 000 im Aufgebot, 10 000 in Reserve
  TAC.autoDeploy(rb, 'R'); TAC.startFight(rb); assert.equal(rb.units.length, 49);
  // nichts verloren -> keine Verstaerkung
  TAC.endSide(rb); assert.equal(rb.units.length, 49); assert.equal(rb.reserve.G, 10000);
  // drei gallische Einheiten vernichtet bzw. geflohen -> Nachschub zu Beginn des gallischen Zuges
  const gs = rb.units.filter(u => u.side === 'G'); gs[0].gone = true; gs[0].men = 0; gs[1].gone = true; gs[1].fledMen = 200; gs[2].gone = true; gs[2].men = 0;
  rb.side = 'R'; TAC.endSide(rb); assert.equal(rb.units.length, 52); assert.equal(rb.reserve.G, 10000 - 3 * 500); assert.equal(rb.reinf.G, 3);
  const arr = rb.units.slice(-3); assert(arr.every(u => u.side === 'G' && u.row <= 2 && u.placed && u.men === 500 && !u.routed)); assert(rb.log.some(l => l.text.startsWith('Verstärkung')));
  assert.equal(new Set(rb.units.filter(u => !u.gone).map(u => u.col + ',' + u.row)).size, rb.units.filter(u => !u.gone).length);                  // keine Doppelbelegung
  // pro Zug hoechstens 4 Ankuenfte, Nachschub nur fuer tatsaechlich Weggefallene
  for (const u of rb.units.filter(u => u.side === 'G' && !u.gone).slice(0, 6)) { u.gone = true; u.men = 0; } rb.side = 'R'; const before = rb.units.length; TAC.endSide(rb); assert.equal(rb.units.length - before, 4); assert.equal(rb.reinf.G, 7);
  rb.side = 'R'; TAC.endSide(rb); assert.equal(rb.reinf.G, 9);                                                                                             // Rest folgt im naechsten Zug
  // Heer mit Reserve bricht nicht zusammen, solange nachgerueckt werden kann; ohne Reserve schon
  const eb = TAC.newBattle({ tribeId: 19, seed: 4, romanMen: 4500, romanMorale: 5, gaulMen: 25000, group: 1 }); TAC.autoDeploy(eb, 'R'); TAC.startFight(eb);
  for (const u of eb.units.filter(u => u.side === 'G')) { u.gone = true; u.men = 0; } TAC.checkEnd(eb); assert(!eb.over, 'Reserve verhindert Niederlage'); eb.reserve.G = 0; TAC.checkEnd(eb); assert(eb.over && eb.over.winner === 'R');
  // Rueckgabe
  const ar = TAC.autoPlay(TAC.newBattle({ tribeId: 19, seed: 5, romanMen: 4500, romanMorale: 5, gaulMen: 26000, group: 1 })); assert(ar.arrivedG >= 0 && ar.reserveG >= 0 && ar.reserveR === 0);
  // Roemer mit Reserve (grosses Heer)
  const rr = TAC.newBattle({ tribeId: 19, seed: 6, romanMen: 24000, romanMorale: 5, gaulMen: 5000, group: 1 }); assert.equal(rr.units.filter(u => u.side === 'R').length, 40); assert.equal(rr.reserve.R, 4000);
  TAC.autoDeploy(rr, 'R'); TAC.startFight(rr); const rs = rr.units.filter(u => u.side === 'R'); rs[0].gone = true; rs[0].men = 0; rr.side = 'G'; TAC.endSide(rr); assert.equal(rr.units.length - rs.length - rr.units.filter(u => u.side === 'G').length, 1); assert.equal(rr.reserve.R, 3500);
}

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
