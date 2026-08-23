import { Fragment, h, type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import successionData from "@data/succession_data.json";

import "./SuccessionPlanner.css";

type AptitudeKey =
  | "turf"
  | "dirt"
  | "short"
  | "mile"
  | "middle"
  | "long"
  | "nige"
  | "senko"
  | "sashi"
  | "oikomi";
type FactorKey = AptitudeKey;
type InheritanceTargets = Partial<Record<FactorKey, number>>;
type AptitudeMinimums = Record<AptitudeKey, number>;
type RouteMinimums = Record<BranchKey, AptitudeMinimums>;
type SlotRouteSetting = {
  routeId: string;
  minimums: AptitudeMinimums;
};
type SlotRouteOverrides = Partial<Record<LineageSlot, SlotRouteSetting>>;
type BranchKey = "paternal" | "maternal";
type LineageSlot =
  | "father"
  | "mother"
  | "paternalA"
  | "paternalB"
  | "maternalA"
  | "maternalB";

type SuccessionUma = {
  id: number;
  name: string;
  icon?: string | null;
  aptitudes: Record<AptitudeKey, number>;
  relationTypes: number[];
};

type SuccessionData = {
  relationPoints: Record<string, number>;
  umas: SuccessionUma[];
};

type Route = {
  id: string;
  name: string;
  shortName: string;
  g1Count: number;
  aptitudes: FactorKey[];
};

type PositionCompatibilityScore = {
  base: number;
  g1Count: number;
  total: number;
  ownTotal?: number;
  inheritedTotal?: number;
  coParentLabel?: string;
  coParentName?: string;
  coParentBase?: number;
  coParentTotal?: number;
  relationNames?: string[];
  ancestorDetails?: Array<{
    label: string;
    umaName?: string;
    base: number;
    g1Count: number;
    total: number;
  }>;
};

type PositionFactorRequirement = {
  type: FactorKey;
  base: number;
  target: number;
  stars: number | null;
};

type FactorAssignment = {
  type: FactorKey;
  stars: 1 | 2 | 3;
  free?: boolean;
  unconstrained?: boolean;
};
type TrainedLineageMember = {
  umaId: number;
  factor: Pick<FactorAssignment, "type" | "stars">;
  routeId: string;
};
type TrainedUmaSetting = {
  self: TrainedLineageMember;
  parents: [TrainedLineageMember, TrainedLineageMember];
};
type TrainedUmaSettings = Partial<Record<LineageSlot, TrainedUmaSetting>>;

type TargetFactorPlan = {
  assignments: Record<LineageSlot, FactorAssignment>;
};

type TargetFactorPlanEnumerator = {
  total: number;
  getRange: (offset: number, limit: number) => TargetFactorPlan[];
};

type CompleteDesignPosition = {
  code: string;
  generation: 1 | 2 | 3 | 4;
  uma?: SuccessionUma;
  factor: FactorAssignment;
  compatibility?: number;
  compatibilityTitle?: string;
  minimumDemand?: FactorDemand;
  cumulativeDemand?: FactorDemand;
  fixed: boolean;
  requiresUma: boolean;
  inRaceFactorJump?: {
    type: FactorKey;
    fromRank: number;
    toRank: number;
  };
  alternatives?: CompleteDesignPosition[];
  alternativeCount?: number;
};

type CompleteFactorDesign = {
  positions: CompleteDesignPosition[];
  cumulativeRequirements: Array<{
    code: string;
    demand: FactorDemand;
  }>;
  issues: string[];
};

type OptimalCompleteDesignResult = {
  results: Array<{
    probability: number;
    plan: TargetFactorPlan;
    design: CompleteFactorDesign;
  }>;
  truncated: boolean;
  bestMatchCount: number;
};

type CompletedCalculation = {
  inputKey: string;
  result: OptimalCompleteDesignResult | null;
};

type BranchFactorStrategy = {
  positions: CompleteDesignPosition[];
  cumulativeRequirements: CompleteFactorDesign["cumulativeRequirements"];
  greatFactorRequirements: {
    parent: FactorDemand;
    grandparents: [FactorDemand, FactorDemand];
  };
};

const data = successionData as SuccessionData;
const EMPTY_TARGET_FACTOR_PLAN_ENUMERATOR: TargetFactorPlanEnumerator = {
  total: 0,
  getRange: () => [],
};
const MIN_DISPLAYED_PROBABILITY = 0.00005;
const APTITUDE_LABELS: Record<AptitudeKey, string> = {
  turf: "草地",
  dirt: "泥地",
  short: "短距离",
  mile: "英里",
  middle: "中距离",
  long: "长距离",
  nige: "领跑",
  senko: "前列",
  sashi: "居中",
  oikomi: "后追",
};
const APTITUDE_SHORT_LABELS: Record<AptitudeKey, string> = {
  turf: "草",
  dirt: "泥",
  short: "短",
  mile: "英",
  middle: "中",
  long: "长",
  nige: "领",
  senko: "前",
  sashi: "居",
  oikomi: "后",
};
const FACTOR_ICON_PATHS: Record<AptitudeKey, string> = {
  turf: "succession/aptitude/turf.png",
  dirt: "succession/aptitude/dirt.png",
  short: "succession/aptitude/short.png",
  mile: "succession/aptitude/mile.png",
  middle: "succession/aptitude/middle.png",
  long: "succession/aptitude/long.png",
  nige: "succession/aptitude/front.png",
  senko: "succession/aptitude/pace.png",
  sashi: "succession/aptitude/late.png",
  oikomi: "succession/aptitude/end.png",
};
const RANK_ICON_PATHS: Record<string, string> = {
  S: "succession/rank/s.png",
  A: "succession/rank/a.png",
  B: "succession/rank/b.png",
  C: "succession/rank/c.png",
  D: "succession/rank/d.png",
  E: "succession/rank/e.png",
  F: "succession/rank/f.png",
  G: "succession/rank/g.png",
};
const APTITUDE_GROUPS: Array<{
  label: string;
  types: AptitudeKey[];
}> = [
  { label: "场地", types: ["turf", "dirt"] },
  { label: "距离", types: ["short", "mile", "middle", "long"] },
  { label: "跑法", types: ["nige", "senko", "sashi", "oikomi"] },
];
const ALL_APTITUDES: AptitudeKey[] = [
  "turf",
  "dirt",
  "short",
  "mile",
  "middle",
  "long",
  "nige",
  "senko",
  "sashi",
  "oikomi",
];
const FACTOR_STEPS = [0, 1, 4, 7, 10];
const RANKS = ["-", "G", "F", "E", "D", "C", "B", "A", "S"];
const BRANCH_SLOTS: Record<BranchKey, LineageSlot[]> = {
  paternal: ["father", "paternalA", "paternalB"],
  maternal: ["mother", "maternalA", "maternalB"],
};
const SLOT_LABELS: Record<LineageSlot, string> = {
  father: "父亲 A",
  mother: "母亲 B",
  paternalA: "祖代 AA",
  paternalB: "祖代 AB",
  maternalA: "祖代 BA",
  maternalB: "祖代 BB",
};
const SLOT_SOURCE_LABELS: Record<LineageSlot, string> = {
  father: "祖代 AA / AB",
  mother: "祖代 BA / BB",
  paternalA: "曾祖代 AAA / AAB",
  paternalB: "曾祖代 ABA / ABB",
  maternalA: "曾祖代 BAA / BAB",
  maternalB: "曾祖代 BBA / BBB",
};
const SLOT_UPSTREAM_SLOTS: Partial<Record<LineageSlot, LineageSlot[]>> = {
  father: ["paternalA", "paternalB"],
  mother: ["maternalA", "maternalB"],
};
const ROUTES: Route[] = [
  {
    id: "mile-middle-dirt",
    name: "英中长泥",
    shortName: "英中长泥",
    g1Count: 23,
    aptitudes: ["turf", "mile", "middle", "long", "dirt"],
  },
  {
    id: "short-mile-middle-dirt",
    name: "英中长泥",
    shortName: "短英中泥",
    g1Count: 22,
    aptitudes: ["turf", "short", "mile", "middle", "dirt"],
  },
  {
    id: "none",
    name: "暂不规划历战",
    shortName: "无赛程",
    g1Count: 0,
    aptitudes: [],
  },
];
const G1_COMPATIBILITY_POINTS = 3;
const DIFFERENT_ROUTE_COMMON_G1 = 16;
const RED_FACTOR_BASE_PROBABILITY: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.03,
  3: 0.05,
};

const INITIAL_LINEAGE: Record<LineageSlot, number> = {
  father: 0,
  mother: 0,
  paternalA: 0,
  paternalB: 0,
  maternalA: 0,
  maternalB: 0,
};
const INITIAL_ROUTES: Record<BranchKey, string> = {
  paternal: "mile-middle-dirt",
  maternal: "short-mile-middle-dirt",
};
const DEFAULT_APTITUDE_MINIMUMS: AptitudeMinimums = {
  turf: 6,
  dirt: 6,
  short: 6,
  mile: 6,
  middle: 6,
  long: 6,
  nige: 6,
  senko: 6,
  sashi: 6,
  oikomi: 6,
};
const INITIAL_ROUTE_MINIMUMS: RouteMinimums = {
  paternal: { ...DEFAULT_APTITUDE_MINIMUMS },
  maternal: { ...DEFAULT_APTITUDE_MINIMUMS },
};
const INITIAL_INHERITANCE_APTITUDES: FactorKey[] = [];
const INITIAL_INHERITANCE_TARGETS: InheritanceTargets = {};
const MAX_INHERITANCE_SLOTS = 6;
const TARGET_FACTOR_SLOTS: LineageSlot[] = [
  "father",
  "mother",
  "paternalA",
  "paternalB",
  "maternalA",
  "maternalB",
];
const SLOT_CODES: Record<LineageSlot, string> = {
  father: "A",
  mother: "B",
  paternalA: "AA",
  paternalB: "AB",
  maternalA: "BA",
  maternalB: "BB",
};
const COMPLETE_GENERATION_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "亲代",
  2: "祖代",
  3: "曾祖代",
  4: "曾曾祖代（高祖代）",
};
const MAX_EQUAL_CANDIDATES = 12;
const MAX_EQUAL_MATCH_GROUPS = 48;
const CALCULATION_PHASES = [
  "读取并校验计算条件",
  "构建红因子分配方案",
  "枚举种马路线、计算概率",
  "整理最高概率结果",
] as const;
const SUCCESSION_STORAGE_KEY = "uma-tools:succession-planner:v1";

type ProbabilityFactor = {
  type: FactorKey;
  stars: 1 | 2 | 3;
  compatibility: number;
};

function redFactorInheritanceProbability(
  stars: 1 | 2 | 3,
  compatibility: number,
) {
  return Math.min(
    1,
    RED_FACTOR_BASE_PROBABILITY[stars] * (1 + compatibility / 100),
  );
}

function probabilityOfReachingTargets(
  factors: ProbabilityFactor[],
  targetTypes: FactorKey[],
  requiredRaises: Partial<Record<FactorKey, number>>,
) {
  const activeTypes = targetTypes.filter(
    (type) => (requiredRaises[type] || 0) > 0,
  );
  if (!activeTypes.length) return 1;
  return activeTypes.reduce((jointProbability, type) => {
    const limit = requiredRaises[type] || 0;
    let states = Array.from({ length: limit + 1 }, (_, index) =>
      index === 0 ? 1 : 0,
    );
    factors
      .filter((factor) => factor.type === type)
      .forEach((factor) => {
        const probability = redFactorInheritanceProbability(
          factor.stars,
          factor.compatibility,
        );
        for (let inheritance = 0; inheritance < 2; inheritance += 1) {
          const nextStates = Array.from({ length: limit + 1 }, () => 0);
          states.forEach((stateProbability, count) => {
            nextStates[count] += stateProbability * (1 - probability);
            nextStates[Math.min(limit, count + 1)] +=
              stateProbability * probability;
          });
          states = nextStates;
        }
      });
    return jointProbability * states[limit];
  }, 1);
}

type StoredSuccessionSettings = {
  targetId: number;
  lineage: Record<LineageSlot, number>;
  routes: Record<BranchKey, string>;
  routeMinimums: RouteMinimums;
  inheritanceAptitudes: FactorKey[];
  inheritanceTargets: InheritanceTargets;
  allowInRaceFactorJump: boolean;
  inRaceFactorJumpMinimumRank: number;
  excludedUmaIds: number[];
  slotRouteOverrides: SlotRouteOverrides;
  trainedUmaSettings: TrainedUmaSettings;
};

function loadStoredSuccessionSettings(): StoredSuccessionSettings {
  const fallback = {
    targetId: 0,
    lineage: { ...INITIAL_LINEAGE },
    routes: { ...INITIAL_ROUTES },
    routeMinimums: {
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    },
    inheritanceAptitudes: [...INITIAL_INHERITANCE_APTITUDES],
    inheritanceTargets: { ...INITIAL_INHERITANCE_TARGETS },
    allowInRaceFactorJump: false,
    inRaceFactorJumpMinimumRank: 6,
    excludedUmaIds: [],
    slotRouteOverrides: {},
    trainedUmaSettings: {},
  };
  if (typeof localStorage === "undefined") return fallback;

  try {
    const stored = JSON.parse(
      localStorage.getItem(SUCCESSION_STORAGE_KEY) || "null",
    );
    if (!stored || typeof stored !== "object") return fallback;

    const umaIds = new Set(data.umas.map((uma) => uma.id));
    const validAptitudes = new Set<FactorKey>(ALL_APTITUDES);
    const excludedUmaIds = [
      ...new Set(
        (Array.isArray(stored.excludedUmaIds) ? stored.excludedUmaIds : [])
          .map(Number)
          .filter((id) => umaIds.has(id)),
      ),
    ];
    const storedTargetId = Number(stored.targetId);
    const targetId = umaIds.has(storedTargetId) ? storedTargetId : 0;
    const lineage = { ...INITIAL_LINEAGE };
    (Object.keys(lineage) as LineageSlot[]).forEach((slot) => {
      const value = Number(stored.lineage?.[slot]);
      lineage[slot] = umaIds.has(value) ? value : 0;
    });

    const routes = { ...INITIAL_ROUTES };
    (Object.keys(routes) as BranchKey[]).forEach((branch) => {
      const value = stored.routes?.[branch];
      if (ROUTES.some((route) => route.id === value)) routes[branch] = value;
    });

    const routeMinimums: RouteMinimums = {
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    };
    (Object.keys(routeMinimums) as BranchKey[]).forEach((branch) => {
      const storedMinimums = stored.routeMinimums?.[branch];
      if (typeof storedMinimums === "number") {
        if ([4, 5, 6, 7].includes(storedMinimums)) {
          ALL_APTITUDES.forEach((type) => {
            routeMinimums[branch][type] = storedMinimums;
          });
        }
        return;
      }
      ALL_APTITUDES.forEach((type) => {
        const value = Number(storedMinimums?.[type]);
        if ([4, 5, 6, 7].includes(value)) {
          routeMinimums[branch][type] = value;
        }
      });
    });

    const slotRouteOverrides: SlotRouteOverrides = {};
    (Object.keys(INITIAL_LINEAGE) as LineageSlot[]).forEach((slot) => {
      const storedOverride = stored.slotRouteOverrides?.[slot];
      if (
        !storedOverride ||
        !ROUTES.some((route) => route.id === storedOverride.routeId)
      ) {
        return;
      }
      const minimums = { ...DEFAULT_APTITUDE_MINIMUMS };
      ALL_APTITUDES.forEach((type) => {
        const value = Number(storedOverride.minimums?.[type]);
        if ([4, 5, 6, 7].includes(value)) minimums[type] = value;
      });
      slotRouteOverrides[slot] = {
        routeId: storedOverride.routeId,
        minimums,
      };
    });

    const trainedUmaSettings: TrainedUmaSettings = {};
    const parseTrainedMember = (value: any): TrainedLineageMember | null => {
      const umaId = Number(value?.umaId);
      const type = value?.factor?.type;
      const stars = Number(value?.factor?.stars);
      const routeId = value?.routeId;
      if (
        !umaIds.has(umaId) ||
        !validAptitudes.has(type) ||
        (stars !== 1 && stars !== 2 && stars !== 3) ||
        !ROUTES.some((route) => route.id === routeId)
      ) {
        return null;
      }
      return {
        umaId,
        factor: { type, stars: stars as 1 | 2 | 3 },
        routeId,
      };
    };
    (Object.keys(INITIAL_LINEAGE) as LineageSlot[]).forEach((slot) => {
      const storedSetting = stored.trainedUmaSettings?.[slot];
      const self = parseTrainedMember(storedSetting?.self);
      const firstParent = parseTrainedMember(storedSetting?.parents?.[0]);
      const secondParent = parseTrainedMember(storedSetting?.parents?.[1]);
      if (!self || !firstParent || !secondParent) return;
      if (new Set([self.umaId, firstParent.umaId, secondParent.umaId]).size < 3) {
        return;
      }
      trainedUmaSettings[slot] = {
        self,
        parents: [firstParent, secondParent],
      };
    });

    const targetUma = data.umas.find((uma) => uma.id === targetId);
    const inheritanceTargets: InheritanceTargets = {};
    ALL_APTITUDES.forEach((type) => {
      const base = targetUma?.aptitudes[type];
      const value = Number(stored.inheritanceTargets?.[type]);
      if (
        base &&
        Number.isInteger(value) &&
        value > base &&
        value <= Math.min(7, base + FACTOR_STEPS.length - 1)
      ) {
        inheritanceTargets[type] = value;
      }
    });

    const storedInheritanceValues = Array.isArray(stored.inheritanceAptitudes)
      ? stored.inheritanceAptitudes
      : [
          ...(stored.inheritanceAptitudes?.paternal || []),
          ...(stored.inheritanceAptitudes?.maternal || []),
        ];
    const validValues = [
      ...new Set(
        storedInheritanceValues.filter((value): value is FactorKey =>
          validAptitudes.has(value),
        ),
      ),
    ];
    const inheritanceAptitudes = ALL_APTITUDES.filter(
      (type) =>
        validValues.includes(type) ||
        Object.prototype.hasOwnProperty.call(
          stored.inheritanceTargets || {},
          type,
        ),
    );
    const storedRunningStyleStars = Number(
      typeof stored.runningStyleStars === "object"
        ? (stored.runningStyleStars?.paternal ??
            stored.runningStyleStars?.maternal)
        : stored.runningStyleStars,
    );
    const runningStyleStars = [1, 4, 7, 10].includes(storedRunningStyleStars)
      ? storedRunningStyleStars
      : 1;
    const allowInRaceFactorJump = stored.allowInRaceFactorJump === true;
    const storedJumpMinimumRank = Number(stored.inRaceFactorJumpMinimumRank);
    const inRaceFactorJumpMinimumRank = [3, 4, 5, 6].includes(
      storedJumpMinimumRank,
    )
      ? storedJumpMinimumRank
      : 6;
    if (targetUma) {
      inheritanceAptitudes.forEach((type) => {
        const base = targetUma.aptitudes[type];
        if (base >= 7 || inheritanceTargets[type]) return;
        const stars =
          type === "nige" ||
          type === "senko" ||
          type === "sashi" ||
          type === "oikomi"
            ? runningStyleStars
            : 1;
        inheritanceTargets[type] = Math.min(
          7,
          base + Math.max(0, FACTOR_STEPS.indexOf(stars)),
        );
      });
    }

    return {
      targetId,
      lineage,
      routes,
      routeMinimums,
      inheritanceAptitudes,
      inheritanceTargets,
      allowInRaceFactorJump,
      inRaceFactorJumpMinimumRank,
      excludedUmaIds,
      slotRouteOverrides,
      trainedUmaSettings,
    };
  } catch {
    return fallback;
  }
}

function appBasePath() {
  if (typeof window === "undefined") return import.meta.env.BASE_URL;
  const pathname = window.location.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/succession")) {
    return `${pathname.slice(0, -"/succession".length)}/`;
  }
  return new URL(import.meta.env.BASE_URL, window.location.href).pathname;
}

function assetUrl(path?: string | null) {
  if (!path) return "";
  return `${appBasePath()}${path.replace(/^\/+/, "")}`;
}

function rankLabel(value: number) {
  return RANKS[Math.max(0, Math.min(8, value))] || "-";
}

function minimumStarsForRank(base: number, target: number) {
  const raises = Math.max(0, target - base);
  if (!raises) return 0;
  return FACTOR_STEPS[raises] ?? null;
}

function maximumInheritedRank(base: number) {
  return Math.min(7, base + FACTOR_STEPS.length - 1);
}

function minimumRouteRank(base: number) {
  return Math.min(7, Math.max(4, base));
}

function routeMinimumSlotCount(
  uma: SuccessionUma,
  route: Route,
  minimums: AptitudeMinimums,
) {
  return route.aptitudes.reduce((total, type) => {
    const stars = minimumStarsForRank(uma.aptitudes[type], minimums[type]);
    return (
      total +
      (stars === null ? MAX_INHERITANCE_SLOTS + 1 : factorSlotsForStars(stars))
    );
  }, 0);
}

