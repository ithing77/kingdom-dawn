// 봇끼리 여러 판 돌려서 규칙이 안 깨지는지, 점수가 어떻게 나오는지 본다.
// 사용: node tools/sim.js [판 수] [인원]
const D = require('../data.js');
const E = require('../engine.js');
const Bot = require('../bot.js');

const games = +process.argv[2] || 200;
const n = +process.argv[3] || 2;
const stats = { total: [], stage: [0, 0, 0], workers: [], famine: 0, moves: 0, build: {}, space: {}, promoteRound: [] };
let errors = 0;

function check(s) {
  for (const p of s.players) {
    for (const [r, v] of Object.entries(p.res)) if (v < 0 || !Number.isInteger(v)) throw new Error(`자원 음수 ${p.name} ${r}=${v}`);
    if (E.helpers.freePlots(p) < 0) throw new Error(`땅 초과 ${p.name}`);
    if (p.workers.length > D.maxWorkers) throw new Error('주민 초과');
    if (p.workers.length > E.helpers.capacity(p)) throw new Error('집 자리 초과');
  }
  const owners = {};
  for (const p of s.players) for (const b of p.buildings) {
    if (D.buildings.find(x => x.id === b).house) continue;
    if (owners[b]) throw new Error(`건물 중복 ${b}`);
    owners[b] = 1;
  }
}

for (let g = 0; g < games; g++) {
  try {
    let s = E.createGame(Array.from({ length: n }, (_, i) => ({ name: `봇${i + 1}`, bot: true })), g + 1);
    let guard = 0;
    while (!s.over) {
      if (++guard > 500) throw new Error('끝나지 않음');
      const m = Bot.choose(s);
      if (!m) throw new Error(`둘 곳이 없음: 라운드 ${s.round} ${s.players[s.current].name}`);
      const before = s;
      const r = E.applyMove(s, s.current, m);
      if (!r.ok) throw new Error(r.why);
      s = r.state;
      stats.moves++;
      stats.space[m.space] = (stats.space[m.space] || 0) + 1;
      if (m.space === 'temple' && m.opt.do === 'promote') stats.promoteRound.push(before.round);
      check(s);
    }
    for (const [i, p] of s.players.entries()) {
      stats.total.push(s.scores[i].total);
      stats.stage[p.stage]++;
      stats.workers.push(p.workers.length);
      stats.famine += p.famine;
      for (const b of p.buildings) stats.build[b] = (stats.build[b] || 0) + 1;
    }
    if (g === 0) console.log(s.log.slice(-40).join('\n'), '\n', s.scores.map(x => JSON.stringify(x.parts)).join('\n'));
  } catch (e) { errors++; if (errors < 5) console.error('오류:', e.message); }
}

const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const P = games * n;
console.log(`\n${games}판 × ${n}명, 오류 ${errors}`);
console.log(`평균 점수 ${avg(stats.total)} (최저 ${Math.min(...stats.total)}, 최고 ${Math.max(...stats.total)})`);
console.log(`최종 단계: 개척촌 ${stats.stage[0]}, 마을 ${stats.stage[1]}, 도시 ${stats.stage[2]} (총 ${P})`);
console.log(`평균 주민 ${avg(stats.workers)}, 기근 표시 평균 ${(stats.famine / P).toFixed(2)}, 승격 평균 라운드 ${avg(stats.promoteRound)}`);
console.log('칸 사용:', Object.entries(stats.space).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('건물:', Object.entries(stats.build).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
