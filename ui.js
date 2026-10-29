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

  // 부품 그림 (art/*.png, GPT로 만든 부품 모음에서 잘라냄)
  const meeple = (pid, cls = '') => `<img class="mp ${cls}" src="art/w${pid}.png" alt="">`;
  const baby = () => `<img class="mp" src="art/baby.png" alt="">`;
  const tok = (r, n) => `<span class="tok" title="${D.res[r].name}"><img src="art/${r}.png" alt="${D.res[r].name}"><b>${n}</b></span>`;
  // 창고 더미: 개수만큼 토큰을 흩어 놓는다. 자리는 순번으로 정해져 있어서 다시 그려도 안 움직인다.
  const scatter = i => { const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453; const f = h - Math.floor(h); return f; };
  function heap(r, n) {
    return Array.from({ length: Math.min(n, 12) }, (_, i) => {
      const x = 8 + scatter(i * 3 + 1) * 58, y = 62 - Math.floor(i / 4) * 14 - scatter(i * 3 + 2) * 16, rot = (scatter(i * 3 + 3) - .5) * 50;
      return `<img src="art/${r}.png" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg)" alt="">`;
    }).join('');
  }
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

  // ---------- 마을 판 ----------
  const MAX_PLOTS = D.stages[D.stages.length - 1].plots;

  function plots(p) {
    const open = H.plotsTotal(p), tiles = [`<div class="plot home">🏡<small>촌장의 집</small></div>`];
    for (const b of p.buildings) tiles.push(`<div class="plot bld tier${BLD[b].stage}" title="${BLD[b].text}">${BLD[b].art}<small>${BLD[b].name}</small></div>`);
    for (let i = 0; i < p.fields; i++) tiles.push(`<div class="plot field">🌾<small>밭</small></div>`);
    while (tiles.length < open) tiles.push(`<div class="plot empty"><small>빈 땅</small></div>`);
    for (let i = open; i < MAX_PLOTS; i++) {
      const st = D.stages.findIndex(x => x.plots > i);
      tiles.push(`<div class="plot fog">🌫️<small>${D.stages[st].name} 되면</small></div>`);
    }
    return `<div class="plots">${tiles.join('')}</div>`;
  }

  function store(p) {
    return `<div class="store">${Object.keys(D.res).map(r => {
      const n = p.res[r];
      return `<div class="pile t-${r}"><span class="lbl">${D.res[r].name}</span><span class="heap">${heap(r, n) || '<em>없음</em>'}</span><b>${n}</b></div>`;
    }).join('')}</div>`;
  }

  function house(p) {
    const cap = Math.max(H.capacity(p), p.workers.length);
    const slots = [];
    for (let i = 0; i < Math.min(cap, D.maxWorkers); i++) {
      const w = p.workers[i];
      if (!w) { slots.push(`<span class="slot open" title="빈 자리 — 새 주민이 들어올 수 있어요"></span>`); continue; }
      const tag = w.born ? '<i>아기</i>' : w.arm ? `<i>⚔️${w.arm}</i>` : '';
      slots.push(`<span class="slot${w.placed ? ' out' : ''}${w.born ? ' baby' : ''}" title="${w.placed ? '일하러 나감' : '집에 있음'}">${w.born ? baby() : meeple(p.id)}${tag}</span>`);
    }
    return `<div class="house">${slots.join('')}</div>`;
  }

  function road(p) {
    return `<div class="road">${D.stages.map((st, i) => `<span class="node${i < p.stage ? ' done' : ''}${i === p.stage ? ' now' : ''}">${st.name}</span>`).join('<span class="link"></span>')}</div>`;
  }

  function villageBoard(p) {
    const sc = Engine.score(p).total;
    const turn = S.current === p.id && !S.over;
    return `<div class="village b${p.id}${turn ? ' cur' : ''}">
      <div class="vhead"><span class="who c${p.id}">${esc(p.name)}</span><b>${D.stages[p.stage].name}</b>${p.id === me ? '<span class="sub">내 마을</span>' : ''}
        <span class="vstat">⭐ ${sc}점 · 평판 ${p.rep}${p.famine ? ` · <span class="no">기근 ${p.famine}</span>` : ''}</span></div>
      <div class="vbody">
        <section><h4>땅 ${H.plotsTotal(p) - H.freePlots(p)}/${H.plotsTotal(p)}</h4>${plots(p)}</section>
        <section><h4>창고</h4>${store(p)}</section>
        <section><h4>집 (자리 ${H.capacity(p)})</h4>${house(p)}<h4>승격 길</h4>${road(p)}<div class="need">${stageNeed(p)}</div></section>
      </div>
    </div>`;
  }

  // 상대 판: 작게 요약, 누르면 크게
  function miniBoard(p) {
    const res = Object.keys(D.res).map(r => tok(r, p.res[r])).join('');
    const mini = Array.from({ length: MAX_PLOTS }, (_, i) => {
      const used = 1 + p.buildings.length + p.fields;
      return `<i class="${i < used ? 'u' : i < H.plotsTotal(p) ? 'e' : 'f'}"></i>`;
    }).join('');
    const ws = p.workers.map(w => `<span class="${w.placed ? 'out' : ''}">${meeple(p.id)}</span>`).join('');
    return `<button class="mini b${p.id}${S.current === p.id && !S.over ? ' cur' : ''}" data-pid="${p.id}">
      <span class="vhead"><span class="who c${p.id}">${esc(p.name)}</span><b>${D.stages[p.stage].name}</b><span class="vstat">⭐ ${Engine.score(p).total}</span></span>
      <span class="mres">${res}</span>
      <span class="mrow"><span class="mplots">${mini}</span><span class="mws">${ws}</span></span>
    </button>`;
  }

  function players() {
    $('me').innerHTML = villageBoard(S.players[me]);
    $('others').innerHTML = S.players.filter(p => p.id !== me).map(miniBoard).join('');
    for (const b of $('others').querySelectorAll('.mini')) b.onclick = () => { zoomed = +b.dataset.pid; zoomView(); };
    zoomView();
  }
  let zoomed = null;
  function zoomView() {
    const z = $('zoom');
    if (zoomed === null) { z.style.display = 'none'; return; }
    z.style.display = 'grid';
    z.innerHTML = `<div class="zbox">${villageBoard(S.players[zoomed])}<button id="zclose">닫기</button></div>`;
    z.onclick = e => { if (e.target === z || e.target.id === 'zclose') { zoomed = null; zoomView(); } };
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
