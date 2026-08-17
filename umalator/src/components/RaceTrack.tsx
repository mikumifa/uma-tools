import { h, Fragment } from "preact";
import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "preact/hooks";
import { IntlProvider, Text } from "preact-i18n";
import {
  CourseData,
  CourseHelpers,
  Surface,
} from "@sim/CourseData";
import { TRACKNAMES_cn } from "@shared/trackNames";
import courses from "@data/course_data.json";
import tracknames from "@data/tracknames.json";

import "./RaceTrack.css";

// --- 导出枚举 ---
export const RegionDisplayType = {
  Immediate: 0,
  Regions: 1,
  Textbox: 2,
};

// --- 静态字符串与辅助数据 ---
const STRINGS = Object.freeze({
  racetrack: Object.freeze({
    none: "​",
    inner: "（内）",
    outer: "（外）",
    outin: "（外→内）",
    orientation: Object.freeze(["", "顺", "逆", "", "直"]),
    turf: "草",
    dirt: "泥",
    straight: "直线",
    corner: "弯道{{n}}",
    uphill: "上坡",
    downhill: "下坡",
    phase0: "序盘",
    phase1: "中盘",
    phase2: "终盘",
    phase3: "冲刺",
    short: Object.freeze({
      straight: "直",
      corner: "弯{{n}}",
      uphill: "上",
      downhill: "下",
    }),
  }),
  tracknames: TRACKNAMES_cn,
  coursedesc: Object.freeze({
    one: "{{distance}}m{{inout}}",
    many: "{{surface}}{{distance}}m{{inout}}",
  }),
});

const inoutKey = Object.freeze(["", "none", "inner", "outer", "outin"]);

const coursesByTrack = (function () {
  const o = Object.create(null);
  Object.keys(courses).forEach((cid) => {
    const tid = courses[cid].raceTrackId;
    if (tid in o) {
      o[tid].push(+cid);
    } else {
      o[tid] = [+cid];
    }
  });
  return Object.freeze(o);
})();

// --- 绘图常量配置 ---
const COLORS = {
  text: "rgb(121,64,22)",
  marker: "rgb(121,64,22)",
  bg: {
    sky: "rgb(255,255,255)",
    slopeBase: "rgb(140,170,10)",
    slopeFill: "rgb(211,243,68)", // 坡道区背景填充色
    sectionBgTop: "rgb(239,229,241)",
    sectionBgBot: "rgb(163,106,175)",
    sectionBgBot2: "rgb(139,139,139)", // 结构区下方阴影
    sectionBgTop2: "rgb(232,232,232)", // 结构区背景
    straightEven: ["rgb(209,235,255)", "rgb(23,154,255)"],
    straightOdd: ["rgb(185,224,255)", "rgb(9,146,254)"],
    cornerEven: ["rgb(255,216,185)", "rgb(254,117,9)"],
    cornerOdd: ["rgb(254,228,209)", "rgb(250,121,27)"],
    slopeUpEven: ["rgb(234,207,147)", "rgb(191,143,37)"],
    slopeUpOdd: ["rgb(229,196,120)", "rgb(175,132,33)"],
    slopeDownEven: ["rgb(82,195,184)", "rgb(42,123,115)"],
    slopeDownOdd: ["rgb(116,206,198)", "rgb(50,142,134)"],
  },
  phases: [
    { main: "rgb(0,154,111)", dark: "rgb(0,92,66)" }, // Phase 0
    { main: "rgb(242,233,103)", dark: "rgb(190,179,16)" }, // Phase 1
    { main: "rgb(209,134,175)", dark: "rgb(149,56,107)" }, // Phase 2
    { main: "rgb(199,109,159)", dark: "rgb(133,51,96)" }, // Phase 3
  ],
};

