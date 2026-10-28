// 메뉴·대기실·연결. 방장 브라우저가 Engine 으로 게임을 돌리고, 손님은 명령만 보낸다.
// 혼자(컴퓨터와) 할 때도 똑같이 "연결 없는 방장"으로 돌아간다.

const PREFIX = 'kingdom-dawn-v1-';
const $ = id => document.getElementById(id);
const Net = { peer: null, isHost: false, conns: [], hostConn: null, code: '' };
let seats = [];   // [{name, bot, away}]
let state = null, myId = 0, botTimer = null;

function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}
function myName() { return ($('name').value || '').trim().slice(0, 8) || '영주'; }
function show(id) { for (const el of document.querySelectorAll('.screen')) el.style.display = el.id === id ? 'grid' : 'none'; }
function error(msg) { $('err').textContent = msg; $('status').textContent = ''; show('menu'); }
try { $('name').value = localStorage.getItem('kd-name') || ''; } catch (e) {}
function saveName() { try { localStorage.setItem('kd-name', myName()); } catch (e) {} }
const BOT_NAMES = ['기사 봇', '상인 봇', '수도사 봇'];

// ---------- 방장 ----------
function solo() {
  saveName();
  Net.isHost = true; Net.conns = [];
  seats = [{ name: myName() }];
  for (let i = 0; i < +$('botCount').value; i++) seats.push({ name: BOT_NAMES[i], bot: true });
  startGame();
}

function hostRoom() {
  saveName();
  Net.isHost = true;
  Net.code = makeCode();
  Net.peer = new Peer(PREFIX + Net.code);
  $('status').textContent = '방 만드는 중…';
  Net.peer.on('open', () => { seats = [{ name: myName() }]; myId = 0; showLobby(); });
  Net.peer.on('connection', conn => {
    conn.on('data', d => onHostData(conn, d));
    conn.on('close', () => {
      Net.conns = Net.conns.filter(c => c !== conn);
      if (!state) { seats.splice(conn.pid, 1); renumber(); broadcastLobby(); }
      else if (seats[conn.pid]) { seats[conn.pid].away = true; note(`${seats[conn.pid].name} 연결 끊김 — 돌아올 때까지 컴퓨터가 대신 해요`); }
    });
  });
  Net.peer.on('error', e => {
    if (e.type === 'unavailable-id') { Net.peer.destroy(); hostRoom(); }
    else error('연결 문제가 생겼어요: ' + e.type);
  });
}
function renumber() { Net.conns.forEach(c => { c.pid = seats.findIndex(s => s.conn === c); c.send({ t: 'welcome', id: c.pid }); }); }

function onHostData(conn, d) {
  if (d.t === 'join') {
    const name = (d.name || '').slice(0, 8) || '영주';
    if (state) {
      // 게임 중이면 같은 이름의 빈자리로 다시 들어오기
      const i = seats.findIndex(s => s.away && s.name === name);
      if (i < 0) return conn.send({ t: 'full' });
      seats[i].away = false; seats[i].conn = conn; conn.pid = i;
      Net.conns.push(conn);
      conn.send({ t: 'welcome', id: i });
      conn.send({ t: 'state', s: state });
      note(`${name} 돌아왔어요`);
      return;
    }
    if (seats.length >= 4) return conn.send({ t: 'full' });
    seats.push({ name, conn });
    Net.conns.push(conn);
    renumber();
    broadcastLobby();
  }
  if (d.t === 'move' && state) submit(conn.pid, d.m);
}
function broadcast(msg) { for (const c of Net.conns) if (c.open) c.send(msg); }
function broadcastLobby() {
  broadcast({ t: 'lobby', seats: seats.map(s => ({ name: s.name, bot: s.bot })), code: Net.code });
  showLobby();
}
function addBot() {
  if (seats.length >= 4) return;
  seats.push({ name: BOT_NAMES[seats.filter(s => s.bot).length] || '봇', bot: true });
  broadcastLobby();
}

function startGame() {
  myId = 0;
  state = Engine.createGame(seats.map(s => ({ name: s.name, bot: !!s.bot })), Math.floor(Math.random() * 1e6));
  publish();
}
function note(msg) { if (!state) return; state = { ...state, log: [...state.log, `📡 ${msg}`] }; publish(); }

function submit(pid, move) {
  const r = Engine.applyMove(state, pid, move);
  if (!r.ok) { if (pid === myId) alert(r.why); return; }
  state = r.state;
  publish();
}
function publish() {
  broadcast({ t: 'state', s: state });
  draw();
  clearTimeout(botTimer);
  const s = seats[state.current];
  if (!state.over && s && (s.bot || s.away)) {
    botTimer = setTimeout(() => {
      const m = Bot.choose(state);
      if (m) submit(state.current, m);
    }, 650);
  }
}

// ---------- 손님 ----------
function joinRoom(code) {
  saveName();
  code = code.trim().toUpperCase();
  if (code.length !== 4) return error('방 코드 4글자를 넣어 주세요');
  Net.isHost = false; Net.code = code;
  Net.peer = new Peer();
  $('status').textContent = '방 찾는 중…';
  Net.peer.on('open', () => {
    const conn = Net.peer.connect(PREFIX + code, { reliable: true });
    Net.hostConn = conn;
    conn.on('open', () => conn.send({ t: 'join', name: myName() }));
    conn.on('data', onClientData);
    conn.on('close', () => error('방장과 연결이 끊겼어요. 같은 이름으로 다시 참가하면 이어서 할 수 있어요'));
  });
  Net.peer.on('error', e => error(e.type === 'peer-unavailable' ? '그 코드의 방을 찾을 수 없어요' : '연결 문제가 생겼어요: ' + e.type));
}
function onClientData(d) {
  if (d.t === 'welcome') myId = d.id;
  if (d.t === 'lobby') { seats = d.seats; showLobby(); }
  if (d.t === 'full') error('방이 꽉 찼거나 이미 시작했어요');
  if (d.t === 'state') { state = d.s; draw(); }
}

// ---------- 공통 ----------
function sendMove(m) {
  if (Net.isHost) submit(myId, m);
  else if (Net.hostConn && Net.hostConn.open) Net.hostConn.send({ t: 'move', m });
}
function showLobby() {
  show('lobbyScreen');
  $('roomCode').textContent = Net.code;
  $('roomLink').value = `${location.origin}${location.pathname}?room=${Net.code}`;
  $('lobbyList').innerHTML = seats.map((s, i) => `<li><span class="who c${i}">${s.name}</span>${s.bot ? ' 🤖' : ''}${i === 0 ? ' (방장)' : ''}${i === myId ? ' ← 나' : ''}</li>`).join('');
  $('hostCtl').style.display = Net.isHost ? '' : 'none';
  $('waitHost').style.display = Net.isHost ? 'none' : '';
  $('startBtn').disabled = seats.length < 2;
}
function draw() {
  if (state.over) { View.result(state); show('endScreen'); return; }
  show('game');
  View.render(state, myId);
}

View.init(sendMove);
$('soloBtn').onclick = solo;
$('hostBtn').onclick = hostRoom;
$('joinBtn').onclick = () => joinRoom($('code').value);
$('addBotBtn').onclick = addBot;
$('startBtn').onclick = () => { if (seats.length >= 2) startGame(); };
$('againBtn').onclick = () => location.reload();
$('copyBtn').onclick = () => { $('roomLink').select(); navigator.clipboard?.writeText($('roomLink').value); $('copyBtn').textContent = '복사됨!'; };
const room = new URLSearchParams(location.search).get('room');
if (room) $('code').value = room;
show('menu');
