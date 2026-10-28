// 컴퓨터 상대. 가능한 명령을 하나씩 해 보고, 결과 상태를 점수로 매겨 제일 좋은 걸 고른다.

const Bot = (() => {
  const D = typeof DATA !== 'undefined' ? DATA : require('./data.js');
  const E = typeof Engine !== 'undefined' ? Engine : require('./engine.js');
  const BLD = Object.fromEntries(D.buildings.map(b => [b.id, b]));
  const H = E.helpers;

  // 남은 라운드를 생각한 "지금 이 영지의 가치"
  function value(s, p) {
    const left = D.rounds - s.round + (s.over ? 0 : 1);
    const harvestsLeft = D.harvestRounds.filter(r => r >= s.round).length;
    const sc = E.score(p).total;
    let v = sc;
    v += p.workers.length * Math.min(6, left * 0.9);          // 일꾼 = 앞으로의 행동
    v += p.fields * harvestsLeft * 1.2;
    v += p.stage * left * 0.6;                                 // 넓은 땅, 좋은 건물
    const rv = { wood: 0.7, stone: 0.9, iron: 0.9, food: 0.6, gold: 0.5 };
    const fade = left <= 1 ? 0.15 : 1;                         // 마지막엔 자원이 쓸모 없음
    for (const r of Object.keys(rv)) v += p.res[r] * rv[r] * fade;
    v += p.workers.reduce((t, w) => t + w.arm, 0) * 0.5 * (left > 2 ? 1 : 0.3);
    // 다음 수확에 먹을 게 모자라면 크게 감점
    if (harvestsLeft) {
      const need = p.workers.length * D.harvest.eat;
      const have = p.res.food + p.res.gold + p.fields * D.harvest.foodPerField + (p.buildings.includes('granary') ? 2 : 0);
      if (have < need) v -= (need - have) * 3.5;
    }
    // 건물은 효과가 앞으로 쓰이니 남은 라운드만큼 더 쳐 준다
    v += p.buildings.length * Math.min(3, left * 0.5);
    // 승격 준비가 되어 가면 가산
    const next = D.stages[p.stage + 1];
    if (next && left > 0) {
      v += Math.min(1, p.workers.length / next.need.workers) * 2;
      v += Math.min(1, p.buildings.length / next.need.buildings) * 3;
      const c = Object.entries(next.cost);
      v += c.reduce((t, [r, n]) => t + Math.min(1, p.res[r] / n), 0) / c.length * 2;
    }
    if (H.canGrow(p)) v += Math.min(3, left * 0.5);
    return v;
  }

  // 한 수 앞만 보면 "집 짓고 → 식구 늘리고 → 승격" 같은 준비를 못 하니 목표 쪽으로 살짝 민다
  function plan(s, p, m) {
    const o = m.opt || {};
    const left = D.rounds - s.round;
    if (o.do === 'promote') return 12;
    if (o.grow) return 3 + left;
    if (o.b) {
      const b = BLD[o.b];
      if (b.house && p.workers.length >= H.capacity(p) && p.workers.length < D.maxWorkers && left >= 2) return 4;
      const next = D.stages[p.stage + 1];
      if (next && p.buildings.length < next.need.buildings) return 2;
    }
    return 0;
  }

  function choose(s, pid = s.current, noise = 0.6) {
    const moves = E.legalMoves(s, pid);
    let best = null, bestV = -Infinity;
    for (const m of moves) {
      const r = E.applyMove(s, pid, m);
      if (!r.ok) continue;
      const v = value(r.state, r.state.players[pid]) + plan(s, s.players[pid], m) + Math.random() * noise;
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }

  return { choose, value };
})();

if (typeof module !== 'undefined') module.exports = Bot;
