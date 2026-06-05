# -*- coding: utf-8 -*-
"""Детальный аудит оформления по методичке ДП26 §3.1."""
from __future__ import annotations

import json
import re
import sys
import zipfile

from lxml import etree

from format_pz_document import (
    EXPECTED_PG_MAR,
    LIST_NUM_ID,
    LIST_STYLE,
    METHOD_FIRST_LINE,
    METHOD_LINE,
    METHOD_LINE_RULE,
    METHOD_LIST_LEFT,
    TARGET,
    has_numbering,
    paragraph_style,
    paragraph_text,
    qn,
    NS,
)
from fix_kp_document import (
    check_checklist_vmerge,
    check_testcase_vmerge,
    find_checklist_table,
    find_section4_range,
    find_testcase_table,
    get_heading_kind,
    is_layout_table,
    is_photo_placeholder,
    is_section_heading,
    is_subsection_heading,
    is_testcase_table,
    paragraph_jc,
    validate_expogo_test_tables,
)


def effective_style(styles: etree._Element, style_id: str) -> dict:
    result = {"font": None, "size": None, "line": None, "line_rule": None, "first_line": None, "jc": None}
    seen = set()
    sid = style_id or "a"
    while sid and sid not in seen:
        seen.add(sid)
        st = styles.find(f".//w:style[@w:styleId='{sid}']", NS)
        if st is None:
            break
        p_pr = st.find("w:pPr", NS)
        if p_pr is not None:
            sp = p_pr.find("w:spacing", NS)
            if sp is not None:
                if result["line"] is None and sp.get(qn("w:line")):
                    result["line"] = sp.get(qn("w:line"))
                if result["line_rule"] is None and sp.get(qn("w:lineRule")):
                    result["line_rule"] = sp.get(qn("w:lineRule"))
            ind = p_pr.find("w:ind", NS)
            if ind is not None and result["first_line"] is None and ind.get(qn("w:firstLine")):
                result["first_line"] = ind.get(qn("w:firstLine"))
            jc = p_pr.find("w:jc", NS)
            if jc is not None and result["jc"] is None:
                result["jc"] = jc.get(qn("w:val"))
        r_pr = st.find("w:rPr", NS)
        if r_pr is not None:
            f = r_pr.find("w:rFonts", NS)
            if f is not None and result["font"] is None:
                result["font"] = f.get(qn("w:ascii"))
            sz = r_pr.find("w:sz", NS)
            if sz is not None and result["size"] is None:
                result["size"] = sz.get(qn("w:val"))
        based = st.find("w:basedOn", NS)
        sid = based.get(qn("w:val")) if based is not None else None
    return result


