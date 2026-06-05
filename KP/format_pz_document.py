# -*- coding: utf-8 -*-
"""Базовое оформление пояснительной записки по методичке ДП26 §3.1."""
from __future__ import annotations

import io
import os
import shutil
import zipfile

from lxml import etree

BASE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(BASE, "МояПеределка.docx")
BACKUP = os.path.join(BASE, "МояПеределка_backup.docx")
SHKEL = os.path.join(BASE, "ПЗ - Шкель Икс-парк_КП26.docx")

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}

LIST_STYLE = "a6"
LIST_NUM_ID = "29"

# ДП26 §3.1: поля 30/10/25/15 мм; межстрочный 18 пт; красная строка 1,25 см.
EXPECTED_PG_MAR = {
    "top": "1418",  # 25 мм
    "right": "567",  # 10 мм
    "bottom": "850",  # 15 мм
    "left": "1701",  # 30 мм
}
METHOD_LINE = "360"
METHOD_LINE_RULE = "exact"
METHOD_FIRST_LINE = "709"  # 1,25 см
METHOD_LIST_LEFT = "709"  # положение номера и отступ текста в списке (§3.1, рис. 3.11)


def qn(tag: str) -> str:
    prefix, name = tag.split(":")
    return f"{{{NS[prefix]}}}{name}"


def read_zip(path: str) -> dict[str, bytes]:
    with zipfile.ZipFile(path) as z:
        return {name: z.read(name) for name in z.namelist()}


def write_zip(path: str, parts: dict[str, bytes]) -> str:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts.items():
            z.writestr(name, data)
    try:
        with open(path, "wb") as f:
            f.write(buf.getvalue())
        return path
    except PermissionError:
        alt = path.replace(".docx", "_fixed.docx")
        with open(alt, "wb") as f:
            f.write(buf.getvalue())
        return alt


def paragraph_text(p: etree._Element) -> str:
    return "".join(t.text or "" for t in p.findall(".//w:t", NS))


def paragraph_style(p: etree._Element) -> str:
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        return ""
    ps = p_pr.find("w:pStyle", NS)
    return ps.get(qn("w:val"), "") if ps is not None else ""


def has_numbering(p: etree._Element) -> bool:
    p_pr = p.find("w:pPr", NS)
    return p_pr is not None and p_pr.find("w:numPr", NS) is not None


def get_or_create_p_pr(p: etree._Element) -> etree._Element:
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        p_pr = etree.SubElement(p, qn("w:pPr"))
    return p_pr


def apply_tnr_r_pr(r_pr: etree._Element, *, size: str = "28", bold: bool = False, caps: bool = False) -> None:
    fonts = r_pr.find("w:rFonts", NS)
    if fonts is None:
        fonts = etree.SubElement(r_pr, qn("w:rFonts"))
    fonts.set(qn("w:ascii"), "Times New Roman")
    fonts.set(qn("w:hAnsi"), "Times New Roman")
    fonts.set(qn("w:cs"), "Times New Roman")
    sz = r_pr.find("w:sz", NS)
    if sz is None:
        sz = etree.SubElement(r_pr, qn("w:sz"))
    sz.set(qn("w:val"), size)
    sz_cs = r_pr.find("w:szCs", NS)
    if sz_cs is None:
        sz_cs = etree.SubElement(r_pr, qn("w:szCs"))
    sz_cs.set(qn("w:val"), size)
    if bold:
        b = r_pr.find("w:b", NS)
        if b is None:
            b = etree.SubElement(r_pr, qn("w:b"))
        b.set(qn("w:val"), "1")
    else:
        b = r_pr.find("w:b", NS)
        if b is not None:
            r_pr.remove(b)
    if caps:
        c = r_pr.find("w:caps", NS)
        if c is None:
            c = etree.SubElement(r_pr, qn("w:caps"))
        c.set(qn("w:val"), "1")
    else:
        c = r_pr.find("w:caps", NS)
        if c is not None:
            r_pr.remove(c)


