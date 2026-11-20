from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sqlite3
import urllib.request
import zlib
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
CN_DB = ROOT / "master.mdb"
JP_DB = ROOT / "jp-master.mdb"
DATA_DIR = ROOT / "umalator" / "data"
PUBLIC_DIR = ROOT / "umalator" / "public"
OUTPUT_JSON = DATA_DIR / "results_forecast.json"
BWIKI_CACHE_JSON = DATA_DIR / "bwiki_chara_icons.json"
GAMETORA_NAMES_CACHE_JSON = DATA_DIR / "gametora_zh_names.json"
EXCHANGE_DETAIL_DIR = PUBLIC_DIR / "intel" / "forecast_exchanges"

BWIKI_GALLERY_URL = (
    "https://wiki.biligame.com/umamusume/%E8%B5%9B%E9%A9%AC%E5%A8%98%E5%9B%BE%E9%89%B4"
)
GAMETORA_MANIFEST_URL = "https://gametora.com/data/manifests/umamusume.json"
GAMETORA_DATA_URL = "https://gametora.com/data/umamusume/{key}.{hash}.json"
GAMETORA_SUPPORT_URL = (
    "https://gametora.com/images/umamusume/supports/support_card_s_{card_id}.png"
)
GAMETORA_GACHA_URL = (
    "https://gametora.com/images/umamusume/gacha/img_bnr_gacha_{gacha_id}.png"
)
GAMETORA_STORY_URL = (
    "https://media.gametora.com/umamusume/story_events/thumb_title/ja/{story_id}.png"
)

CN_TZ = ZoneInfo("Asia/Shanghai")
JP_TZ = ZoneInfo("Asia/Tokyo")

PLACEHOLDER_END_TS = int(dt.datetime(2040, 1, 1, tzinfo=CN_TZ).timestamp())
JP_PLACEHOLDER_END_TS = int(dt.datetime(2040, 1, 1, tzinfo=JP_TZ).timestamp())
PERMANENT_END_STR = "2050-08-01 23:59:59"
PERMANENT_END_TS = int(dt.datetime(2050, 8, 1, 23, 59, 59, tzinfo=CN_TZ).timestamp())

FACTOR_RESEARCH_IMAGE = "intel/factor_research/factor_research.png"
LEGEND_RACE_IMAGE = "intel/legend/legend_vs.png"
CHAMPIONS_RACE_IMAGE = "intel/race/heroes_logo.png"
HEROES_RACE_IMAGE = "intel/race/champions_logo.png"
TRAINING_CHALLENGE_IMAGE = "intel/special/training_challenge_logo.png"
CHALLENGE_MATCH_IMAGE = "intel/special/challenge_match_logo.png"
TEAM_BUILDING_EVENT_NAME = "目标！最强团队"
TEAM_BUILDING_IMAGE = "intel/special/team_building_logo.png"

ACTIVITY_EXCHANGE_PAY_ITEMS = {45, 58, 156, 159}
VOUCHER_EXCHANGE_PAY_CATEGORIES = {41, 42, 179}
RECURRING_SHOP_IDS = {2000, 3000, 4000, 6000, 7000, 7001, 7002, 8000, 9000}

SEASON_LABELS = {
    0: "随机季节",
    1: "春天",
    2: "夏天",
    3: "秋天",
    4: "冬天",
    5: "春天",
}
WEATHER_LABELS = {0: "随机天气", 1: "晴天", 2: "多云天气", 3: "雨天", 4: "雪天"}
CONDITION_LABELS = {
    0: "随机场地",
    1: "良场地",
    2: "稍重场地",
    3: "重场地",
    4: "不良场地",
}
GROUND_LABELS = {1: "草地", 2: "泥地"}
INOUT_LABELS = {1: "内圈", 2: "外圈", 3: "外圈转内圈"}
TURN_LABELS = {1: "顺时针", 2: "逆时针", 3: "直线"}
HEROES_STAGE_LABELS = {0: "主要赛事", 1: "主要赛事", 2: "特别赛事"}
CHAMPIONS_EVENT_NAME = "群英联赛"
HEROES_EVENT_NAME = "英杰集结战"

CHAMPIONS_MILESTONE_LABELS = {
    (0, 0): "报名",
    (1, 0): "第1轮",
    (2, 0): "第2轮",
    (3, 1): "决赛准备",
    (3, 2): "决赛",
    (3, 3): "结果发表",
}
HEROES_MILESTONE_LABELS = {
    (0, 0): "预告",
    (1, 1): "主要赛事",
    (1, 2): "集结",
    (2, 1): "特别赛事准备",
    (2, 2): "特别赛事报名",
    (2, 3): "特别赛事",
    (2, 4): "结果发表",
}

FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")


def normalize_digits(value: str) -> str:
    return (value or "").translate(FULLWIDTH_DIGITS)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", (value or "").replace("\\n", "").replace("\n", ""))


def display_text(value: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", (value or ""))
    return re.sub(r"\s+", " ", cleaned.replace("\\n", " ").replace("\n", " ")).strip()


def split_card_name(name: str) -> tuple[str, str]:
    match = re.match(r"^(\[[^\]]+\])(.+)$", name or "")
    if not match:
        return "", (name or "").strip()
    return match.group(1), match.group(2).strip()


def optional_public_image(public_relative: str) -> str | None:
    return public_relative.replace("\\", "/") if (PUBLIC_DIR / public_relative).exists() else None


def cn_ts_to_str(ts: int) -> str:
    return dt.datetime.fromtimestamp(int(ts), CN_TZ).strftime("%Y-%m-%d %H:%M:%S")


def jp_ts_to_str(ts: int) -> str:
    return dt.datetime.fromtimestamp(int(ts), JP_TZ).strftime("%Y-%m-%d %H:%M:%S")


def fetch_text(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def load_or_scrape_bwiki_chara_cache(refresh: bool = False) -> dict[str, dict[str, str]]:
    """Returns {'icons': {str(card_id): url}, 'names': {str(chara_id): cn_alias}}."""
    if BWIKI_CACHE_JSON.exists() and not refresh:
        try:
            cached = json.loads(BWIKI_CACHE_JSON.read_text(encoding="utf-8"))
            if isinstance(cached, dict) and cached.get("icons"):
                return cached
        except Exception:
            pass

    icons: dict[str, str] = {}
    names: dict[str, str] = {}
    try:
        html = fetch_text(BWIKI_GALLERY_URL, timeout=25)
        for chunk in html.split("<tr"):
            urls = re.findall(
                r"(https://patchwiki\.biligame\.com/images/umamusume/thumb/[^\s\"'>]+Chr_icon_(\d+)_(\d+)_\d+\.png)",
                chunk,
                flags=re.IGNORECASE,
            )
            if not urls:
                continue
            chara_id_str = urls[0][1]
            card_id_str = urls[0][2]
            chosen_url = urls[0][0]
            for full_url, _chid, _cid in urls:
                if "200px-" in full_url:
                    chosen_url = full_url
                    break
            icons[str(int(card_id_str))] = chosen_url

            tds = re.findall(r"<td[^>]*>(.*?)</td>", chunk, flags=re.DOTALL)
            if len(tds) >= 2:
                parts = [
                    display_text(re.sub(r"<[^>]+>", "", seg))
                    for seg in re.split(r"<br\s*/?>", tds[1])
                ]
                parts = [p for p in parts if p]
                if parts:
                    names.setdefault(str(int(chara_id_str)), parts[-1])

        if icons:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            payload = {"icons": icons, "names": names}
            BWIKI_CACHE_JSON.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
                encoding="utf-8",
            )
            print(
                f"Scraped Bwiki gallery: {len(icons)} character icons -> {BWIKI_CACHE_JSON.relative_to(ROOT)}"
            )
            return payload
    except Exception as exc:
        print(f"Warning: failed to scrape Bwiki gallery ({exc})")

    if BWIKI_CACHE_JSON.exists():
        try:
            return json.loads(BWIKI_CACHE_JSON.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"icons": {}, "names": {}}


def load_or_fetch_gametora_names(refresh: bool = False) -> dict[str, dict]:
    """Returns {'chara': {str(char_id): name_tw}, 'chara_cards': {str(card_id): {name, title}}, 'support_cards': {str(id): {name, title}}}."""
    if GAMETORA_NAMES_CACHE_JSON.exists() and not refresh:
        try:
            cached = json.loads(GAMETORA_NAMES_CACHE_JSON.read_text(encoding="utf-8"))
            if isinstance(cached, dict) and cached.get("chara"):
                return cached
        except Exception:
            pass

    chara_map: dict[str, str] = {}
    chara_cards_map: dict[str, dict[str, str]] = {}
    support_cards_map: dict[str, dict[str, str]] = {}
    try:
        manifest = json.loads(fetch_text(GAMETORA_MANIFEST_URL, timeout=15))
        if "characters" in manifest:
            chars = json.loads(
                fetch_text(
                    GAMETORA_DATA_URL.format(
                        key="characters", hash=manifest["characters"]
                    )
                )
            )
            for item in chars:
                cid = item.get("char_id")
                name_tw = display_text(item.get("name_zh_tw") or item.get("name_tw") or "")
                if cid and name_tw:
                    chara_map[str(int(cid))] = name_tw

        if "character-cards" in manifest:
            ccards = json.loads(
                fetch_text(
                    GAMETORA_DATA_URL.format(
                        key="character-cards", hash=manifest["character-cards"]
                    )
                )
            )
            for item in ccards:
                card_id = item.get("card_id")
                char_id = item.get("char_id")
                name_tw = display_text(item.get("name_tw") or "")
                title_tw = display_text(item.get("title_tw") or "")
                if char_id and name_tw and str(int(char_id)) not in chara_map:
                    chara_map[str(int(char_id))] = name_tw
                if card_id and (name_tw or title_tw):
                    chara_cards_map[str(int(card_id))] = {
                        "name": name_tw,
                        "title": title_tw,
                    }

        if "support-cards" in manifest:
            scards = json.loads(
                fetch_text(
                    GAMETORA_DATA_URL.format(
                        key="support-cards", hash=manifest["support-cards"]
                    )
                )
            )
            for item in scards:
                sup_id = item.get("support_id")
                char_id = item.get("char_id")
                name_tw = display_text(item.get("name_tw") or "")
                title_tw = display_text(item.get("title_zh_tw") or item.get("title_tw") or "")
                if char_id and name_tw and str(int(char_id)) not in chara_map:
                    chara_map[str(int(char_id))] = name_tw
                if sup_id and (name_tw or title_tw):
                    support_cards_map[str(int(sup_id))] = {
                        "name": name_tw,
                        "title": title_tw,
                    }

        if chara_map:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            payload = {
                "chara": chara_map,
                "chara_cards": chara_cards_map,
                "support_cards": support_cards_map,
            }
            GAMETORA_NAMES_CACHE_JSON.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
                encoding="utf-8",
            )
            print(
                f"Fetched GameTora zh-tw names: {len(chara_map)} charas, "
                f"{len(chara_cards_map)} chara cards, {len(support_cards_map)} supports -> {GAMETORA_NAMES_CACHE_JSON.relative_to(ROOT)}"
            )
            return payload
    except Exception as exc:
        print(f"Warning: failed to fetch GameTora zh-tw names ({exc})")

    if GAMETORA_NAMES_CACHE_JSON.exists():
        try:
            return json.loads(GAMETORA_NAMES_CACHE_JSON.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"chara": {}, "chara_cards": {}, "support_cards": {}}