function fitMinimumsForUma(
  minimums: AptitudeMinimums,
  uma: SuccessionUma,
  route: Route,
): AptitudeMinimums {
  const fitted = Object.fromEntries(
    ALL_APTITUDES.map((type) => [
      type,
      Math.max(
        minimumRouteRank(uma.aptitudes[type]),
        Math.min(minimums[type], maximumInheritedRank(uma.aptitudes[type])),
      ),
    ]),
  ) as AptitudeMinimums;

  while (routeMinimumSlotCount(uma, route, fitted) > MAX_INHERITANCE_SLOTS) {
    const reduction = route.aptitudes
      .map((type, index) => {
        if (fitted[type] <= 4) return null;
        const currentStars = minimumStarsForRank(
          uma.aptitudes[type],
          fitted[type],
        );
        const reducedStars = minimumStarsForRank(
          uma.aptitudes[type],
          fitted[type] - 1,
        );
        if (currentStars === null || reducedStars === null) return null;
        const savedSlots =
          factorSlotsForStars(currentStars) - factorSlotsForStars(reducedStars);
        return savedSlots > 0
          ? { type, savedSlots, base: uma.aptitudes[type], index }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          type: AptitudeKey;
          savedSlots: number;
          base: number;
          index: number;
        } => Boolean(item),
      )
      .sort(
        (a, b) =>
          b.savedSlots - a.savedSlots || b.base - a.base || b.index - a.index,
      )[0];
    if (!reduction) break;
    fitted[reduction.type] -= 1;
  }

  return fitted;
}

function factorSlotsForStars(stars: number) {
  return stars > 0 ? Math.ceil(stars / 3) : 0;
}

function factorAssignmentKey(assignment: FactorAssignment) {
  return [
    assignment.type,
    assignment.stars,
    assignment.free ? "free" : "required",
    assignment.unconstrained ? "unconstrained" : "typed",
  ].join(":");
}

function effectiveFactorRoleKey(assignment: FactorAssignment) {
  return assignment.unconstrained
    ? `free:${assignment.stars}`
    : `${assignment.type}:${assignment.stars}`;
}

function inheritanceAllocation(
  target: SuccessionUma,
  selected: FactorKey[],
  targets: InheritanceTargets,
) {
  return selected.map((type) => {
    const base = target.aptitudes[type];
    const targetRank =
      base >= 7 ? base : Math.max(base + 1, targets[type] || base + 1);
    const stars = base >= 7 ? 1 : minimumStarsForRank(base, targetRank) || 1;
    return {
      type,
      base,
      target: targetRank,
      stars,
      slots: factorSlotsForStars(stars),
    };
  });
}

function createTargetFactorPlanEnumerator(
  selected: FactorKey[],
  minimumStars: Partial<Record<FactorKey, number>>,
): TargetFactorPlanEnumerator {
  if (!selected.length) {
    const plan: TargetFactorPlan = {
      assignments: Object.fromEntries(
        TARGET_FACTOR_SLOTS.map((slot) => [
          slot,
          {
            type: "turf" as const,
            stars: 3 as const,
            free: true,
            unconstrained: true,
          },
        ]),
      ) as Record<LineageSlot, FactorAssignment>,
    };
    return {
      total: 1,
      getRange: (offset, limit) => (offset === 0 && limit > 0 ? [plan] : []),
    };
  }

  const requiredTokenGroups: FactorAssignment[][] = [
    selected.flatMap((type) =>
      Array.from(
        { length: factorSlotsForStars(minimumStars[type] || 1) },
        () => ({ type, stars: 3 as const, free: false }),
      ),
    ),
  ];

  const requiredSlots = requiredTokenGroups[0]?.length || 0;
  const freeSlots = Math.max(0, MAX_INHERITANCE_SLOTS - requiredSlots);
  const freeTokens: FactorAssignment[] = Array.from(
    { length: freeSlots },
    () => ({ type: selected[0], stars: 3, free: true }),
  );

  const plans: TargetFactorPlan[] = [];
  const seenPlans = new Set<string>();
  const assignmentOrderKey = (assignment: FactorAssignment) =>
    assignment.free
      ? `1:free:${assignment.stars}`
      : `0:${String(ALL_APTITUDES.indexOf(assignment.type)).padStart(
          2,
          "0",
        )}:${assignment.stars}`;
  const appendUniquePermutations = (tokens: FactorAssignment[]) => {
    const tokenCounts = new Map<
      string,
      { token: FactorAssignment; count: number }
    >();
    tokens.forEach((token) => {
      const key = token.free
        ? `free:${token.stars}`
        : `${token.type}:${token.stars}:required`;
      const current = tokenCounts.get(key);
      if (current) current.count += 1;
      else tokenCounts.set(key, { token, count: 1 });
    });
    const entries = [...tokenCounts.values()];
    const permutation: FactorAssignment[] = [];
    const visit = () => {
      if (permutation.length === TARGET_FACTOR_SLOTS.length) {
        const key = permutation
          .map((assignment) =>
            assignment.free
              ? `free:${assignment.stars}`
              : `${assignment.type}:${assignment.stars}:required`,
          )
          .join("|");
        if (seenPlans.has(key)) return;
        seenPlans.add(key);
        plans.push({
          assignments: Object.fromEntries(
            TARGET_FACTOR_SLOTS.map((slot, index) => [
              slot,
              permutation[index],
            ]),
          ) as Record<LineageSlot, FactorAssignment>,
        });
        return;
      }
      entries.forEach((entry) => {
        if (!entry.count) return;
        const position = permutation.length;
        const isSecondInUnorderedPair = position === 3 || position === 5;
        if (
          isSecondInUnorderedPair &&
          assignmentOrderKey(permutation[position - 1]) >
            assignmentOrderKey(entry.token)
        ) {
          return;
        }
        entry.count -= 1;
        permutation.push(entry.token);
        visit();
        permutation.pop();
        entry.count += 1;
      });
    };
    visit();
  };

  requiredTokenGroups.forEach((requiredTokens) => {
    appendUniquePermutations([...requiredTokens, ...freeTokens]);
  });

  return {
    total: plans.length,
    getRange: (offset, limit) => plans.slice(offset, offset + limit),
  };
}

type FactorDemand = Partial<Record<FactorKey, number>>;

function factorDemandForUma(
  uma: SuccessionUma,
  route: Route,
  minimums: AptitudeMinimums,
  producedType?: FactorKey,
  factorProductionMinimumRank = 7,
) {
  const demand: FactorDemand = {};
  const impossible: FactorKey[] = [];
  const types = [
    ...new Set([...route.aptitudes, ...(producedType ? [producedType] : [])]),
  ];
  types.forEach((type) => {
    const targetRank = Math.max(
      route.aptitudes.includes(type) ? minimums[type] : 0,
      type === producedType ? factorProductionMinimumRank : 0,
    );
    const stars = minimumStarsForRank(uma.aptitudes[type], targetRank);
    if (
      type === producedType &&
      targetRank < 7 &&
      uma.aptitudes[type] < 7 &&
      stars === 0
    ) {
      // 没有对应红因子时不存在局内继续提升到 A 的触发来源。
      impossible.push(type);
      return;
    }
    if (stars === null) impossible.push(type);
    else if (stars > 0) demand[type] = stars;
  });
  return { demand, impossible };
}

function remainingFactorDemand(
  demand: FactorDemand,
  assignments: Array<{
    type: FactorKey;
    stars: number;
    unconstrained?: boolean;
  }>,
): FactorDemand {
  const remaining: FactorDemand = {};
  ALL_APTITUDES.forEach((type) => {
    const contribution = assignments.reduce(
      (total, assignment) =>
        total +
        (!assignment.unconstrained && assignment.type === type
          ? assignment.stars
          : 0),
      0,
    );
    const value = Math.max(0, (demand[type] || 0) - contribution);
    if (value > 0) remaining[type] = value;
  });
  return remaining;
}

function demandSlotCount(demand: FactorDemand) {
  return ALL_APTITUDES.reduce(
    (total, type) => total + factorSlotsForStars(demand[type] || 0),
    0,
  );
}

function demandSatisfied(
  demand: FactorDemand,
  assignments: Array<{
    type: FactorKey;
    stars: number;
    unconstrained?: boolean;
  }>,
) {
  return ALL_APTITUDES.every((type) => {
    const supplied = assignments.reduce(
      (total, assignment) =>
        total +
        (!assignment.unconstrained && assignment.type === type
          ? assignment.stars
          : 0),
      0,
    );
    return supplied >= (demand[type] || 0);
  });
}

function FactorIcon({
  type,
  compact = false,
}: {
  type: AptitudeKey;
  compact?: boolean;
}) {
  return (
    <img
      class={`successionFactorIcon ${compact ? "compact" : ""}`}
      src={assetUrl(FACTOR_ICON_PATHS[type])}
      alt={`${APTITUDE_LABELS[type]}因子`}
    />
  );
}

