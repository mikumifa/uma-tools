import { h, Fragment, cloneElement } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { IntlProvider, Text, Localizer } from "preact-i18n";

import { getParser } from "../uma-skill-tools/ConditionParser";
import * as Matcher from "../uma-skill-tools/tools/ConditionMatcher";
import { SkillRarity } from "../uma-skill-tools/RaceSolver.ts";

import { Tooltip } from "./Tooltip";
import "./SkillList.css";
import skills from "../umalator/data/skill_data.json";
import skillnames from "../umalator/data/skillnames.json";
import skill_meta from "../umalator/data/skill_meta.json";

function skilldata(id: string) {
  return skills[id.split("-")[0]];
}

function skillmeta(id: string) {
  // handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
  return skill_meta[id.split("-")[0]];
}

const Parser = getParser(Matcher.mockConditions);
const ICON_BASE = `${import.meta.env.BASE_URL}icons`;

export const STRINGS_cn = Object.freeze({
  skillfilters: Object.freeze({
    search: "按技能名或条件搜索",
    white: "白",
    gold: "金",
    pink: "进化",
    unique: "专属",
    inherit: "继承",
    nige: "领跑",
    senkou: "前列",
    sasi: "居中",
    oikomi: "后追",
    short: "短距离",
    mile: "英里",
    medium: "中距离",
    long: "长距离",
    turf: "草地",
    dirt: "泥地",
    phase0: "起跑",
    phase1: "中盘",
    phase2: "终盘",
    phase3: "冲刺",
    finalcorner: "终弯",
    finalstraight: "终直",
  }),
  skilleffecttypes: Object.freeze({
    "1": "被动（速度）",
    "2": "被动（耐力）",
    "3": "被动（力量）",
    "4": "被动（毅力）",
    "5": "被动（智力）",
    "9": "耐力回复",
    "21": "妨害（速度）",
    "22": "即时速度",
    "27": "速度",
    "28": "横向速度",
    "31": "加速度",
    "37": "触发金技",
  }),
  skilldetails: Object.freeze({
    accel: "{{n}}m/s²",
    basinn: "{{n}}马身",
    conditions: "发动条件：",
    distance_type: Object.freeze(["", "短距离", "英里", "中距离", "长距离"]),
    baseduration: "基础持续时间：",
    effectiveduration: "有效持续时间（{{distance}}m）：",
    durationincrease: "{{n}}×",
    effects: "效果：",
    grade: Object.freeze({
      100: "G1",
      200: "G2",
      300: "G3",
      400: "OP",
      700: "Pre-OP",
      800: "Maiden",
      900: "出道赛",
      999: "日常赛",
    }),
    ground_condition: Object.freeze(["", "良", "稍重", "重", "不亮"]),
    ground_type: Object.freeze(["", "草地", "泥地"]),
    id: "No.",
    meters: "{{n}}m",
    motivation: Object.freeze(["", "极差", "不良", "普通", "良好", "绝佳"]),
    order_rate: "CM：{{cm}}，LOH：{{loh}}",
    preconditions: "前置条件：",
    rotation: Object.freeze(["", "顺时针", "逆时针"]),
    running_style: Object.freeze(["", "领跑", "前列", "居中", "后追"]),
    phase: Object.freeze(["序盘", "中盘", "终盘前半", "终盘后半"]),
    /* “否/是” */
    yes_or_no: Object.freeze(["否", "是"]),

    season: Object.freeze(["", "早春", "夏", "秋", "冬", "晚春"]),
    seconds: "{{n}}s",
    slope: Object.freeze(["平地", "上坡", "下坡"]),
    speed: "{{n}}m/s",
    time: Object.freeze(["", "早晨", "正午", "傍晚", "夜晚"]),
    weather: Object.freeze(["", "晴", "多云", "雨", "雪"]),
  }),
});

function C(s: string) {
  return Parser.parseAny(Parser.tokenize(s));
}

