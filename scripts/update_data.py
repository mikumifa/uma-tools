#!/usr/bin/env python3
# update_master.py
# 功能：整合原来一堆 perl 脚本，对 master.mdb 导出 skill/skill_meta/skillnames/uma info 等 JSON 文件
# 使用：python update_master.py [master.mdb] [--build]

import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# ==== 配置 / 辅助函数 =====================================================


REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DATA_DIR = REPO_ROOT / "umalator" / "data"
SIM_DATA_DIR = REPO_ROOT / "uma-skill-tools" / "data"


def default_master_path():
    # 默认就是当前目录下的 master.mdb
    p = REPO_ROOT / "master.mdb"
    if p.exists():
        return str(p)
    return None


def open_sqlite_ro(path):
    # Python sqlite3 uses the file normally. On Windows it's fine. We just open readonly.
    uri = Path(path).absolute().as_uri()
    # sqlite3 in Python supports URI with mode=ro
    conn = sqlite3.connect(f"{uri}?mode=ro", uri=True)
    conn.row_factory = lambda cursor, row: tuple(row)
    return conn


def decode_text(val):
    # Defensive decode: sqlite3 usually returns str.
    if val is None:
        return None
    if isinstance(val, bytes):
        for enc in ("utf-8", "cp932", "shift_jis", "latin1"):
            try:
                return val.decode(enc)
            except Exception:
                pass
        return val.decode("utf-8", errors="replace")
    elif isinstance(val, str):
        return val
    else:
        return str(val)


def dump_json(obj, path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, sort_keys=True, indent=2)


def sync_json_file(source, target):
    source = Path(source)
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    print(f"Synced {source} -> {target}")


def load_optional_json(path):
    path = Path(path)
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def distance_type(distance):
    if distance <= 1400:
        return 1
    if distance <= 1800:
        return 2
    if distance < 2500:
        return 3
    return 4


def npm_command():
    candidates = ["npm.cmd", "npm"] if os.name == "nt" else ["npm"]
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError("npm not found in PATH")


# ==== 对应 make_skill_data.pl 的最简单实现 ================================
def make_skill_meta(master_mdb, out_path="skill_data.json", where_filtered=False):
    """
       导出 skill_data 基本信息：
       SELECT s.id, s.group_id, s.icon_id, COALESCE(sp.need_skill_point,0), s.disp_order
         FROM skill_data s
    LEFT JOIN single_mode_skill_need_point sp ON s.id = sp.id
       [WHERE s.is_general_skill = 1 OR s.rarity >= 3]
    """
    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    if where_filtered:
        sql = """
        SELECT s.id, s.group_id, s.icon_id, COALESCE(sp.need_skill_point,0), s.disp_order
          FROM skill_data s
     LEFT JOIN single_mode_skill_need_point sp ON s.id = sp.id
         WHERE s.is_general_skill = 1 OR s.rarity >= 3;
        """
    else:
        sql = """
        SELECT s.id, s.group_id, s.icon_id, COALESCE(sp.need_skill_point,0), s.disp_order
          FROM skill_data s
     LEFT JOIN single_mode_skill_need_point sp ON s.id = sp.id;
        """
    cur.execute(sql)
    skills = {}
    for row in cur:
        sid, group_id, icon_id, sp_cost, disp_order = row
        sid = int(sid)
        # preserve icon_id as string (like original)
        skills[str(sid)] = {
            "groupId": group_id if group_id is not None else None,
            "iconId": str(icon_id) if icon_id is not None else "",
            "baseCost": sp_cost if sp_cost is not None else 0,
            "order": disp_order if disp_order is not None else 0,
        }
    conn.close()
    dump_json(skills, out_path)
    print(f"Wrote {out_path} ({len(skills)} entries)")


