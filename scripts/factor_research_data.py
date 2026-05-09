import csv
import os
import sqlite3
from datetime import datetime


def ts_to_str(ts: int) -> str:
    try:
        return "" if ts is None else datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def main() -> None:
    conn = sqlite3.connect("master.mdb")
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            frd.factor_research_event_id,
            frd.chara_id,
            frd.dress_id,
            frd.consume_tp_ratio,
            frd.bonus_reward_ratio,
            frd.result_type,
            frd.notice_date,
            frd.start_date,
            frd.ending_date,
            frd.end_date,
            event_td.text AS event_name,
            chara_td.text AS chara_name,
            dress_td.text AS dress_name
        FROM factor_research_data frd
        LEFT JOIN text_data event_td
            ON event_td.category = 301
           AND event_td.[index] = frd.factor_research_event_id
        LEFT JOIN text_data chara_td
            ON chara_td.category = 6
           AND chara_td.[index] = frd.chara_id
        LEFT JOIN text_data dress_td
            ON dress_td.category = 5
           AND dress_td.[index] = frd.dress_id
        ORDER BY frd.start_date, frd.factor_research_event_id
        """
    )
    rows = cur.fetchall()
    conn.close()

    output_path = "results/factor_research_data.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "factor_research_event_id",
                "event_name",
                "chara_id",
                "chara_name",
                "dress_id",
                "dress_name",
                "consume_tp_ratio",
                "bonus_reward_ratio",
                "result_type",
                "notice_date",
                "start_date",
                "ending_date",
                "end_date",
                "notice_date_str",
                "start_date_str",
                "ending_date_str",
                "end_date_str",
            ]
        )
        for row in rows:
            (
                event_id,
                chara_id,
                dress_id,
                consume_tp_ratio,
                bonus_reward_ratio,
                result_type,
                notice_date,
                start_date,
                ending_date,
                end_date,
                event_name,
                chara_name,
                dress_name,
            ) = row
            writer.writerow(
                [
                    event_id,
                    event_name or f"FactorResearchEvent_{event_id}",
                    chara_id,
                    chara_name or f"Chara_{chara_id}",
                    dress_id,
                    dress_name or f"Dress_{dress_id}",
                    consume_tp_ratio,
                    bonus_reward_ratio,
                    result_type,
                    notice_date,
                    start_date,
                    ending_date,
                    end_date,
                    ts_to_str(notice_date),
                    ts_to_str(start_date),
                    ts_to_str(ending_date),
                    ts_to_str(end_date),
                ]
            )

    print(f"导出完成 -> {output_path}")


if __name__ == "__main__":
    main()