const filterOps = Object.freeze({
  nige: [C("running_style==1")],
  senkou: [C("running_style==2")],
  sasi: [C("running_style==3")],
  oikomi: [C("running_style==4")],
  short: [C("distance_type==1")],
  mile: [C("distance_type==2")],
  medium: [C("distance_type==3")],
  long: [C("distance_type==4")],
  turf: [C("ground_type==1")],
  dirt: [C("ground_type==2")],
  phase0: [
    C("phase==0"),
    C("phase_random==0"),
    C("phase_firsthalf_random==0"),
    C("phase_laterhalf_random==0"),
  ],
  phase1: [
    C("phase==1"),
    C("phase>=1"),
    C("phase_random==1"),
    C("phase_firsthalf_random==1"),
    C("phase_laterhalf_random==1"),
  ],
  phase2: [
    C("phase==2"),
    C("phase>=2"),
    C("phase_random==2"),
    C("phase_firsthalf_random==2"),
    C("phase_laterhalf_random==2"),
    C("phase_firstquarter_random==2"),
    C("is_lastspurt==1"),
  ],
  phase3: [
    C("phase==3"),
    C("phase_random==3"),
    C("phase_firsthalf_random==3"),
    C("phase_laterhalf_random==3"),
  ],
  finalcorner: [
    C("is_finalcorner==1"),
    C("is_finalcorner_laterhalf==1"),
    C("is_finalcorner_random==1"),
  ],
  finalstraight: [C("is_last_straight==1"), C("is_last_straight_onetime==1")],
});

const parsedConditions = {};
Object.keys(skills).forEach((id) => {
  parsedConditions[id] = skilldata(id).alternatives.map((ef) => {
    try {
      return Parser.parse(Parser.tokenize(ef.condition));
    } catch (err) {
      console.warn(
        `解析条件失败 [id=${id}, condition="${ef.condition}"]:`,
        err
      );
      return null; // 出错时返回 null，避免程序崩溃
    }
  });
});

function matchRarity(id, testRarity) {
  const r = skilldata(id).rarity;
  switch (testRarity) {
    case "white":
      return r == SkillRarity.White && id[0] != "9";
    case "gold":
      return r == SkillRarity.Gold;
    case "pink":
      return r == SkillRarity.Evolution;
    case "unique":
      return r > SkillRarity.Gold && r < SkillRarity.Evolution;
    case "inherit":
      return id[0] == "9";
    default:
      return true;
  }
}

const classnames = Object.freeze([
  "",
  "skill-white",
  "skill-gold",
  "skill-unique",
  "skill-unique",
  "skill-unique",
  "skill-pink",
]);

export function Skill(props) {
  return (
    <div
      class={`skill ${classnames[skilldata(props.id).rarity]} ${
        props.selected ? "selected" : ""
      }`}
      data-skillid={props.id}
    >
      <img
        class="skillIcon"
        src={`${ICON_BASE}/${skillmeta(props.id).iconId}.png`}
      />
      <span class="skillName">
        <Text id={`skillnames.${props.id.split("-")[0]}`} />
      </span>
      {props.dismissable && <span class="skillDismiss">✕</span>}
    </div>
  );
}

interface ConditionFormatter {
  name: string;
  formatArg(arg: number): any;
}

function fmtSeconds(arg: number) {
  return <Text id="skilldetails.seconds" plural={arg} fields={{ n: arg }} />;
}

function fmtPercent(arg: number) {
  return `${arg}%`;
}

function fmtMeters(arg: number) {
  return <Text id="skilldetails.meters" plural={arg} fields={{ n: arg }} />;
}

function fmtString(strId: string) {
  return function (arg: number) {
    return (
      <Tooltip title={arg.toString()} tall={false}>
        <Text id={`skilldetails.${strId}.${arg}`} />
      </Tooltip>
    );
  };
}

