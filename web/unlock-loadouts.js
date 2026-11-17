import { entryKey } from "./recommendations.js";
import { recommendLoadout, unlockedLoadoutArtifacts } from "./loadouts.js";
import { unlockPrerequisiteKeys } from "./unlock-routes.js";

const attackSlots = 6;
const buffSlots = 2;
const artifactSlots = 6;
const expandedArtifactSlots = 7;
const tagsOf = ({ tags }) => tags.split(",").map((tag) => tag.trim());

const elementalTags = ["암흑", "신성", "출혈", "냉기", "독", "화염", "번개"];
const traitTags = [...elementalTags, "근접", "연쇄", "투사체", "조준", "소환", "폭탄", "마법", "물리", "저주", "주문"];
const traitCondition = new RegExp(`(?:(\\d+)\\s*)?(${traitTags.join("|")})\\s*시너지(?:가|를)?(?:\\s*(\\d+)\\s*단계)?`, "g");
const taggedSkillCondition = new RegExp(`(${[...traitTags, "메인", "서브"].join("|")})\\s*(?:태그|속성)?\\s*(?:의\\s*)?스킬`, "g");
const combatCondition = /처치|클리어|대미지.{0,10}(?:입히|달성)|피해를 입히/;
const compactTiers = new Set(["저주", "폭탄"]);

// Equipped-artifact trait bonuses, distinct from their skill damage tags.
const artifactTraits = {
  27: { 출혈: 1 },
  33: { 신성: 1 },
  34: { 신성: 1 },
  57: { 독: 1 },
  59: { 연쇄: 1 },
  68: { 냉기: 1 },
  73: { 화염: 1 },
  88: { 신성: 1 },
  193: { 번개: 1 },
  262: { 신성: 1 },
  270: { 소환: 1 },
  283: { 마법: 1 },
  287: { 암흑: 1 },
  288: { 신성: 2 },
};

const gearNotes = {
  1: "메인 스킬 대미지 +40%",
  4: "서브 스킬 대미지 +10% · 쿨타임 가속 +20%",
  57: "독 스킬 대미지 +25%",
  59: "연쇄 스킬 대미지 +80% · 연쇄 +1",
  68: "냉기 스킬 대미지 +25%",
  73: "화염 스킬 대미지 +50%",
  86: "스킬 대미지 +20%",
  88: "남은 부활 1회당 신성 +1 · 다른 속성 스킬 발동 제한",
  110: "치명타 확률 +15% · 치명타 대미지 +45%",
  160: "획득 후 쓴 골드에 따라 타격당 추가 대미지",
  161: "획득 후 쓴 골드에 따라 공격력 증가",
  165: "암흑·출혈 스킬 대미지 +200%",
  179: "화염 스킬 대미지 +150%",
  193: "번개 스킬 대미지 +20% · 쿨타임 가속 +20%",
  195: "메인 스킬 대미지 +100%",
  247: "번개 스킬 적중 시 정전기 추가 피해",
  261: "암흑·신성 스킬 대미지 +20%",
  286: "보유 골드 100당 스킬 대미지 +2% · 최대 +200%",
  288: "신성 외 속성 시너지 −1",
  331: "공격력 +44 · 보스 처형 체력 한도 증가",
};

const temporaryTraits = {
  202: "번개", 203: "화염", 204: "냉기", 205: "독", 206: "출혈",
  211: "번개", 212: "화염", 213: "신성", 214: "독",
};

const fightArtifacts = {
  암흑: [165, 286, 331, 261, 195, 110, 160],
  출혈: [165, 147, 195, 110, 160],
  냉기: [68, 195, 110, 160],
  독: [57, 195, 110, 160],
  화염: [179, 73, 195, 110, 160],
  신성: [261, 195, 110, 160],
  번개: [193, 247, 195, 110, 160],
  연쇄: [59, 195, 110, 160],
};

