"""Generate the dashboard catalog and icon atlas from a local Steam install."""

import argparse
import html
import json
import re
import struct
from pathlib import Path

from PIL import Image
import UnityPy


TAG_NAMES = {
    "Main": "메인", "Sub": "서브", "Buff": "버프", "Protect": "보호", "Summon": "소환",
    "Curse": "저주", "Enchant": "인챈트", "Physics": "물리", "Magic": "마법", "Spell": "주문",
    "Aim": "조준", "Bomb": "폭탄", "SpellBomb": "주문폭탄", "Melee": "근접",
    "Projectile": "투사체", "Chain": "연쇄", "Flame": "화염", "Frost": "냉기", "Poison": "독",
    "Lightning": "번개", "Bleed": "출혈", "Divinity": "신성", "Darkness": "암흑",
}
GRADES = ("하급", "중급", "상급", "특급", "보스")
TABLES = {"ArtifactTable", "SkillTable", "ArenaTable"}
ATLAS_COLUMNS = 20
TILE_SIZE = 44


def read_localization(data):
    # The serialized I2Languages MonoBehaviour starts with a 28-byte Unity header.
    offset = 28

    def count(maximum):
        nonlocal offset
        length, = struct.unpack_from("<i", data, offset)
        offset += 4
        if not 0 <= length <= maximum:
            raise ValueError("I2Languages 배열의 길이가 올바르지 않습니다.")
        return length

    def aligned_bytes(length):
        nonlocal offset
        end = offset + length
        if end > len(data):
            raise ValueError("I2Languages 데이터가 중간에 끝났습니다.")
        value = data[offset:end]
        offset = (end + 3) & ~3
        return value

    def string():
        return aligned_bytes(count(len(data) - offset - 4)).decode("utf-8")

    def strings():
        return [string() for _ in range(count(100))]

    if string() != "I2Languages":
        raise ValueError("I2Languages 헤더를 읽을 수 없습니다.")
    offset += 12  # Source metadata preceding the serialized term array.
    result = {}
    for _ in range(count(100_000)):
        key = string()
        offset += 4  # Term metadata preceding the translations.
        values = strings()
        flag_count = count(100)
        aligned_bytes(flag_count)
        strings()  # Touch translations.
        if values and key.startswith(("Skill/", "Artifact/")):
            result[key] = " ".join(html.unescape(re.sub(r"<[^>]+>", "", values[0])).split())
    return result


def installed_resources(game_data):
    archive = UnityPy.load(str(game_data / "data.unity3d"))
    tables = {}
    terms = None
    version = None
    for asset in archive.objects:
        if asset.type.name == "PlayerSettings":
            version = asset.read_typetree(check_read=False)["bundleVersion"]
        if asset.assets_file.name != "resources.assets":
            continue
        if asset.type.name == "TextAsset":
            name = asset.peek_name()
            if name in TABLES:
                tables[name] = json.loads(asset.read_typetree()["m_Script"])["tableResult"]
        elif asset.type.name == "MonoBehaviour" and asset.peek_name() == "I2Languages":
            terms = read_localization(asset.get_raw_data())
    if tables.keys() != TABLES or not terms or not version:
        raise ValueError("설치본에서 버전, 도감 테이블 또는 번역 정보를 찾을 수 없습니다.")
    return tables, terms, version


def windows_bundle(game_data, pattern):
    paths = list((game_data / "StreamingAssets" / "aa").glob("StandaloneWin*/" + pattern))
    if len(paths) != 1:
        raise ValueError(f"{pattern}에 해당하는 Windows 번들 하나를 찾을 수 없습니다.")
    return str(paths[0])


def table_rows(columns):
    names = [key.split(":")[0].strip() for key in columns]
    rows = (dict(zip(names, values)) for values in zip(*columns.values(), strict=True))
    return {int(row["id"] or 0): row for row in rows}


def read_references(bundles, database, field):
    suffix = f"/{database}.asset".lower()
    asset = next((item for path, item in bundles.container.items() if path.lower().endswith(suffix)), None)
    if asset is None:
        raise ValueError(f"{database}를 읽을 수 없습니다.")
    asset = asset.deref()
    for item in asset.read_typetree()[field]:
        yield asset.assets_file.objects[item["m_PathID"]].read_typetree()