const conditionFormatters = new Proxy(
  {
    accumulatetime: fmtSeconds,
    bashin_diff_behind(arg: number) {
      return (
        <Localizer>
          <Tooltip
            title={
              <Text
                id="skilldetails.meters"
                plural={arg * 2.5}
                fields={{ n: arg * 2.5 }}
              />
            }
          >
            <Text id="skilldetails.basinn" plural={arg} fields={{ n: arg }} />
          </Tooltip>
        </Localizer>
      );
    },
    bashin_diff_infront(arg: number) {
      return (
        <Localizer>
          <Tooltip
            title={
              <Text
                id="skilldetails.meters"
                plural={arg * 2.5}
                fields={{ n: arg * 2.5 }}
              />
            }
          >
            <Text id="skilldetails.basinn" plural={arg} fields={{ n: arg }} />
          </Tooltip>
        </Localizer>
      );
    },
    behind_near_lane_time: fmtSeconds,
    behind_near_lane_time_set1: fmtSeconds,
    blocked_all_continuetime: fmtSeconds,
    blocked_front_continuetime: fmtSeconds,
    blocked_side_continuetime: fmtSeconds,
    course_distance: fmtMeters,
    distance_diff_rate: fmtPercent,
    distance_diff_top(arg: number) {
      return (
        <Localizer>
          <Tooltip
            title={
              <Text
                id="skilldetails.basinn"
                plural={arg / 2.5}
                fields={{ n: arg / 2.5 }}
              />
            }
          >
            <Text id="skilldetails.meters" plural={arg} fields={{ n: arg }} />
          </Tooltip>
        </Localizer>
      );
    },
    distance_diff_top_float(arg: number) {
      return (
        <Localizer>
          <Tooltip
            title={
              <Text
                id="skilldetails.basinn"
                plural={arg / 25}
                fields={{ n: arg / 25 }}
              />
            }
          >
            <Text
              id="skilldetails.meters"
              plural={arg}
              fields={{ n: (arg / 10).toFixed(1) }}
            />
          </Tooltip>
        </Localizer>
      );
    },
    distance_rate: fmtPercent,
    distance_rate_after_random: fmtPercent,
    distance_type: fmtString("distance_type"),
    grade: fmtString("grade"),
    ground_condition: fmtString("ground_condition"),
    ground_type: fmtString("ground_type"),
    hp_per: fmtPercent,
    infront_near_lane_time: fmtSeconds,
    motivation: fmtString("motivation"),
    order_rate(arg: number) {
      return (
        <Localizer>
          <Tooltip
            title={
              <Text
                id="skilldetails.order_rate"
                fields={{
                  cm: Math.round((arg / 100) * 9),
                  loh: Math.round((arg / 100) * 12),
                }}
              />
            }
          >
            {arg}
          </Tooltip>
        </Localizer>
      );
    },
    overtake_target_no_order_up_time: fmtSeconds,
    overtake_target_time: fmtSeconds,
    random_lot: fmtPercent,
    remain_distance: fmtMeters,
    rotation: fmtString("rotation"),
    phase_random: fmtString("phase"),
    phase: fmtString("phase"),
    phase_firsthalf_random: fmtString("phase"),
    phase_laterhalf_random: fmtString("phase"),
    straight_random: fmtString("yes_or_no"),
    all_corner_random: fmtString("yes_or_no"),
    corner: fmtString("yes_or_no"),
    is_finalcorner: fmtString("yes_or_no"),
    is_finalcorner_laterhalf: fmtString("yes_or_no"),
    running_style: fmtString("running_style"),
    order_rate_out70_continue: fmtString("yes_or_no"),
    order_rate_in40_continue: fmtString("yes_or_no"),
    is_lastspurt: fmtString("yes_or_no"),
    is_overtake: fmtString("yes_or_no"),
    is_badstart: fmtString("yes_or_no"),
    season: fmtString("season"),
    slope: fmtString("slope"),
    time: fmtString("time"),
    track_id(arg: number) {
      return (
        <Tooltip title={arg} tall={false}>
          <Text id={`tracknames.${arg}`} />
        </Tooltip>
      );
    },
    weather: fmtString("weather"),
  },
  {
    get(o: object, prop: string) {
      if (o.hasOwnProperty(prop)) {
        return { name: prop, formatArg: o[prop] };
      }
      return {
        name: prop,
        formatArg(arg: number) {
          return arg.toString();
        },
      };
    },
  }
);

interface OpFormatter {
  format(): any;
}

class AndFormatter {
  constructor(readonly left: OpFormatter, readonly right: OpFormatter) {}

  format() {
    return (
      <Fragment>
        {this.left.format()}
        <span class="operatorAnd">&amp;</span>
        {this.right.format()}
      </Fragment>
    );
  }
}

