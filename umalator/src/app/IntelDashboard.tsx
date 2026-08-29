import { h } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import intelData from "@data/results_intel.json";

type GachaCard = {
  id: number;
  type: "character" | "support";
  name: string;
  title: string;
  characterName: string;
  rarity: number;
  image?: string | null;
};

type GachaPool = {
  id: number;
  name?: string;
  type: string;
  start: string;
  end: string;
  startTimestamp: number;
  endTimestamp: number;
  onlyOnce?: boolean;
  selectableCount?: number;
  selectionLimit?: number | null;
  stageCount?: number;
  rangeStart?: string;
  rangeEnd?: string;
  cutoffCardId?: number;
  freeDraws?: Array<{
    drawType: number;
    label: string;
    start: string;
    end: string;
    startTimestamp: number;
    endTimestamp: number;
  }>;
  bannerImage?: string | null;
  cards: GachaCard[];
};

type IntelData = {
  gachaPools: GachaPool[];
  events: ScheduleItem[];
  races?: ScheduleItem[];
  exchanges?: ScheduleItem[];
  generatedAt: string;
};

type IntelTab = "gacha" | "events" | "races" | "exchanges";
type ViewMode = "calendar" | "list";
type GachaKindFilter = "all" | "character" | "support";

type ScheduleItem = {
  id: number;
  name: string;
  type: string;
  start: string;
  end: string;
  startTimestamp: number;
  endTimestamp: number;
  image?: string | null;
  drops?: Array<{
    image?: string | null;
    name?: string;
    source?: string;
    label?: string;
    rewardType?: number;
    rewardValue?: number;
    amount?: number;
    countOnly?: boolean;
    isPiece?: boolean;
  }>;
  exchangeDetails?: Array<{
    id: number;
    order: number;
    reward: ScheduleReward;
    pay: ScheduleReward;
    limit: number;
    totalRewardAmount: number;
    additionalPieceAmount?: number;
  }>;
  exchangeDetailPath?: string;
  exchangeDetailCount?: number;
  isVoucherExchange?: boolean;
  details?: Array<{
    label?: string;
    raceName?: string;
    track?: string;
    distance?: number;
    ground?: string;
    inout?: string;
    turn?: string;
    season?: string;
    weather?: string;
    condition?: string;
    seasonValue?: number;
    weatherValue?: number;
    conditionValue?: number;
    conditionRates?: {
      weather?: Array<{ label: string; rate: number }>;
      condition?: Array<{ label: string; rate: number }>;
      combos?: Array<{ weather: string; condition: string; rate: number }>;
    } | null;
    entryNum?: number;
  }>;
  milestones?: Array<{
    label: string;
    start: string;
    end: string;
    startTimestamp: number;
    endTimestamp: number;
  }>;
};

type ScheduleReward = {
  image?: string | null;
  name?: string;
  rewardType?: number;
  rewardValue?: number;
  amount?: number;
  label?: string;
  countOnly?: boolean;
};

const data = intelData as IntelData;

function appBasePath() {
  if (typeof window === "undefined") return import.meta.env.BASE_URL;
  const basePath = new URL(import.meta.env.BASE_URL, window.location.href)
    .pathname;
  return window.location.pathname.replace(/\/+$/, "").endsWith("/intel")
    ? `${basePath.replace(/intel\/?$/, "")}`
    : basePath;
}

function assetUrl(path?: string | null) {
  if (!path) return "";
  return `${appBasePath()}${path}`;
}

function scheduleImageClass(path?: string | null) {
  if (!path) return "";
  if (path.includes("/mission/")) return "missionImage";
  if (path.includes("/story/")) return "storyImage";
  if (path.includes("/legend/")) return "legendImage";
  if (path.includes("/factor_research/")) return "factorResearchImage";
  if (path.includes("/campaign/")) return "campaignImage";
  if (path.includes("/special/")) return "specialImage";
  if (path.includes("/piece/")) return "pieceImage";
  if (path.includes("/race/")) return "raceImage";
  return "itemImage";
}

function scheduleTypeClass(type: string) {
  if (type === "训练员技能考试") return "trainingChallengeEvent";
  if (type === "竞速嘉年华") return "challengeMatchEvent";
  return "";
}

function scheduleTypeLabel(type: string) {
  if (type === "传奇赛事时间") return "传奇赛事";
  if (type === "剧情活动时间") return "剧情活动";
  return type;
}

function shortDate(value: string) {
  return value.slice(5, 16);
}

function fullDate(value: string) {
  return value.slice(5, 16);
}

function yearDate(value: string) {
  return value.slice(0, 16);
}

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function sameYear(a: string, b: string) {
  return a.slice(0, 4) === b.slice(0, 4);
}

function dateLabel(start: string, end: string) {
  const format = sameYear(start, end) ? fullDate : yearDate;
  return sameDay(start, end)
    ? `${format(start)} - ${end.slice(11, 16)}`
    : `${format(start)} - ${format(end)}`;
}

function dateLabelLines(start: string, end: string) {
  const format = sameYear(start, end) ? fullDate : yearDate;
  return [format(start), format(end)];
}

function PoolTimeRange({
  pool,
  className = "",
}: {
  pool: GachaPool;
  className?: string;
}) {
  return (
    <time class={`intelPoolTime ${className}`.trim()}>
      <span>{pool.start}</span>
      <span>至 {pool.end}</span>
    </time>
  );
}

function scheduleDateLabel(item: ScheduleItem) {
  return dateLabel(item.start, item.end);
}

function monthLabel(value: string) {
  return value.slice(0, 7);
}

function parseTime(value: string) {
  return new Date(value.replace(" ", "T")).getTime() / 1000;
}

function monthStart(month: string) {
  return parseTime(`${month}-01 00:00:00`);
}

function nextMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthEnd(month: string) {
  return monthStart(nextMonth(month));
}

function daysInMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function dayStart(month: string, day: number) {
  return parseTime(`${month}-${String(day).padStart(2, "0")} 00:00:00`);
}

function dayEnd(month: string, day: number) {
  return dayStart(month, day) + 24 * 60 * 60;
}