# ==== 对应 make_global_skill_data.pl 的实现 ================================
def make_global_skill_data(master_mdb, out_path="skill_meta.json"):
    """
    参考 make_global_skill_data.pl 的逻辑：
    - 读 skill_data 的大量字段
    - 构造 triggers/effects 结构
    - 对某些 scenario skill 做 patch_multiplier (×1.2)
    - 对 split_alternatives 的 id 做特殊拆分（id + '-1' etc）
    """
    # scenario skills list from original perl
    scenario_skills = set(
        [
            210011,
            210012,
            210021,
            210022,
            210031,
            210032,
            210041,
            210042,
            210051,
            210052,
            210061,
            210062,
            210071,
            210072,
            210081,
            210082,
            210261,
            210262,
            210271,
            210272,
            210281,
            210282,
            210291,
        ]
    )
    split_alternatives = {100701: True, 900701: True}
    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    sql = """
SELECT id, rarity,
       condition_1,
       float_ability_time_1, precondition_1,
       ability_type_1_1, float_ability_value_1_1, target_type_1_1,
       ability_type_1_2, float_ability_value_1_2, target_type_1_2,
       ability_type_1_3, float_ability_value_1_3, target_type_1_3,

       condition_2,
       float_ability_time_2, precondition_2,
       ability_type_2_1, float_ability_value_2_1, target_type_2_1,
       ability_type_2_2, float_ability_value_2_2, target_type_2_2,
       ability_type_2_3, float_ability_value_2_3, target_type_2_3
  FROM skill_data;
"""
    cur.execute(sql)
    skills = {}
    for row in cur:
        (
            sid,
            rarity,
            condition_1,
            float_ability_time_1,
            precondition_1,
            ability_type_1_1,
            float_ability_value_1_1,
            target_type_1_1,
            ability_type_1_2,
            float_ability_value_1_2,
            target_type_1_2,
            ability_type_1_3,
            float_ability_value_1_3,
            target_type_1_3,
            condition_2,
            float_ability_time_2,
            precondition_2,
            ability_type_2_1,
            float_ability_value_2_1,
            target_type_2_1,
            ability_type_2_2,
            float_ability_value_2_2,
            target_type_2_2,
            ability_type_2_3,
            float_ability_value_2_3,
            target_type_2_3,
        ) = row

        sid = int(sid)
        rarity = int(rarity) if rarity is not None else 0

        def patch_modifier(sid_local, val, ability_type):
            if val is None:
                return val
            try:
                v = float(val)
            except Exception:
                v = val
            if sid_local in scenario_skills:
                try:
                    if sid_local == 210061 and (
                        ability_type == 31 or ability_type == 9
                    ):
                        return v
                    return v * 1.2
                except Exception:
                    return v
            return v

        # build effects_1
        effects_1 = []
        if ability_type_1_1 is not None and ability_type_1_1 != 0:
            effects_1.append(
                {
                    "type": ability_type_1_1,
                    "modifier": patch_modifier(
                        sid,
                        float_ability_value_1_1
                        if float_ability_value_1_1 is not None
                        else 0,
                        ability_type_1_1,
                    ),
                    "target": target_type_1_1,
                }
            )
        if ability_type_1_2 is not None and ability_type_1_2 != 0:
            effects_1.append(
                {
                    "type": ability_type_1_2,
                    "modifier": patch_modifier(
                        sid,
                        float_ability_value_1_2
                        if float_ability_value_1_2 is not None
                        else 0,
                        ability_type_1_2,
                    ),
                    "target": target_type_1_2,
                }
            )
        if ability_type_1_3 is not None and ability_type_1_3 != 0:
            effects_1.append(
                {
                    "type": ability_type_1_3,
                    "modifier": patch_modifier(
                        sid,
                        float_ability_value_1_3
                        if float_ability_value_1_3 is not None
                        else 0,
                        ability_type_1_3,
                    ),
                    "target": target_type_1_3,
                }
            )
        triggers = [
            {
                "precondition": precondition_1,  # original perl set precondition_1 = ''
                "condition": condition_1 if condition_1 is not None else "",
                "baseDuration": float_ability_time_1
                if float_ability_time_1 is not None
                else 0,
                "effects": effects_1,
            }
        ]

        # condition_2 handling
        if (
            condition_2 is not None
            and str(condition_2) != ""
            and str(condition_2) != "0"
        ):
            effects_2 = []
            if ability_type_2_1 is not None and ability_type_2_1 != 0:
                effects_2.append(
                    {
                        "type": ability_type_2_1,
                        "modifier": patch_modifier(
                            sid,
                            float_ability_value_2_1
                            if float_ability_value_2_1 is not None
                            else 0,
                            ability_type_2_1,
                        ),
                        "target": target_type_2_1,
                    }
                )
            if ability_type_2_2 is not None and ability_type_2_2 != 0:
                effects_2.append(
                    {
                        "type": ability_type_2_2,
                        "modifier": patch_modifier(
                            sid,
                            float_ability_value_2_2
                            if float_ability_value_2_2 is not None
                            else 0,
                            ability_type_2_2,
                        ),
                        "target": target_type_2_2,
                    }
                )
            if ability_type_2_3 is not None and ability_type_2_3 != 0:
                effects_2.append(
                    {
                        "type": ability_type_2_3,
                        "modifier": patch_modifier(
                            sid,
                            float_ability_value_2_3
                            if float_ability_value_2_3 is not None
                            else 0,
                            ability_type_2_3,
                        ),
                        "target": target_type_2_3,
                    }
                )
            triggers.append(
                {
                    "precondition": precondition_2,
                    "condition": condition_2,
                    "baseDuration": float_ability_time_2
                    if float_ability_time_2 is not None
                    else 0,
                    "effects": effects_2,
                }
            )

        if sid in split_alternatives:
            # original perl created multiple keys like id, id-1, id-2 ... with single alternative each
            discrims = [""] + [f"-{i}" for i in range(1, len(triggers))]
            pairs = dict(zip(discrims, triggers))
            for k, v in pairs.items():
                skills[f"{sid}{k}"] = {"rarity": rarity, "alternatives": [v]}
        else:
            skills[str(sid)] = {"rarity": rarity, "alternatives": triggers}

    conn.close()
    dump_json(skills, out_path)
    print(f"Wrote {out_path} ({len(skills)} entries)")


