import { h, Fragment, render } from "preact";
import {
  useState,
  useReducer,
  useMemo,
  useEffect,
  useRef,
} from "preact/hooks";
import { IntlProvider } from "preact-i18n";
import { Record } from "immutable";

import { CourseHelpers } from "@sim/CourseData";
import {
  RaceParameters,
  Mood,
  GroundCondition,
  Weather,
  Season,
  Time,
  Grade,
} from "@sim/RaceParameters";
import { Language } from "@components/Language";
import {
  ExpandedSkillDetails,
  STRINGS_cn as SKILL_STRINGS_cn,
} from "@components/SkillList";
import { TrackSelect } from "@components/RaceTrack";
import { RaceOverview } from "@components/RaceOverview";
import { HorseState, SkillSet } from "@components/HorseDefTypes";
import { HorseDef, horseDefTabs } from "@components/HorseDef";
import { TRACKNAMES_cn } from "@shared/trackNames";

import { getActivateableSkills, getNullRow, BasinnChart } from "./BasinnChart";
import { IntelDashboard } from "./IntelDashboard";
import { SuccessionPlanner } from "./SuccessionPlanner";

import { initTelemetry, postEvent } from "./telemetry";

import skilldata from "@data/skill_data.json";
import skillnames from "@data/skillnames.json";
import skill_meta from "@data/skill_meta.json";
import intelData from "@data/results_intel.json";

function skillmeta(id: string) {
  // handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
  return skill_meta[id.split("-")[0]];
}

import { Histogram } from "@components/Histogram";
import { ProgressBar } from "@components/ProgressBar";

import "./App.css";

const DEFAULT_COURSE_ID = 10606;
const DEFAULT_SAMPLES = 500;
const DEFAULT_SEED = 2615953739;
const ICON_BASE = `${import.meta.env.BASE_URL}icons`;
function id(x) {
  return x;
}

type TimeOfDaySelectProps = {
  value: number;
  set: (v: number) => void;
};

// 显式映射，去掉 magic number
const TIME_OF_DAY = [
  { value: 2, label: "中午", icon: "utx_ico_timezone_00.png" },
  { value: 3, label: "傍晚", icon: "utx_ico_timezone_01.png" },
  { value: 4, label: "夜晚", icon: "utx_ico_timezone_02.png" },
];

