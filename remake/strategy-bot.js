// Strategie-Bot: prueft, ob das Spiel mit den Originalregeln gewinnbar ist (node strategy-bot.js [Spielstaerke] [Spiele]).
const JC = require('./engine.js');
const seeded = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const SMALL = 70000;                                    // Staemme, die eine Legion zur Kapitulation zwingt

function fight(g, y, x, take) {                          // take: 'peace' | 'conquer'
  const t = g.tribes[x], b = JC.beginBattle(g, y, x); let refused = false;
  for (let i = 0; i < 400; i++) {
    const ev = JC.stepBattle(g, b);
    if (ev.type === 'round') continue;
    if (ev.type === 'capitulation') { if (take === 'conquer' && !refused) { refused = true; b.KA += 1; continue; } JC.acceptCapitulation(g, b); break; }
    if (ev.type === 'conquered') { const half = Math.floor(ev.maxLoot / 2); JC.resolveConquest(g, b, half, Math.floor(t.be / 10)); break; }
    break;
  }
  JC.finishBattle(g, b);
  const L = g.legions[y]; JC.payLegion(g, y, Math.min(g.rv, Math.floor(L.le * 0.55)));
  return b.n === 0;
}

// Soeldner nur so viele, dass nach dem Kauf noch 1,5 Jahre Unterhalt (Soldaten/2) im Vermoegen bleiben: rv - 3N >= 0.75 (S + N)
function hire(g) {
  if (!MERCS) return;
  const S = g.legions.slice(1).reduce((a, l) => a + l.le, 0);
  const income = g.tribes.reduce((a, t) => a + (t ? t.tr : 0), 0);
  const N = Math.min(Math.floor((g.rv - 0.75 * S) / 3.75), 2 * (income + 0.12 * g.rv) - S); if (N <= 0) return;      // Unterhalt dauerhaft tragbar
  for (let i = 1; i <= 4; i++) JC.hireMercenaries(g, i, Math.min(9000 - g.legions[i].le, Math.floor(N / 4)));
}
function play(sp, seed) {
  const g = JC.createGame(sp, seeded(seed), { mercs: MERCS, combined: MERCS, wealth: MERCS, slaves: MERCS, map: MERCS, diplomacy: MERCS }); let years = 0; const rnd = g.rnd;
  while (!g.over && years < 40) {
    years++;
    hire(g);
    // 0) Verband: mit allen Legionen den groessten feindlichen/freien Riesen zur Kapitulation zwingen (Komfort-Regel)
    if (MERCS) {
      const ys = [1, 2, 3, 4].filter(i => g.legions[i].le > 2000), tot = ys.reduce((a, i) => a + g.legions[i].le, 0);
      const giants = g.tribes.filter(t => t && !t.ex && t.vt === 0 && t.be >= SMALL && JC.reachable(g, t.id)).sort((a, b) => b.be - a.be);
      const tgt = giants.find(t => tot >= Math.floor(t.be / 5) * 0.42);
      if (tgt && ys.length) {
        const b = JC.beginBattle(g, ys, tgt.id); let ev;
        for (let i = 0; i < 500; i++) { ev = JC.stepBattle(g, b); if (ev.type !== 'round') break; }
        if (ev.type === 'capitulation') JC.acceptCapitulation(g, b); else if (ev.type === 'conquered') JC.resolveConquest(g, b, Math.floor(ev.maxLoot / 2), Math.floor(g.tribes[tgt.id].be / 10));
        JC.finishBattle(g, b); JC.payLegions(g, ys, Math.min(g.rv, Math.floor(JC.auxiliaries(g) * 0 + ys.reduce((a, i) => a + g.legions[i].le, 0) * 0.55)));
        hire(g);
      }
    }
    // 1) kleine, leichte Staemme erobern (BR<=3 zuerst: kein Aufruhr der Volksgruppe)
    const targets = g.tribes.filter(t => t && !t.ex && t.vt === 0 && t.be < SMALL && JC.reachable(g, t.id)).sort((a, b) => a.br - b.br || a.be - b.be);
    let used = 0;
    for (const t of targets) {
      if (used >= 4) break;
      const y = [1, 2, 3, 4].filter(i => g.legions[i].le >= 3000).sort((a, b) => g.legions[b].le - g.legions[a].le)[0];
      if (!y) break;
      fight(g, y, t.id, g.rv < 40000 ? 'conquer' : 'peace'); used++;
      if (JC.checkVictory(g)) break;
    }
    // 2) Feindschaft ruhig halten: jedes Jahr einen Angriff auf einen feindlichen Stamm (setzt KF zurueck), sofort Rueckzug
    const hostile = g.tribes.filter(t => t && !t.ex && t.br === 0 && JC.reachable(g, t.id));
    if (hostile.length) { const y = [1, 2, 3, 4].find(i => g.legions[i].le > 500); if (y) { const b = JC.beginBattle(g, y, hostile[0].id); JC.retreat(g, b); JC.finishBattle(g, b); JC.payLegion(g, y, Math.min(g.rv, g.legions[y].le)); } }
    // 3) Diplomatie: 5 Versuche - Freundschaft, sonst guenstigste Geschenke
    for (let k = 0; k < 5; k++) {
      const cand = g.tribes.filter(t => t && !t.ex && JC.canNegotiate(g, t.id));
      const ally = cand.find(t => t.br > 10 && t.vt < 2); if (ally) { JC.negotiate(g, ally.id, 1); continue; }
      const price = t => Math.floor((t.be + 1) / (t.br + 1)) + 1;
      const pool = cand.filter(t => t.vt < 2 && !(t.vt === 1 && t.br > 4 && t.br <= 10 && false)).sort((a, b) => price(a) / 2 - price(b) / 2);
      const reserve = g.legions.slice(1).reduce((a, l) => a + l.le, 0) * 0.75;      // 1,5 Jahre Unterhalt zurueckhalten
      const p = pool.find(t => price(t) < g.rv - reserve); if (!p) break;
      JC.negotiate(g, p.id, 2, price(p));
    }
    if (JC.checkVictory(g)) break;
    const wa = JC.winterAttack(g), bd = JC.budget(g);
    if (TRACE) console.log(`Jahr ${years}: RV ${g.rv} befriedet ${JC.pacified(g)} feindlich ${g.tribes.filter(t => t && t.br === 0 && !t.ex).length} Legionen ${g.legions.slice(1).map(l => l.le + '/m' + l.mv).join(' ')} Winterverlust ${wa.loss} Bilanz +${bd.income} -${bd.cost} = ${bd.total}`);
    JC.closeBudget(g); if (g.over) break;
    for (let i = 1; i <= 4; i++) JC.recruit(g, i, 99999);
    JC.nextYear(g);
  }
  return { over: g.over || 'timeout', years, pac: JC.pacified(g) };
}
const TRACE = process.argv[4] === 'trace';
const MERCS = process.argv[5] !== 'classic';
const sp = +(process.argv[2] || 1), N = +(process.argv[3] || 200);
const r = { win: 0, lose: 0, timeout: 0, years: 0, pac: 0 };
for (let s = 1; s <= N; s++) { const o = play(sp, s); r[o.over]++; r.years += o.years; r.pac += o.pac; }
console.log(`Spielstaerke ${sp}: Siege ${r.win}/${N}, Niederlagen ${r.lose}, Zeitlimit ${r.timeout}, Ø Jahre ${(r.years / N).toFixed(1)}, Ø befriedet ${(r.pac / N).toFixed(1)}`);