def ensure_run_tnr(run: etree._Element, *, size: str = "28") -> None:
    r_pr = run.find("w:rPr", NS)
    if r_pr is None:
        r_pr = etree.SubElement(run, qn("w:rPr"))
    apply_tnr_r_pr(r_pr, size=size)


def apply_body_p_pr(p_pr: etree._Element) -> None:
    jc = p_pr.find("w:jc", NS)
    if jc is None:
        jc = etree.SubElement(p_pr, qn("w:jc"))
    jc.set(qn("w:val"), "both")
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:line"), METHOD_LINE)
    sp.set(qn("w:lineRule"), METHOD_LINE_RULE)
    ind = p_pr.find("w:ind", NS)
    if ind is None:
        ind = etree.SubElement(p_pr, qn("w:ind"))
    ind.set(qn("w:firstLine"), METHOD_FIRST_LINE)


def apply_list_p_pr(p_pr: etree._Element) -> None:
    ps = p_pr.find("w:pStyle", NS)
    if ps is None:
        ps = etree.SubElement(p_pr, qn("w:pStyle"))
    ps.set(qn("w:val"), LIST_STYLE)
    num = p_pr.find("w:numPr", NS)
    if num is None:
        num = etree.SubElement(p_pr, qn("w:numPr"))
    ilvl = num.find("w:ilvl", NS)
    if ilvl is None:
        ilvl = etree.SubElement(num, qn("w:ilvl"))
    ilvl.set(qn("w:val"), "0")
    num_id = num.find("w:numId", NS)
    if num_id is None:
        num_id = etree.SubElement(num, qn("w:numId"))
    num_id.set(qn("w:val"), LIST_NUM_ID)
    jc = p_pr.find("w:jc", NS)
    if jc is None:
        jc = etree.SubElement(p_pr, qn("w:jc"))
    jc.set(qn("w:val"), "both")
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:line"), METHOD_LINE)
    sp.set(qn("w:lineRule"), METHOD_LINE_RULE)
    ind = p_pr.find("w:ind", NS)
    if ind is not None:
        for key in ("firstLine", "left", "hanging", "right", "start", "end"):
            attr = qn(f"w:{key}")
            if attr in ind.attrib:
                del ind.attrib[attr]


def set_page_margins(root: etree._Element) -> None:
    body = root.find("w:body", NS)
    sect = body.find("w:sectPr", NS)
    if sect is None:
        sect = etree.SubElement(body, qn("w:sectPr"))
    pg_mar = sect.find("w:pgMar", NS)
    if pg_mar is None:
        pg_mar = etree.SubElement(sect, qn("w:pgMar"))
    for key, val in EXPECTED_PG_MAR.items():
        pg_mar.set(qn(f"w:{key}"), val)


def copy_styles_from_shkel(parts: dict[str, bytes]) -> None:
    shkel = read_zip(SHKEL)
    parts["word/styles.xml"] = shkel["word/styles.xml"]
    if "word/numbering.xml" in shkel:
        parts["word/numbering.xml"] = shkel["word/numbering.xml"]
    styles_root = etree.fromstring(parts["word/styles.xml"])
    fix_style_a(styles_root)
    fix_style_a6(styles_root)
    parts["word/styles.xml"] = etree.tostring(styles_root, xml_declaration=True, encoding="UTF-8", standalone=True)
    if "word/numbering.xml" in parts:
        numbering_root = etree.fromstring(parts["word/numbering.xml"])
        fix_numbering_fonts(numbering_root)
        fix_numbering_indents(numbering_root)
        parts["word/numbering.xml"] = etree.tostring(
            numbering_root, xml_declaration=True, encoding="UTF-8", standalone=True
        )


def fix_style_a(styles_root: etree._Element) -> None:
    style = styles_root.find(".//w:style[@w:styleId='a']", NS)
    if style is None:
        return
    p_pr = style.find("w:pPr", NS)
    if p_pr is None:
        p_pr = etree.SubElement(style, qn("w:pPr"))
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:line"), METHOD_LINE)
    sp.set(qn("w:lineRule"), METHOD_LINE_RULE)
    ind = p_pr.find("w:ind", NS)
    if ind is None:
        ind = etree.SubElement(p_pr, qn("w:ind"))
    ind.set(qn("w:firstLine"), METHOD_FIRST_LINE)
    r_pr = style.find("w:rPr", NS)
    if r_pr is None:
        r_pr = etree.SubElement(style, qn("w:rPr"))
    apply_tnr_r_pr(r_pr)


