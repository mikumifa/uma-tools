import { Record } from "immutable";
import { SortedSet } from "immutable-sorted";

import skill_meta from "@data/skill_meta.json";

function skillmeta(id: string) {
  // handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
  return skill_meta[id.split("-")[0]];
}

function skillComparator(a, b) {
  const xMeta = skillmeta(a) || {};
  const yMeta = skillmeta(b) || {};

  // 如果没有 order，就认为是 +Infinity，排到最后
  const x = xMeta.order !== undefined ? xMeta.order : Infinity;
  const y = yMeta.order !== undefined ? yMeta.order : Infinity;

  // 先按 order 排，再按 id 排
  return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

export function SkillSet(iterable): SortedSet<keyof typeof skills> {
  return SortedSet(iterable, skillComparator);
}

export class HorseState extends Record({
  outfitId: "",
  speed: 1500,
  stamina: 1200,
  power: 1200,
  guts: 1200,
  wisdom: 1200,
  strategy: "Senkou",
  distanceAptitude: "S",
  surfaceAptitude: "A",
  strategyAptitude: "A",
  skills: SkillSet([]),
}) {}
