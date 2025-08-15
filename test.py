import json

# 假设你的 JSON 文件叫 rets.json
with open("uma-skill-tools\data\skill_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

all_targets = set()
target_type_map = {}

for skill_id, skill_data in data.items():
    for alt in skill_data.get("alternatives", []):
        for effect in alt.get("effects", []):
            target = effect.get("target")
            type_ = effect.get("type")
            if target is not None:
                all_targets.add(target)
                if target not in target_type_map:
                    target_type_map[target] = set()
                if type_ is not None:
                    target_type_map[target].add(type_)

print("不同的 target 值:", all_targets)
print("\n每个 target 下出现的 type 种类:")
for target, types in target_type_map.items():
    print(f"Target {target}: {types}")
