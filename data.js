// 게임 수치는 전부 여기. 규칙 설명은 RULES.md.
// 자원: wood 목재, stone 석재, iron 철, food 식량, gold 금화

const DATA = {
  rounds: 10,
  harvestRounds: [2, 4, 6, 8, 10],
  maxWorkers: 4,
  maxArm: 8,
  start: { workers: 2, res: { wood: 1, stone: 0, iron: 0, food: 2, gold: 0 } },

  res: {
    wood: { name: '목재', icon: '🪵' },
    stone: { name: '석재', icon: '🪨' },
    iron: { name: '철', icon: '⛓️' },
    food: { name: '식량', icon: '🍞' },
    gold: { name: '금화', icon: '🪙' },
  },

  stages: [
    { name: '개척촌', home: 'art/bld/home0.png', plots: 4 },
    { name: '마을', home: 'art/bld/home1.png', plots: 7, need: { workers: 3, buildings: 2 }, cost: { wood: 2, stone: 2, gold: 2 }, rep: 3 },
    { name: '도시', home: 'art/bld/home2.png', plots: 10, need: { workers: 4, buildings: 3 }, cost: { stone: 4, iron: 2, gold: 3 }, rep: 6 },
  ],
  firstToStageBonus: 2,

  harvest: { foodPerField: 2, eat: 2, eatNewborn: 1, faminePenalty: 3 },

  // kind = 카드 테두리 색(res 자원, build 건설, temple 신전, trade 교역, war 전쟁, family 가문). art = 그림 없을 때 쓰는 이모지, img = 그림 칸 그림
  // 행동 칸. minPlayers 이상일 때만 깔린다. round 가 있으면 그 라운드에 열린다(왕명), roundByPlayers 로 인원별 예외.
  actions: [
    { id: 'logging', kind: 'res', art: '🪓', img: 'art/cards/logging.jpg', name: '벌목장', acc: { wood: 3 }, text: '목재 누적' },
    { id: 'quarry', kind: 'res', art: '⛏️', img: 'art/cards/quarry.jpg', name: '채석장', acc: { stone: 2 }, text: '석재 누적' },
    { id: 'hunt', kind: 'res', art: '🏹', img: 'art/cards/hunt.jpg', name: '사냥터', acc: { food: 2 }, text: '식량 누적' },
    { id: 'clear', kind: 'build', art: '🌾', img: 'art/cards/clear.jpg', name: '개간', text: '밭 1개 + 목재 1' },
    { id: 'build', kind: 'build', art: '🔨', img: 'art/cards/build.jpg', name: '공사장', text: '건물 1채 짓기' },
    { id: 'seal', kind: 'trade', art: '📜', img: 'art/cards/seal.jpg', name: '영주 인장', text: '다음 라운드 선 + 식량 1 + 금화 1' },
    { id: 'temple', kind: 'temple', art: '⛪', img: 'art/cards/temple.jpg', name: '대신전', text: '승격 / 고해성사 / 헌금함(식량 1)' },
    { id: 'gather', kind: 'res', art: '🪵', img: 'art/cards/gather.jpg', name: '장작 줍기', acc: { wood: 1 }, minPlayers: 3, text: '목재 누적 + 식량 1' },
    { id: 'peddler', kind: 'trade', art: '🎒', img: 'art/cards/peddler.jpg', name: '행상', minPlayers: 4, text: '목재·석재·철 중 1 + 금화 1' },
    { id: 'mine', kind: 'res', art: '⚒️', img: 'art/cards/mine.jpg', name: '철광', round: 1, acc: { iron: 1 }, text: '철 누적' },
    { id: 'market', kind: 'trade', art: '⚖️', img: 'art/cards/market.jpg', name: '장터', round: 3, text: '자원 2개 → 금화 3, 또는 금화 1' },
    { id: 'family', kind: 'family', art: '👶', img: 'art/cards/family.jpg', name: '새 식구', round: 2, text: '주민 +1 (빈 자리 필요), 아니면 건물 1채' },
    { id: 'forge', kind: 'war', art: '🔥', img: 'art/cards/forge.jpg', name: '대장간', text: '맨손 주민을 기사로 무장(철 1~5) + 보상 1' },
    { id: 'trade', kind: 'trade', art: '🐪', img: 'art/cards/trade.jpg', name: '교역로', round: 5, text: '철 1 → 금화 2, 최대 2번' },
    { id: 'wedding', kind: 'family', art: '💍', img: 'art/cards/wedding.jpg', name: '혼례', round: 7, text: '주민 +1 (빈 자리 필요)' },
    { id: 'knighting', kind: 'war', art: '🎖️', round: 6, name: '기사 서임식', text: '철 없이 무장 +1 (맨손이면 기사 무장 1)' },
    { id: 'envoy', kind: 'trade', art: '📯', round: 8, name: '왕의 사절', text: '평판 +2 또는 금화 2' },
    { id: 'festival', kind: 'family', art: '🎉', round: 9, name: '풍년 축제', text: '식량 1 + 밭마다 식량 1' },
    { id: 'coronation', kind: 'temple', art: '👑', round: 10, name: '대관식 준비', text: '승격(금화 1 덜 냄) 또는 평판 +1' },

    // 원정 지도: 기사만 갈 수 있는 목적지. minArm 이상 무장한 기사가 가서 pool 에서 loot 개 고르고, 다녀오면 무장 +1.
    // rounds = 인원별로 열리는 라운드(없으면 처음부터). minPlayers 이상일 때만.
    { id: 'forest', zone: 'map', kind: 'war', art: '🌲', name: '가까운 숲', minArm: 1, loot: 2, pool: ['wood2', 'food2', 'stone2'], text: '무장 1+ · 목재·식량·석재 중 2' },
    { id: 'forest2', zone: 'map', kind: 'war', art: '🌲', name: '가까운 숲 (둘째 길)', minArm: 1, loot: 2, pool: ['wood2', 'food2', 'stone2'], minPlayers: 3, text: '무장 1+ · 목재·식량·석재 중 2' },
    { id: 'ruins', zone: 'map', kind: 'war', art: '🏚️', name: '옛 성채 폐허', minArm: 2, loot: 2, pool: ['stone2', 'iron1', 'food2', 'gold2'], round: 4, roundByPlayers: { 4: 0 }, text: '무장 2+ · 석재·철·식량·금화 중 2' },
    { id: 'mountain', zone: 'map', kind: 'war', art: '⛰️', name: '바위 산', minArm: 3, loot: 2, pool: ['stone2', 'iron1', 'gold2', 'field'], text: '무장 3+ · 석재·철·금화·밭 중 2' },
    { id: 'dragon', zone: 'map', kind: 'war', art: '🐉', name: '용의 둥지', minArm: 6, loot: 2, pool: ['gold2', 'rep3', 'field', 'build'], text: '무장 6+ · 금화·평판·밭·건물 중 2' },
  ],

  market: { pay: 2, gold: 3, freeGold: 1 },
  trade: { iron: 1, gold: 2, times: 2 },
  envoy: { rep: 2, gold: 2 },
  coronationDiscount: { gold: 1 },
  forgeMaxIron: 5,

  // 원정 보상. arm = 필요한 무장
  loot: [
    { id: 'wood2', arm: 1, name: '목재 2', give: { wood: 2 } },
    { id: 'food2', arm: 1, name: '식량 2', give: { food: 2 } },
    { id: 'stone2', arm: 2, name: '석재 2', give: { stone: 2 } },
    { id: 'iron1', arm: 3, name: '철 1', give: { iron: 1 } },
    { id: 'gold2', arm: 4, name: '금화 2', give: { gold: 2 } },
    { id: 'field', arm: 5, name: '밭 1개', field: true },
    { id: 'rep3', arm: 6, name: '평판 3', rep: 3 },
    { id: 'build', arm: 7, name: '건물 짓기', build: true },
  ],

  // stage = 지을 수 있는 최소 단계(0 개척촌, 1 마을, 2 도시). house = 여러 채 가능, 주민 자리.
  buildings: [
    { id: 'hut', art: '🛖', img: 'art/bld/hut.png', name: '오두막', stage: 0, cost: { wood: 3 }, rep: 1, house: 1, text: '주민 자리 +1' },
    { id: 'granary', art: '🧺', img: 'art/bld/granary.png', name: '곡물 창고', stage: 0, cost: { wood: 2 }, rep: 1, text: '수확 때 식량 +2' },
    { id: 'carpenter', art: '🪚', img: 'art/bld/carpenter.png', name: '목공소', stage: 0, cost: { wood: 1, stone: 1 }, rep: 1, text: '벌목장에서 목재 +1' },
    { id: 'chapel', art: '🕯️', img: 'art/bld/chapel.png', name: '작은 예배당', stage: 0, cost: { wood: 2, stone: 1 }, rep: 2, text: '대신전에 갈 때마다 평판 +1' },
    { id: 'stoneHouse', art: '🏠', img: 'art/bld/stoneHouse.png', name: '석조 주택', stage: 1, cost: { wood: 2, stone: 3 }, rep: 3, house: 2, text: '주민 자리 +2' },
    { id: 'bazaar', art: '🏪', img: 'art/bld/bazaar.png', name: '시장 거리', stage: 1, cost: { wood: 2, stone: 2 }, rep: 2, text: '장터·교역로에서 금화 +1' },
    { id: 'smith', art: '⚒️', img: 'art/bld/smith.png', name: '대장장이', stage: 1, cost: { stone: 2, iron: 1 }, rep: 2, text: '대장간에서 무장 +2 공짜' },
    { id: 'mill', art: '🌾', img: 'art/bld/mill.png', name: '방앗간', stage: 1, cost: { wood: 3, stone: 1 }, rep: 2, text: '밭마다 수확 식량 +1' },
    { id: 'wall', art: '🧱', img: 'art/bld/wall.png', name: '성벽', stage: 2, cost: { stone: 5 }, rep: 5, text: '' },
    { id: 'guildHall', art: '🏛️', img: 'art/bld/guildHall.png', name: '길드 회관', stage: 2, cost: { stone: 3, gold: 3 }, rep: 2, text: '끝날 때 건물 1채당 평판 +1' },
    { id: 'order', art: '🛡️', img: 'art/bld/order.png', name: '기사단 본부', stage: 2, cost: { stone: 3, iron: 3 }, rep: 2, text: '끝날 때 기사 1명당 평판 +3' },
    { id: 'cathedral', art: '🔔', img: 'art/bld/cathedral.png', name: '대성당', stage: 2, cost: { stone: 6, gold: 4 }, rep: 8, text: '' },
  ],
};

if (typeof module !== 'undefined') module.exports = DATA;
