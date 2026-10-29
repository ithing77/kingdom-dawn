// 규칙 엔진. 화면·연결과 상관없이 상태(state)와 명령(move)만 다룬다.
// createGame → legalMoves → applyMove 를 반복. applyMove 는 새 상태를 돌려준다.

const Engine = (() => {
  const D = typeof DATA !== 'undefined' ? DATA : require('./data.js');
  const RES = Object.keys(D.res);
  const ACT = Object.fromEntries(D.actions.map(a => [a.id, a]));
  const BLD = Object.fromEntries(D.buildings.map(b => [b.id, b]));
  const LOOT = Object.fromEntries(D.loot.map(l => [l.id, l]));
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- 플레이어 계산 ----------
  const has = (p, b) => p.buildings.includes(b);
  const plotsTotal = p => D.stages[p.stage].plots;
  const plotsUsed = p => 1 + p.fields + p.buildings.length; // 1 = 촌장의 집
  const freePlots = p => plotsTotal(p) - plotsUsed(p);
  const capacity = p => 2 + p.buildings.reduce((s, b) => s + (BLD[b].house || 0), 0);
  const knights = p => p.workers.filter(w => w.arm > 0).length;
  const afford = (p, cost) => Object.entries(cost).every(([r, n]) => p.res[r] >= n);
  const pay = (p, cost) => { for (const [r, n] of Object.entries(cost)) p.res[r] -= n; };
  const gain = (p, g) => { for (const [r, n] of Object.entries(g)) p.res[r] += n; };
  const resText = g => Object.entries(g).filter(([, n]) => n).map(([r, n]) => `${D.res[r].name} ${n}`).join(', ');

  // discount = 덜 내는 자원 (대관식 준비)
  function promoteCost(p, discount = {}) {
    const next = D.stages[p.stage + 1];
    return Object.fromEntries(Object.entries(next.cost).map(([r, n]) => [r, Math.max(0, n - (discount[r] || 0))]));
  }
  function canPromote(p, discount) {
    const next = D.stages[p.stage + 1];
    if (!next) return false;
    return p.workers.length >= next.need.workers && p.buildings.length >= next.need.buildings && afford(p, promoteCost(p, discount));
  }
  // 인원에 따라 여는 라운드가 다를 수 있다 (0 = 처음부터)
  const roundOf = (a, n) => (a.roundByPlayers && a.roundByPlayers[n] !== undefined ? a.roundByPlayers[n] : a.round || 0);
  const inGame = (a, n) => (a.minPlayers || 0) <= n;
  function buildable(s, p) {
    if (freePlots(p) < 1) return [];
    return D.buildings.filter(b => b.stage <= p.stage && afford(p, b.cost) &&
      (b.house || !s.players.some(q => has(q, b.id)))).map(b => b.id);
  }
  function canGrow(p) { return p.workers.length < D.maxWorkers && p.workers.length < capacity(p); }

  function score(p) {
    const parts = {
      평판: p.rep,
      건물: p.buildings.reduce((s, b) => s + BLD[b].rep, 0),
      주민: p.workers.length,
      금화: Math.floor(p.res.gold / 2),
      기근: -D.harvest.faminePenalty * p.famine,
      '길드 회관': has(p, 'guildHall') ? p.buildings.length : 0,
      '기사단 본부': has(p, 'order') ? knights(p) * 3 : 0,
    };
    return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
  }

  // ---------- 게임 만들기 ----------
  function createGame(seats, seed = 1) {
    const n = seats.length;
    const s = {
      seed, round: 0, over: false, log: [],
      players: seats.map((st, i) => ({
        id: i, name: st.name, bot: !!st.bot,
        res: { ...D.start.res }, rep: 0, stage: 0, fields: 0, buildings: [], famine: 0,
        workers: Array.from({ length: D.start.workers }, () => ({ arm: 0, placed: false, born: false })),
      })),
      spaces: {}, open: [],
      first: seed % n, nextFirst: null, current: 0, stageFirst: [true, false, false],
    };
    for (const a of D.actions) if (inGame(a, n) && !roundOf(a, n)) openSpace(s, a.id);
    startRound(s);
    return s;
  }
  function openSpace(s, id) { s.open.push(id); s.spaces[id] = { stock: {}, by: null }; }
  const log = (s, msg) => { s.log.push(msg); if (s.log.length > 200) s.log.shift(); };

  function startRound(s) {
    s.round++;
    const n = s.players.length;
    for (const a of D.actions) if (inGame(a, n) && roundOf(a, n) === s.round) { openSpace(s, a.id); log(s, `📜 왕명: [${a.name}] ${a.zone === 'map' ? '원정 목적지가' : '칸이'} 열렸어요`); }
    for (const id of s.open) {
      const acc = ACT[id].acc;
      if (acc) for (const [r, k] of Object.entries(acc)) s.spaces[id].stock[r] = (s.spaces[id].stock[r] || 0) + k;
    }
    for (const p of s.players) for (const w of p.workers) { w.placed = false; w.born = false; }
    if (s.nextFirst !== null) { s.first = s.nextFirst; s.nextFirst = null; }
    s.current = s.first;
    log(s, `── ${s.round}라운드 시작 (선: ${s.players[s.first].name}) ──`);
  }

  const ready = p => p.workers.filter(w => !w.placed && !w.born);

  function advance(s) {
    const n = s.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (s.current + k) % n;
      const p = s.players[i];
      if (!ready(p).length) continue;
      s.current = i;
      if (legalMoves(s, i).length) return;
      // 빈 칸이 다 차서 둘 곳이 없으면 남은 주민은 이번 라운드 집에서 쉰다
      for (const w of ready(p)) w.placed = true;
      log(s, `${p.name} — 둘 곳이 없어 남은 주민이 쉬어요`);
    }
    endRound(s);
  }

  function endRound(s) {
    for (const id of s.open) { s.spaces[id].by = null; s.spaces[id].w = null; }
    if (D.harvest && D.harvestRounds.includes(s.round)) harvest(s);
    if (s.round >= D.rounds) {
      s.over = true;
      s.scores = s.players.map(score);
      const best = Math.max(...s.scores.map(x => x.total));
      s.winners = s.players.filter((p, i) => s.scores[i].total === best).map(p => p.id);
      log(s, `🏁 게임 끝! 우승: ${s.winners.map(i => s.players[i].name).join(', ')} (${best}점)`);
      return;
    }
    startRound(s);
  }

  function harvest(s) {
    const H = D.harvest;
    for (const p of s.players) {
      const grown = p.fields * (H.foodPerField + (has(p, 'mill') ? 1 : 0)) + (has(p, 'granary') ? 2 : 0);
      p.res.food += grown;
      const need = p.workers.reduce((t, w) => t + (w.born ? H.eatNewborn : H.eat), 0);
      let short = need - p.res.food;
      p.res.food = Math.max(0, p.res.food - need);
      let msg = `🌾 수확: ${p.name} 식량 +${grown}, 먹은 양 ${need}`;
      if (short > 0) {
        const g = Math.min(short, p.res.gold);
        p.res.gold -= g; short -= g;
        if (g) msg += `, 금화 ${g}로 메움`;
        if (short > 0) { p.famine += short; msg += `, 기근 표시 +${short} 😢`; }
      }
      log(s, msg);
    }
  }

  // ---------- 가능한 명령 ----------
  // move = { space, opt } . 일꾼은 엔진이 고른다.
  function pickWorker(p, space) {
    const r = ready(p);
    const a = ACT[space];
    if (a.zone === 'map') return r.filter(w => w.arm >= a.minArm).sort((x, y) => y.arm - x.arm)[0];
    if (space === 'forge') return r.find(w => w.arm === 0);
    return r.slice().sort((a, b) => a.arm - b.arm)[0];
  }

  function combos(arr, k, start = 0, cur = [], out = []) {
    if (cur.length === k) { out.push(cur.slice()); return out; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); }
    return out;
  }

  // 원정 보상 고르기: 무장 arm 으로 k개. 건물 보상은 짓는 건물까지 정한다.
  function lootOptions(s, p, arm, k, pool) {
    const inPool = l => !pool || pool.includes(l.id);
    const ok = D.loot.filter(l => inPool(l) && l.arm <= arm && !l.build && !(l.field && freePlots(p) < 1)).map(l => l.id);
    const canBuild = arm >= LOOT.build.arm && inPool(LOOT.build);
    const out = [];
    const kk = Math.min(k, ok.length + (canBuild ? 1 : 0));
    for (const c of combos(ok, kk)) out.push({ loot: c });
    if (canBuild && kk >= 1) {
      for (const c of combos(ok, kk - 1)) {
        const q = clone(p);
        applyLoot(null, q, c);
        for (const b of buildable(s, q)) out.push({ loot: [...c, 'build'], b });
      }
    }
    return out;
  }
  function applyLoot(s, p, ids, b) {
    for (const id of ids) {
      const l = LOOT[id];
      if (l.give) gain(p, l.give);
      if (l.rep) p.rep += l.rep;
      if (l.field) p.fields++;
      if (l.build && b) buildIt(s, p, b);
    }
  }
  function buildIt(s, p, b) {
    pay(p, BLD[b].cost);
    p.buildings.push(b);
    if (s) log(s, `🏠 ${p.name}: [${BLD[b].name}] 건설`);
  }

  function optionsFor(s, p, id) {
    const w = pickWorker(p, id);
    if (!w) return [];
    switch (id) {
      case 'build': return buildable(s, p).map(b => ({ b }));
      case 'temple': {
        const o = [];
        if (canPromote(p)) o.push({ do: 'promote' });
        if (p.famine > 0) o.push({ do: 'confess' });
        o.push({ do: 'offering' });
        return o;
      }
      case 'peddler': return ['wood', 'stone', 'iron'].map(r => ({ r }));
      case 'market': {
        const goods = ['wood', 'stone', 'iron', 'food'];
        const o = [{ free: true }];
        for (let i = 0; i < goods.length; i++) for (let j = i; j < goods.length; j++) {
          const c = {}; c[goods[i]] = (c[goods[i]] || 0) + 1; c[goods[j]] = (c[goods[j]] || 0) + 1;
          if (afford(p, c)) o.push({ pay: [goods[i], goods[j]] });
        }
        return o;
      }
      case 'family': {
        if (canGrow(p)) return [{ grow: true }];
        return buildable(s, p).map(b => ({ b }));
      }
      case 'wedding': return canGrow(p) ? [{ grow: true }] : [];
      case 'forge': {
        const o = [];
        for (let n = 1; n <= Math.min(D.forgeMaxIron, p.res.iron); n++) {
          const arm = Math.min(D.maxArm, n + (has(p, 'smith') ? 2 : 0));
          const q = clone(p); q.res.iron -= n;
          for (const lo of lootOptions(s, q, arm, 1)) o.push({ iron: n, ...lo });
        }
        return o;
      }
      case 'knighting': return [{}];
      case 'envoy': return [{ rep: D.envoy.rep }, { gold: D.envoy.gold }];
      case 'festival': return [{}];
      case 'coronation': return [...(canPromote(p, D.coronationDiscount) ? [{ do: 'promote' }] : []), { do: 'rep' }];
      case 'trade': {
        const o = [];
        for (let t = 1; t <= Math.min(D.trade.times, Math.floor(p.res.iron / D.trade.iron)); t++) o.push({ times: t });
        return o;
      }
      default:
        if (ACT[id].zone === 'map') return lootOptions(s, p, w.arm, ACT[id].loot, ACT[id].pool);
        return [{}];
    }
  }

  function legalMoves(s, pid = s.current) {
    if (s.over || pid !== s.current) return [];
    const p = s.players[pid];
    const out = [];
    for (const id of s.open) {
      if (s.spaces[id].by !== null) continue;
      for (const opt of optionsFor(s, p, id)) out.push({ space: id, opt });
    }
    return out;
  }
  const key = m => JSON.stringify([m.space, m.opt]);

  // ---------- 명령 실행 ----------
  function applyMove(state, pid, move) {
    if (pid !== state.current) return { ok: false, why: '내 차례가 아니에요' };
    const legal = legalMoves(state, pid);
    if (!legal.some(m => key(m) === key(move))) return { ok: false, why: '지금은 할 수 없는 행동이에요' };
    const s = clone(state);
    const p = s.players[pid];
    const sp = s.spaces[move.space];
    const o = move.opt || {};
    const w = pickWorker(p, move.space);
    w.placed = true;
    sp.by = pid; sp.w = p.workers.indexOf(w);
    const name = ACT[move.space].name;
    const say = t => log(s, `${p.name} → [${name}] ${t}`);

    // 누적 자원은 놓자마자 가져간다
    const stock = sp.stock;
    if (Object.keys(stock).length) {
      const got = { ...stock };
      if (move.space === 'logging' && has(p, 'carpenter')) got.wood = (got.wood || 0) + 1;
      gain(p, got);
      sp.stock = {};
      say(resText(got));
    }

    switch (move.space) {
      case 'gather': p.res.food++; say('식량 1'); break;
      case 'clear':
        p.res.wood++;
        if (freePlots(p) > 0) { p.fields++; say('밭 1개 + 목재 1'); } else say('목재 1 (땅이 없어 밭은 못 만듦)');
        break;
      case 'build': buildIt(null, p, o.b); say(`${BLD[o.b].name} 건설`); break;
      case 'seal': s.nextFirst = pid; p.res.food++; p.res.gold++; say('다음 라운드 선 + 식량 1 + 금화 1'); break;
      case 'temple': {
        if (has(p, 'chapel')) p.rep++;
        if (o.do === 'promote') promote(s, p, say);
        else if (o.do === 'confess') { p.famine--; say('고해성사: 기근 표시 1개 지움'); }
        else { p.res.food++; say('헌금함: 식량 1'); }
        break;
      }
      case 'peddler': p.res[o.r]++; p.res.gold++; say(`${D.res[o.r].name} 1 + 금화 1`); break;
      case 'market': {
        const bonus = has(p, 'bazaar') ? 1 : 0;
        if (o.free) { p.res.gold += D.market.freeGold + bonus; say(`금화 ${D.market.freeGold + bonus}`); }
        else { for (const r of o.pay) p.res[r]--; p.res.gold += D.market.gold + bonus; say(`${o.pay.map(r => D.res[r].name).join('·')} 팔고 금화 ${D.market.gold + bonus}`); }
        break;
      }
      case 'family': case 'wedding':
        if (o.grow) { p.workers.push({ arm: 0, placed: true, born: true }); say('새 주민이 왔어요 (다음 라운드부터 일함)'); }
        else { buildIt(null, p, o.b); say(`${BLD[o.b].name} 건설`); }
        break;
      case 'forge': {
        p.res.iron -= o.iron;
        w.arm = Math.min(D.maxArm, o.iron + (has(p, 'smith') ? 2 : 0));
        say(`철 ${o.iron}로 기사 무장 ${w.arm}`);
        doExpedition(s, p, w, o);
        break;
      }
      case 'knighting': w.arm = Math.min(D.maxArm, Math.max(1, w.arm + 1)); say(`기사 서임: 무장 ${w.arm}`); break;
      case 'envoy':
        if (o.rep) { p.rep += o.rep; say(`평판 +${o.rep}`); } else { p.res.gold += o.gold; say(`금화 ${o.gold}`); }
        break;
      case 'festival': { const f = 1 + p.fields; p.res.food += f; say(`식량 ${f}`); break; }
      case 'coronation':
        if (o.do === 'promote') promote(s, p, say, D.coronationDiscount); else { p.rep++; say('평판 +1'); }
        break;
      case 'trade': {
        const g = (D.trade.gold + (has(p, 'bazaar') ? 1 : 0)) * o.times;
        p.res.iron -= D.trade.iron * o.times; p.res.gold += g;
        say(`철 ${o.times} → 금화 ${g}`);
        break;
      }
      default:
        if (ACT[move.space].zone === 'map') doExpedition(s, p, w, o);
    }
    advance(s);
    return { ok: true, state: s };
  }

  function promote(s, p, say, discount) {
    const next = D.stages[p.stage + 1];
    pay(p, promoteCost(p, discount));
    p.stage++;
    p.rep += next.rep;
    let extra = '';
    if (!s.stageFirst[p.stage]) { s.stageFirst[p.stage] = true; p.rep += D.firstToStageBonus; extra = ` (첫 ${next.name}! 평판 +${D.firstToStageBonus})`; }
    say(`✨ ${next.name}(으)로 승격! 평판 +${next.rep}${extra}`);
  }

  function doExpedition(s, p, w, o) {
    applyLoot(s, p, o.loot, o.b);
    const names = o.loot.map(id => id === 'build' && o.b ? `${BLD[o.b].name} 건설` : LOOT[id].name);
    w.arm = Math.min(D.maxArm, w.arm + 1);
    log(s, `⚔️ ${p.name}의 기사 원정: ${names.join(', ')} (무장 ${w.arm})`);
  }

  return {
    createGame, legalMoves, applyMove, score, key,
    helpers: { freePlots, capacity, canPromote, buildable, canGrow, knights, plotsTotal, ready, afford, roundOf, inGame },
  };
})();

if (typeof module !== 'undefined') module.exports = Engine;
