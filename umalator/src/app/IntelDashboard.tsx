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
  const names = Array.from(
    new Set(pool.cards.map((card) => card.characterName)),
  );
  const visible = names.slice(0, max).join(" / ");
  return names.length > max ? `${visible} +${names.length - max}` : visible;
}

function poolKey(pool: GachaPool) {
  return `${pool.id}-${pool.type}`;
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

const EXPORT_WIDTH = 1280;
const EXPORT_PADDING = 36;

type ExportImageSource = {
  pools: GachaPool[];
  events: ScheduleItem[];
  races: ScheduleItem[];
  now: number;
  generatedAt: string;
};

type LoadedImages = Map<string, HTMLImageElement>;

function collectExportImages(source: ExportImageSource) {
  const paths = new Set<string>();
  source.pools.forEach((pool) => {
    const cover = poolCover(pool);
    if (cover) paths.add(cover);
    pool.cards.forEach((card) => card.image && paths.add(card.image));
  });
  [...source.events, ...source.races].forEach((item) => {
    if (item.image) paths.add(item.image);
    item.drops?.forEach((drop) => drop.image && paths.add(drop.image));
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
  return `${weight} ${size}px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;
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
) {
  ctx.font = exportFont(18, 700);
  const width = Math.ceil(ctx.measureText(label).width) + 24;
  fillRounded(ctx, x, y, width, 30, 15, fill);
  ctx.fillStyle = text;
  ctx.fillText(label, x + 12, y + 21);
  return width;
}

function drawSectionTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  count: number,
  y: number,
) {
  ctx.fillStyle = "#18202b";
  ctx.font = exportFont(28, 800);
  ctx.fillText(title, EXPORT_PADDING, y + 28);
  ctx.font = exportFont(18, 600);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(
    `${count} 项`,
    EXPORT_PADDING + ctx.measureText(title).width + 18,
    y + 28,
  );
}

function estimateExportHeight(source: ExportImageSource) {
  const raceHeight = source.races.reduce(
    (height, race) =>
      height + 132 + Math.max(0, (race.details?.length || 0) - 1) * 46,
    0,
  );
  return (
    140 +
    54 +
    Math.max(1, source.pools.length) * 126 +
    54 +
    Math.max(1, source.events.length) * 98 +
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
    EXPORT_WIDTH - EXPORT_PADDING * 2,
    112,
    8,
    "#ffffff",
    "#d7dce5",
  );
  ctx.fillStyle = accent;
  ctx.fillRect(EXPORT_PADDING, y, 6, 112);
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
  ctx.font = exportFont(19, 800);
  ctx.fillStyle = "#18202b";
  ctx.fillText(pool.type, textX, y + 33);
  if (active)
    drawBadge(ctx, "进行中", textX + 88, y + 11, "#fee2e2", "#b42318");
  ctx.font = exportFont(24, 800);
  ctx.fillStyle = "#18202b";
  drawTextLines(ctx, poolSummary(pool, 8), textX, y + 65, 390, 28, 1);
  ctx.font = exportFont(20, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(dateLabel(pool.start, pool.end), textX, y + 96);

  const startX = EXPORT_WIDTH - EXPORT_PADDING - 508;
  pool.cards.slice(0, 6).forEach((card, index) => {
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
  if (pool.cards.length > 6) {
    ctx.font = exportFont(24, 800);
    ctx.fillStyle = "#5f6b7a";
    ctx.fillText(
      `+${pool.cards.length - 6}`,
      EXPORT_WIDTH - EXPORT_PADDING - 34,
      y + 64,
    );
  }
}

function drawEventRow(
  ctx: CanvasRenderingContext2D,
  images: LoadedImages,
  event: ScheduleItem,
  y: number,
  now: number,
) {
  const active = event.startTimestamp <= now && event.endTimestamp >= now;
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_WIDTH - EXPORT_PADDING * 2,
    86,
    8,
    "#ffffff",
    "#d7dce5",
  );
  drawImageFit(
    ctx,
    event.image ? images.get(event.image) : undefined,
    EXPORT_PADDING + 18,
    y + 10,
    74,
    66,
    "contain",
  );
  const textX = EXPORT_PADDING + 112;
  const badgeWidth = drawBadge(
    ctx,
    scheduleTypeLabel(event.type),
    textX,
    y + 11,
    "#eef2f7",
    "#18202b",
  );
  if (active)
    drawBadge(
      ctx,
      "进行中",
      textX + badgeWidth + 10,
      y + 11,
      "#fee2e2",
      "#b42318",
    );
  ctx.font = exportFont(24, 800);
  ctx.fillStyle = "#18202b";
  drawTextLines(ctx, event.name, textX, y + 61, 560, 28, 1);
  ctx.font = exportFont(22, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(
    dateLabel(event.start, event.end),
    EXPORT_WIDTH - EXPORT_PADDING - 330,
    y + 37,
  );
  mergedRewardDrops(event.drops).slice(0, 5).forEach((drop, index) => {
    const x = EXPORT_WIDTH - EXPORT_PADDING - 330 + index * 54;
    if (drop.image) {
      drawImageFit(ctx, images.get(drop.image), x, y + 43, 38, 38, "contain");
      const amount = rewardAmountLabel(drop);
      if (amount) {
        ctx.font = exportFont(12, 900);
        const width = Math.ceil(ctx.measureText(amount).width) + 10;
        fillRounded(ctx, x + 38 - width + 4, y + 66, width, 18, 9, "#172033");
        ctx.fillStyle = "#ffffff";
        ctx.fillText(amount, x + 38 - width + 9, y + 80);
      }
      return;
    }
    const label = drop.label || "奖励";
    ctx.font = exportFont(15, 800);
    const width = Math.max(48, Math.ceil(ctx.measureText(label).width) + 14);
    fillRounded(ctx, x, y + 49, width, 26, 13, "#eef2f7", "#d7dce5");
    ctx.fillStyle = "#475569";
    ctx.fillText(label, x + 7, y + 68);
  });
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
  const height = 118 + Math.max(0, details.length - 1) * 46;
  const active = race.startTimestamp <= now && race.endTimestamp >= now;
  fillRounded(
    ctx,
    EXPORT_PADDING,
    y,
    EXPORT_WIDTH - EXPORT_PADDING * 2,
    height,
    8,
    "#ffffff",
    "#d7dce5",
  );
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
  ctx.fillText(race.name, textX, y + 34);
  if (active)
    drawBadge(
      ctx,
      "进行中",
      textX + ctx.measureText(race.name).width + 14,
      y + 11,
      "#fee2e2",
      "#b42318",
    );
  ctx.font = exportFont(21, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(dateLabel(race.start, race.end), textX, y + 66);
  details.slice(0, 4).forEach((detail, index) => {
    const lineY = y + 100 + index * 42;
    const season = seasonIcon(detail.seasonValue);
    const weather = weatherIcon(detail.weatherValue);
    if (season)
      drawImageFit(
        ctx,
        images.get(season),
        textX,
        lineY - 24,
        48,
        24,
        "contain",
      );
    if (weather)
      drawImageFit(
        ctx,
        images.get(weather),
        textX + 54,
        lineY - 28,
        34,
        28,
        "contain",
      );
    ctx.font = exportFont(20, 700);
    ctx.fillStyle = "#18202b";
    drawTextLines(ctx, raceDetailText(detail), textX + 102, lineY, 880, 24, 1);
  });
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

async function exportIntelImage(source: ExportImageSource) {
  const images = await loadExportImages(collectExportImages(source));
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = estimateExportHeight(source);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#f5f6f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#18202b";
  ctx.font = exportFont(34, 900);
  ctx.fillText("闪耀优俊少女 情报一图流", EXPORT_PADDING, 58);
  ctx.font = exportFont(19, 700);
  ctx.fillStyle = "#5f6b7a";
  ctx.fillText(
    `生成 ${source.generatedAt || new Date().toLocaleString()}`,
    EXPORT_PADDING,
    91,
  );
  ctx.fillText("当前 / 未来", EXPORT_WIDTH - EXPORT_PADDING - 110, 91);

  let y = 126;
  drawSectionTitle(ctx, "卡池", source.pools.length, y);
  y += 48;
  if (source.pools.length) {
    source.pools.forEach((pool) => {
      drawGachaRow(ctx, images, pool, y, source.now);
      y += 126;
    });
  } else {
    drawEmptyExportRow(ctx, y, "没有符合筛选的卡池");
    y += 86;
  }

  y += 10;
  drawSectionTitle(ctx, "活动", source.events.length, y);
  y += 48;
  if (source.events.length) {
    source.events.forEach((event) => {
      drawEventRow(ctx, images, event, y, source.now);
      y += 98;
    });
  } else {
    drawEmptyExportRow(ctx, y, "没有符合筛选的活动");
    y += 86;
  }

  y += 10;
  drawSectionTitle(ctx, "大赛", source.races.length, y);
  y += 48;
  if (source.races.length) {
    source.races.forEach((race) => {
      y += drawRaceRow(ctx, images, race, y, source.now) + 14;
    });
  } else {
    drawEmptyExportRow(ctx, y, "暂无当前 / 未来大赛");
    y += 86;
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
      link.download = `uma-intel-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

function UpPreview({ cards }: { cards: GachaCard[] }) {
  return (
    <div class="intelUpPreview">
      {cards.slice(0, 8).map((card) => (
        <div class="intelUpMini" title={card.name} key={card.id}>
          <CardImage card={card} />
        </div>
      ))}
      {cards.length > 8 && <em>+{cards.length - 8}</em>}
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
};

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
  return {
    pool,
    columnStart: startIndex + 1,
    columnEnd: endIndex + 2,
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
          <small>
            {shortDate(pool.start)} - {shortDate(pool.end)}
          </small>
        </div>
      )}
      {active && <span class="intelPoolStatus">进行中</span>}
      {pool.onlyOnce && <span class="intelPoolOnce">限购一次</span>}
      {!compact && (
        <div class="intelPoolBody">
          <UpPreview cards={pool.cards} />
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
            <p>{dateLabel(pool.start, pool.end)}</p>
          </div>
        </div>
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
            aria-label={`${dateLabel(pool.start, pool.end)} ${poolSummary(pool, 8)}`}
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
              <time>{dateLabel(pool.start, pool.end)}</time>
            </div>
            <UpPreview cards={pool.cards} />
            {active && <span class="intelPoolStatus">进行中</span>}
            {pool.onlyOnce && <span class="intelPoolOnce">限购一次</span>}
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

function RaceSchedule({ races, now }: { races: ScheduleItem[]; now: number }) {
  return (
    <div class="intelRaceList">
      {races.map((race) => {
        const active = race.startTimestamp <= now && race.endTimestamp >= now;
        return (
          <article
            class={`intelRaceItem ${active ? "active" : ""}`}
            key={race.id}
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
        .filter((exchange) => exchange.startTimestamp >= now)
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
  return (
    <main class="intelPage">
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
            <RaceSchedule races={races} now={now} />
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