class TimeEstimator:
    """Estimates future CN timestamps from JP timestamps using empirical CN/JP pacing."""

    def __init__(self, cn_cur: sqlite3.Cursor, jp_cur: sqlite3.Cursor) -> None:
        cn_rows = cn_cur.execute(
            """
            SELECT id, start_date
            FROM gacha_data
            WHERE id >= 30150 AND id < 40000 AND start_date < ?
            ORDER BY start_date, id
            """,
            (PLACEHOLDER_END_TS,),
        ).fetchall()
        pairs: list[tuple[dt.date, dt.date, int, int, int]] = []
        for gacha_id, cn_start in cn_rows:
            jp_row = jp_cur.execute(
                "SELECT start_date FROM gacha_data WHERE id = ? AND start_date < ?",
                (gacha_id, JP_PLACEHOLDER_END_TS),
            ).fetchone()
            if not jp_row:
                continue
            jp_start = int(jp_row[0])
            cn_date = dt.datetime.fromtimestamp(int(cn_start), CN_TZ).date()
            jp_date = dt.datetime.fromtimestamp(jp_start, JP_TZ).date()
            pairs.append((cn_date, jp_date, int(gacha_id), int(cn_start), jp_start))

        if len(pairs) >= 2:
            uniq_dates = sorted({(p[0], p[1]) for p in pairs})
            base_cn, base_jp = uniq_dates[0]
            xs = [(jp_d - base_jp).days for _, jp_d in uniq_dates]
            ys = [(cn_d - base_cn).days for cn_d, _ in uniq_dates]
            mean_x = sum(xs) / len(xs)
            mean_y = sum(ys) / len(ys)
            denom = sum((x - mean_x) ** 2 for x in xs)
            self.pace_ratio = (
                sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
                if denom > 0
                else 0.625
            )
            last_cn, last_jp, last_gid, last_cn_ts, last_jp_ts = max(
                pairs, key=lambda item: (item[3], item[4], item[2])
            )
            self.cn_anchor_date = last_cn
            self.jp_anchor_date = last_jp
            self.anchor_gacha_id = last_gid
            self.cn_anchor_ts = last_cn_ts
            self.jp_anchor_ts = last_jp_ts
            self.sample_count = len(uniq_dates)
        else:
            self.pace_ratio = 0.625
            self.cn_anchor_date = dt.date(2026, 12, 23)
            self.jp_anchor_date = dt.date(2024, 2, 24)
            self.anchor_gacha_id = 30222
            self.cn_anchor_ts = int(
                dt.datetime(2026, 12, 23, 12, 0, 0, tzinfo=CN_TZ).timestamp()
            )
            self.jp_anchor_ts = int(
                dt.datetime(2024, 2, 24, 12, 0, 0, tzinfo=JP_TZ).timestamp()
            )
            self.sample_count = 0

    def map_point(self, jp_ts: int) -> int:
        if jp_ts >= JP_PLACEHOLDER_END_TS:
            return PERMANENT_END_TS
        jp_dt = dt.datetime.fromtimestamp(int(jp_ts), JP_TZ)
        delta_jp_days = (jp_dt.date() - self.jp_anchor_date).days
        delta_cn_days = round(delta_jp_days * self.pace_ratio)
        target_date = self.cn_anchor_date + dt.timedelta(days=delta_cn_days)
        target_dt = dt.datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            jp_dt.hour,
            jp_dt.minute,
            jp_dt.second,
            tzinfo=CN_TZ,
        )
        return int(target_dt.timestamp())

    def map_range(
        self, jp_start: int, jp_end: int, preserve_duration_max_days: int = 45
    ) -> tuple[int, int]:
        cn_start = self.map_point(jp_start)
        if jp_end >= JP_PLACEHOLDER_END_TS:
            return cn_start, PERMANENT_END_TS
        duration = int(jp_end) - int(jp_start)
        if duration <= preserve_duration_max_days * 86400:
            return cn_start, cn_start + max(0, duration)
        cn_end = self.map_point(jp_end)
        if cn_end <= cn_start:
            cn_end = cn_start + max(86400, round(duration * self.pace_ratio))
        return cn_start, cn_end

    def map_sub_range(
        self, parent_jp_start: int, parent_cn_start: int, sub_jp_start: int, sub_jp_end: int
    ) -> tuple[int, int]:
        offset_start = int(sub_jp_start) - int(parent_jp_start)
        duration = int(sub_jp_end) - int(sub_jp_start)
        sub_cn_start = parent_cn_start + offset_start
        return sub_cn_start, sub_cn_start + max(0, duration)

    def metadata(self) -> dict:
        return {
            "anchorGachaId": self.anchor_gacha_id,
            "anchorCnDate": self.cn_anchor_date.isoformat(),
            "anchorJpDate": self.jp_anchor_date.isoformat(),
            "paceRatio": round(self.pace_ratio, 4),
            "speedupFactor": round(1.0 / self.pace_ratio, 2),
            "sampleCount": self.sample_count,
        }