// --- 辅助绘图函数 ---
function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawLine(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawText(ctx, text, x, y, options = {}) {
  ctx.fillStyle = options.color || COLORS.text;
  ctx.font = options.font || "10px sans-serif";
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = options.baseline || "middle";
  ctx.fillText(text, x, y);
}

// 绘制距离标记 (DistanceMarker)
function drawDistanceMarker(ctx, dist, x, y, isUp, color = COLORS.marker) {
  const lineLen = 10;
  const text = `${dist}m`;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.font = "10px sans-serif";

  if (isUp) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - lineLen);
    ctx.stroke();
    ctx.textBaseline = "bottom";
    ctx.fillText(text, x, y - lineLen - 1);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + lineLen);
    ctx.stroke();
    ctx.textBaseline = "bottom";
    ctx.fillText(text, x, y - 1);
  }
}

// 简单的颜色判断辅助函数
function getRegionSide(colorStr) {
  if (!colorStr) return "top";

  // 解析 rgb(r, g, b)
  const rgbMatch = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/.exec(colorStr);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    // 简单判定：如果蓝色或绿色分量显著高于红色，归为“冷色调/回复/被动”，放底部
    // 否则（红色、黄色、白色等）归为“暖色调/速度/加速度”，放顶部
    if ((b > r && b > g) || (g > r && g > b)) return "bottom";
    return "top";
  }

  // 简单的关键词匹配 (fallback)
  const lower = colorStr.toLowerCase();
  if (
    lower.includes("blue") ||
    lower.includes("cyan") ||
    lower.includes("teal") ||
    lower.includes("green")
  ) {
    return "bottom";
  }

  return "top";
}

// --- 导出组件 TrackSelect ---
export function TrackSelect(props) {
  let [trackid, setTrackid] = useState(courses[props.courseid].raceTrackId);
  const changeCourse = useCallback(
    (e) => props.setCourseid(+e.target.value),
    [props.setCourseid]
  );

  function changeTrack(e) {
    const newTrackId = +e.target.value;
    setTrackid(newTrackId);
    props.setCourseid(coursesByTrack[newTrackId][0]);
  }

  return (
    <IntlProvider definition={STRINGS}>
      <div class="trackSelect">
        <select
          value={trackid}
          onChange={changeTrack}
          tabindex={props.tabindex}
        >
          {Object.keys(tracknames).map((tid) => (
            <option value={tid}>
              <Text id={`tracknames.${tid}`} />
            </option>
          ))}
        </select>
        <select
          value={props.courseid}
          onChange={changeCourse}
          tabindex={props.tabindex + 1}
        >
          {coursesByTrack[trackid].map((cid) => (
            <option value={cid}>
              <Text
                id="coursedesc"
                plural={courses[cid].surface}
                fields={{
                  distance: courses[cid].distance,
                  inout: (
                    <Text id={`racetrack.${inoutKey[courses[cid].course]}`} />
                  ),
                  surface: (
                    <Text
                      id={
                        courses[cid].surface == Surface.Turf
                          ? "racetrack.turf"
                          : "racetrack.dirt"
                      }
                    />
                  ),
                }}
              />
            </option>
          ))}
        </select>
      </div>
    </IntlProvider>
  );
}