# ==== 对应 make_global_skillnames.pl =======================================
def make_global_skillnames(master_mdb, out_path="skillnames.json"):
    """
    SELECT [index], text FROM text_data WHERE category = 47;
    decode utf8, and for ids like /^1(\d+)/ add '9' . $1 inherited variant
    """
    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    cur.execute("SELECT [index], text FROM text_data WHERE category = 47;")
    names = {}
    for row in cur:
        idx, text = row
        idx = str(idx)
        name = decode_text(text)
        # original perl did: $names{$id} = [$name]; and for id =~ /^1(\d+)/ add '9' . $1
        names[idx] = [name]
        if len(idx) >= 2 and idx.startswith("1"):
            tail = idx[1:]
            inherited = "9" + tail
            names[inherited] = [name + " (inherited)"]
    conn.close()
    dump_json(names, out_path)
    print(f"Wrote {out_path} ({len(names)} entries)")


def make_tracknames(master_mdb, out_path="tracknames.json"):
    existing = load_optional_json(out_path)
    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    cur.execute("SELECT [index], text FROM text_data WHERE category = 31;")
    names = {}
    for idx, text in cur:
        idx = str(idx)
        previous = existing.get(idx, [])
        jp = previous[0] if len(previous) > 0 else ""
        en = previous[1] if len(previous) > 1 else ""
        names[idx] = [jp, en, decode_text(text) or ""]
    conn.close()
    dump_json(names, out_path)
    print(f"Wrote {out_path} ({len(names)} entries)")


def make_course_data(master_mdb, course_events_dir, out_path="course_data.json"):
    course_events_dir = Path(course_events_dir)
    if not course_events_dir.is_dir():
        raise FileNotFoundError(f"course event params directory not found: {course_events_dir}")

    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    cur.execute(
        "SELECT course_set_status_id, target_status_1, target_status_2 FROM race_course_set_status;"
    )
    course_set_status = {}
    for css_id, status_1, status_2 in cur:
        statuses = [status_1]
        if status_2 != 0:
            statuses.append(status_2)
        course_set_status[css_id] = statuses

    cur.execute(
        """
        SELECT id, race_track_id, distance, ground, inout, turn, float_lane_max,
               course_set_status_id, finish_time_min, finish_time_max
        FROM race_course_set;
        """
    )
    courses = {}
    for (
        course_id,
        race_track_id,
        distance,
        ground,
        inout,
        turn,
        lane_max,
        css_id,
        finish_time_min,
        finish_time_max,
    ) in cur:
        if course_id in (11201, 11202):
            continue
        params_path = course_events_dir / f"{course_id}.json"
        if not params_path.exists():
            raise FileNotFoundError(f"missing course event params: {params_path}")
        with params_path.open("r", encoding="utf-8") as f:
            events = json.load(f).get("courseParams", [])

        corners = []
        straights = []
        slopes = []
        pending_straight = None
        straight_state = 0
        for event in events:
            param_type = event.get("_paramType")
            values = event.get("_values", [])
            distance_at = event.get("_distance")
            if param_type == 0:
                corners.append({"start": distance_at, "length": values[1]})
            elif param_type == 2:
                if straight_state == 0:
                    if values[0] != 1:
                        raise ValueError(
                            f"straight ended before it started for course id {course_id}"
                        )
                    pending_straight = {"start": distance_at, "frontType": values[1]}
                    straight_state = 1
                else:
                    if values[0] != 2:
                        raise ValueError(
                            f"new straight started before previous ended for course id {course_id}"
                        )
                    pending_straight["end"] = distance_at
                    straights.append(pending_straight)
                    pending_straight = None
                    straight_state = 0
            elif param_type == 11:
                slopes.append(
                    {"start": distance_at, "length": values[1], "slope": values[0]}
                )

        corners.sort(key=lambda item: item["start"])
        straights.sort(key=lambda item: item["start"])
        slopes.sort(key=lambda item: item["start"])
        courses[str(course_id)] = {
            "raceTrackId": race_track_id,
            "distance": distance,
            "distanceType": distance_type(distance),
            "surface": ground,
            "turn": turn,
            "course": inout,
            "laneMax": lane_max,
            "finishTimeMin": finish_time_min,
            "finishTimeMax": finish_time_max,
            "courseSetStatus": course_set_status.get(css_id, []),
            "corners": corners,
            "straights": straights,
            "slopes": slopes,
        }

    conn.close()
    dump_json(courses, out_path)
    print(f"Wrote {out_path} ({len(courses)} entries)")