class TextResolver:
    """Resolves CN translations first, falling back to GameTora zh-tw and then JP text."""

    def __init__(
        self,
        cn_cur: sqlite3.Cursor,
        jp_cur: sqlite3.Cursor,
        gametora_names: dict[str, dict],
        bwiki_names: dict[str, str],
    ) -> None:
        self.cn_text: dict[tuple[int, int], str] = {}
        self.jp_text: dict[tuple[int, int], str] = {}
        self.cat_exact_map: dict[tuple[int, str], str] = {}
        self.global_exact_map: dict[str, str] = {}
        self.gametora_chara: dict[str, str] = gametora_names.get("chara", {})
        self.gametora_chara_cards: dict[str, dict] = gametora_names.get("chara_cards", {})
        self.gametora_support_cards: dict[str, dict] = gametora_names.get("support_cards", {})
        self.bwiki_names: dict[str, str] = bwiki_names
        self.jp_to_zh_chara_names: dict[str, str] = {
            "サクラチトセオー": "樱花千岁王",
        }

        self.race_name_map: dict[str, str] = {
            "JDダービー": "全国泥地德比",
            "ジャパンダートクラシック": "全国泥地经典赛",
            "全日本2歳優駿": "全国初级优俊",
        }

        for cat, idx, txt in jp_cur.execute(
            "SELECT category, [index], text FROM text_data"
        ).fetchall():
            self.jp_text[(int(cat), int(idx))] = str(txt)

        for cat, idx, txt in cn_cur.execute(
            "SELECT category, [index], text FROM text_data ORDER BY [index] ASC"
        ).fetchall():
            cat_i, idx_i, ctxt = int(cat), int(idx), str(txt)
            self.cn_text[(cat_i, idx_i)] = ctxt
            jtxt = self.jp_text.get((cat_i, idx_i))
            if jtxt and ctxt and jtxt != ctxt:
                self.cat_exact_map[(cat_i, jtxt)] = ctxt
                self.cat_exact_map[(cat_i, display_text(jtxt))] = display_text(ctxt)
                self.global_exact_map[jtxt] = ctxt
                self.global_exact_map[display_text(jtxt)] = display_text(ctxt)
                if cat_i in (6, 170):
                    self.jp_to_zh_chara_names[display_text(jtxt)] = display_text(ctxt)
                elif cat_i in (28, 29, 32, 33):
                    self.race_name_map[display_text(jtxt)] = display_text(ctxt)
                elif cat_i == 187:
                    for sep in ("\\n", "\n"):
                        if sep in jtxt and sep in ctxt:
                            jp_parts = jtxt.split(sep)
                            cn_parts = ctxt.split(sep)
                            if len(jp_parts) == 2 and len(cn_parts) == 2:
                                self.race_name_map[display_text(jp_parts[1])] = display_text(
                                    cn_parts[1]
                                )

        # Also map JP character names -> GameTora zh-tw character names when not in CN
        for (cat_i, idx_i), jtxt in self.jp_text.items():
            if cat_i == 6:
                j_clean = display_text(jtxt)
                if j_clean not in self.jp_to_zh_chara_names:
                    tw = self.gametora_chara.get(str(idx_i))
                    if tw:
                        self.jp_to_zh_chara_names[j_clean] = tw

    def get(self, category: int, index: int) -> str | None:
        raw_cn = self.cn_text.get((category, index))
        if raw_cn is not None:
            return display_text(raw_cn)
        raw_jp = self.jp_text.get((category, index))
        if raw_jp is None:
            return None
        exact = (
            self.cat_exact_map.get((category, raw_jp))
            or self.cat_exact_map.get((category, display_text(raw_jp)))
            or self.global_exact_map.get(raw_jp)
            or self.global_exact_map.get(display_text(raw_jp))
        )
        if exact is not None:
            return display_text(exact)
        return display_text(raw_jp)

    def get_cn_only(self, category: int, index: int) -> str | None:
        raw = self.cn_text.get((category, index))
        return display_text(raw) if raw is not None else None

    def get_jp_only(self, category: int, index: int) -> str | None:
        raw = self.jp_text.get((category, index))
        return display_text(raw) if raw is not None else None

    def localize_race_token(self, race_name: str) -> str:
        cleaned = display_text(race_name)
        if cleaned in self.race_name_map:
            return self.race_name_map[cleaned]
        if re.match(r"^JBC\d*$", cleaned):
            return "全国育成杯"
        return cleaned

    def localize_common_terms(self, value: str) -> str:
        text = normalize_digits(display_text(value))
        if not text:
            return text
        if text in self.global_exact_map:
            return display_text(self.global_exact_map[text])

        # Replace any embedded JP character name (e.g. ダンツフレーム登場! -> 烈焰快驹/丹츠登場!)
        for jp_c, zh_c in sorted(
            self.jp_to_zh_chara_names.items(), key=lambda kv: -len(kv[0])
        ):
            if len(jp_c) >= 3 and jp_c in text:
                text = text.replace(jp_c, zh_c)

        text = re.sub(
            r"(\d+(?:\.\d+)?)(?:st|nd|rd|th)\s*Anniv(?:ersary|\.)",
            r"\1周年庆典",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"\bHalf\s*Anniv(?:ersary|\.)", "半周年庆典", text, flags=re.IGNORECASE)

        g1_season_match = re.match(
            r"^(春|秋)のGⅠ記念ミッション\s*第(\d+)弾\s+(.+)$", text
        )
        if g1_season_match:
            season_cn = "春季" if g1_season_match.group(1) == "春" else "秋季"
            part_num = g1_season_match.group(2)
            race_cn = self.localize_race_token(g1_season_match.group(3))
            return f"{season_cn}一级赛事纪念任务第{part_num}弹 {race_cn}"

        g1_plain_match = re.match(r"^GⅠ記念ミッション\s+(.+)$", text)
        if g1_plain_match:
            race_cn = self.localize_race_token(g1_plain_match.group(1))
            return f"一级赛事纪念任务 {race_cn}"

        text = re.sub(
            r"^SR以上メイクデビューガチャ第(\d+)R$",
            r"稀有或以上新人出道招募第\1期",
            text,
        )
        text = re.sub(
            r"^SSRメイクデビューガチャ第(\d+)R$",
            r"超稀有新人出道招募第\1期",
            text,
        )
        text = re.sub(
            r"^★3メイクデビューガチャ第(\d+)R$",
            r"3★新人出道招募第\1期",
            text,
        )
        text = re.sub(
            r"^★2以上メイクデビューガチャ第(\d+)R$",
            r"2★或以上新人出道招募第\1期",
            text,
        )

        text = re.sub(r"^(\d{4}年)前半リリース", r"\1上半年リリース", text)
        text = re.sub(r"^(\d{4}年)後半リリース", r"\1下半年リリース", text)
        text = re.sub(
            r"^(\d{4}年(?:上半年|下半年)?)リリースSSR確定新春ガチャ$",
            r"\1登场 超稀有必得新春招募",
            text,
        )
        text = re.sub(
            r"^(\d{4}年(?:上半年|下半年)?)リリース★3確定新春ガチャ$",
            r"\1登场 3★必得新春招募",
            text,
        )
        text = re.sub(
            r"^(\d{4}年(?:上半年|下半年)?)リリースSSR確定ガチャ$",
            r"\1登场 超稀有必得招募",
            text,
        )
        text = re.sub(
            r"^(\d{4}年(?:上半年|下半年)?)リリース★3確定ガチャ$",
            r"\1登场 3★必得招募",
            text,
        )

        replacements = (
            ("リバイバルガチャ", "复刻招募"),
            ("リバイバル", "复刻"),
            ("クリスマス特別", "圣诞特别"),
            ("クリスマスガチャ", "圣诞招募"),
            ("クリスマス", "圣诞"),
            ("スタンプシートガチャ", "集章卡招募"),
            ("メインストーリー第2部中編公開", "主线剧情第2部中篇公开"),
            ("メインストーリー第2部前編公開", "主线剧情第2部前篇公开"),
            ("メインストーリー第2部後編公開", "主线剧情第2部后篇公开"),
            ("新育成シナリオ開幕", "新养成剧本开幕"),
            ("「育成」親愛度超獲得", "“养成”亲密度大量获得"),
            ("登場!", "登场！"),
            ("セレクトピックアップ サポートカードガチャ", "自定义精选 协助卡招募"),
            ("セレクトピックアップ プリティーダービーガチャ", "自定义精选 优俊少女招募"),
            ("セレクトピックアップガチャ", "自定义精选 招募"),
            ("セレクトピックアップ", "自定义精选"),
            ("トゥインクルコレクション プリティーダービーガチャ", "闪耀精选 优俊少女招募"),
            ("トゥインクルコレクション", "闪耀精选"),
            ("ピックアップ プリティーダービーガチャ", "精选 优俊少女招募"),
            ("ピックアップ サポートカードガチャ", "精选 协助卡招募"),
            ("SSRセレクトステップアップガチャ", "超稀有自定义多阶段招募"),
            ("★3セレクトステップアップガチャ", "3★自定义多阶段招募"),
            ("SSR確定スタートダッシュガチャ", "超稀有必得新手招募"),
            ("★3確定スタートダッシュガチャ", "3★必得新手招募"),
            ("新育成シナリオ応援ガチャ", "新养成剧本应援招募"),
            ("新育成シナリオ記念", "新养成剧本纪念"),
            ("新育成シナリオ公開記念ミッション", "新养成剧本公开纪念任务"),
            ("公開記念ミッション", "公开纪念任务"),
            ("記念ミッション", "纪念任务"),
            ("プレミアム プリティーダービーガチャ", "高级 优俊少女招募"),
            ("プリティーダービーガチャ", "优俊少女招募"),
            ("サポートカードガチャ", "协助卡招募"),
            ("ライブ記念ガチャ", "演出纪念招募"),
            ("ライブガチャ", "演出招募"),
            ("夏休みガチャ", "暑假招募"),
            ("新春ガチャ", "新春招募"),
            ("スピードガチャ", "速度招募"),
            ("スタミナガチャ", "耐力招募"),
            ("パワーガチャ", "力量招募"),
            ("根性ガチャ", "毅力招募"),
            ("賢さガチャ", "智力招募"),
            ("短距離ガチャ", "短距离招募"),
            ("マイルガチャ", "英里招募"),
            ("中距離ガチャ", "中距离招募"),
            ("長距離ガチャ", "长距离招募"),
            ("ダートガチャ", "泥地招募"),
            ("SSR確定", "超稀有必得"),
            ("★3確定", "3★必得"),
            ("SSR特別引換券", "超稀有特别兑换券"),
            ("特別SSR引換券", "超稀有特别兑换券"),
            ("SSR引換券", "超稀有兑换券"),
            ("キャラ★3引換券", "角色3★兑换券"),
            ("★3引換券", "3★兑换券"),
            ("★3 引換券", "3★兑换券"),
            ("虹の解放結晶交換", "彩虹解锁结晶兑换"),
            ("金の解放結晶交換", "金解锁结晶兑换"),
            ("虹の解放結晶", "彩虹解锁结晶"),
            ("金の解放結晶", "金解锁结晶"),
            ("虹の結晶片", "彩虹结晶片"),
            ("金の結晶片", "金结晶片"),
            ("特別 マニーショップ", "特别金币商店"),
            ("マニー交換", "金币兑换"),
            ("フレンドPt", "好友积分"),
            ("トレーナーメダル", "社团积分"),
            ("因子研究レポート", "因子研究报告"),
            ("アグネスタキオンの因子研究", "爱丽速子的因子研究"),
            ("1日1回「WINで確定」100%", "每日1次“胜利时必得”100%"),
            ("1日1回「WINで確定」100％", "每日1次“胜利时必得”100%"),
            ("「WINで確定」確率UP", "“胜利时必得”概率提升"),
            ("親愛度獲得量UP", "亲密度获得量提升"),
            ("挑戦回数UP", "挑战次数增加"),
            ("特定レース報酬ピース追加", "指定赛事奖励追加碎片"),
            ("無料コンティニュー回数UP", "免费重新挑战次数增加"),
            ("レンタル回数UP", "借用次数增加"),
            ("レンタル回数増加", "借用次数增加"),
            ("報酬獲得量UP", "奖励获得量提升"),
            ("TP消費 1/2", "消耗训练值 1/2"),
            ("消費TP 1/2", "消耗训练值 1/2"),
            ("消費TP1/2", "消耗训练值 1/2"),
            ("目指せ！最強チーム", "目标！最强团队"),
            ("ウマさんぽキャンペーン", "优俊散步活动"),
            ("さんぽキャンペーン", "散步活动"),
            ("劇場版『ウマ娘』公開記念", "剧场版《赛马娘》公开纪念"),
            ("アニメ『シンデレラグレイ』", "动画《芦毛灰姑娘》"),
            ("アニメ『シングレ』", "动画《芦毛灰姑娘》"),
        )
        for src, dst in replacements:
            text = text.replace(src, dst)

        text = re.sub(r"『?ウマ箱(\d+)』?", r"《优俊箱\1》", text)
        text = re.sub(r"ガチャ$", "招募", text)
        text = re.sub(r"ガチャ(?=\s|第|in)", "招募", text)
        text = re.sub(r"第(\d+)R\b", r"第\1期", text)
        text = re.sub(r"第(\d+)弾", r"第\1弹", text)
        text = re.sub(r"周年庆典\s+記念", "周年庆典 纪念", text)
        text = re.sub(r"\s*(?:阶段1|STEP\s*1)$", "", text, flags=re.IGNORECASE)
        text = re.sub(r"STEP\s*(\d+)$", r"阶段\1", text, flags=re.IGNORECASE)
        return display_text(text)

    def resolve_card_names(
        self, card_id: int, card_type: int, chara_id: int | None
    ) -> tuple[str, str, str, str | None]:
        """Returns (display_full_name, title, character_name, jp_full_name_if_diff)."""
        cat = 4 if card_type == 1 else 75
        cn_full = self.get_cn_only(cat, card_id)
        jp_full = self.get_jp_only(cat, card_id)
        if cn_full:
            title, chara_name = split_card_name(cn_full)
            return cn_full, title, chara_name, jp_full if jp_full != cn_full else None

        base_full = jp_full or str(card_id)
        jp_title, jp_chara_name = split_card_name(base_full)

        gt_card = (
            self.gametora_chara_cards.get(str(card_id))
            if card_type == 1
            else self.gametora_support_cards.get(str(card_id))
        ) or {}

        title = jp_title
        if title == "[トレセン学園]":
            title = "[特雷森学园]"
        elif gt_card.get("title"):
            title = gt_card["title"]

        cn_chara = self.get_cn_only(6, int(chara_id)) if chara_id else None
        if not cn_chara and chara_id:
            cn_chara = self.gametora_chara.get(str(int(chara_id)))
        if not cn_chara and gt_card.get("name"):
            cn_chara = gt_card["name"]
        if not cn_chara and jp_chara_name in self.jp_to_zh_chara_names:
            cn_chara = self.jp_to_zh_chara_names[jp_chara_name]
        if not cn_chara and chara_id:
            cn_chara = self.bwiki_names.get(str(int(chara_id)))

        chara_name = cn_chara or jp_chara_name
        full_name = f"{title}{chara_name}" if title else chara_name
        return full_name, title, chara_name, jp_full if jp_full != full_name else None

    def reward_display_name(
        self, jp_cur: sqlite3.Cursor, category: int, item_id: int
    ) -> str:
        if category == 50:
            chara_row = jp_cur.execute(
                "SELECT chara_id FROM card_data WHERE id = ?", (item_id,)
            ).fetchone()
            chara_id = int(chara_row[0]) if chara_row else None
            full, _, _, _ = self.resolve_card_names(item_id, 1, chara_id)
            return full or "角色"
        if category == 102:
            chara_row = jp_cur.execute(
                "SELECT chara_id FROM card_data WHERE id = ?", (item_id,)
            ).fetchone()
            chara_id = int(chara_row[0]) if chara_row else None
            full, _, _, _ = self.resolve_card_names(item_id, 1, chara_id)
            return f"{full}碎片" if full else "角色碎片"
        if category == 51:
            chara_row = jp_cur.execute(
                "SELECT chara_id FROM support_card_data WHERE id = ?", (item_id,)
            ).fetchone()
            chara_id = int(chara_row[0]) if chara_row else None
            full, _, _, _ = self.resolve_card_names(item_id, 2, chara_id)
            return full or self.get(76, item_id) or "支援卡"
        if category == 55:
            honor = self.get(65, item_id)
            return f"称号「{honor}」" if honor else "称号"
        raw = (
            self.get(23, item_id)
            or self.get(4, item_id)
            or self.get(76, item_id)
            or "奖励"
        )
        return self.localize_common_terms(raw)


def character_icon_with_fallback(
    card_id: int, chara_id: int | None, bwiki_icons: dict[str, str]
) -> str | None:
    if chara_id:
        for prefix in ("chr_icon", "trained_chr_icon"):
            rel = f"intel/chara/{prefix}_{int(chara_id)}_{int(card_id)}_02.png"
            found = optional_public_image(rel)
            if found:
                return found
    return bwiki_icons.get(str(int(card_id)))


def support_icon_with_fallback(card_id: int) -> str:
    local = optional_public_image(f"intel/support/support_card_s_{int(card_id)}.png")
    return local or GAMETORA_SUPPORT_URL.format(card_id=int(card_id))