// --- 导出组件 RaceTrack (Canvas + SVG Overlay版) ---
export function RaceTrack(props) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverPos, setHoverPos] = useState(null); // { x, m }

  const course = useMemo(
    () => CourseHelpers.getCourse(props.courseid),
    [props.courseid]
  );

  // 计算总高度和偏移
  const xOffset = props.xOffset || 0;
  const yOffset = props.yOffset || 0;
  const yExtra = props.yExtra || 0;
  const trackWidth = props.width;
  const trackHeight = props.height;
  const totalHeight = trackHeight + yOffset + yExtra;

  // --- Regions 计算逻辑 ---
  const regions = useMemo(
    function () {
      if (!props.regions) return [];

      // 1. 初始化两个独立的堆叠状态 (Top 和 Bottom)
      const topState = {
        seen: new Set(),
        rungs: Array(10)
          .fill(0)
          .map((_) => []),
        elem: [],
      };
      const bottomState = {
        seen: new Set(),
        rungs: Array(10)
          .fill(0)
          .map((_) => []),
        elem: [],
      };

      props.regions.forEach((desc) => {
        // 根据颜色决定上下
        const side = getRegionSide(desc.color.fill);
        const state = side === "bottom" ? bottomState : topState;

        if (
          desc.type === RegionDisplayType.Immediate &&
          desc.regions.length > 0
        ) {
          // 垂直线 (保持原样)
          let x = (desc.regions[0].start / course.distance) * 100;
          while (state.seen.has(x)) {
            x += ((3 + +(x == 0)) / props.width) * 100;
          }
          state.seen.add(x);
          state.elem.push(
            <line
              x1={`${x}%`}
              y1="0"
              x2={`${x}%`}
              y2="100%"
              stroke={desc.color.stroke}
              stroke-width={x == 0 ? 4 : 2}
            />
          );
        } else if (desc.type === RegionDisplayType.Textbox) {
          const rects = desc.regions.map((r) => {
            const x = (r.start / course.distance) * 100;
            const w = ((r.end - r.start) / course.distance) * 100;

            // 贪心算法：寻找能放下的最低层级 (i)
            let i = 0;
            // Allow unlimited layers; create new rung arrays on demand.
            // 16 stacked regions used to overflow the fixed 10 rungs and crash.
            while (true) {
              if (i >= state.rungs.length) state.rungs.push([]);
              if (
                state.rungs[i].some(
                  (b) =>
                    (r.start >= b.start && r.start < b.end) ||
                    (r.end > b.start && r.end <= b.end) ||
                    (b.start >= r.start && b.start < r.end) ||
                    (b.end > r.start && b.end <= r.end)
                )
              ) {
                ++i;
              } else {
                break;
              }
            }
            state.rungs[i].push(r);

            // 计算 Y 坐标 (像素单位，紧凑布局)
            const boxHeight = 24;
            const gap = 1; // 1px 间距
            const step = boxHeight + gap;
            const topMargin = 5; // 顶部留 5px 空隙
            const bottomMargin = 5; // 底部留 5px 空隙

            let y;
            if (side === "bottom") {
              // 底部堆叠：从下往上
              // 第 0 层 (i=0): trackHeight - bottomMargin - boxHeight
              y = trackHeight - bottomMargin - boxHeight - i * step;
            } else {
              // 顶部堆叠：从上往下
              // 第 0 层 (i=0): topMargin
              y = topMargin + i * step;
            }

            return (
              // 注意这里 y 是像素值，没有加 '%'
              <svg
                class="textbox"
                x={x + "%"}
                y={y}
                width={w + "%"}
                height={`${boxHeight}px`}
                style={{ overflow: "visible" }}
              >
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill={desc.color.fill}
                  stroke={desc.color.stroke}
                />
                <text
                  x="0"
                  y="50%"
                  font-size="12px"
                  dominant-baseline="central"
                  fill={COLORS.text}
                >
                  {desc.text}
                </text>
              </svg>
            );
          });
          state.elem.push(<Fragment>{rects}</Fragment>);
        } else {
          // 普通区域块
          state.elem.push(
            <Fragment>
              {desc.regions.map((r) => (
                <rect
                  x={`${(r.start / course.distance) * 100}%`}
                  y={`${100 - desc.height}%`}
                  width={`${((r.end - r.start) / course.distance) * 100}%`}
                  height={`${desc.height}%`}
                  fill={desc.color.fill}
                  stroke={desc.color.stroke}
                />
              ))}
            </Fragment>
          );
        }
      });

      // 合并两个区域的元素
      return [...topState.elem, ...bottomState.elem];
    },
    [props.regions, course.distance, props.width, trackHeight]
  );

  // 绘图核心逻辑 (Canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !course) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = trackWidth * dpr;
    canvas.height = trackHeight * dpr;
    canvas.style.width = `${trackWidth}px`;
    canvas.style.height = `${trackHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, trackWidth, trackHeight);

    const totalDist = course.distance;
    const m2px = (m) => (m / totalDist) * trackWidth;

    const H = trackHeight;
    // 布局高度分配
    const Y = {
      slope: 0,
      slopeH: H * 0.32,
      divider1: H * 0.32,
      divider1H: H * 0.02,
      section: H * 0.34,
      sectionH: H * 0.22,
      divider2: H * 0.56,
      detail: H * 0.56,
      detailH: H * 0.22,
      phase: H * 0.78,
      phaseH: H * 0.22,
    };

    // --- 1. 坡道计算与绘制 (Slopes) ---
    const [_, highest, lowest] = course.slopes.reduce(
      (acc, s) => {
        const [last, h, l] = acc;
        const us = last + (s.slope / 10000) * s.length;
        return [us, Math.max(h, us), Math.min(l, us)];
      },
      [0, 1, 0]
    );

    const range = highest - (lowest + highest > -30 ? 0 : lowest);
    let fullSlopes = [];
    let lastEnd = 0;
    course.slopes.forEach((s) => {
      if (s.start !== lastEnd) {
        fullSlopes.push({
          start: lastEnd,
          length: s.start - lastEnd,
          slope: 0,
        });
      }
      fullSlopes.push(s);
      lastEnd = s.start + s.length;
    });
    if (lastEnd < totalDist) {
      fullSlopes.push({
        start: lastEnd,
        length: totalDist - lastEnd,
        slope: 0,
      });
    }
    fullSlopes.sort((a, b) => a.start - b.start);

    let currentH = 50;

    fullSlopes.forEach((s) => {
      const startX = m2px(s.start);
      const w = m2px(s.length);
      const thisEndHeight =
        currentH - (((s.slope / 10000) * s.length) / range) * 40;

      const mapY = (h) => (h / 100) * Y.slopeH;

      if (s.slope === 0) {
        drawRect(
          ctx,
          startX,
          mapY(currentH),
          w,
          Y.slopeH - mapY(currentH),
          COLORS.bg.slopeFill
        );
      } else {
        ctx.beginPath();
        ctx.fillStyle = COLORS.bg.slopeFill;
        const y1 = mapY(currentH);
        const y2 = mapY(thisEndHeight);
        const yBottom = Y.slopeH;

        ctx.moveTo(startX, y1);
        ctx.lineTo(startX + w, y2);
        ctx.lineTo(startX + w, yBottom);
        ctx.lineTo(startX, yBottom);
        ctx.closePath();
        ctx.fill();
      }
      currentH = thisEndHeight;
    });

    drawRect(ctx, 0, Y.divider1, trackWidth, Y.divider1H, COLORS.bg.slopeBase);

    // --- 2. 坡道详情块 ---
    drawRect(
      ctx,
      0,
      Y.section,
      trackWidth,
      Y.sectionH * 0.9,
      COLORS.bg.sectionBgTop
    );
    drawRect(
      ctx,
      0,
      Y.section + Y.sectionH * 0.9,
      trackWidth,
      Y.sectionH * 0.1,
      COLORS.bg.sectionBgBot
    );

    let upi = 0,
      downi = 0;

    course.slopes.forEach((s) => {
      if (s.slope === 0) return;
      const x = m2px(s.start);
      const w = m2px(s.length);

      let cols;
      let label;
      if (s.slope > 0) {
        cols = upi % 2 === 0 ? COLORS.bg.slopeUpEven : COLORS.bg.slopeUpOdd;
        label = STRINGS.racetrack.uphill;
        upi++;
      } else {
        cols =
          downi % 2 === 0 ? COLORS.bg.slopeDownEven : COLORS.bg.slopeDownOdd;
        label = STRINGS.racetrack.downhill;
        downi++;
      }

      drawRect(ctx, x, Y.section, w, Y.sectionH * 0.9, cols[0]);
      drawRect(
        ctx,
        x,
        Y.section + Y.sectionH * 0.9,
        w,
        Y.sectionH * 0.1,
        cols[1]
      );

      const useShort = w / trackWidth < 0.085;
      const finalLabel = useShort ? label[0] : label;
      if (w > 12) {
        drawText(ctx, finalLabel, x + w / 2, Y.section + Y.sectionH / 2);
      }
    });

    course.slopes.forEach((s, i) => {
      let markedStart = false;
      const prevEnd =
        i > 0 ? course.slopes[i - 1].start + course.slopes[i - 1].length : 0;
      const isContinuation = i > 0 && s.start === prevEnd;

      if (s.start !== 0 && (!isContinuation || i === 0)) {
        markedStart = true;
        const isCloseToPrev = i > 0 && s.start - prevEnd < totalDist * 0.05;
        drawDistanceMarker(
          ctx,
          s.start,
          m2px(s.start),
          Y.section + Y.sectionH * 0.8,
          isCloseToPrev
        );
      }
      if (s.start + s.length !== totalDist) {
        const end = s.start + s.length;
        const isCloseToStart = markedStart && s.length < totalDist * 0.05;
        drawDistanceMarker(
          ctx,
          end,
          m2px(end),
          Y.section + Y.sectionH * 0.8,
          isCloseToStart
        );
      }
    });

    // --- 3. 赛道结构 ---
    drawRect(
      ctx,
      0,
      Y.detail,
      trackWidth,
      Y.detailH * 0.9,
      COLORS.bg.sectionBgTop2
    );
    drawRect(
      ctx,
      0,
      Y.detail + Y.detailH * 0.9,
      trackWidth,
      Y.detailH * 0.1,
      COLORS.bg.sectionBgBot2
    );

    // 直线
    course.straights.forEach((s, i) => {
      const x = m2px(s.start);
      const w = m2px(s.end - s.start);
      const cols = i % 2 === 0 ? COLORS.bg.straightEven : COLORS.bg.straightOdd;
      drawRect(ctx, x, Y.detail, w, Y.detailH * 0.9, cols[0]);
      drawRect(ctx, x, Y.detail + Y.detailH * 0.9, w, Y.detailH * 0.1, cols[1]);

      const useShort = w / trackWidth < 0.085;
      const label = useShort
        ? STRINGS.racetrack.short.straight
        : STRINGS.racetrack.straight;
      if (w > 12) drawText(ctx, label, x + w / 2, Y.detail + Y.detailH / 2);
    });

    // 弯道
    course.corners.forEach((c, i) => {
      const x = m2px(c.start);
      const w = m2px(c.length);
      const cols = i % 2 === 0 ? COLORS.bg.cornerEven : COLORS.bg.cornerOdd;
      drawRect(ctx, x, Y.detail, w, Y.detailH * 0.9, cols[0]);
      drawRect(ctx, x, Y.detail + Y.detailH * 0.9, w, Y.detailH * 0.1, cols[1]);

      const n = 4 - ((course.corners.length - i - 1) % 4);
      const useShort = w / trackWidth < 0.085;
      let label = STRINGS.racetrack.corner.replace("{{n}}", n);
      if (useShort) label = STRINGS.racetrack.short.corner.replace("{{n}}", n);
      if (w > 12) drawText(ctx, label, x + w / 2, Y.detail + Y.detailH / 2);
    });

    const sections = course.straights
      .concat(
        course.corners.map((c) => ({ start: c.start, end: c.start + c.length }))
      )
      .sort((a, b) => a.start - b.start);

    sections.forEach((s, i) => {
      let markedStart = false;
      const prevEnd = i > 0 ? sections[i - 1].end : 0;
      if (s.start !== 0 && (i === 0 || s.start !== prevEnd)) {
        markedStart = true;
        const isCloseToPrev = i > 0 && s.start - prevEnd < totalDist * 0.05;
        drawDistanceMarker(
          ctx,
          s.start,
          m2px(s.start),
          Y.detail + Y.detailH * 0.8,
          isCloseToPrev
        );
      }
      if (s.end !== totalDist) {
        const isCloseToStart =
          markedStart && s.end - s.start < totalDist * 0.05;
        drawDistanceMarker(
          ctx,
          s.end,
          m2px(s.end),
          Y.detail + Y.detailH * 0.8,
          isCloseToStart
        );
      }
    });

    // --- 4. 阶段 ---
    const phases = [
      { id: 0, w: 1 / 6, name: STRINGS.racetrack.phase0 },
      { id: 1, w: 0.5, name: STRINGS.racetrack.phase1 },
      { id: 2, w: 1 / 6, name: STRINGS.racetrack.phase2 },
      { id: 3, w: 1 / 6, name: STRINGS.racetrack.phase3 },
    ];
    let currX = 0;
    phases.forEach((p, i) => {
      const w = trackWidth * p.w;
      const c = COLORS.phases[i];
      drawRect(ctx, currX, Y.phase, w, Y.phaseH * 0.9, c.main);
      drawRect(ctx, currX, Y.phase + Y.phaseH * 0.9, w, Y.phaseH * 0.1, c.dark);
      drawText(ctx, p.name, currX + w / 2, Y.phase + Y.phaseH / 2, {
        color: COLORS.text,
      });
      currX += w;
    });

    const phase1Start = Math.round(CourseHelpers.phaseStart(totalDist, 1));
    const phase2Start = Math.round(CourseHelpers.phaseStart(totalDist, 2));
    const phase3Start = Math.round(CourseHelpers.phaseStart(totalDist, 3));

    drawDistanceMarker(
      ctx,
      phase1Start,
      trackWidth * (1 / 6),
      Y.phase + Y.phaseH * 0.8,
      false
    );
    drawDistanceMarker(
      ctx,
      phase2Start,
      trackWidth * (4 / 6),
      Y.phase + Y.phaseH * 0.8,
      false
    );
    drawDistanceMarker(
      ctx,
      phase3Start,
      trackWidth * (5 / 6),
      Y.phase + Y.phaseH * 0.8,
      false
    );

    // --- 6. 交互悬浮 (Canvas 内部绘制红线和文字) ---
    if (hoverPos) {
      const hx = hoverPos.x;
      drawLine(ctx, hx, 0, hx, trackHeight, COLORS.marker, 2);

      const text = `${Math.round(hoverPos.m)}m`;
      const textW = ctx.measureText(text).width + 10;
      const textX = Math.min(Math.max(hx, textW / 2), trackWidth - textW / 2);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(textX - textW / 2, 10, textW, 20);
      ctx.strokeRect(textX - textW / 2, 10, textW, 20);
      drawText(ctx, text, textX, 20, { color: COLORS.text });
    }
  }, [course, trackWidth, trackHeight, hoverPos]);

  // --- 事件处理 ---
  const handleMouseMove = (e) => {
    const svgX = e.nativeEvent.offsetX;
    const trackX = svgX - xOffset;

    if (trackX < 0 || trackX > trackWidth) return;

    const m = (trackX / trackWidth) * course.distance;
    setHoverPos({ x: trackX, m });
    if (props.onHover) props.onHover(m);
    if (props.mouseMove) props.mouseMove(trackX / trackWidth);
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    if (props.onLeave) props.onLeave();
    if (props.mouseLeave) props.mouseLeave();
  };

  return (
    <IntlProvider definition={STRINGS}>
      <div
        class="racetrackWrapper"
        ref={containerRef}
        style={{ position: "relative", ...(props.containerStyle || {}) }}
      >
        {!props.hideTitle && (
          <div class="racetrackName">
            <Text id={`tracknames.${course.raceTrackId}`} />{" "}
            <Text
              id="coursedesc"
              plural={course.surface}
              fields={{
                distance: course.distance,
                inout: (
                  <Text
                    id={`racetrack.${inoutKey[courses[props.courseid].course]}`}
                  />
                ),
                surface: (
                  <Text
                    id={
                      course.surface == Surface.Turf
                        ? "racetrack.turf"
                        : "racetrack.dirt"
                    }
                  />
                ),
              }}
            />{" "}
            <Text id={`racetrack.orientation.${course.turn}`} />
          </div>
        )}

        <div
          style={{
            position: "relative",
            width: trackWidth + xOffset,
            height: totalHeight,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: `${yOffset}px`,
              left: `${xOffset}px`,
              pointerEvents: "none",
            }}
          />

          <svg
            width={trackWidth + xOffset}
            height={totalHeight}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              cursor: "crosshair",
            }}
          >
            <svg
              x={xOffset}
              y={yOffset}
              width={trackWidth}
              height={trackHeight}
              style={{ overflow: "visible" }}
            >
              {regions}
            </svg>

            {props.children}
          </svg>
        </div>
      </div>
    </IntlProvider>
  );
}
