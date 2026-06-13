#!/usr/bin/env python3
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from io import BytesIO

import cv2
import numpy as np
from PIL import Image


CODE_RE = re.compile(r"^[A-Z][0-9]{1,2}$")


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        image = load_image(payload.get("imageDataUrl", ""))
        palette = normalize_palette(payload.get("palette") or [])
        if image is None:
            return emit({"ok": False, "message": "图纸图片无法读取。"})
        if not palette:
            return emit({"ok": False, "message": "色块库为空，无法解析。"})

        bbox = detect_grid_bbox(image)
        if not bbox:
            return emit({"ok": False, "message": "未能定位图纸上半部分的像素网格。"})

        expected_width = safe_int(payload.get("expectedWidth"))
        expected_height = safe_int(payload.get("expectedHeight"))
        width, height, score = infer_grid_size(image, bbox, palette, expected_width, expected_height)
        ocr_result = build_matrix_from_text_ocr(image, bbox, palette, width, height)
        if not ocr_result["ok"]:
            return emit(ocr_result)
        matrix = ocr_result["matrix"]
        failures = ocr_result["failures"]
        low_confidence = ocr_result["lowConfidenceCells"]
        stats = ocr_result["stats"]
        matrix, failures, low_confidence, placement = fit_matrix_to_output_board(matrix, failures, low_confidence, palette, width, height)
        output_height = len(matrix)
        output_width = len(matrix[0]) if matrix else width
        used_ids = sorted({cell for row in matrix for cell in row})
        palette_snapshot = [block for block in palette if block["id"] in used_ids]

        emit(
            {
                "ok": True,
                "width": output_width,
                "height": output_height,
                "matrix": {"width": output_width, "height": output_height, "rows": matrix},
                "paletteSnapshot": palette_snapshot,
                "failures": failures,
                "lowConfidenceCells": low_confidence[:500],
                "stats": {
                    **stats,
                    **placement,
                    "recognized": output_width * output_height,
                    "total": output_width * output_height,
                    "detectedRecognized": width * height,
                    "gridBBox": {"x": bbox[0], "y": bbox[1], "width": bbox[2], "height": bbox[3]},
                    "sizeScore": score,
                    "usedColors": len(used_ids),
                    "lowConfidence": len(low_confidence),
                    "failures": len(failures),
                },
                "method": "cell-text-ocr",
                "ocrAvailable": True,
                "message": "已按每个格子内的文字色号逐格解析图纸。",
            }
        )
    except Exception as exc:
        emit({"ok": False, "message": f"图纸解析失败：{exc}"})


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False))


def load_image(data_url):
    if not data_url or "," not in data_url:
        return None
    raw = base64.b64decode(data_url.split(",", 1)[1])
    return np.array(Image.open(BytesIO(raw)).convert("RGB"))


def normalize_palette(items):
    palette = []
    for item in items:
        code = str(item.get("code", "")).strip().upper()
        rgb = item.get("rgb")
        if not CODE_RE.match(code) or not isinstance(rgb, list) or len(rgb) != 3:
            continue
        palette.append(
            {
                "id": str(item.get("id")),
                "code": code,
                "name": str(item.get("name") or code),
                "rgb": [int(clamp(v, 0, 255)) for v in rgb],
                "status": item.get("status") or "active",
                "stock": safe_int(item.get("stock"), 0),
            }
        )
    return palette