def gacha_banner_with_fallback(gacha_id: int) -> str:
    local = optional_public_image(f"intel/gacha/img_bnr_gacha_{int(gacha_id)}.png")
    return local or GAMETORA_GACHA_URL.format(gacha_id=int(gacha_id))


def story_logo_with_fallback(story_id: int) -> str:
    local = optional_public_image(
        f"intel/story/story_event_story_list_thumb_title_{int(story_id)}.png"
    )
    return local or GAMETORA_STORY_URL.format(story_id=int(story_id))


def exact_piece_icon(card_id: int, bwiki_icons: dict[str, str]) -> str | None:
    for suffix in ("", "_no_frame"):
        found = optional_public_image(f"intel/piece/piece_icon_{int(card_id):06d}{suffix}.png")
        if found:
            return found
    return bwiki_icons.get(str(int(card_id)))


def exact_item_icon(item_id: int) -> str | None:
    return optional_public_image(f"intel/item/item_icon_{int(item_id):05d}.png")


def reward_icon(
    jp_cur: sqlite3.Cursor,
    category: int,
    item_id: int,
    bwiki_icons: dict[str, str],
) -> str | None:
    if not category or not item_id:
        return None
    if category == 50:
        row = jp_cur.execute(
            "SELECT chara_id FROM card_data WHERE id = ?", (item_id,)
        ).fetchone()
        return character_icon_with_fallback(
            item_id, int(row[0]) if row else None, bwiki_icons
        )
    if category == 102:
        return exact_piece_icon(item_id, bwiki_icons)
    if category == 51:
        return support_icon_with_fallback(item_id)
    return exact_item_icon(item_id)


def reward_item_summary(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
    category: int,
    item_id: int,
    amount: int = 0,
) -> dict:
    return {
        "image": reward_icon(jp_cur, category, item_id, bwiki_icons),
        "name": resolver.reward_display_name(jp_cur, category, item_id),
        "rewardType": int(category),
        "rewardValue": int(item_id),
        "amount": int(amount or 0),
    }


def reward_drop(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
    category: int,
    item_id: int,
    amount: int = 0,
    source: str = "",
) -> dict | None:
    if not category or not item_id or category == 55:
        return None
    if item_id in ACTIVITY_EXCHANGE_PAY_ITEMS:
        return None
    name = resolver.reward_display_name(jp_cur, category, item_id)
    if "锦旗" in name or "レイ" == name or name.endswith("優勝レイ"):
        return None
    image = reward_icon(jp_cur, category, item_id, bwiki_icons)
    amount_label = f" x{amount}" if amount else ""
    source_label = f" · {source}" if source else ""
    return {
        "image": image,
        "name": name,
        "source": source,
        "label": f"{name}{amount_label}{source_label}",
        "rewardType": int(category),
        "rewardValue": int(item_id),
        "amount": int(amount or 0),
        "isPiece": category == 102,
    }


def sort_reward_drops(drops: list[dict], keep_source: bool = False) -> list[dict]:
    low_priority_ids = {59, 98, 110}
    deduped: dict[tuple, dict] = {}
    for drop in drops:
        key = (
            (
                int(drop.get("rewardType") or 0),
                int(drop.get("rewardValue") or 0),
                str(drop.get("source") or ""),
            )
            if keep_source
            else (int(drop.get("rewardType") or 0), int(drop.get("rewardValue") or 0))
        )
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = dict(drop)
            continue
        total_amount = int(existing.get("amount") or 0) + int(drop.get("amount") or 0)
        existing["amount"] = total_amount
        name = existing.get("name") or existing.get("label", "").split(" x", 1)[0]
        existing_source = existing.get("source") or ""
        next_source = drop.get("source") or ""
        source = (
            existing_source
            if keep_source or existing_source == next_source
            else "合计"
        )
        existing["source"] = source
        amount_label = f" x{total_amount}" if total_amount else ""
        source_label = f" · {source}" if source else ""
        existing["label"] = f"{name}{amount_label}{source_label}"
    return sorted(
        deduped.values(),
        key=lambda item: (
            0 if item.get("isPiece") else (0 if item.get("rewardType") in {50, 51} else 1),
            1 if int(item.get("rewardValue") or 0) in low_priority_ids else 0,
            -int(item.get("rewardValue") or 0),
        ),
    )


def generate_forecast_gacha(
    cn_cur: sqlite3.Cursor,
    jp_cur: sqlite3.Cursor,
    estimator: TimeEstimator,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
) -> list[dict]:
    cn_gacha_ids = {
        int(row[0])
        for row in cn_cur.execute(
            "SELECT id FROM gacha_data WHERE start_date < ?", (PLACEHOLDER_END_TS,)
        ).fetchall()
    }
    min_jp_start = estimator.jp_anchor_ts + 1

    free_rows = jp_cur.execute(
        """
        SELECT gfc.gacha_id, gfc.target_draw_type, gfc.start_date, gfc.end_date, gd.start_date
        FROM gacha_free_campaign gfc
        JOIN gacha_data gd ON gd.id = gfc.gacha_id
        WHERE gd.start_date >= ? AND gfc.end_date < ?
        ORDER BY gfc.start_date, gfc.id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall()
    free_draws_by_gacha: dict[int, list[tuple[int, int, int, int]]] = {}
    for gacha_id, draw_type, f_start, f_end, g_start in free_rows:
        free_draws_by_gacha.setdefault(int(gacha_id), []).append(
            (int(draw_type), int(f_start), int(f_end), int(g_start))
        )

    pickup_slot_counts = dict(
        jp_cur.execute(
            """
            SELECT gacha_id, COUNT(*)
            FROM gacha_available
            WHERE is_pickup = 1
            GROUP BY gacha_id
            """
        ).fetchall()
    )

    rows = jp_cur.execute(
        """
        SELECT
            gacha_id, card_id, card_type, rarity, odds, start_date, end_date,
            only_once_flag, chara_id, support_chara_id, is_selectable, stage_count
        FROM (
            SELECT
                ga.gacha_id AS gacha_id,
                ga.card_id AS card_id,
                ga.card_type AS card_type,
                ga.rarity AS rarity,
                ga.odds AS odds,
                gd.start_date AS start_date,
                gd.end_date AS end_date,
                gd.only_once_flag AS only_once_flag,
                cd.chara_id AS chara_id,
                scd.chara_id AS support_chara_id,
                0 AS is_selectable,
                0 AS stage_count,
                ga.recommend_order AS display_order
            FROM gacha_available ga
            JOIN gacha_data gd ON ga.gacha_id = gd.id
            JOIN text_data td
              ON ga.card_id = td.[index]
             AND td.category = CASE ga.card_type WHEN 1 THEN 4 WHEN 2 THEN 75 END
            LEFT JOIN card_data cd ON ga.card_type = 1 AND cd.id = ga.card_id
            LEFT JOIN support_card_data scd ON ga.card_type = 2 AND scd.id = ga.card_id
            WHERE (
                    ga.is_pickup = 1
                    OR (
                        gd.type IN (5, 11)
                        AND ga.rarity = 3
                        AND ga.recommend_order > 0
                    )
                )
              AND gd.start_date >= ?
              AND gd.end_date < ?

            UNION ALL

            SELECT
                sp.gacha_id AS gacha_id,
                sp.card_id AS card_id,
                sp.card_type AS card_type,
                CASE sp.card_type
                    WHEN 1 THEN cd.default_rarity
                    WHEN 2 THEN scd.rarity
                END AS rarity,
                NULL AS odds,
                gd.start_date AS start_date,
                gd.end_date AS end_date,
                gd.only_once_flag AS only_once_flag,
                cd.chara_id AS chara_id,
                scd.chara_id AS support_chara_id,
                1 AS is_selectable,
                (
                    SELECT COUNT(*)
                    FROM gacha_stepup gs
                    WHERE gs.stepup_id = sp.gacha_id
                ) AS stage_count,
                sp.recommend_order AS display_order
            FROM select_pickup sp
            JOIN gacha_data gd ON sp.gacha_id = gd.id
            JOIN text_data td
              ON sp.card_id = td.[index]
             AND td.category = CASE sp.card_type WHEN 1 THEN 4 WHEN 2 THEN 75 END
            LEFT JOIN card_data cd ON sp.card_type = 1 AND cd.id = sp.card_id
            LEFT JOIN support_card_data scd ON sp.card_type = 2 AND scd.id = sp.card_id
            WHERE NOT EXISTS (
                    SELECT 1
                    FROM gacha_stepup child_step
                    WHERE child_step.target_gacha_id = sp.gacha_id
                      AND child_step.stepup_id <> sp.gacha_id
                )
              AND sp.card_type IN (1, 2)
              AND gd.start_date >= ?
              AND gd.end_date < ?
        )
        ORDER BY start_date, end_date, gacha_id, card_type, display_order, card_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS, min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall()

    character_release_dates = dict(
        jp_cur.execute(
            """
            SELECT ga.card_id, MIN(gd.start_date)
            FROM gacha_available ga
            JOIN gacha_data gd ON gd.id = ga.gacha_id
            WHERE ga.card_type = 1 AND ga.is_pickup = 1
            GROUP BY ga.card_id
            """
        ).fetchall()
    )
    support_release_dates = dict(
        jp_cur.execute("SELECT id, start_date FROM support_card_data").fetchall()
    )

    grouped: dict[tuple[int, str], dict] = {}
    for (
        gacha_id,
        card_id,
        card_type,
        rarity,
        odds,
        jp_start,
        jp_end,
        only_once_flag,
        chara_id,
        support_chara_id,
        is_selectable,
        stage_count,
    ) in rows:
        gacha_id = int(gacha_id)
        if gacha_id in cn_gacha_ids:
            continue
        card_id = int(card_id)
        card_type = int(card_type)
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        pool_type = "角色卡池" if card_type == 1 else "支援卡"
        key = (gacha_id, pool_type)

        raw_gacha_name = resolver.get(26, gacha_id) or pool_type
        selection_text = resolver.get(13, gacha_id) or ""
        pool_name = resolver.localize_common_terms(raw_gacha_name) or pool_type

        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        group = grouped.setdefault(
            key,
            {
                "id": gacha_id,
                "type": pool_type,
                "name": pool_name,
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "onlyOnce": bool(only_once_flag),
                "bannerImage": gacha_banner_with_fallback(gacha_id),
                "cards": [],
            },
        )

        if is_selectable:
            group["selectableCount"] = group.get("selectableCount", 0) + 1
            selection_match = re.search(
                r"(?:选择的|選択した)(\d+)", normalize_digits(selection_text)
            )
            slot_limit = int(pickup_slot_counts.get(gacha_id, 0) or 0)
            group["selectionLimit"] = (
                int(selection_match.group(1))
                if selection_match
                else (slot_limit if 0 < slot_limit < 10 else None)
            )
            group["stageCount"] = int(stage_count or 0)

        range_match = re.search(
            r"(\d{4}/\d{1,2}/\d{1,2})[～~](\d{4}/\d{1,2}/\d{1,2})(?:登场|登場)",
            selection_text,
        )
        if range_match:
            group["rangeStart"] = range_match.group(1)
            group["rangeEnd"] = range_match.group(2)

        if gacha_id in free_draws_by_gacha and "freeDraws" not in group:
            free_list = []
            for draw_type, f_start, f_end, g_start in free_draws_by_gacha[gacha_id]:
                f_cn_start, f_cn_end = estimator.map_sub_range(
                    g_start, cn_start, f_start, f_end
                )
                free_list.append(
                    {
                        "drawType": draw_type,
                        "label": f"免费{draw_type}抽",
                        "start": cn_ts_to_str(f_cn_start),
                        "end": cn_ts_to_str(f_cn_end),
                        "startTimestamp": f_cn_start,
                        "endTimestamp": f_cn_end,
                        "jpStart": jp_ts_to_str(f_start),
                        "jpEnd": jp_ts_to_str(f_end),
                        "jpStartTimestamp": f_start,
                        "jpEndTimestamp": f_end,
                    }
                )
            group["freeDraws"] = free_list

        resolved_chara_id = int(chara_id if card_type == 1 else (support_chara_id or 0)) or None
        full_name, title, chara_name, jp_name = resolver.resolve_card_names(
            card_id, card_type, resolved_chara_id
        )
        image = (
            character_icon_with_fallback(card_id, resolved_chara_id, bwiki_icons)
            if card_type == 1
            else support_icon_with_fallback(card_id)
        )
        card = {
            "id": card_id,
            "type": "character" if card_type == 1 else "support",
            "name": full_name,
            "title": title,
            "characterName": chara_name,
            "rarity": int(rarity or 3),
            "image": image,
        }
        if jp_name:
            card["jpName"] = jp_name
        if odds is not None:
            card["singleDrawRate"] = int(odds) / 10_000
        group["cards"].append(card)

    for group in grouped.values():
        group["cards"].sort(key=lambda card: (-card["rarity"], -card["id"]))
        is_large_unselected_pool = (
            not group.get("selectableCount") and len(group["cards"]) >= 25
        )
        if (group.get("rangeEnd") or is_large_unselected_pool) and group["cards"]:
            release_dates = (
                character_release_dates
                if group["type"] == "角色卡池"
                else support_release_dates
            )
            cutoff_card = max(
                group["cards"],
                key=lambda card: (release_dates.get(card["id"], 0), card["id"]),
            )
            group["cutoffCardId"] = cutoff_card["id"]

    return sorted(
        grouped.values(),
        key=lambda item: (item["startTimestamp"], item["type"], item["id"]),
    )


def story_event_drops(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
    story_id: int,
) -> list[dict]:
    drops = []
    for cat, item_id, amount in jp_cur.execute(
        "SELECT item_category, item_id, item_num FROM story_event_point_reward WHERE story_event_id = ?",
        (story_id,),
    ).fetchall():
        d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "点数")
        if d:
            drops.append(d)
    for cat, item_id, amount in jp_cur.execute(
        "SELECT item_category, item_id, item_num FROM story_event_mission WHERE story_event_id = ?",
        (story_id,),
    ).fetchall():
        d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "任务")
        if d:
            drops.append(d)
    for cat, item_id, amount in jp_cur.execute(
        """
        SELECT add_reward_category_1, add_reward_id_1, add_reward_num_1
        FROM story_event_story_data WHERE story_event_id = ?
        UNION ALL
        SELECT add_reward_category_2, add_reward_id_2, add_reward_num_2
        FROM story_event_story_data WHERE story_event_id = ?
        """,
        (story_id, story_id),
    ).fetchall():
        d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "剧情")
        if d:
            drops.append(d)
    for cat, item_id, amount in jp_cur.execute(
        """
        SELECT sbr.item_category, sbr.item_id, sbr.item_num
        FROM story_event_roulette_bingo serb
        JOIN story_event_bingo_reward sbr ON sbr.reward_set_id = serb.reward_set_id
        WHERE serb.story_event_id = ? AND serb.can_loop = 0
        """,
        (story_id,),
    ).fetchall():
        d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "宾果")
        if d:
            drops.append(d)
    return sort_reward_drops(drops, keep_source=True)


