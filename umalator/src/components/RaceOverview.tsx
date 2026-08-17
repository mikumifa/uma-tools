import { h } from "preact";
import { useMemo, useState } from "preact/hooks";

import { CourseHelpers } from "@sim/CourseData";

import "./RaceOverview.css";

const CHART_WIDTH = 1120;
const CHART_HEIGHT = 350;
const CHART_PADDING = { top: 24, right: 72, bottom: 42, left: 64 };
const MIN_SKILL_BAR_PX = 44;
const MIN_SKILL_GAP_PX = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildSpeedAxisTicks(min: number, max: number) {
  if (max <= min) return [min];

  const splitValue = max / 2;
  const ticks = new Set<number>();
  const upperStep = Math.max(1, Math.round((max - splitValue) / 6));
  for (let tick = splitValue; tick <= max; tick += upperStep) {
    ticks.add(Number(tick.toFixed(1)));
  }
  ticks.add(Number(max.toFixed(1)));
  return [...ticks]
    .filter((tick) => tick >= min && tick <= max)
    .sort((a, b) => a - b);
}

function findClosestIndex(values: number[], target: number) {
  if (values.length <= 1) return 0;
  let low = 0;
  let high = values.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  if (low === 0) return 0;
  return Math.abs(values[low] - target) < Math.abs(values[low - 1] - target)
    ? low
    : low - 1;
}

