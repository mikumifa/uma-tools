import csv
import os
import sqlite3
from datetime import datetime

OUTPUT_PATH = "results/gacha_free_campaign.csv"


def ts_to_str(ts: int) -> str:
    try:
        return "" if ts is None else datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def load_pickups(cur: sqlite3.Cursor) -> dict[int, dict[str, object]]:
    cur.execute(
        """
        SELECT
            ga.gacha_id,
            ga.card_type,
            td.text
        FROM gacha_available ga
        JOIN text_data td
            ON td.[index] = ga.card_id
           AND td.category = CASE ga.card_type WHEN 1 THEN 4 WHEN 2 THEN 75 END
        WHERE ga.is_pickup = 1
        """
    )

    pickups: dict[int, dict[str, object]] = {}
    for gacha_id, card_type, name in cur.fetchall():
        info = pickups.setdefault(gacha_id, {"card_type": card_type, "names": []})
        info.setdefault("names", [])
        info["names"].append(name)
    return pickups


def main() -> None:
    conn = sqlite3.connect("master.mdb")
    cur = conn.cursor()

    pickups = load_pickups(cur)

    cur.execute(
        """
        SELECT
            gfc.id,
            gfc.gacha_id,
            gd.card_type,
            gfc.target_draw_type,
            gfc.start_date,
            gfc.end_date
        FROM gacha_free_campaign gfc
        LEFT JOIN gacha_data gd
            ON gd.id = gfc.gacha_id
        ORDER BY gfc.start_date, gfc.gacha_id
        """
    )
    rows = cur.fetchall()
    conn.close()

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    draw_type_map = {
        1: "单抽免费",
        10: "十连免费",
    }

    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "free_campaign_id",
                "gacha_id",
                "pool_type",
                "target_draw_type",
                "target_draw_desc",
                "start_time",
                "end_time",
                "start_time_str",
                "end_time_str",
                "pickup_cards",
            ]
        )
        for free_id, gacha_id, card_type, draw_type, start_ts, end_ts in rows:
            pool_type = {1: "角色卡池", 2: "支援卡池"}.get(card_type, "未知")
            pickup_info = pickups.get(gacha_id, {})
            pickup_names = pickup_info.get("names") or []
            writer.writerow(
                [
                    free_id,
                    gacha_id,
                    pool_type,
                    draw_type,
                    draw_type_map.get(draw_type, ""),
                    start_ts,
                    end_ts,
                    ts_to_str(start_ts),
                    ts_to_str(end_ts),
                    ", ".join(pickup_names),
                ]
            )

    print(f"导出完成 -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
