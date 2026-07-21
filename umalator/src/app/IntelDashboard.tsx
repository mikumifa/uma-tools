import { h } from "preact";
import { useMemo, useState } from "preact/hooks";

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
  type: string;
  start: string;
  end: string;
  startTimestamp: number;
  endTimestamp: number;
  bannerImage?: string | null;
  cards: GachaCard[];
};

type IntelData = {
  gachaPools: GachaPool[];
  events: ScheduleItem[];
  races?: ScheduleItem[];
  generatedAt: string;
};

type IntelTab = "gacha" | "events" | "races";
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
    image: string;
    label?: string;
    rewardType?: number;
    rewardValue?: number;
  }>;
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
  if (path.includes("/piece/")) return "pieceImage";
  if (path.includes("/race/")) return "raceImage";
  return "itemImage";
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

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

function dateLabel(start: string, end: string) {
  return sameDay(start, end)
    ? `${fullDate(start)} - ${end.slice(11, 16)}`
    : `${fullDate(start)} - ${fullDate(end)}`;
}

function dateLabelLines(start: string, end: string) {
  return [fullDate(start), fullDate(end)];
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
  const names = pool.cards.map((card) => card.characterName);
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
  return [event.name, event.type, scheduleTypeLabel(event.type)]
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
  const cover = poolCover(pool);
  const compact = segment.columnEnd - segment.columnStart <= 2;

  return (
    <button
      type="button"
      class={`intelWeekPool ${poolTypeClass(pool)} ${compact ? "compact" : ""} ${selected ? "selected" : ""} ${active ? "active" : ""}`}
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
          <strong>{pool.cards.length} UP</strong>
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
        const cover = poolCover(pool);
        return (
          <button
            type="button"
            class={`intelGachaListItem ${poolTypeClass(pool)} ${active ? "active" : ""}`}
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
            <div>
              <time>{dateLabel(pool.start, pool.end)}</time>
            </div>
            <UpPreview cards={pool.cards} />
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
  if (!drops?.length) return null;
  return (
    <div class="intelDropIcons">
      {drops.map((drop, index) => (
        <img
          src={assetUrl(drop.image)}
          alt={drop.label || "掉落"}
          loading="lazy"
          title={drop.label || "掉落"}
          key={`${drop.image}-${index}`}
        />
      ))}
    </div>
  );
}

function EventsSchedule({
  events,
  now,
}: {
  events: ScheduleItem[];
  now: number;
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
                  class={`intelEventItem ${event.image ? "hasImage" : ""} ${scheduleImageClass(event.image)} ${active ? "active" : ""}`}
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
                  <time>{dateLabel(event.start, event.end)}</time>
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
}: {
  events: ScheduleItem[];
  now: number;
  month?: string;
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
                    class={`intelEventTimelineItem ${event.image ? "hasImage" : ""} ${scheduleImageClass(event.image)} ${active ? "active" : ""}`}
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
                      <DropIcons drops={event.drops} />
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
                          {dateLabelLines(event.start, event.end).map((line) => (
                            <span key={line}>{line}</span>
                          ))}
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
              {[detail.track, detail.distance ? `${detail.distance}m` : "", detail.ground]
                .filter(Boolean)
                .join(" ")}
            </strong>
            <div class="intelRaceMetaLine">
              {season && <img src={assetUrl(season)} alt={detail.season || "季节"} title={detail.season} />}
              {weather && <img src={assetUrl(weather)} alt={detail.weather || "天气"} title={detail.weather} />}
              <small>
                {[detail.turn, detail.inout, detail.weather, detail.condition]
                  .filter(Boolean)
                  .join(" / ")}
              </small>
            </div>
            {(weatherRates || conditionRates) && (
              <em>
                {[weatherRates && `天气 ${weatherRates}`, conditionRates && `场地 ${conditionRates}`]
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
          <article class={`intelRaceItem ${active ? "active" : ""}`} key={race.id}>
            {race.image && <img src={assetUrl(race.image)} alt="" loading="lazy" />}
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
  const [gachaView, setGachaView] = useState<ViewMode>("calendar");
  const [eventView, setEventView] = useState<ViewMode>("list");
  const [gachaKindFilter, setGachaKindFilter] = useState<GachaKindFilter>("all");
  const [gachaQuery, setGachaQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventQuery, setEventQuery] = useState("");
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
  const [selectedKey, setSelectedKey] = useState(() =>
    filteredPools[0] ? poolKey(filteredPools[0]) : "",
  );
  const [detailKey, setDetailKey] = useState("");
  const selectedPool =
    filteredPools.find((pool) => poolKey(pool) === selectedKey) ??
    filteredPools[0];
  const detailPool = pools.find((pool) => poolKey(pool) === detailKey);
  const months = filteredPools.length
    ? monthsBetween(filteredPools[0].start, filteredPools[filteredPools.length - 1].end)
    : [];
  const eventMonths = filteredEvents.length
    ? monthsBetween(filteredEvents[0].start, filteredEvents[filteredEvents.length - 1].end)
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
  const visibleMonth = months.includes(selectedMonth)
    ? selectedMonth
    : months[0];
  const visibleEventMonth = eventMonths.includes(selectedEventMonth)
    ? selectedEventMonth
    : eventMonths[0];
  const openPoolDetail = (nextPool: GachaPool) => {
    const nextKey = poolKey(nextPool);
    setSelectedKey(nextKey);
    setDetailKey(nextKey);
  };

  return (
    <main class="intelPage">
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
      </nav>

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
            <GachaList pools={filteredPools} now={now} onSelect={openPoolDetail} />
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
              <EventsSchedule events={filteredEvents} now={now} />
            ) : (
              <div class="intelEmptyTab">没有符合筛选的活动</div>
            )
          ) : (
            visibleEventMonth ? (
              <EventCalendar
                events={filteredEvents}
                now={now}
                month={visibleEventMonth}
              />
            ) : (
              <div class="intelEmptyTab">没有符合筛选的活动</div>
            )
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

      {detailPool && (
        <GachaDetail pool={detailPool} onClose={() => setDetailKey("")} />
      )}
    </main>
  );
}