function RankIcon({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const rank = rankLabel(value);
  const path = RANK_ICON_PATHS[rank];
  return path ? (
    <img
      class={`successionRankIcon ${compact ? "compact" : ""}`}
      src={assetUrl(path)}
      alt={rank}
    />
  ) : (
    <strong class="successionRankFallback">{rank}</strong>
  );
}

function UmaPortrait({
  uma,
  large = false,
}: {
  uma?: SuccessionUma;
  large?: boolean;
}) {
  if (!uma) {
    return (
      <span class={`successionPortrait empty ${large ? "large" : ""}`}>?</span>
    );
  }
  return uma.icon ? (
    <img
      class={`successionPortrait ${large ? "large" : ""}`}
      src={assetUrl(uma.icon)}
      alt=""
      loading="lazy"
    />
  ) : (
    <span class={`successionPortrait fallback ${large ? "large" : ""}`}>
      {uma.name.slice(0, 1)}
    </span>
  );
}

function UmaAptitudeRows({
  uma,
  picker = false,
}: {
  uma: SuccessionUma;
  picker?: boolean;
}) {
  return (
    <div class={`successionAptitudeRows ${picker ? "picker" : "compact"}`}>
      {APTITUDE_GROUPS.map((group) => (
        <div
          class="successionAptitudeRow"
          aria-label={group.label}
          key={group.label}
        >
          <div>
            {group.types.map((type) => (
              <span key={type} title={APTITUDE_LABELS[type]}>
                <small>{APTITUDE_SHORT_LABELS[type]}</small>
                <RankIcon value={uma.aptitudes[type]} compact />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function compatibilityTitle(compatibility: PositionCompatibilityScore) {
  if (compatibility.inheritedTotal === undefined) {
    const relationNames = compatibility.relationNames || [];
    const relationLabel = relationNames.join("、");
    const umaName = relationNames[relationNames.length - 1] || "当前马娘";
    const childName = relationNames[relationNames.length - 2] || "子代";
    const victoryCompatibility =
      compatibility.g1Count * G1_COMPATIBILITY_POINTS;
    return [
      `自身相性：${relationLabel}基础相性 ${compatibility.base}`,
      `胜鞍相性：${umaName}与子代${childName}共同 G1 ${compatibility.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${victoryCompatibility}`,
      `总计：${compatibility.base} + ${victoryCompatibility} = ${compatibility.total}`,
    ].join("\n");
  }

  const ancestorDetails = (compatibility.ancestorDetails || []).filter(
    (detail) => detail.umaName,
  );
  const targetName = compatibility.relationNames?.[0] || "目标马娘";
  const umaName = compatibility.relationNames?.[1] || "当前亲代";
  const victoryDetails = ancestorDetails.map((detail) => ({
    ...detail,
    points: detail.g1Count * G1_COMPATIBILITY_POINTS,
  }));
  const victoryCompatibility = victoryDetails.reduce(
    (total, detail) => total + detail.points,
    0,
  );
  const totalParts = [compatibility.ownTotal || 0];
  if (compatibility.coParentName) {
    totalParts.push(compatibility.coParentTotal || 0);
  }
  if (ancestorDetails.length) {
    totalParts.push(compatibility.inheritedTotal || 0);
  }
  return [
    `自身基础相性：与${targetName} ${compatibility.base}`,
    ...victoryDetails.map(
      (detail) =>
        `胜鞍相性：${detail.label} ${detail.umaName || ""}与子代${umaName}共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${detail.points}`,
    ),
    ...(victoryDetails.length > 1
      ? [
          `胜鞍小计：${victoryDetails.map((detail) => detail.points).join(" + ")} = ${victoryCompatibility}`,
        ]
      : []),
    `自身小计：${compatibility.base} + ${victoryCompatibility} = ${compatibility.ownTotal || 0}`,
    ...(compatibility.coParentName
      ? [
          `亲代相性：与${compatibility.coParentLabel || "另一亲代"} ${compatibility.coParentName} ${compatibility.coParentBase || 0}`,
        ]
      : []),
    ...(ancestorDetails.length
      ? [
          `祖代相性：${ancestorDetails
            .map(
              (detail) =>
                `${detail.label} ${detail.umaName || ""} ${detail.base}`,
            )
            .join(" + ")} = ${compatibility.inheritedTotal || 0}`,
        ]
      : []),
    `总计：${totalParts.join(" + ")} = ${compatibility.total}`,
  ].join("\n");
}

function UmaSelect({
  label,
  value,
  onChange,
  required = false,
  exclude = [],
  compatibility,
  footer,
  modeSelector,
  openRequest,
  displayOnly = false,
  onClear,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  exclude?: number[];
  compatibility?: PositionCompatibilityScore;
  footer?: ComponentChildren;
  modeSelector?: ComponentChildren;
  openRequest?: number;
  displayOnly?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = data.umas.find((uma) => uma.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const options = data.umas.filter((uma) => {
    if (uma.id === value) return true;
    return (
      !normalizedQuery ||
      uma.name.toLocaleLowerCase().includes(normalizedQuery) ||
      String(uma.id).includes(normalizedQuery)
    );
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const chooseUma = (umaId: number) => {
    onChange(umaId);
    setOpen(false);
  };
  const clearSearch = () => setQuery("");

  useEffect(() => {
    if (openRequest === undefined || openRequest <= 0) return;
    setOpen(true);
  }, [openRequest]);

  return (
    <div
      class={`successionUmaSelect ${selected ? "selected" : ""}${modeSelector ? " withModeSelector" : ""}`}
    >
      <div class="successionUmaSelectTitle">
        <span>{!selected && modeSelector ? "未设置" : label}</span>
        {selected && (!displayOnly || onClear) && (
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(0))}
            aria-label={`清除${label}`}
          >
            清除
          </button>
        )}
      </div>
      {(selected || !modeSelector) && (
        <button
          type="button"
          class="successionUmaTrigger"
          aria-label={label}
          disabled={displayOnly}
          onClick={() => setOpen(true)}
        >
          {selected ? (
            <Fragment>
              <UmaPortrait uma={selected} />
              <div class="successionSelectedUma">
                <strong>{selected.name}</strong>
                <UmaAptitudeRows uma={selected} />
              </div>
              {compatibility && (
                <span
                  class="successionUmaCompatibility"
                  title={compatibilityTitle(compatibility)}
                >
                  <small>相性</small>
                  <strong>{compatibility.total}</strong>
                </span>
              )}
            </Fragment>
          ) : (
            <Fragment>
              {required && <span class="successionPortrait empty">+</span>}
              <div class="successionUmaPlaceholder">
                <strong>{required ? "请选择马娘" : "不固定"}</strong>
              </div>
            </Fragment>
          )}
        </button>
      )}
      {modeSelector}
      {selected && footer}

      {open && (
        <div class="successionPickerOverlay" onMouseDown={() => setOpen(false)}>
          <section
            class="successionPickerDialog"
            role="dialog"
            aria-modal="true"
            aria-label={`选择${label}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header class="successionPickerHeader">
              <div>
                <span>SELECT UMAMUSUME</span>
                <h3>选择{label}</h3>
                <p>输入名称或 ID 搜索，点击头像完成选择。</p>
              </div>
              <button
                type="button"
                class="successionPickerClose"
                aria-label="关闭选择界面"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div class="successionPickerToolbar">
              <label class="successionPickerSearch">
                <input
                  type="text"
                  value={query}
                  autoFocus
                  placeholder="输入马娘名称或 ID"
                  aria-label={`搜索${label}`}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
              <div class="successionPickerMeta">
                <span>找到 {options.length} 位马娘</span>
                {query && (
                  <button type="button" onClick={clearSearch}>
                    清空搜索
                  </button>
                )}
                {!required && value !== 0 && (
                  <button type="button" onClick={() => chooseUma(0)}>
                    设为不固定
                  </button>
                )}
              </div>
            </div>

            <div class="successionPickerGrid">
              {options.length ? (
                options.map((uma) => {
                  const selected = uma.id === value;
                  const occupied = !selected && exclude.includes(uma.id);
                  return (
                    <button
                      type="button"
                      class={`successionPickerCard ${selected ? "selected" : ""} ${occupied ? "occupied" : ""}`}
                      aria-label={
                        occupied
                          ? `${uma.name}，已在其他位置选择`
                          : `选择${uma.name}`
                      }
                      disabled={occupied}
                      onClick={() => chooseUma(uma.id)}
                      key={uma.id}
                    >
                      <UmaPortrait uma={uma} large />
                      <div class="successionPickerCardBody">
                        <strong>{uma.name}</strong>
                        <UmaAptitudeRows uma={uma} picker />
                      </div>
                      {selected && <em aria-label="当前选择">✓</em>}
                      {occupied && (
                        <em class="occupied" aria-label="已在其他位置选择">
                          已选择
                        </em>
                      )}
                    </button>
                  );
                })
              ) : (
                <div class="successionPickerEmpty">
                  <strong>没有符合条件的马娘</strong>
                  <p>尝试修改名称、ID，或清空搜索。</p>
                  <button type="button" onClick={clearSearch}>
                    清空搜索
                  </button>
                </div>
              )}
            </div>
            <footer class="successionPickerFooter">
              <span>当前显示 {options.length} 位马娘</span>
              <button type="button" onClick={() => setOpen(false)}>
                完成
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function BranchRouteCard({
  branch,
  route,
  minimums,
  uma,
  onRouteChange,
  onMinimumChange,
  settingLabel,
  compact = false,
  trained = false,
  followsDefault = false,
  onReset,
}: {
  branch: BranchKey;
  route: Route;
  minimums: AptitudeMinimums;
  uma?: SuccessionUma;
  onRouteChange: (value: string) => void;
  onMinimumChange: (type: AptitudeKey, value: number) => void;
  settingLabel?: string;
  compact?: boolean;
  trained?: boolean;
  followsDefault?: boolean;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const branchLabel = branch === "paternal" ? "父系" : "母系";
  const displayLabel = settingLabel || branchLabel;
  const routeFactorRequirements = uma
    ? route.aptitudes
        .map((type) => ({
          type,
          stars: minimumStarsForRank(uma.aptitudes[type], minimums[type]),
        }))
        .filter(
          (item): item is { type: AptitudeKey; stars: number } =>
            item.stars !== null && item.stars > 0,
        )
    : [];
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div class={`successionRouteCard ${branch}${compact ? " compact" : ""}`}>
        <button
          type="button"
          class="successionRouteSummaryButton"
          aria-label={`设置${displayLabel}赛程`}
          onClick={() => setOpen(true)}
        >
          <header>
            <span class={compact ? "" : "successionDefaultRouteLabel"}>
              {trained
                ? "育成赛程"
                : compact
                  ? "单独赛程"
                  : `${branchLabel}默认赛程`}
            </span>
            <strong>
              {route.id === "none" ? "暂不规划" : route.shortName}
            </strong>
          </header>
          <div class="successionRouteSummaryNeeds">
            {trained ? (
              <span>{route.g1Count} 场 G1</span>
            ) : route.aptitudes.length ? (
              route.aptitudes.map((type) => (
                <span key={type}>
                  <b>{APTITUDE_LABELS[type]}</b>
                  <i>≥</i>
                  <RankIcon value={minimums[type]} compact />
                </span>
              ))
            ) : (
              <span>不设置赛程适性要求</span>
            )}
          </div>
        </button>
      </div>

      {open && (
        <div
          class="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            class="successionInheritanceModal successionRouteModal"
            role="dialog"
            aria-modal="true"
            aria-label={`设置${displayLabel}赛程`}
          >
            <header>
              <div>
                <span>RACE SCHEDULE</span>
                <h3>{displayLabel}赛程设置</h3>
              </div>
              <button
                type="button"
                aria-label={`关闭${displayLabel}赛程设置`}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div class="successionRouteModalBody">
              <section class="successionRouteModalPresets">
                <header>
                  <strong>选择赛程</strong>
                  <span>
                    {trained
                      ? "记录实际参加的赛程，用于计算共同 G1 相性"
                      : "赛程决定改马的适应性要求"}
                  </span>
                </header>
                <div role="radiogroup" aria-label={`${displayLabel}赛程`}>
                  {ROUTES.map((item) => (
                    <button
                      type="button"
                      role="radio"
                      class={item.id === route.id ? "selected" : ""}
                      aria-checked={item.id === route.id}
                      onClick={() => onRouteChange(item.id)}
                      key={item.id}
                    >
                      <strong>
                        {item.id === "none" ? "不规划" : item.shortName}
                      </strong>
                      <small>{item.g1Count} 场 G1</small>
                    </button>
                  ))}
                </div>
              </section>
              {trained ? (
                <div class="successionRouteModalEmpty">
                  已育成马娘不会再反推适性因子；这里的赛程仅用于计算与目标、父辈之间的共同
                  G1 相性。
                </div>
              ) : route.aptitudes.length ? (
                <section class="successionRouteAptitudeMinimums">
                  <header>
                    <strong>设置比赛的最低适应性</strong>
                    <span>
                      {uma
                        ? `因子槽位 ${routeMinimumSlotCount(uma, route, minimums)} / ${MAX_INHERITANCE_SLOTS}`
                        : "比赛的适应性要求决定其父代和祖代的因子"}
                    </span>
                  </header>
                  <div>
                    {APTITUDE_GROUPS.map((group) => {
                      const types = group.types.filter((type) =>
                        route.aptitudes.includes(type),
                      );
                      if (!types.length) return null;
                      return (
                        <section key={group.label}>
                          <span>{group.label}</span>
                          <div>
                            {types.map((type) => (
                              <div key={type}>
                                <strong>{APTITUDE_LABELS[type]}</strong>
                                <div
                                  role="radiogroup"
                                  aria-label={`${displayLabel}${APTITUDE_LABELS[type]}最低适性`}
                                >
                                  {[7, 6, 5, 4].map((value) => {
                                    const maximum = uma
                                      ? maximumInheritedRank(
                                          uma.aptitudes[type],
                                        )
                                      : 7;
                                    const minimum = uma
                                      ? minimumRouteRank(uma.aptitudes[type])
                                      : 4;
                                    const belowBase = value < minimum;
                                    const exceedsRank = value > maximum;
                                    const proposedMinimums = {
                                      ...minimums,
                                      [type]: value,
                                    };
                                    const currentSlots = uma
                                      ? routeMinimumSlotCount(
                                          uma,
                                          route,
                                          minimums,
                                        )
                                      : 0;
                                    const proposedSlots = uma
                                      ? routeMinimumSlotCount(
                                          uma,
                                          route,
                                          proposedMinimums,
                                        )
                                      : 0;
                                    const exceedsSlots = Boolean(
                                      uma &&
                                      proposedSlots > MAX_INHERITANCE_SLOTS &&
                                      proposedSlots > currentSlots,
                                    );
                                    const unavailable =
                                      belowBase || exceedsRank || exceedsSlots;
                                    const unavailableReason = belowBase
                                      ? `不能低于先天${rankLabel(uma!.aptitudes[type])}适性`
                                      : exceedsRank
                                        ? `最高只能提升至${rankLabel(maximum)}`
                                        : exceedsSlots
                                          ? `所有适性合计超过${MAX_INHERITANCE_SLOTS}个因子槽位`
                                          : "";
                                    return (
                                      <button
                                        type="button"
                                        role="radio"
                                        class={
                                          minimums[type] === value
                                            ? "selected"
                                            : ""
                                        }
                                        disabled={unavailable}
                                        aria-checked={minimums[type] === value}
                                        aria-label={`${APTITUDE_LABELS[type]}最低${rankLabel(value)}${unavailableReason ? `，${unavailableReason}` : ""}`}
                                        title={
                                          unavailableReason
                                            ? uma && exceedsRank
                                              ? `先天${rankLabel(uma.aptitudes[type])}，${unavailableReason}`
                                              : unavailableReason
                                            : undefined
                                        }
                                        onClick={() =>
                                          onMinimumChange(type, value)
                                        }
                                        key={value}
                                      >
                                        <RankIcon value={value} compact />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div class="successionRouteModalEmpty">
                  当前不规划赛程，不限制场地和距离适性。
                </div>
              )}
            </div>
            <footer class="successionRouteModalFooter">
              <div class="successionRouteFactorSummary">
                <strong>{trained ? "记录用途" : "需要的因子"}</strong>
                {trained ? (
                  <em>按实际赛程计算共同 G1 与继承相性</em>
                ) : uma ? (
                  routeFactorRequirements.length ? (
                    routeFactorRequirements.map((item) => (
                      <span key={item.type}>
                        <FactorIcon type={item.type} compact />
                        <b>{item.stars}★</b>
                      </span>
                    ))
                  ) : (
                    <em>无需额外适性因子</em>
                  )
                ) : (
                  <em>选择具体马娘后显示</em>
                )}
              </div>
              <div class="successionRouteModalActions">
                {onReset && !followsDefault && (
                  <button
                    type="button"
                    class="secondary"
                    onClick={() => {
                      onReset();
                      setOpen(false);
                    }}
                  >
                    恢复默认
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)}>
                  完成
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function TrainedRedFactorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Pick<FactorAssignment, "type" | "stars">;
  onChange: (value: Pick<FactorAssignment, "type" | "stars">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftType, setDraftType] = useState<FactorKey>(value?.type || "turf");
  const [draftStars, setDraftStars] = useState<1 | 2 | 3>(value?.stars || 3);
  const openEditor = () => {
    setDraftType(value?.type || "turf");
    setDraftStars(value?.stars || 3);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        class={`successionTrainedFactorButton${value ? " configured" : ""}`}
        aria-label={`设置${label}的红因子`}
        onClick={openEditor}
      >
        <span>红因子</span>
        {value ? (
          <strong>
            <FactorIcon type={value.type} compact />
            <b>{value.stars}★</b>
          </strong>
        ) : (
          <em>未设置</em>
        )}
      </button>
      {open && (
        <div
          class="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            class="successionInheritanceModal successionTrainedFactorModal"
            role="dialog"
            aria-modal="true"
            aria-label={`设置${label}的红因子`}
          >
            <header>
              <div>
                <span>TRAINED RED FACTOR</span>
                <h3>{label}的红因子</h3>
              </div>
              <button
                type="button"
                aria-label="关闭红因子设置"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div class="successionTrainedFactorModalBody">
              <section>
                <strong>因子属性</strong>
                <div class="successionTrainedFactorTypes">
                  {APTITUDE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <span>{group.label}</span>
                      <div>
                        {group.types.map((type) => (
                          <button
                            type="button"
                            class={draftType === type ? "selected" : ""}
                            aria-pressed={draftType === type}
                            onClick={() => setDraftType(type)}
                            key={type}
                          >
                            <FactorIcon type={type} compact />
                            <b>{APTITUDE_LABELS[type]}</b>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <strong>因子星级</strong>
                <div
                  class="successionTrainedFactorStars"
                  role="radiogroup"
                  aria-label="红因子星级"
                >
                  {([1, 2, 3] as const).map((stars) => (
                    <button
                      type="button"
                      role="radio"
                      class={draftStars === stars ? "selected" : ""}
                      aria-checked={draftStars === stars}
                      onClick={() => setDraftStars(stars)}
                      key={stars}
                    >
                      {stars}★
                    </button>
                  ))}
                </div>
              </section>
              <footer>
                <span>
                  当前：<FactorIcon type={draftType} compact />
                  {APTITUDE_LABELS[draftType]} {draftStars}★
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ type: draftType, stars: draftStars });
                    setOpen(false);
                  }}
                >
                  保存
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function TrainedLineageMemberEditor({
  label,
  branch,
  member,
  exclude,
  onChange,
}: {
  label: string;
  branch: BranchKey;
  member: TrainedLineageMember;
  exclude: number[];
  onChange: (member: TrainedLineageMember) => void;
}) {
  const uma = data.umas.find((candidate) => candidate.id === member.umaId);
  const route = ROUTES.find((item) => item.id === member.routeId) || ROUTES[0];
  return (
    <div class="successionTrainedMemberEditor">
      <UmaSelect
        label={label}
        value={member.umaId}
        required
        exclude={exclude}
        onChange={(umaId) => onChange({ ...member, umaId })}
        footer={
          uma ? (
            <div class="successionLineageUmaDetails trained">
              <TrainedRedFactorInput
                label={`${label}（${uma.name}）`}
                value={member.factor}
                onChange={(factor) => onChange({ ...member, factor })}
              />
              <BranchRouteCard
                branch={branch}
                route={route}
                minimums={DEFAULT_APTITUDE_MINIMUMS}
                uma={uma}
                settingLabel={`${label}（${uma.name}）`}
                compact
                trained
                onRouteChange={(routeId) => onChange({ ...member, routeId })}
                onMinimumChange={() => undefined}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
}

function TrainedUmaSettingModal({
  slot,
  branch,
  currentUmaId,
  defaultRouteId,
  existing,
  exclude,
  onSave,
  onClose,
}: {
  slot: LineageSlot;
  branch: BranchKey;
  currentUmaId: number;
  defaultRouteId: string;
  existing?: TrainedUmaSetting;
  exclude: number[];
  onSave: (setting: TrainedUmaSetting) => void;
  onClose: () => void;
}) {
  const createMember = (umaId = 0): TrainedLineageMember => ({
    umaId,
    factor: { type: "turf", stars: 3 },
    routeId: defaultRouteId,
  });
  const [setting, setSetting] = useState<TrainedUmaSetting>(
    existing || {
      self: createMember(currentUmaId),
      parents: [createMember(), createMember()],
    },
  );
  const members = [setting.self, ...setting.parents];
  const memberIds = members.map((member) => member.umaId).filter(Boolean);
  const complete = memberIds.length === 3 && new Set(memberIds).size === 3;
  const updateMember = (index: number, member: TrainedLineageMember) => {
    if (index === 0) {
      setSetting((current) => ({ ...current, self: member }));
      return;
    }
    setSetting((current) => ({
      ...current,
      parents: current.parents.map((item, parentIndex) =>
        parentIndex === index - 1 ? member : item,
      ) as [TrainedLineageMember, TrainedLineageMember],
    }));
  };
  const parentCodes = [`${SLOT_CODES[slot]}A`, `${SLOT_CODES[slot]}B`];
  const renderMemberEditor = (member: TrainedLineageMember, index: number) => {
    const allowedCurrentIds = new Set(memberIds);
    const memberExclude = [
      ...exclude.filter((id) => !allowedCurrentIds.has(id)),
      ...members
        .filter((_, memberIndex) => memberIndex !== index)
        .map((item) => item.umaId)
        .filter(Boolean),
    ];
    return (
      <TrainedLineageMemberEditor
        label={
          index === 0
            ? `${SLOT_LABELS[slot]}本人`
            : `父辈 ${parentCodes[index - 1]}`
        }
        branch={branch}
        member={member}
        exclude={[...new Set(memberExclude)]}
        onChange={(value) => updateMember(index, value)}
      />
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      class="successionInheritanceModalOverlay"
      role="presentation"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        class="successionInheritanceModal successionTrainedUmaModal"
        role="dialog"
        aria-modal="true"
        aria-label={`设置${SLOT_LABELS[slot]}已育成马娘`}
      >
        <header>
          <div>
            <span>TRAINED UMAMUSUME</span>
            <h3>设置{SLOT_LABELS[slot]}已育成马娘</h3>
          </div>
          <button type="button" aria-label="关闭已育成马娘设置" onClick={onClose}>
            ×
          </button>
        </header>
        <div class="successionTrainedUmaModalBody">
          <div class="successionTrainedUmaTree">
            <div class="successionTrainedUmaTreeRoot">
              {renderMemberEditor(members[0], 0)}
            </div>
            <div class="successionTrainedUmaTreeChildren">
              {members.slice(1).map((member, index) => (
                <div class="successionTrainedUmaTreeChild" key={index}>
                  {renderMemberEditor(member, index + 1)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer class="successionTrainedUmaModalFooter">
          <span>
            {complete
              ? "本人和两位父辈已完整设置，保存后不再向上搜索。"
              : "请选择本人和两位不同的父辈马娘。"}
          </span>
          <div>
            <button type="button" class="secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              disabled={!complete}
              onClick={() => complete && onSave(setting)}
            >
              保存已育成马娘
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function LineageUmaSetting({
  slot,
  branch,
  value,
  exclude,
  compatibility,
  route,
  minimums,
  followsDefault,
  onRouteChange,
  onMinimumChange,
  onResetRoute,
  trainedSetting,
  inheritedMember,
  inheritedSourceLabel,
  trainedModalExclude,
  onPlanUmaChange,
  onTrainedSettingChange,
  onClear,
  draggedSlot,
  dropSlot,
}: {
  slot: LineageSlot;
  branch: BranchKey;
  value: number;
  exclude: number[];
  compatibility: PositionCompatibilityScore;
  route: Route;
  minimums: AptitudeMinimums;
  followsDefault: boolean;
  onRouteChange: (value: string) => void;
  onMinimumChange: (type: AptitudeKey, value: number) => void;
  onResetRoute: () => void;
  trainedSetting?: TrainedUmaSetting;
  inheritedMember?: TrainedLineageMember;
  inheritedSourceLabel?: string;
  trainedModalExclude: number[];
  onPlanUmaChange: (value: number) => void;
  onTrainedSettingChange: (setting: TrainedUmaSetting) => void;
  onClear: () => void;
  draggedSlot: LineageSlot | null;
  dropSlot: LineageSlot | null;
}) {
  const [planPickerRequest, setPlanPickerRequest] = useState(0);
  const [showTrainedModal, setShowTrainedModal] = useState(false);
  const trainedMember = inheritedMember || trainedSetting?.self;
  const effectiveValue = trainedMember?.umaId || value;
  const uma = data.umas.find((candidate) => candidate.id === effectiveValue);
  const trainedRoute = trainedMember
    ? ROUTES.find((item) => item.id === trainedMember.routeId) || route
    : route;
  const locked = Boolean(inheritedMember);
  const hiddenParentFactors =
    trainedSetting && slot !== "father" && slot !== "mother"
      ? trainedSetting.parents
      : [];
  const hiddenParentCodes = [`${SLOT_CODES[slot]}A`, `${SLOT_CODES[slot]}B`];
  const factorBadge = (
    factor: Pick<FactorAssignment, "type" | "stars">,
    label: string,
  ) => (
    <span class="successionTrainedFactorItem">
      <small>{label}</small>
      <span
        class="successionCandidateFactor"
        title={`${APTITUDE_LABELS[factor.type]} ${factor.stars}★`}
      >
        {APTITUDE_LABELS[factor.type]}
        <b>{factor.stars}★</b>
      </span>
    </span>
  );
  return (
    <div
      class={`successionLineageUmaSetting${draggedSlot === slot ? " dragging" : ""}${dropSlot === slot && draggedSlot !== slot ? " dropTarget" : ""}`}
      data-lineage-slot={slot}
      draggable={Boolean(uma) && !locked}
      aria-grabbed={draggedSlot === slot}
    >
      <UmaSelect
        label={SLOT_LABELS[slot]}
        value={effectiveValue}
        exclude={exclude}
        compatibility={compatibility}
        onChange={onPlanUmaChange}
        onClear={!locked && uma ? onClear : undefined}
        openRequest={planPickerRequest}
        displayOnly
        modeSelector={
          !uma && !locked ? (
            <div
              class="successionBranchModeSwitch"
              role="group"
              aria-label={`${SLOT_LABELS[slot]}设置方式`}
            >
              <button
                type="button"
                onClick={() => setPlanPickerRequest((current) => current + 1)}
              >
                设置计划马娘
              </button>
              <button type="button" onClick={() => setShowTrainedModal(true)}>
                设置已育成马娘
              </button>
            </div>
          ) : null
        }
        footer={
          uma ? (
            trainedMember ? (
              <div class="successionTrainedUmaSummary">
                <div class="successionTrainedFactorSummary">
                  {factorBadge(trainedMember.factor, "自身")}
                  {hiddenParentFactors.map((member, index) => (
                    <Fragment key={hiddenParentCodes[index]}>
                      {factorBadge(member.factor, hiddenParentCodes[index])}
                    </Fragment>
                  ))}
                </div>
                <span class="successionTrainedRoute">{trainedRoute.shortName}</span>
                <em>
                  {inheritedSourceLabel
                    ? `由${inheritedSourceLabel}固定`
                    : "本人及父辈已固定"}
                </em>
              </div>
            ) : (
              <div class="successionLineageUmaDetails planned">
                <BranchRouteCard
                  branch={branch}
                  route={route}
                  minimums={minimums}
                  uma={uma}
                  settingLabel={`${SLOT_LABELS[slot]}（${uma.name}）`}
                  compact
                  followsDefault={followsDefault}
                  onRouteChange={onRouteChange}
                  onMinimumChange={onMinimumChange}
                  onReset={onResetRoute}
                />
              </div>
            )
          ) : null
        }
      />
      {showTrainedModal && (
        <TrainedUmaSettingModal
          slot={slot}
          branch={branch}
          currentUmaId={value}
          defaultRouteId={route.id}
          existing={trainedSetting}
          exclude={trainedModalExclude}
          onSave={(setting) => {
            onTrainedSettingChange(setting);
            setShowTrainedModal(false);
          }}
          onClose={() => setShowTrainedModal(false)}
        />
      )}
    </div>
  );
}

function InRaceFactorJumpOption({
  enabled,
  minimumRank,
  onEnabledChange,
  onMinimumRankChange,
  footer,
}: {
  enabled: boolean;
  minimumRank: number;
  onEnabledChange: (enabled: boolean) => void;
  onMinimumRankChange: (rank: number) => void;
  footer?: ComponentChildren;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const selectRank = (rank: number) => {
    onMinimumRankChange(rank);
    onEnabledChange(true);
  };
  return (
    <>
      <section class="successionInheritanceAptitudes successionFactorJumpOption">
        <header>
          <strong>产生红因子最低适应性要求</strong>
          <button
            type="button"
            class="successionFactorJumpInfoButton"
            aria-label="查看局内跳因子说明"
            onClick={() => setShowInfo(true)}
          >
            i
          </button>
        </header>
        <div
          class="successionFactorJumpChoices"
          role="group"
          aria-label="局内跳因子最低初始适性"
        >
          <button
            type="button"
            class={!enabled ? "selected" : ""}
            aria-pressed={!enabled}
            onClick={() => onEnabledChange(false)}
          >
            关闭
          </button>
          {[6, 5, 4, 3].map((rank) => (
            <button
              type="button"
              class={`successionFactorJumpRankChoice${enabled && minimumRank === rank ? " selected" : ""}`}
              aria-pressed={enabled && minimumRank === rank}
              aria-label={`允许初始适性 ${rankLabel(rank)} 以上通过局内提升到 A`}
              title={`允许初始适性 ${rankLabel(rank)} 以上通过局内提升到 A`}
              onClick={() => selectRank(rank)}
              key={rank}
            >
              <RankIcon value={rank} compact />
            </button>
          ))}
        </div>
        {footer && (
          <div class="successionFactorProductionTargets">{footer}</div>
        )}
      </section>
      {showInfo && (
        <div
          class="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setShowInfo(false);
          }}
        >
          <section
            class="successionInheritanceModal successionFactorJumpModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-factor-jump-modal-title"
          >
            <header>
              <div>
                <span class="successionModalChineseLabel">规则说明</span>
                <h3 id="succession-factor-jump-modal-title">
                  产生红因子最低适应性要求
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭局内跳因子说明"
                onClick={() => setShowInfo(false)}
              >
                ×
              </button>
            </header>
            <div class="successionFactorJumpModalBody">
              <p>
                通常只有育成开始时对应适性达到 A，马娘才能产出该红因子。
              </p>
              <div>
                <strong>选择 B / C / D / E</strong>
                <span>
                  如果父祖辈提供的同类红因子能让马娘以所选等级以上开始育成，并可能在局内继续提升到
                  A，也将她视为可产出对应红因子。
                </span>
              </div>
              <div>
                <strong>结果标记</strong>
                <span>
                  对应马娘会显示“需要局内 属性 X → A”，方便区分正常产出方案。
                </span>
              </div>
              <footer>
                此设置只判断理论可达，不会把局内红因子的触发概率计入最终达成概率。
              </footer>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function InheritanceAptitudes({
  target,
  selected,
  targets,
  onToggle,
  onConfigure,
}: {
  target: SuccessionUma;
  selected: FactorKey[];
  targets: InheritanceTargets;
  onToggle: (type: FactorKey) => void;
  onConfigure: (type: FactorKey, rank: number) => void;
}) {
  const [editingType, setEditingType] = useState<FactorKey | null>(null);
  const allocations = inheritanceAllocation(target, selected, targets);
  const usedSlots = allocations.reduce((total, item) => total + item.slots, 0);
  const editingBase = editingType ? target.aptitudes[editingType] : 0;
  const editingAllocation = editingType
    ? allocations.find((item) => item.type === editingType)
    : undefined;
  const editingOtherSlots = usedSlots - (editingAllocation?.slots || 0);
  const editingMaximum = Math.min(7, editingBase + FACTOR_STEPS.length - 1);

  return (
    <>
      <section class="successionInheritanceAptitudes">
        <header>
          <strong>{target.name}需要继承的适应性</strong>
          <span
            class="successionInheritanceBudget"
            title="1 / 4 / 7 / 10★门槛分别按 1 / 2 / 3 / 4 个满级 3★槽位规划"
          >
            因子槽位{" "}
            <b>
              {usedSlots}/{MAX_INHERITANCE_SLOTS}
            </b>
          </span>
        </header>
        <div class="successionInheritanceGroups">
          {APTITUDE_GROUPS.map((group) => (
            <div class="successionInheritanceGroup" key={group.label}>
              <span>{group.label}</span>
              <div>
                {group.types.map((type) => {
                  const active = selected.includes(type);
                  const base = target.aptitudes[type];
                  const allocation = allocations.find(
                    (item) => item.type === type,
                  );
                  const cannotSelect =
                    !active && usedSlots + 1 > MAX_INHERITANCE_SLOTS;
                  return (
                    <div
                      class={`successionInheritanceChoice${active ? " selected" : ""}`}
                      key={type}
                    >
                      <button
                        type="button"
                        class={`successionInheritanceToggle${active ? " selected" : ""}`}
                        aria-pressed={active}
                        aria-label={`养成马娘${active ? "取消" : "选择"}继承${APTITUDE_LABELS[type]}适性`}
                        disabled={cannotSelect}
                        title={cannotSelect ? "红因子槽位不足" : undefined}
                        onClick={() => {
                          if (!active && base < 7) setEditingType(type);
                          else onToggle(type);
                        }}
                      >
                        <b>{APTITUDE_LABELS[type]}</b>
                        <i aria-hidden="true">✓</i>
                      </button>
                      {active && base < 7 && allocation && (
                        <button
                          class="successionInheritanceTargetSummary"
                          type="button"
                          aria-label={`修改${APTITUDE_LABELS[type]}提升等级`}
                          onClick={() => setEditingType(type)}
                        >
                          <RankIcon value={base} compact />
                          <i aria-hidden="true">›</i>
                          <RankIcon value={allocation.target} compact />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      {editingType && editingBase < 7 && (
        <div
          class="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setEditingType(null);
          }}
        >
          <section
            class="successionInheritanceModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-inheritance-modal-title"
          >
            <header>
              <div>
                <span class="successionModalChineseLabel">
                  设置初始的适应性等级
                </span>
                <h3 id="succession-inheritance-modal-title">
                  {APTITUDE_LABELS[editingType]}
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭适性提升设置"
                onClick={() => setEditingType(null)}
              >
                ×
              </button>
            </header>
            <div class="successionInheritanceModalSummary">
              <span>
                当前 <RankIcon value={editingBase} compact />
              </span>
              <i aria-hidden="true">›</i>
              <span>
                最高 <RankIcon value={editingMaximum} compact />
              </span>
              <b>可用因子槽位 {MAX_INHERITANCE_SLOTS - editingOtherSlots}</b>
            </div>
            <div class="successionInheritanceRankChoices">
              {Array.from(
                { length: editingMaximum - editingBase },
                (_, index) => editingBase + index + 1,
              ).map((rank) => {
                const stars = minimumStarsForRank(editingBase, rank) || 0;
                const slots = factorSlotsForStars(stars);
                const lacksSlots =
                  editingOtherSlots + slots > MAX_INHERITANCE_SLOTS;
                const unavailable = lacksSlots;
                const active = editingAllocation?.target === rank;
                const unavailableReason = lacksSlots ? "槽位不足" : "";
                return (
                  <button
                    type="button"
                    class={active ? "selected" : ""}
                    disabled={unavailable}
                    onClick={() => {
                      onConfigure(editingType, rank);
                      setEditingType(null);
                    }}
                    key={rank}
                  >
                    <span>
                      <RankIcon value={editingBase} compact />
                      <i aria-hidden="true">›</i>
                      <RankIcon value={rank} compact />
                    </span>
                    <strong>
                      提升 {rank - editingBase} 级至 {rankLabel(rank)}
                    </strong>
                    <small>需要 {slots} 个因子槽</small>
                    {unavailableReason && <em>{unavailableReason}</em>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ProbabilityTargetInput({
  targetName,
  probabilityOptions,
  onConfigureProbabilityTarget,
  embedded = false,
}: {
  targetName: string;
  probabilityOptions: Array<{
    type: FactorKey;
    guaranteed: number;
    target: number;
  }>;
  onConfigureProbabilityTarget: (type: FactorKey, rank: number) => void;
  embedded?: boolean;
}) {
  const [editingProbabilityType, setEditingProbabilityType] =
    useState<FactorKey | null>(null);
  const editingProbabilityOption = probabilityOptions.find(
    (option) => option.type === editingProbabilityType,
  );
  return (
    <>
      <div
        class={`successionProbabilityTargets successionCalculationProbabilityTargets${embedded ? " embedded" : ""}`}
      >
        <span>要求{targetName}育成后</span>
        <div>
          {!probabilityOptions.length && (
            <strong>未设置，按赛程与相性计算</strong>
          )}
          {probabilityOptions.map((option) => (
            <button
              type="button"
              class="successionProbabilityTargetOption"
              aria-label={`修改${APTITUDE_LABELS[option.type]}概率目标等级`}
              onClick={() => setEditingProbabilityType(option.type)}
              key={option.type}
            >
              <b>{APTITUDE_LABELS[option.type]}</b>
              <span class="successionProbabilityTargetRank">
                <RankIcon value={option.guaranteed} compact />
                <em>›</em>
                <RankIcon value={option.target} compact />
              </span>
            </button>
          ))}
        </div>
      </div>
      {editingProbabilityOption && (
        <div
          class="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setEditingProbabilityType(null);
            }
          }}
        >
          <section
            class="successionInheritanceModal successionProbabilityModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-probability-modal-title"
          >
            <header>
              <div>
                <span>随机继承概率目标</span>
                <h3 id="succession-probability-modal-title">
                  {APTITUDE_LABELS[editingProbabilityOption.type]}
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭概率目标设置"
                onClick={() => setEditingProbabilityType(null)}
              >
                ×
              </button>
            </header>
            <div class="successionInheritanceModalSummary">
              <span>
                开局必定{" "}
                <RankIcon value={editingProbabilityOption.guaranteed} compact />
              </span>
              <i aria-hidden="true">›</i>
              <span>
                最高 <RankIcon value={8} compact />
              </span>
              <b>仅计算后续两次随机继承</b>
            </div>
            <div class="successionInheritanceRankChoices">
              {Array.from(
                { length: 9 - editingProbabilityOption.guaranteed },
                (_, index) => editingProbabilityOption.guaranteed + index,
              ).map((rank) => (
                <button
                  type="button"
                  class={
                    editingProbabilityOption.target === rank ? "selected" : ""
                  }
                  onClick={() => {
                    onConfigureProbabilityTarget(
                      editingProbabilityOption.type,
                      rank,
                    );
                    setEditingProbabilityType(null);
                  }}
                  key={rank}
                >
                  <span>
                    <RankIcon
                      value={editingProbabilityOption.guaranteed}
                      compact
                    />
                    <i aria-hidden="true">›</i>
                    <RankIcon value={rank} compact />
                  </span>
                  <strong>概率目标 {rankLabel(rank)}</strong>
                  <small>
                    {rank === editingProbabilityOption.guaranteed
                      ? "无需额外随机继承"
                      : `还需随机继承 ${rank - editingProbabilityOption.guaranteed} 次`}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function UmaExclusionList({
  excludedIds,
  fixedIds,
  onToggle,
}: {
  excludedIds: number[];
  fixedIds: number[];
  onToggle: (umaId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const excludedSet = new Set(excludedIds);
  const fixedSet = new Set(fixedIds.filter(Boolean));
  const excludedUmas = data.umas.filter((uma) => excludedSet.has(uma.id));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const options = data.umas.filter(
    (uma) =>
      !normalizedQuery ||
      uma.name.toLocaleLowerCase().includes(normalizedQuery) ||
      String(uma.id).includes(normalizedQuery),
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <section class="successionUmaExclusionList">
        <header>
          <span>黑名单马娘</span>
          <button
            type="button"
            aria-label="管理黑名单马娘"
            onClick={() => setOpen(true)}
          >
            管理 {excludedIds.length ? `(${excludedIds.length})` : ""}
          </button>
        </header>
        <div class="successionUmaExclusionSummary">
          {excludedUmas.length ? (
            <>
              {excludedUmas.slice(0, 4).map((uma) => (
                <span key={uma.id} title={uma.name}>
                  <UmaPortrait uma={uma} />
                  <b>{uma.name}</b>
                  <button
                    type="button"
                    aria-label={`从黑名单移除${uma.name}`}
                    onClick={() => onToggle(uma.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {excludedUmas.length > 4 && (
                <em>另有 {excludedUmas.length - 4} 位</em>
              )}
            </>
          ) : (
            <strong>暂无黑名单马娘</strong>
          )}
        </div>
      </section>

      {open && (
        <div class="successionPickerOverlay" onMouseDown={() => setOpen(false)}>
          <section
            class="successionPickerDialog successionExclusionDialog"
            role="dialog"
            aria-modal="true"
            aria-label="管理黑名单马娘"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header class="successionPickerHeader">
              <div>
                <span>UMAMUSUME FILTER</span>
                <h3>黑名单马娘</h3>
                <p>黑名单中的马娘将不会出现在计算中。</p>
              </div>
              <button
                type="button"
                class="successionPickerClose"
                aria-label="关闭黑名单马娘"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div class="successionExclusionToolbar">
              <label class="successionPickerSearch">
                <input
                  type="text"
                  value={query}
                  autoFocus
                  placeholder="输入马娘名称或 ID"
                  aria-label="搜索马娘过滤列表"
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
              <span>
                已过滤 <b>{excludedIds.length}</b> 位 · 当前显示{" "}
                {options.length}位
              </span>
            </div>
            <div class="successionExclusionGrid">
              {options.map((uma) => {
                const excluded = excludedSet.has(uma.id);
                const fixed = fixedSet.has(uma.id);
                return (
                  <button
                    type="button"
                    class={excluded ? "selected" : ""}
                    aria-pressed={excluded}
                    aria-label={
                      excluded
                        ? `从黑名单移除${uma.name}`
                        : fixed
                          ? `将${uma.name}加入黑名单，当前固定位置仍会保留`
                          : `将${uma.name}加入黑名单`
                    }
                    title={
                      fixed
                        ? "当前种马路线中的固定选择优先，加入过滤不会清除该位置"
                        : undefined
                    }
                    onClick={() => onToggle(uma.id)}
                    key={uma.id}
                  >
                    <UmaPortrait uma={uma} />
                    <strong>{uma.name}</strong>
                    <em>{excluded ? "已过滤" : "加入"}</em>
                  </button>
                );
              })}
            </div>
            <footer class="successionPickerFooter">
              <span>过滤设置会自动保存</span>
              <button type="button" onClick={() => setOpen(false)}>
                完成
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function CompleteDesignFactorBadge({
  position,
}: {
  position: CompleteDesignPosition;
}) {
  return position.factor.free ? (
    <span
      class="successionCandidateFactor free"
      title={
        position.factor.unconstrained
          ? "该位置不指定红因子类型"
          : `自由槽位：实际按${APTITUDE_LABELS[position.factor.type]} ${position.factor.stars}★计算`
      }
    >
      自由
    </span>
  ) : (
    <span
      class="successionCandidateFactor"
      title={`${APTITUDE_LABELS[position.factor.type]} ${position.factor.stars}★`}
    >
      {APTITUDE_LABELS[position.factor.type]}
      <b>{position.factor.stars}★</b>
    </span>
  );
}

function CompleteDesignUpstreamRequirements({
  position,
}: {
  position: CompleteDesignPosition;
}) {
  const minimumDemandTypes = ALL_APTITUDES.filter(
    (type) => (position.minimumDemand?.[type] || 0) > 0,
  );
  const cumulativeDemandTypes = ALL_APTITUDES.filter(
    (type) => (position.cumulativeDemand?.[type] || 0) > 0,
  );
  const overlappingDemandTypes = cumulativeDemandTypes.filter(
    (type) => (position.minimumDemand?.[type] || 0) > 0,
  );
  const ancestorOnlyDemandTypes = cumulativeDemandTypes.filter(
    (type) => !(position.minimumDemand?.[type] || 0),
  );
  if (position.generation !== 2) return null;
  return (
    <div class="successionUpstreamRequirements">
      {minimumDemandTypes.length > 0 ? (
        <div>
          <small>{position.uma?.name || position.code}的父辈需要</small>
          <span>
            {minimumDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.minimumDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      ) : cumulativeDemandTypes.length === 0 ? (
        <em>{position.uma?.name || position.code}的父辈无额外要求</em>
      ) : null}
      {minimumDemandTypes.length === 0 && cumulativeDemandTypes.length > 0 && (
        <div class="successionCombinedRequirement">
          <small>父辈连同祖辈共要有</small>
          <span>
            {cumulativeDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.cumulativeDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      )}
      {minimumDemandTypes.length > 0 && ancestorOnlyDemandTypes.length > 0 && (
        <div>
          <small>祖辈需要</small>
          <span>
            {ancestorOnlyDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.cumulativeDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      )}
      {overlappingDemandTypes.length > 0 && (
        <div class="successionCombinedRequirement">
          <small>同时父辈连同祖辈共要有</small>
          <span>
            {overlappingDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥
                {(position.minimumDemand?.[type] || 0) +
                  (position.cumulativeDemand?.[type] || 0)}
                ★
              </b>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function CompleteDesignCandidateIdentity({
  position,
  onExcludeUma,
}: {
  position: CompleteDesignPosition;
  onExcludeUma: (umaId: number) => void;
}) {
  return (
    <div class="successionCandidateOption">
      <div class="successionCandidateOptionIdentity">
        <UmaPortrait uma={position.uma} />
        <span class="successionCandidateIdentity">
          <strong>{position.uma?.name || "没有可用马娘"}</strong>
          {position.uma && position.compatibility !== undefined && (
            <small
              class="successionCandidateCompatibility"
              title={position.compatibilityTitle}
            >
              相性 <b>{position.compatibility}</b>
            </small>
          )}
          {position.inRaceFactorJump && (
            <small
              class="successionCandidateJumpRequirement"
              title="该马娘需要在育成局内触发对应红因子，将适性提升到 A 后才能产出该红因子"
            >
              <strong>需要局内</strong>
              <span>{APTITUDE_LABELS[position.inRaceFactorJump.type]}</span>
              <b>{rankLabel(position.inRaceFactorJump.fromRank)}</b>
              <i aria-hidden="true">→</i>
              <b>{rankLabel(position.inRaceFactorJump.toRank)}</b>
            </small>
          )}
        </span>
        {position.uma && (
          <button
            type="button"
            class="successionCandidateBlacklist"
            disabled={position.fixed}
            title={position.fixed ? "固定马娘不能加入黑名单" : undefined}
            aria-label={
              position.fixed
                ? `${position.uma.name}是固定马娘`
                : `将${position.uma.name}加入黑名单`
            }
            onClick={() => onExcludeUma(position.uma!.id)}
          >
            {position.fixed ? "已固定" : "加入黑名单"}
          </button>
        )}
      </div>
      <CompleteDesignUpstreamRequirements position={position} />
    </div>
  );
}

function CompleteDesignPositionCard({
  position,
  onExcludeUma,
}: {
  position: CompleteDesignPosition;
  onExcludeUma: (umaId: number) => void;
}) {
  const alternatives = position.alternatives?.length
    ? position.alternatives
    : [position];
  const multiple = alternatives.length > 1;
  return (
    <article class={position.uma ? "" : "missing"}>
      <header>
        <b>{position.code}</b>
        <div class="successionCandidateHeaderMeta">
          {multiple && (
            <small>
              {position.alternativeCount || alternatives.length} 位候选，任选其一
            </small>
          )}
          <CompleteDesignFactorBadge position={position} />
        </div>
      </header>
      {multiple ? (
        <div class="successionCandidateOptions">
          {alternatives.map((alternative, index) => (
            <div
              class="successionCandidateOptionChoice"
              key={`${alternative.uma?.id || 0}:${index}`}
            >
              {index > 0 && <strong class="successionCandidateOr">或</strong>}
              <CompleteDesignCandidateIdentity
                position={alternative}
                onExcludeUma={onExcludeUma}
              />
            </div>
          ))}
        </div>
      ) : (
        <CompleteDesignCandidateIdentity
          position={position}
          onExcludeUma={onExcludeUma}
        />
      )}
    </article>
  );
}

function CompleteDesignBranchTree({
  branch,
  design,
  onExcludeUma,
}: {
  branch: BranchKey;
  design: CompleteFactorDesign;
  onExcludeUma: (umaId: number) => void;
}) {
  const codes = branch === "paternal" ? ["A", "AA", "AB"] : ["B", "BA", "BB"];
  const positions = codes.map((code) =>
    design?.positions.find((position) => position.code === code),
  );
  const [parent, ...grandparents] = positions;
  const hasAlternatives = grandparents.some(
    (position) => (position?.alternatives?.length || 0) > 1,
  );
  const alternativeCounts = grandparents.map(
    (position) => position?.alternatives?.length || 1,
  );
  const hasMatchingAlternativeCounts =
    alternativeCounts[0] === alternativeCounts[1];
  return (
    <section
      class={`successionRequirementBranch successionOptimalBranch ${branch}${hasAlternatives ? " hasAlternatives" : ""}${hasMatchingAlternativeCounts ? " hasMatchingAlternativeCounts" : ""}`}
    >
      <header>
        <strong>{branch === "paternal" ? "父系" : "母系"}</strong>
      </header>
      <div class="successionRequirementTree successionOptimalTree">
        <div class="successionRequirementTreeRoot successionCompleteGeneration generation1">
          <CompleteDesignPositionCard
            position={parent!}
            onExcludeUma={onExcludeUma}
          />
        </div>
        <div class="successionRequirementTreeChildren">
          {grandparents.map((position) => (
            <div
              class="successionRequirementTreeNode successionCompleteGeneration generation2"
              key={position!.code}
            >
              <CompleteDesignPositionCard
                position={position!}
                onExcludeUma={onExcludeUma}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMPLETE_DESIGN_BRANCH_CODES: Record<BranchKey, string[]> = {
  paternal: ["A", "AA", "AB"],
  maternal: ["B", "BA", "BB"],
};

function visibleCompleteDesignBranches(
  design: CompleteFactorDesign,
): BranchKey[] {
  const branchFullyFixed = (branch: BranchKey) =>
    COMPLETE_DESIGN_BRANCH_CODES[branch].every(
      (code) =>
        design.positions.find((position) => position.code === code)?.fixed,
    );
  const paternalFixed = branchFullyFixed("paternal");
  const maternalFixed = branchFullyFixed("maternal");
  if (paternalFixed && maternalFixed) return [];
  if (paternalFixed) return ["maternal"];
  if (maternalFixed) return ["paternal"];
  return ["paternal", "maternal"];
}

function CompleteDesignResult({
  rank,
  design,
  probability,
  probabilityTargets,
  onExcludeUma,
}: {
  rank: number;
  design: CompleteFactorDesign;
  probability?: number;
  probabilityTargets: Array<{ type: FactorKey; rank: number }>;
  onExcludeUma: (umaId: number) => void;
}) {
  const visibleBranches = visibleCompleteDesignBranches(design);
  const visibleCodes = new Set(
    visibleBranches.flatMap((branch) => COMPLETE_DESIGN_BRANCH_CODES[branch]),
  );
  const hasAlternatives = design.positions.some(
    (position) =>
      visibleCodes.has(position.code) &&
      (position.alternatives?.length || 0) > 1,
  );
  return (
    <section class="successionCompleteDesign successionOptimalResult">
      <header>
        <div>
          <strong>候选 {rank}</strong>
        </div>
        <div class="successionOptimalProbability">
          {probabilityTargets.map((target) => (
            <span key={target.type}>
              <i>{APTITUDE_SHORT_LABELS[target.type]}</i>
              <RankIcon value={target.rank} compact />
            </span>
          ))}
          <small>达成概率</small>
          <strong>
            {probability === undefined
              ? "—"
              : `${(probability * 100).toFixed(2)}%`}
          </strong>
        </div>
      </header>
      <div
        class={`successionOptimalBranches${hasAlternatives ? " hasAlternatives" : ""}${visibleBranches.length === 1 ? " singleBranch" : ""}`}
      >
        {visibleBranches.length ? (
          visibleBranches.map((branch) => (
            <CompleteDesignBranchTree
              branch={branch}
              design={design}
              onExcludeUma={onExcludeUma}
              key={branch}
            />
          ))
        ) : (
          <div class="successionAllBranchesFixed">父系与母系均已固定</div>
        )}
      </div>
    </section>
  );
}

function PositionRequirementCard({
  branch,
  slot,
  uma,
  inheritanceAptitudes,
  requirements,
  sourceSelections,
  candidates,
  preferredFactors,
  availableSlots,
}: {
  branch: BranchKey;
  slot: LineageSlot;
  uma?: SuccessionUma;
  inheritanceAptitudes: FactorKey[];
  requirements: PositionFactorRequirement[];
  sourceSelections: { slot: LineageSlot; uma?: SuccessionUma }[];
  candidates: { uma: SuccessionUma; score: number }[];
  preferredFactors: FactorKey[];
  availableSlots: number;
}) {
  const impossible = requirements.filter((item) => item.stars === null);
  const needed = requirements.filter(
    (item) => item.stars !== null && item.stars > 0,
  );
  const sourcesLocked =
    sourceSelections.length > 0 &&
    sourceSelections.every((source) => source.uma);
  const sourceLabel = uma
    ? `${SLOT_SOURCE_LABELS[slot]}（${uma.name}）`
    : SLOT_SOURCE_LABELS[slot];
  const receivingLabel = uma
    ? `${SLOT_LABELS[slot]}（${uma.name}）`
    : SLOT_LABELS[slot];
  const minimumUsedSlots = needed.reduce(
    (total, item) => total + factorSlotsForStars(item.stars || 0),
    0,
  );
  const probabilitySlots = Math.max(0, availableSlots - minimumUsedSlots);
  const freeSlotFill =
    preferredFactors.length && probabilitySlots > 0 ? (
      <div class="successionRequirementFreeFill">
        <strong>剩余 {probabilitySlots} 槽</strong>
        <span>
          继续枚举为
          {preferredFactors.map((type) => APTITUDE_LABELS[type]).join(" / ")}
          红因子（全部 3★）
        </span>
      </div>
    ) : null;
  return (
    <article class={`successionPositionRequirement ${branch}`}>
      <header>
        <span class="successionRequirementSourceTitle">{sourceLabel}</span>
        <div class="successionRequirementPositionMeta">
          <strong>{SLOT_LABELS[slot]}</strong>
          {uma && (
            <div class="successionRequirementUma" title={uma.name}>
              <UmaPortrait uma={uma} />
            </div>
          )}
        </div>
      </header>

      {!uma ? (
        <div class="successionRequirementState muted">
          先选择{SLOT_LABELS[slot]}，系统再反推{sourceLabel}
          的最低红因子。
        </div>
      ) : !inheritanceAptitudes.length ? (
        <div class="successionRequirementState muted">
          未选择想要继承的适性。
        </div>
      ) : impossible.length ? (
        <div class="successionRequirementState impossible">
          <strong>无法满足最低适性要求</strong>
          <div class="successionImpossibleRequirements">
            {impossible.map((item) => {
              const maximum = Math.min(
                RANKS.length - 1,
                item.base + FACTOR_STEPS.length - 1,
              );
              return (
                <span key={item.type} title={APTITUDE_LABELS[item.type]}>
                  <strong>{APTITUDE_LABELS[item.type]}</strong>
                  <b>最高</b>
                  <i>
                    <RankIcon value={item.base} compact />
                    <em>›</em>
                    <RankIcon value={maximum} compact />
                  </i>
                </span>
              );
            })}
          </div>
        </div>
      ) : !needed.length ? (
        <>
          <div class="successionRequirementState ready">
            当前马娘已满足赛程与红因子产出要求，{sourceLabel}无需补适性。
          </div>
          {freeSlotFill}
        </>
      ) : (
        <>
          <div class="successionRequirementNeeds">
            <small>{receivingLabel}总共需要被提供</small>
            <div>
              {needed.map((item) => (
                <span key={item.type}>
                  <strong class="successionRequirementStarCount">
                    {factorSlotsForStars(item.stars || 0)} 槽 × 3★
                  </strong>
                  <FactorIcon type={item.type} compact />
                </span>
              ))}
            </div>
          </div>
          {sourceSelections.length > 0 && (
            <div class="successionRequirementSources">
              {sourceSelections.map((source) => (
                <div
                  class={source.uma ? "selected" : "empty"}
                  key={source.slot}
                >
                  <span>{SLOT_LABELS[source.slot]}</span>
                  {source.uma ? (
                    <>
                      <UmaPortrait uma={source.uma} />
                      <strong>{source.uma.name}</strong>
                      <small>
                        {needed.map((item) => (
                          <b
                            class={
                              source.uma?.aptitudes[item.type] === 7
                                ? "ready"
                                : "missing"
                            }
                            key={item.type}
                          >
                            <FactorIcon type={item.type} compact />
                            <RankIcon
                              value={source.uma?.aptitudes[item.type] || 0}
                              compact
                            />
                          </b>
                        ))}
                      </small>
                    </>
                  ) : (
                    <em>未固定</em>
                  )}
                </div>
              ))}
            </div>
          )}
          <div class="successionRequirementCandidates">
            <small>
              {sourceSelections.length
                ? "未固定位置可选候选"
                : `${sourceLabel}候选`}{" "}
              · 所需红因子适性原始 A
            </small>
            {sourcesLocked ? (
              <p>
                {sourceLabel}
                已全部固定；上方红色适性表示该马娘不能产出所需红因子。
              </p>
            ) : candidates.length ? (
              <div>
                {candidates.map((candidate) => (
                  <article key={candidate.uma.id}>
                    <UmaPortrait uma={candidate.uma} />
                    <span>
                      <strong>{candidate.uma.name}</strong>
                      <small>相性适配 +{candidate.score}</small>
                    </span>
                    <div>
                      {needed.map((item) => (
                        <b
                          key={item.type}
                          title={`${APTITUDE_LABELS[item.type]} A`}
                        >
                          <FactorIcon type={item.type} compact />
                          <RankIcon value={7} compact />
                        </b>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>没有能够产出全部所需红因子的候选。</p>
            )}
          </div>
          {freeSlotFill}
        </>
      )}
    </article>
  );
}

export function SuccessionPlanner() {
  const [initialSettings] = useState(loadStoredSuccessionSettings);
  const [targetId, setTargetId] = useState(initialSettings.targetId);
  const [lineage, setLineage] = useState(initialSettings.lineage);
  const [trainedUmaSettings, setTrainedUmaSettings] =
    useState<TrainedUmaSettings>(initialSettings.trainedUmaSettings);
  const [routes, setRoutes] = useState<Record<BranchKey, string>>(
    initialSettings.routes,
  );
  const [routeMinimums, setRouteMinimums] = useState<RouteMinimums>(
    initialSettings.routeMinimums,
  );
  const [inheritanceAptitudes, setInheritanceAptitudes] = useState<FactorKey[]>(
    initialSettings.inheritanceAptitudes,
  );
  const [inheritanceTargets, setInheritanceTargets] =
    useState<InheritanceTargets>(initialSettings.inheritanceTargets);
  const [allowInRaceFactorJump, setAllowInRaceFactorJump] = useState(
    initialSettings.allowInRaceFactorJump,
  );
  const [inRaceFactorJumpMinimumRank, setInRaceFactorJumpMinimumRank] =
    useState(initialSettings.inRaceFactorJumpMinimumRank);
  const [excludedUmaIds, setExcludedUmaIds] = useState<number[]>(
    initialSettings.excludedUmaIds,
  );
  const [slotRouteOverrides, setSlotRouteOverrides] =
    useState<SlotRouteOverrides>(initialSettings.slotRouteOverrides);
  const [probabilityTargetRanks, setProbabilityTargetRanks] =
    useState<InheritanceTargets>({});
  const [
    configuredProbabilityTargetTypes,
    setConfiguredProbabilityTargetTypes,
  ] = useState<FactorKey[]>([]);
  const [calculationRequestId, setCalculationRequestId] = useState(0);
  const [calculationInputKey, setCalculationInputKey] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStage, setCalculationStage] = useState(0);
  const [completedCalculation, setCompletedCalculation] =
    useState<CompletedCalculation>();
  const [draggedLineageSlot, setDraggedLineageSlot] =
    useState<LineageSlot | null>(null);
  const [lineageDropSlot, setLineageDropSlot] = useState<LineageSlot | null>(
    null,
  );
  const calculationRunToken = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(
        SUCCESSION_STORAGE_KEY,
        JSON.stringify({
          targetId,
          lineage,
          routes,
          routeMinimums,
          inheritanceAptitudes,
          inheritanceTargets,
          allowInRaceFactorJump,
          inRaceFactorJumpMinimumRank,
          excludedUmaIds,
          slotRouteOverrides,
          trainedUmaSettings,
        }),
      );
    } catch {
      // The planner still works when browser storage is unavailable.
    }
  }, [
    targetId,
    lineage,
    routes,
    routeMinimums,
    inheritanceAptitudes,
    inheritanceTargets,
    allowInRaceFactorJump,
    inRaceFactorJumpMinimumRank,
    excludedUmaIds,
    slotRouteOverrides,
    trainedUmaSettings,
  ]);

  const umaById = useMemo(
    () => new Map(data.umas.map((uma) => [uma.id, uma])),
    [],
  );
  const target = umaById.get(targetId);
  const excludedUmaIdSet = useMemo(
    () => new Set(excludedUmaIds),
    [excludedUmaIds.join("|")],
  );
  const currentCalculationInputKey = JSON.stringify({
    targetId,
    lineage,
    routes,
    routeMinimums,
    inheritanceAptitudes,
    inheritanceTargets,
    allowInRaceFactorJump,
    inRaceFactorJumpMinimumRank,
    probabilityTargetRanks,
    excludedUmaIds,
    slotRouteOverrides,
    trainedUmaSettings,
  });
  const calculationReady =
    calculationRequestId > 0 &&
    calculationInputKey === currentCalculationInputKey;
  const selectedLineageIds = Object.values(lineage).filter(Boolean);
  const excludedIdsForSlot = (slot: LineageSlot) => {
    const isParent = slot === "father" || slot === "mother";
    const sameBranchGrandparents = slot.startsWith("paternal")
      ? [lineage.paternalA, lineage.paternalB]
      : [lineage.maternalA, lineage.maternalB];
    const ids = isParent
      ? [targetId, ...selectedLineageIds]
      : [targetId, lineage.father, lineage.mother, ...sameBranchGrandparents];
    return [...new Set(ids.filter((id) => id && id !== lineage[slot]))];
  };
  const selectedRoutes = {
    paternal: ROUTES.find((route) => route.id === routes.paternal) || ROUTES[0],
    maternal: ROUTES.find((route) => route.id === routes.maternal) || ROUTES[1],
  };
  const branchForSlot = (slot: LineageSlot): BranchKey =>
    slot === "father" || slot.startsWith("paternal") ? "paternal" : "maternal";
  const routeSettingForSlot = (slot: LineageSlot, umaId = lineage[slot]) => {
    const branch = branchForSlot(slot);
    const fixedSlot = umaId
      ? BRANCH_SLOTS[branch].find(
          (candidateSlot) => lineage[candidateSlot] === umaId,
        )
      : undefined;
    const overrideSlot =
      fixedSlot && slotRouteOverrides[fixedSlot] ? fixedSlot : undefined;
    const override = overrideSlot
      ? slotRouteOverrides[overrideSlot]
      : undefined;
    const minimums = override?.minimums || routeMinimums[branch];
    const fixedUma = fixedSlot ? umaById.get(umaId) : undefined;
    return {
      route:
        ROUTES.find((route) => route.id === override?.routeId) ||
        selectedRoutes[branch],
      minimums: fixedUma
        ? fitMinimumsForUma(
            minimums,
            fixedUma,
            ROUTES.find((route) => route.id === override?.routeId) ||
              selectedRoutes[branch],
          )
        : minimums,
    };
  };
  const commonG1Count = (first: Route, second: Route) => {
    if (first.id === "none" || second.id === "none") return 0;
    return first.id === second.id ? first.g1Count : DIFFERENT_ROUTE_COMMON_G1;
  };
  const targetInheritanceAllocations = target
    ? inheritanceAllocation(target, inheritanceAptitudes, inheritanceTargets)
    : [];
  const rawTargetFactorPlanEnumerator = useMemo(
    () =>
      calculationReady
        ? createTargetFactorPlanEnumerator(
            inheritanceAptitudes,
            target
              ? Object.fromEntries(
                  inheritanceAllocation(
                    target,
                    inheritanceAptitudes,
                    inheritanceTargets,
                  ).map((item) => [item.type, item.stars]),
                )
              : {},
          )
        : EMPTY_TARGET_FACTOR_PLAN_ENUMERATOR,
    [
      calculationReady,
      targetId,
      inheritanceAptitudes.join("|"),
      JSON.stringify(inheritanceTargets),
    ],
  );
  useEffect(() => {
    if (!target) {
      setProbabilityTargetRanks({});
      setConfiguredProbabilityTargetTypes([]);
      return;
    }
    const guaranteedRanks = new Map(
      inheritanceAllocation(
        target,
        inheritanceAptitudes,
        inheritanceTargets,
      ).map((item) => [item.type, item.target]),
    );
    setProbabilityTargetRanks((current) =>
      Object.fromEntries(
        inheritanceAptitudes.map((type) => {
          const guaranteed =
            guaranteedRanks.get(type) || target.aptitudes[type];
          const defaultTarget = guaranteed >= 7 ? 8 : 7;
          const selectedTarget = configuredProbabilityTargetTypes.includes(type)
            ? current[type] || defaultTarget
            : defaultTarget;
          return [type, Math.min(8, Math.max(guaranteed, selectedTarget))];
        }),
      ),
    );
  }, [
    targetId,
    inheritanceAptitudes.join("|"),
    JSON.stringify(inheritanceTargets),
  ]);

  const relationScore = (...ids: number[]) => {
    if (
      !ids.length ||
      ids.some((value) => !value) ||
      new Set(ids).size !== ids.length
    ) {
      return 0;
    }
    const relationSets = ids.map(
      (id) => new Set(umaById.get(id)?.relationTypes || []),
    );
    if (relationSets.some((set) => !set.size)) return 0;
    const shared = [...relationSets[0]].filter((type) =>
      relationSets.slice(1).every((set) => set.has(type)),
    );
    return shared.reduce(
      (total, type) => total + (data.relationPoints[String(type)] || 0),
      0,
    );
  };

  const positionScore = (
    slot: LineageSlot,
    branch: BranchKey,
    parentId?: number,
  ): PositionCompatibilityScore => {
    const umaId = lineage[slot];
    const base =
      !target || !umaId
        ? 0
        : parentId
          ? relationScore(targetId, parentId, umaId)
          : relationScore(targetId, umaId);
    const isParentSlot = slot === "father" || slot === "mother";
    const slotRoute = routeSettingForSlot(slot).route;
    const parentSlot = branch === "paternal" ? "father" : "mother";
    const g1Count =
      !umaId || isParentSlot
        ? 0
        : commonG1Count(routeSettingForSlot(parentSlot).route, slotRoute);
    const relationNames = [
      target?.name,
      parentId ? umaById.get(parentId)?.name : undefined,
      umaById.get(umaId)?.name,
    ].filter((name): name is string => Boolean(name));
    return {
      base,
      g1Count,
      relationNames,
      total: umaId ? base + g1Count * G1_COMPATIBILITY_POINTS : 0,
    };
  };

  const parentPairBase = relationScore(lineage.father, lineage.mother);
  const parentPairCompatibility = parentPairBase;

  const paternalACompatibility = positionScore(
    "paternalA",
    "paternal",
    lineage.father,
  );
  const paternalBCompatibility = positionScore(
    "paternalB",
    "paternal",
    lineage.father,
  );
  const fatherBaseCompatibility = positionScore("father", "paternal");
  const fatherG1Count =
    paternalACompatibility.g1Count + paternalBCompatibility.g1Count;
  const fatherOwnCompatibility: PositionCompatibilityScore = {
    ...fatherBaseCompatibility,
    g1Count: fatherG1Count,
    total:
      fatherBaseCompatibility.base +
      fatherG1Count * G1_COMPATIBILITY_POINTS,
  };
  const fatherCompatibility: PositionCompatibilityScore = {
    ...fatherOwnCompatibility,
    ownTotal: fatherOwnCompatibility.total,
    inheritedTotal: paternalACompatibility.base + paternalBCompatibility.base,
    coParentLabel: SLOT_LABELS.mother,
    coParentName: umaById.get(lineage.mother)?.name,
    coParentBase: parentPairBase,
    coParentTotal: parentPairCompatibility,
    ancestorDetails: [
      {
        label: SLOT_LABELS.paternalA,
        umaName: umaById.get(lineage.paternalA)?.name,
        ...paternalACompatibility,
      },
      {
        label: SLOT_LABELS.paternalB,
        umaName: umaById.get(lineage.paternalB)?.name,
        ...paternalBCompatibility,
      },
    ],
    total:
      fatherOwnCompatibility.total +
      parentPairCompatibility +
      paternalACompatibility.base +
      paternalBCompatibility.base,
  };

  const maternalACompatibility = positionScore(
    "maternalA",
    "maternal",
    lineage.mother,
  );
  const maternalBCompatibility = positionScore(
    "maternalB",
    "maternal",
    lineage.mother,
  );
  const motherBaseCompatibility = positionScore("mother", "maternal");
  const motherG1Count =
    maternalACompatibility.g1Count + maternalBCompatibility.g1Count;
  const motherOwnCompatibility: PositionCompatibilityScore = {
    ...motherBaseCompatibility,
    g1Count: motherG1Count,
    total:
      motherBaseCompatibility.base +
      motherG1Count * G1_COMPATIBILITY_POINTS,
  };
  const motherCompatibility: PositionCompatibilityScore = {
    ...motherOwnCompatibility,
    ownTotal: motherOwnCompatibility.total,
    inheritedTotal: maternalACompatibility.base + maternalBCompatibility.base,
    coParentLabel: SLOT_LABELS.father,
    coParentName: umaById.get(lineage.father)?.name,
    coParentBase: parentPairBase,
    coParentTotal: parentPairCompatibility,
    ancestorDetails: [
      {
        label: SLOT_LABELS.maternalA,
        umaName: umaById.get(lineage.maternalA)?.name,
        ...maternalACompatibility,
      },
      {
        label: SLOT_LABELS.maternalB,
        umaName: umaById.get(lineage.maternalB)?.name,
        ...maternalBCompatibility,
      },
    ],
    total:
      motherOwnCompatibility.total +
      parentPairCompatibility +
      maternalACompatibility.base +
      maternalBCompatibility.base,
  };

  const positionCompatibility: Record<LineageSlot, PositionCompatibilityScore> =
    {
      father: fatherCompatibility,
      paternalA: paternalACompatibility,
      paternalB: paternalBCompatibility,
      mother: motherCompatibility,
      maternalA: maternalACompatibility,
      maternalB: maternalBCompatibility,
    };
  const branchConfigs: Record<
    BranchKey,
    { parent: LineageSlot; grandparents: [LineageSlot, LineageSlot] }
  > = {
    paternal: {
      parent: "father",
      grandparents: ["paternalA", "paternalB"],
    },
    maternal: {
      parent: "mother",
      grandparents: ["maternalA", "maternalB"],
    },
  };
  const lineageFullyUnfixed = TARGET_FACTOR_SLOTS.every(
    (slot) => !lineage[slot],
  );
  const branchSettingsEquivalent =
    routes.paternal === routes.maternal &&
    ALL_APTITUDES.every(
      (type) =>
        routeMinimums.paternal[type] === routeMinimums.maternal[type],
    );
  const branchesInterchangeable =
    lineageFullyUnfixed &&
    branchSettingsEquivalent &&
    !Object.keys(trainedUmaSettings).length;
  const factorProductionMinimumRank = allowInRaceFactorJump
    ? inRaceFactorJumpMinimumRank
    : 7;
  const factorPlanBranchKey = (
    plan: TargetFactorPlan,
    branch: BranchKey,
  ) => {
    const { parent, grandparents } = branchConfigs[branch];
    const grandparentKeys = grandparents
      .map((slot) => factorAssignmentKey(plan.assignments[slot]))
      .sort();
    return [
      factorAssignmentKey(plan.assignments[parent]),
      ...grandparentKeys,
    ].join("|");
  };

  const buildBranchStrategies = (
    factorPlan: TargetFactorPlan,
    branch: BranchKey,
  ): BranchFactorStrategy[] => {
    const { parent, grandparents } = branchConfigs[branch];
    const slots: [LineageSlot, LineageSlot, LineageSlot] = [
      parent,
      ...grandparents,
    ];
    const trainedParent = trainedUmaSettings[parent];
    if (trainedParent) {
      const trainedMembers = [trainedParent.self, ...trainedParent.parents];
      const trainedUmas = trainedMembers.map((member) =>
        umaById.get(member.umaId),
      );
      if (trainedUmas.some((uma) => !uma)) return [];
      return [
        {
          positions: slots.map((slot, index) => ({
            code: SLOT_CODES[slot],
            generation: index === 0 ? 1 : 2,
            uma: trainedUmas[index]!,
            factor: trainedMembers[index].factor,
            fixed: true,
            requiresUma: true,
          })),
          cumulativeRequirements: [],
          greatFactorRequirements: {
            parent: {},
            grandparents: [{}, {}],
          },
        },
      ];
    }
    const effectiveAssignmentForSlot = (slot: LineageSlot): FactorAssignment => {
      const trainedFactor = trainedUmaSettings[slot]?.self.factor;
      return trainedFactor ? { ...trainedFactor } : factorPlan.assignments[slot];
    };
    const factorRequirementForCandidate = (
      slot: LineageSlot,
      candidate: SuccessionUma,
      producedType?: FactorKey,
    ) => {
      const trainedSelf = trainedUmaSettings[slot]?.self;
      if (trainedSelf?.umaId === candidate.id) {
        return { demand: {}, impossible: [] as FactorKey[] };
      }
      const setting = routeSettingForSlot(slot, candidate.id);
      return factorDemandForUma(
        candidate,
        setting.route,
        setting.minimums,
        producedType,
        factorProductionMinimumRank,
      );
    };
    const inRaceFactorJumpForCandidate = (
      slot: LineageSlot,
      candidate: SuccessionUma,
      assignment: FactorAssignment,
    ): CompleteDesignPosition["inRaceFactorJump"] => {
      if (
        trainedUmaSettings[slot] ||
        !allowInRaceFactorJump ||
        assignment.unconstrained ||
        candidate.aptitudes[assignment.type] >= 7
      ) {
        return undefined;
      }
      const setting = routeSettingForSlot(slot, candidate.id);
      const fromRank = Math.max(
        setting.route.aptitudes.includes(assignment.type)
          ? setting.minimums[assignment.type]
          : 0,
        factorProductionMinimumRank,
      );
      const requiredStars = minimumStarsForRank(
        candidate.aptitudes[assignment.type],
        fromRank,
      );
      if (fromRank >= 7 || !requiredStars) return undefined;
      return {
        type: assignment.type,
        fromRank,
        toRank: 7,
      };
    };
    const candidateCanProduceConfiguredFactor = (
      slot: LineageSlot,
      candidate: SuccessionUma,
    ) =>
      inheritanceAptitudes.some((type) => {
        const requirement = factorRequirementForCandidate(
          slot,
          candidate,
          type,
        );
        return (
          !requirement.impossible.length &&
          demandSlotCount(requirement.demand) <= MAX_INHERITANCE_SLOTS
        );
      });
    const buildCandidateList = (
      slot: LineageSlot,
      allowedFixedUmas?: SuccessionUma[],
    ) => {
      const trainedSelf = trainedUmaSettings[slot]?.self;
      if (trainedSelf) {
        const trainedUma = umaById.get(trainedSelf.umaId);
        return trainedUma ? [trainedUma] : [];
      }
      const assignment = effectiveAssignmentForSlot(slot);
      return data.umas
        .filter((candidate) => {
          if (candidate.id === targetId) return false;
          const fixedCandidate =
            lineage[slot] === candidate.id ||
            Boolean(allowedFixedUmas?.some((uma) => uma.id === candidate.id));
          if (excludedUmaIdSet.has(candidate.id) && !fixedCandidate) {
            return false;
          }
          if (
            allowedFixedUmas?.length === 2 &&
            !allowedFixedUmas.some((uma) => uma.id === candidate.id)
          ) {
            return false;
          }
          if (
            assignment.unconstrained &&
            candidateCanProduceConfiguredFactor(slot, candidate)
          ) {
            // “自由”是该马娘无法产出任何目标红因子时的兜底，不与
            // 可产出的具体红因子方案一起参与同概率候选。
            return false;
          }
          const requirement = factorRequirementForCandidate(
            slot,
            candidate,
            assignment.unconstrained ? undefined : assignment.type,
          );
          return (
            !requirement.impossible.length &&
            demandSlotCount(requirement.demand) <= MAX_INHERITANCE_SLOTS
          );
        })
        .map((candidate) => {
          const setting = routeSettingForSlot(slot, candidate.id);
          return {
            candidate,
            factorQuality:
              assignment.unconstrained
                ? 0
                : candidate.aptitudes[assignment.type],
            routeQuality: setting.route.aptitudes.reduce(
              (total, type) => total + candidate.aptitudes[type],
              0,
            ),
            compatibility: relationScore(targetId, candidate.id),
          };
        })
        .sort(
          (a, b) =>
            b.factorQuality - a.factorQuality ||
            b.routeQuality - a.routeQuality ||
            b.compatibility - a.compatibility ||
            a.candidate.name.localeCompare(b.candidate.name, "zh-CN"),
        )
        .map(({ candidate }) => candidate);
    };

    const fixedParent = umaById.get(lineage[parent]);
    const fixedGrandparents = grandparents
      .map((slot) => umaById.get(lineage[slot]))
      .filter(
        (uma, index, values): uma is SuccessionUma =>
          Boolean(uma) &&
          values.findIndex((candidate) => candidate?.id === uma?.id) === index,
      );
    const fixedGrandparentIds = new Set(fixedGrandparents.map((uma) => uma.id));
    const candidateLists: [SuccessionUma[], SuccessionUma[], SuccessionUma[]] =
      [
        fixedParent ? [fixedParent] : buildCandidateList(parent),
        buildCandidateList(grandparents[0], fixedGrandparents),
        buildCandidateList(grandparents[1], fixedGrandparents),
      ];
    const pruneDominatedParents = (candidates: SuccessionUma[]) => {
      if (fixedParent) return candidates;
      const assignment = effectiveAssignmentForSlot(parent);
      const parentSetting = routeSettingForSlot(parent);
      const relevantTypes = [
        ...new Set([
          ...parentSetting.route.aptitudes,
          ...(assignment.unconstrained ? [] : [assignment.type]),
        ]),
      ];
      const targetRelationTypes = new Set(target?.relationTypes || []);
      const fixedCoParentId =
        branch === "paternal" ? lineage.mother : lineage.father;
      const metrics = new Map(
        candidates.map((candidate) => {
          const relationTypes = new Set(candidate.relationTypes);
          return [
            candidate.id,
            {
              compatibility: relationScore(targetId, candidate.id),
              coParentCompatibility: fixedCoParentId
                ? relationScore(candidate.id, fixedCoParentId)
                : 0,
              demand: factorRequirementForCandidate(
                parent,
                candidate,
                assignment.unconstrained ? undefined : assignment.type,
              ).demand,
              relationTypes,
              sharedTargetRelationTypes: new Set(
                candidate.relationTypes.filter((type) =>
                  targetRelationTypes.has(type),
                ),
              ),
            },
          ] as const;
        }),
      );
      return candidates.filter((candidate) => {
        if (fixedGrandparentIds.has(candidate.id)) return false;
        const candidateMetrics = metrics.get(candidate.id)!;
        return !candidates.some((other) => {
          if (other.id === candidate.id || fixedGrandparentIds.has(other.id)) {
            return false;
          }
          const otherMetrics = metrics.get(other.id)!;
          const aptitudeNoWorse = relevantTypes.every(
            (type) => other.aptitudes[type] >= candidate.aptitudes[type],
          );
          const demandNoWorse = ALL_APTITUDES.every(
            (type) =>
              (otherMetrics.demand[type] || 0) <=
              (candidateMetrics.demand[type] || 0),
          );
          const targetRelationsCover = [
            ...candidateMetrics.sharedTargetRelationTypes,
          ].every((type) => otherMetrics.sharedTargetRelationTypes.has(type));
          const coParentRelationsNoWorse = fixedCoParentId
            ? otherMetrics.coParentCompatibility >=
              candidateMetrics.coParentCompatibility
            : [...candidateMetrics.relationTypes].every((type) =>
                otherMetrics.relationTypes.has(type),
              );
          const compatibilityNoWorse =
            otherMetrics.compatibility >= candidateMetrics.compatibility;
          const strictlyBetter =
            relevantTypes.some(
              (type) => other.aptitudes[type] > candidate.aptitudes[type],
            ) ||
            ALL_APTITUDES.some(
              (type) =>
                (otherMetrics.demand[type] || 0) <
                (candidateMetrics.demand[type] || 0),
            ) ||
            otherMetrics.compatibility > candidateMetrics.compatibility ||
            (fixedCoParentId
              ? otherMetrics.coParentCompatibility >
                candidateMetrics.coParentCompatibility
              : otherMetrics.relationTypes.size >
                candidateMetrics.relationTypes.size);
          return (
            aptitudeNoWorse &&
            demandNoWorse &&
            targetRelationsCover &&
            coParentRelationsNoWorse &&
            compatibilityNoWorse &&
            strictlyBetter
          );
        });
      });
    };
    candidateLists[0] = pruneDominatedParents(candidateLists[0]);
    const pruneDominatedGrandparents = (
      candidates: SuccessionUma[],
      slot: LineageSlot,
      parentUma: SuccessionUma,
    ) => {
      if (fixedGrandparents.length === 2) return candidates;
      const assignment = effectiveAssignmentForSlot(slot);
      const slotSetting = routeSettingForSlot(slot);
      const relevantTypes = [
        ...new Set([
          ...slotSetting.route.aptitudes,
          ...(assignment.unconstrained ? [] : [assignment.type]),
        ]),
      ];
      const metrics = new Map(
        candidates.map((candidate) => [
          candidate.id,
          {
            compatibility: relationScore(targetId, parentUma.id, candidate.id),
            demand: factorRequirementForCandidate(
              slot,
              candidate,
              assignment.unconstrained ? undefined : assignment.type,
            ).demand,
          },
        ]),
      );
      return candidates.filter((candidate) => {
        if (fixedGrandparentIds.has(candidate.id)) {
          return true;
        }
        const candidateMetrics = metrics.get(candidate.id)!;
        return !candidates.some((other) => {
          if (other.id === candidate.id || fixedGrandparentIds.has(other.id)) {
            return false;
          }
          const otherMetrics = metrics.get(other.id)!;
          const aptitudeNoWorse = relevantTypes.every(
            (type) => other.aptitudes[type] >= candidate.aptitudes[type],
          );
          const demandNoWorse = ALL_APTITUDES.every(
            (type) =>
              (otherMetrics.demand[type] || 0) <=
              (candidateMetrics.demand[type] || 0),
          );
          const compatibilityNoWorse =
            otherMetrics.compatibility >= candidateMetrics.compatibility;
          const strictlyBetter =
            relevantTypes.some(
              (type) => other.aptitudes[type] > candidate.aptitudes[type],
            ) ||
            ALL_APTITUDES.some(
              (type) =>
                (otherMetrics.demand[type] || 0) <
                (candidateMetrics.demand[type] || 0),
            ) ||
            otherMetrics.compatibility > candidateMetrics.compatibility;
          return (
            aptitudeNoWorse &&
            demandNoWorse &&
            compatibilityNoWorse &&
            strictlyBetter
          );
        });
      });
    };
    const grandparentAssignmentsEquivalent =
      effectiveFactorRoleKey(effectiveAssignmentForSlot(grandparents[0])) ===
      effectiveFactorRoleKey(effectiveAssignmentForSlot(grandparents[1]));
    function* grandparentPairs(
      parentUma: SuccessionUma,
    ): Generator<[SuccessionUma, SuccessionUma]> {
      let firstCandidates = pruneDominatedGrandparents(
        candidateLists[1],
        grandparents[0],
        parentUma,
      );
      let secondCandidates = pruneDominatedGrandparents(
        candidateLists[2],
        grandparents[1],
        parentUma,
      );
      if (!fixedGrandparents.length && !grandparentAssignmentsEquivalent) {
        const sharedCandidates = [
          ...new Map(
            [...firstCandidates, ...secondCandidates].map((uma) => [
              uma.id,
              uma,
            ]),
          ).values(),
        ].sort((a, b) => a.id - b.id);
        firstCandidates = sharedCandidates;
        secondCandidates = sharedCandidates;
      }
      const firstGrandparentById = new Map(
        firstCandidates.map((uma) => [uma.id, uma]),
      );
      const secondGrandparentById = new Map(
        secondCandidates.map((uma) => [uma.id, uma]),
      );
      if (fixedGrandparents.length === 1) {
        const fixedUma = fixedGrandparents[0];
        const fixedAsFirst = firstGrandparentById.get(fixedUma.id);
        if (fixedAsFirst) {
          for (const secondUma of secondCandidates) {
            if (secondUma.id !== fixedUma.id) yield [fixedAsFirst, secondUma];
          }
        }
        if (!grandparentAssignmentsEquivalent) {
          const fixedAsSecond = secondGrandparentById.get(fixedUma.id);
          if (fixedAsSecond) {
            for (const firstUma of firstCandidates) {
              if (firstUma.id !== fixedUma.id) yield [firstUma, fixedAsSecond];
            }
          }
        }
        return;
      }

      if (fixedGrandparents.length === 2) {
        const [firstFixed, secondFixed] = fixedGrandparents;
        const directPair = [
          firstGrandparentById.get(firstFixed.id),
          secondGrandparentById.get(secondFixed.id),
        ] as const;
        if (directPair[0] && directPair[1]) {
          yield [directPair[0], directPair[1]];
        }
        if (!grandparentAssignmentsEquivalent) {
          const swappedPair = [
            firstGrandparentById.get(secondFixed.id),
            secondGrandparentById.get(firstFixed.id),
          ] as const;
          if (swappedPair[0] && swappedPair[1]) {
            yield [swappedPair[0], swappedPair[1]];
          }
        }
        return;
      }

      for (
        let firstIndex = 0;
        firstIndex < firstCandidates.length;
        firstIndex += 1
      ) {
        for (
          let secondIndex = 0;
          secondIndex < secondCandidates.length;
          secondIndex += 1
        ) {
          const firstUma = firstCandidates[firstIndex];
          const secondUma = secondCandidates[secondIndex];
          // 空祖辈槽没有左右语义：马娘组合只按 ID 升序生成一次。
          // 不同因子角色在下方交换 assignment，而不是反向遍历马娘。
          if (firstUma.id >= secondUma.id) continue;
          yield [firstUma, secondUma];
        }
      }
    }

    const strategies: BranchFactorStrategy[] = [];
    const seenStrategies = new Set<string>();
    for (const parentUma of candidateLists[0]) {
      for (const [firstGrandparent, secondGrandparent] of grandparentPairs(
        parentUma,
      )) {
        const directUmas = [parentUma, firstGrandparent, secondGrandparent];
        if (new Set(directUmas.map((uma) => uma.id)).size !== 3) continue;

        const parentAssignment = effectiveAssignmentForSlot(parent);
        if (
          parentAssignment.unconstrained &&
          candidateCanProduceConfiguredFactor(parent, parentUma)
        ) {
          continue;
        }
        const parentRequirement = factorRequirementForCandidate(
          parent,
          parentUma,
          parentAssignment.unconstrained
            ? undefined
            : parentAssignment.type,
        );
        if (
          parentRequirement.impossible.length ||
          demandSlotCount(parentRequirement.demand) > MAX_INHERITANCE_SLOTS
        ) {
          continue;
        }

        const usefulFreeTypes = ALL_APTITUDES.filter(
          (type) => (parentRequirement.demand[type] || 0) > 0,
        );
        const baseGrandparentAssignments = grandparents.map(
          (slot) => effectiveAssignmentForSlot(slot),
        );
        const grandparentAssignmentOrders =
          !fixedGrandparents.length && !grandparentAssignmentsEquivalent
            ? [
                baseGrandparentAssignments,
                [
                  baseGrandparentAssignments[1],
                  baseGrandparentAssignments[0],
                ],
              ]
            : [baseGrandparentAssignments];
        for (const grandparentAssignments of grandparentAssignmentOrders) {
          const grandparentFactorChoices = grandparentAssignments.map(
            (assignment) => {
              if (!assignment.unconstrained) return [assignment];
              return [
                ...usefulFreeTypes.map(
                  (type): FactorAssignment => ({ type, stars: 3 }),
                ),
                assignment,
              ];
            },
          );
          let resolvedGrandparentAssignments: FactorAssignment[] | undefined;
          let grandparentRequirements:
            | ReturnType<typeof factorDemandForUma>[]
            | undefined;
          let parentRemaining: FactorDemand | undefined;
          let bestAssignmentScore = Number.POSITIVE_INFINITY;
          grandparentFactorChoices[0].forEach((firstFactor) => {
            grandparentFactorChoices[1].forEach((secondFactor) => {
              const assignments = [firstFactor, secondFactor];
              const requirements = grandparents.map((_, index) => {
                return factorRequirementForCandidate(
                  grandparents[index],
                  directUmas[index + 1],
                  assignments[index].unconstrained
                    ? undefined
                    : assignments[index].type,
                );
              });
              if (
                requirements.some(
                  (item) =>
                    item.impossible.length ||
                    demandSlotCount(item.demand) > MAX_INHERITANCE_SLOTS,
                )
              ) {
                return;
              }
              const remaining = remainingFactorDemand(
                parentRequirement.demand,
                assignments,
              );
              const remainingSlots = demandSlotCount(remaining);
              if (remainingSlots > 4) return;
              const score =
                remainingSlots * 100 +
                requirements.reduce(
                  (total, item) => total + demandSlotCount(item.demand),
                  0,
                );
              if (score >= bestAssignmentScore) return;
              bestAssignmentScore = score;
              resolvedGrandparentAssignments = assignments;
              grandparentRequirements = requirements;
              parentRemaining = remaining;
            });
          });
          if (
            !resolvedGrandparentAssignments ||
            !grandparentRequirements ||
            !parentRemaining
          ) {
            continue;
          }

          const universe = [
            ...inheritanceAptitudes,
            ...ALL_APTITUDES.filter(
              (type) =>
                Boolean(parentRemaining[type]) ||
                grandparentRequirements.some((item) =>
                  Boolean(item.demand[type]),
                ),
            ),
          ].filter((type, index, values) => values.indexOf(type) === index);
          let greatAssignments: FactorAssignment[] | undefined =
            universe.length
              ? undefined
              : Array.from({ length: 4 }, () => ({
                  type: "turf" as const,
                  stars: 3 as const,
                  free: true,
                  unconstrained: true,
                }));
          const visitGreatAssignments = (types: FactorKey[]) => {
            if (greatAssignments) return;
            if (types.length < 4) {
              universe.forEach((type) =>
                visitGreatAssignments([...types, type]),
              );
              return;
            }
            const assignments = types.map((type) => ({
              type,
              stars: 3 as const,
            }));
            if (!demandSatisfied(parentRemaining, assignments)) return;
            const ancestorsFit = grandparents.every((_, index) => {
              const remaining = remainingFactorDemand(
                grandparentRequirements[index].demand,
                assignments.slice(index * 2, index * 2 + 2),
              );
              return demandSlotCount(remaining) <= 4;
            });
            if (ancestorsFit) greatAssignments = assignments;
          };
          visitGreatAssignments([]);
          if (!greatAssignments) continue;

          const positions: CompleteDesignPosition[] = slots.map(
            (slot, index) => {
              const factor =
                index === 0
                  ? parentAssignment
                  : resolvedGrandparentAssignments![index - 1];
              return {
                code: SLOT_CODES[slot],
                generation: index === 0 ? 1 : 2,
                uma: directUmas[index],
                factor,
                fixed:
                  index === 0
                    ? Boolean(lineage[parent])
                    : fixedGrandparentIds.has(directUmas[index].id) ||
                      Boolean(trainedUmaSettings[slot]),
                requiresUma: true,
                inRaceFactorJump: inRaceFactorJumpForCandidate(
                  slot,
                  directUmas[index],
                  factor,
                ),
              };
            },
          );
          const greatCodes = grandparents.flatMap((slot) => [
            `${SLOT_CODES[slot]}A`,
            `${SLOT_CODES[slot]}B`,
          ]);
          greatAssignments.forEach((factor, index) => {
            positions.push({
              code: greatCodes[index],
              generation: 3,
              factor,
              fixed: false,
              requiresUma: false,
            });
          });
          const demandOrderKey = (demand: FactorDemand) =>
            ALL_APTITUDES.map((type) => demand[type] || 0).join(":");
          const strategyKey = [
            directUmas.map((uma) => uma.id).join(":"),
            [parentAssignment, ...resolvedGrandparentAssignments]
              .map(effectiveFactorRoleKey)
              .join("|"),
            greatAssignments.map(effectiveFactorRoleKey).join("|"),
            demandOrderKey(parentRemaining),
            grandparentRequirements
              .map((requirement) => demandOrderKey(requirement.demand))
              .join("|"),
          ].join("||");
          if (seenStrategies.has(strategyKey)) continue;
          seenStrategies.add(strategyKey);
          strategies.push({
            positions,
            cumulativeRequirements: grandparents.map((slot, index) => ({
              code: SLOT_CODES[slot],
              demand: grandparentRequirements[index].demand,
            })),
            greatFactorRequirements: {
              parent: parentRemaining,
              grandparents: [
                grandparentRequirements[0].demand,
                grandparentRequirements[1].demand,
              ],
            },
          });
        }
      }
    }
    return strategies;
  };

  const validCompleteDesigns = useMemo(() => {
    if (!calculationReady) return [];
    const branchCaches: Record<
      BranchKey,
      Map<string, BranchFactorStrategy[]>
    > = {
      paternal: new Map(),
      maternal: new Map(),
    };
    const expandBranchFactorPlans = (
      plan: TargetFactorPlan,
      branch: BranchKey,
    ) => {
      const { parent, grandparents } = branchConfigs[branch];
      const slots: LineageSlot[] = [parent, ...grandparents];
      const freeFactorTypes = [...inheritanceAptitudes];
      const freeAssignmentOrder = (assignment: FactorAssignment) =>
        assignment.unconstrained
          ? ALL_APTITUDES.length
          : ALL_APTITUDES.indexOf(assignment.type);
      const variants: TargetFactorPlan[] = [];
      const visit = (
        index: number,
        assignments: Record<LineageSlot, FactorAssignment>,
      ) => {
        if (index >= slots.length) {
          variants.push({ assignments });
          return;
        }
        const slot = slots[index];
        const assignment = plan.assignments[slot];
        if (!assignment.free || assignment.unconstrained) {
          visit(index + 1, assignments);
          return;
        }
        freeFactorTypes.forEach((type) => {
          const firstGrandparentAssignment = assignments[grandparents[0]];
          if (
            slot === grandparents[1] &&
            plan.assignments[grandparents[0]].free &&
            ALL_APTITUDES.indexOf(type) <
              freeAssignmentOrder(firstGrandparentAssignment)
          ) {
            return;
          }
          visit(index + 1, {
            ...assignments,
            [slot]: { ...assignment, type },
          });
        });
        visit(index + 1, {
          ...assignments,
          [slot]: { ...assignment, unconstrained: true },
        });
      };
      visit(0, { ...plan.assignments });
      return variants;
    };
    return rawTargetFactorPlanEnumerator
      .getRange(0, rawTargetFactorPlanEnumerator.total)
      .filter(
        (plan) =>
          !branchesInterchangeable ||
          factorPlanBranchKey(plan, "paternal") <=
            factorPlanBranchKey(plan, "maternal"),
      )
      .map((plan) => {
        const getStrategies = (branch: BranchKey) => {
          const { parent, grandparents } = branchConfigs[branch];
          return expandBranchFactorPlans(plan, branch).flatMap((variant) => {
            const key = [parent, ...grandparents]
              .map((slot) => factorAssignmentKey(variant.assignments[slot]))
              .join("|");
            let strategies = branchCaches[branch].get(key);
            if (!strategies) {
              strategies = buildBranchStrategies(variant, branch);
              branchCaches[branch].set(key, strategies);
            }
            return strategies;
          });
        };
        const paternal = getStrategies("paternal");
        const maternal = getStrategies("maternal");
        return {
          plan,
          paternal,
          maternal,
        };
      })
      .filter((item) => item.paternal.length > 0 && item.maternal.length > 0);
  }, [
    calculationReady,
    calculationRequestId,
    rawTargetFactorPlanEnumerator,
    targetId,
    JSON.stringify(lineage),
    routes.paternal,
    routes.maternal,
    JSON.stringify(routeMinimums),
    JSON.stringify(slotRouteOverrides),
    inheritanceAptitudes.join("|"),
    factorProductionMinimumRank,
    excludedUmaIds.join("|"),
    branchesInterchangeable,
    JSON.stringify(trainedUmaSettings),
  ]);
  const probabilityTargetTypes = inheritanceAptitudes;
  const guaranteedFactorDemand: FactorDemand = Object.fromEntries(
    targetInheritanceAllocations.map((item) => [item.type, item.stars]),
  );
  const probabilityRequiredRaises = useMemo(() => {
    const raises: Partial<Record<FactorKey, number>> = {};
    if (!target) return raises;
    const guaranteedRanks = new Map(
      inheritanceAllocation(
        target,
        inheritanceAptitudes,
        inheritanceTargets,
      ).map((item) => [item.type, item.target]),
    );
    probabilityTargetTypes.forEach((type) => {
      const guaranteedRank =
        guaranteedRanks.get(type) || target.aptitudes[type];
      const probabilityTarget = Math.max(
        guaranteedRank,
        probabilityTargetRanks[type] || guaranteedRank,
      );
      raises[type] = Math.max(0, probabilityTarget - guaranteedRank);
    });
    return raises;
  }, [
    targetId,
    inheritanceAptitudes.join("|"),
    probabilityTargetTypes.join("|"),
    JSON.stringify(inheritanceTargets),
    JSON.stringify(probabilityTargetRanks),
  ]);
  const optimalCompleteDesign = useMemo(() => {
    if (!calculationReady || !validCompleteDesigns.length) {
      return undefined;
    }

    const minimumGreatFactorStars = (strategy: BranchFactorStrategy) => {
      const greatPositions = strategy.positions.filter(
        (position) => position.generation === 3,
      );
      if (greatPositions.length !== 4) return [3, 3, 3, 3];
      const requirementsSatisfied = (stars: number[]) => {
        const contributions = greatPositions.map((position, index) => ({
          type: position.factor.type,
          stars: stars[index],
        }));
        if (
          !demandSatisfied(
            strategy.greatFactorRequirements.parent,
            contributions,
          )
        ) {
          return false;
        }
        return strategy.greatFactorRequirements.grandparents.every(
          (demand, index) =>
            demandSlotCount(
              remainingFactorDemand(
                demand,
                contributions.slice(index * 2, index * 2 + 2),
              ),
            ) <= 4,
        );
      };
      for (let total = 0; total <= 12; total += 1) {
        let result: number[] | undefined;
        const visit = (index: number, remaining: number, stars: number[]) => {
          if (result) return;
          if (index === 4) {
            if (!remaining && requirementsSatisfied(stars)) result = stars;
            return;
          }
          for (let value = 0; value <= Math.min(3, remaining); value += 1) {
            visit(index + 1, remaining - value, [...stars, value]);
          }
        };
        visit(0, total, []);
        if (result) return result;
      }
      return [3, 3, 3, 3];
    };
    const resolvedPositionCache = new WeakMap<
      BranchFactorStrategy,
      CompleteDesignPosition[]
    >();
    const resolvedPositions = (...strategies: BranchFactorStrategy[]) =>
      strategies.flatMap((strategy) => {
        const cached = resolvedPositionCache.get(strategy);
        if (cached) return cached;
        const greatStars = minimumGreatFactorStars(strategy);
        const directPositions = strategy.positions
          .filter((position) => position.generation !== 3)
          .map((position) => ({
            ...position,
            factor: {
              type: position.factor.type,
              stars: position.factor.stars,
              ...(position.factor.unconstrained
                ? { free: true, unconstrained: true }
                : {}),
            },
          }));
        const greatPositions = strategy.positions.filter(
          (position) => position.generation === 3,
        );
        const groupedGreatRequirements = [0, 2].map((start) => {
          const pair = greatPositions.slice(start, start + 2);
          const minimumDemand: FactorDemand = {};
          const suppliedFactors = pair.map((position, pairIndex) => ({
            type: position.factor.type,
            stars: greatStars[start + pairIndex] || 0,
            unconstrained: position.factor.unconstrained,
          }));
          pair.forEach((position, pairIndex) => {
            const stars = greatStars[start + pairIndex] || 0;
            if (stars > 0) {
              minimumDemand[position.factor.type] =
                (minimumDemand[position.factor.type] || 0) + stars;
            }
          });
          const totalDemand =
            strategy.cumulativeRequirements[start / 2]?.demand || {};
          return {
            minimumDemand,
            cumulativeDemand: remainingFactorDemand(
              totalDemand,
              suppliedFactors,
            ),
          };
        });
        let grandparentIndex = 0;
        const resolved = directPositions.map((position) => {
          if (position.generation !== 2) return position;
          const requirements = groupedGreatRequirements[grandparentIndex];
          grandparentIndex += 1;
          return {
            ...position,
            minimumDemand: requirements?.minimumDemand || {},
            cumulativeDemand: requirements?.cumulativeDemand || {},
          };
        });
        resolvedPositionCache.set(strategy, resolved);
        return resolved;
      });
    const demandKey = (demand: FactorDemand) =>
      ALL_APTITUDES.filter((type) => (demand[type] || 0) > 0)
        .map((type) => `${type}:${demand[type]}`)
        .join(",");
    type BranchProbabilitySummary = {
      strategy: BranchFactorStrategy;
      parentId: number;
      factors: Array<ProbabilityFactor & { parent: boolean }>;
      positionCompatibilities: Record<
        string,
        { total: number; formula: string; parent: boolean }
      >;
    };
    const branchSummaryCache: Record<
      BranchKey,
      WeakMap<BranchFactorStrategy, BranchProbabilitySummary | null>
    > = {
      paternal: new WeakMap(),
      maternal: new WeakMap(),
    };
    const summarizeBranch = (
      strategy: BranchFactorStrategy,
      branch: BranchKey,
    ): BranchProbabilitySummary | undefined => {
      const cached = branchSummaryCache[branch].get(strategy);
      if (cached !== undefined) return cached || undefined;
      const parentCode = branch === "paternal" ? "A" : "B";
      const grandparentCodes =
        branch === "paternal"
          ? (["AA", "AB"] as const)
          : (["BA", "BB"] as const);
      const positionByCode = new Map(
        strategy.positions.map((position) => [position.code, position]),
      );
      const parentPosition = positionByCode.get(parentCode);
      const grandparentPositions = grandparentCodes.map((code) =>
        positionByCode.get(code),
      );
      const parentId = parentPosition?.uma?.id || 0;
      if (
        !parentPosition ||
        !parentId ||
        grandparentPositions.some((position) => !position?.uma)
      ) {
        branchSummaryCache[branch].set(strategy, null);
        return undefined;
      }
      const parentSlot = branch === "paternal" ? "father" : "mother";
      const grandparentSlots =
        branch === "paternal"
          ? (["paternalA", "paternalB"] as const)
          : (["maternalA", "maternalB"] as const);
      const parentRoute = routeSettingForSlot(parentSlot, parentId).route;
      const grandparentCompatibilityDetails = grandparentPositions.map(
        (position, index) => {
          const grandparentId = position?.uma?.id || 0;
          const grandparentRoute = routeSettingForSlot(
            grandparentSlots[index],
            grandparentId,
          ).route;
          const base = relationScore(targetId, parentId, grandparentId);
          const g1Count = commonG1Count(parentRoute, grandparentRoute);
          return {
            base,
            g1Count,
            total: base + g1Count * G1_COMPATIBILITY_POINTS,
          };
        },
      );
      const parentBaseCompatibility = relationScore(targetId, parentId);
      const parentLocalCompatibility =
        parentBaseCompatibility +
        grandparentCompatibilityDetails.reduce(
          (total, detail) => total + detail.total,
          0,
        );
      const factors: BranchProbabilitySummary["factors"] = [];
      const positionCompatibilities: BranchProbabilitySummary["positionCompatibilities"] =
        {
          [parentCode]: {
            total: parentLocalCompatibility,
            parent: true,
            formula: [
              `与目标基础相性 ${parentBaseCompatibility}`,
              ...grandparentCompatibilityDetails.map(
                (detail, index) =>
                  `${grandparentCodes[index]}三者基础相性 ${detail.base} + 与子代共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS}`,
              ),
            ].join(" + "),
          },
        };
      grandparentCodes.forEach((code, index) => {
        const detail = grandparentCompatibilityDetails[index];
        positionCompatibilities[code] = {
          total: detail.total,
          parent: false,
          formula: `三者基础相性 ${detail.base} + 与子代共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${detail.total}`,
        };
      });
      if (
        !parentPosition.factor.unconstrained &&
        probabilityTargetTypes.includes(parentPosition.factor.type)
      ) {
        factors.push({
          ...parentPosition.factor,
          compatibility: parentLocalCompatibility,
          parent: true,
        });
      }
      grandparentPositions.forEach((position, index) => {
        if (
          position &&
          !position.factor.unconstrained &&
          probabilityTargetTypes.includes(position.factor.type)
        ) {
          factors.push({
            ...position.factor,
            compatibility: grandparentCompatibilityDetails[index].total,
            parent: false,
          });
        }
      });
      const summary = {
        strategy,
        parentId,
        factors,
        positionCompatibilities,
      };
      branchSummaryCache[branch].set(strategy, summary);
      return summary;
    };
    const compactBranch = (
      strategies: BranchFactorStrategy[],
      branch: BranchKey,
    ) => {
      const { parent, grandparents } = branchConfigs[branch];
      const positionRoles = new Map<string, string>([
        [SLOT_CODES[parent], "P"],
        [SLOT_CODES[grandparents[0]], "G0"],
        [SLOT_CODES[grandparents[1]], "G1"],
      ]);
      const resolvedOptionKey = (position: CompleteDesignPosition) =>
        [
          position.uma?.id || 0,
          factorAssignmentKey(position.factor),
          demandKey(position.minimumDemand || {}),
          demandKey(position.cumulativeDemand || {}),
        ].join("/");
      const summaries = new Map<
        string,
        {
          representative: BranchProbabilitySummary;
          positionOptions: Map<
            string,
            Map<string, CompleteDesignPosition>
          >;
        }
      >();
      strategies.forEach((strategy) => {
        const summary = summarizeBranch(strategy, branch);
        if (!summary) return;
        const resolved = resolvedPositions(strategy)
          .filter((position) => position.generation <= 2)
          .map((position) => {
            const compatibility = summary.positionCompatibilities[position.code];
            return {
              ...position,
              compatibility: compatibility?.total,
              compatibilityTitle: compatibility?.formula,
            };
          });
        // 在固定父辈下，祖辈身份不进入等价键；每个槽位的相性和因子
        // 相同即可归为同一概率/展示组，具体马娘保留为“或”选项。
        const key = [
          String(summary.parentId).padStart(10, "0"),
          ...resolved
            .map((position) => {
              const compatibility =
                summary.positionCompatibilities[position.code]?.total ?? -1;
              return `${positionRoles.get(position.code)}:${factorAssignmentKey(position.factor)}:${compatibility}`;
            })
            .sort(),
        ].join("|");
        let group = summaries.get(key);
        if (!group) {
          group = {
            representative: summary,
            positionOptions: new Map(),
          };
          summaries.set(key, group);
        }
        resolved
          .filter((position) => position.generation === 2)
          .forEach((position) => {
            let options = group!.positionOptions.get(position.code);
            if (!options) {
              options = new Map();
              group!.positionOptions.set(position.code, options);
            }
            options.set(resolvedOptionKey(position), position);
          });
      });
      return [...summaries.entries()].map(([orderKey, group]) => ({
        orderKey,
        ...group,
      }));
    };

    const probabilityCache = new Map<string, number>();
    type BranchProbabilityGroup = ReturnType<typeof compactBranch>[number];
    const combinedProbabilityFactors = (
      paternal: BranchProbabilitySummary,
      maternal: BranchProbabilitySummary,
    ) => {
      const parentPairCompatibility = relationScore(
        paternal.parentId,
        maternal.parentId,
      );
      return [...paternal.factors, ...maternal.factors].map((factor) => {
        const compatibility =
          factor.compatibility + (factor.parent ? parentPairCompatibility : 0);
        return {
          type: factor.type,
          stars: factor.stars,
          compatibility,
        } satisfies ProbabilityFactor;
      });
    };
    const buildRankedResult = (
      probability: number,
      plan: TargetFactorPlan,
      paternal: BranchProbabilityGroup,
      maternal: BranchProbabilityGroup,
    ) => {
      const parentPairCompatibility = relationScore(
        paternal.representative.parentId,
        maternal.representative.parentId,
      );
      const materializeBranch = (group: BranchProbabilityGroup) =>
        resolvedPositions(group.representative.strategy).map((position) => {
          const detail =
            group.representative.positionCompatibilities[position.code];
          const compatibility =
            detail?.total + (detail?.parent ? parentPairCompatibility : 0);
          const compatibilityTitle = detail?.parent
            ? `${detail.formula} + 父母基础相性 ${parentPairCompatibility} = ${compatibility}`
            : detail?.formula;
          const options = [
            ...(group.positionOptions.get(position.code)?.values() || []),
          ].sort((left, right) => (left.uma?.id || 0) - (right.uma?.id || 0));
          return {
            ...position,
            compatibility,
            compatibilityTitle,
            ...(options.length > 1
              ? {
                  alternatives: options,
                  alternativeCount: options.length,
                }
              : {}),
          };
        });
      return {
        probability: Math.max(0, probability),
        plan,
        design: {
          positions: [
            ...materializeBranch(paternal),
            ...materializeBranch(maternal),
          ],
          cumulativeRequirements: [
            ...paternal.representative.strategy.cumulativeRequirements,
            ...maternal.representative.strategy.cumulativeRequirements,
          ],
          issues: [],
        } satisfies CompleteFactorDesign,
      };
    };
    type BestMatch = {
      plan: TargetFactorPlan;
      paternal: BranchProbabilityGroup;
      maternal: BranchProbabilityGroup;
    };
    const bestMatches: BestMatch[] = [];
    const bestMatchByKey = new Map<string, BestMatch>();
    const bestMatchKeys = new Set<string>();
    const mergeBranchGroupOptions = (
      target: BranchProbabilityGroup,
      source: BranchProbabilityGroup,
    ) => {
      source.positionOptions.forEach((sourceOptions, code) => {
        let targetOptions = target.positionOptions.get(code);
        if (!targetOptions) {
          targetOptions = new Map();
          target.positionOptions.set(code, targetOptions);
        }
        sourceOptions.forEach((position, optionKey) => {
          targetOptions!.set(optionKey, position);
        });
      });
    };
    const bestMatchKey = (
      paternal: BranchProbabilityGroup,
      maternal: BranchProbabilityGroup,
      branchesUnordered: boolean,
    ) => {
      const branchKeys = [paternal.orderKey, maternal.orderKey];
      if (branchesUnordered) branchKeys.sort();
      return branchKeys.join("||");
    };
    const recordBestMatch = (
      match: BestMatch,
      key: string,
    ) => {
      const existing = bestMatchByKey.get(key);
      if (existing) {
        mergeBranchGroupOptions(existing.paternal, match.paternal);
        mergeBranchGroupOptions(existing.maternal, match.maternal);
        return;
      }
      if (bestMatchKeys.has(key)) return;
      bestMatchKeys.add(key);
      bestMatchCount += 1;
      if (bestMatches.length >= MAX_EQUAL_MATCH_GROUPS) return;
      bestMatches.push(match);
      bestMatchByKey.set(key, match);
    };
    let bestProbability = -1;
    let bestMatchCount = 0;

    for (const completeDesignGroup of validCompleteDesigns) {
      const branchFactorPlansEquivalent =
        branchesInterchangeable &&
        factorPlanBranchKey(completeDesignGroup.plan, "paternal") ===
          factorPlanBranchKey(completeDesignGroup.plan, "maternal");
      const paternalSummaries = compactBranch(
        completeDesignGroup.paternal,
        "paternal",
      );
      const maternalSummaries = compactBranch(
        completeDesignGroup.maternal,
        "maternal",
      );
      for (const paternal of paternalSummaries) {
        for (const maternal of maternalSummaries) {
          if (
            branchFactorPlansEquivalent &&
            paternal.orderKey > maternal.orderKey
          ) {
            continue;
          }
          const paternalSummary = paternal.representative;
          const maternalSummary = maternal.representative;
          if (
            !demandSatisfied(guaranteedFactorDemand, [
              ...paternalSummary.factors,
              ...maternalSummary.factors,
            ])
          ) {
            continue;
          }
          const factors = combinedProbabilityFactors(
            paternalSummary,
            maternalSummary,
          );
          const probabilityKey = factors
            .map(
              (factor) =>
                `${factor.type}:${factor.stars}:${factor.compatibility}`,
            )
            .sort()
            .join("|");
          let probability = probabilityCache.get(probabilityKey);
          if (probability === undefined) {
            probability = probabilityOfReachingTargets(
              factors,
              probabilityTargetTypes,
              probabilityRequiredRaises,
            );
            probabilityCache.set(probabilityKey, probability);
          }
          if (probability < MIN_DISPLAYED_PROBABILITY) continue;
          if (probability > bestProbability) {
            bestProbability = probability;
            bestMatches.length = 0;
            bestMatchByKey.clear();
            bestMatchKeys.clear();
            bestMatchCount = 0;
            const match = {
              plan: completeDesignGroup.plan,
              paternal,
              maternal,
            };
            recordBestMatch(
              match,
              bestMatchKey(paternal, maternal, branchFactorPlansEquivalent),
            );
          } else if (probability === bestProbability) {
            const match = {
              plan: completeDesignGroup.plan,
              paternal,
              maternal,
            };
            recordBestMatch(
              match,
              bestMatchKey(paternal, maternal, branchFactorPlansEquivalent),
            );
          }
        }
      }
    }

    if (!bestMatches.length) return undefined;
    const results: ReturnType<typeof buildRankedResult>[] = [];
    let truncated = bestMatchCount > bestMatches.length;
    for (const match of bestMatches) {
      results.push(
        buildRankedResult(
          bestProbability,
          match.plan,
          match.paternal,
          match.maternal,
        ),
      );
      if (results.length >= MAX_EQUAL_CANDIDATES) {
        truncated = true;
        break;
      }
    }
    return {
      results,
      truncated,
      bestMatchCount,
    };
  }, [
    calculationReady,
    calculationRequestId,
    validCompleteDesigns,
    probabilityTargetTypes.join("|"),
    JSON.stringify(probabilityRequiredRaises),
    targetId,
    routes.paternal,
    routes.maternal,
    JSON.stringify(slotRouteOverrides),
    branchesInterchangeable,
    JSON.stringify(guaranteedFactorDemand),
  ]);
  useEffect(() => {
    if (!isCalculating || !calculationReady) return;
    const runToken = calculationRunToken.current;
    const completedInputKey = currentCalculationInputKey;
    const completedResult = optimalCompleteDesign || null;
    setCalculationStage(4);
    setCalculationProgress(92);
    const completeTimer = window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCalculationProgress(100);
    }, 140);
    const closeTimer = window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCompletedCalculation({
        inputKey: completedInputKey,
        result: completedResult,
      });
      setCalculationInputKey("");
      setCalculationRequestId(0);
      setIsCalculating(false);
    }, 520);
    return () => {
      window.clearTimeout(completeTimer);
      window.clearTimeout(closeTimer);
    };
  }, [
    calculationReady,
    calculationRequestId,
    currentCalculationInputKey,
    optimalCompleteDesign,
  ]);

  const displayedCalculation =
    completedCalculation?.inputKey === currentCalculationInputKey
      ? completedCalculation
      : undefined;
  const calculationComplete =
    displayedCalculation !== undefined && !isCalculating;
  const completeFactorDesigns = displayedCalculation?.result?.results || [];
  const singleBranchCompleteDesigns =
    completeFactorDesigns.length > 0 &&
    completeFactorDesigns.every(
      (result) => visibleCompleteDesignBranches(result.design).length === 1,
    );

  const calculateOptimalDesign = () => {
    if (!target || isCalculating) return;
    const runToken = calculationRunToken.current + 1;
    calculationRunToken.current = runToken;
    setCompletedCalculation(undefined);
    setCalculationInputKey("");
    setCalculationStage(1);
    setCalculationProgress(12);
    setIsCalculating(true);
    window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCalculationStage(2);
      setCalculationProgress(32);
      window.setTimeout(() => {
        if (calculationRunToken.current !== runToken) return;
        setCalculationStage(3);
        setCalculationProgress(58);
        window.setTimeout(() => {
          if (calculationRunToken.current !== runToken) return;
          setCalculationInputKey(currentCalculationInputKey);
          setCalculationRequestId((current) => current + 1);
        }, 100);
      }, 120);
    }, 120);
  };

  const updateLineage = (slot: LineageSlot, value: number) => {
    const changed = lineage[slot] !== value;
    setLineage((current) => ({ ...current, [slot]: value }));
    if (!changed) return;
    setSlotRouteOverrides((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setTrainedUmaSettings((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const clearLineageSetting = (slot: LineageSlot) => {
    const clearedSlots = [
      slot,
      ...(trainedUmaSettings[slot] ? SLOT_UPSTREAM_SLOTS[slot] || [] : []),
    ];
    setLineage((current) => {
      const next = { ...current };
      clearedSlots.forEach((item) => {
        next[item] = 0;
      });
      return next;
    });
    setSlotRouteOverrides((current) => {
      const next = { ...current };
      clearedSlots.forEach((item) => delete next[item]);
      return next;
    });
    setTrainedUmaSettings((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const lineageSlotFromDragEvent = (event: DragEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const rawSlot = target.closest<HTMLElement>("[data-lineage-slot]")?.dataset
      .lineageSlot;
    return rawSlot && rawSlot in INITIAL_LINEAGE
      ? (rawSlot as LineageSlot)
      : null;
  };

  const clearLineageDragState = () => {
    setDraggedLineageSlot(null);
    setLineageDropSlot(null);
  };

  const handleLineageDragStart = (event: DragEvent) => {
    const slot = lineageSlotFromDragEvent(event);
    if (!slot || !lineage[slot]) {
      event.preventDefault();
      return;
    }
    setDraggedLineageSlot(slot);
    setLineageDropSlot(null);
    event.dataTransfer?.setData("text/x-uma-lineage-slot", slot);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const eventTarget = event.target;
      const slotElement =
        eventTarget instanceof Element
          ? eventTarget.closest<HTMLElement>("[data-lineage-slot]")
          : null;
      const trigger = slotElement?.querySelector<HTMLElement>(
        ".successionUmaTrigger",
      );
      if (trigger) {
        const preview = trigger.cloneNode(true) as HTMLElement;
        const bounds = trigger.getBoundingClientRect();
        preview.classList.add("successionLineageDragPreview");
        preview.style.width = `${bounds.width}px`;
        preview.setAttribute("aria-hidden", "true");
        document.body.appendChild(preview);
        event.dataTransfer.setDragImage(
          preview,
          Math.min(bounds.width / 2, 52),
          Math.min(bounds.height / 2, 34),
        );
        window.setTimeout(() => preview.remove(), 0);
      }
    }
  };

  const handleLineageDragOver = (event: DragEvent) => {
    const slot = lineageSlotFromDragEvent(event);
    if (!draggedLineageSlot || !slot || slot === draggedLineageSlot) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    if (lineageDropSlot !== slot) setLineageDropSlot(slot);
  };

  const handleLineageDrop = (event: DragEvent) => {
    const targetSlot = lineageSlotFromDragEvent(event);
    const rawSource =
      event.dataTransfer?.getData("text/x-uma-lineage-slot") ||
      draggedLineageSlot;
    const sourceSlot =
      rawSource && rawSource in INITIAL_LINEAGE
        ? (rawSource as LineageSlot)
        : null;
    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) {
      clearLineageDragState();
      return;
    }
    event.preventDefault();
    setLineage((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    setSlotRouteOverrides((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    setTrainedUmaSettings((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    clearLineageDragState();
  };

  const saveTrainedUmaSetting = (
    slot: LineageSlot,
    setting: TrainedUmaSetting,
  ) => {
    const upstreamSlots = SLOT_UPSTREAM_SLOTS[slot] || [];
    setTrainedUmaSettings((current) => {
      const next = { ...current, [slot]: setting };
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
    setLineage((current) => {
      const next = { ...current, [slot]: setting.self.umaId };
      upstreamSlots.forEach((upstreamSlot, index) => {
        next[upstreamSlot] = setting.parents[index].umaId;
      });
      return next;
    });
    setSlotRouteOverrides((current) => {
      const next = {
        ...current,
        [slot]: {
          routeId: setting.self.routeId,
          minimums: { ...DEFAULT_APTITUDE_MINIMUMS },
        },
      };
      upstreamSlots.forEach((upstreamSlot, index) => {
        next[upstreamSlot] = {
          routeId: setting.parents[index].routeId,
          minimums: { ...DEFAULT_APTITUDE_MINIMUMS },
        };
      });
      return next;
    });
  };

  const updateSlotRoute = (slot: LineageSlot, routeId: string) => {
    const effective = routeSettingForSlot(slot);
    const uma = umaById.get(lineage[slot]);
    const nextRoute = ROUTES.find((route) => route.id === routeId) || ROUTES[0];
    setSlotRouteOverrides((current) => {
      const sourceMinimums = current[slot]?.minimums || effective.minimums;
      return {
        ...current,
        [slot]: {
          routeId,
          minimums: uma
            ? fitMinimumsForUma(sourceMinimums, uma, nextRoute)
            : { ...sourceMinimums },
        },
      };
    });
  };

  const updateSlotRouteMinimum = (
    slot: LineageSlot,
    type: AptitudeKey,
    value: number,
  ) => {
    const effective = routeSettingForSlot(slot);
    const uma = umaById.get(lineage[slot]);
    const limitedValue = uma
      ? Math.max(
          minimumRouteRank(uma.aptitudes[type]),
          Math.min(value, maximumInheritedRank(uma.aptitudes[type])),
        )
      : value;
    const nextMinimums = {
      ...effective.minimums,
      [type]: limitedValue,
    };
    setSlotRouteOverrides((current) => ({
      ...current,
      [slot]: {
        routeId: current[slot]?.routeId || effective.route.id,
        minimums: uma
          ? fitMinimumsForUma(nextMinimums, uma, effective.route)
          : nextMinimums,
      },
    }));
  };

  const resetSlotRoute = (slot: LineageSlot) => {
    setSlotRouteOverrides((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const clearAllUmaSelections = () => {
    calculationRunToken.current += 1;
    setTargetId(0);
    setLineage({ ...INITIAL_LINEAGE });
    setSlotRouteOverrides({});
    setTrainedUmaSettings({});
    setInheritanceTargets({});
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    setCalculationInputKey("");
    setCalculationRequestId(0);
    setCompletedCalculation(undefined);
    setIsCalculating(false);
    setCalculationProgress(0);
    setCalculationStage(0);
  };

  const updateTarget = (value: number) => {
    if (!value) {
      clearAllUmaSelections();
      return;
    }
    setTargetId(value);
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    const nextTarget = umaById.get(value);
    setInheritanceTargets((current) => {
      if (!nextTarget) return {};
      const next: InheritanceTargets = {};
      inheritanceAptitudes.forEach((type) => {
        const previousBase =
          target?.aptitudes[type] ?? nextTarget.aptitudes[type];
        const raises = Math.max(
          1,
          (Number(current[type]) || previousBase + 1) - previousBase,
        );
        const nextBase = nextTarget.aptitudes[type];
        const targetRank = Math.min(7, nextBase + raises);
        if (targetRank > nextBase) next[type] = targetRank;
      });
      return next;
    });
  };

  const toggleInheritanceAptitude = (type: FactorKey) => {
    const active = inheritanceAptitudes.includes(type);
    if (active) {
      setInheritanceAptitudes((current) =>
        current.filter((item) => item !== type),
      );
      setInheritanceTargets((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      setConfiguredProbabilityTargetTypes((current) =>
        current.filter((item) => item !== type),
      );
      return;
    }
    if (!target) return;
    const allocations = inheritanceAllocation(
      target,
      inheritanceAptitudes,
      inheritanceTargets,
    );
    const usedSlots = allocations.reduce((sum, item) => sum + item.slots, 0);
    if (usedSlots + 1 > MAX_INHERITANCE_SLOTS) {
      return;
    }
    setInheritanceAptitudes((current) => [...current, type]);
    if (target.aptitudes[type] < 7) {
      setInheritanceTargets((current) => ({
        ...current,
        [type]: target.aptitudes[type] + 1,
      }));
    }
  };

  const configureProbabilityTarget = (type: FactorKey, rank: number) => {
    const guaranteed = targetInheritanceAllocations.find(
      (item) => item.type === type,
    )?.target;
    if (guaranteed === undefined || rank < guaranteed || rank > 8) return;
    setProbabilityTargetRanks((current) => ({ ...current, [type]: rank }));
    setConfiguredProbabilityTargetTypes((current) =>
      current.includes(type) ? current : [...current, type],
    );
  };

  const configureInheritanceAptitude = (type: FactorKey, rank: number) => {
    if (!target || rank <= target.aptitudes[type]) return;
    const nextSelected = inheritanceAptitudes.includes(type)
      ? inheritanceAptitudes
      : [...inheritanceAptitudes, type];
    const nextTargets = { ...inheritanceTargets, [type]: rank };
    const totals = inheritanceAllocation(target, nextSelected, nextTargets);
    const usedSlots = totals.reduce((sum, item) => sum + item.slots, 0);
    if (usedSlots > MAX_INHERITANCE_SLOTS) {
      return;
    }
    setInheritanceAptitudes(nextSelected);
    setInheritanceTargets(nextTargets);
  };

  const toggleExcludedUma = (umaId: number) => {
    if (!umaById.has(umaId)) return;
    setExcludedUmaIds((current) =>
      current.includes(umaId)
        ? current.filter((id) => id !== umaId)
        : [...current, umaId],
    );
  };

  const resetLineage = () => {
    calculationRunToken.current += 1;
    setLineage({ ...INITIAL_LINEAGE });
    setRoutes({ ...INITIAL_ROUTES });
    setRouteMinimums({
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    });
    setSlotRouteOverrides({});
    setTrainedUmaSettings({});
    setInheritanceAptitudes([...INITIAL_INHERITANCE_APTITUDES]);
    setAllowInRaceFactorJump(false);
    setInRaceFactorJumpMinimumRank(6);
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    setCalculationInputKey("");
    setCalculationRequestId(0);
    setCompletedCalculation(undefined);
    setIsCalculating(false);
    setCalculationProgress(0);
    setCalculationStage(0);
    if (target) {
      const nextTargets: InheritanceTargets = {};
      INITIAL_INHERITANCE_APTITUDES.forEach((type) => {
        if (target.aptitudes[type] < 7) {
          nextTargets[type] = target.aptitudes[type] + 1;
        }
      });
      setInheritanceTargets(nextTargets);
    } else {
      setInheritanceTargets({ ...INITIAL_INHERITANCE_TARGETS });
    }
  };

  const inheritedTrainedMemberForSlot = (slot: LineageSlot) => {
    const mappings: Partial<
      Record<LineageSlot, { parent: LineageSlot; index: 0 | 1 }>
    > = {
      paternalA: { parent: "father", index: 0 },
      paternalB: { parent: "father", index: 1 },
      maternalA: { parent: "mother", index: 0 },
      maternalB: { parent: "mother", index: 1 },
    };
    const mapping = mappings[slot];
    if (!mapping) return undefined;
    const parentSetting = trainedUmaSettings[mapping.parent];
    if (!parentSetting) return undefined;
    return {
      member: parentSetting.parents[mapping.index],
      sourceLabel: SLOT_LABELS[mapping.parent],
    };
  };
  const trainedModalExcludedIds = (slot: LineageSlot) => {
    const replacedSlots = new Set([slot, ...(SLOT_UPSTREAM_SLOTS[slot] || [])]);
    return [
      targetId,
      ...TARGET_FACTOR_SLOTS.filter((item) => !replacedSlots.has(item)).map(
        (item) => lineage[item],
      ),
    ].filter(Boolean);
  };

  return (
    <section class="successionPlanner">
      <section class="successionPanel successionLineagePanel">
        <div class={`successionTargetSetup${target ? " hasTarget" : ""}`}>
          <div class={`successionTargetBar${target ? " hasTarget" : ""}`}>
            <div class="successionTargetInline">
              <UmaSelect
                label="养成马娘"
                value={targetId}
                required
                exclude={selectedLineageIds}
                onChange={updateTarget}
              />
            </div>
          </div>
        </div>
        {target ? (
          <>
            <div
              class={`successionLineageGrid${draggedLineageSlot ? " draggingUma" : ""}`}
              onDragStart={handleLineageDragStart}
              onDragOver={handleLineageDragOver}
              onDrop={handleLineageDrop}
              onDragEnd={clearLineageDragState}
            >
              <article class="successionBranch paternal">
                <div class="successionBranchLineage">
                  <LineageUmaSetting
                    slot="father"
                    branch="paternal"
                    value={lineage.father}
                    exclude={excludedIdsForSlot("father")}
                    compatibility={positionCompatibility.father}
                    route={routeSettingForSlot("father").route}
                    minimums={routeSettingForSlot("father").minimums}
                    followsDefault={!slotRouteOverrides.father}
                    trainedSetting={trainedUmaSettings.father}
                    trainedModalExclude={trainedModalExcludedIds("father")}
                    draggedSlot={draggedLineageSlot}
                    dropSlot={lineageDropSlot}
                    onPlanUmaChange={(value) => updateLineage("father", value)}
                    onClear={() => clearLineageSetting("father")}
                    onTrainedSettingChange={(setting) =>
                      saveTrainedUmaSetting("father", setting)
                    }
                    onRouteChange={(value) => updateSlotRoute("father", value)}
                    onMinimumChange={(type, value) =>
                      updateSlotRouteMinimum("father", type, value)
                    }
                    onResetRoute={() => resetSlotRoute("father")}
                  />
                  <div class="successionGrandparents">
                    <LineageUmaSetting
                      slot="paternalA"
                      branch="paternal"
                      value={lineage.paternalA}
                      exclude={excludedIdsForSlot("paternalA")}
                      compatibility={positionCompatibility.paternalA}
                      route={routeSettingForSlot("paternalA").route}
                      minimums={routeSettingForSlot("paternalA").minimums}
                      followsDefault={!slotRouteOverrides.paternalA}
                      trainedSetting={trainedUmaSettings.paternalA}
                      inheritedMember={
                        inheritedTrainedMemberForSlot("paternalA")?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot("paternalA")?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds("paternalA")}
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage("paternalA", value)
                      }
                      onClear={() => clearLineageSetting("paternalA")}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting("paternalA", setting)
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute("paternalA", value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum("paternalA", type, value)
                      }
                      onResetRoute={() => resetSlotRoute("paternalA")}
                    />
                    <LineageUmaSetting
                      slot="paternalB"
                      branch="paternal"
                      value={lineage.paternalB}
                      exclude={excludedIdsForSlot("paternalB")}
                      compatibility={positionCompatibility.paternalB}
                      route={routeSettingForSlot("paternalB").route}
                      minimums={routeSettingForSlot("paternalB").minimums}
                      followsDefault={!slotRouteOverrides.paternalB}
                      trainedSetting={trainedUmaSettings.paternalB}
                      inheritedMember={
                        inheritedTrainedMemberForSlot("paternalB")?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot("paternalB")?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds("paternalB")}
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage("paternalB", value)
                      }
                      onClear={() => clearLineageSetting("paternalB")}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting("paternalB", setting)
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute("paternalB", value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum("paternalB", type, value)
                      }
                      onResetRoute={() => resetSlotRoute("paternalB")}
                    />
                  </div>
                </div>
                <BranchRouteCard
                  branch="paternal"
                  route={selectedRoutes.paternal}
                  minimums={routeMinimums.paternal}
                  onRouteChange={(value) =>
                    setRoutes((current) => ({ ...current, paternal: value }))
                  }
                  onMinimumChange={(type, value) =>
                    setRouteMinimums((current) => ({
                      ...current,
                      paternal: { ...current.paternal, [type]: value },
                    }))
                  }
                />
              </article>
              <article class="successionBranch maternal">
                <div class="successionBranchLineage">
                  <LineageUmaSetting
                    slot="mother"
                    branch="maternal"
                    value={lineage.mother}
                    exclude={excludedIdsForSlot("mother")}
                    compatibility={positionCompatibility.mother}
                    route={routeSettingForSlot("mother").route}
                    minimums={routeSettingForSlot("mother").minimums}
                    followsDefault={!slotRouteOverrides.mother}
                    trainedSetting={trainedUmaSettings.mother}
                    trainedModalExclude={trainedModalExcludedIds("mother")}
                    draggedSlot={draggedLineageSlot}
                    dropSlot={lineageDropSlot}
                    onPlanUmaChange={(value) => updateLineage("mother", value)}
                    onClear={() => clearLineageSetting("mother")}
                    onTrainedSettingChange={(setting) =>
                      saveTrainedUmaSetting("mother", setting)
                    }
                    onRouteChange={(value) => updateSlotRoute("mother", value)}
                    onMinimumChange={(type, value) =>
                      updateSlotRouteMinimum("mother", type, value)
                    }
                    onResetRoute={() => resetSlotRoute("mother")}
                  />
                  <div class="successionGrandparents">
                    <LineageUmaSetting
                      slot="maternalA"
                      branch="maternal"
                      value={lineage.maternalA}
                      exclude={excludedIdsForSlot("maternalA")}
                      compatibility={positionCompatibility.maternalA}
                      route={routeSettingForSlot("maternalA").route}
                      minimums={routeSettingForSlot("maternalA").minimums}
                      followsDefault={!slotRouteOverrides.maternalA}
                      trainedSetting={trainedUmaSettings.maternalA}
                      inheritedMember={
                        inheritedTrainedMemberForSlot("maternalA")?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot("maternalA")?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds("maternalA")}
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage("maternalA", value)
                      }
                      onClear={() => clearLineageSetting("maternalA")}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting("maternalA", setting)
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute("maternalA", value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum("maternalA", type, value)
                      }
                      onResetRoute={() => resetSlotRoute("maternalA")}
                    />
                    <LineageUmaSetting
                      slot="maternalB"
                      branch="maternal"
                      value={lineage.maternalB}
                      exclude={excludedIdsForSlot("maternalB")}
                      compatibility={positionCompatibility.maternalB}
                      route={routeSettingForSlot("maternalB").route}
                      minimums={routeSettingForSlot("maternalB").minimums}
                      followsDefault={!slotRouteOverrides.maternalB}
                      trainedSetting={trainedUmaSettings.maternalB}
                      inheritedMember={
                        inheritedTrainedMemberForSlot("maternalB")?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot("maternalB")?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds("maternalB")}
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage("maternalB", value)
                      }
                      onClear={() => clearLineageSetting("maternalB")}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting("maternalB", setting)
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute("maternalB", value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum("maternalB", type, value)
                      }
                      onResetRoute={() => resetSlotRoute("maternalB")}
                    />
                  </div>
                </div>
                <BranchRouteCard
                  branch="maternal"
                  route={selectedRoutes.maternal}
                  minimums={routeMinimums.maternal}
                  onRouteChange={(value) =>
                    setRoutes((current) => ({ ...current, maternal: value }))
                  }
                  onMinimumChange={(type, value) =>
                    setRouteMinimums((current) => ({
                      ...current,
                      maternal: { ...current.maternal, [type]: value },
                    }))
                  }
                />
              </article>
            </div>
            <section class="successionCalculationPanel">
              <div class="successionCalculationWorkspace">
                <div class="successionCalculationPlanning">
                  <InRaceFactorJumpOption
                    enabled={allowInRaceFactorJump}
                    minimumRank={inRaceFactorJumpMinimumRank}
                    onEnabledChange={setAllowInRaceFactorJump}
                    onMinimumRankChange={setInRaceFactorJumpMinimumRank}
                    footer={
                      <ProbabilityTargetInput
                        targetName={target.name}
                        probabilityOptions={targetInheritanceAllocations.map(
                          (item) => ({
                            type: item.type,
                            guaranteed: item.target,
                            target:
                              probabilityTargetRanks[item.type] || item.target,
                          }),
                        )}
                        onConfigureProbabilityTarget={
                          configureProbabilityTarget
                        }
                        embedded
                      />
                    }
                  />
                  <div class="successionCalculationInheritance">
                    <InheritanceAptitudes
                      target={target}
                      selected={inheritanceAptitudes}
                      targets={inheritanceTargets}
                      onToggle={toggleInheritanceAptitude}
                      onConfigure={configureInheritanceAptitude}
                    />
                  </div>
                </div>
                <div class="successionCalculationControls">
                  <UmaExclusionList
                    excludedIds={excludedUmaIds}
                    fixedIds={[targetId, ...selectedLineageIds]}
                    onToggle={toggleExcludedUma}
                  />
                </div>
                <div class="successionCalculationActions">
                  <button
                    class="successionResetLineage"
                    type="button"
                    disabled={isCalculating}
                    onClick={resetLineage}
                  >
                    <span aria-hidden="true">↺</span>
                    重置种马路线
                  </button>
                  <button
                    type="button"
                    class="successionCalculateButton"
                    disabled={isCalculating}
                    onClick={calculateOptimalDesign}
                  >
                    {isCalculating
                      ? "计算中"
                      : calculationComplete
                        ? "重新计算最优种马路线"
                        : "计算最优种马路线"}
                  </button>
                </div>
              </div>
              {isCalculating && (
                <div class="successionCalculationProgress" aria-live="polite">
                  <header>
                    <div>
                      <strong>
                        阶段 {calculationStage} / {CALCULATION_PHASES.length}
                      </strong>
                      <span>
                        {CALCULATION_PHASES[Math.max(0, calculationStage - 1)]}
                      </span>
                    </div>
                    <b>{calculationProgress}%</b>
                  </header>
                  <progress max="100" value={calculationProgress} />
                  <ol>
                    {CALCULATION_PHASES.map((phase, index) => {
                      const phaseNumber = index + 1;
                      return (
                        <li
                          class={
                            phaseNumber < calculationStage
                              ? "completed"
                              : phaseNumber === calculationStage
                                ? "active"
                                : ""
                          }
                          key={phase}
                        >
                          <i>
                            {phaseNumber < calculationStage ? "✓" : phaseNumber}
                          </i>
                          <span>{phase}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>
            {calculationComplete && completeFactorDesigns.length ? (
              <div
                class={`successionOptimalResults${singleBranchCompleteDesigns ? " singleBranchResults" : ""}`}
              >
                {displayedCalculation?.result?.truncated && (
                  <div class="successionOptimalResultsNotice">
                    候选过多，仅显示前
                    {MAX_EQUAL_CANDIDATES}个候选。
                  </div>
                )}
                {completeFactorDesigns.map((result, index) => (
                  <CompleteDesignResult
                    rank={index + 1}
                    design={result.design}
                    probability={result.probability}
                    probabilityTargets={targetInheritanceAllocations.map(
                      (item) => ({
                        type: item.type,
                        rank: probabilityTargetRanks[item.type] || item.target,
                      }),
                    )}
                    onExcludeUma={toggleExcludedUma}
                    key={index}
                  />
                ))}
              </div>
            ) : calculationComplete ? (
              <div class="successionCompleteDesignIssues successionStandaloneIssue">
                <strong>未找到可行的种马路线</strong>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  );
}
