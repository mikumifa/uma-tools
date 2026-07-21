import datetime as dt
import csv
import json
import os
import re
import shutil
import sqlite3
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_local_env() -> None:
    for filename in (".env.local", ".env"):
        path = ROOT / filename
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def configured_texture_dir() -> Path | None:
    value = os.environ.get("UMA_TEXTURE2D_DIR", "").strip()
    if not value:
        return None
    path = Path(value)
    if path.is_dir():
        return path
    print(f"UMA_TEXTURE2D_DIR does not exist, skipping asset copy: {path}")
    return None


load_local_env()
MASTER_DB = Path(os.environ.get("UMA_MASTER_DB", ROOT / "master.mdb"))
REPORT_MD = Path(
    os.environ.get("UMA_RESULTS_REPORT", ROOT / "results" / "results_increment_report.md")
)
FACTOR_RESEARCH_CSV = Path(
    os.environ.get("UMA_FACTOR_RESEARCH_CSV", ROOT / "results" / "factor_research_data.csv")
)
DATA_DIR = ROOT / "umalator" / "data"
PUBLIC_DIR = ROOT / "umalator" / "public"
OUTPUT_JSON = DATA_DIR / "results_intel.json"
EXCHANGE_DETAIL_DIR = PUBLIC_DIR / "intel" / "exchanges"
TEXTURE_DIR = configured_texture_dir()

SINCE_TS = int(dt.datetime(2026, 5, 1).timestamp())
PLACEHOLDER_END_TS = int(dt.datetime(2040, 1, 1).timestamp())
EVENT_ICON_NAME = "item_icon_00143.png"
RACE_THUMB_NAME = "thum_race_rt_000_1001_00.png"
FACTOR_RESEARCH_IMAGE = "intel/factor_research/factor_research.png"
LEGEND_RACE_IMAGE = "intel/legend/legend_vs.png"
CHAMPIONS_RACE_IMAGE = "intel/race/champions_logo.png"
HEROES_RACE_IMAGE = "intel/race/heroes_logo.png"
TRAINING_CHALLENGE_IMAGE = "intel/special/training_challenge_logo.png"
CHALLENGE_MATCH_IMAGE = "intel/special/challenge_match_logo.png"
ACTIVITY_EXCHANGE_PAY_ITEMS = {45, 58, 156, 159}
VOUCHER_EXCHANGE_PAY_CATEGORIES = {41, 42, 179}

SEASON_LABELS = {1: "春", 2: "夏", 3: "秋", 4: "冬"}
WEATHER_LABELS = {0: "随机", 1: "晴", 2: "多云", 3: "雨", 4: "雪"}
CONDITION_LABELS = {0: "随机", 1: "良", 2: "稍重", 3: "重", 4: "不良"}
GROUND_LABELS = {1: "草地", 2: "泥地"}
INOUT_LABELS = {1: "内", 2: "外", 3: "外→内"}
TURN_LABELS = {1: "逆", 2: "顺", 3: "直线"}
CHAMPIONS_ROUND_LABELS = {
    0: "公告",
    1: "第1轮",
    2: "第2轮",
    3: "第2轮",
    4: "决赛",
    5: "决赛",
    6: "决赛",
}
HEROES_STAGE_LABELS = {0: "主要赛事", 1: "主要赛事", 2: "特别赛事"}
HEROES_EVENT_NAME = "英杰集结战"


def optional_public_image(public_relative: str) -> str | None:
    return public_relative if (PUBLIC_DIR / public_relative).exists() else None


def factor_research_image() -> str | None:
    return optional_public_image(FACTOR_RESEARCH_IMAGE)


def legend_race_image() -> str | None:
    return optional_public_image(LEGEND_RACE_IMAGE)


def champions_race_image() -> str | None:
    return optional_public_image(CHAMPIONS_RACE_IMAGE)


def heroes_race_image() -> str | None:
    return optional_public_image(HEROES_RACE_IMAGE)


def training_challenge_image() -> str | None:
    return optional_public_image(TRAINING_CHALLENGE_IMAGE)


def challenge_match_image() -> str | None:
    return optional_public_image(CHALLENGE_MATCH_IMAGE)


def ts_to_str(ts: int) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def text_value(cur: sqlite3.Cursor, category: int, index: int) -> str | None:
    row = cur.execute(
        "SELECT text FROM text_data WHERE category = ? AND [index] = ?",
        (category, index),
    ).fetchone()
    return display_text(row[0]) if row else None


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def strip_backticks(value: str) -> str:
    return value.replace("`", "").strip()


def split_card_name(name: str) -> tuple[str, str]:
    match = re.match(r"^(\[[^\]]+\])(.+)$", name)
    if not match:
        return "", name.strip()
    return match.group(1), match.group(2).strip()


def texture_asset(filename: str) -> Path | None:
    if TEXTURE_DIR is None:
        return None
    return TEXTURE_DIR / filename


def copy_public_asset(src: Path | None, public_relative: str) -> str | None:
    dst = PUBLIC_DIR / public_relative
    if src is None or not src.exists():
        if dst.exists():
            return public_relative.replace("\\", "/")
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size == src.stat().st_size:
        return public_relative.replace("\\", "/")
    shutil.copy2(src, dst)
    return public_relative.replace("\\", "/")


def existing_public_asset(public_relative: str) -> str | None:
    return public_relative.replace("\\", "/") if (PUBLIC_DIR / public_relative).exists() else None


def copy_character_icon(card_id: int, chara_id: int | None, icon_paths: dict) -> str | None:
    candidates = []
    for key in (str(card_id), str(chara_id or "")):
        existing = icon_paths.get(key)
        if not existing:
            continue
        basename = Path(existing).name
        if basename.startswith("trained_chr_icon_"):
            candidates.append(basename.replace("trained_chr_icon_", "chr_icon_", 1))
        candidates.append(basename)

    for basename in candidates:
        if not basename.endswith("_02.png") and "_" in basename:
            continue
        copied = copy_public_asset(texture_asset(basename), f"intel/chara/{basename}")
        if copied:
            return copied

    if chara_id and TEXTURE_DIR is not None:
        matches = sorted(TEXTURE_DIR.glob(f"chr_icon_{chara_id}_*_02.png"))
        for match in matches:
            copied = copy_public_asset(match, f"intel/chara/{match.name}")
            if copied:
                return copied

    if chara_id:
        matches = sorted((PUBLIC_DIR / "intel" / "chara").glob(f"chr_icon_{chara_id}_*_02.png"))
        for match in matches:
            return f"intel/chara/{match.name}"

    return None