function makePath(positions: number[], values: number[], getX, getY) {
  return positions
    .map((position, index) => {
      const value = values[index];
      if (!Number.isFinite(position) || !Number.isFinite(value)) return "";
      return `${index === 0 ? "M" : "L"} ${getX(position)} ${getY(value)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function packSkillTracks(events, courseDistance: number) {
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const minimumWidth = (MIN_SKILL_BAR_PX / innerWidth) * courseDistance;
  const minimumGap = (MIN_SKILL_GAP_PX / innerWidth) * courseDistance;
  const tracks = [];

  [...events]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .forEach((event) => {
      const displayEnd = Math.min(
        courseDistance,
        Math.max(event.end, event.start + minimumWidth),
      );
      const displayEvent = { ...event, displayEnd };
      const track = tracks.find((candidate) => {
        const last = candidate[candidate.length - 1];
        return event.start >= last.displayEnd + minimumGap;
      });
      if (track) track.push(displayEvent);
      else tracks.push([displayEvent]);
    });

  return tracks;
}

function CourseBand({ title, segments, distance }) {
  return (
    <div className="courseBandRow">
      <div className="courseBandTitle">{title}</div>
      <div className="courseBandTrack">
        {segments.map((segment) => {
          const left = (segment.start / distance) * 100;
          const width = ((segment.end - segment.start) / distance) * 100;
          return (
            <div
              key={segment.key}
              className="courseBandSegment"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: segment.fill,
                borderColor: segment.stroke,
                color: segment.text,
              }}
              title={`${segment.label} · ${Math.round(segment.start)}-${Math.round(segment.end)}m`}
            >
              {width >= 5 ? segment.label : ""}
            </div>
          );
        })}
      </div>
      <div className="courseBandRightPad" />
    </div>
  );
}

function SkillLane({ label, events, distance, dense = false }) {
  return (
    <div className="skillLaneRow">
      <div className="skillLaneLabel" title={label}>{label}</div>
      <div className="skillLaneTrack">
        {events.map((event) => {
          const end = dense ? event.end : (event.displayEnd ?? event.end);
          const left = (event.start / distance) * 100;
          const width = Math.max(((end - event.start) / distance) * 100, 0.18);
          return (
            <div
              key={event.key}
              className={`skillLaneBar ${dense ? "dense" : ""}`}
              style={{
                left: `${left}%`,
                width: `${Math.min(width, 100 - left)}%`,
                background: event.color.fill,
                borderLeftColor: event.color.stroke,
                color: event.color.text || "#fff",
              }}
              title={`${event.text} · ${event.start.toFixed(1)}-${event.end.toFixed(1)}m`}
            >
              {!dense && <span>{event.text}</span>}
            </div>
          );
        })}
      </div>
      <div className="courseBandRightPad" />
    </div>
  );
}

export function RaceOverview(props) {
  const course = useMemo(
    () => CourseHelpers.getCourse(props.courseid),
    [props.courseid],
  );
  const distance = course.distance;
  const data = props.data;
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);

  const speedRange = useMemo(() => {
    if (!data?.v?.length) return { min: 0, max: 30 };
    const minLength = Math.min(...data.v.map((values) => values.length));
    let firstDiverged = -1;
    for (let index = 0; index < minLength; index += 1) {
      const values = data.v.map((line) => line[index]).filter(Number.isFinite);
      if (values.length > 1 && Math.max(...values) - Math.min(...values) > 0.0001) {
        firstDiverged = index;
        break;
      }
    }
    const values = data.v.flatMap((line) =>
      firstDiverged > 0 ? line.slice(firstDiverged) : line,
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.03, 0.6);
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [data]);

  const hpRange = useMemo(() => {
    const values = data?.hp?.flatMap((line) => line) ?? [];
    if (values.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.03, 24);
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [data]);

  const getX = (position: number) =>
    CHART_PADDING.left +
    (position / distance) *
      (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right);
  const getY = (value: number) => {
    const usableHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    let ratio =
      (value - speedRange.min) /
      Math.max(speedRange.max - speedRange.min, 0.0001);
    const splitValue = speedRange.max / 2;
    const lowerSpan = Math.max(splitValue - speedRange.min, 0.0001);
    const upperSpan = Math.max(speedRange.max - splitValue, 0.0001);
    const lowerHeightRatio = 0.18;
    if (value <= splitValue) {
      ratio = ((value - speedRange.min) / lowerSpan) * lowerHeightRatio;
    } else {
      ratio =
        lowerHeightRatio +
        ((value - splitValue) / upperSpan) * (1 - lowerHeightRatio);
    }
    return (
      CHART_HEIGHT -
      CHART_PADDING.bottom -
      clamp(ratio, 0, 1) * usableHeight
    );
  };
  const getHpY = (value: number) => {
    const ratio =
      (value - hpRange.min) / Math.max(hpRange.max - hpRange.min, 0.0001);
    return (
      CHART_HEIGHT -
      CHART_PADDING.bottom -
      clamp(ratio, 0, 1) *
        (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom)
    );
  };

  const yTicks = buildSpeedAxisTicks(speedRange.min, speedRange.max);
  const stageSegments = [
    { key: "opening", start: 0, end: distance / 6, label: "序盘", fill: "rgba(125,211,252,.18)", stroke: "rgba(14,165,233,.32)", text: "#0f172a" },
    { key: "middle", start: distance / 6, end: (distance * 2) / 3, label: "中盘", fill: "rgba(196,181,253,.18)", stroke: "rgba(139,92,246,.32)", text: "#1e1b4b" },
    { key: "late1", start: (distance * 2) / 3, end: (distance * 5) / 6, label: "终盘前半", fill: "rgba(253,230,138,.2)", stroke: "rgba(245,158,11,.32)", text: "#78350f" },
    { key: "late2", start: (distance * 5) / 6, end: distance, label: "终盘后半", fill: "rgba(252,165,165,.2)", stroke: "rgba(239,68,68,.32)", text: "#7f1d1d" },
  ];
  const trackSegments = [
    ...course.straights.map((segment, index) => ({ key: `straight-${index}`, start: segment.start, end: segment.end, label: `直线 ${index + 1}`, fill: "rgba(186,230,253,.2)", stroke: "rgba(2,132,199,.3)", text: "#0c4a6e" })),
    ...course.corners.map((segment, index) => ({ key: `corner-${index}`, start: segment.start, end: segment.start + segment.length, label: `弯道 ${index + 1}`, fill: "rgba(254,215,170,.22)", stroke: "rgba(234,88,12,.3)", text: "#7c2d12" })),
  ];
  const slopeSegments = course.slopes
    .filter((slope) => slope.length > 0 && slope.slope !== 0)
    .map((slope, index) => ({
      key: `slope-${index}`,
      start: slope.start,
      end: slope.start + slope.length,
      label: slope.slope > 0 ? `上坡 ${index + 1}` : `下坡 ${index + 1}`,
      fill: slope.slope > 0 ? "rgba(251,191,36,.2)" : "rgba(74,222,128,.2)",
      stroke: slope.slope > 0 ? "rgba(217,119,6,.34)" : "rgba(22,163,74,.34)",
      text: slope.slope > 0 ? "#78350f" : "#14532d",
    }));

  const skillTracks = useMemo(
    () => packSkillTracks(props.skillEvents ?? [], distance),
    [props.skillEvents, distance],
  );
  const selectedEvents = (props.selectedSampleRanges ?? []).map((range, index) => ({
    ...range,
    key: `selected-${index}-${range.start}-${range.end}`,
    text: "选中身位发动",
    color: { stroke: "#db2777", fill: "rgba(219,39,119,.78)" },
  }));
  const selectedTracks = useMemo(
    () => packSkillTracks(selectedEvents, distance),
    [props.selectedSampleRanges, distance],
  );
  const possibleEvents = (props.possibleActivationRanges ?? []).map((range, index) => ({
    ...range,
    key: `possible-${index}-${range.start}-${range.end}`,
    text: `区间 ${index + 1}`,
    color: {
      stroke: "#1d4ed8",
      fill: "rgba(37,99,235,.16)",
      text: "#1d4ed8",
    },
  }));

  const hoverRows = hoverDistance == null || !data
    ? []
    : data.p.map((positions, index) => {
        const point = findClosestIndex(positions, hoverDistance);
        return {
          index,
          speed: data.v[index]?.[point] ?? 0,
          time: data.t[index]?.[point] ?? 0,
          hp: data.hp[index]?.[point] ?? 0,
        };
      });

  const handleMouseMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    const ratio =
      (chartX - CHART_PADDING.left) /
      (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right);
    setHoverDistance(clamp(ratio, 0, 1) * distance);
  };

  const colors = ["#2563eb", "#db2777"];
  return (
    <div className="raceOverview" style={{ width: props.width }}>
      {!props.hideHeader && (
        <div className="raceOverviewHeader">
          <div>
            <span>当前技能</span>
            <strong title={props.selectedSkillName || ""}>
              {props.selectedSkillName || "运行后从技能表格中选择"}
            </strong>
          </div>
          {props.onRunTypeChange && (
            <>
              <div className="raceOverviewRunButtons">
                <span>身位情况</span>
                <div>
                  {[
                    ["minrun", "最小"],
                    ["maxrun", "最大"],
                    ["meanrun", "平均"],
                    ["medianrun", "中位"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      className={props.runType === value ? "active" : ""}
                      disabled={!props.selectedSkillName}
                      onClick={() => props.onRunTypeChange(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="raceOverviewRunSelect">
                <span>身位情况</span>
                <select
                  value={props.runType || "meanrun"}
                  disabled={!props.selectedSkillName}
                  onChange={(event) =>
                    props.onRunTypeChange(event.currentTarget.value)
                  }
                >
                  <option value="minrun">最小</option>
                  <option value="maxrun">最大</option>
                  <option value="meanrun">平均</option>
                  <option value="medianrun">中位</option>
                </select>
              </label>
            </>
          )}
          <button
            type="button"
            disabled={!props.selectedSkillName}
            onClick={props.onShowSelectedSkillDetails}
          >
            查看技能详细
          </button>
        </div>
      )}
      <div className="raceTrajectoryChart">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverDistance(null)}
        >
          <rect
            x={CHART_PADDING.left}
            y={CHART_PADDING.top}
            width={CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right}
            height={CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom}
            rx="12"
            fill="rgba(248,250,252,.72)"
          />
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line x1={CHART_PADDING.left} y1={y} x2={CHART_WIDTH - CHART_PADDING.right} y2={y} stroke="rgba(148,163,184,.2)" />
                <text x={CHART_WIDTH - CHART_PADDING.right + 8} y={y + 4} className="raceAxisText">{tick.toFixed(1)}m/s</text>
              </g>
            );
          })}
          {[0, .2, .4, .6, .8, 1].map((ratio) => {
            const x = getX(distance * ratio);
            return (
              <g key={ratio}>
                <line x1={x} y1={CHART_PADDING.top} x2={x} y2={CHART_HEIGHT - CHART_PADDING.bottom} stroke="rgba(148,163,184,.15)" />
                <text x={x} y={CHART_HEIGHT - 14} text-anchor="middle" className="raceAxisText">{Math.round(distance * ratio)}m</text>
              </g>
            );
          })}
          {data?.v?.map((values, index) => (
            <path
              key={`speed-${index}`}
              d={makePath(data.p[index], values, getX, getY)}
              fill="none"
              stroke={colors[index]}
              stroke-width="3"
            />
          ))}
          {props.showHp && data?.hp?.map((values, index) => (
            <path
              key={`hp-${index}`}
              d={makePath(data.p[index], values, getX, getHpY)}
              fill="none"
              stroke={colors[index]}
              stroke-width="1.5"
              stroke-dasharray="6 4"
              stroke-opacity=".55"
            />
          ))}
          {hoverDistance != null && (
            <line
              x1={getX(hoverDistance)}
              y1={CHART_PADDING.top}
              x2={getX(hoverDistance)}
              y2={CHART_HEIGHT - CHART_PADDING.bottom}
              stroke="#64748b"
              stroke-width="1.5"
              stroke-dasharray="4 4"
            />
          )}
        </svg>
        <div className="raceChartLegend">
          <div className="raceChartLegendSeries">
            <span><i style={{ background: colors[0] }} />马娘 1</span>
            <span><i style={{ background: colors[1] }} />马娘 2</span>
            {props.showHp && <span className="hpLegend">虚线：HP</span>}
          </div>
        </div>
        {hoverDistance != null && hoverRows.length > 0 && (
          <div
            className="raceHoverCard"
            style={{ left: `${clamp((getX(hoverDistance) / CHART_WIDTH) * 100, 10, 76)}%` }}
          >
            <strong>{hoverDistance.toFixed(1)}m</strong>
            {hoverRows.map((row) => (
              <span key={row.index} style={{ color: colors[row.index] }}>
                马娘 {row.index + 1}：{row.speed.toFixed(2)}m/s · {row.time.toFixed(2)}s · {row.hp.toFixed(0)}HP
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="courseBands">
        <CourseBand title="阶段" segments={stageSegments} distance={distance} />
        <CourseBand title="弯直" segments={trackSegments} distance={distance} />
        <CourseBand title="坡道" segments={slopeSegments} distance={distance} />
      </div>

      <div className="skillSwimlanes">
        {skillTracks.length === 0 && selectedTracks.length === 0 && possibleEvents.length === 0 ? (
          <div className="skillLaneEmpty">运行模拟后在这里显示技能发动区间</div>
        ) : (
          <div className="skillLaneScroll">
            {skillTracks.map((track, index) => (
              <SkillLane key={`skill-track-${index}`} label={`${index + 1}`} events={track} distance={distance} />
            ))}
            {selectedTracks.map((track, index) => (
              <SkillLane key={`selected-track-${index}`} label="选中" events={track} distance={distance} />
            ))}
            {possibleEvents.length > 0 && (
              <SkillLane label="可能发动位置" events={possibleEvents} distance={distance} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