def audit(path: str = TARGET) -> dict:
    with zipfile.ZipFile(path) as z:
        doc = etree.fromstring(z.read("word/document.xml"))
        styles = etree.fromstring(z.read("word/styles.xml"))
        settings = etree.fromstring(z.read("word/settings.xml"))
        numbering = etree.fromstring(z.read("word/numbering.xml")) if "word/numbering.xml" in z.namelist() else None
        headers = {n: z.read(n).decode("utf-8", errors="replace") for n in z.namelist() if n.startswith("word/header")}

    body = doc.find("w:body", NS)
    sect = body.find("w:sectPr", NS)
    pg_mar = sect.find("w:pgMar", NS)
    actual_mar = {k.split("}")[-1]: v for k, v in pg_mar.attrib.items()} if pg_mar is not None else {}

    body_ad = {"both": 0, "line360": 0, "first709": 0, "tnr14": 0, "total": 0}
    eff_ad = effective_style(styles, "ad")
    for p in body.findall("w:p", NS):
        if paragraph_style(p) != "ad":
            continue
        text = paragraph_text(p).strip()
        if not text or is_section_heading(p) or is_subsection_heading(p):
            continue
        if text == "АННОТАЦИЯ":
            continue
        p_pr = p.find("w:pPr", NS)
        jc = p_pr.find("w:jc", NS).get(qn("w:val")) if p_pr is not None and p_pr.find("w:jc", NS) is not None else eff_ad["jc"]
        if jc == "center":
            continue
        body_ad["total"] += 1
        sp = p_pr.find("w:spacing", NS) if p_pr is not None else None
        line = sp.get(qn("w:line")) if sp is not None and sp.get(qn("w:line")) else eff_ad["line"]
        lr = sp.get(qn("w:lineRule")) if sp is not None and sp.get(qn("w:lineRule")) else eff_ad["line_rule"]
        ind = p_pr.find("w:ind", NS) if p_pr is not None else None
        fl = ind.get(qn("w:firstLine")) if ind is not None and ind.get(qn("w:firstLine")) else eff_ad["first_line"]
        if jc == "both":
            body_ad["both"] += 1
        if line == "360" and lr == "exact":
            body_ad["line360"] += 1
        if fl == "709":
            body_ad["first709"] += 1
        body_ad["tnr14"] += 1

    headings = {"h13": 0, "h13_ok": 0, "h_center": 0, "h_center_ok": 0, "h23": 0, "h23_ok": 0}
    subsections = {"total": 0, "style25": 0}
    for p in body.findall("w:p", NS):
        kind = get_heading_kind(p)
        if kind == "h13":
            headings["h13"] += 1
            ok = paragraph_style(p) == "13"
            ok = ok and not any(r.find("w:rPr/w:b", NS) is not None for r in p.findall("w:r", NS))
            ok = ok and not any(r.find("w:rPr/w:caps", NS) is not None for r in p.findall("w:r", NS))
            if ok:
                headings["h13_ok"] += 1
        elif kind == "h_center":
            headings["h_center"] += 1
            p_pr = p.find("w:pPr", NS)
            jc = p_pr.find("w:jc", NS).get(qn("w:val")) if p_pr is not None and p_pr.find("w:jc", NS) is not None else ""
            ok = paragraph_style(p) != "ad" and jc == "center"
            if ok:
                headings["h_center_ok"] += 1
        elif kind == "h23":
            headings["h23"] += 1
            if paragraph_style(p) == "23":
                headings["h23_ok"] += 1
        elif kind == "h25":
            subsections["total"] += 1
            if paragraph_style(p) == "25":
                subsections["style25"] += 1

    list_stats = {"total": 0, "tnr14": 0, "lowercase": 0}
    for p in body.findall("w:p", NS):
        if paragraph_style(p) != LIST_STYLE and not has_numbering(p):
            continue
        list_stats["total"] += 1
        text = paragraph_text(p).strip()
        if text and text[0].islower():
            list_stats["lowercase"] += 1
        ok = True
        for run in p.findall("w:r", NS):
            r_pr = run.find("w:rPr", NS)
            if r_pr is None:
                ok = False
                break
            f = r_pr.find("w:rFonts", NS)
            sz = r_pr.find("w:sz", NS)
            if f is None or f.get(qn("w:ascii")) != "Times New Roman":
                ok = False
            elif sz is None or sz.get(qn("w:val")) != "28":
                ok = False
        if ok:
            list_stats["tnr14"] += 1

    eff_a = effective_style(styles, "a")
    style_a_ok = (
        eff_a["line"] == METHOD_LINE
        and eff_a["line_rule"] == METHOD_LINE_RULE
        and eff_a["first_line"] == METHOD_FIRST_LINE
    )
    list_ind_ok = True
    list_para_ind_ok = True
    if numbering is not None:
        for num in numbering.findall("w:num", NS):
            if num.get(qn("w:numId")) != LIST_NUM_ID:
                continue
            aid = num.find("w:abstractNumId", NS)
            if aid is None:
                list_ind_ok = False
                break
            absn = numbering.find(f".//w:abstractNum[@w:abstractNumId='{aid.get(qn('w:val'))}']", NS)
            if absn is None:
                list_ind_ok = False
                break
            lvl = absn.find("w:lvl", NS)
            ind = lvl.find("w:pPr/w:ind", NS) if lvl is not None else None
            if ind is None or ind.get(qn("w:left")) != METHOD_LIST_LEFT:
                list_ind_ok = False
    for p in body.findall("w:p", NS):
        if paragraph_style(p) != LIST_STYLE:
            continue
        p_pr = p.find("w:pPr", NS)
        ind = p_pr.find("w:ind", NS) if p_pr is not None else None
        if ind is None:
            continue
        for key in ("left", "hanging", "firstLine"):
            if ind.get(qn(f"w:{key}")):
                list_para_ind_ok = False
                break

    table_runs = {"total": 0, "tnr14": 0}
    layout_ok = data_ok = True
    for tbl in body.findall("w:tbl", NS):
        rows = tbl.findall("w:tr", NS)
        for run in tbl.findall(".//w:r", NS):
            if not "".join(t.text or "" for t in run.findall("w:t", NS)):
                continue
            table_runs["total"] += 1
            r_pr = run.find("w:rPr", NS)
            if r_pr is None:
                continue
            f = r_pr.find("w:rFonts", NS)
            sz = r_pr.find("w:sz", NS)
            if f is not None and f.get(qn("w:ascii")) == "Times New Roman" and sz is not None and sz.get(qn("w:val")) == "28":
                table_runs["tnr14"] += 1
        if is_layout_table(tbl):
            for tr in rows:
                for tc in tr.findall("w:tc", NS):
                    for p in tc.findall("w:p", NS):
                        if paragraph_text(p).strip() and paragraph_jc(p) != "both":
                            layout_ok = False
        else:
            for r_idx, tr in enumerate(rows):
                for tc in tr.findall("w:tc", NS):
                    for p in tc.findall("w:p", NS):
                        if not paragraph_text(p).strip():
                            continue
                        expected = "center" if r_idx == 0 else "both"
                        if paragraph_jc(p) != expected:
                            data_ok = False

    ann = body.findall("w:p", NS)[0]
    ann_p_pr = ann.find("w:pPr", NS)
    ann_jc = ann_p_pr.find("w:jc", NS).get(qn("w:val")) if ann_p_pr is not None and ann_p_pr.find("w:jc", NS) is not None else None
    ann_fl = ann_p_pr.find("w:ind", NS).get(qn("w:firstLine")) if ann_p_pr is not None and ann_p_pr.find("w:ind", NS) is not None else None

    header_text = " ".join(headers.values())
    header_kp = bool(re.search(r"МКП\.3", header_text)) and not bool(re.search(r"МКП\.5", header_text))

    checklist_tbl = find_checklist_table(body)
    testcase_tbl = find_testcase_table(body)
    checklist_ok, checklist_groups = check_checklist_vmerge(checklist_tbl) if checklist_tbl is not None else (False, 0)
    testcase_ok, testcase_blocks = check_testcase_vmerge(testcase_tbl) if testcase_tbl is not None else (False, 0)
    expogo_tests_ok, expogo_info = validate_expogo_test_tables(body)
    s4_rng = find_section4_range(body)
    s4_placeholders = 0
    if s4_rng is not None:
        start, end = s4_rng
        s4_placeholders = sum(
            1
            for ch in list(body)[start:end]
            if ch.tag == qn("w:p") and "Здесь фотка" in paragraph_text(ch)
        )
    table_headers_ok = True
    for tbl in body.findall("w:tbl", NS):
        rows = tbl.findall("w:tr", NS)
        if not rows or rows[0].find("w:trPr/w:tblHeader", NS) is None:
            table_headers_ok = False
        if len(rows) > 1 and is_testcase_table(tbl) and rows[1].find("w:trPr/w:tblHeader", NS) is None:
            table_headers_ok = False
    structure = {
        "tables_total": len(body.findall("w:tbl", NS)),
        "figures_with_placeholders": sum(1 for p in body.findall("w:p", NS) if is_photo_placeholder(paragraph_text(p).strip())),
        "figure_captions": sum(1 for p in body.findall("w:p", NS) if paragraph_text(p).strip().startswith("Рис.")),
        "section4_placeholders": s4_placeholders,
        "checklist_groups": checklist_groups,
        "testcase_blocks": testcase_blocks,
        "expogo_tests": expogo_info,
    }

    checks = {
        "margins_ok": all(actual_mar.get(k) == v for k, v in EXPECTED_PG_MAR.items()),
        "style_a_method": style_a_ok,
        "list_indents_method": list_ind_ok and list_para_ind_ok,
        "hyphenation_off": settings.find("w:suppressAutoHyphens", NS) is not None,
        "annotation_centered": ann_jc == "center" and ann_fl == "0",
        "body_justify": body_ad["both"] == body_ad["total"] if body_ad["total"] else True,
        "body_line_18pt": body_ad["line360"] == body_ad["total"] if body_ad["total"] else True,
        "body_first_line": body_ad["first709"] == body_ad["total"] if body_ad["total"] else True,
        "headings_h13_shkel": headings["h13_ok"] == headings["h13"] if headings["h13"] else True,
        "headings_h_center_shkel": headings["h_center_ok"] == headings["h_center"] if headings["h_center"] else True,
        "headings_h23_shkel": headings["h23_ok"] == headings["h23"] if headings["h23"] else True,
        "subsections_style25": subsections["style25"] == subsections["total"] if subsections["total"] else True,
        "two_col_tables_all_both": layout_ok,
        "table_alignment_consistent": data_ok,
        "lists_tnr14": list_stats["tnr14"] == list_stats["total"] if list_stats["total"] else True,
        "tables_tnr14": table_runs["tnr14"] == table_runs["total"] if table_runs["total"] else True,
        "checklist_vmerge_ok": checklist_ok and checklist_groups >= 8,
        "testcase_vmerge_ok": testcase_ok and testcase_blocks >= 15,
        "expogo_tests_ok": expogo_tests_ok,
        "table_headers_repeat": table_headers_ok,
        "section4_placeholders": s4_placeholders >= 9,
        "header_kp_code3": header_kp,
    }

    return {
        "file": path,
        "margins": actual_mar,
        "body_ad": body_ad,
        "headings": headings,
        "subsections": subsections,
        "lists": list_stats,
        "tables": table_runs,
        "annotation": {"jc": ann_jc, "firstLine": ann_fl},
        "header_sample": header_text[:120],
        "structure": structure,
        "checks": checks,
        "all_passed": all(checks.values()),
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    report = audit()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["all_passed"] else 1)