def copy_schedule_image(section_title: str) -> str | None:
    is_race_like = section_title == "大赛时间" or "赛事" in section_title or "G1" in section_title
    if is_race_like:
        return copy_public_asset(
            texture_asset(RACE_THUMB_NAME),
            f"intel/race/{RACE_THUMB_NAME}",
        )
    return copy_public_asset(
        texture_asset(EVENT_ICON_NAME),
        f"intel/item/{EVENT_ICON_NAME}",
    )


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", "", value.replace("\\n", "").replace("\n", ""))


def display_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\\n", " ").replace("\n", " ")).strip()


def time_ranges_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and a_end >= b_start


def copy_campaign_logo(campaign_id: int, image_icon_id: int | None = None) -> str | None:
    filename = f"tex_campaign_mission_logo_{int(campaign_id):05d}.png"
    copied = copy_public_asset(
        texture_asset(filename),
        f"intel/mission/{filename}",
    )
    if copied:
        return copied
    if image_icon_id:
        campaign_icon_name = f"campaign_icon_l_{int(image_icon_id):04d}.png"
        return copy_public_asset(
            texture_asset(campaign_icon_name),
            f"intel/campaign/{campaign_icon_name}",
        )
    return None


def copy_campaign_mission_logo(cur: sqlite3.Cursor, name: str, start: int, end: int) -> str | None:
    normalized_name = normalize_text(name)
    if not normalized_name:
        return None

    candidate_rows = cur.execute(
        """
        SELECT td.[index], cd.start_time, cd.end_time, td.text
        FROM text_data td
        JOIN campaign_data cd ON cd.campaign_id = td.[index]
        WHERE td.category = 187
        ORDER BY td.[index]
        """,
    ).fetchall()
    rows = [
        (logo_id, start_time, end_time)
        for logo_id, start_time, end_time, text in candidate_rows
        if normalized_name in normalize_text(text)
    ]
    rows.sort(
        key=lambda row: (
            0 if row[1] <= end and row[2] >= start else 1,
            abs(row[1] - start),
            -row[0],
        )
    )

    for logo_id, _start_time, _end_time in rows:
        copied = copy_campaign_logo(logo_id)
        if copied:
            return copied
    return None


def copy_piece_icon(card_id: int) -> str | None:
    for suffix in ("", "_no_frame"):
        filename = f"piece_icon_{int(card_id):06d}{suffix}.png"
        copied = copy_public_asset(texture_asset(filename), f"intel/piece/{filename}")
        if copied:
            return copied
    return None


def copy_item_icon(item_id: int) -> str | None:
    filename = f"item_icon_{int(item_id):05d}.png"
    return copy_public_asset(texture_asset(filename), f"intel/item/{filename}")


def reward_display_name(cur: sqlite3.Cursor, category: int, item_id: int) -> str:
    if category == 50:
        return text_value(cur, 4, item_id) or "角色"
    if category == 102:
        name = text_value(cur, 4, item_id)
        return f"{name}碎片" if name else "角色碎片"
    if category == 51:
        return text_value(cur, 75, item_id) or text_value(cur, 76, item_id) or "支援卡"
    return text_value(cur, 23, item_id) or text_value(cur, 4, item_id) or text_value(cur, 76, item_id) or "奖励"


def reward_icon(cur: sqlite3.Cursor, category: int, item_id: int) -> str | None:
    if not category or not item_id:
        return None
    if category == 50:
        chara_row = cur.execute(
            "SELECT chara_id FROM card_data WHERE id = ?",
            (item_id,),
        ).fetchone()
        chara_id = int(chara_row[0]) if chara_row else None
        return copy_character_icon(item_id, chara_id, load_json(DATA_DIR / "icon_paths.json"))
    if category == 102:
        return copy_piece_icon(item_id)
    if category == 51:
        filename = f"support_card_s_{int(item_id)}.png"
        return copy_public_asset(texture_asset(filename), f"intel/support/{filename}")
    return copy_item_icon(item_id)


def reward_item_summary(cur: sqlite3.Cursor, category: int, item_id: int, amount: int = 0) -> dict:
    return {
        "image": reward_icon(cur, category, item_id),
        "name": reward_display_name(cur, category, item_id),
        "rewardType": int(category),
        "rewardValue": int(item_id),
        "amount": int(amount or 0),
    }


def reward_drop(cur: sqlite3.Cursor, category: int, item_id: int, amount: int = 0, source: str = "") -> dict | None:
    if item_id in {45, 58, 156, 159}:
        return None
    name = reward_display_name(cur, category, item_id)
    if "锦旗" in name:
        return None
    image = reward_icon(cur, category, item_id)
    if not image:
        return None
    amount_label = f" x{amount}" if amount else ""
    source_label = f" · {source}" if source else ""
    return {
        "image": image,
        "name": name,
        "source": source,
        "label": f"{name}{amount_label}{source_label}",
        "rewardType": category,
        "rewardValue": item_id,
        "amount": amount,
        "isPiece": category == 102,
    }


def sort_reward_drops(drops: list[dict]) -> list[dict]:
    low_priority_ids = {59, 98, 110}
    deduped: dict[tuple[int, int], dict] = {}
    for drop in drops:
        key = (int(drop.get("rewardType") or 0), int(drop.get("rewardValue") or 0))
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = drop
            continue
        existing_amount = int(existing.get("amount") or 0)
        next_amount = int(drop.get("amount") or 0)
        total_amount = existing_amount + next_amount
        existing["amount"] = total_amount
        name = existing.get("name") or existing.get("label", "").split(" x", 1)[0]
        existing_source = existing.get("source") or ""
        next_source = drop.get("source") or ""
        source = existing_source if existing_source == next_source else "合计"
        existing["source"] = source
        source_label = f" · {source}" if source else ""
        existing["label"] = f"{name} x{total_amount}{source_label}"
    return sorted(
        deduped.values(),
        key=lambda item: (
            0 if item.get("isPiece") else 1,
            1 if int(item.get("rewardValue") or 0) in low_priority_ids else 0,
            -int(item.get("rewardValue") or 0),
        ),
    )


def exchange_row_filter(row_ids: list[int] | None) -> tuple[str, list[int]]:
    if not row_ids:
        return "", []
    placeholders = ",".join("?" for _ in row_ids)
    return f" AND id IN ({placeholders})", [int(row_id) for row_id in row_ids]