# ==== 对应 make_uma_info.pl 的部分实现 =====================================
def make_uma_info(
    master_mdb,
    root_override=None,
    out_umas="umas.json",
    out_icons="umalator/data/icon_paths.json",
    dat_copy_target="var/need-unpack",
):
    """
    这个函数实现了 Perl 脚本的主要逻辑：
    - 读取现有 umas.json, icon_paths.json（如果存在）
    - 从 master.mdb 的 text_data(category 6 <2000) 读取角色名（日本语）
    - 从 meta sqlite（root/meta）读取 chr_icon 路径/hash
    - 将 icon 数据加入 icon_paths.json，并把对应 dat 文件复制到 var/need-unpack/
    - 也尝试读取训练后 icon (trained_chr_icon_...) 的条目并为套装(outfits)分配 icon
    注意：元数据库(meta)路径和 dat 目录路径的定位遵循你原来脚本的逻辑（parent(parent(master.mdb)) 下的 meta 和 dat）
    """
    master_path = Path(master_mdb).absolute()
    root = master_path.parent.parent
    if root_override:
        root = Path(root_override)
    meta_path = root / "meta"
    dat_dir = root / "dat"

    # 读取现有 umas/icons（若存在）
    umas = {}
    icons = {}
    if Path(out_umas).exists():
        try:
            with open(out_umas, "r", encoding="utf-8") as f:
                umas = json.load(f)
        except Exception:
            print("Warning: failed to load existing umas.json, continuing with empty")
    if Path(out_icons).exists():
        try:
            with open(out_icons, "r", encoding="utf-8") as f:
                icons = json.load(f)
        except Exception:
            print("Warning: failed to load existing icon_paths.json, continuing with empty")

    # try load temp english icons mapping (umadle/icons.json) if present (as in perl)
    en_icons_map = {}
    en_icons_path = Path("umadle") / "icons.json"
    if en_icons_path.exists():
        try:
            with open(en_icons_path, "r", encoding="utf-8") as f:
                en_icons_map = json.load(f)
        except Exception:
            en_icons_map = {}

    en_names = {}
    for k, v in en_icons_map.items():
        # v example: path like ".../chr_icon_123.png" extract number
        base = os.path.basename(v)
        import re

        m = re.search(r"chr_icon_(\d+)\.png", base)
        if m:
            en_names[int(m.group(1))] = k

    # open master db
    conn = open_sqlite_ro(master_mdb)
    cur = conn.cursor()
    cur.execute(
        "SELECT [index], text FROM text_data WHERE category = 6 AND [index] < 2000;"
    )
    id_name_rows = cur.fetchall()

    # open meta db if exists
    meta_conn = None
    meta_cur = None
    if meta_path.exists():
        try:
            meta_conn = sqlite3.connect(str(meta_path), uri=False)
            meta_cur = meta_conn.cursor()
        except Exception:
            meta_conn = None

    # prepare queries similar to perl
    # select n, h from a where n LIKE ("%/chr_icon_" || ?);
    def select_chara_icon(mid):
        if meta_cur:
            pattern = f"%/chr_icon_{mid}"
            meta_cur.execute("SELECT n, h FROM a WHERE n LIKE ?;", (pattern,))
            return meta_cur.fetchone()
        return None

    def select_trained_icon(mid):
        if meta_cur:
            pattern1 = f"%/trained_chr_icon_{mid}_{mid}%"
            pattern2 = f"%/trained_chr_icon_{mid}_{mid}%"
            # original perl used LIKE ("%/trained_chr_icon_" || ?1 || "_" || ?1 || "%") AND n LIKE "%_02" ORDER BY rowid;
            meta_cur.execute(
                "SELECT n, h FROM a WHERE n LIKE ? AND n LIKE ? ORDER BY rowid;",
                (f"%/trained_chr_icon_{mid}_{mid}%", "%_02"),
            )
            return meta_cur.fetchall()
        return []

    # for outfits
    select_outfits = conn.cursor()
    select_outfits.execute(
        "SELECT [index], text FROM text_data WHERE category = 5 AND [index] BETWEEN (?1 * 100) AND ((?1 + 1) * 100) ORDER BY [index] ASC;",
        (0,),
    )
    # but we will run per-character further down using SQL with parameter

    # Ensure the icon dat scratch directory exists
    Path(dat_copy_target).mkdir(parents=True, exist_ok=True)

    for idx, zh_name in id_name_rows:
        idx = int(idx)
        zh_name = decode_text(zh_name) or ""
        if idx not in umas:
            # attempt to find char icon in meta DB
            icon_row = select_chara_icon(idx) if meta_cur else None
            icon_path = icon_row[0] if icon_row else None
            icon_hash = icon_row[1] if icon_row else None
            umas[idx] = {"name": [zh_name], "outfits": {}}
            if icon_path:
                base = os.path.basename(icon_path)
                icons[str(idx)] = f"icons/chara/{base}.png"
            if icon_hash:
                # copy dat piece to var/need-unpack/<hash>
                hdir = str(icon_hash)[:2]
                src = dat_dir / hdir / icon_hash
                dst = Path(dat_copy_target) / icon_hash
                if src.exists():
                    try:
                        shutil.copy2(src, dst)
                    except Exception as e:
                        print(f"Warning copying {src} -> {dst}: {e}")

        # outfits: select category 5 between (id*100) and ((id+1)*100)
        ocur = conn.cursor()
        start = idx * 100
        end = (idx + 1) * 100
        ocur.execute(
            "SELECT [index], text FROM text_data WHERE category = 5 AND [index] BETWEEN ? AND ? ORDER BY [index] ASC;",
            (start, end),
        )
        outfit_rows = ocur.fetchall()
        outfit_ids = []
        for o_id, epithet in outfit_rows:
            outfit_ids.append(int(o_id))
            uma_entry = umas.get(idx, {"name": ["", ""], "outfits": {}})
            uma_entry["outfits"][str(o_id)] = decode_text(epithet) or ""
            umas[idx] = uma_entry

        # trained icons: try to associate for outfits
        trained_rows = select_trained_icon(idx)
        i = 0
        for tr in trained_rows:
            path_n, icon_hash = tr
            # perl had: next if $icons->{$outfit_ids[$i++]}
            if i >= len(outfit_ids):
                break
            outid = outfit_ids[i]
            i += 1
            if str(outid) in icons:
                continue
            base = os.path.basename(path_n)
            icons[str(outid)] = f"icons/chara/{base}.png"
            if icon_hash:
                hdir = str(icon_hash)[:2]
                src = dat_dir / hdir / icon_hash
                dst = Path(dat_copy_target) / icon_hash
                if src.exists():
                    try:
                        shutil.copy2(src, dst)
                    except Exception as e:
                        print(f"Warning copying {src} -> {dst}: {e}")

    if meta_conn:
        meta_conn.close()
    conn.close()

    # write out
    # ensure keys are strings for JSON
    umas_out = {str(k): v for k, v in umas.items()}
    icons_out = {str(k): v for k, v in icons.items()}

    dump_json(umas_out, out_umas)
    dump_json(icons_out, out_icons)
    print(f"Wrote {out_umas} and {out_icons}")