class OrFormatter {
  constructor(readonly left: OpFormatter, readonly right: OpFormatter) {}

  format() {
    return (
      <Fragment>
        {this.left.format()}
        <span class="operatorOr">
          @<span class="operatorOrText">or</span>
        </span>
        {this.right.format()}
      </Fragment>
    );
  }
}
const CONDITION_NAME_MAP: Record<string, string> = {
  ground_type: "赛道类型",
  corner: "是否是弯道",
  straight_random: "是否直线随机",
  all_corner_random: "是否弯道随机",
  running_style: "跑法",
  distance_type: "赛道长度类型",
  phase: "比赛阶段",
  phase_random: "比赛阶段随机",
  phase_firsthalf_random: "阶段前半随机",
  phase_laterhalf_random: "阶段后半随机",
  order: "名次",
  order_rate: "名次百分比",
  distance_rate: "赛程百分比",
  is_overtake: "准备超车",
  overtake_target_time: "被准备超车时间",
  change_order_onetime: "名次变化",
  change_order_up_end_after: "终盘开始后名次变化",
  change_order_up_finalcorner_after: "终弯后名次变化",
  remain_distance: "剩余距离",
  blocked_side_continuetime: "竞争时间",
  bashin_diff_infront: "距离前方马娘距离",
  bashin_diff_behind: "距离后方马娘距离",
  distance_diff_top: "与第一名距离差",
  temptation_count: "失去冷静次数",
  is_badstart: "是否出迟",
  distance_diff_rate: "队伍位置百分比",
  is_finalcorner: "是否最终弯道起点之后",
  is_finalcorner_laterhalf: "是否最终弯道起点后半段",
  is_lastspurt: "是否冲刺状态",
  activate_count_heal: "已发动回复技能次数",
  order_rate_in40_continue: "持续处于前40%",
  order_rate_out70_continue: "持续处于后70%",
  accumulatetime: "比赛开始后时间",
};

function CmpFormatter(op: string) {
  return class {
    constructor(readonly cond: ConditionFormatter, readonly arg: number) {}
    format() {
      const original = this.cond.name;
      const displayName = CONDITION_NAME_MAP[original] ?? "未知";
      return (
        <div class="condition">
          <span class="conditionName">
            <Tooltip title={displayName} tall={false}>
              {this.cond.name}
            </Tooltip>
          </span>
          <span class="conditionOp">{op}</span>
          <span class="conditionArg">{this.cond.formatArg(this.arg)}</span>
        </div>
      );
    }
  };
}

const FormatParser = getParser<ConditionFormatter, OpFormatter>(
  conditionFormatters,
  {
    and: AndFormatter,
    or: OrFormatter,
    eq: CmpFormatter("=="),
    neq: CmpFormatter("!="),
    lt: CmpFormatter("<"),
    lte: CmpFormatter("<="),
    gt: CmpFormatter(">"),
    gte: CmpFormatter(">="),
  }
);

function forceSign(n: number) {
  return n <= 0 ? n.toString() : "+" + n;
}

const formatStat = forceSign;

function formatSpeed(n: number) {
  return (
    <Text id="skilldetails.speed" plural={n} fields={{ n: forceSign(n) }} />
  );
}

const formatEffect = Object.freeze({
  1: formatStat,
  2: formatStat,
  3: formatStat,
  4: formatStat,
  5: formatStat,
  9: (n) => `${(n * 100).toFixed(1)}%`,
  21: formatSpeed,
  22: formatSpeed,
  27: formatSpeed,
  31: (n) => (
    <Text id="skilldetails.accel" plural={n} fields={{ n: forceSign(n) }} />
  ),
  42: (n) => (
    <Text id="skilldetails.durationincrease" plural={n} fields={{ n }} />
  ),
});

