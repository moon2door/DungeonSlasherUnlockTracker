const step = (key, ...requires) => ({ key, requires });

const routes = [
  {
    id: "dice",
    title: "주사위와 램페이지",
    tip: "주사위와 신의 주사위를 둘 다 주워 장착하세요. 램페이지 같은 물리 스킬로 재발동을 쌓으며 골드를 챙기면 두 유물을 함께 노릴 수 있어요.",
    targets: [step("a29"), step("a30", "a29"), step("a284", "a30"), step("a75", "a29", "a30")],
  },
  {
    id: "plasma",
    title: "플라즈마로 처치 누적",
    tip: "플라즈마로 막타를 모으세요. 죽음의 광선이 열리면 다음 판에서 예언자를 맞혀 조준경으로 이어갈 수 있어요.",
    targets: [step("s5"), step("s4", "s5"), step("s22", "s4"), step("s23", "s22"),
      step("a77", "s23"), step("a84", "s23", "s15"), step("a150"), step("s33", "s22", "a150")],
  },
  {
    id: "melee",
    title: "근접 6으로 유물 두 개",
    tip: "서로 다른 근접 스킬로 6근접을 맞추세요. 두 조건은 같은 순간 달성돼요.",
    targets: [step("a254"), step("a277")],
  },
  {
    id: "bomber",
    title: "폭탄마 은신처",
    tip: "독성 늪지에서 카드키를 얻고 켈시 이후 엘리베이터의 파란 게이지를 채우세요. 중력 폭탄을 노릴 때는 불발 다이너마이트를 장착하고 케렐 가까이에서 폭탄 스킬을 발동하세요.",
    targets: [step("a134"), step("s70", "a134"), step("a357", "a134"), step("s102", "a357")],
  },
  {
    id: "lightning",
    title: "번개 시너지로 철혈의 요새",
    tip: "번개 부름·연쇄 번개·플라즈마처럼 서로 다른 번개 스킬을 모으세요. 빛나는 별의 보석은 6번개를 유지한 채 템펠을 처치하면 돼요.",
    targets: [step("s37", "s6"), step("s53"), step("a193"), step("a247")],
  },
  {
    id: "poison",
    title: "중독 피해와 막타 누적",
    tip: "맹독 확산과 신경독을 활용하세요. 중독 대미지가 막타를 내면 독버섯과 녹아내린 두개골 조건도 동시에 쌓여요.",
    targets: [step("s12"), step("s15", "s12"), step("s19"), step("a46"), step("a66"), step("s91"),
      step("s28", "s19"), step("s27", "a46"), step("s29", "s28"), step("a82", "s28"), step("s26", "s28")],
  },
  {
    id: "flame",
    title: "초반 화염 스킬·유물",
    tip: "예언자를 바로 잡기 전에 화염 지대로 그로기를 유도하세요. 번개 부름과 화염 지대를 각각 한 번 개조한 판은 챕터를 클리어해 소형 태양을 노리세요.",
    targets: [step("s14"), step("a73", "s5", "s14"), step("s13"), step("a55", "s13"), step("a179"),
      step("s59", "a179"), step("s35", "s14", "a83")],
  },
  {
    id: "frost",
    title: "냉기 스킬과 니플헤임 외곽",
    tip: "수상한 얼음 조각과 얼음창으로 서리 가시를 열고, 후속 판에서 니플헤임 외곽의 스톤 골렘을 노리세요. 빙결 상태의 적을 때리는 동안 건틀릿 조건도 같이 확인하세요.",
    targets: [step("s30", "s24", "a39"), step("s31", "s30"), step("a158"), step("s42", "s30", "a158"),
      step("a43"), step("s34", "a43"), step("a129"), step("a168", "a43"), step("a169", "a168"),
      step("a124"), step("a125", "a124"), step("s36", "a125"), step("s68")],
  },
  {
    id: "spell",
    title: "주문과 서브 스킬 막타",
    tip: "번개 부름으로 잡몹의 막타를 내면 서브 스킬과 주문 스킬 처치 수를 함께 쌓을 수 있어요.",
    targets: [step("s11"), step("a24"), step("a54", "s5")],
  },
  {
    id: "short",
    title: "다른 판에서 함께 챙길 조건",
    tip: "무투가 레벨과 간단한 열쇠 효과는 다른 목표를 진행하는 동안에도 쌓을 수 있어요. 표창 기동이 잘 뜬 판은 개조하고 막타를 모으세요.",
    targets: [step("s47"), step("a219", "a157"), step("a59", "s2"), step("a131"), step("a200"),
      step("a311", "a6"), step("a42")],
  },
  {
    id: "chain",
    title: "연쇄 시너지로 그랑펠",
    tip: "4연쇄부터 검은 별의 막타를 모으세요. 6연쇄로 그랑펠에 가면 호테프 처치와 부활 조건을 같은 빌드에서 노릴 수 있어요.",
    targets: [step("s85"), step("a246"), step("a370"), step("a373"), step("s99")],
  },
  {
    id: "desert",
    title: "붉은 태양의 사막",
    tip: "켈시 다음에 엘리베이터를 타고 사막에 진입하세요. 모래에서 100초를 먼저 채우고, 모래 사망은 판을 마무리할 때 노리세요.",
    targets: [step("s81", "s1"), step("s82", "s22"), step("s83", "a33"), step("s88"), step("s84"),
      step("a310"), step("s69"), step("s89"), step("s100", "s68"), step("a288"), step("s104")],
  },
  {
    id: "grandfel",
    title: "그랑펠 전용 조건",
    tip: "독 바르기를 장착한 채 그랑펠에 들어가 케미아의 조독술을 여세요. 다음 판에서 뱀술을 버려 코브라 석상으로, 이후 도굴의 기본과 함께 이끼 낀 두개골로 이어갈 수 있어요.",
    targets: [step("s103", "s28"), step("a56", "s15"), step("a366", "s103", "a56"),
      step("a358"), step("a359"), step("a362"), step("a368", "a366", "a358", "a359", "a362"),
      step("a363"), step("s101", "a55", "s25"), step("a372", "a34", "a88", "a261")],
  },
  {
    id: "divinity",
    title: "신성·암흑 조건",
    tip: "6신성 판에서는 부활 횟수를 쌓으세요. 8신성과 8암흑을 동시에 갖추면 금지된 성배와 믿음의 종이 같이 열려요.",
    targets: [step("s66"), step("s86"), step("s87"), step("a34"), step("a300"), step("a331"),
      step("a286"), step("a304")],
  },
  {
    id: "mods",
    title: "특수 개조 유물",
    tip: "벤티를 만나면 특수 개조를 시도하세요. 영웅의 주사위를 노리는 판에서는 미특개 스킬을 충분히 장착한 뒤 판도라의 상자를 사용하세요.",
    targets: [step("a83", "s0"), step("a242"), step("a187"), step("a194", "a187")],
  },
  {
    id: "benedict",
    area: "later",
    title: "베네딕트와 속성 강타",
    tip: "입장 조건을 채우면 일반 1단계에서도 베네딕트를 만날 수 있어요. 원하는 속성 시너지 10을 유지한 채 마지막 영령 페이즈를 처치하세요. 10암흑 판은 망자의 불꽃도 함께 달성돼요.",
    targets: [step("a88"), step("s63"), step("s64"), step("s92"), step("s93"), step("s94"),
      step("s95"), step("s96"), step("s97"), step("s98"), step("a278")],
  },
  {
    id: "gunner",
    area: "character",
    title: "총잡이",
    tip: "센트리건-미니건을 장착한 상태에서 램페이지를 특수 개조하세요. 챕터 3 클리어까지 하면 치유의 탄피 선행도 진행할 수 있어요.",
    targets: [step("s50"), step("a259", "s11"), step("a262"), step("a261", "a262")],
  },
  {
    id: "other-characters",
    area: "character",
    title: "캐릭터 전용 목표",
    tip: "방랑 용병 출전, 학살자 Lv.30 혈향, 소환술사 영혼의 계약은 각각 해당 캐릭터의 Lv.25 목표와 묶으세요.",
    targets: [step("s45"), step("s46"), step("s48"), step("s49"), step("s51"), step("s52"),
      step("s61"), step("s71"), step("s73"), step("s74"), step("s75"), step("s76"), step("s77"),
      step("s78"), step("s79"), step("s80"), step("a143"), step("a208"), step("a166")],
  },
];