def fix_style_a6(styles_root: etree._Element) -> None:
    style = styles_root.find(f".//w:style[@w:styleId='{LIST_STYLE}']", NS)
    if style is None:
        return
    r_pr = style.find("w:rPr", NS)
    if r_pr is None:
        r_pr = etree.SubElement(style, qn("w:rPr"))
    apply_tnr_r_pr(r_pr)
    p_pr = style.find("w:pPr", NS)
    if p_pr is None:
        p_pr = etree.SubElement(style, qn("w:pPr"))
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:line"), METHOD_LINE)
    sp.set(qn("w:lineRule"), METHOD_LINE_RULE)
    ind = p_pr.find("w:ind", NS)
    if ind is not None:
        for key in ("left", "hanging", "firstLine", "right", "start", "end"):
            attr = qn(f"w:{key}")
            if attr in ind.attrib:
                del ind.attrib[attr]


def fix_numbering_indents(numbering_root: etree._Element) -> None:
    abstract_ids: set[str] = set()
    for num in numbering_root.findall("w:num", NS):
        if num.get(qn("w:numId")) != LIST_NUM_ID:
            continue
        aid = num.find("w:abstractNumId", NS)
        if aid is not None:
            abstract_ids.add(aid.get(qn("w:val")))
    for aid in abstract_ids:
        absn = numbering_root.find(f".//w:abstractNum[@w:abstractNumId='{aid}']", NS)
        if absn is None:
            continue
        for lvl in absn.findall("w:lvl", NS):
            p_pr = lvl.find("w:pPr", NS)
            if p_pr is None:
                p_pr = etree.SubElement(lvl, qn("w:pPr"))
            ind = p_pr.find("w:ind", NS)
            if ind is None:
                ind = etree.SubElement(p_pr, qn("w:ind"))
            if lvl.get(qn("w:ilvl"), "0") == "0":
                ind.set(qn("w:left"), METHOD_LIST_LEFT)
                ind.set(qn("w:hanging"), "0")
            sp = p_pr.find("w:spacing", NS)
            if sp is None:
                sp = etree.SubElement(p_pr, qn("w:spacing"))
            sp.set(qn("w:line"), METHOD_LINE)
            sp.set(qn("w:lineRule"), METHOD_LINE_RULE)


def fix_numbering_fonts(numbering_root: etree._Element) -> None:
    for r_pr in numbering_root.findall(".//w:rPr", NS):
        apply_tnr_r_pr(r_pr)


def disable_hyphenation(parts: dict[str, bytes]) -> None:
    if "word/settings.xml" not in parts:
        return
    root = etree.fromstring(parts["word/settings.xml"])
    if root.find("w:suppressAutoHyphens", NS) is None:
        etree.SubElement(root, qn("w:suppressAutoHyphens"))
    parts["word/settings.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def fix_existing_list_fonts(body: etree._Element) -> int:
    count = 0
    for p in body.findall("w:p", NS):
        if paragraph_style(p) != LIST_STYLE and not has_numbering(p):
            continue
        p_pr = get_or_create_p_pr(p)
        apply_list_p_pr(p_pr)
        for run in p.findall("w:r", NS):
            ensure_run_tnr(run)
        count += 1
    return count


def format_document(target: str = TARGET) -> dict:
    if not os.path.exists(BACKUP):
        shutil.copy2(target, BACKUP)
    parts = read_zip(target)
    copy_styles_from_shkel(parts)
    disable_hyphenation(parts)
    root = etree.fromstring(parts["word/document.xml"])
    body = root.find("w:body", NS)
    set_page_margins(root)
    list_fix = fix_existing_list_fonts(body)
    parts["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    out = write_zip(target, parts)
    return {"output": out, "list_font_fix": list_fix}


if __name__ == "__main__":
    import json
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(format_document(), ensure_ascii=False, indent=2))
