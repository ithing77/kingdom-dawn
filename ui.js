// 글자 화면. 상태를 받아서 그리고, 고른 명령을 send 로 넘긴다. 규칙 계산은 Engine 이 한다.

const View = (() => {
  const D = DATA, H = Engine.helpers;
  const ACT = Object.fromEntries(D.actions.map(a => [a.id, a]));
  const BLD = Object.fromEntries(D.buildings.map(b => [b.id, b]));
  const LOOT = Object.fromEntries(D.loot.map(l => [l.id, l]));
  const $ = id => document.getElementById(id);
  const R = r => D.res[r].icon;
  const costText = c => Object.entries(c).map(([r, n]) => `${R(r)}${n}`).join(' ');
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  let S = null, me = 0, send = () => {}, sel = null, pick = 0, lastLog = 0;

  function init(sendFn) { send = sendFn; }

  function render(state, myId) {
    const newRound = !S || S.round !== state.round;
    S = state; me = myId;
    const moves = Engine.legalMoves(S, me);
    if (sel && !moves.some(m => m.space === sel)) sel = null;
    if (newRound) sel = null;
    top(); board(moves, newRound); players(); choice(moves); logView();
  }

  function top() {
    const cur = S.players[S.current];
    const harvest = D.harvestRounds.includes(S.round) ? ' · 🌾 이번 라운드 끝에 수확' : '';
    const turn = S.over ? '게임 끝' : S.current === me ? '내 차례!' : `${esc(cur.name)} 차례`;
    $('top').innerHTML = `<b>👑 왕국의 여명</b><span>${S.round} / ${D.rounds} 라운드${harvest}</span><span class="turn">${turn}</span>`;
    document.title = S.current === me && !S.over ? '▶ 내 차례 — 왕국의 여명' : '왕국의 여명';
  }

  function whyNot(p, id) {
    const sp = S.spaces[id];
    if (sp.by !== null) return null;
    if (S.over) return '';
    if (S.current !== me) return '';
    if (!H.ready(p).length) return '남은 주민이 없어요';
    switch (id) {
      case 'build': case 'family':
        if (id === 'family' && !H.canGrow(p)) {
          if (H.capacity(p) <= p.workers.length && p.workers.length < D.maxWorkers) return '집에 빈 자리가 없고, 지을 건물도 없어요';
        }
        if (H.freePlots(p) < 1) return '빈 땅이 없어요 (승격하면 넓어져요)';
        return '지을 수 있는 건물이 없어요 (자원 부족)';
      case 'wedding': return p.workers.length >= D.maxWorkers ? '주민이 최대예요' : '집에 빈 자리가 없어요 (오두막을 지어요)';
      case 'forge': return H.ready(p).some(w => !w.arm) ? '철이 없어요' : '맨손 주민이 없어요';
      case 'expedition': case 'bigExpedition': return '남은 기사가 없어요 (대장간에서 무장)';
      case 'trade': return '철이 없어요';
    }
    return '지금은 못 해요';
  }

  // 일꾼 말 (색은 플레이어 색)
  const MEEPLE = '<path d="M12 1.5a3.6 3.6 0 0 1 3.6 3.6c0 1.1-.5 2-1.2 2.7 3.2.6 7.6 2 7.6 4.6 0 1.1-1.4 1.4-3.2 1.1l2.1 7.6c.2.8-.4 1.2-1 1.2h-4.6L12 17.2l-3.3 5.1H4.1c-.6 0-1.2-.4-1-1.2l2.1-7.6c-1.8.3-3.2 0-3.2-1.1 0-2.6 4.4-4 7.6-4.6-.7-.7-1.2-1.6-1.2-2.7A3.6 3.6 0 0 1 12 1.5z"/>';
  const meeple = (pid, cls = '') => `<svg class="mp f${pid} ${cls}" viewBox="0 0 24 24">${MEEPLE}</svg>`;
  // 자원 토큰
  const tok = (r, n) => `<span class="tok t-${r}" title="${D.res[r].name}">${R(r)}<b>${n}</b></span>`;
  const art = x => x.img ? `<img src="${x.img}" alt="">` : `<span class="emo">${x.art || '❔'}</span>`;

  function board(moves, newRound) {
    const p = S.players[me];
    const can = new Set(moves.map(m => m.space));
    $('board').innerHTML = S.open.map(id => {
      const a = ACT[id], sp = S.spaces[id];
      const stock = Object.entries(sp.stock).filter(([, n]) => n).map(([r, n]) => tok(r, n)).join('');
      const why = can.has(id) ? '' : whyNot(p, id);
      const cls = ['card', `k-${a.kind}`, sp.by !== null ? 'taken' : '', can.has(id) ? 'can' : '', a.round === S.round ? `new${newRound ? ' flip' : ''}` : '', sel === id ? 'sel' : ''].join(' ');
      return `<button class="${cls}" data-id="${id}" ${can.has(id) ? '' : 'disabled'}>
        <span class="cname">${a.name}</span>
        <span class="art">${art(a)}${a.round ? `<span class="royal">왕명 ${a.round}</span>` : ''}${stock ? `<span class="stock">${stock}</span>` : ''}${sp.by !== null ? meeple(sp.by, 'on') : ''}</span>
        <span class="ctext">${a.text}${why ? `<span class="why">${why}</span>` : ''}</span></button>`;
    }).join('');
    for (const b of $('board').querySelectorAll('.card.can')) b.onclick = () => { sel = b.dataset.id; pick = 0; render(S, me); };
  }

  function stageNeed(p) {
    const next = D.stages[p.stage + 1];
    if (!next) return '<span class="ok">최고 단계!</span>';
    const mark = (have, need, label) => `<span class="${have >= need ? 'ok' : 'no'}">${label} ${have}/${need}${have >= need ? '✓' : '✕'}</span>`;
    const parts = [mark(p.workers.length, next.need.workers, '주민'), mark(p.buildings.length, next.need.buildings, '건물')];
    for (const [r, n] of Object.entries(next.cost)) parts.push(mark(p.res[r], n, D.res[r].name));
    return `${next.name} 승격: ${parts.join(' · ')}`;
  }

  function playerBox(p, full) {
    const sc = Engine.score(p).total;
    const res = Object.keys(D.res).map(r => tok(r, p.res[r])).join('');
    const workers = p.workers.map(w => `<span class="wk${w.placed ? ' used' : ''}${w.born ? ' baby' : ''}">${meeple(p.id)}${w.arm ? `<i>⚔️${w.arm}</i>` : ''}</span>`).join('');
    const bl = p.buildings.map(b => `<span class="tag tier${BLD[b].stage}" title="${BLD[b].text}">${BLD[b].art} ${BLD[b].name}</span>`).join('');
    return `<div class="pl ${S.current === p.id && !S.over ? 'cur' : ''}">
      <h3><span><span class="who c${p.id}">${esc(p.name)}</span> ${D.stages[p.stage].name}${p.id === me ? ' (나)' : ''}</span><span>⭐ ${sc}점</span></h3>
      <div class="res">${res}</div>
      <div class="wks">${workers}<span class="sub">자리 ${H.capacity(p)}</span></div>
      <div>평판 ${p.rep}${p.famine ? ` · <span class="no">기근 ${p.famine}</span>` : ''}</div>
      <div>땅 ${H.plotsTotal(p) - H.freePlots(p)}/${H.plotsTotal(p)} — 촌장의 집, 밭 ${p.fields}</div>
      <div class="bl">${bl || '<span class="sub">건물 없음</span>'}</div>
      ${full ? `<div class="need">${stageNeed(p)}</div>` : ''}
    </div>`;
  }

  function players() {
    $('me').innerHTML = playerBox(S.players[me], true);
    $('others').innerHTML = S.players.filter(p => p.id !== me).map(p => playerBox(p, true)).join('');
  }

  function optLabel(id, o) {
    const lootText = (ls, b) => ls.map(l => l === 'build' && b ? `${BLD[b].name} 건설` : LOOT[l].name).join(' + ');
    if (o.do === 'promote') return `✨ 승격 → ${D.stages[S.players[me].stage + 1].name} (${costText(D.stages[S.players[me].stage + 1].cost)})`;
    if (o.do === 'confess') return '🙏 고해성사 (기근 1 지움)';
    if (o.do === 'offering') return '🪙 헌금함 (식량 1)';
    if (o.grow) return '👶 새 주민 맞이하기';
    if (o.iron) return `철 ${o.iron}로 무장 → ${lootText(o.loot, o.b)}`;
    if (o.loot) return lootText(o.loot, o.b);
    if (o.b) return `${BLD[o.b].art} ${BLD[o.b].name} (${costText(BLD[o.b].cost)}) — ${BLD[o.b].text || `평판 ${BLD[o.b].rep}`}`;
    if (o.r) return `${R(o.r)} ${D.res[o.r].name} + 금화 1`;
    if (o.free) return '금화 받기';
    if (o.pay) return `${o.pay.map(r => D.res[r].name).join('·')} 팔기`;
    if (o.times) return `철 ${o.times}개 팔기`;
    return '여기에 놓기';
  }

  // 놓으면 내 영지가 어떻게 바뀌는지
  function preview(m) {
    const r = Engine.applyMove(S, me, m);
    if (!r.ok) return '';
    const a = S.players[me], b = r.state.players[me];
    const out = [];
    const ch = (label, x, y) => { if (x !== y) out.push(`<span class="${y > x ? 'up' : 'down'}">${label} ${x} → ${y}</span>`); };
    for (const k of Object.keys(D.res)) ch(`${R(k)} ${D.res[k].name}`, a.res[k], b.res[k]);
    ch('평판', a.rep, b.rep); ch('밭', a.fields, b.fields); ch('주민', a.workers.length, b.workers.length);
    ch('기근', a.famine, b.famine); ch('건물', a.buildings.length, b.buildings.length);
    if (a.stage !== b.stage) out.push(`<span class="up">${D.stages[a.stage].name} → ${D.stages[b.stage].name}</span>`);
    const arm = q => q.workers.map(w => w.arm).sort((x, y) => y - x)[0];
    ch('최고 무장', arm(a), arm(b));
    ch('예상 점수', Engine.score(a).total, Engine.score(b).total);
    return out.join(' · ') || '변화 없음';
  }

  function choice(moves) {
    if (!sel || S.over || S.current !== me) { $('choice').innerHTML = ''; return; }
    const opts = moves.filter(m => m.space === sel);
    if (pick >= opts.length) pick = 0;
    const m = opts[pick];
    $('choice').innerHTML = `<div class="panel">
      <b>[${ACT[sel].name}] ${opts.length > 1 ? '— 하나 고르세요' : ''}</b>
      ${opts.length > 1 ? `<div class="opts">${opts.map((o, i) => `<button data-i="${i}" class="${i === pick ? 'on' : ''}">${optLabel(sel, o.opt)}</button>`).join('')}</div>` : `<div>${optLabel(sel, m.opt)}</div>`}
      <div class="diff">미리보기: ${preview(m)}</div>
      <div class="row"><button class="primary" id="okBtn">확정</button><button id="cancelBtn">취소</button></div>
    </div>`;
    for (const b of $('choice').querySelectorAll('.opts button')) b.onclick = () => { pick = +b.dataset.i; choice(moves); };
    $('okBtn').onclick = () => { const mv = opts[pick]; sel = null; send(mv); };
    $('cancelBtn').onclick = () => { sel = null; render(S, me); };
  }

  function logView() {
    const el = $('log');
    el.innerHTML = S.log.map(l => `<div>${esc(l)}</div>`).join('');
    if (S.log.length !== lastLog) { el.scrollTop = el.scrollHeight; lastLog = S.log.length; }
  }

  function result(state) {
    const keys = Object.keys(state.scores[0].parts);
    const order = state.players.map((p, i) => i).sort((a, b) => state.scores[b].total - state.scores[a].total);
    $('result').innerHTML = `<tr><th>영주</th>${keys.map(k => `<th>${k}</th>`).join('')}<th>합계</th></tr>` +
      order.map((i, rank) => `<tr><td>${state.winners.includes(i) ? '👑' : `${rank + 1}등`} <span class="who c${i}">${esc(state.players[i].name)}</span> ${D.stages[state.players[i].stage].name}</td>${keys.map(k => `<td>${state.scores[i].parts[k]}</td>`).join('')}<td><b>${state.scores[i].total}</b></td></tr>`).join('');
  }

  return { init, render, result };
})();
