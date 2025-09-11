import json
import re
import os

from bs4 import BeautifulSoup
import requests


class GameDatabase:
    def __init__(self, source_path: str, cache_path: str = "namedict.json"):
        self.source_path = source_path
        self.cache_path = cache_path
        self.index_map = {}  # type:ignore
        self._build_cache()

    def _parse_line_to_dict(self, line: str) -> dict | None:
        try:
            pattern = re.compile(r'(\w+)=["\'](.*?)["\'](?=[,}])')
            pairs = pattern.findall(line)
            return dict(pairs) if pairs else None
        except:
            return None

    def _build_cache(self):
        with open(self.source_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip(",\n ")
                if not line or "{" not in line:
                    continue
                item = self._parse_line_to_dict(line)
                if item is None:
                    continue
                if "index" in item and "text_CN" in item and "category" in item:
                    key = f"{item['category']}_{item['index']}"
                    if key in self.index_map:
                        print(f"[Warning] Duplicate index: {key}")
                    else:
                        self.index_map[key] = item

        self.reverse_map = {}
        # 建立反向索引
        for key, data in self.index_map.items():
            cat = data.get("category")
            name = data.get("text_CN")
            idx = data.get("index")
            if idx[0] == "9":
                continue  # 跳过继承
            if cat and name and idx:
                self.reverse_map[(cat, name)] = idx

        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(self.index_map, f, ensure_ascii=False, indent=2)

    def _load_cache(self):
        with open(self.cache_path, "r", encoding="utf-8") as f:
            self.index_map = json.load(f)

    def get_name(self, category: str, index: str) -> str:
        """传入 category 和 index，返回 text_CN 中文名"""
        key = f"{category}_{index}"
        return self.index_map.get(key, {}).get("text_CN", f"[Missing] {key}")

    def get_id(self, category: str, name: str, inherit=False) -> str:
        """传入 category 和 text_CN 中文名，返回 index"""
        idx = self.reverse_map.get((category, name))
        if idx is None:
            return f"[Missing] {category}_{name}"

        if inherit:
            idx = "9" + idx[1:]
        return idx

    def create_umas_json(self, output_path="umas.json"):
        result = {}

        for key, data in self.index_map.items():
            uma_id = str(data["index"][:4])
            if int(data["category"]) != 4:
                continue
            match = re.match(r"(\[.*?\])(.*)", data["text_CN"])
            if not match:
                continue
            outfit_name_jp = match.group(1)  # [スペシャルドリーマー]
            char_name_jp = match.group(2)  # スペシャルウィーク

            if uma_id not in result:
                result[uma_id] = {
                    "name": [
                        char_name_jp,
                    ],
                    "outfits": {},
                }

            result[uma_id]["outfits"][data["index"]] = outfit_name_jp

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=4)

    def create_skill_names_json(self, output_path="skillnames.json"):
        result = {}

        for key, data in self.index_map.items():
            skill_id = str(data["index"])
            if int(data["category"]) != 47:
                continue
            name = data["text_CN"]
            if not name:
                name = data["text_TW"]
            if not name:
                name = data["text_JP"]

            if not data["text_CN"]:
                name = f"[未实装] {name}"
            if skill_id[0] == "9":
                name += " (继承)"
            result[skill_id] = [name]

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=4)


# 🧪 示例用法
if __name__ == "__main__":
    using_new_web_data = False
    if using_new_web_data:
        url = "https://wiki.biligame.com/umamusume/%E6%A8%A1%E5%9D%97:%E7%BF%BB%E8%AF%91%E6%95%B0%E6%8D%AE%E5%BA%93"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, "html.parser")

        pre = soup.find("pre", class_="mw-code mw-script", dir="ltr")
        text_copy = pre.get_text()
        with open("python/name.lua", "w", encoding="utf-8") as f:
            f.write(text_copy)
    db = GameDatabase("python/name.lua", "name.json")
    db.create_umas_json(output_path="umalator-cn/umas.json")
    db.create_skill_names_json(output_path="umalator-cn/skillnames.json")