def catalog_entries(tables, terms, bundles):
    skills = table_rows(tables["SkillTable"]["SkillData"])
    artifacts = table_rows(tables["ArtifactTable"]["ArtifactData"])
    curses = table_rows(tables["ArtifactTable"]["Curse"])
    arena = tables["ArenaTable"]["SpecialArtifact"]
    arena_ids = {int(id_) for id_, excluded in zip(arena["ID : int"], arena["CantSell : bool"], strict=True)
                 if excluded == "false"}

    def entry(id_, kind, key, table, asset):
        tags = table.get("SkillTag", "")
        grade = table.get("Rank", "")
        condition = terms.get(key + ".Unlock", "")
        if kind == "skill":
            tags = ", ".join(label for tag, label in TAG_NAMES.items() if table.get("Tag_" + tag) == "1")
            grade = ""
        elif kind == "curse":
            grade = table["rank"].removeprefix("저주 ")
            condition = "던전에서 저주 유물 획득"
        elif kind == "arena":
            condition = "투기장에서 기본 사용 가능"
        condition = {"통상": "기본 해금", "통상 대기": "도감 표기 · 통상 대기"}.get(condition, condition)
        return {
            "id": id_, "kind": kind, "name": terms[key + (".name" if kind == "skill" else ".Name")],
            "grade": grade, "tags": tags, "condition": condition or "도감에 표시된 조건 없음",
            "icon": asset["iconData"]["address"], "defaultUnlocked": kind == "arena" or table.get("Unlock") == "1",
        }

    skill_entries = []
    for asset in read_references(bundles, "SkillInfoDatabase", "skills"):
        id_ = asset["skillId"]
        table = skills[id_ * 10]
        if table["CantDrop"] == "false":
            skill_entries.append(entry(id_, "skill", f"Skill/Skill{id_}", table, asset))

    artifact_entries = []
    arena_entries = []
    for asset in read_references(bundles, "ArtifactInfoDatabase", "normalArtifacts"):
        id_ = asset["artifactId"]
        table = artifacts[id_]
        if table["CantDrop"] == "false":
            artifact_entries.append(entry(id_, "artifact", f"Artifact/Arti{id_}", table, asset))
        if id_ in arena_ids:
            arena_entries.append(entry(id_, "arena", f"Artifact/Arti{id_}", table, asset))
    for asset in read_references(bundles, "ArtifactInfoDatabase", "curseArtifacts"):
        id_ = asset["artifactId"]
        table = curses[id_]
        if table.get("canGet") != "-1":
            artifact_entries.append(entry(id_, "curse", f"Artifact/CursedArti{id_}", table, asset))
    artifact_entries.extend(arena_entries)
    return skill_entries, artifact_entries


def make_atlas(entries, bundles):
    sprites = {path.split("4.UI/")[-1].lower(): item
               for path, item in bundles.container.items() if item.type.name == "Sprite"}
    rows = (len(entries) + ATLAS_COLUMNS - 1) // ATLAS_COLUMNS
    atlas = Image.new("RGBA", (ATLAS_COLUMNS * TILE_SIZE, rows * TILE_SIZE))
    index = 0
    for entry in entries:
        sprite = sprites.get(entry["icon"].lower().removeprefix("sprite/"))
        entry["icon"] = -1
        if sprite is None:
            continue
        try:
            icon = sprite.read().image.convert("RGBA")
        except (AttributeError, KeyError, ValueError):
            continue
        bounds = icon.getchannel("A").getbbox()
        if not bounds:
            continue
        icon = icon.crop(bounds)
        scale = 40 / max(icon.size)
        icon = icon.resize(tuple(max(1, round(side * scale)) for side in icon.size), Image.Resampling.NEAREST)
        x = index % ATLAS_COLUMNS * TILE_SIZE + (TILE_SIZE - icon.width) // 2
        y = index // ATLAS_COLUMNS * TILE_SIZE + (TILE_SIZE - icon.height) // 2
        atlas.alpha_composite(icon, (x, y))
        entry["icon"] = index
        index += 1
    return atlas, index


def main():
    parser = argparse.ArgumentParser(description="Steam 설치본에서 도감과 아이콘을 생성합니다.")
    parser.add_argument("game_dir", type=Path, help="dungeonslasher_Data가 있는 Steam 게임 폴더")
    game_data = parser.parse_args().game_dir / "dungeonslasher_Data"
    if not (game_data / "data.unity3d").is_file():
        parser.error("dungeonslasher_Data/data.unity3d를 찾을 수 없습니다. Steam 게임 설치 경로를 확인하세요.")

    tables, terms, version = installed_resources(game_data)
    bundles = UnityPy.load(*(windows_bundle(game_data, pattern) for pattern in (
        "*monoscripts*.bundle", "data_assets*.bundle", "sprite_assets_sprite*.bundle",
    )))
    skills, artifacts = catalog_entries(tables, terms, bundles)
    atlas, icon_count = make_atlas(skills + artifacts, bundles)
    artifacts.sort(key=lambda entry: (GRADES.index(entry["grade"]), entry["kind"] != "artifact", entry["id"]))
    catalog = {"version": version, "skills": skills, "artifacts": artifacts}
    output = Path(__file__).resolve().parents[1] / "generated"
    output.mkdir(exist_ok=True)
    atlas.save(output / "icons.png", optimize=True)
    (output / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{version} · 스킬 {len(skills)}개 · 유물 {len(artifacts)}개 · 아이콘 {icon_count}개")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, struct.error) as error:
        raise SystemExit(f"도감 생성 실패: {error}") from error