def exchange_reward_drops(cur: sqlite3.Cursor, shop_id: int, source: str = "兑换", row_ids: list[int] | None = None) -> list[dict]:
    if not shop_id:
        return []
    row_filter, params = exchange_row_filter(row_ids)
    rows = cur.execute(
        f"""
        SELECT change_item_category, change_item_id, change_item_num, change_item_limit_num, disp_order
        FROM item_exchange
        WHERE item_exchange_top_id = ?{row_filter}
        ORDER BY disp_order, id
        """,
        [shop_id, *params],
    ).fetchall()
    drops = []
    for category, item_id, amount, limit_num, _disp_order in rows:
        total_amount = amount * limit_num if limit_num else amount
        drop = reward_drop(cur, category, item_id, total_amount, source)
        if drop:
            drops.append(drop)
    return drops


def exchange_pay_icon(cur: sqlite3.Cursor, shop_id: int) -> str | None:
    row = cur.execute(
        """
        SELECT pay_item_category, pay_item_id
        FROM item_exchange
        WHERE item_exchange_top_id = ?
          AND pay_item_id > 0
        GROUP BY pay_item_category, pay_item_id
        ORDER BY COUNT(*) DESC, pay_item_id DESC
        LIMIT 1
        """,
        (shop_id,),
    ).fetchone()
    if not row:
        return None
    return reward_icon(cur, int(row[0]), int(row[1]))


def exchange_detail_rows(cur: sqlite3.Cursor, shop_id: int, row_ids: list[int] | None = None) -> list[dict]:
    row_filter, params = exchange_row_filter(row_ids)
    rows = cur.execute(
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
        change_category,
        change_item_id,
        change_num,
        limit_num,
        additional_piece_num,
        pay_category,
        pay_item_id,
        pay_num,
        disp_order,
        row_id,
    ) in rows:
        reward = reward_item_summary(cur, int(change_category), int(change_item_id), int(change_num))
        reward_name = reward.get("name") or ""
        if int(change_item_id) in {45, 58, 156, 159} or "锦旗" in reward_name:
            continue
        details.append(
            {
                "id": int(row_id),
                "order": int(disp_order),
                "reward": reward,
                "pay": reward_item_summary(cur, int(pay_category), int(pay_item_id), int(pay_num)),
                "limit": int(limit_num or 0),
                "totalRewardAmount": int(change_num or 0) * int(limit_num or 0) if limit_num else int(change_num or 0),
                "additionalPieceAmount": int(additional_piece_num or 0),
            }
        )
    return details