export function TimeOfDaySelect({ value, set }: TimeOfDaySelectProps) {
  return (
    <div className="inline-flex items-center" role="radiogroup">
      {TIME_OF_DAY.map(({ value: v, label, icon }) => {
        const selected = v === value;

        return (
          <div
            key={v}
            role="radio"
            aria-checked={selected}
            title={label}
            onClick={() => set(v)}
            className="cursor-pointer"
          >
            <img
              src={`${ICON_BASE}/${icon}`}
              alt={label}
              className="w-6 h-6 select-none pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
}

const GROUND = [
  { value: 1, label: "良" },
  { value: 2, label: "稍重" },
  { value: 3, label: "重" },
  { value: 4, label: "不良" },
];

export function GroundSelect({ value, set }) {
  return (
    <div
      className="inline-flex items-center"
      role="radiogroup"
      aria-label="Ground condition"
    >
      {GROUND.map(({ value: v, label }) => {
        const selected = v === value;

        return (
          <div
            key={v}
            role="radio"
            aria-checked={selected}
            onClick={() => set(v)}
            className="cursor-pointer text-sm font-medium"
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

const WEATHER = [
  {
    value: 1,
    label: SKILL_STRINGS_cn.skilldetails.weather[1],
    icon: "utx_ico_weather_00.png",
  },
  {
    value: 2,
    label: SKILL_STRINGS_cn.skilldetails.weather[2],
    icon: "utx_ico_weather_01.png",
  },
  {
    value: 3,
    label: SKILL_STRINGS_cn.skilldetails.weather[3],
    icon: "utx_ico_weather_02.png",
  },
  {
    value: 4,
    label: SKILL_STRINGS_cn.skilldetails.weather[4],
    icon: "utx_ico_weather_03.png",
  },
];

export function WeatherSelect({ value, set }) {
  return (
    <div
      className="inline-flex items-center"
      role="radiogroup"
      aria-label="Weather"
    >
      {WEATHER.map(({ value: v, label, icon }) => {
        const selected = v === value;

        return (
          <div
            key={v}
            role="radio"
            aria-checked={selected}
            title={label}
            onClick={() => set(v)}
            className="cursor-pointer"
          >
            <img
              src={`${ICON_BASE}/${icon}`}
              alt={label}
              className="w-6 h-6 select-none pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
}

const SEASON = [
  {
    value: 1,
    label: SKILL_STRINGS_cn.skilldetails.season[1],
    icon: "utx_txt_season_00.png",
  },
  {
    value: 2,
    label: SKILL_STRINGS_cn.skilldetails.season[2],
    icon: "utx_txt_season_01.png",
  },
  {
    value: 3,
    label: SKILL_STRINGS_cn.skilldetails.season[3],
    icon: "utx_txt_season_02.png",
  },
  {
    value: 4,
    label: SKILL_STRINGS_cn.skilldetails.season[4],
    icon: "utx_txt_season_03.png",
  },
];

export function SeasonSelect({ value, set }) {
  return (
    <div
      className="inline-flex items-center"
      role="radiogroup"
      aria-label="Season"
    >
      {SEASON.map(({ value: v, label, icon }) => {
        const selected = v === value;

        return (
          <div
            key={v}
            role="radio"
            aria-checked={selected}
            title={label}
            onClick={() => set(v)}
            className="cursor-pointer"
          >
            <img
              src={`${ICON_BASE}/${icon}`}
              alt={label}
              className="w-6 h-6 select-none pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
}

const NO_SHOW = Object.freeze([
  "10011",
  "10012",
  "10016",
  "10021",
  "10022",
  "10026",
  "10031",
  "10032",
  "10036",
  "10041",
  "10042",
  "10046",
  "10051",
  "10052",
  "10056",
  "10061",
  "10062",
  "10066",
  "40011",
  "20061",
  "20062",
  "20066",
]);

class RaceParams extends Record({
  mood: 2 as Mood,
  ground: GroundCondition.Good,
  weather: Weather.Sunny,
  season: Season.Spring,
  time: Time.Midday,
  grade: Grade.G1,
}) {}

const ORDER_RANGE_FOR_STRATEGY = Object.freeze({
  Nige: [1, 1],
  Senkou: [1, 4],
  Sasi: [5, 9],
  Oikomi: [5, 9],
  Oonige: [1, 1],
});

function racedefToParams(
  { mood, ground, weather, season, time, grade }: RaceParams,
  includeOrder?: string,
): RaceParameters {
  return {
    mood,
    groundCondition: ground,
    weather,
    season,
    time,
    grade,
    popularity: 1,
    skillId: "",
    orderRange:
      includeOrder != null ? ORDER_RANGE_FOR_STRATEGY[includeOrder] : null,
    numUmas: 9,
  };
}

async function serialize(
  courseId: number,
  nsamples: number,
  seed: number,
  usePosKeep: boolean,
  racedef: RaceParams,
  uma1: HorseState,
  uma2: HorseState,
) {
  const json = JSON.stringify({
    courseId,
    nsamples,
    seed,
    usePosKeep,
    racedef: racedef.toJS(),
    uma1: uma1.toJS(),
    uma2: uma2.toJS(),
  });
  const enc = new TextEncoder();
  const stringStream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(json));
      controller.close();
    },
  });
  const zipped = stringStream.pipeThrough(new CompressionStream("gzip"));
  const reader = zipped.getReader();
  let buf = new Uint8Array();
  let result;
  while ((result = await reader.read())) {
    if (result.done) {
      return encodeURIComponent(btoa(String.fromCharCode(...buf)));
    } else {
      buf = new Uint8Array([...buf, ...result.value]);
    }
  }
}

async function deserialize(hash) {
  const zipped = atob(decodeURIComponent(hash));
  const buf = new Uint8Array(zipped.split("").map((c) => c.charCodeAt(0)));
  const stringStream = new ReadableStream({
    start(controller) {
      controller.enqueue(buf);
      controller.close();
    },
  });
  const unzipped = stringStream.pipeThrough(new DecompressionStream("gzip"));
  const reader = unzipped.getReader();
  const decoder = new TextDecoder();
  let json = "";
  let result;
  while ((result = await reader.read())) {
    if (result.done) {
      try {
        const o = JSON.parse(json);
        return {
          courseId: o.courseId,
          nsamples: o.nsamples,
          seed: o.seed || DEFAULT_SEED, // field added later, could be undefined when loading state from existing links
          usePosKeep: o.usePosKeep,
          racedef: new RaceParams(o.racedef),
          uma1: new HorseState(o.uma1).set("skills", SkillSet(o.uma1.skills)),
          uma2: new HorseState(o.uma2).set("skills", SkillSet(o.uma2.skills)),
        };
      } catch (_) {
        return {
          courseId: DEFAULT_COURSE_ID,
          nsamples: DEFAULT_SAMPLES,
          seed: DEFAULT_SEED,
          usePosKeep: true,
          racedef: new RaceParams(),
          uma1: new HorseState(),
          uma2: new HorseState(),
        };
      }
    } else {
      json += decoder.decode(result.value);
    }
  }
}

const EMPTY_RESULTS_STATE = {
  courseId: DEFAULT_COURSE_ID,
  results: [],
  runData: null,
  chartData: null,
  displaying: "",
};
function updateResultsState(
  state: typeof EMPTY_RESULTS_STATE,
  o: number | string | { results: any; runData: any },
) {
  if (typeof o == "number") {
    return {
      courseId: o,
      results: [],
      runData: null,
      chartData: null,
      displaying: "",
    };
  } else if (typeof o == "string") {
    postEvent("setChartData", { display: o });
    return {
      courseId: state.courseId,
      results: state.results,
      runData: state.runData,
      chartData: state.runData != null ? state.runData[o] : null,
      displaying: o,
    };
  } else {
    return {
      courseId: state.courseId,
      results: o.results,
      runData: o.runData,
      chartData: o.runData[state.displaying || "meanrun"],
      displaying: state.displaying || "meanrun",
    };
  }
}

type CompetitionDetail = {
  courseId: number;
  track: string;
  distance: number;
  ground: string;
  seasonValue: number;
  weatherValue: number;
  conditionValue: number;
};

type CompetitionPreset = {
  key: string;
  name: string;
  startTimestamp: number;
  endTimestamp: number;
  detail: CompetitionDetail;
};

const COMPETITION_PRESETS: CompetitionPreset[] = (
  ((intelData as any).races ?? []) as Array<{
    id: number;
    name: string;
    startTimestamp: number;
    endTimestamp: number;
    details?: CompetitionDetail[];
  }>
)
  .flatMap((race) => {
    const detail = race.details?.[0];
    return detail?.courseId
      ? [
          {
            key: `${race.startTimestamp}:${race.id}`,
            name: race.name,
            startTimestamp: race.startTimestamp,
            endTimestamp: race.endTimestamp,
            detail,
          },
        ]
      : [];
  })
  .filter((race) => race.endTimestamp >= Date.now() / 1000)
  .sort((a, b) => a.startTimestamp - b.startTimestamp);

function raceParamsForCompetition(preset: CompetitionPreset) {
  return new RaceParams({
    mood: 2 as Mood,
    ground: (preset.detail.conditionValue ||
      GroundCondition.Good) as GroundCondition,
    weather: (preset.detail.weatherValue || Weather.Sunny) as Weather,
    season: (preset.detail.seasonValue || Season.Spring) as Season,
    time: Time.Midday,
    grade: Grade.G1,
  });
}

function competitionLabel(preset: CompetitionPreset, index: number) {
  const date = new Date(preset.startTimestamp * 1000);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const surface = preset.detail.ground === "泥地" ? "泥" : "草";
  return `${index === 0 ? "当期" : "后续"} · ${preset.name} · ${monthDay} · ${preset.detail.track}${preset.detail.distance}m${surface}`;
}

function CompetitionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  if (COMPETITION_PRESETS.length === 0) return null;
  return (
    <label class="competitionSelect">
      <span>大赛</span>
      <select
        aria-label="大赛配置"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">自定义赛道</option>
        {COMPETITION_PRESETS.map((preset, index) => (
          <option value={preset.key}>{competitionLabel(preset, index)}</option>
        ))}
      </select>
    </label>
  );
}

const SIMULATOR_CACHE_KEY = "uma-tools.simulator-config.v1";

type InitialSimulatorConfig = {
  courseId: number;
  racedef: RaceParams;
  nsamples: number;
  seed: number;
  usePosKeep: boolean;
  uma1: HorseState;
  uma2: HorseState;
  competitionKey: string;
};

function restoreHorseState(value: any) {
  const horse = value && typeof value === "object" ? value : {};
  return new HorseState(horse).set(
    "skills",
    SkillSet(Array.isArray(horse.skills) ? horse.skills : []),
  );
}

function defaultSimulatorConfig(): InitialSimulatorConfig {
  const competition = COMPETITION_PRESETS[0];
  return {
    courseId: competition?.detail.courseId ?? DEFAULT_COURSE_ID,
    racedef: competition
      ? raceParamsForCompetition(competition)
      : new RaceParams(),
    nsamples: DEFAULT_SAMPLES,
    seed: DEFAULT_SEED,
    usePosKeep: true,
    uma1: new HorseState(),
    uma2: new HorseState(),
    competitionKey: competition?.key ?? "",
  };
}

function loadInitialSimulatorConfig(): InitialSimulatorConfig {
  const fallback = defaultSimulatorConfig();
  if (typeof window === "undefined" || window.location.hash) return fallback;
  try {
    const raw = window.localStorage.getItem(SIMULATOR_CACHE_KEY);
    if (!raw) return fallback;
    const cached = JSON.parse(raw);
    return {
      courseId: Number(cached.courseId) || fallback.courseId,
      racedef: new RaceParams(cached.racedef ?? fallback.racedef.toJS()),
      nsamples: Number(cached.nsamples) || DEFAULT_SAMPLES,
      seed: Number.isFinite(cached.seed) ? cached.seed : DEFAULT_SEED,
      usePosKeep:
        typeof cached.usePosKeep === "boolean" ? cached.usePosKeep : true,
      uma1: restoreHorseState(cached.uma1),
      uma2: restoreHorseState(cached.uma2),
      competitionKey:
        typeof cached.competitionKey === "string" &&
        COMPETITION_PRESETS.some(
          (preset) => preset.key === cached.competitionKey,
        )
          ? cached.competitionKey
          : "",
    };
  } catch {
    return fallback;
  }
}

function matchingCompetitionKey(courseId: number, racedef: RaceParams) {
  return (
    COMPETITION_PRESETS.find((preset) => {
      const expected = raceParamsForCompetition(preset);
      return (
        preset.detail.courseId === courseId &&
        expected.ground === racedef.ground &&
        expected.weather === racedef.weather &&
        expected.season === racedef.season &&
        expected.time === racedef.time
      );
    })?.key ?? ""
  );
}

const EXCLUDED_CHART_SKILL_ICON_IDS = new Set([
  // 特殊活动技能：内道英雄、冲刺英雄
  "1010051",
]);

const baseSkillsToTest = Object.keys(skilldata).filter((id) => {
  const meta = skillmeta(id);
  return (
    skilldata[id].rarity < 3 &&
    !EXCLUDED_CHART_SKILL_ICON_IDS.has(meta?.iconId)
  );
});

const enum Mode {
  Compare,
  Chart,
}

type AppPage = "simulator" | "succession" | "intel";

function appBasePath() {
  const basePath = new URL(import.meta.env.BASE_URL, window.location.href)
    .pathname;
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  const pageSuffix = currentPath.match(/\/(intel|succession)$/)?.[1];
  return pageSuffix
    ? `${basePath.replace(new RegExp(`${pageSuffix}\\/?$`), "")}`
    : basePath;
}

function pathForPage(page: AppPage) {
  const basePath = appBasePath();
  if (page === "intel") {
    return `${basePath.replace(/\/$/, "")}/intel/`;
  }
  if (page === "succession") {
    return `${basePath.replace(/\/$/, "")}/succession/`;
  }
  return basePath;
}

function initialAppPage(): AppPage {
  if (typeof window === "undefined") return "simulator";
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  if (currentPath.endsWith("/intel")) return "intel";
  if (currentPath.endsWith("/succession")) return "succession";
  return "simulator";
}

function AppNav({
  activePage,
  setActivePage,
}: {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
}) {
  return (
    <header class="appNav">
      <div>
        <strong>《闪耀优俊少女》工具集</strong>
        <a
          class="appRepositoryLink"
          href="https://github.com/mikumifa/uma-tools"
        >
          github.com/mikumifa/uma-tools
        </a>
      </div>
      <nav aria-label="功能切换">
        <button
          type="button"
          class={activePage === "simulator" ? "selected" : ""}
          onClick={() => setActivePage("simulator")}
        >
          身位图计算
        </button>
        <button
          type="button"
          class={activePage === "succession" ? "selected" : ""}
          title="Inheritance Planner"
          onClick={() => setActivePage("succession")}
        >
          种马设计
        </button>
        <button
          type="button"
          class={activePage === "intel" ? "selected" : ""}
          onClick={() => setActivePage("intel")}
        >
          情报汇总
        </button>
      </nav>
    </header>
  );
}

const enum UiStateMsg {
  SetModeCompare,
  SetModeChart,
  SetCurrentIdx0,
  SetCurrentIdx1,
  ToggleExpand,
  OpenOverlay,
  CloseOverlay,
}

const DEFAULT_UI_STATE = { mode: Mode.Chart, currentIdx: 0, expanded: false };

function nextUiState(state: typeof DEFAULT_UI_STATE, msg: UiStateMsg) {
  switch (msg) {
    case UiStateMsg.SetModeCompare:
      return { ...state, mode: Mode.Compare };
    case UiStateMsg.SetModeChart:
      return { ...state, mode: Mode.Chart, currentIdx: 0, expanded: false };
    case UiStateMsg.SetCurrentIdx0:
      return { ...state, currentIdx: 0 };
    case UiStateMsg.SetCurrentIdx1:
      return { ...state, currentIdx: 1 };
    case UiStateMsg.ToggleExpand:
      return { ...state, expanded: !state.expanded };
    case UiStateMsg.OpenOverlay:
      return { ...state, expanded: true };
    case UiStateMsg.CloseOverlay:
      return { ...state, expanded: false };
  }
}

function App() {
  const [activePageState, setActivePageState] =
    useState<AppPage>(initialAppPage);
  const setActivePage = (page: AppPage) => {
    setActivePageState(page);
    if (typeof window === "undefined") return;
    const nextPath = pathForPage(page);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  };
  const activePage = activePageState;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => setActivePageState(initialAppPage());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const workerProgress = useRef({ percents: [0, 0], totals: [1, 1] });
  const pendingChartResults = useRef(new Map());
  const progressUiRef = useRef({ percent: 0, lastUpdate: 0 });
  const activeRunId = useRef(0);
  const raceTrackRef = useRef<HTMLDivElement | null>(null);
  const resultsPaneRef = useRef<HTMLDivElement | null>(null);
  const [ShowUnreleased, setShowUnreleased] = useState(false);
  const [forceShowTrack, setForceShowTrack] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1540 : window.innerWidth,
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const [{ mode, currentIdx, expanded }, updateUiState] = useReducer(
    nextUiState,
    DEFAULT_UI_STATE,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = viewportWidth <= 900;
  const showTrack = !isMobile;
  const isLandscapeView = isMobile && forceShowTrack;

  const desktopSidebarWidth =
    mode === Mode.Chart
      ? viewportWidth <= 1180
        ? Math.max(460, Math.round(viewportWidth * 0.43))
        : 560
      : 380;
  const desktopWorkspaceWidth = viewportWidth - 58;
  const trackViewportWidth = isLandscapeView
    ? viewportWidth
    : isMobile
      ? Math.min(Math.max(320, viewportWidth), 640)
      : Math.max(560, desktopWorkspaceWidth - desktopSidebarWidth - 12);
  const trackWidth = useMemo(() => {
    return Math.max(
      300,
      trackViewportWidth - (isMobile ? trackViewportWidth * 0.1 : 16),
    );
  }, [trackViewportWidth, isMobile]);

  const trackHeight = useMemo(() => {
    if (isLandscapeView) {
      return Math.round(viewportHeight * 0.9);
    }
    return Math.round(trackWidth * 0.28);
  }, [trackWidth, isLandscapeView]);

  const trackWidthStyle = useMemo(
    () =>
      ({
        "--track-width": `${trackWidth}px`,
        "--sidebar-width": `${desktopSidebarWidth}px`,
      }) as any,
    [trackWidth, desktopSidebarWidth],
  );

  const histogramWidth = useMemo(
    () =>
      isMobile
        ? Math.min(600, Math.max(280, trackWidth))
        : Math.min(
            720,
            Math.max(360, Math.round(desktopWorkspaceWidth / 2) - 56),
          ),
    [trackWidth, isMobile, desktopWorkspaceWidth],
  );

  const histogramHeight = useMemo(
    () =>
      isMobile
        ? Math.round(histogramWidth * 0.55)
        : Math.min(340, Math.max(220, Math.round(histogramWidth * 0.45))),
    [histogramWidth, isMobile],
  );
  const chartHistogramWidth = useMemo(
    () =>
      isMobile
        ? Math.max(280, Math.min(viewportWidth - 40, 520))
        : Math.max(320, Math.round(desktopSidebarWidth - 32)),
    [desktopSidebarWidth, isMobile, viewportWidth],
  );
  const chartHistogramHeight = useMemo(
    () => Math.max(210, Math.min(310, Math.round(chartHistogramWidth * 0.5))),
    [chartHistogramWidth],
  );
  const showStatusBar = Boolean(status) || progress > 0;

  const initialConfig = useMemo(loadInitialSimulatorConfig, []);
  const [racedef, setRaceDef] = useState(() => initialConfig.racedef);
  const [nsamples, setSamples] = useState(initialConfig.nsamples);
  const [seed, setSeed] = useState(initialConfig.seed);
  const [usePosKeep, togglePosKeep] = useReducer(
    (current, next?: boolean) =>
      typeof next === "boolean" ? next : !current,
    initialConfig.usePosKeep,
  );
  const [showHp, toggleShowHp] = useReducer((b, _) => !b, false);
  const [selectedCompetitionKey, setSelectedCompetitionKey] = useState(
    initialConfig.competitionKey,
  );
  const [configHydrated, setConfigHydrated] = useState(
    () => typeof window === "undefined" || !window.location.hash,
  );
  // const [showRunPane, setShowRunPane] = useState(false);

  const [{ courseId, results, runData, chartData, displaying }, setSimState] =
    useReducer(
      updateResultsState,
      initialConfig.courseId,
      (initialCourseId) => ({
        ...EMPTY_RESULTS_STATE,
        courseId: initialCourseId,
      }),
    );
  const setCourseId = setSimState;
  const setResults = setSimState;
  const setChartData = setSimState;

  const [tableData, updateTableData] = useReducer((data, newData) => {
    const merged = new Map();
    if (newData == "reset") {
      return merged;
    }
    data.forEach((v, k) => merged.set(k, v));
    newData.forEach((v, k) => merged.set(k, v));
    return merged;
  }, new Map());
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSampleRanges, setSelectedSampleRanges] = useState([]);
  const [possibleActivationRanges, setPossibleActivationRanges] = useState([]);
  const [hoveredSkill, setHoveredSkill] = useState(null);
  const [skillDetailOpen, setSkillDetailOpen] = useState(false);
  const [skillDetailId, setSkillDetailId] = useState("");
  const hoverDismissTimer = useRef<number | null>(null);

  function cancelHoverDismiss() {
    if (hoverDismissTimer.current == null) return;
    window.clearTimeout(hoverDismissTimer.current);
    hoverDismissTimer.current = null;
  }

  function showHoveredSkill(id, point) {
    cancelHoverDismiss();
    setHoveredSkill({ id, ...point });
  }

  function scheduleHoverDismiss() {
    cancelHoverDismiss();
    hoverDismissTimer.current = window.setTimeout(() => {
      hoverDismissTimer.current = null;
      setHoveredSkill(null);
    }, 160);
  }

  useEffect(
    () => () => {
      if (hoverDismissTimer.current != null) {
        window.clearTimeout(hoverDismissTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (tableData.size === 0) {
      if (selectedSkillId) setSelectedSkillId("");
      if (selectedSampleRanges.length > 0) setSelectedSampleRanges([]);
      if (possibleActivationRanges.length > 0) setPossibleActivationRanges([]);
      return;
    }
    if (!selectedSkillId || !tableData.has(selectedSkillId)) {
      const first = tableData.keys().next().value as string | undefined;
      if (first) setSelectedSkillId(first);
    }
  }, [
    tableData,
    selectedSkillId,
    selectedSampleRanges.length,
    possibleActivationRanges.length,
  ]);

  useEffect(() => {
    if (!selectedSkillId) return;
    const row = tableData.get(selectedSkillId);
    setPossibleActivationRanges(row?.possibleActivationRanges ?? []);
  }, [tableData, selectedSkillId]);

  function racesetter(prop) {
    return (value) => {
      setSelectedCompetitionKey("");
      setRaceDef(racedef.set(prop, value));
    };
  }

  const course = useMemo(() => CourseHelpers.getCourse(courseId), [courseId]);

  const viewTrackImage = () => {
    setForceShowTrack(true);
  };

  useEffect(() => {
    if (!isMobile && forceShowTrack) {
      setForceShowTrack(false);
    }
  }, [isMobile, forceShowTrack]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const originalOverflow = document.body.style.overflow;
    if (forceShowTrack) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [forceShowTrack]);

  const [uma1, setUma1] = useState(() => initialConfig.uma1);
  const [uma2, setUma2] = useState(() => initialConfig.uma2);

  function setCustomCourseId(nextCourseId: number) {
    setSelectedCompetitionKey("");
    setCourseId(nextCourseId);
  }

  function selectCompetition(key: string) {
    setSelectedCompetitionKey(key);
    const preset = COMPETITION_PRESETS.find((candidate) => candidate.key === key);
    if (!preset) return;
    setCourseId(preset.detail.courseId);
    setRaceDef(raceParamsForCompetition(preset));
  }

  useEffect(() => {
    if (!configHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SIMULATOR_CACHE_KEY,
        JSON.stringify({
          version: 1,
          courseId,
          racedef: racedef.toJS(),
          nsamples,
          seed,
          usePosKeep,
          uma1: uma1.toJS(),
          uma2: uma2.toJS(),
          competitionKey: selectedCompetitionKey,
        }),
      );
    } catch {
      // Storage can be unavailable in private browsing or restricted embeds.
    }
  }, [
    configHydrated,
    courseId,
    racedef,
    nsamples,
    seed,
    usePosKeep,
    uma1,
    uma2,
    selectedCompetitionKey,
  ]);

  // Mobile 不支持对比模式，强制回到图表模式
  useEffect(() => {
    if (isMobile && mode === Mode.Compare) {
      updateUiState(UiStateMsg.SetModeChart);
    }
  }, [isMobile, mode]);

  function toggleExpand(e: Event) {
    e.stopPropagation();
    const next = !expanded;
    postEvent("toggleExpand", { expand: next });
    updateUiState(next ? UiStateMsg.OpenOverlay : UiStateMsg.CloseOverlay);
  }
  function openUmaOverlay() {
    if (!expanded) {
      postEvent("toggleExpand", { expand: true });
      updateUiState(UiStateMsg.OpenOverlay);
    } else {
      postEvent("toggleExpand", { expand: false });
      updateUiState(UiStateMsg.CloseOverlay);
    }
  }
  useEffect(() => {
    if (!expanded || typeof window === "undefined") return;
    const overlay = document.getElementById("umaOverlay") as HTMLElement | null;
    overlay && overlay.focus();
  }, [expanded]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const originalOverflow = document.body.style.overflow;
    if (expanded || skillDetailOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = originalOverflow;
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [expanded, skillDetailOpen]);

  useEffect(() => {
    if (!skillDetailOpen || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSkillDetailOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [skillDetailOpen]);
  const topPaneClass = [
    chartData ? "hasResults" : "",
    isMobile ? "mobileLayout" : "desktopLayout",
    mode === Mode.Compare ? "mode-compare" : "mode-chart",
  ]
    .filter(Boolean)
    .join(" ");

  function createWorker(index: number) {
    const w = new Worker(new URL("./simulator.worker.ts", import.meta.url), {
      type: "module",
    });
    w.addEventListener("message", function (e) {
      const { type, results, runId, stage, percent } = e.data;
      if (runId != null && runId !== activeRunId.current) return;
      switch (type) {
        case "compare":
          setResults(results);
          break;
        case "chart":
          results.forEach((value, key) =>
            pendingChartResults.current.set(key, value),
          );
          break;
        case "progress":
          workerProgress.current.percents[index] = percent;
          updateSimulationProgress(stage, percent >= 100);
          if (workerProgress.current.percents.every((p) => p >= 100)) {
            if (pendingChartResults.current.size > 0) {
              updateTableData(new Map(pendingChartResults.current));
              pendingChartResults.current.clear();
            }
            setIsSimulating(false);
          }
          break;
      }
    });
    return w;
  }

  const workers = useMemo(
    () => [0, 1, 2, 3].map((index) => createWorker(index)),
    [],
  );
  const worker1 = workers[0];

  function loadState() {
    if (window.location.hash) {
      setConfigHydrated(false);
      deserialize(window.location.hash.slice(1))
        .then((o) => {
          setCourseId(o.courseId);
          setSamples(o.nsamples);
          setSeed(o.seed);
          togglePosKeep(o.usePosKeep);
          setRaceDef(o.racedef);
          setUma1(o.uma1);
          setUma2(o.uma2);
          setSelectedCompetitionKey(
            matchingCompetitionKey(o.courseId, o.racedef),
          );
        })
        .finally(() => setConfigHydrated(true));
    } else {
      setConfigHydrated(true);
    }
  }

  useEffect(function () {
    loadState();
    window.addEventListener("hashchange", loadState);
  }, []);

  function copyStateUrl(e?: Event) {
    e?.preventDefault();
    serialize(courseId, nsamples, seed, usePosKeep, racedef, uma1, uma2).then(
      (hash) => {
        const url =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.navigator.clipboard.writeText(url + "#" + hash);
      },
    );
  }

  function copyUmaToRight() {
    postEvent("copyUma", { direction: "to-right" });
    setUma2(uma1);
  }

  function copyUmaToLeft() {
    postEvent("copyUma", { direction: "to-left" });
    setUma1(uma2);
  }

  function swapUmas() {
    postEvent("copyUma", { direction: "swap" });
    setUma1(uma2);
    setUma2(uma1);
  }

  const strings = { skillnames: {}, tracknames: TRACKNAMES_cn };
  const langid = 0;
  Object.keys(skillnames).forEach(
    (id) => (strings.skillnames[id] = skillnames[id][langid]),
  );

  function updateSimulationProgress(stage: string, force = false) {
    const { percents, totals } = workerProgress.current;
    const total = totals.reduce((sum, count) => sum + count, 0);
    const percent = Math.min(
      100,
      total === 0
        ? Math.min(...percents)
        : Math.round(
            percents.reduce(
              (sum, workerPercent, index) =>
                sum + workerPercent * totals[index],
              0,
            ) / total,
          ),
    );
    const now = performance.now();

    if (!force && percent === progressUiRef.current.percent) return;
    if (!force && now - progressUiRef.current.lastUpdate < 120) return;

    progressUiRef.current = { percent, lastUpdate: now };
    setProgress(percent);
    setStatus(stage ? `${stage} · ${percent}%` : `${percent}%`);
  }

  function resetSimulationProgress(label: string) {
    workerProgress.current = { percents: [0, 0], totals: [1, 1] };
    progressUiRef.current = { percent: 0, lastUpdate: 0 };
    setProgress(0);
    setStatus(label);
    setIsSimulating(true);
  }

  function doComparison() {
    if (isSimulating) return;
    postEvent("doComparison", {});
    const runId = activeRunId.current + 1;
    activeRunId.current = runId;
    resetSimulationProgress("准备对比模拟...");
    pendingChartResults.current.clear();
    workerProgress.current = { percents: [0], totals: [1] };

    worker1.postMessage({
      msg: "compare",
      data: {
        runId,
        nsamples,
        course,
        racedef: racedefToParams(racedef),
        uma1: uma1.toJS(),
        uma2: uma2.toJS(),
        options: { seed, usePosKeep },
      },
    });
  }

  async function doBasinnChart() {
    if (isSimulating) return;
    postEvent("doBasinnChart", {});
    const runId = activeRunId.current + 1;
    activeRunId.current = runId;
    resetSimulationProgress("筛选可触发技能...");
    pendingChartResults.current.clear();
    setSkillDetailOpen(false);
    updateTableData("reset");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const params = racedefToParams(racedef, uma1.strategy);
    const skills = getActivateableSkills(
      baseSkillsToTest.filter(
        (s) =>
          !uma1.skills.has(s) &&
          (s[0] !== "9" || !uma1.skills.has("1" + s.slice(1))),
      ),
      uma1,
      course,
      params,
    );
    if (runId !== activeRunId.current) return;

    const uma = uma1.toJS();
    const workerCount = Math.min(
      workers.length,
      Math.max(1, Math.min(skills.length, navigator.hardwareConcurrency || 2)),
    );
    const skillChunks = Array.from({ length: workerCount }, () => []);
    skills.forEach((skillId, index) => {
      skillChunks[index % workerCount].push(skillId);
    });
    workerProgress.current = {
      percents: skillChunks.map((chunk) => (chunk.length === 0 ? 100 : 0)),
      totals: skillChunks.map((chunk) => chunk.length),
    };
    updateSimulationProgress(
      `模拟 ${skills.length} 个技能 · ${workerCount} 路并行`,
      true,
    );

    skillChunks.forEach((chunk, index) => {
      workers[index].postMessage({
        msg: "chart",
        data: {
          runId,
          skills: chunk,
          course,
          racedef: params,
          uma,
          options: { seed, usePosKeep },
        },
      });
    });
  }

  function selectSkillDetails(skillId) {
    const r = tableData.get(skillId);
    if (skillId !== selectedSkillId) {
      setSelectedSampleRanges([]);
      setPossibleActivationRanges(r?.possibleActivationRanges ?? []);
    }
    setSelectedSkillId(skillId);
    if (r?.runData != null) setResults(r);
  }

  function addSkillFromTable(skillId) {
    postEvent("addSkillFromTable", { skillId });
    setUma1(uma1.set("skills", uma1.skills.add(skillId)));
  }

  function showPopover(skillId) {
    postEvent("showPopover", { skillId });
    selectSkillDetails(skillId);
  }

  function openSkillDetails(skillId: string) {
    if (!skillId) return;
    cancelHoverDismiss();
    setHoveredSkill(null);
    setSkillDetailId(skillId);
    setSkillDetailOpen(true);
  }

  function closeSkillDetails() {
    setSkillDetailOpen(false);
  }

  const mid = Math.floor(results.length / 2);
  const median =
    results.length % 2 == 0
      ? (results[mid - 1] + results[mid]) / 2
      : results[mid];
  const mean = results.reduce((a, b) => a + b, 0) / results.length;

  const compareLaneColors = [
    { stroke: "#3d7dd1", fill: "rgba(61, 125, 209, 0.7)" },
    { stroke: "#ff6fba", fill: "rgba(255, 111, 186, 0.7)" },
  ];
  const commonSkillLaneColor = {
    stroke: "#64748b",
    fill: "rgba(100, 116, 139, 0.72)",
  };
  const selectedSkillLaneColor = {
    stroke: "#db2777",
    fill: "rgba(219, 39, 119, 0.78)",
  };
  const selectedLaneSkillId = selectedSkillId.split("-")[0];
  const makeSkillLaneEvents = (activations, color, sourceIndex) => {
    if (!activations) return [];
    return activations
      .keys()
      .filter((id) => !!skillmeta(id))
      .flatMap((id) => {
        const meta = skillmeta(id);
        const skillName = skillnames[id]?.[0];
        if (!skillName || NO_SHOW.indexOf(meta.iconId) > -1) return [];
        return activations.get(id).map((ar, activationIndex) => ({
          key: `${sourceIndex}-${id}-${activationIndex}-${ar[0]}`,
          color,
          text: skillName,
          start: ar[0],
          end: Math.max(ar[0] + 0.1, ar[1]),
        }));
      })
      .toArray();
  };
  const skillLaneEvents =
    chartData == null
      ? []
      : mode === Mode.Chart
        ? [
            ...makeSkillLaneEvents(
              chartData.sk[0],
              commonSkillLaneColor,
              0,
            ),
            ...(selectedLaneSkillId
              ? makeSkillLaneEvents(
                  new Map([
                    [
                      selectedLaneSkillId,
                      chartData.sk[1].get(selectedLaneSkillId) ?? [],
                    ],
                  ]),
                  selectedSkillLaneColor,
                  1,
                )
              : []),
          ]
        : chartData.sk.flatMap((activations, index) =>
            makeSkillLaneEvents(
              activations,
              compareLaneColors[index],
              index,
            ),
          );

  const filteredChartData = useMemo(() => {
    return tableData
      .values()
      .toArray()
      .filter((row) => {
        if (!row?.id) {
          console.warn("Warning: row.id 不存在，已过滤", row);
          return false;
        }
        if (!skillnames[row.id]) {
          console.warn(`Warning: skillnames 中没有找到 id=${row.id}，已过滤`);
          return false;
        }
        const skillName = skillnames[row.id][0];
        if (!skillName) {
          console.warn(
            `Warning: skillnames 中没有找到 id=${row.id} 内容为空，已过滤`,
          );
          return false;
        }
        return ShowUnreleased || !skillName.startsWith("[未实装]");
      })
      .map((row) => ({
        ...row,
        mean: Number.isNaN(row.mean) ? 0 : row.mean,
        min: Number.isNaN(row.min) ? 0 : row.min,
        max: Number.isNaN(row.max) ? 0 : row.max,
        median: Number.isNaN(row.mean) ? 0 : row.median,
      }));
  }, [tableData, ShowUnreleased]);
  const selectedChartRow =
    (selectedSkillId && tableData.get(selectedSkillId)) ||
    (filteredChartData.length > 0
      ? tableData.get(filteredChartData[0].id)
      : null);
  const selectedChartSkill = selectedChartRow?.id;
  const selectedChartSkillName = selectedChartSkill
    ? skillnames[selectedChartSkill.split("-")[0]]?.[0] || selectedChartSkill
    : "";
  const selectedChartResults = selectedChartRow?.results ?? [];
  const selectedChartSampleRuns = selectedChartRow?.sampleRuns ?? [];

  let resultsPane;
  if (mode == Mode.Compare && results.length > 0) {
    resultsPane = (
      <div id="resultsPaneWrapper" style={trackWidthStyle} ref={resultsPaneRef}>
        <div id="resultsPane" class="mode-compare" style={trackWidthStyle}>
          <table id="resultsSummary">
            <tfoot>
              <tr>
                {Object.entries({
                  minrun: ["最小", "最小差异"],
                  maxrun: ["最大", "最大差异"],
                  meanrun: ["平均", "平均差异"],
                  medianrun: ["中位", "差异的中位数"],
                }).map(([k, label]) => (
                  <th
                    scope="col"
                    class={displaying == k ? "selected" : ""}
                    title={label[1]}
                    onClick={() => setChartData(k)}
                  >
                    {label[0]}
                  </th>
                ))}
              </tr>
            </tfoot>
            <tbody>
              <tr>
                <td onClick={() => setChartData("minrun")}>
                  {results[0].toFixed(2)}
                  <span class="unit-basinn">马身</span>
                </td>
                <td onClick={() => setChartData("maxrun")}>
                  {results[results.length - 1].toFixed(2)}
                  <span class="unit-basinn">马身</span>
                </td>
                <td onClick={() => setChartData("meanrun")}>
                  {mean.toFixed(2)}
                  <span class="unit-basinn">马身</span>
                </td>
                <td onClick={() => setChartData("medianrun")}>
                  {median.toFixed(2)}
                  <span class="unit-basinn">马身</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div id="resultsHelp">
            负数意味着{" "}
            <strong style="color:var(--uma-blue)">Umamusume 1</strong> 更快,
            正数意味着{" "}
            <strong style="color:var(--uma-pink)">Umamusume 2</strong> 更快
          </div>
          <Histogram
            width={histogramWidth}
            height={histogramHeight}
            data={results}
          />
        </div>
        <div id="infoTables">
          <table>
            <caption style="color:var(--uma-blue)">Umamusume 1</caption>
            <tbody>
              <tr>
                <th>完成时间</th>
                <td>
                  {chartData.t[0][chartData.t[0].length - 1].toFixed(4) + " 秒"}
                </td>
              </tr>
              <tr>
                <th>起跑延迟</th>
                <td>{chartData.sdly[0].toFixed(4) + " 秒"}</td>
              </tr>
              <tr>
                <th>最高速度</th>
                <td>
                  {chartData.v[0]
                    .reduce((a, b) => Math.max(a, b), 0)
                    .toFixed(2) + " 米/秒"}
                </td>
              </tr>
            </tbody>
            {chartData.sk[0].size > 0 && (
              <tbody>
                {chartData.sk[0]
                  .entries()
                  .filter(([id]) => !!skillnames[id]?.[0])
                  .map(([id, ars]) =>
                    ars.flatMap((pos) => (
                      <tr>
                        <th>{skillnames[id][0]}</th>
                        <td>{`${pos[0].toFixed(2)} m – ${pos[1].toFixed(
                          2,
                        )} m`}</td>
                      </tr>
                    )),
                  )
                  .toArray()}
              </tbody>
            )}
          </table>
          <table>
            <caption style="color:var(--uma-pink)">Umamusume 2</caption>
            <tbody>
              <tr>
                <th>完成时间</th>
                <td>
                  {chartData.t[1][chartData.t[1].length - 1].toFixed(4) + " s"}
                </td>
              </tr>
              <tr>
                <th>起跑延迟</th>
                <td>{chartData.sdly[1].toFixed(4) + " s"}</td>
              </tr>
              <tr>
                <th>最高速度</th>
                <td>
                  {chartData.v[1]
                    .reduce((a, b) => Math.max(a, b), 0)
                    .toFixed(2) + " m/s"}
                </td>
              </tr>
            </tbody>
            {chartData.sk[1].size > 0 && (
              <tbody>
                {chartData.sk[1]
                  .entries()
                  .filter(([id]) => !!skillnames[id]?.[0])
                  .map(([id, ars]) =>
                    ars.flatMap((pos) => (
                      <tr>
                        <th>{skillnames[id][0]}</th>
                        <td>{`${pos[0].toFixed(2)} m – ${pos[1].toFixed(
                          2,
                        )} m`}</td>
                      </tr>
                    )),
                  )
                  .toArray()}
              </tbody>
            )}
          </table>
        </div>
      </div>
    );
  } else if (mode == Mode.Chart && tableData.size > 0) {
    resultsPane = (
      <div id="resultsPaneWrapper" style={trackWidthStyle} ref={resultsPaneRef}>
        <div id="resultsPane" class="mode-chart" style={trackWidthStyle}>
          <div class="chartLayout">
            <div class="chartPanel">
              <BasinnChart
                data={filteredChartData}
                hidden={uma1.skills}
                selectedId={selectedChartSkill}
                onSelectionChange={selectSkillDetails}
                onRunTypeChange={setChartData}
                onDblClickRow={addSkillFromTable}
                onInfoClick={showPopover}
                onMobileSkillClick={openSkillDetails}
                onSkillHover={(id, point) =>
                  id ? showHoveredSkill(id, point) : scheduleHoverDismiss()
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    resultsPane = null;
  }

  return (
    <Language.Provider value="cn">
      <IntlProvider definition={strings}>
        <AppNav activePage={activePage} setActivePage={setActivePage} />
        {activePage === "intel" ? (
          <IntelDashboard />
        ) : activePage === "succession" ? (
          <SuccessionPlanner />
        ) : (
          <Fragment>
            <div
              id="topPane"
              class={topPaneClass}
              data-mobile={isMobile ? "true" : "false"}
              style={trackWidthStyle}
            >
              {/* Left Column: Track and Track Settings */}

              {showTrack && (
                <div ref={raceTrackRef} className="raceTrackShell">
                  <div className="raceTrackCanvas">
                    <RaceOverview
                      courseid={courseId}
                      width={trackWidth}
                      data={chartData}
                      showHp={showHp}
                      skillEvents={skillLaneEvents}
                      selectedSampleRanges={selectedSampleRanges}
                      possibleActivationRanges={possibleActivationRanges}
                      selectedSkillName={selectedChartSkillName}
                      onShowSelectedSkillDetails={() =>
                        selectedChartSkill && openSkillDetails(selectedChartSkill)
                      }
                    />
                  </div>
                </div>
              )}
              {isMobile && !showTrack && (
                <div className="mobileTrackActions">
                  <button
                    type="button"
                    className="mobileTrackButton"
                    onClick={viewTrackImage}
                  >
                    横屏查看赛道
                  </button>
                </div>
              )}
              <div
                id="buttonsRow"
                data-mobile={isMobile ? "true" : "false"}
                className="
              flex flex-col gap-3
              py-3
              border-b
              text-sm
            "
              >
                <div
                  className={`${
                    isMobile
                      ? "flex flex-col gap-3 w-full"
                      : "flex flex-wrap items-center gap-3 w-full"
                  }`}
                >
                  <div
                    className={`courseControls
                  ${
                    isMobile
                      ? "flex flex-col items-stretch gap-3 w-full"
                      : "flex flex-wrap items-center gap-2"
                  }
                `}
                  >
                    <TrackSelect
                      key={courseId}
                      courseid={courseId}
                      setCourseid={setCustomCourseId}
                      tabindex={2}
                    />

                    <CompetitionSelect
                      value={selectedCompetitionKey}
                      onChange={selectCompetition}
                    />

                    <TimeOfDaySelect
                      value={racedef.time}
                      set={racesetter("time")}
                    />

                    <GroundSelect
                      value={racedef.ground}
                      set={racesetter("ground")}
                    />

                    <WeatherSelect
                      value={racedef.weather}
                      set={racesetter("weather")}
                    />

                    <SeasonSelect
                      value={racedef.season}
                      set={racesetter("season")}
                    />

                    <button
                      type="button"
                      onClick={openUmaOverlay}
                      aria-haspopup="dialog"
                      className={`
                    inline-flex items-center gap-1
                    ${
                      isMobile
                        ? "w-full justify-center text-base py-2.5"
                        : "px-3.5 py-1.5"
                    }
                    ${isMobile ? "text-base" : "text-sm"} font-semibold
                  `}
                    >
                      马娘
                    </button>
                  </div>

                  <div
                    className={`
                  ${
                    isMobile
                      ? "flex flex-col gap-3 w-full"
                      : "flex flex-wrap items-center gap-3"
                  }
                `}
                  >
                    {!isMobile && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">模式</span>

                        <label className="flex items-center gap-1 px-3 py-1">
                          <input
                            type="radio"
                            checked={mode === Mode.Compare}
                            onChange={() =>
                              updateUiState(UiStateMsg.SetModeCompare)
                            }
                            className=""
                          />
                          对比
                        </label>

                        <label className="flex items-center gap-1 px-3 py-1">
                          <input
                            type="radio"
                            checked={mode === Mode.Chart}
                            onChange={() =>
                              updateUiState(UiStateMsg.SetModeChart)
                            }
                            className=""
                          />
                          身距图
                        </label>
                      </div>
                    )}
                    {isMobile && (
                      <div className="text-gray-500 text-sm">
                        移动端只支持身距
                      </div>
                    )}

                    <div
                      className={`flex items-center gap-2 px-3 ${
                        isMobile ? "py-2.5" : "py-1"
                      }`}
                    >
                      <span className="text-gray-500">Seed</span>

                      <div
                        className="
                      flex items-center
                      border
                      overflow-hidden
                    "
                      >
                        <input
                          type="number"
                          value={seed}
                          onInput={(e) => setSeed(+e.currentTarget.value)}
                          className={`${
                            isMobile ? "w-full max-w-[220px]" : "w-28"
                          } px-3 py-2 text-base`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setSeed(
                              Math.floor(Math.random() * (-1 >>> 0)) >>> 0,
                            )
                          }
                          className="px-3 text-lg"
                        >
                          🎲
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`flex items-center gap-1 px-3 ${
                          isMobile ? "py-2 text-base" : "py-1"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={usePosKeep}
                          onChange={() => togglePosKeep()}
                          className=""
                        />
                        位置意识
                      </label>

                      <label
                        className={`flex items-center gap-1 px-3 ${
                          isMobile ? "py-2 text-base" : "py-1"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={showHp}
                          onChange={toggleShowHp}
                          className=""
                        />
                        耐力显示
                      </label>
                    </div>

                  </div>

                  <div
                    className={`actionButtons ${
                      isMobile
                        ? "flex flex-col gap-2 w-full"
                        : "flex items-center gap-2 ml-auto shrink-0"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={copyStateUrl}
                      className={`
                    ${
                      isMobile
                        ? "w-full justify-center text-base py-2.5"
                        : "px-3 py-1.5"
                    }
                    font-semibold
                  `}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={
                        mode === Mode.Compare ? doComparison : doBasinnChart
                      }
                      disabled={isSimulating}
                      className={`
                    ${
                      isMobile
                        ? "w-full justify-center text-base py-3"
                        : "px-6 py-2"
                    }
                    font-semibold
                  `}
                    >
                      {isSimulating
                        ? "RUNNING"
                        : mode === Mode.Compare
                          ? "COMPARE"
                          : "RUN"}
                    </button>
                  </div>
                </div>

                {mode === Mode.Chart && (
                  <div className="chartProgressAndHistogram">
                    <div className="chartProgressSlot">
                      {showStatusBar ? (
                        <ProgressBar progress={progress} label={status} />
                      ) : (
                        <div className="chartProgressPlaceholder">
                          运行后显示进度
                        </div>
                      )}
                    </div>
                    <div
                      className="chartHistogramSlot"
                      style={{
                        minHeight: `${chartHistogramHeight + 64}px`,
                      }}
                    >
                      {!isSimulating &&
                      selectedChartSkill &&
                      selectedChartResults.length > 0 ? (
                        <Histogram
                          width={chartHistogramWidth}
                          height={chartHistogramHeight}
                          data={selectedChartResults}
                          sampleRuns={selectedChartSampleRuns}
                          onSampleSelect={(sample) =>
                            setSelectedSampleRanges(sample?.ranges ?? [])
                          }
                        />
                      ) : (
                        <div className="chartHistogramPlaceholder">
                          {isSimulating
                            ? "正在计算身位分布…"
                            : "运行后在这里显示身位分布"}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {!isMobile && resultsPane}
            </div>
            {isMobile && resultsPane}
            {!isMobile && hoveredSkill && mode === Mode.Chart && (
              <aside
                className="chartSkillHover"
                onMouseEnter={cancelHoverDismiss}
                onMouseLeave={scheduleHoverDismiss}
                style={{
                  left: `${Math.max(
                    8,
                    Math.min(hoveredSkill.x + 14, viewportWidth - 380),
                  )}px`,
                  top: `${Math.max(
                    8,
                    Math.min(hoveredSkill.y + 12, viewportHeight - 360),
                  )}px`,
                }}
              >
                <ExpandedSkillDetails
                  id={hoveredSkill.id}
                  distanceFactor={course.distance}
                  dismissable={false}
                />
              </aside>
            )}
            {skillDetailOpen && skillDetailId && mode === Mode.Chart && (
              <div
                className="chartSkillModalOverlay"
                role="presentation"
                onClick={closeSkillDetails}
              >
                <section
                  className="chartSkillModalCard"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`技能详细：${
                    skillnames[skillDetailId.split("-")[0]]?.[0] || skillDetailId
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const target = event.target as Element;
                    if (target.closest(".skillDismiss")) {
                      closeSkillDetails();
                    }
                  }}
                >
                  <ExpandedSkillDetails
                    id={skillDetailId}
                    distanceFactor={course.distance}
                    dismissable={true}
                  />
                  {isMobile && (
                    <div className="chartSkillModalActions">
                      <button
                        type="button"
                        onClick={() => {
                          selectSkillDetails(skillDetailId);
                          closeSkillDetails();
                        }}
                      >
                        选择
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
            {isMobile && forceShowTrack && (
              <div className="trackFullscreen" ref={raceTrackRef}>
                <button
                  type="button"
                  className="trackFullscreenClose"
                  onClick={() => setForceShowTrack(false)}
                >
                  ×
                </button>
                <div className="racetrackRotated">
                  <RaceOverview
                    courseid={courseId}
                    width={trackHeight}
                    hideHeader={true}
                    data={chartData}
                    showHp={showHp}
                    skillEvents={skillLaneEvents}
                    selectedSampleRanges={selectedSampleRanges}
                    possibleActivationRanges={possibleActivationRanges}
                    selectedSkillName={selectedChartSkillName}
                    onShowSelectedSkillDetails={() =>
                      selectedChartSkill && openSkillDetails(selectedChartSkill)
                    }
                  />
                </div>
              </div>
            )}
            {expanded && (
              <div
                id="umaOverlay"
                role="dialog"
                class={mode === Mode.Compare ? "compareMode" : ""}
                aria-modal="true"
                aria-label="Umamusume 设置"
                tabindex="-1"
              >
                <div class={`umaPanel ${currentIdx == 0 ? "selected" : ""}`}>
                  <HorseDef
                    key={uma1.outfitId}
                    state={uma1}
                    setState={setUma1}
                    courseDistance={course.distance}
                    tabstart={() => 4}
                  >
                    {"Umamusume 1"}
                  </HorseDef>
                </div>
                {mode === Mode.Compare && (
                  <div
                    className="
      absolute left-1/2 top-[120px] -translate-x-1/2
      flex flex-col gap-2
      z-10
    "
                  >
                    <button
                      title="Copy uma 1 → uma 2"
                      onClick={copyUmaToRight}
                      className="
        w-9 h-9
        text-lg
        flex items-center justify-center
      "
                    >
                      →
                    </button>

                    <button
                      title="Swap umas"
                      onClick={swapUmas}
                      className="
        w-9 h-9
        font-semibold
        flex items-center justify-center
      "
                    >
                      ⮂
                    </button>

                    <button
                      title="Copy uma 2 → uma 1"
                      onClick={copyUmaToLeft}
                      className="
        w-9 h-9
        text-lg
        flex items-center justify-center
      "
                    >
                      ←
                    </button>
                  </div>
                )}

                {mode == Mode.Compare && (
                  <div class={`umaPanel ${currentIdx == 1 ? "selected" : ""}`}>
                    <HorseDef
                      key={uma2.outfitId}
                      state={uma2}
                      setState={setUma2}
                      courseDistance={course.distance}
                      tabstart={() => 4 + horseDefTabs()}
                    >
                      {"Umamusume 2"}
                    </HorseDef>
                  </div>
                )}
                <button
                  type="button"
                  id="closeUmaOverlay"
                  class="btnBase rounded"
                  title="关闭面板"
                  onClick={toggleExpand}
                >
                  ✕
                </button>
                <button
                  type="button"
                  id="closeUmaOverlayTop"
                  title="关闭面板"
                  onClick={toggleExpand}
                >
                  ✕
                </button>
              </div>
            )}
          </Fragment>
        )}
      </IntlProvider>
    </Language.Provider>
  );
}

initTelemetry();
render(<App />, document.getElementById("app"));