def generate_forecast_events(
    cn_cur: sqlite3.Cursor,
    jp_cur: sqlite3.Cursor,
    estimator: TimeEstimator,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
) -> list[dict]:
    min_jp_start = estimator.jp_anchor_ts + 1
    events: list[dict] = []

    # 1. Story Events
    cn_story_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT story_event_id FROM story_event_data").fetchall()
    }
    for story_id, jp_start, jp_ending, jp_end in jp_cur.execute(
        """
        SELECT story_event_id, start_date, ending_date, end_date
        FROM story_event_data
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, story_event_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        story_id = int(story_id)
        if story_id in cn_story_ids:
            continue
        jp_start_i, jp_ending_i, jp_end_i = int(jp_start), int(jp_ending), int(jp_end)
        name = (
            resolver.get(214, story_id)
            or resolver.get(189, story_id)
            or f"剧情活动 {story_id}"
        )
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        _, cn_ending = estimator.map_sub_range(
            jp_start_i, cn_start, jp_start_i, jp_ending_i
        )
        milestones = [
            {
                "label": "活动期间",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_ending),
                "startTimestamp": cn_start,
                "endTimestamp": cn_ending,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_ending_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_ending_i,
            }
        ]
        if cn_end > cn_ending:
            reward_start = cn_ending + 1
            jp_reward_start = jp_ending_i + 1
            milestones.append(
                {
                    "label": "奖励领取",
                    "start": cn_ts_to_str(reward_start),
                    "end": cn_ts_to_str(cn_end),
                    "startTimestamp": reward_start,
                    "endTimestamp": cn_end,
                    "jpStart": jp_ts_to_str(jp_reward_start),
                    "jpEnd": jp_ts_to_str(jp_end_i),
                    "jpStartTimestamp": jp_reward_start,
                    "jpEndTimestamp": jp_end_i,
                }
            )
        events.append(
            {
                "id": 200000 + story_id,
                "name": name,
                "type": "剧情活动时间",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": story_logo_with_fallback(story_id),
                "drops": story_event_drops(jp_cur, resolver, bwiki_icons, story_id),
                "milestones": milestones,
            }
        )

    # 2. Legend Races
    cn_legend_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT id FROM legend_race").fetchall()
    }
    for lr_id, card_id, jp_start, jp_end in jp_cur.execute(
        """
        SELECT id, image_id, start_date, end_date
        FROM legend_race
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        lr_id = int(lr_id)
        if lr_id in cn_legend_ids:
            continue
        card_id = int(card_id)
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        chara_row = jp_cur.execute(
            "SELECT chara_id FROM card_data WHERE id = ?", (card_id,)
        ).fetchone()
        chara_id = int(chara_row[0]) if chara_row else None
        full_name, _, _, _ = resolver.resolve_card_names(card_id, 1, chara_id)
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        piece_drop = reward_drop(jp_cur, resolver, bwiki_icons, 102, card_id, 0, "掉落")
        events.append(
            {
                "id": 300000 + lr_id,
                "name": full_name or f"传奇赛事 {lr_id}",
                "type": "传奇赛事时间",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(LEGEND_RACE_IMAGE),
                "drops": [piece_drop] if piece_drop else [],
            }
        )

    # 3. Factor Research
    cn_fr_ids = {
        int(r[0])
        for r in cn_cur.execute(
            "SELECT DISTINCT factor_research_event_id FROM factor_research_data"
        ).fetchall()
    }
    seen_fr: set[int] = set()
    for fr_id, jp_start, jp_end in jp_cur.execute(
        """
        SELECT factor_research_event_id, MIN(start_date), MAX(end_date)
        FROM factor_research_data
        WHERE start_date >= ? AND end_date < ?
        GROUP BY factor_research_event_id
        ORDER BY MIN(start_date), factor_research_event_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        fr_id = int(fr_id)
        if fr_id in cn_fr_ids or fr_id in seen_fr:
            continue
        seen_fr.add(fr_id)
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        raw_name = resolver.get(301, fr_id) or "因子研究"
        name = resolver.localize_common_terms(raw_name)
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        drops = []
        for cat, item_id, amount, box_num in jp_cur.execute(
            """
            SELECT fbr.item_category, fbr.item_id, fbr.item_num, fbr.box_num
            FROM factor_research_box frb
            JOIN factor_research_box_reward fbr ON fbr.box_id = frb.box_id
            WHERE frb.factor_research_event_id = ?
            ORDER BY fbr.prize_type, fbr.rate, fbr.id
            """,
            (fr_id,),
        ).fetchall():
            d = reward_drop(
                jp_cur, resolver, bwiki_icons, cat, item_id, int(amount) * int(box_num), "奖励"
            )
            if d:
                drops.append(d)
        events.append(
            {
                "id": 400000 + fr_id,
                "name": name,
                "type": "因子研究",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(FACTOR_RESEARCH_IMAGE),
                "drops": sort_reward_drops(drops),
            }
        )

    # 4. Training Challenge (训练员技能考试)
    cn_tc_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT id FROM training_challenge_master").fetchall()
    }
    for row in jp_cur.execute(
        """
        SELECT id, target_main_scenario,
               exam_id_1, exam_id_2, exam_id_3, exam_id_4, exam_id_5, ex_exam_id, free_exam_id,
               shop_id, start_date, end_date, start_result_date, end_result_date
        FROM training_challenge_master
        WHERE start_date >= ? AND end_result_date < ?
        ORDER BY start_date, id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        challenge_id, scenario_id, *exam_values, shop_id, jp_start, jp_end, jp_res_start, jp_res_end = row
        challenge_id = int(challenge_id)
        if challenge_id in cn_tc_ids:
            continue
        exam_ids = [int(v) for v in exam_values if int(v or 0)]
        scenario_name = (
            resolver.get(147, int(scenario_id))
            or resolver.get(237, int(scenario_id))
            or resolver.get(119, int(scenario_id))
        )
        name = f"训练员技能考试 - {scenario_name}" if scenario_name else "训练员技能考试"
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        jp_res_start_i = int(jp_res_start)
        final_jp_end = int(jp_res_end or jp_end)
        cn_start, cn_total_end = estimator.map_range(jp_start_i, final_jp_end)
        _, cn_exam_end = estimator.map_sub_range(jp_start_i, cn_start, jp_start_i, jp_end_i)
        cn_res_start, cn_res_end = estimator.map_sub_range(
            jp_start_i, cn_start, jp_res_start_i, final_jp_end
        )
        drops = []
        if exam_ids:
            placeholders = ",".join("?" for _ in exam_ids)
            for erow in jp_cur.execute(
                f"""
                SELECT item_category_1, item_id_1, item_num_1,
                       item_category_2, item_id_2, item_num_2,
                       item_category_3, item_id_3, item_num_3,
                       item_category_4, item_id_4, item_num_4,
                       item_category_5, item_id_5, item_num_5
                FROM training_challenge_exam
                WHERE id IN ({placeholders})
                """,
                exam_ids,
            ).fetchall():
                for idx in range(0, len(erow), 3):
                    d = reward_drop(
                        jp_cur, resolver, bwiki_icons, erow[idx], erow[idx + 1], erow[idx + 2], "考试"
                    )
                    if d:
                        drops.append(d)
        drops.extend(exchange_reward_drops(jp_cur, resolver, bwiki_icons, int(shop_id), "兑换"))
        events.append(
            {
                "id": 600000 + challenge_id,
                "name": name,
                "type": "训练员技能考试",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_total_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_total_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(final_jp_end),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": final_jp_end,
                "image": optional_public_image(TRAINING_CHALLENGE_IMAGE),
                "details": [
                    {
                        "label": "考试",
                        "raceName": f"{cn_ts_to_str(cn_start)[5:16]} - {cn_ts_to_str(cn_exam_end)[5:16]}",
                        "jpRaceName": f"{jp_ts_to_str(jp_start_i)[5:16]} - {jp_ts_to_str(jp_end_i)[5:16]}",
                    },
                    {
                        "label": "结果/兑换",
                        "raceName": f"{cn_ts_to_str(cn_res_start)[5:16]} - {cn_ts_to_str(cn_res_end)[5:16]}",
                        "jpRaceName": f"{jp_ts_to_str(jp_res_start_i)[5:16]} - {jp_ts_to_str(final_jp_end)[5:16]}",
                    },
                ],
                "drops": sort_reward_drops(drops),
            }
        )

    # 5. Challenge Match (竞速嘉年华)
    cn_cm_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT challenge_match_id FROM challenge_match_data").fetchall()
    }
    for match_id, shop_id, jp_start, jp_ending, jp_end in jp_cur.execute(
        """
        SELECT challenge_match_id, item_exchange_top_id, start_date, ending_date, end_date
        FROM challenge_match_data
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, challenge_match_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        match_id = int(match_id)
        if match_id in cn_cm_ids:
            continue
        jp_start_i, jp_ending_i, jp_end_i = int(jp_start), int(jp_ending), int(jp_end)
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        _, cn_ending = estimator.map_sub_range(jp_start_i, cn_start, jp_start_i, jp_ending_i)
        drops = []
        for rrow in jp_cur.execute(
            """
            SELECT first_clear_item_category_1, first_clear_item_id_1, first_clear_item_num_1,
                   first_clear_item_category_2, first_clear_item_id_2, first_clear_item_num_2,
                   first_clear_item_category_3, first_clear_item_id_3, first_clear_item_num_3,
                   pick_up_item_category_1, pick_up_item_id_1, pick_up_item_num_1,
                   pick_up_item_category_2, pick_up_item_id_2, pick_up_item_num_2,
                   pick_up_item_category_3, pick_up_item_id_3, pick_up_item_num_3,
                   pick_up_item_category_4, pick_up_item_id_4, pick_up_item_num_4,
                   pick_up_item_category_5, pick_up_item_id_5, pick_up_item_num_5
            FROM challenge_match_race
            WHERE challenge_match_id = ?
            ORDER BY disp_order, id
            """,
            (match_id,),
        ).fetchall():
            for idx in range(0, 9, 3):
                d = reward_drop(
                    jp_cur, resolver, bwiki_icons, rrow[idx], rrow[idx + 1], rrow[idx + 2], "首通"
                )
                if d:
                    drops.append(d)
            for idx in range(9, len(rrow), 3):
                d = reward_drop(
                    jp_cur, resolver, bwiki_icons, rrow[idx], rrow[idx + 1], rrow[idx + 2], "掉落"
                )
                if d:
                    drops.append(d)
        drops.extend(exchange_reward_drops(jp_cur, resolver, bwiki_icons, int(shop_id), "兑换"))
        events.append(
            {
                "id": 700000 + match_id,
                "name": "竞速嘉年华",
                "type": "竞速嘉年华",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(CHALLENGE_MATCH_IMAGE),
                "details": [
                    {
                        "label": "赛事",
                        "raceName": f"{cn_ts_to_str(cn_start)[5:16]} - {cn_ts_to_str(cn_ending)[5:16]}",
                        "jpRaceName": f"{jp_ts_to_str(jp_start_i)[5:16]} - {jp_ts_to_str(jp_ending_i)[5:16]}",
                    },
                    {
                        "label": "兑换",
                        "raceName": f"{cn_ts_to_str(cn_ending + 1)[5:16]} - {cn_ts_to_str(cn_end)[5:16]}",
                        "jpRaceName": f"{jp_ts_to_str(jp_ending_i + 1)[5:16]} - {jp_ts_to_str(jp_end_i)[5:16]}",
                    },
                ],
                "drops": sort_reward_drops(drops),
            }
        )

    # 6. Team Building (目标！最强团队)
    cn_tb_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT team_building_event_id FROM team_building_data").fetchall()
    }
    for row in jp_cur.execute(
        """
        SELECT team_building_event_id, notice_date, start_date, middle_date, ending_date, end_date,
               stamina_default, stamina_max, stamina_add, stamina_add_time,
               special_race_count, required_race_count
        FROM team_building_data
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, team_building_event_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        (
            event_id,
            _notice,
            jp_start,
            jp_middle,
            jp_ending,
            jp_end,
            stamina_default,
            stamina_max,
            stamina_add,
            stamina_add_time,
            special_race_count,
            required_race_count,
        ) = row
        event_id = int(event_id)
        if event_id in cn_tb_ids:
            continue
        jp_start_i, jp_middle_i, jp_ending_i, jp_end_i = (
            int(jp_start),
            int(jp_middle),
            int(jp_ending),
            int(jp_end),
        )
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        _, cn_middle = estimator.map_sub_range(jp_start_i, cn_start, jp_start_i, jp_middle_i)
        _, cn_ending = estimator.map_sub_range(jp_start_i, cn_start, jp_start_i, jp_ending_i)
        raw_name = resolver.get(265, event_id) or TEAM_BUILDING_EVENT_NAME
        name = resolver.localize_common_terms(raw_name) or TEAM_BUILDING_EVENT_NAME
        details = [
            {
                "label": "招揽赛",
                "raceName": f"{cn_ts_to_str(cn_start)[5:16]} - {cn_ts_to_str(cn_ending)[5:16]}",
                "jpRaceName": f"{jp_ts_to_str(jp_start_i)[5:16]} - {jp_ts_to_str(jp_ending_i)[5:16]}",
            },
            {
                "label": "入场券",
                "raceName": f"每日 {str(stamina_add_time)[:5]} +{stamina_add} / 初始 {stamina_default} / 上限 {stamina_max}",
            },
        ]
        if jp_start_i < jp_middle_i <= jp_ending_i and special_race_count and required_race_count:
            details.append(
                {
                    "label": "特别赛",
                    "raceName": f"{cn_ts_to_str(cn_middle)[5:16]} 起 / 每日 {required_race_count} 场后 {special_race_count} 次",
                    "jpRaceName": f"{jp_ts_to_str(jp_middle_i)[5:16]} 起 / 每日 {required_race_count} 场后 {special_race_count} 次",
                }
            )
        if cn_ending < cn_end:
            details.append(
                {
                    "label": "奖励领取",
                    "raceName": f"{cn_ts_to_str(cn_ending + 1)[5:16]} - {cn_ts_to_str(cn_end)[5:16]}",
                    "jpRaceName": f"{jp_ts_to_str(jp_ending_i + 1)[5:16]} - {jp_ts_to_str(jp_end_i)[5:16]}",
                }
            )
        drops = []
        for cat, item_id, amount in jp_cur.execute(
            "SELECT item_category, item_id, item_num FROM team_building_rank_reward_group ORDER BY reward_group_id, id"
        ).fetchall():
            d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "评级")
            if d:
                drops.append(d)
        mission_group = event_id - 1000
        m_start = 2_400_000 + mission_group * 1000
        for cat, item_id, amount in jp_cur.execute(
            "SELECT item_category, item_id, item_num FROM mission_data WHERE id >= ? AND id < ? ORDER BY mission_type, start_date, id",
            (m_start, m_start + 1000),
        ).fetchall():
            d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "任务")
            if d:
                drops.append(d)
        events.append(
            {
                "id": 800000 + event_id,
                "name": name,
                "type": TEAM_BUILDING_EVENT_NAME,
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(TEAM_BUILDING_IMAGE),
                "details": details,
                "drops": sort_reward_drops(drops, keep_source=True),
            }
        )

    # 7. Campaign Tasks & Buffs
    cn_campaign_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT campaign_id FROM campaign_data").fetchall()
    }
    deduped_campaigns: dict[tuple[str, int, int], dict] = {}
    for campaign_id, effect_type, effect_value, image_icon_id, jp_start, jp_end, _raw_text in jp_cur.execute(
        """
        SELECT cd.campaign_id, cd.effect_type_1, cd.effect_value_1, cd.image_icon_id,
               cd.start_time, cd.end_time, td.text
        FROM campaign_data cd
        JOIN text_data td ON td.category = 187 AND td.[index] = cd.campaign_id
        WHERE cd.start_time >= ? AND cd.end_time < ? AND TRIM(td.text) <> ''
        ORDER BY cd.start_time, cd.end_time, cd.campaign_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        campaign_id = int(campaign_id)
        if campaign_id in cn_campaign_ids:
            continue
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        resolved = resolver.get(187, campaign_id) or ""
        name = resolver.localize_common_terms(resolved)
        if not name:
            continue
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        mission_img = optional_public_image(
            f"intel/mission/tex_campaign_mission_logo_{campaign_id:05d}.png"
        )
        campaign_img = (
            optional_public_image(
                f"intel/campaign/campaign_icon_l_{int(image_icon_id):04d}.png"
            )
            if image_icon_id
            else None
        )
        image = mission_img or campaign_img
        is_effect = bool(image_icon_id and int(effect_type or 0) > 0 and not mission_img)

        drops = []
        if int(effect_type or 0) == 9 and effect_value:
            seen_piece: set[int] = set()
            for item_id, _rt, _rv in jp_cur.execute(
                """
                SELECT item_id, reward_type, reward_value
                FROM campaign_single_race_add_reward
                WHERE race_additional_reward_id = ?
                ORDER BY reward_type, reward_value, item_id
                """,
                (effect_value,),
            ).fetchall():
                item_id = int(item_id)
                if item_id in seen_piece:
                    continue
                seen_piece.add(item_id)
                d = reward_drop(jp_cur, resolver, bwiki_icons, 102, item_id, 0, "掉落")
                if d:
                    drops.append(d)
        for cat, item_id, amount in jp_cur.execute(
            """
            SELECT item_category, item_id, item_num
            FROM mission_data
            WHERE event_id = ?
            ORDER BY step_group_id, step_order, disp_order, id
            """,
            (campaign_id,),
        ).fetchall():
            d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, amount, "任务")
            if d:
                drops.append(d)
        for cat, item_id, amount, limit_num in jp_cur.execute(
            """
            SELECT cwrs.item_category, cwrs.item_id, cwrs.item_num, cwrs.limit_num
            FROM (
                SELECT DISTINCT cwl.reward_set_id
                FROM campaign_walking_chara cwc
                JOIN campaign_walking_location cwl ON cwl.id IN (cwc.location_1, cwc.location_2, cwc.location_3)
                WHERE cwc.campaign_id = ?
            ) walking_sets
            JOIN campaign_walking_reward_set cwrs ON cwrs.reward_set_id = walking_sets.reward_set_id
            ORDER BY cwrs.reward_set_id, cwrs.id
            """,
            (campaign_id,),
        ).fetchall():
            tot = int(amount) * int(limit_num) if limit_num else int(amount)
            d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, tot, "散步")
            if d:
                drops.append(d)

        key = (name, cn_start, cn_end)
        existing = deduped_campaigns.get(key)
        entry = {
            "id": campaign_id,
            "name": name,
            "type": "效果" if is_effect else "任务",
            "start": cn_ts_to_str(cn_start),
            "end": cn_ts_to_str(cn_end),
            "startTimestamp": cn_start,
            "endTimestamp": cn_end,
            "jpStart": jp_ts_to_str(jp_start_i),
            "jpEnd": jp_ts_to_str(jp_end_i),
            "jpStartTimestamp": jp_start_i,
            "jpEndTimestamp": jp_end_i,
            "image": image,
            "drops": sort_reward_drops(drops),
        }
        if existing is None or (not existing.get("image") and image):
            deduped_campaigns[key] = entry

    events.extend(deduped_campaigns.values())
    sorted_events = sorted(
        events,
        key=lambda item: (
            item["startTimestamp"],
            item["endTimestamp"],
            item["type"],
            item["name"],
        ),
    )
    for idx, ev in enumerate(sorted_events, 1):
        ev["id"] = idx
    return sorted_events


def condition_rate_summary(
    jp_cur: sqlite3.Cursor, season: int, weather: int, condition: int
) -> dict | None:
    effective_season = 1 if season == 5 else season
    if not effective_season or (weather and condition):
        return None
    rows = jp_cur.execute(
        """
        SELECT weather, ground, rate
        FROM race_condition
        WHERE area = 999 AND season = ? AND rate > 0
        ORDER BY weather, ground
        """,
        (effective_season,),
    ).fetchall()
    if not rows:
        return None
    filtered = [
        row
        for row in rows
        if (not weather or row[0] == weather) and (not condition or row[1] == condition)
    ]
    total = sum(row[2] for row in filtered)
    if total <= 0:
        return None
    weather_totals: dict[int, int] = {}
    condition_totals: dict[int, int] = {}
    combos = []
    for weather_val, cond_val, rate in filtered:
        weather_totals[weather_val] = weather_totals.get(weather_val, 0) + rate
        condition_totals[cond_val] = condition_totals.get(cond_val, 0) + rate
        combos.append(
            {
                "weather": WEATHER_LABELS.get(weather_val, str(weather_val)),
                "condition": CONDITION_LABELS.get(cond_val, str(cond_val)),
                "rate": round(rate / total * 100, 1),
            }
        )
    return {
        "weather": [
            {"label": WEATHER_LABELS.get(k, str(k)), "rate": round(v / total * 100, 1)}
            for k, v in weather_totals.items()
        ],
        "condition": [
            {"label": CONDITION_LABELS.get(k, str(k)), "rate": round(v / total * 100, 1)}
            for k, v in condition_totals.items()
        ],
        "combos": combos,
    }


def race_course_detail(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    race_instance_id: int,
    season: int = 0,
    weather: int = 0,
    condition: int = 0,
    label: str = "",
) -> dict | None:
    row = jp_cur.execute(
        """
        SELECT ri.race_id, r.thumbnail_id, r.entry_num, rcs.id, rcs.race_track_id,
               rcs.distance, rcs.ground, rcs.inout, rcs.turn
        FROM race_instance ri
        JOIN race r ON r.id = ri.race_id
        JOIN race_course_set rcs ON rcs.id = r.course_set
        WHERE ri.id = ?
        """,
        (race_instance_id,),
    ).fetchone()
    if not row:
        return None
    race_id, thumbnail_id, entry_num, course_id, track_id, distance, ground, inout, turn = row
    race_name = resolver.get(29, int(race_instance_id)) or resolver.get(33, int(race_id)) or ""
    track_name = resolver.get(31, int(track_id)) or resolver.get(34, int(track_id)) or ""
    icon_season = 1 if season == 5 else season
    return {
        "label": label,
        "raceName": race_name,
        "courseId": course_id,
        "track": track_name,
        "distance": distance,
        "ground": GROUND_LABELS.get(ground, str(ground)),
        "inout": INOUT_LABELS.get(inout, str(inout)),
        "turn": TURN_LABELS.get(turn, str(turn)),
        "season": SEASON_LABELS.get(season, str(season)),
        "weather": WEATHER_LABELS.get(weather, str(weather)),
        "condition": CONDITION_LABELS.get(condition, str(condition)),
        "seasonValue": icon_season,
        "weatherValue": weather,
        "conditionValue": condition,
        "conditionRates": condition_rate_summary(jp_cur, season, weather, condition),
        "entryNum": entry_num,
        "thumbnailId": thumbnail_id,
    }


def dedupe_race_details(details: list[dict]) -> list[dict]:
    deduped = []
    seen = set()
    for detail in details:
        key = (
            detail.get("track"),
            detail.get("distance"),
            detail.get("ground"),
            detail.get("inout"),
            detail.get("turn"),
            detail.get("seasonValue"),
            detail.get("weatherValue"),
            detail.get("conditionValue"),
        )
        if key in seen:
            continue
        seen.add(key)
        detail["label"] = ""
        deduped.append(detail)
    return deduped


def generate_forecast_races(
    cn_cur: sqlite3.Cursor,
    jp_cur: sqlite3.Cursor,
    estimator: TimeEstimator,
    resolver: TextResolver,
) -> list[dict]:
    min_jp_start = estimator.jp_anchor_ts + 1
    races: list[dict] = []

    cn_cm_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT id FROM champions_schedule").fetchall()
    }
    for champions_id, jp_start, jp_end in jp_cur.execute(
        """
        SELECT id, start_date, end_date
        FROM champions_schedule
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        champions_id = int(champions_id)
        if champions_id in cn_cm_ids:
            continue
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        cond_rows = jp_cur.execute(
            """
            SELECT crc.round_id, crc.race_instance_id, rc.season, rc.weather, rc.ground
            FROM champions_race_condition crc
            JOIN race_condition rc ON rc.id = crc.race_condition_id
            WHERE crc.champions_id = ? AND crc.round_id > 0
            ORDER BY crc.round_id
            """,
            (champions_id,),
        ).fetchall()
        details = []
        for _rid, ri_id, sea, wea, cond in cond_rows:
            d = race_course_detail(jp_cur, resolver, int(ri_id), int(sea), int(wea), int(cond))
            if d:
                details.append(d)
        milestones = []
        for round_id, r_detail, r_jp_start, r_jp_end in jp_cur.execute(
            """
            SELECT round, round_detail, start_date, end_date
            FROM champions_round_schedule
            WHERE champions_id = ?
            ORDER BY start_date, id
            """,
            (champions_id,),
        ).fetchall():
            r_jp_start_i, r_jp_end_i = int(r_jp_start), int(r_jp_end)
            m_start, m_end = estimator.map_sub_range(
                jp_start_i, cn_start, r_jp_start_i, r_jp_end_i
            )
            milestones.append(
                {
                    "label": CHAMPIONS_MILESTONE_LABELS.get(
                        (int(round_id), int(r_detail)), f"阶段{round_id}"
                    ),
                    "start": cn_ts_to_str(m_start),
                    "end": cn_ts_to_str(m_end),
                    "startTimestamp": m_start,
                    "endTimestamp": m_end,
                    "jpStart": jp_ts_to_str(r_jp_start_i),
                    "jpEnd": jp_ts_to_str(r_jp_end_i),
                    "jpStartTimestamp": r_jp_start_i,
                    "jpEndTimestamp": r_jp_end_i,
                }
            )
        races.append(
            {
                "id": 200000 + champions_id,
                "name": f"{CHAMPIONS_EVENT_NAME} #{champions_id}",
                "type": "大赛时间",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(CHAMPIONS_RACE_IMAGE),
                "drops": [],
                "details": dedupe_race_details(details),
                "milestones": milestones,
            }
        )

    cn_loh_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT heroes_id FROM heroes_data").fetchall()
    }
    for heroes_id, jp_start, jp_end in jp_cur.execute(
        """
        SELECT heroes_id, start_date, end_date
        FROM heroes_data
        WHERE start_date >= ? AND end_date < ?
        ORDER BY start_date, heroes_id
        """,
        (min_jp_start, JP_PLACEHOLDER_END_TS),
    ).fetchall():
        heroes_id = int(heroes_id)
        if heroes_id in cn_loh_ids:
            continue
        jp_start_i, jp_end_i = int(jp_start), int(jp_end)
        cn_start, cn_end = estimator.map_range(jp_start_i, jp_end_i)
        details = []
        for stage, ri_id, sea, wea, cond in jp_cur.execute(
            """
            SELECT stage, race_instance_id, season, weather, ground
            FROM heroes_race_condition
            WHERE heroes_id = ?
            ORDER BY stage, id
            """,
            (heroes_id,),
        ).fetchall():
            label = HEROES_STAGE_LABELS.get(int(stage), f"阶段{stage}")
            d = race_course_detail(
                jp_cur, resolver, int(ri_id), int(sea), int(wea), int(cond), label
            )
            if d:
                details.append(d)
        milestones = []
        for stage, step, race_num, s_jp_start, s_jp_end in jp_cur.execute(
            """
            SELECT stage, stage_step, race_num, start_date, end_date
            FROM heroes_stage_schedule
            WHERE heroes_id = ?
            ORDER BY start_date, id
            """,
            (heroes_id,),
        ).fetchall():
            s_jp_start_i, s_jp_end_i = int(s_jp_start), int(s_jp_end)
            m_start, m_end = estimator.map_sub_range(
                jp_start_i, cn_start, s_jp_start_i, s_jp_end_i
            )
            label = HEROES_MILESTONE_LABELS.get(
                (int(stage), int(step)), f"阶段{stage}-{step}"
            )
            if race_num:
                label = f"{label} {race_num}战"
            milestones.append(
                {
                    "label": label,
                    "start": cn_ts_to_str(m_start),
                    "end": cn_ts_to_str(m_end),
                    "startTimestamp": m_start,
                    "endTimestamp": m_end,
                    "jpStart": jp_ts_to_str(s_jp_start_i),
                    "jpEnd": jp_ts_to_str(s_jp_end_i),
                    "jpStartTimestamp": s_jp_start_i,
                    "jpEndTimestamp": s_jp_end_i,
                }
            )
        races.append(
            {
                "id": 100000 + heroes_id,
                "name": f"{HEROES_EVENT_NAME} #{heroes_id}",
                "type": "英杰集结战",
                "start": cn_ts_to_str(cn_start),
                "end": cn_ts_to_str(cn_end),
                "startTimestamp": cn_start,
                "endTimestamp": cn_end,
                "jpStart": jp_ts_to_str(jp_start_i),
                "jpEnd": jp_ts_to_str(jp_end_i),
                "jpStartTimestamp": jp_start_i,
                "jpEndTimestamp": jp_end_i,
                "image": optional_public_image(HEROES_RACE_IMAGE),
                "drops": [],
                "details": dedupe_race_details(details),
                "milestones": milestones,
            }
        )

    sorted_races = sorted(
        races,
        key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"]),
    )
    for idx, r in enumerate(sorted_races, 1):
        r["id"] = idx
    return sorted_races