// Some goals describe a collection or a status without naming the equipment.
const requiredGear = {
  s33: ["s22", "a150"],
  s70: ["a134"],
  s83: ["a33"],
  s102: ["a357"],
  a30: ["a29"],
  a73: ["s5", "s14"],
  a75: ["s11", "a29", "a30"],
  a270: ["a166", "a131"],
  a357: ["a134"],
  a368: ["a358", "a359", "a362"],
  a372: ["a34", "a88", "a261"],
  a374: ["a106", "a145", "a241"],
};

const darkAttacks = [33, 11, 84, 40, 85, 51, 65, 50, 74, 102];
const combatSkills = {
  s12: [15, 2, 19],
  s19: [12, 15, 2],
  s27: [12, 15, 19, 2],
  s28: [12, 15],
  s104: [21, 14, 25, 35, 49, 45],
  a46: [12, 15, 19],
  a66: [12, 15, 19],
  a29: [11, 5, 14],
  a30: [11, 5, 14],
  a194: [5, 11, 14, 24, 4, 2],
  a179: [21, 14, 25, 35, 49, 45],
  a287: darkAttacks,
  a331: darkAttacks,
  a372: [13, 46, 32, 43, 31, 23, 86, 66],
};

const attackPreference = [33, 11, 4, 5, 22, 55, 20, 24, 19, 12, 14, 21, 25, 13, 46, 32, 43, 0, 84, 40, 85, 51];
const generalCombatSkills = [5, 4, 11, 22, 14, 33, 24, 20, 43, 2];

function traitGoals(key, condition) {
  if (["s70", "a134", "a357"].includes(key)) return [{ tag: "폭탄", target: 2 }];
  if (key === "a331") return [];
  return Array.from(condition.matchAll(traitCondition), ([, count, tag, tier]) => {
    const level = Number(tier) || 1;
    const threshold = compactTiers.has(tag) ? level + 1 : level * 2;
    return { tag, target: count ? Number(count) : threshold };
  });
}

function traitTotal(tag, skills, artifacts, used) {
  const bonuses = artifacts.reduce((sum, item) => {
    if (item.id === 288 && elementalTags.includes(tag) && tag !== "신성") return sum - 1;
    return sum + (artifactTraits[item.id]?.[tag] ?? 0);
  }, 0);
  const darkPair = tag === "암흑" && artifacts.some(({ id }) => id === 287)
    && artifacts.some(({ id }) => id === 286);
  const temporary = used.some(({ id }) => temporaryTraits[id] === tag);
  return Math.max(0, skills.filter((skill) => tagsOf(skill).includes(tag)).length
    + bonuses + Number(darkPair) + Number(temporary));
}

function artifactNote(item, artifacts) {
  const bonuses = Object.entries(artifactTraits[item.id] ?? {})
    .map(([tag, amount]) => `${tag} 시너지 +${amount}`);
  if (item.id === 287 && artifacts.some(({ id }) => id === 286)) bonuses.push("황금 우상과 함께 +1");
  const description = gearNotes[item.id];
  if (description) bonuses.push(description);
  return bonuses.join(" · ");
}