def write_exchange_detail_file(exchange_key: int | str, details: list[dict]) -> str:
    EXCHANGE_DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    safe_key = re.sub(r"[^0-9A-Za-z_-]", "_", str(exchange_key))
    path = EXCHANGE_DETAIL_DIR / f"exchange_{safe_key}.json"
    path.write_text(
        json.dumps({"exchangeDetails": details}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return f"intel/exchanges/{path.name}"


def is_activity_exchange_shop(cur: sqlite3.Cursor, shop_id: int, name: str, description: str) -> bool:
    label = normalize_text(f"{name} {description}")
    if "考试币" in label or "嘉年华积分" in label:
        return True
    rows = cur.execute(
        """
        SELECT DISTINCT pay_item_id
        FROM item_exchange
        WHERE item_exchange_top_id = ?
          AND pay_item_id > 0
        """,
        (shop_id,),
    ).fetchall()
    pay_item_ids = {int(row[0]) for row in rows}
    return bool(pay_item_ids) and pay_item_ids.issubset(ACTIVITY_EXCHANGE_PAY_ITEMS)


def is_voucher_exchange_shop(cur: sqlite3.Cursor, shop_id: int) -> bool:
    rows = cur.execute(
        """
        SELECT DISTINCT pay_item_category
        FROM item_exchange
        WHERE item_exchange_top_id = ?
          AND pay_item_id > 0
        """,
        (shop_id,),
    ).fetchall()
    pay_categories = {int(row[0]) for row in rows}
    return bool(pay_categories & VOUCHER_EXCHANGE_PAY_CATEGORIES)


def exchange_pay_summary(cur: sqlite3.Cursor, shop_id: int, row_ids: list[int] | None = None) -> tuple[str | None, list[str]]:
    row_filter, params = exchange_row_filter(row_ids)
    rows = cur.execute(
        f"""
        SELECT DISTINCT pay_item_category, pay_item_id
        FROM item_exchange
        WHERE item_exchange_top_id = ?{row_filter}
          AND pay_item_id > 0
        ORDER BY pay_item_category, pay_item_id
        """,
        [shop_id, *params],
    ).fetchall()
    names = [reward_display_name(cur, int(category), int(item_id)) for category, item_id in rows]
    image = None
    if rows:
        image = reward_icon(cur, int(rows[0][0]), int(rows[0][1]))
    return image, names


def build_exchange_schedule(
    cur: sqlite3.Cursor,
    shop_id: int,
    name: str,
    start: int,
    end: int,
    is_voucher_exchange: bool,
    row_ids: list[int] | None = None,
    suffix: str = "",
) -> dict | None:
    image, pay_names = exchange_pay_summary(cur, shop_id, row_ids)
    display_name = name
    if pay_names:
        visible_pay_names = [
            pay_name
            for pay_name in pay_names
            if normalize_text(pay_name) and normalize_text(pay_name) not in normalize_text(name)
        ]
        if visible_pay_names:
            display_name = f"{name} · {' / '.join(visible_pay_names[:2])}"
            if len(visible_pay_names) > 2:
                display_name += f" +{len(visible_pay_names) - 2}"
    if suffix and not is_voucher_exchange:
        display_name = f"{display_name} · {suffix}"

    detail_drops = sort_reward_drops(exchange_reward_drops(cur, shop_id, "兑换", row_ids))
    if not detail_drops:
        return None
    detail_key = f"{shop_id}_{start}_{end}" if row_ids else shop_id
    details = exchange_detail_rows(cur, shop_id, row_ids)
    preview_drops = [] if is_voucher_exchange else detail_drops[:10]
    if not is_voucher_exchange and len(detail_drops) > 10:
        preview_drops.append(
            {
                "label": f"+{len(detail_drops) - 10}",
                "countOnly": True,
            }
        )
    schedule_id = int(detail_key) if isinstance(detail_key, int) else 2_000_000_000 + zlib.crc32(str(detail_key).encode("utf-8"))
    return {
        "id": schedule_id,
        "name": display_name,
        "type": "兑换券兑换" if is_voucher_exchange else "物品兑换",
        "start": ts_to_str(int(start)),
        "end": ts_to_str(int(end)),
        "startTimestamp": int(start),
        "endTimestamp": int(end),
        "image": image,
        "drops": preview_drops,
        "exchangeDetailPath": write_exchange_detail_file(detail_key, details),
        "exchangeDetailCount": len(details),
        "isVoucherExchange": is_voucher_exchange,
    }


def campaign_drop_icons(cur: sqlite3.Cursor, effect_type: int, value: int) -> list[dict]:
    if effect_type != 9 or not value:
        return []
    rows = cur.execute(
        """
        SELECT item_id, reward_type, reward_value
        FROM campaign_single_race_add_reward
        WHERE race_additional_reward_id = ?
        ORDER BY reward_type, reward_value, item_id
        """,
        (value,),
    ).fetchall()
    drops = []
    seen = set()
    for item_id, reward_type, reward_value in rows:
        if item_id in seen:
            continue
        seen.add(item_id)
        image = copy_piece_icon(item_id)
        if image:
            name = reward_display_name(cur, 102, item_id)
            drops.append(
                {
                    "image": image,
                    "name": name,
                    "source": "掉落",
                    "label": name,
                    "rewardType": reward_type,
                    "rewardValue": reward_value,
                }
            )
    return drops


def copy_legend_race_piece(cur: sqlite3.Cursor, name: str) -> str | None:
    rows = cur.execute(
        """
        SELECT td.[index], td.text
        FROM text_data td
        JOIN card_data cd ON cd.id = td.[index]
        WHERE td.category = 4
        ORDER BY td.[index]
        """,
    ).fetchall()
    normalized_name = normalize_text(name)
    horse_name = normalize_text(name.split("]")[-1])
    matches = [
        (card_id, text)
        for card_id, text in rows
        if normalize_text(text) == normalized_name
    ]
    if not matches and horse_name:
        matches = [
            (card_id, text)
            for card_id, text in rows
            if horse_name in normalize_text(text)
        ]

    for card_id, _text in matches:
        copied = copy_piece_icon(card_id)
        if copied:
            return copied
    return None


def legend_race_drops(cur: sqlite3.Cursor, name: str) -> list[dict]:
    rows = cur.execute(
        """
        SELECT td.[index], td.text
        FROM text_data td
        JOIN card_data cd ON cd.id = td.[index]
        WHERE td.category = 4
        ORDER BY td.[index]
        """,
    ).fetchall()
    normalized_name = normalize_text(name)
    horse_name = normalize_text(name.split("]")[-1])
    matches = [
        (card_id, text)
        for card_id, text in rows
        if normalize_text(text) == normalized_name
    ]
    if not matches and horse_name:
        matches = [
            (card_id, text)
            for card_id, text in rows
            if horse_name in normalize_text(text)
        ]

    for card_id, _text in matches:
        image = copy_piece_icon(card_id)
        if image:
            piece_name = reward_display_name(cur, 102, card_id)
            return [
                {
                    "image": image,
                    "name": piece_name,
                    "source": "掉落",
                    "label": piece_name,
                    "rewardType": 102,
                    "rewardValue": card_id,
                }
            ]
    return []


def training_challenge_reward_drops(cur: sqlite3.Cursor, exam_ids: list[int], shop_id: int) -> list[dict]:
    drops = []
    if exam_ids:
        placeholders = ",".join("?" for _ in exam_ids)
        rows = cur.execute(
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
        ).fetchall()
        for row in rows:
            for index in range(0, len(row), 3):
                drop = reward_drop(cur, row[index], row[index + 1], row[index + 2], "考试")
                if drop:
                    drops.append(drop)
    drops.extend(exchange_reward_drops(cur, shop_id, "兑换"))
    return sort_reward_drops(drops)


def challenge_match_reward_drops(cur: sqlite3.Cursor, match_id: int, shop_id: int) -> list[dict]:
    rows = cur.execute(
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
    ).fetchall()
    drops = []
    for row in rows:
        for index in range(0, 9, 3):
            drop = reward_drop(cur, row[index], row[index + 1], row[index + 2], "首通")
            if drop:
                drops.append(drop)
        for index in range(9, len(row), 3):
            drop = reward_drop(cur, row[index], row[index + 1], row[index + 2], "掉落")
            if drop:
                drops.append(drop)
    drops.extend(exchange_reward_drops(cur, shop_id, "兑换"))
    return sort_reward_drops(drops)


def mission_reward_drops(cur: sqlite3.Cursor, campaign_id: int) -> list[dict]:
    rows = cur.execute(
        """
        SELECT item_category, item_id, item_num
        FROM mission_data
        WHERE event_id = ?
        ORDER BY step_group_id, step_order, disp_order, id
        """,
        (campaign_id,),
    ).fetchall()
    drops = []
    for category, item_id, amount in rows:
        drop = reward_drop(cur, category, item_id, amount, "任务")
        if drop:
            drops.append(drop)
    return sort_reward_drops(drops)


def factor_research_reward_drops(cur: sqlite3.Cursor, event_id: int) -> list[dict]:
    rows = cur.execute(
        """
        SELECT fbr.item_category, fbr.item_id, fbr.item_num, fbr.box_num
        FROM factor_research_box frb
        JOIN factor_research_box_reward fbr ON fbr.box_id = frb.box_id
        WHERE frb.factor_research_event_id = ?
        ORDER BY fbr.prize_type, fbr.rate, fbr.id
        """,
        (event_id,),
    ).fetchall()
    drops = []
    for category, item_id, amount, box_num in rows:
        drop = reward_drop(cur, category, item_id, amount * box_num, "奖励")
        if drop:
            drops.append(drop)
    return sort_reward_drops(drops)


def campaign_walking_reward_drops(cur: sqlite3.Cursor, campaign_id: int) -> list[dict]:
    rows = cur.execute(
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
    ).fetchall()
    drops = []
    for category, item_id, amount, limit_num in rows:
        total_amount = amount * limit_num if limit_num else amount
        drop = reward_drop(cur, category, item_id, total_amount, "散步")
        if drop:
            drops.append(drop)
    return sort_reward_drops(drops)


def condition_rate_summary(cur: sqlite3.Cursor, season: int, weather: int, condition: int) -> dict | None:
    if not season or (weather and condition):
        return None
    rows = cur.execute(
        """
        SELECT weather, ground, rate
        FROM race_condition
        WHERE area = 999 AND season = ? AND rate > 0
        ORDER BY weather, ground
        """,
        (season,),
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
    for weather_value, condition_value, rate in filtered:
        weather_totals[weather_value] = weather_totals.get(weather_value, 0) + rate
        condition_totals[condition_value] = condition_totals.get(condition_value, 0) + rate
        combos.append(
            {
                "weather": WEATHER_LABELS.get(weather_value, str(weather_value)),
                "condition": CONDITION_LABELS.get(condition_value, str(condition_value)),
                "rate": round(rate / total * 100, 1),
            }
        )
    return {
        "weather": [
            {"label": WEATHER_LABELS.get(key, str(key)), "rate": round(value / total * 100, 1)}
            for key, value in weather_totals.items()
        ],
        "condition": [
            {"label": CONDITION_LABELS.get(key, str(key)), "rate": round(value / total * 100, 1)}
            for key, value in condition_totals.items()
        ],
        "combos": combos,
    }


def race_course_detail(
    cur: sqlite3.Cursor,
    race_instance_id: int,
    season: int = 0,
    weather: int = 0,
    condition: int = 0,
    label: str = "",
) -> dict | None:
    row = cur.execute(
        """
        SELECT ri.race_id, r.thumbnail_id, r.entry_num, rcs.race_track_id,
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
    race_id, thumbnail_id, entry_num, track_id, distance, ground, inout, turn = row
    race_name = text_value(cur, 29, race_instance_id) or text_value(cur, 33, race_id) or ""
    track_name = text_value(cur, 31, track_id) or text_value(cur, 34, track_id) or ""
    return {
        "label": label,
        "raceName": race_name,
        "track": track_name,
        "distance": distance,
        "ground": GROUND_LABELS.get(ground, str(ground)),
        "inout": INOUT_LABELS.get(inout, str(inout)),
        "turn": TURN_LABELS.get(turn, str(turn)),
        "season": SEASON_LABELS.get(season, "随机" if season == 0 else str(season)),
        "weather": WEATHER_LABELS.get(weather, str(weather)),
        "condition": CONDITION_LABELS.get(condition, str(condition)),
        "seasonValue": season,
        "weatherValue": weather,
        "conditionValue": condition,
        "conditionRates": condition_rate_summary(cur, season, weather, condition),
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


def champions_race_details(cur: sqlite3.Cursor, start: int, end: int) -> list[dict]:
    schedules = cur.execute(
        """
        SELECT id, start_date, end_date
        FROM champions_schedule
        WHERE start_date < ? AND end_date >= ?
        ORDER BY (MIN(end_date, ?) - MAX(start_date, ?)) DESC, start_date DESC
        LIMIT 1
        """,
        (end, start, end, start),
    ).fetchall()
    if not schedules:
        return []
    champions_id = schedules[0][0]
    rows = cur.execute(
        """
        SELECT crc.round_id, crc.race_instance_id, rc.season, rc.weather, rc.ground
        FROM champions_race_condition crc
        JOIN race_condition rc ON rc.id = crc.race_condition_id
        WHERE crc.champions_id = ? AND crc.round_id > 0
        ORDER BY crc.round_id
        """,
        (champions_id,),
    ).fetchall()
    grouped: dict[tuple[int, int, int, int], dict] = {}
    for _round_id, race_instance_id, season, weather, condition in rows:
        key = (race_instance_id, season, weather, condition)
        entry = grouped.setdefault(
            key,
            {
                "raceInstanceId": race_instance_id,
                "season": season,
                "weather": weather,
                "condition": condition,
            },
        )

    details = []
    for entry in grouped.values():
        detail = race_course_detail(
            cur,
            entry["raceInstanceId"],
            entry["season"],
            entry["weather"],
            entry["condition"],
            "",
        )
        if detail:
            details.append(detail)
    return dedupe_race_details(details)


def heroes_race_details(cur: sqlite3.Cursor, start: int, end: int) -> list[dict]:
    rows = cur.execute(
        """
        SELECT hrc.stage, hrc.race_instance_id, hrc.season, hrc.weather, hrc.ground
        FROM heroes_data hd
        JOIN heroes_race_condition hrc ON hrc.heroes_id = hd.heroes_id
        WHERE hd.start_date < ? AND hd.end_date >= ?
        ORDER BY hrc.stage, hrc.id
        """,
        (end, start),
    ).fetchall()
    details = []
    seen = set()
    for stage, race_instance_id, season, weather, condition in rows:
        label = HEROES_STAGE_LABELS.get(stage, f"阶段{stage}")
        key = (label, race_instance_id, season, weather, condition)
        if key in seen:
            continue
        seen.add(key)
        detail = race_course_detail(cur, race_instance_id, season, weather, condition, label)
        if detail:
            details.append(detail)
    return dedupe_race_details(details)


def race_schedule_details(cur: sqlite3.Cursor, start: int, end: int) -> list[dict]:
    return champions_race_details(cur, start, end) or heroes_race_details(cur, start, end)


def generate_heroes_races() -> list[dict]:
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT heroes_id, start_date, end_date
        FROM heroes_data
        WHERE end_date >= ? AND end_date < ?
        ORDER BY start_date, heroes_id
        """,
        (SINCE_TS, PLACEHOLDER_END_TS),
    ).fetchall()
    races = []
    for heroes_id, start, end in rows:
        races.append(
            {
                "id": 100000 + heroes_id,
                "name": HEROES_EVENT_NAME,
                "type": "英杰集结战",
                "start": ts_to_str(start),
                "end": ts_to_str(end),
                "startTimestamp": start,
                "endTimestamp": end,
                "image": heroes_race_image(),
                "drops": [],
                "details": heroes_race_details(cur, start, end),
            }
        )
    conn.close()
    return races


def story_event_ids_for_event(cur: sqlite3.Cursor, name: str, start: int, end: int) -> list[int]:
    normalized_name = normalize_text(name)
    story_ids = [
        row[0]
        for row in cur.execute(
            """
            SELECT [index], text
            FROM text_data
            WHERE category = 214
            ORDER BY [index]
            """,
        ).fetchall()
        if normalized_name and normalized_name in normalize_text(row[1])
    ]

    if not story_ids:
        story_ids = [
            row[0]
            for row in cur.execute(
                """
                SELECT story_event_id, start_date, end_date
                FROM story_event_data
                WHERE end_date >= ? AND start_date <= ?
                ORDER BY ABS(start_date - ?), story_event_id DESC
                """,
                (start, end, start),
            ).fetchall()
        ]

    seen = set()
    deduped = []
    for story_id in story_ids:
        if story_id in seen:
            continue
        seen.add(story_id)
        deduped.append(story_id)
    return deduped


def copy_story_event_logo(cur: sqlite3.Cursor, name: str, start: int, end: int) -> str | None:
    story_ids = story_event_ids_for_event(cur, name, start, end)

    for story_id in story_ids:
        for filename in (
            f"tex_storyevent_logo_{int(story_id)}.png",
            f"chara_story_thumb_{int(story_id)}.png",
        ):
            copied = copy_public_asset(
                texture_asset(filename),
                f"intel/story/{filename}",
            )
            if copied:
                return copied
    return None


def story_event_reward_drops(cur: sqlite3.Cursor, name: str, start: int, end: int) -> list[dict]:
    story_ids = story_event_ids_for_event(cur, name, start, end)
    if not story_ids:
        return []
    placeholders = ",".join("?" for _ in story_ids)
    drops = []

    for category, item_id, amount in cur.execute(
        f"""
        SELECT item_category, item_id, item_num
        FROM story_event_point_reward
        WHERE story_event_id IN ({placeholders})
        """,
        story_ids,
    ).fetchall():
        drop = reward_drop(cur, category, item_id, amount, "点数")
        if drop:
            drops.append(drop)

    for category, item_id, amount in cur.execute(
        f"""
        SELECT sem.item_category, sem.item_id, sem.item_num
        FROM story_event_mission sem
        WHERE sem.story_event_id IN ({placeholders})
        """,
        story_ids,
    ).fetchall():
        drop = reward_drop(cur, category, item_id, amount, "任务")
        if drop:
            drops.append(drop)

    for category, item_id, amount in cur.execute(
        f"""
        SELECT add_reward_category_1, add_reward_id_1, add_reward_num_1
        FROM story_event_story_data
        WHERE story_event_id IN ({placeholders})
        UNION ALL
        SELECT add_reward_category_2, add_reward_id_2, add_reward_num_2
        FROM story_event_story_data
        WHERE story_event_id IN ({placeholders})
        """,
        [*story_ids, *story_ids],
    ).fetchall():
        drop = reward_drop(cur, category, item_id, amount, "剧情")
        if drop:
            drops.append(drop)

    for category, item_id, amount in cur.execute(
        f"""
        SELECT sbr.item_category, sbr.item_id, sbr.item_num
        FROM story_event_roulette_bingo serb
        JOIN story_event_bingo_reward sbr ON sbr.reward_set_id = serb.reward_set_id
        WHERE serb.story_event_id IN ({placeholders})
        """,
        story_ids,
    ).fetchall():
        drop = reward_drop(cur, category, item_id, amount, "宾果")
        if drop:
            drops.append(drop)

    return sort_reward_drops(drops)


def parse_report() -> dict:
    if not REPORT_MD.exists():
        return {
            "rewardSummary": [],
            "eventSections": [],
            "storyRewardSummary": [],
            "freeDraws": [],
            "loginBonuses": [],
        }

    lines = REPORT_MD.read_text(encoding="utf-8").splitlines()
    reward_summary = []
    event_sections = []
    story_reward_summary = []
    free_draws = []
    login_bonuses = []

    section = ""
    subsection = ""
    current_event_section = None
    current_event = None
    current_free = None
    current_login = None

    for raw_line in lines:
        line = raw_line.rstrip()
        if line.startswith("## "):
            section = strip_backticks(line.lstrip("# "))
            subsection = ""
            current_event_section = None
            current_event = None
            current_free = None
            current_login = None
            continue

        if line.startswith("### "):
            subsection = re.sub(r"^\d+\.\s*", "", strip_backticks(line.lstrip("# ")))
            current_event = None
            current_free = None
            current_login = None
            if section.startswith("二、活动"):
                current_event_section = {"title": subsection, "items": []}
                event_sections.append(current_event_section)
            else:
                current_event_section = None
            continue

        if section.startswith("一、汇总奖励版"):
            match = re.match(r"^-\s*(.+?)：(.+)$", line)
            if match:
                reward_summary.append(
                    {"label": match.group(1).strip(), "value": strip_backticks(match.group(2))}
                )
            continue

        if section.startswith("二、活动") and current_event_section is not None:
            name_match = re.match(r"^-\s*`(.+)`$", line)
            date_match = re.match(r"^\s*-\s*`([^`]+)`\s*-\s*`([^`]+)`$", line)
            if name_match:
                current_event = {"name": name_match.group(1), "start": "", "end": ""}
                current_event_section["items"].append(current_event)
            elif date_match and current_event is not None:
                current_event["start"] = date_match.group(1)
                current_event["end"] = date_match.group(2)
            continue

        if section.startswith("三、剧情活动") and subsection == "剧情活动奖励汇总":
            match = re.match(r"^-\s*(.+?)\s+`([^`]+)`$", line)
            if match:
                story_reward_summary.append(
                    {"label": match.group(1).strip(), "value": match.group(2).strip()}
                )
            continue

        if section.startswith("五、免费抽统计"):
            pool_match = re.match(r"^-\s*`(\d+)`\s*`(.+)`\s*(.+)$", line)
            amount_match = re.match(r"^\s*-\s*`(.+)`$", line)
            if pool_match:
                current_free = {
                    "gachaId": int(pool_match.group(1)),
                    "name": pool_match.group(2),
                    "type": pool_match.group(3).strip(),
                    "amount": "",
                }
                free_draws.append(current_free)
            elif amount_match and current_free is not None:
                current_free["amount"] = amount_match.group(1)
            continue

        if section.startswith("六、登录奖励统计"):
            period_match = re.match(r"^-\s*`([^`]+)`\s*-\s*`([^`]+)`$", line)
            detail_match = re.match(r"^\s*-\s*(.+)$", line)
            if period_match:
                current_login = {
                    "start": period_match.group(1),
                    "end": period_match.group(2),
                    "details": [],
                }
                login_bonuses.append(current_login)
            elif detail_match and current_login is not None and not subsection.startswith("登录奖励合计"):
                current_login["details"].append(strip_backticks(detail_match.group(1)))

    event_sections = [s for s in event_sections if s["items"]]
    return {
        "rewardSummary": reward_summary,
        "eventSections": event_sections,
        "storyRewardSummary": story_reward_summary,
        "freeDraws": free_draws,
        "loginBonuses": login_bonuses,
    }


def generate_gacha_data() -> list[dict]:
    icon_paths = load_json(DATA_DIR / "icon_paths.json")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT
            ga.gacha_id,
            ga.card_id,
            ga.card_type,
            ga.rarity,
            gd.start_date,
            gd.end_date,
            td.text,
            cd.chara_id,
            scd.chara_id
        FROM gacha_available ga
        JOIN gacha_data gd ON ga.gacha_id = gd.id
        JOIN text_data td
          ON ga.card_id = td.[index]
         AND td.category = CASE ga.card_type WHEN 1 THEN 4 WHEN 2 THEN 75 END
        LEFT JOIN card_data cd ON ga.card_type = 1 AND cd.id = ga.card_id
        LEFT JOIN support_card_data scd ON ga.card_type = 2 AND scd.id = ga.card_id
        WHERE ga.is_pickup = 1
          AND gd.start_date >= ?
          AND gd.end_date < ?
        ORDER BY gd.start_date, gd.end_date, ga.gacha_id, ga.card_type, ga.recommend_order, ga.card_id
        """,
        (SINCE_TS, PLACEHOLDER_END_TS),
    ).fetchall()
    conn.close()

    grouped: dict[tuple[int, str], dict] = {}
    for gacha_id, card_id, card_type, rarity, start_ts, end_ts, name, chara_id, support_chara_id in rows:
        pool_type = "角色卡池" if card_type == 1 else "支援卡"
        key = (gacha_id, pool_type)
        group = grouped.setdefault(
            key,
            {
                "id": gacha_id,
                "type": pool_type,
                "start": ts_to_str(start_ts),
                "end": ts_to_str(end_ts),
                "startTimestamp": start_ts,
                "endTimestamp": end_ts,
                "bannerImage": None,
                "cards": [],
            },
        )

        banner_src = texture_asset(f"img_bnr_gacha_{gacha_id}.png")
        if group["bannerImage"] is None:
            group["bannerImage"] = copy_public_asset(
                banner_src, f"intel/gacha/img_bnr_gacha_{gacha_id}.png"
            )

        title, character_name = split_card_name(name)
        image = None
        if card_type == 1:
            image = copy_character_icon(card_id, chara_id, icon_paths)
        else:
            support_src = texture_asset(f"support_card_s_{card_id}.png")
            image = copy_public_asset(
                support_src, f"intel/support/support_card_s_{card_id}.png"
            )

        group["cards"].append(
            {
                "id": card_id,
                "type": "character" if card_type == 1 else "support",
                "name": name,
                "title": title,
                "characterName": character_name,
                "rarity": rarity,
                "image": image,
            }
        )

    return sorted(grouped.values(), key=lambda item: (item["startTimestamp"], item["type"], item["id"]))


def report_events_to_schedule(event_sections: list[dict], include_races: bool = False) -> list[dict]:
    events = []
    event_id = 1
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    for section in event_sections:
        is_race_section = section["title"] == "大赛时间"
        if include_races != is_race_section:
            continue
        for item in section["items"]:
            if not item.get("start") or not item.get("end"):
                continue
            start = int(dt.datetime.strptime(item["start"], "%Y-%m-%d %H:%M:%S").timestamp())
            end = int(dt.datetime.strptime(item["end"], "%Y-%m-%d %H:%M:%S").timestamp())
            if end < SINCE_TS or end >= PLACEHOLDER_END_TS:
                continue
            image = None
            drops = []
            if section["title"] == "传奇赛事时间":
                image = legend_race_image()
                drops = legend_race_drops(cur, item["name"])
            if image is None and section["title"] == "剧情活动时间":
                image = copy_story_event_logo(cur, item["name"], start, end)
                drops = story_event_reward_drops(cur, item["name"], start, end)
            if image is None and not include_races:
                image = copy_campaign_mission_logo(cur, item["name"], start, end)
            if image is None:
                image = copy_schedule_image(section["title"])
            if include_races:
                image = champions_race_image()
            details = race_schedule_details(cur, start, end) if include_races else []
            events.append(
                {
                    "id": event_id,
                    "name": item["name"],
                    "type": section["title"],
                    "start": item["start"],
                    "end": item["end"],
                    "startTimestamp": start,
                    "endTimestamp": end,
                    "image": image,
                    "drops": drops,
                    "details": details,
                }
            )
            event_id += 1
    conn.close()
    return sorted(events, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"]))


def generate_campaign_tasks() -> list[dict]:
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT cd.campaign_id, cd.effect_type_1, cd.effect_value_1, cd.image_icon_id, cd.start_time, cd.end_time, td.text
        FROM campaign_data cd
        JOIN text_data td ON td.category = 187 AND td.[index] = cd.campaign_id
        WHERE cd.end_time >= ?
          AND cd.end_time < ?
          AND TRIM(td.text) <> ''
        ORDER BY cd.start_time, cd.end_time, cd.campaign_id
        """,
        (SINCE_TS, PLACEHOLDER_END_TS),
    ).fetchall()
    tasks = []
    for campaign_id, effect_type, effect_value, image_icon_id, start_ts, end_ts, text in rows:
        name = display_text(text)
        if not name:
            continue
        image = copy_campaign_logo(campaign_id, image_icon_id)
        drops = [
            *campaign_drop_icons(cur, effect_type, effect_value),
            *mission_reward_drops(cur, campaign_id),
            *campaign_walking_reward_drops(cur, campaign_id),
        ]
        tasks.append(
            {
                "id": campaign_id,
                "name": name,
                "type": "效果" if image and "/campaign/" in image else "任务",
                "start": ts_to_str(start_ts),
                "end": ts_to_str(end_ts),
                "startTimestamp": start_ts,
                "endTimestamp": end_ts,
                "image": image,
                "drops": sort_reward_drops(drops),
            }
        )
    conn.close()
    return tasks


def generate_factor_research_events() -> list[dict]:
    if not FACTOR_RESEARCH_CSV.exists():
        return []
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    events = []
    with FACTOR_RESEARCH_CSV.open(newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            start = int(row["start_date"])
            end = int(row["end_date"])
            if end < SINCE_TS or end >= PLACEHOLDER_END_TS:
                continue
            events.append(
                {
                    "id": int(row["factor_research_event_id"]),
                    "name": row["event_name"].strip() or "因子研究",
                    "type": "因子研究",
                    "start": row["start_date_str"],
                    "end": row["end_date_str"],
                    "startTimestamp": start,
                    "endTimestamp": end,
                    "image": factor_research_image(),
                    "drops": factor_research_reward_drops(cur, int(row["factor_research_event_id"])),
                }
            )
    conn.close()
    return events


def generate_training_challenge_events() -> list[dict]:
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT id, target_main_scenario,
               exam_id_1, exam_id_2, exam_id_3, exam_id_4, exam_id_5, ex_exam_id, free_exam_id,
               shop_id, start_date, end_date, start_result_date, end_result_date
        FROM training_challenge_master
        WHERE end_result_date >= ? AND end_result_date < ?
        ORDER BY start_date, id
        """,
        (SINCE_TS, PLACEHOLDER_END_TS),
    ).fetchall()
    events = []
    image = training_challenge_image()
    for row in rows:
        challenge_id, scenario_id, *exam_values, shop_id, start, end, result_start, result_end = row
        exam_ids = [int(value) for value in exam_values if int(value)]
        name = "训练员技能考试"
        scenario_name = text_value(cur, 147, scenario_id)
        if scenario_name:
            name = f"{name} - {scenario_name}"
        events.append(
            {
                "id": 600000 + int(challenge_id),
                "name": name,
                "type": "训练员技能考试",
                "start": ts_to_str(start),
                "end": ts_to_str(result_end or end),
                "startTimestamp": start,
                "endTimestamp": result_end or end,
                "image": image,
                "details": [
                    {
                        "label": "考试",
                        "raceName": f"{ts_to_str(start)[5:16]} - {ts_to_str(end)[5:16]}",
                    },
                    {
                        "label": "结果/兑换",
                        "raceName": f"{ts_to_str(result_start)[5:16]} - {ts_to_str(result_end)[5:16]}",
                    },
                ],
                "drops": training_challenge_reward_drops(cur, exam_ids, shop_id),
                "shopId": shop_id,
            }
        )
    conn.close()
    return events


def generate_challenge_match_events() -> list[dict]:
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    rows = cur.execute(
        """
        SELECT challenge_match_id, item_exchange_top_id, start_date, ending_date, end_date
        FROM challenge_match_data
        WHERE end_date >= ? AND end_date < ?
        ORDER BY start_date, challenge_match_id
        """,
        (SINCE_TS, PLACEHOLDER_END_TS),
    ).fetchall()
    events = []
    image = challenge_match_image()
    for match_id, shop_id, start, ending, end in rows:
        events.append(
            {
                "id": 700000 + int(match_id),
                "name": "竞速嘉年华",
                "type": "竞速嘉年华",
                "start": ts_to_str(start),
                "end": ts_to_str(end),
                "startTimestamp": start,
                "endTimestamp": end,
                "image": image,
                "details": [
                    {
                        "label": "赛事",
                        "raceName": f"{ts_to_str(start)[5:16]} - {ts_to_str(ending)[5:16]}",
                    },
                    {
                        "label": "兑换",
                        "raceName": f"{ts_to_str(ending + 1)[5:16]} - {ts_to_str(end)[5:16]}",
                    },
                ],
                "drops": challenge_match_reward_drops(cur, match_id, shop_id),
                "shopId": shop_id,
            }
        )
    conn.close()
    return events


def generate_exchange_data() -> list[dict]:
    if EXCHANGE_DETAIL_DIR.exists():
        shutil.rmtree(EXCHANGE_DETAIL_DIR)
    conn = sqlite3.connect(MASTER_DB)
    cur = conn.cursor()
    now_ts = int(dt.datetime.now().timestamp())
    rows = cur.execute(
        """
        SELECT iet.id, iet.start_date, iet.end_date, td39.text, td40.text
        FROM item_exchange_top iet
        LEFT JOIN text_data td39 ON td39.category = 39 AND td39.[index] = iet.id
        LEFT JOIN text_data td40 ON td40.category = 40 AND td40.[index] = iet.id
        WHERE iet.end_date >= ?
        ORDER BY iet.start_date, iet.end_date, iet.id
        """,
        (now_ts,),
    ).fetchall()
    exchanges = []
    for shop_id, start, end, raw_name, raw_description in rows:
        name = display_text(raw_name or raw_description or "物品兑换")
        description = display_text(raw_description or "")
        if is_activity_exchange_shop(cur, int(shop_id), name, description):
            continue
        if "女神像" in normalize_text(f"{name} {description}"):
            continue
        is_voucher_exchange = is_voucher_exchange_shop(cur, int(shop_id))

        item_rows = cur.execute(
            """
            SELECT id, start_date, end_date
            FROM item_exchange
            WHERE item_exchange_top_id = ?
              AND start_date >= ?
              AND start_date < ?
              AND end_date >= start_date
            ORDER BY start_date, end_date, disp_order, id
            """,
            (shop_id, now_ts, PLACEHOLDER_END_TS),
        ).fetchall()
        grouped_rows: dict[tuple[int, int], list[int]] = {}
        for row_id, row_start, row_end in item_rows:
            grouped_rows.setdefault((int(row_start), int(row_end)), []).append(int(row_id))

        for (row_start, row_end), row_ids in grouped_rows.items():
            suffix = "追加" if int(start) < now_ts or row_start != int(start) else ""
            schedule = build_exchange_schedule(
                cur,
                int(shop_id),
                name,
                row_start,
                row_end,
                is_voucher_exchange,
                row_ids,
                suffix,
            )
            if schedule:
                exchanges.append(schedule)
    conn.close()
    return sorted(exchanges, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["name"]))


def generate_extra_activity_events() -> list[dict]:
    return [
        *generate_factor_research_events(),
        *generate_training_challenge_events(),
        *generate_challenge_match_events(),
    ]


def merge_event_schedules(report_events: list[dict], campaign_tasks: list[dict], extra_events: list[dict] | None = None) -> list[dict]:
    merged = []
    extra_events = extra_events or []
    deduped_tasks = {}
    for task in campaign_tasks:
        key = (task["name"], task["startTimestamp"], task["endTimestamp"])
        existing = deduped_tasks.get(key)
        if existing is None or (not existing.get("image") and task.get("image")):
            deduped_tasks[key] = task
    campaign_tasks = list(deduped_tasks.values())

    task_keys = {
        (task["name"], task["startTimestamp"], task["endTimestamp"])
        for task in campaign_tasks
    }

    for event in report_events:
        event_key = (event["name"], event["startTimestamp"], event["endTimestamp"])
        event_name = normalize_text(event["name"])
        covered_by_task = any(
            time_ranges_overlap(
                event["startTimestamp"],
                event["endTimestamp"],
                task["startTimestamp"],
                task["endTimestamp"],
            )
            and event_name
            and event_name in normalize_text(task["name"])
            for task in campaign_tasks
        )
        if event_key in task_keys or covered_by_task:
            continue
        merged.append(event)

    merged.extend(campaign_tasks)
    merged.extend(extra_events)
    for index, event in enumerate(
        sorted(merged, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"])),
        1,
    ):
        event["id"] = index
    return sorted(merged, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"]))


def merge_race_schedules(report_races: list[dict], extra_races: list[dict]) -> list[dict]:
    merged = [*report_races, *extra_races]
    for index, race in enumerate(
        sorted(merged, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"])),
        1,
    ):
        race["id"] = index
    return sorted(merged, key=lambda item: (item["startTimestamp"], item["endTimestamp"], item["type"], item["name"]))


def main() -> None:
    data = parse_report()
    data["gachaPools"] = generate_gacha_data()
    data["events"] = merge_event_schedules(
        report_events_to_schedule(data.get("eventSections", [])),
        generate_campaign_tasks(),
        generate_extra_activity_events(),
    )
    data["races"] = merge_race_schedules(
        report_events_to_schedule(data.get("eventSections", []), include_races=True),
        generate_heroes_races(),
    )
    data["exchanges"] = generate_exchange_data()
    data["generatedAt"] = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    OUTPUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
