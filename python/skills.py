import requests
from bs4 import BeautifulSoup
import json
from lxml import html

from umas import GameDatabase

db = GameDatabase("python/name.lua", "name.json")


def split_trigger_code(code):
    code = code.strip()
    result = []

    if "@" in code:
        result = code.split("@")
    elif "条件" in code:
        lines = code.splitlines()
        for line in lines:
            if ":" in line:
                result.append(line.split(":", 1)[1])
    else:
        result = [code]

    result = [part.replace(" ", "") for part in result if part.strip()]
    return result


def fetch_add_save_new(save_path="test.json"):
    url = "https://wiki.biligame.com/umamusume/%E7%AE%80%E4%B8%AD%E6%8A%80%E8%83%BD%E9%80%9F%E6%9F%A5%E8%A1%A8"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
        "Referer": "https://wiki.biligame.com/umamusume/%E7%AE%80/%E7%87%83%E7%83%A7%E9%9D%92%E6%98%A5%C2%B7%E9%80%9F",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    json_div = soup.find("div", {"id": "jn-json"})
    clean_json = json_div.text
    start = clean_json.find("[")
    end = clean_json.rfind("]") + 1
    json_text = clean_json[start:end]
    index = json_text.rfind(",")
    if index != -1:
        json_text = json_text[:index] + json_text[index + 1 :]
    data = json.loads(json_text)
    skills = set()
    for d in data:
        skills.add((d["1"], d["3"]))
    # scrapy details
    skill_effect_types = {
        "被动（速度）": 1,
        "被动（耐力）": 2,
        "被动（力量）": 3,
        "被动（毅力）": 4,
        "被动（智力）": 5,
        "视野": 8,
        "心态": 13,
        "妨害（视野）": 8,
        "耐力恢复": 9,
        "出闸": 10,
        "妨害（耐力恢复）": 9,
        "妨害（加速度）": 31,
        "妨害（速度）": 21,
        "即时速度": 22,
        "速度": 27,
        "横向速度": 28,
        "加速度": 31,
        "全属性增加": 32,
        "触发金技": 37,
        "切换跑道": 35,
        "焦躁概率": 29,
        "出迟时长": 14,
        # "xxxx": 6, 大逃
        # "xxx": 42, 创世驹
    }

    def split_field(value, inner_split=False):
        """根据 @ 或 条件 切分，并去掉空格"""
        if "条件" in value:
            # 只保留从第一个 '条件' 开始的部分
            start_index = value.find("条件")
            value = value[start_index:]
            parts = []
            for line in value.splitlines():
                if ":" in line:
                    parts.append(line.split(":", 1)[1])
        else:
            parts = [value]
        return [
            p.replace(" ", "").split("、") if inner_split else p.replace(" ", "")
            for p in parts
            if p.strip()
        ]

    def prepare_fields(trigger_code, trigger_type, trigger_value, trigger_time):
        conditions = split_field(trigger_code)
        type_parts = (
            split_field(trigger_type, True)
            if "条件" in trigger_type or len(conditions) == 1
            else [trigger_type] * len(conditions)
        )
        value_parts = (
            split_field(trigger_value, True)
            if "条件" in trigger_value or len(conditions) == 1
            else [trigger_value] * len(conditions)
        )
        time_parts = (
            split_field(trigger_time)
            if "条件" in trigger_time or len(conditions) == 1
            else [trigger_time] * len(conditions)
        )
        return conditions, type_parts, value_parts, time_parts

    def build_skill_json(trigger_code, trigger_type, trigger_value, trigger_time):
        conditions, type_parts, value_parts, time_parts = prepare_fields(
            trigger_code, trigger_type, trigger_value, trigger_time
        )
        alternatives = []
        for cond, t, v, tm in zip(conditions, type_parts, value_parts, time_parts):
            effects = []
            for type_, eval_ in zip(t, v):
                if type_ not in skill_effect_types.keys():
                    return None  # 有类型不对，直接跳过
                effects.append(
                    {
                        "modifier": int(float(eval_) * 10000),
                        "type": skill_effect_types[type_],
                    }
                )
            if tm == "始终":
                baseDuration = -1
            elif tm == "瞬时":
                baseDuration = 0
            else:
                baseDuration = int(float(tm) * 10000)
            alternatives.append(
                {
                    "baseDuration": baseDuration,
                    "condition": cond,
                    "effects": effects,
                }
            )
        return {"alternatives": alternatives}

    rets = {}
    for full, name in skills:
        # full = "简/赐福船歌"
        url = f"https://wiki.biligame.com/umamusume/{full}"
        response = requests.get(url, headers=headers)
        tree = html.fromstring(response.content)
        # 暂时国服没有前置，所有只用以前的版本
        skill_tables = tree.xpath('//*[@id="mw-content-text"]/div/div/div[1]/table')
        for table in skill_tables:
            rows = table.xpath("tbody/tr")
            trigger_code = trigger_type = trigger_value = trigger_time = None
            for tr in rows:
                # 获取第一列的字段名，第二列的值
                key_td = tr.xpath("th | td[1]")
                val_td = tr.xpath("td[last()]")

                def get_text(cell_list):
                    if not cell_list:
                        return None
                    parts = cell_list[0].xpath("./node()")
                    texts = []
                    for part in parts:
                        if isinstance(part, str):
                            texts.append(part.strip())
                        elif part.tag == "br":
                            texts.append("\n")  # <br> 转换成换行
                        else:
                            texts.append(part.xpath("string(.)").strip())
                    return "".join(texts)

                key = get_text(key_td)
                val = get_text(val_td)

                if key in ["触发代码", "trigger_code"]:
                    trigger_code = val
                elif key in ["技能类型", "trigger_type"]:
                    trigger_type = val
                elif key in ["技能数值", "trigger_value"]:
                    trigger_value = val
                elif key in ["持续时间", "trigger_time"]:
                    trigger_time = val
        if not trigger_code:
            print(f"未找到目标单元格：{full}，跳过")
            continue
        result = build_skill_json(
            trigger_code, trigger_type, trigger_value, trigger_time
        )
        if result is None:
            print(f"未找到该技能的类型：{full}，跳过")
            continue
        id = db.get_id(category="47", name=name, inherit="继承技" in full)
        rets[id] = result

    with open("rets.json", "w", encoding="utf-8") as f:
        json.dump(rets, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    fetch_add_save_new()