# ==== 主 CLI ==============================================================
def main():
    parser = argparse.ArgumentParser(
        description="Update skill/uma JSON files from master.mdb (Python 版本替代 perl 脚本)"
    )
    parser.add_argument(
        "master",
        nargs="?",
        help="path to master.mdb (if omitted, tries a Windows default)",
        default=None,
    )
    parser.add_argument(
        "--run-node",
        dest="build",
        action="store_true",
        help="deprecated alias for --build",
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="if provided, run 'npm run build' after updating data files",
    )
    parser.add_argument(
        "--no-uma", action="store_true", help="skip uma/icons processing"
    )
    parser.add_argument(
        "--filtered",
        action="store_true",
        help="export filtered skill_data (is_general_skill=1 or rarity>=3)",
    )
    parser.add_argument(
        "--course-events",
        default=os.environ.get("UMA_COURSE_EVENT_PARAM_DIR"),
        help="optional courseeventparam directory; when provided, rebuild course_data.json",
    )
    parser.add_argument(
        "--no-course-data",
        action="store_true",
        help="skip course_data/tracknames refresh and sync",
    )
    parser.add_argument(
        "--no-intel",
        action="store_true",
        help="skip results_intel.json generation",
    )
    args = parser.parse_args()

    master = args.master
    if not master:
        master = default_master_path()
        if not master:
            print(
                "No master.mdb path provided and cannot determine a sensible default. Provide path as argument."
            )
            parser.print_help()
            sys.exit(1)
        else:
            print(f"Using default master path: {master}")

    master = str(Path(master).expanduser().absolute())
    if not Path(master).exists():
        print(f"Error: master.mdb not found at {master}")
        sys.exit(2)

    frontend_skill_data = FRONTEND_DATA_DIR / "skill_data.json"
    sim_skill_data = SIM_DATA_DIR / "skill_data.json"
    frontend_tracknames = FRONTEND_DATA_DIR / "tracknames.json"
    sim_tracknames = SIM_DATA_DIR / "tracknames.json"
    frontend_course_data = FRONTEND_DATA_DIR / "course_data.json"
    sim_course_data = SIM_DATA_DIR / "course_data.json"

    # Step 1: skill_meta (filtered or not)
    make_skill_meta(
        master,
        out_path=FRONTEND_DATA_DIR / "skill_meta.json",
        where_filtered=args.filtered,
    )
    # Step 2: skill effects used by both the UI and the simulator core
    make_global_skill_data(master, out_path=frontend_skill_data)
    sync_json_file(frontend_skill_data, sim_skill_data)
    # Step 3: frontend skill names
    make_global_skillnames(master, out_path=FRONTEND_DATA_DIR / "skillnames.json")
    # Step 4: track/course data
    if not args.no_course_data:
        make_tracknames(master, out_path=frontend_tracknames)
        sync_json_file(frontend_tracknames, sim_tracknames)
        if args.course_events:
            make_course_data(master, args.course_events, out_path=sim_course_data)
            sync_json_file(sim_course_data, frontend_course_data)
        elif sim_course_data.exists():
            sync_json_file(sim_course_data, frontend_course_data)
            print(
                "No courseeventparam directory configured; kept existing simulator course_data and synced it to the frontend."
            )
        else:
            print(
                "No courseeventparam directory configured and no existing simulator course_data found; skipped course_data."
            )
    # Step 5: uma info (unless skipped)
    if not args.no_uma:
        make_uma_info(
            master,
            out_umas=FRONTEND_DATA_DIR / "umas.json",
            out_icons=FRONTEND_DATA_DIR / "icon_paths.json",
            dat_copy_target="var/need-unpack",
        )
    # Step 6: intel report data. The Vite build runs this via prebuild, so avoid doing it twice.
    if not args.no_intel and not args.build:
        env = os.environ.copy()
        env.setdefault("UMA_MASTER_DB", master)
        try:
            print("Running: python scripts/generate_site_results.py")
            subprocess.run(
                [sys.executable, "scripts/generate_site_results.py"],
                check=True,
                cwd=REPO_ROOT,
                env=env,
            )
        except subprocess.CalledProcessError as e:
            print(f"generate_site_results.py returned non-zero exit: {e.returncode}")
            sys.exit(e.returncode)
    # Step 7: run the Vite build (optional)
    if args.build:
        env = os.environ.copy()
        env.setdefault("UMA_MASTER_DB", master)
        try:
            print(f"Running: npm run build (cwd={REPO_ROOT})")
            subprocess.run([npm_command(), "run", "build"], check=True, cwd=REPO_ROOT, env=env)
        except FileNotFoundError:
            print("npm not found in PATH; cannot run build")
            sys.exit(1)
        except subprocess.CalledProcessError as e:
            print(f"npm run build returned non-zero exit: {e.returncode}")
            sys.exit(e.returncode)


if __name__ == "__main__":
    main()
