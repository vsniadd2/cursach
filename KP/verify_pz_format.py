# -*- coding: utf-8 -*-
"""Финальная автопроверка оформления МояПеределка.docx."""
from __future__ import annotations

import json
import re
import sys
import zipfile

from lxml import etree

from format_pz_document import EXPECTED_PG_MAR, LIST_STYLE, TARGET, has_numbering, paragraph_style, paragraph_text, qn, NS
from fix_kp_document import (
    check_checklist_vmerge,
    check_testcase_vmerge,
    find_checklist_table,
    find_section4_range,
    find_testcase_table,
    get_heading_kind,
    is_testcase_table,
    validate_expogo_test_tables,
    has_figure_block_before,
    is_layout_table,
    is_photo_placeholder,
    is_subsection_heading,
    is_toc_line,
    paragraph_jc,
)


def verify(path: str = TARGET) -> dict:
    with zipfile.ZipFile(path) as z:
        doc = etree.fromstring(z.read("word/document.xml"))
        settings = etree.fromstring(z.read("word/settings.xml"))
        header_xml = "".join(
            z.read(n).decode("utf-8", errors="replace") for n in z.namelist() if n.startswith("word/header")
        )

    body = doc.find("w:body", NS)
    sect = body.find("w:sectPr", NS)
    pg_mar = sect.find("w:pgMar", NS)
    actual_mar = {k.split("}")[-1]: v for k, v in pg_mar.attrib.items()} if pg_mar is not None else {}

    ann = body.findall("w:p", NS)[0]
    ann_p_pr = ann.find("w:pPr", NS)
    ann_jc = ann_p_pr.find("w:jc", NS).get(qn("w:val")) if ann_p_pr is not None and ann_p_pr.find("w:jc", NS) is not None else None
    ann_fl = ann_p_pr.find("w:ind", NS).get(qn("w:firstLine")) if ann_p_pr is not None and ann_p_pr.find("w:ind", NS) is not None else None

    toc_order_ok = False
    paras = body.findall("w:p", NS)
    for i, p in enumerate(paras):
        if paragraph_text(p).strip() == "СОДЕРЖАНИЕ":
            nxt = paras[i + 1] if i + 1 < len(paras) else None
            toc_order_ok = nxt is not None and "ВВЕДЕНИЕ" in paragraph_text(nxt)
            break

    headings_ok = subsections_ok = True
    sec_total = sub_total = 0
    assign_ok = True
    for p in paras:
        kind = get_heading_kind(p)
        if kind == "h13":
            sec_total += 1
            if paragraph_style(p) != "13":
                headings_ok = False
            if any(r.find("w:rPr/w:b", NS) is not None for r in p.findall("w:r", NS)):
                headings_ok = False
            if any(r.find("w:rPr/w:caps", NS) is not None for r in p.findall("w:r", NS)):
                headings_ok = False
        elif kind == "h_center":
            sec_total += 1
            if paragraph_style(p) == "ad":
                assign_ok = False
            p_pr = p.find("w:pPr", NS)
            jc = p_pr.find("w:jc", NS).get(qn("w:val")) if p_pr is not None and p_pr.find("w:jc", NS) is not None else ""
            if jc != "center":
                headings_ok = False
        elif kind == "h23":
            sec_total += 1
            if paragraph_style(p) != "23":
                headings_ok = False
        elif kind == "h25" or is_subsection_heading(p):
            sub_total += 1
            if paragraph_style(p) != "25":
                subsections_ok = False

    bad_list = 0
    list_count = 0
    for p in paras:
        if paragraph_style(p) != LIST_STYLE and not has_numbering(p):
            continue
        list_count += 1
        for run in p.findall("w:r", NS):
            r_pr = run.find("w:rPr", NS)
            if r_pr is None:
                bad_list += 1
                break
            f = r_pr.find("w:rFonts", NS)
            sz = r_pr.find("w:sz", NS)
            if f is None or f.get(qn("w:ascii")) != "Times New Roman" or sz is None or sz.get(qn("w:val")) != "28":
                bad_list += 1
                break

    bad_table = 0
    table_runs = 0
    for tbl in body.findall("w:tbl", NS):
        for run in tbl.findall(".//w:r", NS):
            if not "".join(t.text or "" for t in run.findall("w:t", NS)):
                continue
            table_runs += 1
            r_pr = run.find("w:rPr", NS)
            if r_pr is None:
                bad_table += 1
                continue
            f = r_pr.find("w:rFonts", NS)
            sz = r_pr.find("w:sz", NS)
            if f is None or f.get(qn("w:ascii")) != "Times New Roman" or sz is None or sz.get(qn("w:val")) != "28":
                bad_table += 1

    placeholder_keep = sum(
        1
        for p in paras
        if is_photo_placeholder(paragraph_text(p).strip())
        and p.find("w:pPr/w:keepNext", NS) is not None
    )
    placeholders = sum(1 for p in paras if is_photo_placeholder(paragraph_text(p).strip()))
    captions = sum(1 for p in paras if paragraph_text(p).strip().startswith("Рис."))
    children = list(body)
    figures_complete = captions == 0
    for i, ch in enumerate(children):
        if ch.tag != qn("w:p"):
            continue
        if not paragraph_text(ch).strip().startswith("Рис."):
            continue
        figures_complete = True
        if not has_figure_block_before(children, i):
            figures_complete = False

    checklist_tbl = find_checklist_table(body)
    testcase_tbl = find_testcase_table(body)
    checklist_ok, checklist_groups = check_checklist_vmerge(checklist_tbl) if checklist_tbl is not None else (False, 0)
    testcase_ok, testcase_blocks = check_testcase_vmerge(testcase_tbl) if testcase_tbl is not None else (False, 0)
    expogo_tests_ok, expogo_info = validate_expogo_test_tables(body)
    table_headers_ok = True
    for tbl in body.findall("w:tbl", NS):
        rows = tbl.findall("w:tr", NS)
        if not rows:
            continue
        hdr = rows[0].find("w:trPr/w:tblHeader", NS)
        if hdr is None:
            table_headers_ok = False
        if len(rows) > 1 and is_testcase_table(tbl):
            hdr2 = rows[1].find("w:trPr/w:tblHeader", NS)
            if hdr2 is None:
                table_headers_ok = False
    section4_ok = True
    s4_rng = find_section4_range(body)
    if s4_rng is not None:
        start, end = s4_rng
        children = list(body)
        s4_ph = sum(
            1
            for ch in children[start:end]
            if ch.tag == qn("w:p") and is_photo_placeholder(paragraph_text(ch).strip()) and "Здесь фотка" in paragraph_text(ch)
        )
        section4_ok = s4_ph >= 9

    layout_tables_ok = True
    data_tables_ok = True
    for tbl in body.findall("w:tbl", NS):
        rows = tbl.findall("w:tr", NS)
        if is_layout_table(tbl):
            for tr in rows:
                for tc in tr.findall("w:tc", NS):
                    for p in tc.findall("w:p", NS):
                        if paragraph_text(p).strip() and paragraph_jc(p) != "both":
                            layout_tables_ok = False
        else:
            for r_idx, tr in enumerate(rows):
                for tc in tr.findall("w:tc", NS):
                    for p in tc.findall("w:p", NS):
                        if not paragraph_text(p).strip():
                            continue
                        jc = paragraph_jc(p)
                        expected = "center" if r_idx == 0 else "both"
                        if jc != expected:
                            data_tables_ok = False

    checks = {
        "margins_ok": all(actual_mar.get(k) == v for k, v in EXPECTED_PG_MAR.items()),
        "hyphenation_off": settings.find("w:suppressAutoHyphens", NS) is not None,
        "annotation_centered": ann_jc == "center" and ann_fl == "0",
        "toc_order_ok": toc_order_ok,
        "headings_match_shkel": headings_ok and assign_ok and sec_total > 0,
        "subsections_formatted": subsections_ok and sub_total > 0,
        "two_col_tables_all_both": layout_tables_ok,
        "table_alignment_consistent": data_tables_ok,
        "list_runs_tnr_14": bad_list == 0 and list_count > 0,
        "table_runs_tnr_14": bad_table == 0 and table_runs > 0,
        "figure_keep_next": placeholder_keep >= placeholders if placeholders else True,
        "figure_placeholders_complete": figures_complete and placeholders >= captions if captions else True,
        "checklist_vmerge_ok": checklist_ok and checklist_groups >= 8,
        "testcase_vmerge_ok": testcase_ok and testcase_blocks >= 15,
        "expogo_tests_ok": expogo_tests_ok,
        "table_headers_repeat": table_headers_ok,
        "section4_placeholders": section4_ok,
        "header_kp_code3": bool(re.search(r"МКП\.3", header_xml)) and not bool(re.search(r"МКП\.5", header_xml)),
        "no_sdt_toc": len(body.findall("w:sdt", NS)) == 0,
    }

    return {
        "file": path,
        "actual_margins": actual_mar,
        "section_headings": sec_total,
        "subsection_headings": sub_total,
        "list_paragraphs": list_count,
        "table_runs": table_runs,
        "checklist_groups": checklist_groups,
        "testcase_blocks": testcase_blocks,
        "expogo_tests": expogo_info,
        "checks": checks,
        "all_passed": all(checks.values()),
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    report = verify()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["all_passed"] else 1)