const definitions = new Map(routes.flatMap(({ targets }) => targets.map((target) => [target.key, target])));
const highGrade = (entry) => entry.grade === "상급" || entry.grade === "특급";

export function entryKey(entry, tab) {
  if (tab === "skill") return "s" + entry.id;
  const prefix = entry.kindLabel === "저주" ? "c" : entry.kindLabel === "투기장 전용" ? "v" : "a";
  return prefix + entry.id;
}

export function prerequisiteKeys(key) {
  return definitions.get(key)?.requires ?? [];
}

export function recommend(snapshot) {
  const skills = snapshot.skills.map((entry) => ({ ...entry, key: entryKey(entry, "skill"), objective: true }));
  const artifacts = snapshot.artifacts.map((entry) => ({
    ...entry, key: entryKey(entry, "artifact"), objective: highGrade(entry),
  }));
  const entries = [...skills, ...artifacts];
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const pendingGoals = entries.filter((entry) => entry.objective && !entry.unlocked);
  const needed = new Set(pendingGoals.map((entry) => entry.key));
  // Walk the remaining goals and add any still-locked catalog prerequisites.
  for (const key of needed) {
    for (const required of prerequisiteKeys(key)) {
      const prerequisite = byKey.get(required);
      if (prerequisite && !prerequisite.unlocked) needed.add(required);
    }
  }
  const planned = routes.map(({ targets, ...route }) => ({
    ...route,
    items: targets.filter(({ key }) => needed.has(key)).map(({ key, requires }) => ({
      ...byKey.get(key),
      prerequisites: requires.map((id) => byKey.get(id)).filter((item) => item && !item.unlocked),
    })),
  })).filter(({ items }) => items.length > 0);
  const other = entries.filter((entry) => needed.has(entry.key) && !definitions.has(entry.key))
    .map((entry) => ({ ...entry, prerequisites: [] }));
  const ready = [];
  const following = [];
  const character = [];
  for (const route of planned) {
    if (route.area === "character") character.push(route);
    else if (route.area === "later" || route.items.every((item) => item.prerequisites.length > 0)) following.push(route);
    else ready.push(route);
  }
  return { remaining: pendingGoals.length, ready, following, character, other };
}