def exchange_row_filter(row_ids: list[int] | None) -> tuple[str, list[int]]:
    if not row_ids:
        return "", []
    placeholders = ",".join("?" for _ in row_ids)
    return f" AND id IN ({placeholders})", [int(rid) for rid in row_ids]


def exchange_reward_drops(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
    shop_id: int,
    source: str = "兑换",
    row_ids: list[int] | None = None,
) -> list[dict]:
    if not shop_id:
        return []
    row_filter, params = exchange_row_filter(row_ids)
    rows = jp_cur.execute(
        f"""
        SELECT change_item_category, change_item_id, change_item_num, change_item_limit_num
        FROM item_exchange
        WHERE item_exchange_top_id = ?{row_filter}
        ORDER BY disp_order, id
        """,
        [shop_id, *params],
    ).fetchall()
    drops = []
    for cat, item_id, amount, limit_num in rows:
        tot = int(amount) * int(limit_num) if limit_num else int(amount)
        d = reward_drop(jp_cur, resolver, bwiki_icons, cat, item_id, tot, source)
        if d:
            drops.append(d)
    return drops


def exchange_detail_rows(
    jp_cur: sqlite3.Cursor,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
    shop_id: int,
    row_ids: list[int] | None = None,
) -> list[dict]:
    row_filter, params = exchange_row_filter(row_ids)
    rows = jp_cur.execute(
        f"""
        SELECT change_item_category, change_item_id, change_item_num, change_item_limit_num,
               additional_piece_num, pay_item_category, pay_item_id, pay_item_num, disp_order, id
        FROM item_exchange
        WHERE item_exchange_top_id = ?{row_filter}
        ORDER BY disp_order, id
        """,
        [shop_id, *params],
    ).fetchall()
    details = []
    for (
        c_cat,
        c_id,
        c_num,
        limit_num,
        add_piece,
        p_cat,
        p_id,
        p_num,
        disp_order,
        row_id,
    ) in rows:
        reward = reward_item_summary(
            jp_cur, resolver, bwiki_icons, int(c_cat), int(c_id), int(c_num)
        )
        r_name = reward.get("name") or ""
        if int(c_id) in ACTIVITY_EXCHANGE_PAY_ITEMS or "锦旗" in r_name or r_name.endswith("優勝レイ"):
            continue
        details.append(
            {
                "id": int(row_id),
                "order": int(disp_order),
                "reward": reward,
                "pay": reward_item_summary(
                    jp_cur, resolver, bwiki_icons, int(p_cat), int(p_id), int(p_num)
                ),
                "limit": int(limit_num or 0),
                "totalRewardAmount": int(c_num or 0) * int(limit_num or 0)
                if limit_num
                else int(c_num or 0),
                "additionalPieceAmount": int(add_piece or 0),
            }
        )
    return details


