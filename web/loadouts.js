const slots = 7;
const generalDamage = [300, 30, 110, 161, 160, 282, 95, 86, 221, 5, 113, 15];

// Artifact IDs come from the bundled game catalog. The save supplies availability.
const physicalSub = [75, 194, 4, 29, 30, 130, 28, 8, 3, 17, 79];
// Rampage has the Darkness, Physical, Targeting and Sub-skill tags. Its repeated
// hits benefit from Silver Coin's flat damage, after spending gold with it equipped.
const rampage = [165, 75, 194, 160, 110, 161, 300, 4, 77, 286, 331, 284, ...physicalSub, 274, 282];
const lightning = [247, 193, 54, 72, 26, 312];
const plasma = [195, 35, 247, 54, 193, 1, 160, 72, 311, 31, 36, 47, 18];
const melee = [277, 254, 75, 147, 110, 161, 141, 130, 8, 85, 17];
const bombs = [237, 134, 357, 30, 195, 1, 31, 160, 16, 130, 8];
const poison = [66, 366, 67, 57, 45, 78, 37];
const flame = [179, 73, 71, 184, 306, 190];
const frost = [158, 68, 39, 168, 110, 129, 160, 63, 69, 114];
const spell = [318, 22, 30, 54, 4, 29, 31, 160, 3];
const chain = [246, 59, 373, 370, 26, 224, 160, 193, 54, 4, 31];
const aim = [77, 84, 4, 30, 160, 110, 31, 28];
const divinity = [288, 262, 261, 33, 34, 22, 163, 30, 110, 313];
const darkness = [287, 165, 331, 278, 261, 110, 160, 274, 314, ...physicalSub];
const bleed = [27, 165, 9, 320, 147, 110, 7, 160];
const summoning = [166, 270, 327, 162, 160, 161, 249, 131, 251];

const routes = {
  dice: { equip: [29, 30], picks: rampage },
  plasma: { picks: plasma },
  melee: { picks: melee },
  bomber: { picks: bombs },
  lightning: { picks: [...lightning, 31, 4, 1] },
  poison: { picks: poison },
  flame: { picks: [...flame, 4, 31, 22] },
  frost: { picks: frost },
  spell: { picks: spell },
  short: { picks: [...lightning, 22, 4] },
  chain: { picks: chain },
  desert: { picks: bombs },
  grandfel: { picks: [...poison, 4, 31] },
  divinity: { picks: divinity },
  mods: { picks: [...lightning, 22, 31, 4, 25] },
  benedict: { picks: bombs },
  gunner: { picks: rampage },
  "other-characters": { picks: [195, 1, ...physicalSub] },
};

const goals = {
  s5: { picks: [95, 221, 274, 110, 8, 4, 29] },
  a77: { picks: [22, ...aim, 29] },
  a84: { picks: [...aim, ...poison] },
  s70: { equip: [134] },
  a357: { equip: [134] },
  s102: { equip: [357] },
  s27: { equip: [46] },
  a73: { picks: [...lightning, ...flame, 22, 4] },
  s59: { equip: [179] },
  s35: { picks: [83, ...flame, 22, 4] },
  s30: { picks: [39, ...frost] },
  s34: { equip: [43] },
  a168: { equip: [43] },
  a169: { equip: [168] },
  a125: { picks: [124, ...frost] },
  s36: { picks: [125, ...frost] },
  a219: { picks: [157, 89, 86, 4, 54] },
  a59: { picks: [77, 8, 4, 28, 29, 78] },
  a131: { picks: summoning },
  a200: { picks: [110, 314, 274, 291, 86] },
  a311: { equip: [6], picks: [195, 1, 19, 31, 8] },
  s99: { picks: [59, 33, ...chain] },
  s81: { picks: [...bleed, ...physicalSub] },
  s82: { picks: plasma },
  s83: { equip: [33], picks: divinity },
  s100: { picks: frost },
  a288: { picks: divinity },
  s104: { picks: [...flame, 253, 60, 61, 40], fireOnly: true },
  a358: { picks: [143, 290, 291, 154, 110, 6] },
  a368: { equip: [358, 359, 362, 366] },
  a363: { picks: aim },
  s101: { equip: [55], picks: [...flame, 31, 4, 22] },
  a372: { equip: [34, 88, 261], picks: [288, 262, 33, 22, 313] },
  a34: { picks: [287, 262, 33, 261, 165, 22] },
  a300: { picks: [287, 262, 33, 261, 165, 22] },
  a331: { picks: darkness },
  a286: { picks: [361, 86, 25, ...physicalSub] },
  a304: { picks: darkness },
  a242: { picks: [220, 361, 86, 25, 31, 4] },
  a187: { picks: [220, ...lightning, 31, 4] },
  a194: { picks: [220, ...lightning, 31, 4] },
  s92: { picks: bleed },
  s93: { picks: frost },
  s94: { picks: darkness },
  s95: { picks: poison },
  s96: { picks: [...flame, 31, 4] },
  s97: { picks: divinity },
  s98: { picks: [...lightning, 31, 4, 1] },
  a278: { picks: darkness },
  s45: { picks: [...flame, ...melee] },
  s48: { picks: [...bleed, ...melee] },
  s49: { picks: [...flame, ...spell] },
  s74: { picks: darkness },
  s76: { picks: [...frost, ...melee] },
  s77: { picks: [...lightning, ...spell] },
  s78: { picks: [...flame, ...spell] },
  s79: { picks: summoning },
  a166: { picks: summoning },
  a208: { picks: [...bleed, ...melee] },
};

export function unlockedLoadoutArtifacts(snapshot) {
  return new Map(snapshot.artifacts
    .filter(({ unlocked, kindLabel }) => unlocked && !kindLabel)
    .map((item) => [item.id, item]));
}

export function recommendLoadout(artifacts, route, goal) {
  const build = { ...routes[route], ...goals[goal] };
  const selected = new Set();
  const take = (ids, remaining) => {
    const items = [];
    for (const id of ids) {
      if (items.length >= remaining) break;
      const item = artifacts.get(id);
      if (!item || selected.has(id)) continue;
      selected.add(id);
      items.push(item);
    }
    return items;
  };

  // This goal requires seven fire-tagged artifacts to be equipped together.
  if (build.fireOnly) return take(build.picks, slots);

  const required = take(build.equip ?? [], slots);
  return [...required, ...take([...(build.picks ?? []), ...generalDamage], slots - required.length)];
}
