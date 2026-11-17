import { entryKey, prerequisiteKeys } from "./recommendations.js";

// Named prerequisites in the installed codex that are outside the recommendation plan.
const catalogPrerequisites = {
  s2: ["s1"],
  s40: ["a141"],
  s41: ["a7", "a123"],
  s55: ["a211"],
  s58: ["a206"],
  a6: ["s7"],
  a14: ["s6"],
  a26: ["s4"],
  a58: ["s16", "s17", "s18"],
  a62: ["s14"],
  a65: ["s12"],
  a69: ["s20"],
  a71: ["s14"],
  a76: ["s29"],
  a97: ["s23"],
  a126: ["s31"],
  a127: ["s7"],
  a128: ["s29"],
  a135: ["a134"],
  a136: ["a94"],
  a138: ["a6"],
  a140: ["a136"],
  a142: ["a32"],
  a145: ["a106"],
  a146: ["a119"],
  a172: ["a126", "a123"],
  a191: ["s6"],
  a207: ["a94"],
  a215: ["a107"],
  a237: ["s55"],
  a252: ["a234", "a233", "a223"],
  a253: ["a40"],
  a260: ["a44"],
  a270: ["s50", "s36", "a166", "a131"],
  a283: ["a0", "a35"],
  a292: ["a126"],
  a296: ["a78"],
  a307: ["a293"],
  a313: ["a5"],
  a318: ["a148"],
  a323: ["a15"],
  a324: ["s14"],
  a361: ["a367", "a299"],
  a374: ["a106", "a145", "a241"],
};

const preparations = {
  s12: ["중독을 걸 수 있는 유물이나 스킬을 판에서 확보하세요. 아기 두꺼비의 독액도 사용할 수 있어요."],
  s28: ["판에서 맹독 구름을 획득해 장착하고 특수 개조를 완료하세요."],
  s33: ["말굽 자석은 인벤토리에 보유하고, 플라즈마는 판에서 얻어 개조하세요."],
  s70: ["폭탄마의 가방과 서로 다른 폭탄 태그 스킬 2종을 장착해 폭탄마 컬렉션을 켜세요."],
  s81: ["증오의 가시를 특수 개조해 장착한 뒤 사막으로 향하세요."],
  s82: ["플라즈마를 특수 개조해 장착한 뒤 사막으로 향하세요."],
  s83: ["도감 조건의 신성의 상징에 해당하는 유물은 성배예요. 판에서 성배를 장착하세요."],
  s101: ["판에서 네 망치 클로버와 화염구를 확보해 장착하세요."],
  s102: ["불발 다이너마이트를 장착하고 폭탄 스킬을 준비하세요. 폭탄마 가까이에서 발동시키면 다이너마이트로 맞힐 수 있어요."],
  s103: ["판에서 독 바르기를 얻고 버프 칸에 장착한 뒤 그랑펠로 향하세요."],
  s104: ["사막 엘리베이터에 타기 전에 화염 태그 유물 7종을 장착하세요."],
  a30: ["주사위를 장착하고 서브 스킬을 발동해 재발동을 쌓으세요."],
  a75: ["주사위와 신의 주사위를 함께 장착하세요. 램페이지처럼 물리 태그가 있는 서브 스킬을 쓰면 두 유물의 재발동을 노릴 수 있어요."],
  a82: ["판에서 독 바르기를 얻어 버프 칸에 장착하세요."],
  a125: ["영혼 부적을 보유하고 방패가 없는 상태에서 상자를 열어 방패를 얻으세요. 같은 판에서 반복하세요."],
  a134: ["서로 다른 폭탄 태그 스킬 2종을 골라 개조하세요."],
  a194: ["특수 개조가 남아 있는 스킬을 5개 이상 장착한 뒤 판도라의 상자를 사용하세요."],
  a270: ["저주받은 구슬과 세리나의 깃털을 장착해 저주받은 생명체 컬렉션을 켜세요."],
  a284: ["판에서 신의 주사위를 얻어 장착하고 골드를 획득하세요."],
  a357: ["폭탄마의 가방과 서로 다른 폭탄 태그 스킬 2종을 장착해 폭탄마 컬렉션을 켜세요."],
  a366: ["케미아의 조독술을 버프 칸에 장착한 뒤 뱀술을 획득하세요."],
  a368: ["도굴꾼의 채찍·브러시·수첩을 함께 장착해 도굴의 기본 컬렉션을 켜세요."],
  a372: ["금지된 성배·푸른 성해포·치유의 탄피를 장착해 역설적 구원 컬렉션을 켜세요."],
  a374: ["찢어진 깃발·전쟁 깃발·체스 룩을 함께 장착해 워게임 컬렉션을 켜세요."],
};

