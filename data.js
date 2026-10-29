// 게임 수치는 전부 여기. 규칙 설명은 RULES.md.
// 자원: wood 목재, stone 석재, iron 철, food 식량, gold 금화

const DATA = {
  rounds: 8,
  harvestRounds: [2, 4, 6, 8],
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
    { name: '개척촌', plots: 4 },
    { name: '마을', plots: 7, need: { workers: 3, buildings: 2 }, cost: { wood: 2, stone: 2, gold: 2 }, rep: 3 },
    { name: '도시', plots: 10, need: { workers: 4, buildings: 3 }, cost: { stone: 4, iron: 2, gold: 3 }, rep: 6 },
  ],
  firstToStageBonus: 2,

  harvest: { foodPerField: 2, eat: 2, eatNewborn: 1, faminePenalty: 3 },

  // kind = 카드 테두리 색(res 자원, build 건설, temple 신전, trade 교역, war 전쟁, family 가문). art = 그림 칸(나중에 그림 파일로 교체)
  // 행동 칸. minPlayers 이상일 때만 깔린다. round 가 있으면 그 라운드에 열린다(왕명).
  actions: [
    { id: 'logging', kind: 'res', art: '🪓', name: '벌목장', acc: { wood: 3 }, text: '목재 누적' },
    { id: 'quarry', kind: 'res', art: '⛏️', name: '채석장', acc: { stone: 2 }, text: '석재 누적' },
    { id: 'hunt', kind: 'res', art: '🏹', name: '사냥터', acc: { food: 2 }, text: '식량 누적' },
    { id: 'clear', kind: 'build', art: '🌾', name: '개간', text: '밭 1개 + 목재 1' },
    { id: 'build', kind: 'build', art: '🔨', name: '공사장', text: '건물 1채 짓기' },
    { id: 'seal', kind: 'trade', art: '📜', name: '영주 인장', text: '다음 라운드 선 + 식량 1 + 금화 1' },
    { id: 'temple', kind: 'temple', art: '⛪', name: '대신전', text: '승격 / 고해성사 / 헌금함(식량 1)' },
    { id: 'gather', kind: 'res', art: '🪵', name: '장작 줍기', acc: { wood: 1 }, minPlayers: 3, text: '목재 누적 + 식량 1' },
    { id: 'peddler', kind: 'trade', art: '🎒', name: '행상', minPlayers: 4, text: '목재·석재·철 중 1 + 금화 1' },
    { id: 'mine', kind: 'res', art: '⚒️', name: '철광', round: 1, acc: { iron: 1 }, text: '철 누적' },
    { id: 'market', kind: 'trade', art: '⚖️', name: '장터', round: 3, text: '자원 2개 → 금화 3, 또는 금화 1' },
    { id: 'family', kind: 'family', art: '👶', name: '새 식구', round: 2, text: '주민 +1 (빈 자리 필요), 아니면 건물 1채' },
    { id: 'forge', kind: 'war', art: '🔥', name: '대장간', round: 4, text: '맨손 주민 무장(철 1~5) → 원정 1' },
    { id: 'expedition', kind: 'war', art: '⚔️', name: '원정', round: 5, text: '기사만: 원정 2' },
    { id: 'trade', kind: 'trade', art: '🐪', name: '교역로', round: 6, text: '철 1 → 금화 2, 최대 2번' },
    { id: 'wedding', kind: 'family', art: '💍', name: '혼례', round: 7, text: '주민 +1 (빈 자리 필요)' },
    { id: 'bigExpedition', kind: 'war', art: '🐉', name: '대원정', round: 8, text: '기사만: 원정 3' },
  ],

  market: { pay: 2, gold: 3, freeGold: 1 },
  trade: { iron: 1, gold: 2, times: 2 },
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
    { id: 'hut', art: '🛖', name: '오두막', stage: 0, cost: { wood: 3 }, rep: 1, house: 1, text: '주민 자리 +1' },
    { id: 'granary', art: '🧺', name: '곡물 창고', stage: 0, cost: { wood: 2 }, rep: 1, text: '수확 때 식량 +2' },
    { id: 'carpenter', art: '🪚', name: '목공소', stage: 0, cost: { wood: 1, stone: 1 }, rep: 1, text: '벌목장에서 목재 +1' },
    { id: 'chapel', art: '🕯️', name: '작은 예배당', stage: 0, cost: { wood: 2, stone: 1 }, rep: 2, text: '대신전에 갈 때마다 평판 +1' },
    { id: 'stoneHouse', art: '🏠', name: '석조 주택', stage: 1, cost: { wood: 2, stone: 3 }, rep: 3, house: 2, text: '주민 자리 +2' },
    { id: 'bazaar', art: '🏪', name: '시장 거리', stage: 1, cost: { wood: 2, stone: 2 }, rep: 2, text: '장터·교역로에서 금화 +1' },
    { id: 'smith', art: '⚒️', name: '대장장이', stage: 1, cost: { stone: 2, iron: 1 }, rep: 2, text: '대장간에서 무장 +2 공짜' },
    { id: 'mill', art: '🌾', name: '방앗간', stage: 1, cost: { wood: 3, stone: 1 }, rep: 2, text: '밭마다 수확 식량 +1' },
    { id: 'wall', art: '🧱', name: '성벽', stage: 2, cost: { stone: 5 }, rep: 5, text: '' },
    { id: 'guildHall', art: '🏛️', name: '길드 회관', stage: 2, cost: { stone: 3, gold: 3 }, rep: 2, text: '끝날 때 건물 1채당 평판 +1' },
    { id: 'order', art: '🛡️', name: '기사단 본부', stage: 2, cost: { stone: 3, iron: 3 }, rep: 2, text: '끝날 때 기사 1명당 평판 +3' },
    { id: 'cathedral', art: '🔔', name: '대성당', stage: 2, cost: { stone: 6, gold: 4 }, rep: 8, text: '' },
  ],
};

if (typeof module !== 'undefined') module.exports = DATA;