export function ExpandedSkillDetails(props) {
  const skill = skilldata(props.id);
  return (
    <IntlProvider definition={STRINGS_cn}>
      <div
        class={`expandedSkill ${classnames[skill.rarity]}`}
        data-skillid={props.id}
      >
        <div class="expandedSkillHeader">
          <img
            class="skillIcon"
            src={`${ICON_BASE}/${skillmeta(props.id).iconId}.png`}
          />
          <span class="skillName">
            <Text id={`skillnames.${props.id.split("-")[0]}`} />
          </span>
          {props.dismissable && <span class="skillDismiss">✕</span>}
        </div>
        <div class="skillDetails">
          <div>
            <Text id="skilldetails.id" />
            {props.id}
          </div>
          {skilldata(props.id).alternatives.map((alt) => (
            <div class="skillDetailsSection">
              {alt.precondition.length > 0 && (
                <Fragment>
                  <Text id="skilldetails.preconditions" />
                  <div class="skillConditions">
                    {FormatParser.parse(
                      FormatParser.tokenize(alt.precondition)
                    ).format()}
                  </div>
                </Fragment>
              )}
              <Text id="skilldetails.conditions" />
              <div class="skillConditions">
                {FormatParser.parse(
                  FormatParser.tokenize(alt.condition)
                ).format()}
              </div>
              <Text id="skilldetails.effects" />
              <div class="skillEffects">
                {alt.effects.map((ef) => (
                  <div class="skillEffect">
                    <span class="skillEffectType">
                      <Text id={`skilleffecttypes.${ef.type}`}>{ef.type}</Text>
                    </span>
                    <span class="skillEffectValue">
                      {ef.type in formatEffect
                        ? formatEffect[ef.type](ef.modifier / 10000)
                        : ef.modifier / 10000}
                    </span>
                  </div>
                ))}
              </div>
              {alt.baseDuration > 0 && (
                <span class="skillDuration">
                  <Text id="skilldetails.baseduration" />{" "}
                  <Text
                    id="skilldetails.seconds"
                    fields={{ n: alt.baseDuration / 10000 }}
                  />
                </span>
              )}
              {props.distanceFactor && alt.baseDuration > 0 && (
                <span class="skillDuration">
                  <Text
                    id="skilldetails.effectiveduration"
                    fields={{ distance: props.distanceFactor }}
                  />{" "}
                  <Text
                    id="skilldetails.seconds"
                    fields={{
                      n: +(
                        (alt.baseDuration / 10000) *
                        (props.distanceFactor / 1000)
                      ).toFixed(2),
                    }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </IntlProvider>
  );
}

const iconIdPrefixes = Object.freeze({
  "1001": ["1001"],
  "1002": ["1002", "2018"],
  "1003": ["1003"],
  "1004": ["1004"],
  "1005": ["1005"],
  "1006": ["1006"],
  "2002": ["2002", "2011"],
  "2001": ["2001", "2010", "2014", "2015", "2016", "2019", "2021"],
  "2004": ["2004", "2012", "2017", "2020"],
  "2005": ["2005", "2013"],
  "2006": ["2006"],
  "2009": ["2009"],
  "3001": ["3001"],
  "3002": ["3002"],
  "3004": ["3004"],
  "3005": ["3005"],
  "3007": ["3007"],
  "4001": ["4001"],
});

const groups_filters = Object.freeze({
  rarity: ["white", "gold", "pink", "unique", "inherit"],
  icontype: [
    "1001",
    "1002",
    "1003",
    "1004",
    "1005",
    "1006",
    "4001",
    "2002",
    "2001",
    "2004",
    "2005",
    "2006",
    "2009",
    "3001",
    "3002",
    "3004",
    "3005",
    "3007",
  ],
  strategy: ["nige", "senkou", "sasi", "oikomi"],
  distance: ["short", "mile", "medium", "long"],
  surface: ["turf", "dirt"],
  location: [
    "phase0",
    "phase1",
    "phase2",
    "phase3",
    "finalcorner",
    "finalstraight",
  ],
});

function normalize(text: string): string {
  return text.replace(/[A-Za-z]/g, (c) => c.toUpperCase());
}

function textSearch(id: string, searchText: string, searchConditions: boolean) {
  const needle = normalize(searchText.trim());
  const baseId = id.split("-")[0];

  if (!skillnames[baseId]) {
    return 0;
  }
  if (/^\d+$/.test(searchText.trim())) {
    return skillnames[baseId].some((s) => normalize(s).indexOf(needle) > -1)
      ? 1
      : 0;
  }

  if (skillnames[baseId].some((s) => normalize(s).indexOf(needle) > -1)) {
    return 1;
  } else if (searchConditions) {
    let op = null;
    try {
      op = C(searchText);
    } catch (_) {
      return 0;
    }
    return parsedConditions[id].some((alt) => Matcher.treeMatch(op, alt))
      ? 2
      : 0;
  } else {
    return 0;
  }
}

export function SkillList(props) {
  const [visible, setVisible] = useState(() => new Set(props.ids));
  const active = {},
    setActive = {};
  Object.keys(groups_filters).forEach((group) => {
    active[group] = {};
    setActive[group] = {};
    groups_filters[group].forEach((filter) => {
      const [active_, setActive_] = useState(group == "icontype");
      active[group][filter] = active_;
      setActive[group][filter] = setActive_;
    });
  });
  const searchInput = useRef(null);
  const [searchText, setSearchText] = useState("");

  useEffect(
    function () {
      if (props.isOpen && searchInput.current) {
        searchInput.current.focus();
        searchInput.current.select();
      }
    },
    [props.isOpen]
  );

  // allow selecting debuffs multiple times to simulate multiple debuffers
  // TODO would like a slightly nicer/more general solution for this
  // (iconId 3xxxx is the debuff icons)
  const selectedMap = new Map(
    Array.from(props.selected)
      .filter((id) => skillmeta(id).iconId[0] != "3")
      .map((id) => [skillmeta(id).groupId, id])
  );

  function toggleSelected(e) {
    const se = e.target.closest("div.skill");
    if (se == null) return;
    e.stopPropagation();
    let id = se.dataset.skillid;
    const groupId = skillmeta(id).groupId;
    const newSelected = new Set(selectedMap.values());
    // TODO nasty: increment a fake counter for every debuff skill added with the same id
    const counts = new Map();
    Array.from(props.selected).forEach((id) => {
      id = id.split("-")[0];
      if (counts.has(id)) {
        const n = counts.get(id);
        newSelected.add(id + "-" + n);
        counts.set(id, n + 1);
      } else {
        newSelected.add(id);
        counts.set(id, 1);
      }
    });
    if (selectedMap.has(groupId)) {
      newSelected.delete(selectedMap.get(groupId));
    } else if (skillmeta(id).iconId[0] == "3") {
      id += counts.has(id) ? "-" + counts.get(id) : "";
    }
    newSelected.add(id);
    props.setSelected(newSelected);
  }

  function updateFilters(e) {
    const target = e.target as HTMLElement;
    const filterEl = target.closest("[data-filter]");
    const groupEl = target.closest("[data-filter-group]");

    if (
      !filterEl &&
      !(
        target.classList.contains("filterSearch") ||
        (target as HTMLInputElement).type === "search"
      )
    )
      return;
    e.stopPropagation();

    const group = groupEl?.dataset.filterGroup;
    const filter = filterEl?.dataset.filter;
    let newSearchText = searchText;

    if (group == "search") {
      newSearchText = (target as HTMLInputElement).value;
      setSearchText(newSearchText);
    } else if (group == "icontype" && filter) {
      if (groups_filters.icontype.every((f) => active.icontype[f])) {
        groups_filters.icontype.forEach(
          (f) =>
            f != filter && setActive.icontype[f]((active.icontype[f] = false))
        );
      } else {
        setActive.icontype[filter](
          (active.icontype[filter] = !active.icontype[filter])
        );
        if (!groups_filters.icontype.some((f) => active.icontype[f])) {
          groups_filters.icontype.forEach((f) =>
            setActive.icontype[f]((active.icontype[f] = true))
          );
        }
      }
    } else if (group && filter) {
      setActive[group][filter](active[group][filter]);
      Object.keys(active[group]).forEach((k) =>
        setActive[group][k](
          (active[group][k] = !active[group][k] && k == filter)
        )
      );
    }
    const filtered = new Set();
    let allowConditionSearch = true;
    props.ids.forEach((id) => {
      // if any names match, don't search conditions
      const passesTextSearch =
        newSearchText.length > 0
          ? textSearch(id, newSearchText, allowConditionSearch)
          : 3;
      if (allowConditionSearch && passesTextSearch == 1) {
        // name matches
        allowConditionSearch = false;
      }
      const pass =
        passesTextSearch &&
        Object.keys(groups_filters).every((group) => {
          const check = groups_filters[group].filter((f) => active[group][f]);
          if (check.length == 0) return true;
          if (group == "rarity") return check.some((f) => matchRarity(id, f));
          else if (group == "icontype") {
            return check.some((f) =>
              iconIdPrefixes[f].some((p) => {
                const meta = skillmeta(id);
                return meta?.iconId?.startsWith(p) || false;
              })
            );
          }
          return check.some((f) =>
            filterOps[f].some((op) =>
              parsedConditions[id].some((alt) => Matcher.treeMatch(op, alt))
            )
          );
        });
      if (pass) {
        filtered.add(id);
      }
    });
    setVisible(filtered);
  }

  function FilterGroup(props) {
    return (
      <div data-filter-group={props.group}>
        {props.children.map((c) => cloneElement(c, { group: props.group }))}
      </div>
    );
  }

  function FilterButton(props) {
    return (
      <span
        data-filter={props.filter}
        class={`filterChip ${
          active[props.group][props.filter] ? "active" : ""
        }`}
      >
        <Text id={`skillfilters.${props.filter}`} />
      </span>
    );
  }

  function IconFilterButton(props) {
    return (
      <span
        data-filter={props.type}
        class={`iconFilterChip ${
          active[props.group][props.type] ? "active" : ""
        }`}
        style={`background-image:url(${ICON_BASE}/${props.type}1.png)`}
      ></span>
    );
  }
  const items = props.ids
    .filter((id) => skillmeta(id)?.groupId) // 只保留有 groupId 的
    .map((id) => (
      <li key={id} class={visible.has(id) ? "" : "hidden"}>
        <Skill
          id={id}
          selected={selectedMap.get(skillmeta(id).groupId) === id}
        />
      </li>
    ));

  return (
    <div class="chooseSkill">
      <IntlProvider definition={STRINGS_cn}>
        <div class="filterGroups" onClick={updateFilters}>
          <div data-filter-group="search">
            <Localizer>
              <input
                type="text"
                inputmode="none"
                class="filterSearch"
                value={searchText}
                placeholder={<Text id="skillfilters.search" />}
                onInput={updateFilters}
                ref={searchInput}
              />
            </Localizer>
          </div>
          <FilterGroup group="rarity">
            <FilterButton filter="white" />
            <FilterButton filter="gold" />
            <FilterButton filter="pink" />
            <FilterButton filter="unique" />
            <FilterButton filter="inherit" />
          </FilterGroup>
          <FilterGroup group="icontype">
            {groups_filters["icontype"].map((t) => (
              <IconFilterButton type={t} />
            ))}
          </FilterGroup>
          <FilterGroup group="strategy">
            <FilterButton filter="nige" />
            <FilterButton filter="senkou" />
            <FilterButton filter="sasi" />
            <FilterButton filter="oikomi" />
          </FilterGroup>
          <FilterGroup group="distance">
            <FilterButton filter="short" />
            <FilterButton filter="mile" />
            <FilterButton filter="medium" />
            <FilterButton filter="long" />
          </FilterGroup>
          <FilterGroup group="surface">
            <FilterButton filter="turf" />
            <FilterButton filter="dirt" />
          </FilterGroup>
          <FilterGroup group="location">
            <FilterButton filter="phase0" />
            <FilterButton filter="phase1" />
            <FilterButton filter="phase2" />
            <FilterButton filter="phase3" />
            <FilterButton filter="finalcorner" />
            <FilterButton filter="finalstraight" />
          </FilterGroup>
        </div>
        <ul class="skillList" onClick={toggleSelected}>
          {items}
        </ul>
        <button
          type="button"
          id="closeSkill"
          class="btnBase rounded"
          title="关闭面板"
          onClick={(e) => e.currentTarget.closest(".chooseSkill")?.remove()}
        >
          ✕
        </button>
      </IntlProvider>
    </div>
  );
}