function dayLabel(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function weekdayOffset(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
}

function monthsBetween(start: string, end: string) {
  const months = [];
  let cursor = monthLabel(start);
  const finalMonth = monthLabel(end);
  while (cursor <= finalMonth) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
}

function timestampMonth(ts: number) {
  const date = new Date(ts * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function CardImage({ card }: { card: GachaCard }) {
  if (!card.image) {
    return (
      <div class="intelCardFallback">{card.characterName.slice(0, 2)}</div>
    );
  }
  return (
    <img
      src={assetUrl(card.image)}
      alt={card.name}
      loading="lazy"
      class={card.type === "support" ? "supportImage" : "characterImage"}
    />
  );
}

function poolSummary(pool: GachaPool, max = 5) {
  if (pool.selectableCount) {
    const unit = pool.type.includes("角色") ? "位" : "张";
    const selection = pool.selectionLimit
      ? `自选${pool.selectionLimit}${unit}`
      : "自选卡池";
    const stages = pool.stageCount ? ` · ${pool.stageCount}阶段` : "";
    return `${pool.selectableCount}${unit}可选 · ${selection}${stages}`;
  }
  const cutoffCard = pool.cards.find((card) => card.id === pool.cutoffCardId);
  if (cutoffCard) return `截至到 ${cutoffCard.characterName}`;
  const names = Array.from(
    new Set(pool.cards.map((card) => card.characterName)),
  );
  const visible = names.slice(0, max).join(" / ");
  return names.length > max ? `${visible} +${names.length - max}` : visible;
}

function poolPreviewCards(pool: GachaPool) {
  const cutoffCard = pool.cards.find((card) => card.id === pool.cutoffCardId);
  return cutoffCard ? [cutoffCard] : pool.cards;
}

function poolKey(pool: GachaPool) {
  return `${pool.id}-${pool.type}`;
}

function freeDrawText(pool: GachaPool) {
  return (pool.freeDraws || []).map((draw) => draw.label).join(" / ");
}

function freeDrawGameDayKey(value: string) {
  const [datePart, timePart = "00:00:00"] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  // Treat the source value as a wall-clock time so the result is independent
  // of the browser timezone, then shift the game's day boundary to 05:00.
  return Math.floor(
    Date.UTC(year, month - 1, day, hour - 5, minute, second) / 86400000,
  );
}

function freeDrawDayCount(draw: NonNullable<GachaPool["freeDraws"]>[number]) {
  const startKey = freeDrawGameDayKey(draw.start);
  const endKey = freeDrawGameDayKey(draw.end);
  return Math.max(1, endKey - startKey + 1);
}

function freeDrawTotal(draw: NonNullable<GachaPool["freeDraws"]>[number]) {
  return freeDrawDayCount(draw) * draw.drawType;
}

function freeDrawEndText(draw: NonNullable<GachaPool["freeDraws"]>[number]) {
  const endsBeforeRefresh = draw.end.slice(11, 19) < "05:00:00";
  return `${fullDate(draw.end)} 结束${endsBeforeRefresh ? "，结束当天不计入" : ""}`;
}

function FreeDrawBadges({ pool, inline = false }: { pool: GachaPool; inline?: boolean }) {
  const freeDraws = pool.freeDraws || [];
  if (!pool.onlyOnce && !freeDraws.length) return null;
  return (
    <div class={`intelFreeDraws ${inline ? "inline" : ""}`}>
      {pool.onlyOnce && <span class="paid">付费</span>}
      {freeDraws.map((draw) => (
        <span
          title={dateLabel(draw.start, draw.end)}
          key={`${draw.start}-${draw.end}-${draw.drawType}`}
        >
          {draw.label} ×{freeDrawDayCount(draw)}
        </span>
      ))}
    </div>
  );
}

function FreeDrawSchedule({ pool }: { pool: GachaPool }) {
  if (!pool.freeDraws?.length) return null;
  return (
    <section class="intelGachaFreeSchedule">
      <h3>免费抽安排</h3>
      <div>
        {pool.freeDraws.map((draw) => (
          <article
            class="intelGachaFreeItem"
            key={`${draw.start}-${draw.end}-${draw.drawType}`}
          >
            <strong>{draw.label} ×{freeDrawDayCount(draw)}</strong>
            <p>
              从 {fullDate(draw.start)} 到 {fullDate(draw.end)}，共{
                freeDrawDayCount(draw)
              }天，合计 {freeDrawTotal(draw)} 抽。
            </p>
            <small>按每日 05:00 刷新计算；{freeDrawEndText(draw)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function poolCover(pool: GachaPool) {
  return (
    pool.bannerImage || pool.cards.find((card) => card.image)?.image || null
  );
}

function poolTypeClass(pool: GachaPool) {
  return pool.type.includes("角色") ? "characterPool" : "supportPool";
}

function poolKind(pool: GachaPool): Exclude<GachaKindFilter, "all"> {
  return pool.type.includes("角色") ? "character" : "support";
}

function normalizedSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

function poolSearchText(pool: GachaPool) {
  return [
    pool.name || "",
    pool.type,
    freeDrawText(pool),
    ...pool.cards.flatMap((card) => [
      card.name,
      card.title,
      card.characterName,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function eventSearchText(event: ScheduleItem) {
  return [
    event.name,
    event.type,
    scheduleTypeLabel(event.type),
    ...(event.drops || []).map((drop) => drop.label || ""),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function weatherIcon(value?: number) {
  if (!value || value < 1 || value > 4) return null;
  return `icons/utx_ico_weather_${String(value - 1).padStart(2, "0")}.png`;
}

function seasonIcon(value?: number) {
  if (!value || value < 1 || value > 4) return null;
  return `icons/utx_txt_season_${String(value - 1).padStart(2, "0")}.png`;
}

function rateText(items?: Array<{ label: string; rate: number }>) {
  if (!items?.length) return "";
  return items.map((item) => `${item.label}${item.rate}%`).join(" / ");
}

function hideRewardAmount(drop: NonNullable<ScheduleItem["drops"]>[number]) {
  return (
    drop.rewardValue === 59 ||
    drop.rewardValue === 98 ||
    drop.rewardValue === 110 ||
    drop.rewardValue === 45 ||
    drop.rewardValue === 58 ||
    drop.rewardValue === 156 ||
    drop.rewardValue === 159
  );
}

function rewardAmountLabel(drop: NonNullable<ScheduleItem["drops"]>[number]) {
  if (hideRewardAmount(drop)) return "";
  const amount = Number(drop.amount || 0);
  if (!amount) return "";
  return amount >= 10000 ? `x${Math.floor(amount / 10000)}w` : `x${amount}`;
}

function rewardInlineAmountLabel(reward?: ScheduleReward | null) {
  if (!reward || reward.countOnly) return "";
  return rewardAmountLabel(reward as NonNullable<ScheduleItem["drops"]>[number]);
}

function detailAmountLabel(reward?: ScheduleReward | null) {
  const amount = Number(reward?.amount || 0);
  if (!amount) return "";
  return amount >= 10000 ? `x${Math.floor(amount / 10000)}w` : `x${amount}`;
}

function scheduleDetailKey(item: ScheduleItem) {
  return `${item.type}-${item.id}-${item.startTimestamp}`;
}

function scheduleKeyHandler(onSelect: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };
}

function rewardSourceGroups(drops?: ScheduleItem["drops"]) {
  return (drops || []).reduce<
    Array<{ source: string; drops: NonNullable<ScheduleItem["drops"]> }>
  >((groups, drop) => {
    const source = drop.source || "奖励";
    let group = groups.find((item) => item.source === source);
    if (!group) {
      group = { source, drops: [] };
      groups.push(group);
    }
    group.drops.push(drop);
    return groups;
  }, []);
}

function mergedRewardDrops(drops?: ScheduleItem["drops"]) {
  const merged = new Map<string, NonNullable<ScheduleItem["drops"]>[number]>();
  (drops || []).forEach((drop) => {
    const key = `${drop.rewardType || 0}-${drop.rewardValue || 0}-${drop.image || drop.name || drop.label || ""}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...drop,
        source: "合计",
        label: drop.name || drop.label || "奖励",
      });
      return;
    }
    existing.amount = Number(existing.amount || 0) + Number(drop.amount || 0);
  });
  return Array.from(merged.values()).map((drop) => ({
    ...drop,
    label: drop.name || drop.label || "奖励",
  }));
}

async function loadExchangeDetails(path: string) {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return (await response.json()) as Pick<ScheduleItem, "exchangeDetails">;
}

const EXPORT_WIDTH = 1600;
const EXPORT_PADDING = 36;
const EXPORT_RIGHT = EXPORT_WIDTH - EXPORT_PADDING;
const EXPORT_CONTENT_WIDTH = EXPORT_WIDTH - EXPORT_PADDING * 2;
const EXPORT_GACHA_ROW_HEIGHT = 112;
const EXPORT_EVENT_ROW_HEIGHT = 104;
const EXPORT_GACHA_COLUMNS = 3;
const EXPORT_GACHA_GAP = 16;
const EXPORT_GACHA_TILE_WIDTH = Math.floor(
  (EXPORT_CONTENT_WIDTH - EXPORT_GACHA_GAP * (EXPORT_GACHA_COLUMNS - 1)) /
    EXPORT_GACHA_COLUMNS,
);
const EXPORT_GACHA_ICON_SIZE = 70;
const EXPORT_GACHA_ICON_GAP = 8;
const EXPORT_GACHA_TILE_PADDING = 16;
const EXPORT_GACHA_ICON_COLUMNS = Math.floor(
  (EXPORT_GACHA_TILE_WIDTH - EXPORT_GACHA_TILE_PADDING * 2 +
    EXPORT_GACHA_ICON_GAP) /
    (EXPORT_GACHA_ICON_SIZE + EXPORT_GACHA_ICON_GAP),
);

type ExportImageSource = {
  pools: GachaPool[];
  events: ScheduleItem[];
  races: ScheduleItem[];
  now: number;
  generatedAt: string;
};

type ExportImageSection = "gacha" | "events" | "races";

type LoadedImages = Map<string, HTMLImageElement>;

function scheduleExportImage(item: ScheduleItem) {
  if (item.name === "指定赛事奖励追加碎片") {
    const pieceDrop = item.drops?.find(
      (drop) => drop.isPiece || drop.image?.includes("/piece/"),
    );
    if (pieceDrop?.image) return pieceDrop.image;
  }
  return item.image;
}

function collectExportImages(
  source: ExportImageSource,
  section: ExportImageSection,
) {
  const paths = new Set<string>();
  if (section === "gacha") {
    source.pools.forEach((pool) => {
      const cover = poolCover(pool);
      if (cover) paths.add(cover);
      exportPoolCards(pool).forEach(
        (card) => card.image && paths.add(card.image),
      );
    });
  }
  const schedules =
    section === "events" ? source.events : section === "races" ? source.races : [];
  schedules.forEach((item) => {
    const image = scheduleExportImage(item);
    if (image) paths.add(image);
    item.details?.forEach((detail) => {
      const weather = weatherIcon(detail.weatherValue);
      const season = seasonIcon(detail.seasonValue);
      if (weather) paths.add(weather);
      if (season) paths.add(season);
    });
  });
  return Array.from(paths);
}

function loadExportImage(path: string) {
  return new Promise<[string, HTMLImageElement | null]>((resolve) => {
    const image = new Image();
    image.onload = () => resolve([path, image]);
    image.onerror = () => resolve([path, null]);
    image.src = assetUrl(path);
  });
}

async function loadExportImages(paths: string[]) {
  const entries = await Promise.all(paths.map(loadExportImage));
  const images: LoadedImages = new Map();
  entries.forEach(([path, image]) => {
    if (image) images.set(path, image);
  });
  return images;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 8,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function exportFont(size: number, weight = 500) {
  return `${weight} ${size}px "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`;
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
) {
  const chars = Array.from(text || "");
  const lines: string[] = [];
  let line = "";
  chars.forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      return;
    }
    lines.push(line);
    line = char;
  });
  if (line) lines.push(line);
  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}…`;
  }
  clipped.forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight);
  });
  return clipped.length * lineHeight;
}

function clippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (!text || maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(`${chars.join("")}…`).width > maxWidth) {
    chars.pop();
  }
  return chars.length ? `${chars.join("")}…` : "";
}

function drawClippedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const visibleText = clippedText(ctx, text, maxWidth);
  if (visibleText) ctx.fillText(visibleText, x, y);
  return visibleText;
}

function exportTimestampParts(value: string) {
  return {
    date: value.slice(5, 10).replace("-", "/"),
    time: value.slice(11, 16),
  };
}

function drawExportTimestamp(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  dateSize: number,
  timeSize: number,
  prefix = "",
) {
  const { date, time } = exportTimestampParts(value);
  let cursorX = x;
  ctx.save();
  if (prefix) {
    ctx.font = exportFont(timeSize, 800);
    ctx.fillText(prefix, cursorX, y);
    cursorX += ctx.measureText(prefix).width + 5;
  }
  ctx.font = exportFont(dateSize, 900);
  ctx.fillText(date, cursorX, y);
  cursorX += ctx.measureText(date).width + 8;
  ctx.font = exportFont(timeSize, 800);
  ctx.fillText(time, cursorX, y);
  cursorX += ctx.measureText(time).width;
  ctx.restore();
  return cursorX - x;
}

function drawExportTimeRange(
  ctx: CanvasRenderingContext2D,
  start: string,
  end: string,
  x: number,
  y: number,
  dateSize: number,
  timeSize: number,
) {
  let cursorX = x + drawExportTimestamp(ctx, start, x, y, dateSize, timeSize);
  ctx.save();
  ctx.font = exportFont(timeSize, 800);
  const separator = "  –  ";
  ctx.fillText(separator, cursorX, y);
  cursorX += ctx.measureText(separator).width;
  ctx.restore();
  if (sameDay(start, end)) {
    ctx.save();
    ctx.font = exportFont(timeSize, 800);
    const endTime = exportTimestampParts(end).time;
    ctx.fillText(endTime, cursorX, y);
    cursorX += ctx.measureText(endTime).width;
    ctx.restore();
  } else {
    cursorX += drawExportTimestamp(ctx, end, cursorX, y, dateSize, timeSize);
  }
  return cursorX - x;
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: "contain" | "cover" = "contain",
) {
  if (!image) {
    fillRounded(ctx, x, y, width, height, 6, "#eef2f7", "#d7dce5");
    return;
  }
  const scale =
    fit === "cover"
      ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
      : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  fill = "#e8f0ff",
  text = "#1f66d1",
  maxWidth = Number.POSITIVE_INFINITY,
) {
  if (maxWidth < 32) return 0;
  ctx.font = exportFont(18, 700);
  const visibleLabel = clippedText(ctx, label, maxWidth - 24);
  if (!visibleLabel) return 0;
  const width = Math.min(
    maxWidth,
    Math.ceil(ctx.measureText(visibleLabel).width) + 24,
  );
  fillRounded(ctx, x, y, width, 30, 15, fill);
  ctx.fillStyle = text;
  ctx.fillText(visibleLabel, x + 12, y + 21);
  return width;
}

function raceDetailExportHeight(
  detail: NonNullable<ScheduleItem["details"]>[number],
) {
  return detail.conditionRates ? 78 : 54;
}

function raceExportHeight(race: ScheduleItem) {
  const detailHeight = (race.details || []).reduce(
    (height, detail) => height + raceDetailExportHeight(detail),
    0,
  );
  const milestones = race.milestones || [];
  const milestoneHeight = milestones.length
    ? 34 + Math.ceil(milestones.length / 2) * 46
    : 0;
  return 94 + detailHeight + milestoneHeight + 16;
}

function estimateExportHeight(source: ExportImageSource) {
  const raceHeight = source.races.reduce(
    (height, race) => height + raceExportHeight(race) + 14,
    0,
  );
  return (
    140 +
    54 +
    Math.max(1, source.pools.length) * (EXPORT_GACHA_ROW_HEIGHT + 14) +
    54 +
    Math.max(1, source.events.length) * (EXPORT_EVENT_ROW_HEIGHT + 12) +
    54 +
    Math.max(1, raceHeight) +
    44
  );
}

function drawGachaRow(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  pool: GachaPool,
  y: number,
  now: number,
) {
  const active = pool.startTimestamp <= now && pool.endTimestamp >= now;
  const accent = poolKind(pool) === "character" ? "#db2777" : "#2563eb";
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_CONTENT_WIDTH,
    EXPORT_GACHA_ROW_HEIGHT,
    8,
    "#ffffff",
    "#d7dce5",
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(EXPORT_PADDING, y, EXPORT_CONTENT_WIDTH, EXPORT_GACHA_ROW_HEIGHT);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(EXPORT_PADDING, y, 6, EXPORT_GACHA_ROW_HEIGHT);
  const cover = poolCover(pool);
  drawImageFit(
    ctx,
    cover ? images.get(cover) : undefined,
    EXPORT_PADDING + 20,
    y + 14,
    244,
    84,
    "contain",
  );

  const textX = EXPORT_PADDING + 286;
  const startX = EXPORT_RIGHT - 508;
  ctx.font = exportFont(19, 800);
  ctx.fillStyle = "#18202b";
  const visibleType = drawClippedText(ctx, pool.type, textX, y + 33, 110);
  let badgeX = textX + Math.ceil(ctx.measureText(visibleType).width) + 12;
  if (active) {
    badgeX +=
      drawBadge(
        ctx,
        "进行中",
        badgeX,
        y + 11,
        "#fee2e2",
        "#b42318",
        startX - badgeX - 10,
      ) + 8;
  }
  if (pool.freeDraws?.length) {
    drawBadge(
      ctx,
      freeDrawText(pool),
      badgeX,
      y + 11,
      "#fef3c7",
      "#92400e",
      startX - badgeX - 10,
    );
  }
  ctx.font = exportFont(24, 800);
  ctx.fillStyle = "#18202b";
  drawTextLines(
    ctx,
    poolSummary(pool, 8),
    textX,
    y + 65,
    startX - textX - 18,
    28,
    1,
  );
  ctx.font = exportFont(16, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(pool.start, textX, y + 86);
  ctx.fillText(`至 ${pool.end}`, textX, y + 106);

  const previewCards = poolPreviewCards(pool);
  previewCards.slice(0, 6).forEach((card, index) => {
    const x = startX + index * 78;
    drawImageFit(
      ctx,
      card.image ? images.get(card.image) : undefined,
      x,
      y + 22,
      68,
      68,
      "contain",
    );
  });
  if (!pool.cutoffCardId && pool.cards.length > 6) {
    ctx.font = exportFont(24, 800);
    ctx.fillStyle = "#5f6b7a";
    ctx.textAlign = "right";
    ctx.fillText(`+${pool.cards.length - 6}`, EXPORT_RIGHT - 4, y + 64);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function drawEventRow(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  event: ScheduleItem,
  y: number,
  now: number,
) {
  const active = event.startTimestamp <= now && event.endTimestamp >= now;
  const eventImage = scheduleExportImage(event);
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_CONTENT_WIDTH,
    EXPORT_EVENT_ROW_HEIGHT,
    8,
    "#ffffff",
    "#d7dce5",
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(EXPORT_PADDING, y, EXPORT_CONTENT_WIDTH, EXPORT_EVENT_ROW_HEIGHT);
  ctx.clip();
  drawImageFit(
    ctx,
    eventImage ? images.get(eventImage) : undefined,
    EXPORT_PADDING + 18,
    y + 10,
    74,
    66,
    "contain",
  );
  const textX = EXPORT_PADDING + 112;
  const infoX = EXPORT_RIGHT - 360;
  const badgeWidth = drawBadge(
    ctx,
    scheduleTypeLabel(event.type),
    textX,
    y + 11,
    "#eef2f7",
    "#18202b",
    infoX - textX - 12,
  );
  if (active)
    drawBadge(
      ctx,
      "进行中",
      textX + badgeWidth + 10,
      y + 11,
      "#fee2e2",
      "#b42318",
      infoX - (textX + badgeWidth + 10) - 12,
    );
  ctx.font = exportFont(24, 800);
  ctx.fillStyle = "#18202b";
  drawTextLines(ctx, event.name, textX, y + 65, infoX - textX - 20, 28, 1);
  ctx.fillStyle = "#5f6b7a";
  drawExportTimestamp(ctx, event.start, infoX, y + 37, 23, 17);
  drawExportTimestamp(ctx, event.end, infoX, y + 68, 23, 17, "至");
  ctx.restore();
}

function raceDetailText(detail: NonNullable<ScheduleItem["details"]>[number]) {
  const main = [
    detail.track,
    detail.distance ? `${detail.distance}m` : "",
    detail.ground,
  ]
    .filter(Boolean)
    .join(" ");
  const meta = [detail.turn, detail.inout, detail.weather, detail.condition]
    .filter(Boolean)
    .join(" / ");
  const weatherRates = rateText(detail.conditionRates?.weather);
  const conditionRates = rateText(detail.conditionRates?.condition);
  const rates = [
    weatherRates && `天气 ${weatherRates}`,
    conditionRates && `场地 ${conditionRates}`,
  ]
    .filter(Boolean)
    .join("；");
  return [main, meta, rates].filter(Boolean).join("  ");
}

function drawRaceRow(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  race: ScheduleItem,
  y: number,
  now: number,
) {
  const details = race.details || [];
  const milestones = race.milestones || [];
  const height = raceExportHeight(race);
  const active = race.startTimestamp <= now && race.endTimestamp >= now;
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_CONTENT_WIDTH,
    height,
    8,
    "#ffffff",
    "#d7dce5",
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(EXPORT_PADDING, y, EXPORT_CONTENT_WIDTH, height);
  ctx.clip();
  drawImageFit(
    ctx,
    race.image ? images.get(race.image) : undefined,
    EXPORT_PADDING + 18,
    y + 18,
    88,
    66,
    "contain",
  );
  const textX = EXPORT_PADDING + 126;
  ctx.font = exportFont(25, 800);
  ctx.fillStyle = "#18202b";
  const visibleRaceName = drawClippedText(
    ctx,
    race.name,
    textX,
    y + 34,
    520,
  );
  if (active) {
    const badgeX = textX + ctx.measureText(visibleRaceName).width + 14;
    drawBadge(
      ctx,
      "进行中",
      badgeX,
      y + 11,
      "#fee2e2",
      "#b42318",
      EXPORT_RIGHT - badgeX,
    );
  }
  ctx.fillStyle = "#5f6b7a";
  drawExportTimeRange(ctx, race.start, race.end, textX, y + 66, 22, 16);

  let cursorY = y + 86;
  details.forEach((detail) => {
    const detailHeight = raceDetailExportHeight(detail);
    fillRounded(
      ctx,
      textX - 8,
      cursorY,
      EXPORT_RIGHT - textX,
      detailHeight - 6,
      6,
      "#f8fafc",
      "#e5e9ef",
    );
    const season = seasonIcon(detail.seasonValue);
    const weather = weatherIcon(detail.weatherValue);
    if (season)
      drawImageFit(
        ctx,
        images.get(season),
        textX,
        cursorY + 10,
        48,
        24,
        "contain",
      );
    if (weather)
      drawImageFit(
        ctx,
        images.get(weather),
        textX + 54,
        cursorY + 8,
        34,
        28,
        "contain",
      );
    ctx.font = exportFont(18, 700);
    ctx.fillStyle = "#18202b";
    drawTextLines(
      ctx,
      raceDetailText(detail),
      textX + 102,
      cursorY + 22,
      EXPORT_RIGHT - textX - 118,
      21,
      detail.conditionRates ? 3 : 2,
    );
    cursorY += detailHeight;
  });

  if (milestones.length) {
    ctx.font = exportFont(18, 800);
    ctx.fillStyle = "#18202b";
    ctx.fillText("时间节点", textX, cursorY + 22);
    cursorY += 34;
    const columnGap = 14;
    const columnWidth = (EXPORT_RIGHT - textX - columnGap) / 2;
    milestones.forEach((milestone, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = textX + column * (columnWidth + columnGap);
      const milestoneY = cursorY + row * 46;
      fillRounded(
        ctx,
        x,
        milestoneY,
        columnWidth,
        38,
        6,
        "#f8fafc",
        "#e5e9ef",
      );
      ctx.font = exportFont(16, 800);
      ctx.fillStyle = "#18202b";
      const labelWidth = Math.min(
        116,
        Math.ceil(ctx.measureText(milestone.label).width) + 18,
      );
      drawClippedText(
        ctx,
        milestone.label,
        x + 10,
        milestoneY + 25,
        labelWidth - 10,
      );
      ctx.fillStyle = "#5f6b7a";
      drawExportTimeRange(
        ctx,
        milestone.start,
        milestone.end,
        x + labelWidth,
        milestoneY + 25,
        15,
        11,
      );
    });
  }
  ctx.restore();
  return height;
}

function drawEmptyExportRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  text: string,
) {
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_WIDTH - EXPORT_PADDING * 2,
    74,
    8,
    "#ffffff",
    "#d7dce5",
  );
  ctx.font = exportFont(22, 700);
  ctx.fillStyle = "#8a94a3";
  ctx.fillText(text, EXPORT_PADDING + 24, y + 46);
}

function exportPoolCards(pool: GachaPool) {
  return pool.cards.slice(0, pool.cards.length <= 50 ? pool.cards.length : 50);
}

function exportFreeDrawText(pool: GachaPool) {
  return (pool.freeDraws || [])
    .map((draw) => `${draw.label} ×${freeDrawDayCount(draw)}`)
    .join(" / ");
}

function gachaTileHeight(pool: GachaPool) {
  const visibleCards = exportPoolCards(pool);
  const rows = Math.ceil(visibleCards.length / EXPORT_GACHA_ICON_COLUMNS);
  const iconsHeight = rows
    ? rows * (EXPORT_GACHA_ICON_SIZE + EXPORT_GACHA_ICON_GAP) -
      EXPORT_GACHA_ICON_GAP
    : 0;
  const remainderHeight = pool.cards.length > visibleCards.length ? 28 : 0;
  return 343 + iconsHeight + remainderHeight;
}

function gachaExportGroups(pools: GachaPool[]) {
  const groups = new Map<string, GachaPool[]>();
  pools.forEach((pool) => {
    const month = pool.start.slice(0, 7);
    const group = groups.get(month) || [];
    group.push(pool);
    groups.set(month, group);
  });
  return Array.from(groups, ([month, items]) => ({ month, items }));
}

function scheduleExportGroups(items: ScheduleItem[]) {
  const groups = new Map<string, ScheduleItem[]>();
  items.forEach((item) => {
    const month = item.start.slice(0, 7);
    const group = groups.get(month) || [];
    group.push(item);
    groups.set(month, group);
  });
  return Array.from(groups, ([month, groupedItems]) => ({
    month,
    items: groupedItems,
  }));
}

function exportMonthLabel(month: string) {
  const monthNumber = month.split("-")[1];
  return `${Number(monthNumber)}月`;
}

function drawExportMonthHeader(
  ctx: CanvasRenderingContext2D,
  month: string,
  y: number,
) {
  ctx.font = exportFont(27, 900);
  ctx.fillStyle = "#18202b";
  ctx.fillText(exportMonthLabel(month), EXPORT_PADDING, y + 29);
  ctx.strokeStyle = "#d7dce5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(EXPORT_PADDING, y + 43);
  ctx.lineTo(EXPORT_RIGHT, y + 43);
  ctx.stroke();
}

function gachaGridHeight(pools: GachaPool[]) {
  let height = 0;
  const groups = gachaExportGroups(pools);
  groups.forEach((group, groupIndex) => {
    height += 48;
    for (
      let index = 0;
      index < group.items.length;
      index += EXPORT_GACHA_COLUMNS
    ) {
      const row = group.items.slice(index, index + EXPORT_GACHA_COLUMNS);
      height += Math.max(...row.map(gachaTileHeight)) + EXPORT_GACHA_GAP;
    }
    height -= EXPORT_GACHA_GAP;
    if (groupIndex < groups.length - 1) height += 24;
  });
  return Math.max(86, height);
}

function eventGridHeight(events: ScheduleItem[]) {
  let height = 0;
  const groups = scheduleExportGroups(events);
  groups.forEach((group, groupIndex) => {
    height += 48;
    height += group.items.length * (EXPORT_EVENT_ROW_HEIGHT + 12) - 12;
    if (groupIndex < groups.length - 1) height += 24;
  });
  return Math.max(86, height);
}

function raceGridHeight(races: ScheduleItem[]) {
  let height = 0;
  const groups = scheduleExportGroups(races);
  groups.forEach((group, groupIndex) => {
    height += 48;
    height += group.items.reduce(
      (groupHeight, race) => groupHeight + raceExportHeight(race) + 14,
      0,
    );
    height -= 14;
    if (groupIndex < groups.length - 1) height += 24;
  });
  return Math.max(86, height);
}

function drawGachaTile(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  pool: GachaPool,
  x: number,
  y: number,
  now: number,
  alignedHeight?: number,
) {
  const height = alignedHeight || gachaTileHeight(pool);
  const active = pool.startTimestamp <= now && pool.endTimestamp >= now;
  const accent = poolKind(pool) === "character" ? "#db2777" : "#2563eb";
  fillRounded(
    ctx,
    x,
    y,
    EXPORT_GACHA_TILE_WIDTH,
    height,
    10,
    "#ffffff",
    "#d7dce5",
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, EXPORT_GACHA_TILE_WIDTH, height);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 6, height);

  const innerX = x + EXPORT_GACHA_TILE_PADDING;
  const innerRight = x + EXPORT_GACHA_TILE_WIDTH - EXPORT_GACHA_TILE_PADDING;
  const cover = poolCover(pool);
  drawImageFit(
    ctx,
    cover ? images.get(cover) : undefined,
    innerX,
    y + 14,
    innerRight - innerX,
    152,
    "contain",
  );

  let badgeX = innerX;
  if (active) {
    badgeX +=
      drawBadge(
      ctx,
      "进行中",
      badgeX,
      y + 176,
      "#fee2e2",
      "#b42318",
      innerRight - badgeX,
    ) + 8;
  }
  const freeDraw = exportFreeDrawText(pool);
  if (freeDraw) {
    drawBadge(
      ctx,
      freeDraw,
      badgeX,
      y + 176,
      "#fef3c7",
      "#92400e",
      innerRight - badgeX,
    );
  }

  ctx.font = exportFont(22, 800);
  ctx.fillStyle = "#18202b";
  drawClippedText(
    ctx,
    pool.name || poolSummary(pool, 8),
    innerX,
    y + 230,
    innerRight - innerX,
  );
  ctx.font = exportFont(17, 700);
  ctx.fillStyle = "#475569";
  drawClippedText(
    ctx,
    poolSummary(pool, 8),
    innerX,
    y + 260,
    innerRight - innerX,
  );
  ctx.fillStyle = "#5f6b7a";
  drawExportTimestamp(ctx, pool.start, innerX, y + 289, 18, 14);
  drawExportTimestamp(ctx, pool.end, innerX, y + 315, 18, 14, "至");

  const visibleCards = exportPoolCards(pool);
  const gridY = y + 331;
  visibleCards.forEach((card, index) => {
    const column = index % EXPORT_GACHA_ICON_COLUMNS;
    const row = Math.floor(index / EXPORT_GACHA_ICON_COLUMNS);
    const cardX =
      innerX + column * (EXPORT_GACHA_ICON_SIZE + EXPORT_GACHA_ICON_GAP);
    const cardY =
      gridY + row * (EXPORT_GACHA_ICON_SIZE + EXPORT_GACHA_ICON_GAP);
    drawImageFit(
      ctx,
      card.image ? images.get(card.image) : undefined,
      cardX,
      cardY,
      EXPORT_GACHA_ICON_SIZE,
      EXPORT_GACHA_ICON_SIZE,
      "contain",
    );
  });
  if (pool.cards.length > visibleCards.length) {
    const rows = Math.ceil(visibleCards.length / EXPORT_GACHA_ICON_COLUMNS);
    const footerY =
      gridY + rows * (EXPORT_GACHA_ICON_SIZE + EXPORT_GACHA_ICON_GAP) + 10;
    ctx.font = exportFont(16, 800);
    ctx.fillStyle = "#5f6b7a";
    ctx.fillText(
      `另有 ${pool.cards.length - visibleCards.length} 项未展示`,
      innerX,
      footerY,
    );
  }
  ctx.restore();
  return height;
}

function drawExportHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  generatedAt: string,
) {
  ctx.fillStyle = "#18202b";
  ctx.font = exportFont(34, 900);
  ctx.fillText(`闪耀优俊少女 ${title}一图流`, EXPORT_PADDING, 58);
  ctx.font = exportFont(19, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(
    `生成 ${generatedAt || new Date().toLocaleString()}`,
    EXPORT_PADDING,
    91,
  );
  ctx.textAlign = "right";
  ctx.fillText("当前 / 未来", EXPORT_RIGHT, 91);
  ctx.textAlign = "left";
}

function exportSectionHeight(
  source: ExportImageSource,
  section: ExportImageSection,
) {
  if (section === "gacha") return 190 + gachaGridHeight(source.pools) + 40;
  if (section === "events") return 190 + eventGridHeight(source.events) + 40;
  return 190 + raceGridHeight(source.races) + 40;
}

async function exportIntelImage(
  source: ExportImageSource,
  section: ExportImageSection,
) {
  const images = await loadExportImages(collectExportImages(source, section));
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = exportSectionHeight(source, section);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#f5f6f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const title = section === "gacha" ? "卡池" : section === "events" ? "活动" : "大赛";
  drawExportHeader(ctx, title, source.generatedAt);
  let y = 174;
  if (section === "gacha") {
    if (source.pools.length) {
      const groups = gachaExportGroups(source.pools);
      groups.forEach((group, groupIndex) => {
        drawExportMonthHeader(ctx, group.month, y);
        y += 48;

        for (
          let index = 0;
          index < group.items.length;
          index += EXPORT_GACHA_COLUMNS
        ) {
          const row = group.items.slice(index, index + EXPORT_GACHA_COLUMNS);
          const rowHeight = Math.max(...row.map(gachaTileHeight));
          row.forEach((pool, column) => {
            const x =
              EXPORT_PADDING +
              column * (EXPORT_GACHA_TILE_WIDTH + EXPORT_GACHA_GAP);
            drawGachaTile(ctx, images, pool, x, y, source.now, rowHeight);
          });
          y += rowHeight + EXPORT_GACHA_GAP;
        }
        y -= EXPORT_GACHA_GAP;
        if (groupIndex < groups.length - 1) y += 24;
      });
    } else {
      drawEmptyExportRow(ctx, y, "没有符合筛选的卡池");
    }
  } else if (section === "events") {
    if (source.events.length) {
      const groups = scheduleExportGroups(source.events);
      groups.forEach((group, groupIndex) => {
        drawExportMonthHeader(ctx, group.month, y);
        y += 48;
        group.items.forEach((event) => {
          drawEventRow(ctx, images, event, y, source.now);
          y += EXPORT_EVENT_ROW_HEIGHT + 12;
        });
        y -= 12;
        if (groupIndex < groups.length - 1) y += 24;
      });
    } else {
      drawEmptyExportRow(ctx, y, "没有符合筛选的活动");
    }
  } else if (source.races.length) {
    const groups = scheduleExportGroups(source.races);
    groups.forEach((group, groupIndex) => {
      drawExportMonthHeader(ctx, group.month, y);
      y += 48;
      group.items.forEach((race) => {
        y += drawRaceRow(ctx, images, race, y, source.now) + 14;
      });
      y -= 14;
      if (groupIndex < groups.length - 1) y += 24;
    });
  } else {
    drawEmptyExportRow(ctx, y, "暂无当前 / 未来大赛");
  }

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("导出图片失败"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uma-intel-${section}-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

const MOBILE_EXPORT_WIDTH = 1080;
const MOBILE_EXPORT_MIN_HEIGHT = 1440;
const MOBILE_EXPORT_MAX_HEIGHT = 1920;
const MOBILE_EXPORT_CANVAS_HEIGHT = 2400;
const MOBILE_EXPORT_PADDING = 48;
const MOBILE_EXPORT_RIGHT = MOBILE_EXPORT_WIDTH - MOBILE_EXPORT_PADDING;
const MOBILE_EXPORT_CONTENT_WIDTH =
  MOBILE_EXPORT_WIDTH - MOBILE_EXPORT_PADDING * 2;
const MOBILE_EXPORT_START_Y = 24;
const MOBILE_EXPORT_BOTTOM = MOBILE_EXPORT_MAX_HEIGHT - 48;
const MOBILE_GACHA_COLUMNS = 2;
const MOBILE_GACHA_GAP = 16;
const MOBILE_GACHA_TILE_WIDTH = Math.floor(
  (MOBILE_EXPORT_CONTENT_WIDTH -
    MOBILE_GACHA_GAP * (MOBILE_GACHA_COLUMNS - 1)) /
    MOBILE_GACHA_COLUMNS,
);
const MOBILE_GACHA_ICON_SIZE = 62;
const MOBILE_GACHA_ICON_GAP = 8;
const MOBILE_GACHA_ICON_COLUMNS = 6;
const MOBILE_EVENT_HEIGHT = 154;

type MobileExportPage = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  contentBottom: number;
};

function createMobileExportPage(
  _section: ExportImageSection,
  _generatedAt: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = MOBILE_EXPORT_WIDTH;
  canvas.height = MOBILE_EXPORT_CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#f5f6f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, contentBottom: 0 };
}

function drawMobileMonthHeader(
  ctx: CanvasRenderingContext2D,
  month: string,
  y: number,
) {
  ctx.font = exportFont(30, 900);
  ctx.fillStyle = "#18202b";
  ctx.fillText(exportMonthLabel(month), MOBILE_EXPORT_PADDING, y + 34);
  ctx.strokeStyle = "#cfd5df";
  ctx.beginPath();
  ctx.moveTo(MOBILE_EXPORT_PADDING, y + 50);
  ctx.lineTo(MOBILE_EXPORT_RIGHT, y + 50);
  ctx.stroke();
  return 62;
}

function denseMobileGachaLayout(cardCount: number) {
  const normalRows = Math.ceil(cardCount / MOBILE_GACHA_ICON_COLUMNS);
  const lastCount = cardCount % MOBILE_GACHA_ICON_COLUMNS || MOBILE_GACHA_ICON_COLUMNS;
  if (lastCount <= MOBILE_GACHA_ICON_COLUMNS - 2) {
    return {
      rows: normalRows,
      lastRow: normalRows - 1,
      lastRowStart: cardCount - lastCount,
    };
  }
  const movedCount = lastCount - (MOBILE_GACHA_ICON_COLUMNS - 2);
  return {
    rows: normalRows + 1,
    lastRow: normalRows,
    lastRowStart: cardCount - movedCount,
  };
}

function mobileGachaTitle(pool: GachaPool) {
  return pool.name || poolSummary(pool, 10);
}

function mobileGachaTitleLineCount(pool: GachaPool) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1;
  ctx.font = exportFont(26, 900);
  const maxWidth = MOBILE_GACHA_TILE_WIDTH - 32;
  let line = "";
  let lines = 0;
  Array.from(mobileGachaTitle(pool)).forEach((char) => {
    const next = line + char;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines += 1;
      line = char;
    }
  });
  if (line) lines += 1;
  return Math.max(1, lines);
}

function mobileGachaHeight(pool: GachaPool) {
  const visibleCards = exportPoolCards(pool);
  const compact = pool.cards.length <= 12;
  const rows = compact
    ? 1 + Math.ceil(Math.max(0, visibleCards.length - 4) / 6)
    : denseMobileGachaLayout(visibleCards.length).rows;
  const iconHeight = rows
    ? rows * (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP) -
      MOBILE_GACHA_ICON_GAP
    : 0;
  const titleExtra = (mobileGachaTitleLineCount(pool) - 1) * 30;
  return 241 + titleExtra + Math.max(62, iconHeight);
}

function drawMobileGacha(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  pool: GachaPool,
  x: number,
  y: number,
  now: number,
  alignedHeight?: number,
) {
  const width = MOBILE_GACHA_TILE_WIDTH;
  const height = alignedHeight || mobileGachaHeight(pool);
  const innerX = x + 16;
  const innerRight = x + width - 16;
  const active = pool.startTimestamp <= now && pool.endTimestamp >= now;
  const accent = poolKind(pool) === "character" ? "#db2777" : "#2563eb";
  const compact = pool.cards.length <= 12;
  fillRounded(ctx, x, y, width, height, 12, "#ffffff", "#d7dce5");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, 8, height);
  const cover = poolCover(pool);
  const freeDraw = exportFreeDrawText(pool);
  drawImageFit(
    ctx,
    cover ? images.get(cover) : undefined,
    innerX,
    y + 14,
    innerRight - innerX,
    128,
    "contain",
  );
  let badgeX = innerX;
  if (active) {
    badgeX +=
      drawBadge(
        ctx,
        "进行中",
        badgeX,
        y + 112,
        "#fee2e2",
        "#b42318",
        innerRight - badgeX,
      ) + 10;
  }
  if (freeDraw) {
    drawBadge(
      ctx,
      freeDraw,
      badgeX,
      y + 112,
      "#fef3c7",
      "#92400e",
      innerRight - badgeX,
    );
  }
  const titleLineCount = mobileGachaTitleLineCount(pool);
  const titleExtra = (titleLineCount - 1) * 30;
  ctx.font = exportFont(26, 900);
  ctx.fillStyle = "#18202b";
  drawTextLines(
    ctx,
    mobileGachaTitle(pool),
    innerX,
    y + 176,
    innerRight - innerX,
    30,
    99,
  );
  ctx.font = exportFont(17, 700);
  ctx.fillStyle = "#475569";
  drawClippedText(
    ctx,
    poolSummary(pool, 8),
    innerX,
    y + 205 + titleExtra,
    innerRight - innerX,
  );
  const gridX = innerX;
  const gridY = y + 225 + titleExtra;
  const gridColumns = MOBILE_GACHA_ICON_COLUMNS;

  const visibleCards = exportPoolCards(pool);
  const denseLayout = compact
    ? null
    : denseMobileGachaLayout(visibleCards.length);
  visibleCards.forEach((card, index) => {
    const compactFirstRow = compact && index < 4;
    const compactLaterRow = compact && index >= 4;
    const inReservedLastRow = Boolean(denseLayout && index >= denseLayout.lastRowStart);
    const column = compactFirstRow
      ? index + 2
      : compactLaterRow
        ? (index - 4) % gridColumns
        : inReservedLastRow
          ? index - (denseLayout?.lastRowStart || 0) + 2
          : index % gridColumns;
    const row = compactFirstRow
      ? 0
      : compactLaterRow
        ? 1 + Math.floor((index - 4) / gridColumns)
        : inReservedLastRow
          ? denseLayout?.lastRow || 0
          : Math.floor(index / gridColumns);
    drawImageFit(
      ctx,
      card.image ? images.get(card.image) : undefined,
      gridX + column * (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP),
      gridY + row * (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP),
      MOBILE_GACHA_ICON_SIZE,
      MOBILE_GACHA_ICON_SIZE,
      "contain",
    );
  });
  if (compact && pool.cards.length > visibleCards.length) {
    const rows = Math.ceil(visibleCards.length / gridColumns);
    ctx.font = exportFont(15, 800);
    ctx.fillStyle = "#5f6b7a";
    ctx.fillText(
      `另有 ${pool.cards.length - visibleCards.length} 项未展示`,
      gridX,
      gridY + rows * (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP) + 19,
    );
  }
  ctx.fillStyle = "#5f6b7a";
  if (compact) {
    drawExportTimestamp(ctx, pool.start, innerX, gridY + 24, 22, 16);
    drawExportTimestamp(ctx, pool.end, innerX, gridY + 52, 22, 16, "至");
  } else {
    const lastRowY =
      gridY +
      Math.max(0, denseLayout?.lastRow || 0) *
        (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP);
    drawExportTimestamp(ctx, pool.start, innerX, lastRowY + 24, 22, 16);
    drawExportTimestamp(ctx, pool.end, innerX, lastRowY + 52, 22, 16, "至");
    if (pool.cards.length > visibleCards.length) {
      ctx.font = exportFont(14, 800);
      ctx.fillStyle = "#5f6b7a";
      drawClippedText(
        ctx,
        `另有 ${pool.cards.length - visibleCards.length} 项未展示`,
        innerX + 4 * (MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP),
        lastRowY + 38,
        2 * MOBILE_GACHA_ICON_SIZE + MOBILE_GACHA_ICON_GAP,
      );
    }
  }
  ctx.restore();
  return height;
}

function drawMobileEvent(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  event: ScheduleItem,
  y: number,
  now: number,
) {
  const x = MOBILE_EXPORT_PADDING;
  const width = MOBILE_EXPORT_CONTENT_WIDTH;
  const active = event.startTimestamp <= now && event.endTimestamp >= now;
  const eventImage = scheduleExportImage(event);
  fillRounded(ctx, x, y, width, MOBILE_EVENT_HEIGHT, 10, "#ffffff", "#d7dce5");
  const textX = x + 22;
  const imageX = x + width - 182;
  if (eventImage) {
    drawImageFit(
      ctx,
      images.get(eventImage),
      imageX,
      y + 16,
      160,
      122,
      "contain",
    );
  }
  const textRight = imageX - 18;
  const badgeWidth = drawBadge(
    ctx,
    scheduleTypeLabel(event.type),
    textX,
    y + 12,
    "#eef2f7",
    "#18202b",
    textRight - textX,
  );
  if (active) {
    drawBadge(
      ctx,
      "进行中",
      textX + badgeWidth + 10,
      y + 12,
      "#fee2e2",
      "#b42318",
      textRight - textX - badgeWidth - 10,
    );
  }
  ctx.font = exportFont(25, 800);
  ctx.fillStyle = "#18202b";
  drawClippedText(ctx, event.name, textX, y + 70, textRight - textX);
  ctx.fillStyle = "#5f6b7a";
  drawExportTimestamp(ctx, event.start, textX, y + 106, 24, 18);
  drawExportTimestamp(ctx, event.end, textX, y + 138, 24, 18, "至");
  return MOBILE_EVENT_HEIGHT;
}

function mobileRaceHeight(race: ScheduleItem) {
  const detailHeight = (race.details || []).reduce(
    (height, detail) => height + (detail.conditionRates ? 90 : 66),
    0,
  );
  const milestones = race.milestones || [];
  const milestoneHeight = milestones.length
    ? 38 + Math.ceil(milestones.length / 2) * 48
    : 0;
  return 122 + detailHeight + milestoneHeight;
}

function drawMobileRace(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  race: ScheduleItem,
  y: number,
  now: number,
) {
  const x = MOBILE_EXPORT_PADDING;
  const width = MOBILE_EXPORT_CONTENT_WIDTH;
  const height = mobileRaceHeight(race);
  const active = race.startTimestamp <= now && race.endTimestamp >= now;
  fillRounded(ctx, x, y, width, height, 10, "#ffffff", "#d7dce5");
  drawImageFit(
    ctx,
    race.image ? images.get(race.image) : undefined,
    x + 20,
    y + 18,
    90,
    72,
    "contain",
  );
  const textX = x + 130;
  ctx.font = exportFont(27, 900);
  ctx.fillStyle = "#18202b";
  const visibleName = drawClippedText(
    ctx,
    race.name,
    textX,
    y + 42,
    MOBILE_EXPORT_RIGHT - textX - 18,
  );
  if (active) {
    const badgeX = textX + ctx.measureText(visibleName).width + 14;
    drawBadge(
      ctx,
      "进行中",
      badgeX,
      y + 16,
      "#fee2e2",
      "#b42318",
      MOBILE_EXPORT_RIGHT - badgeX - 18,
    );
  }
  ctx.fillStyle = "#5f6b7a";
  drawExportTimeRange(ctx, race.start, race.end, textX, y + 78, 24, 18);
  let cursorY = y + 104;
  (race.details || []).forEach((detail) => {
    const detailHeight = detail.conditionRates ? 90 : 66;
    fillRounded(
      ctx,
      x + 18,
      cursorY,
      width - 36,
      detailHeight - 8,
      7,
      "#f8fafc",
      "#e5e9ef",
    );
    const season = seasonIcon(detail.seasonValue);
    const weather = weatherIcon(detail.weatherValue);
    if (season) drawImageFit(ctx, images.get(season), x + 30, cursorY + 15, 48, 24);
    if (weather) drawImageFit(ctx, images.get(weather), x + 82, cursorY + 12, 34, 28);
    ctx.font = exportFont(18, 700);
    ctx.fillStyle = "#18202b";
    drawTextLines(
      ctx,
      raceDetailText(detail),
      x + 132,
      cursorY + 25,
      width - 166,
      22,
      detail.conditionRates ? 3 : 2,
    );
    cursorY += detailHeight;
  });
  const milestones = race.milestones || [];
  if (milestones.length) {
    ctx.font = exportFont(19, 900);
    ctx.fillStyle = "#18202b";
    ctx.fillText("时间节点", x + 20, cursorY + 26);
    cursorY += 38;
    const columnGap = 12;
    const columnWidth = (width - 36 - columnGap) / 2;
    milestones.forEach((milestone, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const milestoneX = x + 18 + column * (columnWidth + columnGap);
      const milestoneY = cursorY + row * 48;
      fillRounded(ctx, milestoneX, milestoneY, columnWidth, 40, 7, "#f8fafc", "#e5e9ef");
      ctx.font = exportFont(16, 800);
      ctx.fillStyle = "#18202b";
      const labelWidth = Math.min(126, ctx.measureText(milestone.label).width + 20);
      drawClippedText(
        ctx,
        milestone.label,
        milestoneX + 10,
        milestoneY + 26,
        labelWidth - 10,
      );
      ctx.fillStyle = "#5f6b7a";
      drawExportTimeRange(
        ctx,
        milestone.start,
        milestone.end,
        milestoneX + labelWidth,
        milestoneY + 27,
        16,
        12,
      );
    });
  }
  return height;
}

type MobilePageEntry<T> = {
  month: string;
  item: T;
  height: number;
};

function balanceMobilePages<T>(entries: MobilePageEntry<T>[], gap: number) {
  const count = entries.length;
  if (!count) return [];
  const capacity = MOBILE_EXPORT_BOTTOM - MOBILE_EXPORT_START_Y;
  const costs = Array.from({ length: count }, () =>
    Array<number>(count).fill(Number.POSITIVE_INFINITY),
  );
  for (let start = 0; start < count; start += 1) {
    let cost = 0;
    let previousMonth = "";
    for (let end = start; end < count; end += 1) {
      const entry = entries[end];
      if (end === start || entry.month !== previousMonth) cost += 62;
      cost += entry.height + gap;
      costs[start][end] = cost - gap;
      previousMonth = entry.month;
      if (costs[start][end] > capacity) break;
    }
  }

  const minimumPages = Array<number>(count + 1).fill(Number.POSITIVE_INFINITY);
  minimumPages[count] = 0;
  for (let start = count - 1; start >= 0; start -= 1) {
    for (let end = start; end < count; end += 1) {
      if (costs[start][end] > capacity) break;
      minimumPages[start] = Math.min(
        minimumPages[start],
        1 + minimumPages[end + 1],
      );
    }
  }
  const pageCount = minimumPages[0];
  const scores = Array.from({ length: pageCount + 1 }, () =>
    Array<number>(count + 1).fill(Number.POSITIVE_INFINITY),
  );
  const choices = Array.from({ length: pageCount + 1 }, () =>
    Array<number>(count + 1).fill(-1),
  );
  scores[0][count] = 0;
  for (let remainingPages = 1; remainingPages <= pageCount; remainingPages += 1) {
    for (let start = count - 1; start >= 0; start -= 1) {
      for (let end = start; end < count; end += 1) {
        const cost = costs[start][end];
        if (cost > capacity) break;
        const tailScore = scores[remainingPages - 1][end + 1];
        if (!Number.isFinite(tailScore)) continue;
        const unused = capacity - cost;
        const score = unused * unused + tailScore;
        if (score < scores[remainingPages][start]) {
          scores[remainingPages][start] = score;
          choices[remainingPages][start] = end;
        }
      }
    }
  }

  const pages: MobilePageEntry<T>[][] = [];
  let start = 0;
  let remainingPages = pageCount;
  while (start < count && remainingPages > 0) {
    const end = choices[remainingPages][start];
    if (end < start) break;
    pages.push(entries.slice(start, end + 1));
    start = end + 1;
    remainingPages -= 1;
  }
  return pages;
}

async function exportIntelMobileImages(
  source: ExportImageSource,
  section: ExportImageSection,
) {
  const images = await loadExportImages(collectExportImages(source, section));
  const pages: MobileExportPage[] = [];
  let page = createMobileExportPage(section, source.generatedAt);
  pages.push(page);
  let y = MOBILE_EXPORT_START_Y;
  const newPage = () => {
    page = createMobileExportPage(section, source.generatedAt);
    pages.push(page);
    y = MOBILE_EXPORT_START_Y;
  };
  const startMonth = (month: string, minimumItemHeight: number) => {
    if (y + 62 + minimumItemHeight > MOBILE_EXPORT_BOTTOM && y > MOBILE_EXPORT_START_Y) {
      newPage();
    }
    y += drawMobileMonthHeader(page.ctx, month, y);
    page.contentBottom = Math.max(page.contentBottom, y);
  };
  const continueMonth = (month: string) => {
    newPage();
    y += drawMobileMonthHeader(page.ctx, month, y);
    page.contentBottom = Math.max(page.contentBottom, y);
  };

  if (section === "gacha") {
    gachaExportGroups(source.pools).forEach((group) => {
      const firstHeight = group.items[0] ? mobileGachaHeight(group.items[0]) : 0;
      startMonth(group.month, firstHeight);
      let columnY = [y, y];
      group.items.forEach((pool) => {
        const height = mobileGachaHeight(pool);
        let column = columnY[0] <= columnY[1] ? 0 : 1;
        if (columnY[column] + height > MOBILE_EXPORT_BOTTOM) {
          const otherColumn = column === 0 ? 1 : 0;
          if (columnY[otherColumn] + height <= MOBILE_EXPORT_BOTTOM) {
            column = otherColumn;
          } else {
            continueMonth(group.month);
            columnY = [y, y];
            column = 0;
          }
        }
        const x =
          MOBILE_EXPORT_PADDING +
          column * (MOBILE_GACHA_TILE_WIDTH + MOBILE_GACHA_GAP);
        drawMobileGacha(page.ctx, images, pool, x, columnY[column], source.now);
        columnY[column] += height + 16;
        page.contentBottom = Math.max(page.contentBottom, columnY[column] - 16);
      });
      y = Math.max(...columnY) + 18;
    });
  } else if (section === "events") {
    const balancedPages = balanceMobilePages(
      source.events.map((event) => ({
        month: event.start.slice(0, 7),
        item: event,
        height: MOBILE_EVENT_HEIGHT,
      })),
      12,
    );
    balancedPages.forEach((entries, pageIndex) => {
      if (pageIndex > 0) newPage();
      let visibleMonth = "";
      entries.forEach((entry) => {
        if (entry.month !== visibleMonth) {
          y += drawMobileMonthHeader(page.ctx, entry.month, y);
          page.contentBottom = Math.max(page.contentBottom, y);
          visibleMonth = entry.month;
        }
        y += drawMobileEvent(page.ctx, images, entry.item, y, source.now) + 12;
        page.contentBottom = Math.max(page.contentBottom, y - 12);
      });
    });
  } else {
    const raceEntries = source.races.map((race) => ({
        month: race.start.slice(0, 7),
        item: race,
        height: mobileRaceHeight(race),
      }));
    const racePages =
      raceEntries.length > 3
        ? [raceEntries.slice(0, 3), raceEntries.slice(3)]
        : [raceEntries];
    racePages.forEach((entries, pageIndex) => {
      if (pageIndex > 0) newPage();
      let visibleMonth = "";
      entries.forEach((entry) => {
        if (entry.month !== visibleMonth) {
          y += drawMobileMonthHeader(page.ctx, entry.month, y);
          page.contentBottom = Math.max(page.contentBottom, y);
          visibleMonth = entry.month;
        }
        y += drawMobileRace(page.ctx, images, entry.item, y, source.now) + 16;
        page.contentBottom = Math.max(page.contentBottom, y - 16);
      });
    });
  }

  const prefix = section === "gacha" ? "01-gacha" : section === "events" ? "02-events" : "03-races";
  return pages.map(({ canvas, contentBottom }, index) => {
    const outputHeight = Math.max(
      MOBILE_EXPORT_MIN_HEIGHT,
      Math.min(
        section === "races"
          ? MOBILE_EXPORT_CANVAS_HEIGHT
          : MOBILE_EXPORT_MAX_HEIGHT,
        Math.ceil(contentBottom + 48),
      ),
    );
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = MOBILE_EXPORT_WIDTH;
    outputCanvas.height = outputHeight;
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) throw new Error("Canvas is not available");
    outputCtx.drawImage(
      canvas,
      0,
      0,
      MOBILE_EXPORT_WIDTH,
      outputHeight,
      0,
      0,
      MOBILE_EXPORT_WIDTH,
      outputHeight,
    );
    return {
      filename: `${prefix}-${String(index + 1).padStart(2, "0")}.png`,
      dataUrl: outputCanvas.toDataURL("image/png"),
    };
  });
}

function UpPreview({ pool }: { pool: GachaPool }) {
  const cards = poolPreviewCards(pool);
  const visibleCount = 7;
  return (
    <div class="intelUpPreview">
      {cards.slice(0, visibleCount).map((card) => (
        <div class="intelUpMini" title={card.name} key={card.id}>
          <CardImage card={card} />
        </div>
      ))}
      {!pool.cutoffCardId && cards.length > visibleCount && (
        <em>+{cards.length - visibleCount}</em>
      )}
    </div>
  );
}

type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
  start: number;
  end: number;
};

function calendarDay(
  month: string,
  day: number,
  inMonth: boolean,
): CalendarDay {
  return {
    date: dayLabel(month, day),
    day,
    inMonth,
    start: dayStart(month, day),
    end: dayEnd(month, day),
  };
}

function weekRows(month: string): CalendarDay[][] {
  const offset = weekdayOffset(month);
  const dayCount = daysInMonth(month);
  const prevMonth = addMonths(month, -1);
  const nextMonthValue = addMonths(month, 1);
  const prevDayCount = daysInMonth(prevMonth);
  const cells: CalendarDay[] = [];
  for (let day = prevDayCount - offset + 1; day <= prevDayCount; day += 1) {
    cells.push(calendarDay(prevMonth, day, false));
  }
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(calendarDay(month, day, true));
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day += 1) {
    cells.push(calendarDay(nextMonthValue, day, false));
  }

  const rows = [];
  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

function poolsForWeek(days: CalendarDay[], pools: GachaPool[]) {
  const weekStart = days[0].start;
  const weekEnd = days[days.length - 1].end;
  return pools.filter(
    (pool) => pool.startTimestamp < weekEnd && pool.endTimestamp >= weekStart,
  );
}

type WeekPoolSegment = {
  pool: GachaPool;
  columnStart: number;
  columnEnd: number;
  startInset: number;
  endInset: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function weekPoolSegment(
  days: CalendarDay[],
  pool: GachaPool,
): WeekPoolSegment | null {
  const visibleStart = Math.max(pool.startTimestamp, days[0].start);
  const visibleEnd = Math.min(pool.endTimestamp, days[days.length - 1].end);
  const startIndex = days.findIndex(
    (day) => visibleStart < day.end && visibleEnd >= day.start,
  );
  let endIndex = -1;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (visibleStart < day.end && visibleEnd >= day.start) {
      endIndex = index;
      break;
    }
  }
  if (startIndex < 0 || endIndex < 0) return null;
  const spanDays = endIndex - startIndex + 1;
  return {
    pool,
    columnStart: startIndex + 1,
    columnEnd: endIndex + 2,
    startInset:
      (clamp01((visibleStart - days[startIndex].start) / 86400) /
        spanDays) *
      100,
    endInset:
      (clamp01((days[endIndex].end - visibleEnd) / 86400) / spanDays) *
      100,
  };
}

function packWeekTracks(days: CalendarDay[], pools: GachaPool[]) {
  const segments = pools
    .map((pool) => weekPoolSegment(days, pool))
    .filter((segment): segment is WeekPoolSegment => segment != null)
    .sort(
      (a, b) =>
        a.columnStart - b.columnStart ||
        a.columnEnd - b.columnEnd ||
        a.pool.startTimestamp - b.pool.startTimestamp,
    );
  const tracks: WeekPoolSegment[][] = [];
  const trackEnds: number[] = [];
  segments.forEach((segment) => {
    const trackIndex = trackEnds.findIndex((end) => end <= segment.columnStart);
    if (trackIndex === -1) {
      tracks.push([segment]);
      trackEnds.push(segment.columnEnd);
    } else {
      tracks[trackIndex].push(segment);
      trackEnds[trackIndex] = segment.columnEnd;
    }
  });
  return tracks;
}

function WeekPoolCard({
  segment,
  selected,
  now,
  onSelect,
}: {
  segment: WeekPoolSegment;
  selected: boolean;
  now: number;
  onSelect: (pool: GachaPool) => void;
}) {
  const pool = segment.pool;
  const active = pool.startTimestamp <= now && pool.endTimestamp >= now;
  const upcoming = pool.startTimestamp > now;
  const cover = poolCover(pool);
  const compact = segment.columnEnd - segment.columnStart <= 2;

  return (
    <button
      type="button"
      class={`intelWeekPool ${poolTypeClass(pool)} ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${active ? "active" : ""} ${upcoming ? "upcoming" : ""}`}
      onClick={() => onSelect(pool)}
      style={{
        gridColumn: `${segment.columnStart} / ${segment.columnEnd}`,
        "--segment-start-inset": `${segment.startInset}%`,
        "--segment-end-inset": `${segment.endInset}%`,
      }}
    >
      {cover && (
        <div class="intelCoverBlock">
          <img
            class="intelPoolCover"
            src={assetUrl(cover)}
            alt={`${pool.type}封面`}
            loading="lazy"
          />
          <PoolTimeRange pool={pool} />
        </div>
      )}
      {active && <span class="intelPoolStatus">进行中</span>}
      <FreeDrawBadges pool={pool} />
      {!compact && (
        <div class="intelPoolBody">
          <UpPreview pool={pool} />
        </div>
      )}
    </button>
  );
}

function MonthCalendar({
  month,
  pools,
  selectedPool,
  now,
  onSelect,
}: {
  month: string;
  pools: GachaPool[];
  selectedPool?: GachaPool;
  now: number;
  onSelect: (pool: GachaPool) => void;
}) {
  const rows = weekRows(month);
  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <div class="intelMonthCalendar">
      <div class="intelWeekHeader" aria-hidden="true">
        {weekdays.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div class="intelCalendarWeeks">
        {rows.map((days, rowIndex) => {
          const weekPools = poolsForWeek(days, pools);
          const tracks = packWeekTracks(days, weekPools);
          return (
            <div class="intelCalendarWeek" key={`${month}-${rowIndex}`}>
              <div class="intelWeekDays">
                {days.map((day, index) => {
                  const today = day.start <= now && now < day.end;
                  return (
                    <div
                      class={`intelDayCell ${!day.inMonth ? "outside" : ""} ${today ? "today" : ""}`}
                      key={`${month}-${rowIndex}-${index}`}
                    >
                      <span>{day.day}</span>
                    </div>
                  );
                })}
              </div>
              <div class="intelWeekPools">
                {tracks.map((track, trackIndex) => (
                  <div
                    class="intelWeekTrack"
                    key={`${month}-${rowIndex}-${trackIndex}`}
                  >
                    {track.map((segment) => (
                      <WeekPoolCard
                        segment={segment}
                        selected={
                          selectedPool != null &&
                          poolKey(selectedPool) === poolKey(segment.pool)
                        }
                        now={now}
                        onSelect={onSelect}
                        key={`${month}-${rowIndex}-${trackIndex}-${poolKey(segment.pool)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailCard({ card }: { card: GachaCard }) {
  return (
    <div class="intelDetailCard">
      <div class="intelDetailImage">
        <CardImage card={card} />
      </div>
      <div>
        <strong>{card.characterName}</strong>
        {card.title && <span>{card.title}</span>}
        <small>{card.type === "support" ? "支援卡" : "角色"}</small>
      </div>
    </div>
  );
}

function GachaDetail({
  pool,
  onClose,
}: {
  pool: GachaPool;
  onClose: () => void;
}) {
  return (
    <div
      class="intelModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="卡池详情"
      onClick={onClose}
    >
      <section
        class="intelDetailPanel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          class="intelModalClose"
          onClick={onClose}
          title="关闭"
        >
          ×
        </button>
        <div class="intelDetailHeader">
          <div>
            <span>{pool.type}</span>
            <h2>{poolSummary(pool, 6)}</h2>
            <PoolTimeRange pool={pool} />
          </div>
        </div>
        <FreeDrawSchedule pool={pool} />
        {pool.bannerImage && (
          <img
            src={assetUrl(pool.bannerImage)}
            alt={`${pool.type}封面`}
            loading="lazy"
            class="intelDetailBanner"
          />
        )}
        <div class="intelDetailGrid">
          {pool.cards.map((card) => (
            <DetailCard card={card} key={`${pool.id}-${card.id}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailRewardIcon({
  reward,
  label,
  showAmount = true,
}: {
  reward?: ScheduleReward | null;
  label?: string;
  showAmount?: boolean;
}) {
  if (!reward) return null;
  const title = label || reward.name || "奖励";
  if (reward.countOnly) {
    return (
      <span class="intelDetailRewardMore" title={title}>
        {reward.label || title}
      </span>
    );
  }
  return (
    <span class="intelDetailRewardIcon" title={title}>
      {reward.image ? (
        <img src={assetUrl(reward.image)} alt={title} loading="lazy" />
      ) : (
        <span>{(reward.name || title).slice(0, 2)}</span>
      )}
      {showAmount && detailAmountLabel(reward) && (
        <em>{detailAmountLabel(reward)}</em>
      )}
    </span>
  );
}

function DetailRewardToken({ reward }: { reward: ScheduleReward }) {
  const amount = rewardInlineAmountLabel(reward);
  if (reward.countOnly) {
    return <DetailRewardIcon reward={reward} showAmount={false} />;
  }
  return (
    <span
      class="intelDetailRewardToken"
      title={reward.name || reward.label || "奖励"}
    >
      <DetailRewardIcon
        reward={reward}
        label={reward.name || reward.label}
        showAmount={false}
      />
      <span>
        <strong>{reward.name || reward.label || "奖励"}</strong>
        {amount && <small>{amount}</small>}
      </span>
    </span>
  );
}

function ScheduleDetail({
  item,
  title,
  exchangeDetails,
  exchangeLoading,
  exchangeError,
  onClose,
}: {
  item: ScheduleItem;
  title: string;
  exchangeDetails?: ScheduleItem["exchangeDetails"];
  exchangeLoading?: boolean;
  exchangeError?: string;
  onClose: () => void;
}) {
  const details = exchangeDetails || item.exchangeDetails || [];
  const hasExchangeDetails = Boolean(details.length);
  const detailRewardDrops = details.map((detail) => ({
    ...detail.reward,
    source: "可兑换",
    label: detail.reward.name || "兑换奖励",
  }));
  const sourceDrops = item.drops?.length ? item.drops : detailRewardDrops;
  const sourceGroups = rewardSourceGroups(sourceDrops);
  const uniqueSourceNames = new Set(sourceGroups.map((group) => group.source));
  const uniqueRewardKeys = new Set(
    sourceDrops.map(
      (drop) => `${drop.rewardType || 0}-${drop.rewardValue || 0}-${drop.image || drop.name || drop.label || ""}`,
    ),
  );
  const showMergedGroup =
    uniqueSourceNames.size > 1 &&
    uniqueRewardKeys.size > 1 &&
    sourceGroups.some((group) => group.source !== "合计");
  const shouldShowRewardGroups = !(
    item.exchangeDetailPath || item.exchangeDetails?.length
  );
  const rewardGroups = shouldShowRewardGroups && sourceDrops.length
    ? [
        ...(showMergedGroup
          ? [{ source: "合计", drops: mergedRewardDrops(sourceDrops) }]
          : []),
        ...sourceGroups,
      ]
    : [];
  const milestones = item.milestones || [];
  return (
    <div
      class="intelModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}详情`}
      onClick={onClose}
    >
      <section
        class="intelDetailPanel intelScheduleDetailPanel"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          class="intelModalClose"
          onClick={onClose}
          title="关闭"
        >
          ×
        </button>
        <div class="intelDetailHeader">
          <div>
            <span>{scheduleTypeLabel(item.type)}</span>
            <h2>{item.name}</h2>
            <p>{dateLabel(item.start, item.end)}</p>
          </div>
        </div>
        {item.image && (
          <img
            src={assetUrl(item.image)}
            alt=""
            loading="lazy"
            class={`intelDetailBanner ${scheduleImageClass(item.image)}`}
          />
        )}
        {rewardGroups.length ? (
          <section class="intelScheduleDetailSection">
            <h3>奖励组成</h3>
            <div class="intelScheduleRewardGroups">
              {rewardGroups.map((group) => (
                <div
                  class={`intelScheduleRewardGroup ${group.source === "合计" ? "merged" : ""}`}
                  key={group.source}
                >
                  <strong>{group.source}</strong>
                  <div>
                    {group.drops.map((drop, index) => (
                      <DetailRewardToken
                        reward={drop}
                        key={`${drop.image}-${drop.label}-${index}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {milestones.length ? (
          <section class="intelScheduleDetailSection">
            <h3>{item.type === "剧情活动时间" ? "活动流程" : "大赛流程"}</h3>
            <div class="intelRaceMilestones">
              {milestones.map((milestone, index) => (
                <div class="intelRaceMilestone" key={`${milestone.label}-${index}`}>
                  <strong>{milestone.label}</strong>
                  <time>{dateLabel(milestone.start, milestone.end)}</time>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {title === "大赛" && item.details?.length ? (
          <section class="intelScheduleDetailSection">
            <h3>赛事条件</h3>
            <RaceDetails details={item.details} />
          </section>
        ) : null}
        {(item.exchangeDetailPath || item.exchangeDetails?.length) && (
          <section class="intelScheduleDetailSection">
            <h3>兑换明细</h3>
            {exchangeLoading && (
              <div class="intelDetailNotice">正在加载兑换明细</div>
            )}
            {exchangeError && (
              <div class="intelDetailNotice">兑换明细加载失败</div>
            )}
            {hasExchangeDetails && (
              <div class="intelExchangeDetailList">
                {details.map((detail) => (
                  <div class="intelExchangeDetailItem" key={detail.id}>
                    <div class="intelExchangeRewardSide">
                      <DetailRewardIcon
                        reward={detail.reward}
                        showAmount={false}
                      />
                      <div>
                        <strong>{detail.reward.name || "兑换奖励"}</strong>
                        <span>{detailAmountLabel(detail.reward)}</span>
                      </div>
                    </div>
                    <div class="intelExchangePaySide">
                      <span>消耗</span>
                      <DetailRewardIcon
                        reward={detail.pay}
                        showAmount={false}
                      />
                      <strong>{detailAmountLabel(detail.pay)}</strong>
                    </div>
                    <div class="intelExchangeLimitSide">
                      <span>限购</span>
                      <strong>
                        {detail.limit ? `${detail.limit} 次` : "不限"}
                      </strong>
                      {detail.totalRewardAmount ? (
                        <small>合计 {detail.totalRewardAmount}</small>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div class="intelViewToggle" role="group" aria-label="视图切换">
      <button
        type="button"
        class={value === "list" ? "selected" : ""}
        onClick={() => onChange("list")}
      >
        列表
      </button>
      <button
        type="button"
        class={value === "calendar" ? "selected" : ""}
        onClick={() => onChange("calendar")}
      >
        日历
      </button>
    </div>
  );
}

function GachaFilters({
  kind,
  query,
  onKindChange,
  onQueryChange,
}: {
  kind: GachaKindFilter;
  query: string;
  onKindChange: (value: GachaKindFilter) => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div class="intelFilterBar">
      <select
        value={kind}
        onChange={(event) =>
          onKindChange(event.currentTarget.value as GachaKindFilter)
        }
        aria-label="卡池类型"
      >
        <option value="all">全部卡池</option>
        <option value="character">角色</option>
        <option value="support">支援卡</option>
      </select>
      <input
        value={query}
        onInput={(event) => onQueryChange(event.currentTarget.value)}
        type="search"
        placeholder="搜索卡池 / UP"
        aria-label="搜索卡池"
      />
    </div>
  );
}

function EventFilters({
  type,
  query,
  types,
  onTypeChange,
  onQueryChange,
}: {
  type: string;
  query: string;
  types: string[];
  onTypeChange: (value: string) => void;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div class="intelFilterBar">
      <select
        value={type}
        onChange={(event) => onTypeChange(event.currentTarget.value)}
        aria-label="活动类型"
      >
        <option value="all">全部活动</option>
        {types.map((type) => (
          <option value={type} key={type}>
            {scheduleTypeLabel(type)}
          </option>
        ))}
      </select>
      <input
        value={query}
        onInput={(event) => onQueryChange(event.currentTarget.value)}
        type="search"
        placeholder="搜索活动"
        aria-label="搜索活动"
      />
    </div>
  );
}

function ScheduleSearch({
  query,
  placeholder,
  label,
  onQueryChange,
}: {
  query: string;
  placeholder: string;
  label: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div class="intelFilterBar">
      <input
        value={query}
        onInput={(event) => onQueryChange(event.currentTarget.value)}
        type="search"
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}

function GachaList({
  pools,
  now,
  onSelect,
}: {
  pools: GachaPool[];
  now: number;
  onSelect: (pool: GachaPool) => void;
}) {
  return (
    <div class="intelGachaList">
      {pools.map((pool) => {
        const active = pool.startTimestamp <= now && pool.endTimestamp >= now;
        const upcoming = pool.startTimestamp > now;
        const cover = poolCover(pool);
        return (
          <button
            type="button"
            class={`intelGachaListItem ${poolTypeClass(pool)} ${active ? "active" : ""} ${upcoming ? "upcoming" : ""}`}
            aria-label={`${pool.start} 至 ${pool.end} ${poolSummary(pool, 8)}`}
            onClick={() => onSelect(pool)}
            key={poolKey(pool)}
          >
            {cover && (
              <img
                src={assetUrl(cover)}
                alt={`${pool.type}封面`}
                loading="lazy"
              />
            )}
            <div class="intelGachaListMeta">
              <strong>{pool.name || pool.type}</strong>
              <span>{poolSummary(pool, 12)}</span>
              <PoolTimeRange pool={pool} />
              <FreeDrawBadges pool={pool} inline />
            </div>
            <UpPreview pool={pool} />
            {active && <span class="intelPoolStatus">进行中</span>}
          </button>
        );
      })}
    </div>
  );
}

function eventMonthGroups(events: ScheduleItem[]) {
  return events.reduce<Record<string, ScheduleItem[]>>((groups, event) => {
    const month = monthLabel(event.start);
    groups[month] = groups[month] || [];
    groups[month].push(event);
    return groups;
  }, {});
}

function DropIcons({ drops }: { drops?: ScheduleItem["drops"] }) {
  const mergedDrops = mergedRewardDrops(drops);
  if (!mergedDrops.length) return null;
  return (
    <div class="intelDropIcons">
      {mergedDrops.map((drop, index) =>
        drop.image ? (
          <span
            class="intelDropIcon"
            title={drop.label || "掉落"}
            key={`${drop.image}-${index}`}
          >
            <img
              src={assetUrl(drop.image)}
              alt={drop.label || "掉落"}
              loading="lazy"
            />
            {rewardAmountLabel(drop) && <em>{rewardAmountLabel(drop)}</em>}
          </span>
        ) : (
          <span
            class="intelDropCount"
            title={drop.label || "奖励"}
            key={`${drop.label}-${index}`}
          >
            {drop.label || "奖励"}
          </span>
        ),
      )}
    </div>
  );
}

function EventsSchedule({
  events,
  now,
  onSelect,
}: {
  events: ScheduleItem[];
  now: number;
  onSelect?: (event: ScheduleItem) => void;
}) {
  const groups = eventMonthGroups(events);
  const months = Object.keys(groups).sort();
  return (
    <div class="intelEventMonths">
      {months.map((month) => (
        <section class="intelEventMonth" key={month}>
          <h3>{month}</h3>
          <div class="intelEventList">
            {groups[month].map((event) => {
              const active =
                event.startTimestamp <= now && event.endTimestamp >= now;
              return (
                <article
                  class={`intelEventItem ${event.image ? "hasImage" : ""} ${scheduleImageClass(event.image)} ${scheduleTypeClass(event.type)} ${active ? "active" : ""}`}
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onClick={() => onSelect?.(event)}
                  onKeyDown={
                    onSelect
                      ? scheduleKeyHandler(() => onSelect(event))
                      : undefined
                  }
                  key={event.id}
                >
                  {event.image && (
                    <img
                      class={scheduleImageClass(event.image)}
                      src={assetUrl(event.image)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <strong>{event.name}</strong>
                  <time>{scheduleDateLabel(event)}</time>
                  <DropIcons drops={event.drops} />
                  {active && <span>进行中</span>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventCalendar({
  events,
  now,
  month,
  onSelect,
}: {
  events: ScheduleItem[];
  now: number;
  month?: string;
  onSelect?: (event: ScheduleItem) => void;
}) {
  const months = month
    ? [month]
    : events.length
      ? monthsBetween(events[0].start, events[events.length - 1].end)
      : [];
  return (
    <div class="intelEventCalendarMonths">
      {months.map((month) => {
        const days = daysInMonth(month);
        const monthStartTime = monthStart(month);
        const monthEndTime = monthEnd(month);
        const monthEvents = events.filter(
          (event) =>
            event.startTimestamp < monthEndTime &&
            event.endTimestamp >= monthStartTime,
        );
        const tickStep = days > 30 ? 5 : 4;

        return (
          <section class="intelEventTimelineMonth" key={month}>
            <div class="intelEventTimelineHeader">
              <h3>{month}</h3>
              <div
                class="intelEventTicks"
                style={{
                  gridTemplateColumns: `repeat(${days}, minmax(14px, 1fr))`,
                }}
              >
                {Array.from({ length: days }, (_, index) => index + 1).map(
                  (day) => (
                    <span
                      class={day === 1 || day % tickStep === 0 ? "marked" : ""}
                      key={day}
                    >
                      {day === 1 || day % tickStep === 0 ? day : ""}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div class="intelEventTimelineRows">
              {monthEvents.map((event) => {
                const active =
                  event.startTimestamp <= now && event.endTimestamp >= now;
                const startDay = Math.max(
                  1,
                  Math.floor(
                    (Math.max(event.startTimestamp, monthStartTime) -
                      monthStartTime) /
                      86400,
                  ) + 1,
                );
                const endDay = Math.min(
                  days,
                  Math.ceil(
                    (Math.min(event.endTimestamp, monthEndTime) -
                      monthStartTime) /
                      86400,
                  ),
                );
                return (
                  <article
                    class={`intelEventTimelineItem ${event.image ? "hasImage" : ""} ${scheduleImageClass(event.image)} ${scheduleTypeClass(event.type)} ${active ? "active" : ""}`}
                    role={onSelect ? "button" : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    onClick={() => onSelect?.(event)}
                    onKeyDown={
                      onSelect
                        ? scheduleKeyHandler(() => onSelect(event))
                        : undefined
                    }
                    key={`${month}-${event.id}`}
                  >
                    <div class="intelEventTimelineLabel">
                      {event.image && (
                        <img
                          class={scheduleImageClass(event.image)}
                          src={assetUrl(event.image)}
                          alt=""
                          loading="lazy"
                        />
                      )}
                      <span>{scheduleTypeLabel(event.type)}</span>
                      <strong>{event.name}</strong>
                    </div>
                    <div
                      class="intelEventTimelineGrid"
                      style={{
                        gridTemplateColumns: `repeat(${days}, minmax(14px, 1fr))`,
                        "--intel-days": days,
                      }}
                    >
                      <div
                        class="intelEventTimelineBar"
                        style={{ gridColumn: `${startDay} / ${endDay + 1}` }}
                      >
                        <time>
                          {dateLabelLines(event.start, event.end).map(
                            (line) => (
                              <span key={line}>{line}</span>
                            ),
                          )}
                        </time>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RaceDetails({ details }: { details?: ScheduleItem["details"] }) {
  if (!details?.length) return null;
  return (
    <div class="intelRaceDetails">
      {details.map((detail, index) => {
        const weather = weatherIcon(detail.weatherValue);
        const season = seasonIcon(detail.seasonValue);
        const weatherRates = rateText(detail.conditionRates?.weather);
        const conditionRates = rateText(detail.conditionRates?.condition);
        return (
          <div class="intelRaceDetail" key={`${detail.label}-${index}`}>
            {detail.label && <span>{detail.label}</span>}
            <strong>
              {[
                detail.track,
                detail.distance ? `${detail.distance}m` : "",
                detail.ground,
              ]
                .filter(Boolean)
                .join(" ")}
            </strong>
            <div class="intelRaceMetaLine">
              {season && (
                <img
                  src={assetUrl(season)}
                  alt={detail.season || "季节"}
                  title={detail.season}
                />
              )}
              {weather && (
                <img
                  src={assetUrl(weather)}
                  alt={detail.weather || "天气"}
                  title={detail.weather}
                />
              )}
              <small>
                {[detail.turn, detail.inout, detail.weather, detail.condition]
                  .filter(Boolean)
                  .join(" / ")}
              </small>
            </div>
            {(weatherRates || conditionRates) && (
              <em>
                {[
                  weatherRates && `天气 ${weatherRates}`,
                  conditionRates && `场地 ${conditionRates}`,
                ]
                  .filter(Boolean)
                  .join("；")}
              </em>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RaceSchedule({
  races,
  now,
  onSelect,
}: {
  races: ScheduleItem[];
  now: number;
  onSelect: (race: ScheduleItem) => void;
}) {
  return (
    <div class="intelRaceList">
      {races.map((race) => {
        const active = race.startTimestamp <= now && race.endTimestamp >= now;
        return (
          <article
            class={`intelRaceItem ${active ? "active" : ""}`}
            key={race.id}
            onClick={() => onSelect(race)}
          >
            {race.image && (
              <img src={assetUrl(race.image)} alt="" loading="lazy" />
            )}
            <div>
              <strong>{race.name}</strong>
              <time>{dateLabel(race.start, race.end)}</time>
              <RaceDetails details={race.details} />
            </div>
            {active && <span>进行中</span>}
          </article>
        );
      })}
    </div>
  );
}

export function IntelDashboard() {
  const now = currentTimestamp();
  const [activeTab, setActiveTab] = useState<IntelTab>("gacha");
  const [gachaView, setGachaView] = useState<ViewMode>("list");
  const [eventView, setEventView] = useState<ViewMode>("list");
  const [exchangeView, setExchangeView] = useState<ViewMode>("list");
  const [gachaKindFilter, setGachaKindFilter] =
    useState<GachaKindFilter>("all");
  const [gachaQuery, setGachaQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventQuery, setEventQuery] = useState("");
  const [exchangeQuery, setExchangeQuery] = useState("");
  const pools = useMemo(
    () =>
      data.gachaPools
        .filter((pool) => pool.endTimestamp >= now)
        .sort((a, b) => a.startTimestamp - b.startTimestamp || a.id - b.id),
    [now],
  );
  const events = useMemo(
    () =>
      (data.events || [])
        .filter((event) => event.endTimestamp >= now)
        .sort(
          (a, b) =>
            a.startTimestamp - b.startTimestamp ||
            a.endTimestamp - b.endTimestamp,
        ),
    [now],
  );
  const races = useMemo(
    () =>
      (data.races || [])
        .filter((race) => race.endTimestamp >= now)
        .sort(
          (a, b) =>
            a.startTimestamp - b.startTimestamp ||
            a.endTimestamp - b.endTimestamp,
        ),
    [now],
  );
  const exchanges = useMemo(
    () =>
      (data.exchanges || [])
        .filter((exchange) =>
          exchange.isVoucherExchange
            ? exchange.endTimestamp >= now
            : exchange.startTimestamp >= now,
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.isVoucherExchange)) -
              Number(Boolean(a.isVoucherExchange)) ||
            a.startTimestamp - b.startTimestamp ||
            a.endTimestamp - b.endTimestamp ||
            a.name.localeCompare(b.name),
        ),
    [now],
  );
  const filteredPools = useMemo(() => {
    const query = normalizedSearch(gachaQuery);
    return pools.filter((pool) => {
      if (gachaKindFilter !== "all" && poolKind(pool) !== gachaKindFilter) {
        return false;
      }
      if (query && !poolSearchText(pool).includes(query)) return false;
      return true;
    });
  }, [pools, gachaKindFilter, gachaQuery]);
  const eventTypes = useMemo(
    () => Array.from(new Set(events.map((event) => event.type))).sort(),
    [events],
  );
  const filteredEvents = useMemo(() => {
    const query = normalizedSearch(eventQuery);
    return events.filter((event) => {
      if (eventTypeFilter !== "all" && event.type !== eventTypeFilter) {
        return false;
      }
      if (query && !eventSearchText(event).includes(query)) return false;
      return true;
    });
  }, [events, eventTypeFilter, eventQuery]);
  const filteredExchanges = useMemo(() => {
    const query = normalizedSearch(exchangeQuery);
    return exchanges.filter((exchange) => {
      if (query && !eventSearchText(exchange).includes(query)) return false;
      return true;
    });
  }, [exchanges, exchangeQuery]);
  const [selectedKey, setSelectedKey] = useState(() =>
    filteredPools[0] ? poolKey(filteredPools[0]) : "",
  );
  const [detailKey, setDetailKey] = useState("");
  const [eventDetailKey, setEventDetailKey] = useState("");
  const [raceDetailKey, setRaceDetailKey] = useState("");
  const [exchangeDetailKey, setExchangeDetailKey] = useState("");
  const [exchangeDetailCache, setExchangeDetailCache] = useState<
    Record<string, ScheduleItem["exchangeDetails"]>
  >({});
  const [exchangeDetailLoading, setExchangeDetailLoading] = useState(false);
  const [exchangeDetailError, setExchangeDetailError] = useState("");
  const selectedPool =
    filteredPools.find((pool) => poolKey(pool) === selectedKey) ??
    filteredPools[0];
  const detailPool = pools.find((pool) => poolKey(pool) === detailKey);
  const detailEvent = events.find(
    (event) => scheduleDetailKey(event) === eventDetailKey,
  );
  const detailRace = races.find(
    (race) => scheduleDetailKey(race) === raceDetailKey,
  );
  const detailExchange = exchanges.find(
    (exchange) => scheduleDetailKey(exchange) === exchangeDetailKey,
  );
  const detailExchangePath = detailExchange?.exchangeDetailPath || "";
  const cachedExchangeDetails = detailExchangePath
    ? exchangeDetailCache[detailExchangePath]
    : undefined;
  useEffect(() => {
    if (!detailExchangePath) {
      setExchangeDetailLoading(false);
      setExchangeDetailError("");
      return;
    }
    if (cachedExchangeDetails) {
      setExchangeDetailLoading(false);
      setExchangeDetailError("");
      return;
    }
    let cancelled = false;
    setExchangeDetailLoading(true);
    setExchangeDetailError("");
    loadExchangeDetails(detailExchangePath)
      .then((payload) => {
        if (cancelled) return;
        setExchangeDetailCache((cache) => ({
          ...cache,
          [detailExchangePath]: payload.exchangeDetails || [],
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setExchangeDetailError("failed");
      })
      .finally(() => {
        if (!cancelled) setExchangeDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailExchangePath, cachedExchangeDetails]);
  const months = filteredPools.length
    ? monthsBetween(
        filteredPools[0].start,
        filteredPools[filteredPools.length - 1].end,
      )
    : [];
  const eventMonths = filteredEvents.length
    ? monthsBetween(
        filteredEvents[0].start,
        filteredEvents[filteredEvents.length - 1].end,
      )
    : [];
  const exchangeMonths = filteredExchanges.length
    ? monthsBetween(
        filteredExchanges[0].start,
        filteredExchanges[filteredExchanges.length - 1].end,
      )
    : [];
  const currentMonth = timestampMonth(now);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (months.includes(currentMonth)) return currentMonth;
    return months[0] ?? currentMonth;
  });
  const [selectedEventMonth, setSelectedEventMonth] = useState(() => {
    if (eventMonths.includes(currentMonth)) return currentMonth;
    return eventMonths[0] ?? currentMonth;
  });
  const [selectedExchangeMonth, setSelectedExchangeMonth] = useState(() => {
    if (exchangeMonths.includes(currentMonth)) return currentMonth;
    return exchangeMonths[0] ?? currentMonth;
  });
  const visibleMonth = months.includes(selectedMonth)
    ? selectedMonth
    : months[0];
  const visibleEventMonth = eventMonths.includes(selectedEventMonth)
    ? selectedEventMonth
    : eventMonths[0];
  const visibleExchangeMonth = exchangeMonths.includes(selectedExchangeMonth)
    ? selectedExchangeMonth
    : exchangeMonths[0];
  const openPoolDetail = (nextPool: GachaPool) => {
    const nextKey = poolKey(nextPool);
    setSelectedKey(nextKey);
    setDetailKey(nextKey);
  };
  const exportSource: ExportImageSource = {
      pools: filteredPools.filter((pool) => pool.startTimestamp > now),
      events: filteredEvents.filter((event) => event.startTimestamp > now),
      races: races.filter((race) => race.startTimestamp > now),
      now,
      generatedAt: data.generatedAt,
  };
  const exportForAutomation = (section: ExportImageSection) =>
    exportIntelImage(exportSource, section);
  useEffect(() => {
    const mobileWindow = window as typeof window & {
      __exportIntelMobile?: (
        section: ExportImageSection,
      ) => Promise<Array<{ filename: string; dataUrl: string }>>;
    };
    const exporter = (section: ExportImageSection) =>
      exportIntelMobileImages(exportSource, section);
    mobileWindow.__exportIntelMobile = exporter;
    return () => {
      if (mobileWindow.__exportIntelMobile === exporter) {
        delete mobileWindow.__exportIntelMobile;
      }
    };
  }, [filteredPools, filteredEvents, races, now, data.generatedAt]);
  return (
    <main class="intelPage">
      <button
        id="intelExportGachaTrigger"
        type="button"
        hidden
        aria-hidden="true"
        onClick={() => exportForAutomation("gacha")}
      />
      <button
        id="intelExportEventsTrigger"
        type="button"
        hidden
        aria-hidden="true"
        onClick={() => exportForAutomation("events")}
      />
      <button
        id="intelExportRacesTrigger"
        type="button"
        hidden
        aria-hidden="true"
        onClick={() => exportForAutomation("races")}
      />
      <div class="intelTopBar">
        <nav class="intelTabs" aria-label="情报分类">
          <button
            type="button"
            class={activeTab === "gacha" ? "selected" : ""}
            onClick={() => setActiveTab("gacha")}
          >
            卡池
          </button>
          <button
            type="button"
            class={activeTab === "events" ? "selected" : ""}
            onClick={() => {
              setActiveTab("events");
              setEventView("list");
            }}
          >
            活动
          </button>
          <button
            type="button"
            class={activeTab === "races" ? "selected" : ""}
            onClick={() => setActiveTab("races")}
          >
            大赛
          </button>
          <button
            type="button"
            class={activeTab === "exchanges" ? "selected" : ""}
            onClick={() => {
              setActiveTab("exchanges");
              setExchangeView("list");
            }}
          >
            兑换
          </button>
        </nav>
      </div>

      {activeTab === "gacha" && (
        <section class="intelCalendarPanel">
          <div class="intelSectionTitle">
            <div class="intelSectionActions">
              <GachaFilters
                kind={gachaKindFilter}
                query={gachaQuery}
                onKindChange={setGachaKindFilter}
                onQueryChange={setGachaQuery}
              />
              <ViewToggle value={gachaView} onChange={setGachaView} />
              {gachaView === "calendar" && visibleMonth && (
                <div class="intelMonthSelect">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedMonth(addMonths(visibleMonth, -1))
                    }
                    disabled={!months.includes(addMonths(visibleMonth, -1))}
                    title="上个月"
                  >
                    ‹
                  </button>
                  <select
                    value={visibleMonth}
                    onChange={(event) =>
                      setSelectedMonth(event.currentTarget.value)
                    }
                  >
                    {months.map((month) => (
                      <option value={month} key={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(addMonths(visibleMonth, 1))}
                    disabled={!months.includes(addMonths(visibleMonth, 1))}
                    title="下个月"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
          {gachaView === "calendar" ? (
            <div class="intelCalendarMonths">
              {visibleMonth ? (
                <MonthCalendar
                  month={visibleMonth}
                  pools={filteredPools}
                  selectedPool={selectedPool}
                  now={now}
                  onSelect={openPoolDetail}
                  key={visibleMonth}
                />
              ) : (
                <div class="intelEmptyTab">没有符合筛选的卡池</div>
              )}
            </div>
          ) : (
            <GachaList
              pools={filteredPools}
              now={now}
              onSelect={openPoolDetail}
            />
          )}
        </section>
      )}

      {activeTab === "events" && (
        <section class="intelCalendarPanel">
          <div class="intelSectionTitle">
            <div class="intelSectionActions">
              <EventFilters
                type={eventTypeFilter}
                query={eventQuery}
                types={eventTypes}
                onTypeChange={setEventTypeFilter}
                onQueryChange={setEventQuery}
              />
              <ViewToggle value={eventView} onChange={setEventView} />
              {eventView === "calendar" && visibleEventMonth && (
                <div class="intelMonthSelect">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEventMonth(addMonths(visibleEventMonth, -1))
                    }
                    disabled={
                      !eventMonths.includes(addMonths(visibleEventMonth, -1))
                    }
                    title="上个月"
                  >
                    ‹
                  </button>
                  <select
                    value={visibleEventMonth}
                    onChange={(event) =>
                      setSelectedEventMonth(event.currentTarget.value)
                    }
                  >
                    {eventMonths.map((month) => (
                      <option value={month} key={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedEventMonth(addMonths(visibleEventMonth, 1))
                    }
                    disabled={
                      !eventMonths.includes(addMonths(visibleEventMonth, 1))
                    }
                    title="下个月"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
          {eventView === "list" ? (
            filteredEvents.length ? (
              <EventsSchedule
                events={filteredEvents}
                now={now}
                onSelect={(event) =>
                  setEventDetailKey(scheduleDetailKey(event))
                }
              />
            ) : (
              <div class="intelEmptyTab">没有符合筛选的活动</div>
            )
          ) : visibleEventMonth ? (
            <EventCalendar
              events={filteredEvents}
              now={now}
              month={visibleEventMonth}
              onSelect={(event) => setEventDetailKey(scheduleDetailKey(event))}
            />
          ) : (
            <div class="intelEmptyTab">没有符合筛选的活动</div>
          )}
        </section>
      )}

      {activeTab === "races" && (
        <section class="intelCalendarPanel">
          {races.length ? (
            <RaceSchedule
              races={races}
              now={now}
              onSelect={(race) => setRaceDetailKey(scheduleDetailKey(race))}
            />
          ) : (
            <div class="intelEmptyTab">待添加</div>
          )}
        </section>
      )}

      {activeTab === "exchanges" && (
        <section class="intelCalendarPanel">
          <div class="intelSectionTitle">
            <div class="intelSectionActions">
              <ScheduleSearch
                query={exchangeQuery}
                placeholder="搜索兑换 / 奖励"
                label="搜索兑换"
                onQueryChange={setExchangeQuery}
              />
              <ViewToggle value={exchangeView} onChange={setExchangeView} />
              {exchangeView === "calendar" && visibleExchangeMonth && (
                <div class="intelMonthSelect">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExchangeMonth(
                        addMonths(visibleExchangeMonth, -1),
                      )
                    }
                    disabled={
                      !exchangeMonths.includes(
                        addMonths(visibleExchangeMonth, -1),
                      )
                    }
                    title="上个月"
                  >
                    ‹
                  </button>
                  <select
                    value={visibleExchangeMonth}
                    onChange={(event) =>
                      setSelectedExchangeMonth(event.currentTarget.value)
                    }
                  >
                    {exchangeMonths.map((month) => (
                      <option value={month} key={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedExchangeMonth(
                        addMonths(visibleExchangeMonth, 1),
                      )
                    }
                    disabled={
                      !exchangeMonths.includes(
                        addMonths(visibleExchangeMonth, 1),
                      )
                    }
                    title="下个月"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
          {exchangeView === "list" ? (
            filteredExchanges.length ? (
              <EventsSchedule
                events={filteredExchanges}
                now={now}
                onSelect={(exchange) =>
                  setExchangeDetailKey(scheduleDetailKey(exchange))
                }
              />
            ) : (
              <div class="intelEmptyTab">没有符合筛选的兑换</div>
            )
          ) : visibleExchangeMonth ? (
            <EventCalendar
              events={filteredExchanges}
              now={now}
              month={visibleExchangeMonth}
              onSelect={(exchange) =>
                setExchangeDetailKey(scheduleDetailKey(exchange))
              }
            />
          ) : (
            <div class="intelEmptyTab">没有符合筛选的兑换</div>
          )}
        </section>
      )}

      {detailPool && (
        <GachaDetail pool={detailPool} onClose={() => setDetailKey("")} />
      )}
      {detailEvent && (
        <ScheduleDetail
          item={detailEvent}
          title="活动"
          onClose={() => setEventDetailKey("")}
        />
      )}
      {detailRace && (
        <ScheduleDetail
          item={detailRace}
          title="大赛"
          onClose={() => setRaceDetailKey("")}
        />
      )}
      {detailExchange && (
        <ScheduleDetail
          item={detailExchange}
          title="兑换"
          exchangeDetails={
            detailExchangePath
              ? cachedExchangeDetails
              : detailExchange.exchangeDetails
          }
          exchangeLoading={exchangeDetailLoading}
          exchangeError={exchangeDetailError}
          onClose={() => setExchangeDetailKey("")}
        />
      )}
    </main>
  );
}