def write_exchange_detail_file(exchange_key: str, details: list[dict]) -> str:
    EXCHANGE_DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    safe_key = re.sub(r"[^0-9A-Za-z_-]", "_", str(exchange_key))
    path = EXCHANGE_DETAIL_DIR / f"exchange_{safe_key}.json"
    path.write_text(
        json.dumps({"exchangeDetails": details}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return f"intel/forecast_exchanges/{path.name}"


def generate_forecast_exchanges(
    cn_cur: sqlite3.Cursor,
    jp_cur: sqlite3.Cursor,
    estimator: TimeEstimator,
    resolver: TextResolver,
    bwiki_icons: dict[str, str],
) -> list[dict]:
    if EXCHANGE_DETAIL_DIR.exists():
        shutil.rmtree(EXCHANGE_DETAIL_DIR)

    cn_ie_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT id FROM item_exchange").fetchall()
    }
    cn_shop_ids = {
        int(r[0]) for r in cn_cur.execute("SELECT id FROM item_exchange_top").fetchall()
    }
    min_jp_start = estimator.jp_anchor_ts + 1

    shop_rows = jp_cur.execute(
        """
        SELECT id, start_date, end_date
        FROM item_exchange_top
        WHERE end_date >= ?
        ORDER BY start_date, end_date, id
        """,
        (min_jp_start,),
    ).fetchall()

    exchanges: list[dict] = []
    for shop_id, shop_start, _shop_end in shop_rows:
        shop_id = int(shop_id)
        if shop_id in cn_shop_ids and shop_id not in RECURRING_SHOP_IDS:
            continue
        raw_name = resolver.get(39, shop_id) or resolver.get(40, shop_id) or "物品兑换"
        raw_desc = resolver.get(40, shop_id) or ""
        norm_label = normalize_text(f"{raw_name} {raw_desc}")
        if (
            "女神像" in norm_label
            or "考试币" in norm_label
            or "嘉年华积分" in norm_label
            or "トレーニングパス" in norm_label
        ):
            continue

        pay_item_ids = {
            int(r[0])
            for r in jp_cur.execute(
                "SELECT DISTINCT pay_item_id FROM item_exchange WHERE item_exchange_top_id = ? AND pay_item_id > 0",
                (shop_id,),
            ).fetchall()
        }
        if pay_item_ids and pay_item_ids.issubset(ACTIVITY_EXCHANGE_PAY_ITEMS):
            continue

        pay_categories = {
            int(r[0])
            for r in jp_cur.execute(
                "SELECT DISTINCT pay_item_category FROM item_exchange WHERE item_exchange_top_id = ? AND pay_item_id > 0",
                (shop_id,),
            ).fetchall()
        }
        is_voucher = bool(pay_categories & VOUCHER_EXCHANGE_PAY_CATEGORIES)

        item_rows = jp_cur.execute(
            """
            SELECT id, start_date, end_date
            FROM item_exchange
            WHERE item_exchange_top_id = ?
              AND start_date >= ?
              AND start_date < ?
              AND end_date >= start_date
            ORDER BY start_date, end_date, disp_order, id
            """,
            (shop_id, min_jp_start, JP_PLACEHOLDER_END_TS),
        ).fetchall()

        grouped_rows: dict[tuple[int, int], list[int]] = {}
        for row_id, r_start, r_end in item_rows:
            row_id = int(row_id)
            if row_id in cn_ie_ids:
                continue
            grouped_rows.setdefault((int(r_start), int(r_end)), []).append(row_id)

        for (jp_r_start, jp_r_end), row_ids in grouped_rows.items():
            detail_drops = sort_reward_drops(
                exchange_reward_drops(
                    jp_cur, resolver, bwiki_icons, shop_id, "兑换", row_ids
                )
            )
            if not detail_drops:
                continue
            details = exchange_detail_rows(
                jp_cur, resolver, bwiki_icons, shop_id, row_ids
            )
            if not details:
                continue

            row_filter, params = exchange_row_filter(row_ids)
            pay_rows = jp_cur.execute(
                f"""
                SELECT DISTINCT pay_item_category, pay_item_id
                FROM item_exchange
                WHERE item_exchange_top_id = ?{row_filter} AND pay_item_id > 0
                ORDER BY pay_item_category, pay_item_id
                """,
                [shop_id, *params],
            ).fetchall()
            pay_names = [
                resolver.reward_display_name(jp_cur, int(cat), int(pid))
                for cat, pid in pay_rows
            ]
            image = (
                reward_icon(
                    jp_cur, int(pay_rows[0][0]), int(pay_rows[0][1]), bwiki_icons
                )
                if pay_rows
                else None
            )

            display_name = resolver.localize_common_terms(raw_name)
            visible_pay = [
                pn
                for pn in pay_names
                if normalize_text(pn) and normalize_text(pn) not in normalize_text(display_name)
            ]
            if visible_pay:
                display_name = f"{display_name} · {' / '.join(visible_pay[:2])}"
                if len(visible_pay) > 2:
                    display_name += f" +{len(visible_pay) - 2}"
            suffix = "追加" if int(shop_start) < min_jp_start or jp_r_start != int(shop_start) else ""
            if suffix and not is_voucher:
                display_name = f"{display_name} · {suffix}"

            cn_start, cn_end = estimator.map_range(jp_r_start, jp_r_end)
            jp_end_capped = PERMANENT_END_TS if jp_r_end >= JP_PLACEHOLDER_END_TS else int(jp_r_end)
            detail_key = f"jp_{shop_id}_{jp_r_start}_{jp_r_end}"
            preview_drops = [] if is_voucher else detail_drops[:10]
            if not is_voucher and len(detail_drops) > 10:
                preview_drops.append(
                    {"label": f"+{len(detail_drops) - 10}", "countOnly": True}
                )
            schedule_id = 2_000_000_000 + zlib.crc32(detail_key.encode("utf-8"))
            exchanges.append(
                {
                    "id": schedule_id,
                    "name": display_name,
                    "type": "兑换券兑换" if is_voucher else "物品兑换",
                    "start": cn_ts_to_str(cn_start),
                    "end": PERMANENT_END_STR if cn_end >= PERMANENT_END_TS else cn_ts_to_str(cn_end),
                    "startTimestamp": cn_start,
                    "endTimestamp": cn_end,
                    "jpStart": jp_ts_to_str(jp_r_start),
                    "jpEnd": PERMANENT_END_STR if jp_r_end >= JP_PLACEHOLDER_END_TS else jp_ts_to_str(jp_r_end),
                    "jpStartTimestamp": int(jp_r_start),
                    "jpEndTimestamp": jp_end_capped,
                    "image": image,
                    "drops": preview_drops,
                    "exchangeDetailPath": write_exchange_detail_file(detail_key, details),
                    "exchangeDetailCount": len(details),
                    "isVoucherExchange": is_voucher,
                }
            )

    return sorted(
        exchanges,
        key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["name"]),
    )


