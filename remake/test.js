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
