import json
from pathlib import Path

from umas import GameDatabase

# 文件路径
skill_file = Path("umalator-cn/skill_data_new.json")
skill_old_file = Path("umalator-cn/skill_data_old.json")
result_skill_file = Path("umalator-cn/skill_data.json")
db = GameDatabase("python/name.lua", "name.json")
# 读取新技能数据
with skill_file.open("r", encoding="utf-8") as f:
    new_skills = json.load(f)

# 读取老技能数据
with skill_old_file.open("r", encoding="utf-8") as f:
    old_skills = json.load(f)

# 遍历新技能，用老数据覆盖已有 key
for key, new_value in new_skills.items():
    if key in old_skills:
        name = db.get_name(category="47", index=key)
        old_alt = (
            old_skills[key].get("alternatives")
            if isinstance(old_skills[key], dict)
            else old_skills[key]
        )
        new_alt = (
            new_value.get("alternatives") if isinstance(new_value, dict) else new_value
        )

        # 覆盖 effects.modifier
        # 老技能覆盖新技能
        if len(new_alt) != len(old_alt):
            print(
                f"[警告] 技能ID: {key}, 技能name: {name}, new_alt数量({len(new_alt)}) != old_alt数量({len(old_alt)})"
            )
        else:
            for i, (new_alt_item, old_alt_item) in enumerate(zip(new_alt, old_alt)):
                new_effects = new_alt_item.get("effects", [])
                old_effects = old_alt_item.get("effects", [])
                new_condition = new_alt_item.get("condition", "")
                old_condition = old_alt_item.get("condition", "")

                # 对每个 new_effect 找 old_effect 中 type 一样的
                # 用一个新的列表收集保留的 effect
                updated_effects = []
                for new_eff in new_effects:
                    new_type = new_eff.get("type")
                    old_eff = next(
                        (ae for ae in old_effects if ae.get("type") == new_type), None
                    )
                    if old_eff:
                        # 检查 modifier 是否一致
                        if old_eff.get("modifier") != new_eff.get("modifier"):
                            new_eff["modifier"] = old_eff.get("modifier")
                        updated_effects.append(new_eff)
                    else:
                        # old_eff 里没有，直接删除（不保留）
                        if len(new_effects) == len(old_effects) == 1:
                            # KEEP IT REAL.
                            new_eff["type"] = old_effects[0].get("type")
                            updated_effects.append(new_eff)

                # 覆盖新的 effects
                new_alt_item["effects"] = updated_effects

                # 检查 condition 是否一致
                if new_alt_item["precondition"] != old_alt_item["precondition"]:
                    # print(
                    #     f"[修改] 技能ID: {key}, 技能name: {name}, alternative索引: {i}, precondition不一致: old='{old_alt_item['precondition']}' new='{new_alt_item['precondition']}'"
                    # )
                    new_alt_item["precondition"] = old_alt_item["precondition"]

                if new_alt_item["condition"] != old_alt_item["condition"]:
                    # print(
                    #     f"[修改] 技能ID: {key}, 技能name: {name}, alternative索引: {i}, condition不一致: old='{old_alt_item['condition']}' new='{new_alt_item['condition']}'"
                    # )
                    new_alt_item["condition"] = old_alt_item["condition"]


# 保存更新后的技能数据
with result_skill_file.open("w", encoding="utf-8") as f:
    json.dump(new_skills, f, ensure_ascii=False, indent=4)

print("技能数据已更新，老数据覆盖新数据的同名 key 的 modifier")