def generate_jp_forecast(refresh_remote: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CN_DB.exists() or not JP_DB.exists():
        if OUTPUT_JSON.exists():
            print(
                f"Skipping JP forecast regeneration (missing DB), keeping {OUTPUT_JSON.relative_to(ROOT)}"
            )
            return
        empty = {
            "forecastMeta": None,
            "gachaPools": [],
            "events": [],
            "races": [],
            "exchanges": [],
            "generatedAt": dt.datetime.now(CN_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        }
        OUTPUT_JSON.write_text(
            json.dumps(empty, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return

    bwiki_cache = load_or_scrape_bwiki_chara_cache(refresh=refresh_remote)
    gametora_names = load_or_fetch_gametora_names(refresh=refresh_remote)
    bwiki_icons = bwiki_cache.get("icons", {})
    bwiki_names = bwiki_cache.get("names", {})

    cn_conn = sqlite3.connect(CN_DB)
    jp_conn = sqlite3.connect(JP_DB)
    try:
        cn_cur = cn_conn.cursor()
        jp_cur = jp_conn.cursor()
        estimator = TimeEstimator(cn_cur, jp_cur)
        resolver = TextResolver(cn_cur, jp_cur, gametora_names, bwiki_names)

        data = {
            "forecastMeta": estimator.metadata(),
            "gachaPools": generate_forecast_gacha(
                cn_cur, jp_cur, estimator, resolver, bwiki_icons
            ),
            "events": generate_forecast_events(
                cn_cur, jp_cur, estimator, resolver, bwiki_icons
            ),
            "races": generate_forecast_races(cn_cur, jp_cur, estimator, resolver),
            "exchanges": generate_forecast_exchanges(
                cn_cur, jp_cur, estimator, resolver, bwiki_icons
            ),
            "generatedAt": dt.datetime.now(CN_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        }
        OUTPUT_JSON.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(
            f"Generated {OUTPUT_JSON.relative_to(ROOT)} "
            f"(gacha={len(data['gachaPools'])}, events={len(data['events'])}, "
            f"races={len(data['races'])}, exchanges={len(data['exchanges'])})"
        )
    finally:
        cn_conn.close()
        jp_conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate JP forecast JSON")
    parser.add_argument(
        "--refresh-remote",
        action="store_true",
        help="Re-fetch Bwiki character icons and GameTora zh-tw names",
    )
    args = parser.parse_args()
    generate_jp_forecast(refresh_remote=args.refresh_remote)
