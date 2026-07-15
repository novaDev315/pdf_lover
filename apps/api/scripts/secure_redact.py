#!/usr/bin/env python3
"""Raster-rebuild a PDF after applying validated top-left redaction rectangles."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def fail(message: str) -> None:
    raise ValueError(message)


def load_redactions(path: Path) -> list[dict[str, float | int]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not isinstance(value.get("redactions"), list):
        fail("options.redactions must be an array")
    redactions = value["redactions"]
    if not 1 <= len(redactions) <= 500:
        fail("options.redactions must contain between 1 and 500 rectangles")
    normalized: list[dict[str, float | int]] = []
    for index, item in enumerate(redactions):
        if not isinstance(item, dict):
            fail(f"redactions[{index}] must be an object")
        page = item.get("page")
        if not isinstance(page, int) or isinstance(page, bool) or page < 1:
            fail(f"redactions[{index}].page must be a positive integer")
        normalized_item: dict[str, float | int] = {"page": page}
        for key in ("x", "y", "width", "height"):
            number = item.get(key)
            if not isinstance(number, (int, float)) or isinstance(number, bool) or not math.isfinite(number):
                fail(f"redactions[{index}].{key} must be a finite number")
            if number < 0 or (key in ("width", "height") and number <= 0):
                fail(f"redactions[{index}].{key} is outside the page")
            normalized_item[key] = float(number)
        normalized.append(normalized_item)
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--options", required=True, type=Path)
    parser.add_argument("--dpi", type=int, default=150)
    arguments = parser.parse_args()
    if not 72 <= arguments.dpi <= 300:
        fail("dpi must be between 72 and 300")

    redactions = load_redactions(arguments.options)
    pages_dir = arguments.output.parent / "redaction-pages"
    pages_dir.mkdir(mode=0o700, exist_ok=False)
    prefix = pages_dir / "page"
    subprocess.run(
        ["pdftocairo", "-png", "-r", str(arguments.dpi), str(arguments.input), str(prefix)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    page_paths = sorted(
        pages_dir.glob("page-*.png"),
        key=lambda path: int(path.stem.rsplit("-", 1)[1]),
    )
    if not page_paths:
        fail("Poppler rendered no PDF pages")
    if len(page_paths) > 250:
        fail("Secure redaction is limited to 250 pages per job")

    scale = arguments.dpi / 72
    by_page: dict[int, list[dict[str, float | int]]] = {}
    for redaction in redactions:
        by_page.setdefault(int(redaction["page"]), []).append(redaction)
    if max(by_page) > len(page_paths):
        fail("A redaction references a page outside the document")

    rebuilt_pages: list[Image.Image] = []
    total_pixels = 0
    for page_number, page_path in enumerate(page_paths, start=1):
        image = Image.open(page_path).convert("RGB")
        total_pixels += image.width * image.height
        if total_pixels > 500_000_000:
            fail("Rendered document exceeds the secure redaction pixel limit")
        draw = ImageDraw.Draw(image)
        for redaction in by_page.get(page_number, []):
            left = max(0, round(float(redaction["x"]) * scale))
            top = max(0, round(float(redaction["y"]) * scale))
            right = min(image.width, round((float(redaction["x"]) + float(redaction["width"])) * scale))
            bottom = min(image.height, round((float(redaction["y"]) + float(redaction["height"])) * scale))
            if right <= left or bottom <= top:
                fail("A redaction rectangle does not overlap its page")
            draw.rectangle((left, top, right, bottom), fill=(0, 0, 0))
        rebuilt_pages.append(image)

    first, *remaining = rebuilt_pages
    first.save(
        arguments.output,
        "PDF",
        save_all=True,
        append_images=remaining,
        resolution=float(arguments.dpi),
    )
    for image in rebuilt_pages:
        image.close()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