const desert = "독성 늪지의 켈시를 처치한 뒤, 다음 챕터 갈림길에서 엘리베이터를 타고 붉은 태양의 사막으로 가세요.";
const grandfel = "붉은 태양의 사막에서 챕터 보스 고대 병기 아크론을 처치한 뒤 고대 도시 그랑펠에 진입하세요.";
const fortress = "독성 늪지를 지나 니플헤임 외곽을 클리어하고 챕터 4 철혈의 요새로 가세요.";

export function unlockPrerequisiteKeys(key) {
  return [...prerequisiteKeys(key), ...(catalogPrerequisites[key] ?? [])];
}

function travelFor(key, condition) {
  if (key === "s70" || key === "s102") {
    return [
      "독성 늪지의 중간 보스를 처치해 카드키를 확보하세요.",
      "켈시를 처치한 뒤 다음 챕터 갈림길에서 엘리베이터의 파란 게이지를 채워 폭탄마 은신처로 내려가세요.",
    ];
  }
  if (condition.includes("베네딕트")) {
    return [
      "도전 모드를 한 번 클리어해 템펠의 숨은 페이즈를 열고, 해당 페이즈의 템펠을 누적 5회 처치하세요.",
      "선행 조건을 채우면 일반 1단계와 도전 1단계 모두에서 베네딕트에게 갈 수 있어요. 입장할 판에서 지하 감옥의 숨은 보스 라스를 처치하세요.",
      fortress,
      "템펠 보스방 앞에서 왕의 그릇을 9,999골드에 구매하세요. 그릇을 보유한 채 템펠을 처치하고 베네딕트의 마지막 영령 페이즈까지 잡으세요.",
    ];
  }
  if (/그랑펠|우제트|호테프/.test(condition)) return [desert, grandfel];
  if (/붉은 태양의 사막|지룡 카라쿰|고대\s*병기 아크론|사막벌|사막의 고블린/.test(condition)) return [desert];
  if (/철혈의 요새|템펠/.test(condition)) return [fortress];
  return [];
}

function actionsFor(key, entry, entries) {
  if (entry.condition === "기본 해금" || entry.kindLabel === "투기장 전용") return [entry.condition];
  if (key === "a375") {
    return [
      fortress,
      "화염 시너지 4단계를 유지한 상태로 철혈의 요새를 클리어하세요.",
      desert,
      grandfel,
      "냉기 시너지 4단계를 유지한 상태로 고대 도시 그랑펠을 클리어하세요.",
    ];
  }
  const setup = key === "s19"
    ? [entries.get("s12")?.unlocked
      ? "해금된 맹독 확산으로 적에게 중독을 걸고, 중독으로 들어가는 피해를 누적하세요."
      : "판에서 적을 중독시킬 수 있는 스킬이나 유물을 확보하세요."]
    : preparations[key] ?? [];
  return [...setup, ...travelFor(key, entry.condition), entry.condition];
}

export function buildUnlockRoute(snapshot, goalKey) {
  const entries = new Map([
    ...snapshot.skills.map((entry) => [entryKey(entry, "skill"), entry]),
    ...snapshot.artifacts.map((entry) => [entryKey(entry, "artifact"), entry]),
  ]);
  const goal = entries.get(goalKey);
  if (!goal) return null;
  const visited = new Set();
  const steps = [];
  const completed = [];

  function visit(key) {
    const entry = entries.get(key);
    if (!entry || visited.has(key)) return;
    visited.add(key);
    if (entry.unlocked && key !== goalKey) {
      completed.push(entry.name);
      return;
    }
    if (!entry.unlocked) {
      for (const prerequisite of unlockPrerequisiteKeys(key)) visit(prerequisite);
    }
    steps.push({ key, entry, actions: actionsFor(key, entry, entries) });
  }

  visit(goalKey);
  return { goal, steps, completed };
}