function selectBuild(snapshot, key, gear, goals, condition, label) {
  const notes = [];
  const fireOnly = key === "s104";
  const skillPool = snapshot.skills
    .filter((item) => entryKey(item, "skill") !== key && !tagsOf(item).includes("인챈트"));
  const artifactPool = snapshot.artifacts
    .filter((item) => entryKey(item, "artifact") !== key && !item.kindLabel);
  const requiredArtifacts = artifactPool.filter((item) => gear.has(entryKey(item, "artifact")));
  const artifacts = requiredArtifacts.filter(({ id }) => !(id in temporaryTraits)).slice(0, artifactSlots);
  const used = requiredArtifacts.filter(({ id }) => id in temporaryTraits);
  const divinityOnly = artifacts.some(({ id }) => id === 88);
  const noSub = artifacts.some(({ id }) => id === 35);
  const attacks = skillPool.filter((item) => gear.has(entryKey(item, "skill")) && !tagsOf(item).includes("버프"))
    .slice(0, attackSlots);
  const buffs = skillPool.filter((item) => gear.has(entryKey(item, "skill")) && tagsOf(item).includes("버프"))
    .slice(0, buffSlots);

  const deficit = (skills, relics) => goals.reduce((sum, { tag, target }) =>
    sum + Math.max(0, target - traitTotal(tag, skills, relics, used)), 0);

  const skillOrder = new Map([...new Set([...(combatSkills[key] ?? []), ...attackPreference])]
    .map((id, index) => [id, index]));
  const rankedSkills = skillPool.filter((item) => {
    const tags = tagsOf(item);
    return (!divinityOnly || tags.includes("신성")) && (!noSub || !tags.includes("서브"));
  }).toSorted((a, b) => (skillOrder.get(a.id) ?? skillOrder.size) - (skillOrder.get(b.id) ?? skillOrder.size));

  const traitArtifacts = artifactPool
    .filter(({ id }) => id in artifactTraits && (id !== 88 || goals.every(({ tag }) => tag === "신성")))
    .map((item) => [item]);
  const darkStake = artifactPool.find(({ id }) => id === 287);
  const goldenIdol = artifactPool.find(({ id }) => id === 286);
  if (darkStake && goldenIdol) traitArtifacts.unshift([darkStake, goldenIdol]);

  function fillSkills(available) {
    for (const skill of rankedSkills) {
      const slots = tagsOf(skill).includes("버프") ? buffs : attacks;
      const limit = slots === buffs ? buffSlots : attackSlots;
      const equipped = [...attacks, ...buffs];
      if (skill.unlocked !== available || slots.length >= limit || equipped.includes(skill)) continue;
      if (deficit([...equipped, skill], artifacts) < deficit(equipped, artifacts)) slots.push(skill);
    }
  }

  function fillTraits(available) {
    for (const choice of traitArtifacts) {
      const additions = choice.filter((item) => !artifacts.includes(item));
      if (additions.length === 0 || artifacts.length + additions.length > artifactSlots) continue;
      if (additions.some((item) => item.unlocked !== available)) continue;
      const skills = [...attacks, ...buffs];
      const gain = deficit(skills, artifacts) - deficit(skills, [...artifacts, ...additions]);
      if (gain >= additions.length) artifacts.push(...additions);
    }
  }

  fillSkills(true);
  fillTraits(true);
  fillSkills(false);
  fillTraits(false);
  // A mixed locked/unlocked pair can still provide the second Darkness point.
  fillTraits(true);

  const chosenTags = goals.map(({ tag }) => tag);
  const combatTags = Array.from(condition.matchAll(taggedSkillCondition), ([, tag]) => tag);
  const skillFocus = [...new Set([...chosenTags, ...combatTags])];
  const useGeneralCombat = combatCondition.test(condition) && !skillFocus.length && !attacks.length;
  const supportingSkills = combatSkills[key] ?? (useGeneralCombat ? generalCombatSkills : []);
  for (const item of rankedSkills.filter((skill) => skill.unlocked)) {
    if (attacks.length === attackSlots) break;
    const tags = tagsOf(item);
    if (tags.includes("버프") || attacks.includes(item)) continue;
    if (skillFocus.some((tag) => tags.includes(tag)) || supportingSkills.includes(item.id)) attacks.push(item);
  }

  const addArtifact = (item) => {
    if (item && artifacts.length < expandedArtifactSlots && !artifacts.includes(item)) artifacts.push(item);
  };
  if (fireOnly) {
    const fireGear = [179, 73, 71, 190, 153, 60, 61, 184, 306, 324, 253, 40, 62];
    const firePicks = fireGear.map((id) => artifactPool.find((item) => item.id === id)).filter(Boolean);
    for (const item of firePicks.toSorted((a, b) => b.unlocked - a.unlocked)) addArtifact(item);
  } else {
    const artifactById = unlockedLoadoutArtifacts(snapshot);
    if (key.startsWith("a")) artifactById.delete(Number(key.slice(1)));
    const tags = new Set(attacks.flatMap(tagsOf));
    const damage = [
      ...skillFocus.flatMap((tag) => fightArtifacts[tag] ?? []),
      ...(tags.has("암흑") || tags.has("출혈") ? [165] : []),
      286, 110, 160, 161, 86, 195, 1, 4,
    ];
    const fallback = recommendLoadout(artifactById, undefined, key);
    for (const item of [...damage.map((id) => artifactById.get(id)), ...fallback]) {
      if (!item || [35, 88, 288].includes(item.id) || item.id in temporaryTraits) continue;
      if ([1, 195].includes(item.id) && !tags.has("메인")) continue;
      if ([4, 29, 30].includes(item.id) && !tags.has("서브")) continue;
      if (goals.length && item.id in artifactTraits && !goals.some(({ tag }) => artifactTraits[item.id][tag])) continue;
      addArtifact(item);
    }
  }

  const skills = [...attacks, ...buffs];
  for (const { tag, target } of goals) {
    if (traitTotal(tag, skills, artifacts, used) >= target || used.some(({ id }) => temporaryTraits[id] === tag)) continue;
    const boostId = Object.keys(temporaryTraits).find((id) =>
      temporaryTraits[id] === tag && artifactPool.some((item) => item.id === Number(id) && item.unlocked));
    if (boostId) used.push(artifactPool.find((item) => item.id === Number(boostId)));
  }
  const unlocked = (list) => list.filter((item) => item.unlocked);
  const synergies = goals.map(({ tag, target }) => ({
    tag, target,
    planned: traitTotal(tag, skills, artifacts, used),
    current: traitTotal(tag, unlocked(skills), unlocked(artifacts), unlocked(used)),
  }));
  if (artifacts.length === expandedArtifactSlots) notes.push("유물 7번째 칸은 마법의 배낭을 획득하면 사용할 수 있어요.");
  if (key === "a331") notes.push("암흑 스킬과 시너지 유물을 모아 보스를 처형할 수 있는 단계까지 올리세요.");
  if (synergies.some(({ planned, target }) => planned < target)) {
    notes.push("부족한 시너지는 같은 속성의 무기·펫이나 판에서 얻는 시너지 효과로 보충하세요.");
  }
  const skillPick = (item) => {
    const tags = tagsOf(item);
    const contributions = goals.filter(({ tag }) => tags.includes(tag)).map(({ tag }) => `${tag} +1`);
    return { item, note: contributions.join(" · ") || tags[0] };
  };
  return {
    label, synergies, notes,
    attacks: attacks.map(skillPick),
    buffs: buffs.map(skillPick),
    artifacts: artifacts.map((item, index) => {
      const note = artifactNote(item, artifacts);
      return { item, note: index < artifactSlots || fireOnly ? note : ["배낭 칸", note].filter(Boolean).join(" · ") };
    }),
    used: used.map((item) => ({
      item, note: `2스테이지 동안 ${temporaryTraits[item.id]} +1${item.id >= 211 ? " · 피격 시 해제" : ""}`,
    })),
  };
}

export function buildUnlockLoadouts(snapshot, key, goal) {
  if (goal.kindLabel) return [];
  const condition = goal.condition;
  const entries = new Map([
    ...snapshot.skills.map((item) => [entryKey(item, "skill"), item]),
    ...snapshot.artifacts.map((item) => [entryKey(item, "artifact"), item]),
  ]);
  const gear = new Set(requiredGear[key] ?? []);
  for (const prerequisite of unlockPrerequisiteKeys(key)) {
    const item = entries.get(prerequisite);
    if (item && condition.includes(item.name) && !condition.includes(`${item.name} 없이`)) gear.add(prerequisite);
  }
  const goals = traitGoals(key, condition);
  if (key === "a375") {
    return [
      selectBuild(snapshot, key, gear, goals.filter(({ tag }) => tag === "화염"), condition, "철혈의 요새"),
      selectBuild(snapshot, key, gear, goals.filter(({ tag }) => tag === "냉기"), condition, "고대 도시 그랑펠"),
    ];
  }
  if (goals.length === 0 && gear.size === 0 && !combatSkills[key] && !combatCondition.test(condition)) return [];
  return [selectBuild(snapshot, key, gear, goals, condition)];
}
