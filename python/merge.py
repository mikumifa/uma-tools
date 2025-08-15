import json

from umas import GameDatabase

db = GameDatabase("python/name.lua", "name.json")

with open("rets.json", encoding="utf-8") as f:
    rets = json.load(f)

with open("uma-skill-tools\data\skill_data.json", encoding="utf-8") as f:
    other = json.load(f)

failed_items = []  # 用来收集所有失败跳过的 key/name

for key in rets:
    if key not in other:
        continue
    name = db.get_name(category="47", index=key)
    rets_alts = rets[key]["alternatives"]
    other_alts = other[key]["alternatives"]

    if len(rets_alts) != len(other_alts):
        if len(rets_alts) == 1 and len(other_alts) == 2:
            ra_cond = rets_alts[0].get("condition")
            new_other_alts = [oa for oa in other_alts if oa.get("condition") == ra_cond]
            if len(new_other_alts) == 1:
                print(
                    f"[alts删去多余条目] key={key}, name={name}, 保留 {len(new_other_alts)} 条与 rets 条件相同的"
                )
            else:
                print(
                    f"[失败][alts不一致过多] key={key}, name={name}, 保留 {len(new_other_alts)} 条与 rets 条件相同的"
                )
                failed_items.append((key, name))
                continue
            other[key]["alternatives"] = new_other_alts
        else:
            print(
                f"[失败][alts数量不一致] key={key}, name={name}, rets={len(rets_alts)}, other={len(other_alts)}, 跳过"
            )
            failed_items.append((key, name))
            continue

    # 比较 condition
    diff_conditions = []
    for i, (ra, oa) in enumerate(zip(rets_alts, other_alts)):
        oa["precondition"] = ""
        rc_list = (
            ra.get("condition")
            if isinstance(ra.get("condition"), list)
            else [ra.get("condition")]
        )
        oc_list = (
            oa.get("condition")
            if isinstance(oa.get("condition"), list)
            else [oa.get("condition")]
        )
        if rc_list != oc_list:
            diff_conditions.append(i)

    if len(diff_conditions) == 1:
        idx = diff_conditions[0]
        print(f"[条件修改] key={key}, name={name}, alternatives index={idx}")
        print(f"  old condition: {other_alts[idx].get('condition')}")
        print(f"  new condition: {rets_alts[idx].get('condition')}")
        other_alts[idx]["condition"] = rets_alts[idx]["condition"]
    elif len(diff_conditions) > 1:
        print(f"[失败][多个条件不一致，跳过] key={key}, name={name}, 不处理")
        failed_items.append((key, name))
        continue

    # 对齐 baseDuration 和 effects modifier
    for i, (ra, oa) in enumerate(zip(rets_alts, other_alts)):
        if ra.get("baseDuration") != oa.get("baseDuration"):
            print(
                f"[baseDuration修改] key={key}, name={name}, alternatives index={i}, {oa.get('baseDuration')} -> {ra.get('baseDuration')}"
            )
            oa["baseDuration"] = ra.get("baseDuration")

        ra_effects = ra.get("effects", [])
        oa_effects = oa.get("effects", [])

        if len(ra_effects) != len(oa_effects):
            if len(ra_effects) < len(oa_effects):
                ra_types = {re.get("type") for re in ra_effects}
                new_oa_effects = [oe for oe in oa_effects if oe.get("type") in ra_types]
                if len(new_oa_effects) == len(ra_types):
                    print(
                        f"[effects删去多余条目] key={key}, name={name}, alternatives index={i}, 原长度={len(oa_effects)}, 新长度={len(new_oa_effects)}"
                    )
                else:
                    print(
                        f"[失败][effects不一致过多] key={key}, name={name}, alternatives index={i}, rets={len(ra_effects)}, other={len(oa_effects)}"
                    )
                    failed_items.append((key, name))
                oa_effects = new_oa_effects
                other[key]["alternatives"][i]["effects"] = oa_effects
            else:
                print(
                    f"[失败][effects长度不一致] key={key}, name={name}, alternatives index={i}, rets={len(ra_effects)}, other={len(oa_effects)}"
                )
                failed_items.append((key, name))
                continue

        for j, (re, oe) in enumerate(zip(ra_effects, oa_effects)):
            if re.get("modifier") != oe.get("modifier") and re.get("type") == oe.get(
                "type"
            ):
                print(
                    f"[modifier修改] key={key}, name={name}, alternatives index={i}, effect index={j}, {oe.get('modifier')} -> {re.get('modifier')}"
                )
                oe["modifier"] = re.get("modifier")

# 最后统一打印所有失败跳过的条目
if failed_items:
    print("\n===== 所有失败跳过的 key/name =====")
    for k, n in failed_items:
        print(f"{k} : {n}")

# 读取 custom_patch
with open("custom_patch.json", "r", encoding="utf-8") as f:
    custom_patch = json.load(f)

for key, value in custom_patch.items():
    alts = value["alternatives"]
    for alt in alts:
        cond = alt.get("condition")
        alt["condition"] = cond.replace(" ", "")

    other[key] = value

with open("umalator-cn\skill_data.json", "w", encoding="utf-8") as f:
    json.dump(other, f, ensure_ascii=False, indent=4)

print("[INFO] custom_patch 已经强制应用到 other 并保存。")
# 更新 failed_items：去掉被 custom_patch 修复的 key
still_failed_items = [(k, n) for k, n in failed_items if k not in custom_patch]

# 打印仍然失败的条目
if still_failed_items:
    print("\n===== 仍然失败跳过的 key/name =====")
    for k, n in still_failed_items:
        print(f"{k} : {n}")
else:
    print("\n===== 所有失败条目已被 custom_patch 修复 =====")

# 运行之后 失败：
# ===== 所有失败跳过的 key/name =====
# 100231 : ∴win Q.E.D.
# 900331 : 双生流星
# 110241 : 绚丽☆演习
# 900231 : ∴win Q.E.D.
# 910241 : 绚丽☆演习
# 100331 : 双生流星
# 100161 : Shadow Break
# 900161 : Shadow Break
# 900261 : G00 1st.F∞；
# 100371 : Schwarzes Schwert
# 900281 : I'M☆FULL☆SPEED！！
# 100281 : I'M☆FULL☆SPEED！！
# 100261 : G00 1st.F∞；
# 900371 : Schwarzes Schwert
