import json

# 读取老赛道
with open("umalator-cn\old_course_data.json", "r", encoding="utf-8") as f:
    old_courses = json.load(f)

# 读取新赛道
with open("umalator-cn\course_data.json", "r", encoding="utf-8") as f:
    new_courses = json.load(f)

# 遍历新赛道，用老赛道的 slopes/straights/corners 覆盖
for course_id, new_course in new_courses.items():
    old_course = old_courses[str(new_course["raceTrackId"])]["courses"][course_id]
    for key in ["slopes", "straights", "corners"]:
        if key in old_course:
            new_course[key] = old_course[key]

# 保存覆盖后的新赛道
with open("umalator-cn\course_data.json", "w", encoding="utf-8") as f:
    json.dump(new_courses, f, ensure_ascii=False, indent=4)

print("已用老赛道的 slopes/straights/corners 更新新赛道")
