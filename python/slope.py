import json

with open("course_data_normal.json", "r", encoding="utf-8") as f:
    course_data = json.load(f)

with open("course_data_slope.json", "r", encoding="utf-8") as f:
    points_data = json.load(f)

# 坡度阈值（判断方向）
SLOPE_THRESHOLD = 0.1


def generate_slopes(points, total_distance):
    num_points = len(points)
    course_length = total_distance
    slopes = []

    # 先生成每个米的位置对应的 slope 和 direction
    slope_list = []
    for pos in range(0, int(course_length) + 1):
        t = 1000 * pos / course_length
        i = int(t)
        if i >= num_points - 1:
            i = num_points - 2
        slope_value = 100 * (points[i] + (points[i + 1] - points[i]) * (t - i))
        direction = 1 if slope_value > 1 else -1 if slope_value < -1 else 0
        slope_list.append((pos, slope_value, direction))

    pos = 1
    while pos < len(slope_list):
        _, slope_value, direction = slope_list[pos]
        if direction != 0 and direction != slope_list[pos - 1][2]:
            end_pos = pos
            totol_slope = slope_value
            while end_pos < len(slope_list) and direction == slope_list[end_pos][2]:
                totol_slope += slope_list[end_pos][1]
                end_pos += 1
            segment = {
                "start": int(pos),
                "length": int(end_pos - pos + 1),
                "slope": totol_slope / (end_pos - pos + 1) * 10000,
            }
            slopes.append(segment)
            pos = end_pos
        pos += 1

    return slopes


# 遍历每个 course，填充 slopes
for course_id, course in course_data.items():
    points = points_data[str(course["raceTrackId"])]["courses"][course_id]["slopes"]
    if not points:
        continue
    total_distance = course.get("distance", 1200)
    course["slopes"] = generate_slopes(points, total_distance)

# 保存新文件
with open("umalator-cn/course_data.json", "w", encoding="utf-8") as f:
    json.dump(course_data, f, ensure_ascii=False, indent=4)

print("转换完成，生成 course_data_with_slopes.json")