def detect_grid_bbox(image):
    height, width = image.shape[:2]
    upper = image[: int(height * 0.78)]
    hsv = cv2.cvtColor(upper, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(upper, cv2.COLOR_RGB2GRAY)
    mask = ((hsv[:, :, 1] > 25) & (gray < 248)).astype("uint8")
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    components, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    best = None
    for index in range(1, components):
        x, y, w, h, area = stats[index]
        if area < 10000:
            continue
        ratio = w / max(1, h)
        if ratio < 0.75 or ratio > 1.25:
            continue
        if best is None or area > best[-1]:
            best = (int(x), int(y), int(w), int(h), int(area))
    if best:
        refined = refine_grid_bbox(image, best[:4])
        return refined or best[:4]

    ys, xs = np.where(mask > 0)
    if not len(xs):
        return None
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    side = max(x1 - x0 + 1, y1 - y0 + 1)
    return refine_grid_bbox(image, (x0, y0, min(side, width - x0), min(side, height - y0))) or (
        x0,
        y0,
        min(side, width - x0),
        min(side, height - y0),
    )


def refine_grid_bbox(image, bbox):
    x, y, w, h = bbox
    roi = image[y : y + h, x : x + w]
    if roi.size == 0:
        return None
    hsv = cv2.cvtColor(roi, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    mask = (((hsv[:, :, 1] > 20) & (gray < 252)) | (gray < 210)).astype("uint8")
    col = mask.sum(axis=0)
    row = mask.sum(axis=1)
    col_threshold = max(20, int(h * 0.45))
    row_threshold = max(20, int(w * 0.45))
    cols = np.where(col > col_threshold)[0]
    rows = np.where(row > row_threshold)[0]
    if not len(cols) or not len(rows):
        return None
    x0, x1 = int(cols.min()), int(cols.max())
    y0, y1 = int(rows.min()), int(rows.max())
    rw = x1 - x0 + 1
    rh = y1 - y0 + 1
    if rw < w * 0.6 or rh < h * 0.6:
        return None
    side = int(round((rw + rh) / 2))
    return (x + x0, y + y0, min(side, image.shape[1] - x - x0), min(side, image.shape[0] - y - y0))


def infer_grid_size(image, bbox, palette, expected_width=None, expected_height=None):
    candidates = []
    for size in [40, 50, 100, expected_width, expected_height]:
        if size and size >= 10 and size not in candidates:
            candidates.append(size)

    scored = []
    for size in candidates:
        score = score_grid_size(image, bbox, palette, size)
        scored.append((score, size))
    scored.sort(key=lambda item: item[0])
    best_score, best_size = scored[0]
    return best_size, best_size, round(float(best_score), 3)


def score_grid_size(image, bbox, palette, size):
    x, y, w, h = bbox
    cell_w = w / size
    cell_h = h / size
    if cell_w < 5 or cell_h < 5:
        return 9999
    step = max(1, size // 18)
    distances = []
    for row in range(0, size, step):
        for col in range(0, size, step):
            rgb = sample_cell_rgb(image, bbox, size, size, col, row)
            distance, _ = nearest_palette(rgb, palette)
            distances.append(distance)
    if not distances:
        return 9999
    return float(np.percentile(distances, 75) + np.mean(distances) * 0.25)


def build_matrix(image, bbox, palette, width, height):
    rows = []
    distances = []
    low_confidence = []
    for y in range(height):
        row = []
        for x in range(width):
            rgb = sample_cell_rgb(image, bbox, width, height, x, y)
            distance, block = nearest_palette(rgb, palette)
            distances.append(distance)
            row.append(block["id"])
            if distance > 42:
                low_confidence.append(
                    {
                        "x": x,
                        "y": y,
                        "code": block["code"],
                        "blockId": block["id"],
                        "distance": round(float(distance), 1),
                        "source": [int(v) for v in rgb],
                    }
                )
        rows.append(row)
    stats = {
        "recognized": width * height,
        "total": width * height,
        "averageDistance": round(float(np.mean(distances)) if distances else 0, 2),
        "p90Distance": round(float(np.percentile(distances, 90)) if distances else 0, 2),
    }
    return rows, low_confidence, stats


def build_matrix_from_text_ocr(image, bbox, palette, width, height):
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return {
            "ok": False,
            "message": "服务器未安装 OCR 引擎，无法按格内文字色号严格解析图纸。请先安装 Tesseract OCR 后重试。",
            "ocrAvailable": False,
        }

    palette_by_code = {block["code"]: block for block in palette}
    cell_rgbs = sample_cell_rgbs(image, bbox, width, height)
    cluster_count = estimate_cluster_count(image, bbox, width, height)
    labels, centers = cluster_cell_colors(cell_rgbs, cluster_count)
    ocr_votes = collect_grid_ocr_votes(tesseract, image, bbox, width, height, palette_by_code)
    cluster_votes = [dict() for _ in range(cluster_count)]
    for index, votes in enumerate(ocr_votes):
        if not votes:
            continue
        cluster_index = int(labels[index])
        bucket = cluster_votes[cluster_index]
        for code, count in votes.items():
            bucket[code] = bucket.get(code, 0) + count

    cluster_codes = []
    inferred_clusters = set()
    ocr_confirmed = 0
    for cluster_index in range(cluster_count):
        total = int(np.count_nonzero(labels == cluster_index))
        votes = cluster_votes[cluster_index]
        code = None
        if votes:
            code, vote_count = sorted(votes.items(), key=lambda item: item[1], reverse=True)[0]
            if vote_count < max(2, total * 0.06):
                code = None
        if code:
            ocr_confirmed += total
        else:
            _, nearest = nearest_palette(centers[cluster_index].tolist(), palette)
            code = nearest["code"]
            inferred_clusters.add(cluster_index)
        code = correct_code_by_cluster_color(code, centers[cluster_index], palette_by_code)
        cluster_codes.append(code)

    rows = []
    low_confidence = []
    for y in range(height):
        row = []
        for x in range(width):
            index = y * width + x
            cluster_index = int(labels[index])
            code = cluster_codes[cluster_index]
            block = palette_by_code.get(code) or find_blank_block(palette)
            row.append(block["id"])
            if cluster_index in inferred_clusters:
                low_confidence.append(
                    {
                        "x": x,
                        "y": y,
                        "code": block["code"],
                        "blockId": block["id"],
                        "distance": 0,
                        "source": [int(v) for v in cell_rgbs[index]],
                        "reason": "OCR 未直接确认，已按同色簇和色块颜色推测",
                    }
                )
        rows.append(row)

    return {
        "ok": True,
        "matrix": rows,
        "failures": [],
        "lowConfidenceCells": low_confidence,
        "stats": {
            "recognized": width * height,
            "total": width * height,
            "ocrConfirmed": ocr_confirmed,
            "inferred": width * height - ocr_confirmed,
            "clusters": cluster_count,
        },
    }


def sample_cell_rgbs(image, bbox, width, height):
    rgbs = []
    for y in range(height):
        for x in range(width):
            rgbs.append(sample_cell_rgb(image, bbox, width, height, x, y))
    return np.array(rgbs, dtype="float32")


def estimate_cluster_count(image, bbox, width, height):
    swatches = detect_palette_swatch_boxes(image, bbox)
    if swatches:
        return int(clamp(len(swatches) + 6, 12, 48))
    return int(clamp(round(np.sqrt(width * height) / 2), 16, 48))


def detect_palette_swatch_boxes(image, bbox):
    _, grid_y, _, grid_h = bbox
    start_y = min(image.shape[0] - 1, int(grid_y + grid_h + 12))
    lower = image[start_y:]
    if lower.size == 0:
        return []
    hsv = cv2.cvtColor(lower, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(lower, cv2.COLOR_RGB2GRAY)
    mask = ((hsv[:, :, 1] > 35) & (gray < 250)).astype("uint8") * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        if 28 <= w <= 100 and 28 <= h <= 100 and area > 600:
            boxes.append((x, y, w, h))
    return boxes


def cluster_cell_colors(cell_rgbs, cluster_count):
    if len(cell_rgbs) <= cluster_count:
        labels = np.arange(len(cell_rgbs), dtype=np.int32)
        return labels, cell_rgbs
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.5)
    _, labels, centers = cv2.kmeans(cell_rgbs, cluster_count, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
    return labels.flatten(), centers


def collect_grid_ocr_votes(tesseract, image, bbox, width, height, palette_by_code):
    scale = 3
    bx, by, bw, bh = bbox
    crop = image[by : by + bh, bx : bx + bw]
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    votes = [dict() for _ in range(width * height)]
    with tempfile.TemporaryDirectory(prefix="pixel-pattern-ocr-") as temp_dir:
        path = os.path.join(temp_dir, "grid.png")
        cv2.imwrite(path, enlarged)
        command = [
            tesseract,
            path,
            "stdout",
            "--psm",
            "6",
            "--oem",
            "1",
            "-c",
            "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            "tsv",
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=45)
    cell_w = bw / width
    cell_h = bh / height
    for line in (result.stdout or "").splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 12:
            continue
        raw = parts[11].strip()
        codes = parse_ocr_codes(raw, palette_by_code)
        if not codes:
            continue
        left, top, box_w, box_h = [safe_float(value, 0) for value in parts[6:10]]
        for index, code in enumerate(codes):
            px = (left + (index + 0.5) * box_w / len(codes)) / scale
            py = (top + box_h / 2) / scale
            x = int(px / cell_w)
            y = int(py / cell_h)
            if x < 0 or y < 0 or x >= width or y >= height:
                continue
            cell_index = y * width + x
            votes[cell_index][code] = votes[cell_index].get(code, 0) + 1
    return votes


def parse_ocr_codes(raw, palette_by_code):
    raw = re.sub(r"[^A-Z0-9]", "", str(raw or "").upper())
    codes = []
    index = 0
    while index < len(raw):
        found = ""
        found_length = 0
        for length in (3, 2):
            code = normalize_single_code(raw[index : index + length])
            if code and code in palette_by_code:
                found = code
                found_length = length
                break
        if found:
            codes.append(found)
            index += found_length
        else:
            index += 1
    return codes


def correct_code_by_cluster_color(code, rgb, palette_by_code):
    block = palette_by_code.get(code)
    if not block:
        return code
    current_distance = color_distance(rgb, block["rgb"])
    number = re.sub(r"^[A-Z]", "", code)
    if not number:
        return code
    candidates = [item for item in palette_by_code.values() if re.sub(r"^[A-Z]", "", item["code"]) == number]
    if not candidates:
        return code
    best = min(candidates, key=lambda item: color_distance(rgb, item["rgb"]))
    best_distance = color_distance(rgb, best["rgb"])
    if best["code"] != code and current_distance - best_distance > 45:
        return best["code"]
    return code


def color_distance(a, b):
    return float(np.linalg.norm(np.array(a, dtype=float) - np.array(b, dtype=float)))


def normalize_single_code(value):
    value = re.sub(r"[^A-Z0-9]", "", str(value or "").upper())
    if not value:
        return ""
    letter_replacements = {"8": "B", "6": "B", "0": "D", "O": "D"}
    digit_replacements = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "A": "1", "T": "1", "Z": "2", "S": "5", "G": "6", "B": "8", "H": "4"})
    first = letter_replacements.get(value[0], value[0])
    if not first.isalpha():
        return ""
    digits = value[1:].translate(digit_replacements)
    candidate = f"{first}{digits}"
    if CODE_RE.match(candidate):
        return candidate
    match = re.match(r"^([A-Z])([0-9OILSZ]{1,2})$", value)
    if not match:
        return value if CODE_RE.match(value) else ""
    return f"{match.group(1)}{match.group(2).translate(digit_replacements)}"


def fit_matrix_to_output_board(matrix, failures, low_confidence, palette, detected_width, detected_height):
    placement = {
        "detectedWidth": detected_width,
        "detectedHeight": detected_height,
        "outputWidth": detected_width,
        "outputHeight": detected_height,
        "contentOffsetX": 0,
        "contentOffsetY": 0,
    }
    if detected_width != 40 or detected_height != 40:
        return matrix, failures, low_confidence, placement

    blank = find_blank_block(palette)
    output_width = 50
    output_height = 50
    offset_x = (output_width - detected_width) // 2
    offset_y = (output_height - detected_height) // 2
    output = [[blank["id"] for _ in range(output_width)] for _ in range(output_height)]
    for y, row in enumerate(matrix):
        for x, block_id in enumerate(row):
            output[y + offset_y][x + offset_x] = block_id

    shifted_failures = [
        {
            **cell,
            "x": cell["x"] + offset_x,
            "y": cell["y"] + offset_y,
        }
        for cell in failures
    ]
    shifted_low_confidence = [
        {
            **cell,
            "x": cell["x"] + offset_x,
            "y": cell["y"] + offset_y,
        }
        for cell in low_confidence
    ]
    return output, shifted_failures, shifted_low_confidence, {
        **placement,
        "outputWidth": output_width,
        "outputHeight": output_height,
        "contentOffsetX": offset_x,
        "contentOffsetY": offset_y,
        "blankCode": blank["code"],
        "blankBlockId": blank["id"],
    }


def find_blank_block(palette):
    for code in ("H2", "01"):
        for block in palette:
            if block["code"] == code:
                return block
    white = np.array([255, 255, 255], dtype=float)
    return min(palette, key=lambda block: float(np.linalg.norm(white - np.array(block["rgb"], dtype=float))))


def sample_cell_rgb(image, bbox, width, height, x, y):
    bx, by, bw, bh = bbox
    cell_w = bw / width
    cell_h = bh / height
    radius = max(1, int(min(cell_w, cell_h) * 0.11))
    samples = []
    for fx, fy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
        cx = bx + (x + fx) * cell_w
        cy = by + (y + fy) * cell_h
        x0 = max(0, int(cx - radius))
        x1 = min(image.shape[1], int(cx + radius + 1))
        y0 = max(0, int(cy - radius))
        y1 = min(image.shape[0], int(cy + radius + 1))
        patch = image[y0:y1, x0:x1]
        if patch.size:
            samples.append(patch.reshape(-1, 3))
    if not samples:
        return [255, 255, 255]
    pixels = np.concatenate(samples, axis=0)
    return np.median(pixels, axis=0).tolist()


def nearest_palette(rgb, palette):
    rgb_vec = np.array(rgb, dtype=float)
    best = None
    for block in palette:
        distance = float(np.linalg.norm(rgb_vec - np.array(block["rgb"], dtype=float)))
        if best is None or distance < best[0]:
            best = (distance, block)
    return best


def safe_int(value, default=None):
    try:
        return int(value)
    except Exception:
        return default


def safe_float(value, default=0):
    try:
        return float(value)
    except Exception:
        return default


def clamp(value, low, high):
    return max(low, min(high, value))


if __name__ == "__main__":
    main()
