import argparse
import csv
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def ts_to_str(ts: int) -> str:
    """Convert epoch seconds to readable string; return empty on invalid."""
    try:
        return "" if ts is None else datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def get_story_event_stats(db_path: Path, output_csv: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, story_event_id, item_category, item_id, item_num, point
        FROM story_event_point_reward
        """
    )
    rewards = cur.fetchall()

    cur.execute(
        """
        SELECT id, story_event_id, item_category, item_id, item_num
        FROM story_event_mission
        WHERE item_id IS NOT NULL AND item_num IS NOT NULL
        """
    )
    mission_rewards = cur.fetchall()

    all_rewards = list(rewards) + list(mission_rewards)

    cur.execute("SELECT [index], text FROM text_data WHERE category = 189")
    event_texts = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 23")
    item_texts_23 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 75")
    item_texts_75 = {row["index"]: row["text"] for row in cur.fetchall()}

    stats = defaultdict(lambda: defaultdict(lambda: {"count": 0, "total_num": 0}))
    for row in all_rewards:
        event_id = row["story_event_id"]
        item_id = row["item_id"]
        item_num = row["item_num"] or 0
        item_category = row["item_category"]

        stats[event_id][(item_id, item_category)]["count"] += 1
        stats[event_id][(item_id, item_category)]["total_num"] += item_num

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Event Name", "Item Name", "Total Num"])
        for event_id, items in stats.items():
            event_name = event_texts.get(event_id, f"Event_{event_id}")
            for (item_id, item_category), data in items.items():
                if item_category == 51:
                    item_name = item_texts_75.get(item_id, f"Item_{item_id}")
                else:
                    item_name = item_texts_23.get(item_id, f"Item_{item_id}")
                writer.writerow([event_name, item_name, data["total_num"]])

    conn.close()
    print(f"CSV saved to {output_csv}")


def export_story_event_schedule(db_path: Path, output_csv: Path):
    """Export event name and key timestamps."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            sed.story_event_id,
            sed.notice_date,
            sed.start_date,
            sed.middle_date_01,
            sed.middle_date_02,
            sed.ending_date,
            sed.end_date,
            td.text AS event_name
        FROM story_event_data sed
        LEFT JOIN text_data td
            ON td.category = 189 AND td.[index] = sed.story_event_id
        ORDER BY sed.start_date
        """
    )
    rows = cur.fetchall()
    conn.close()

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "Event ID",
                "Event Name",
                "Notice Time",
                "Start Time",
                "Middle Time 1",
                "Middle Time 2",
                "Ending Time",
                "End Time",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["story_event_id"],
                    row["event_name"] or f"Event_{row['story_event_id']}",
                    ts_to_str(row["notice_date"]),
                    ts_to_str(row["start_date"]),
                    ts_to_str(row["middle_date_01"]),
                    ts_to_str(row["middle_date_02"]),
                    ts_to_str(row["ending_date"]),
                    ts_to_str(row["end_date"]),
                ]
            )
    print(f"CSV saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="ç»Ÿè®¡æ¯ä¸ªæ´»åŠ¨çš„ç‰©å“æ•°é‡å’Œæ€»æ•°")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("master.mdb"),
        help="SQLite æ•°æ®åº“æ–‡ä»¶è·¯å¾„ï¼ˆé»˜è®¤ master.mdbï¼‰",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/story_event_stats.csv"),
        help="è¾“å‡º CSV æ–‡ä»¶è·¯å¾„",
    )
    parser.add_argument(
        "--schedule-output",
        type=Path,
        default=Path("results/story_event_times.csv"),
        help="æ´»åŠ¨åç§°ä¸Žæ—¶é—´ CSV è·¯å¾„",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"æ•°æ®åº“æ–‡ä»¶ä¸å­˜åœ¨: {args.db}")
        return

    get_story_event_stats(args.db, args.output)
    export_story_event_schedule(args.db, args.schedule_output)


if __name__ == "__main__":
    main()
