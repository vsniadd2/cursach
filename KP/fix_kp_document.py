# -*- coding: utf-8 -*-
"""Точечные правки МояПеределка.docx по методичке ДП26."""
from __future__ import annotations

import copy
import os
import re
import shutil

from lxml import etree

from format_pz_document import (
    BACKUP,
    BASE,
    SHKEL,
    TARGET,
    apply_body_p_pr,
    apply_list_p_pr,
    apply_tnr_r_pr,
    copy_styles_from_shkel,
    disable_hyphenation,
    ensure_run_tnr,
    fix_existing_list_fonts,
    fix_numbering_fonts,
    fix_numbering_indents,
    fix_style_a,
    fix_style_a6,
    get_or_create_p_pr,
    has_numbering,
    paragraph_style,
    paragraph_text,
    qn,
    read_zip,
    set_page_margins,
    write_zip,
    NS,
)

PLACEHOLDER_SPACING = "1200"

SECTION4_PHOTOS = [
    ("1. Регистрация и вход в систему", ["экран входа (форма логина: email и пароль)"]),
    ("2. Работа с клиентами", ["главная панель (дашборд) с нижней навигацией", "список клиентов и форма создания/редактирования клиента"]),
    ("3. Управление сделками", ["воронка сделок на стадиях Lead, Negotiation и Closed"]),
    ("4. Работа с задачами", ["список задач и календарь задач"]),
    ("5. Отчёты и аналитика", ["экран отчётов и формирование PDF-отчёта"]),
    ("6. Уведомления и настройки", ["список уведомлений", "экран настроек профиля, темы и языка"]),
    ("7. Тарифы и дополнительные разделы", ["раздел «Ещё»: тарифы, команда, поддержка и о приложении"]),
]


def is_photo_placeholder(text: str) -> bool:
    t = text.strip()
    return t.startswith("Сюда фото:") or t.startswith("Здесь фотка:")


# 17 ключевых кейсов Expogo CRM (.NET MAUI + ExpogoCrm.Api), в пределах 15–20 по методичке.
EXPOGO_CASE_IDS: tuple[str, ...] = (
    "Spl01",
    "Aut01",
    "Aut02",
    "Aut04",
    "Aut05",
    "Dash01",
    "Dash03",
    "Cli01",
    "Cli03",
    "Cli05",
    "Deal01",
    "Deal03",
    "Task01",
    "Task03",
    "Rep01",
    "Not01",
    "Set02",
)

EXPOGO_ID_PREFIXES = ("Spl", "Aut", "Dash", "Cli", "Deal", "Task", "Rep", "Not", "Set", "More", "Api")

MODULE_BY_PREFIX = {
    "Spl": "Экран загрузки",
    "Aut": "Авторизация",
    "Dash": "Дашборд",
    "Cli": "Клиенты",
    "Deal": "Сделки",
    "Task": "Задачи",
    "Rep": "Отчёты",
    "Not": "Уведомления",
    "Set": "Настройки",
    "More": "Раздел «Ещё»",
    "Api": "API",
}


def module_name_for_group(group_rows: list[etree._Element]) -> str:
    for tr in group_rows:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 2:
            continue
        col0 = paragraph_text(cells[0]).strip()
        if col0:
            return col0
        case_id = paragraph_text(cells[1]).strip()
        prefix = case_id_prefix(case_id)
        if prefix in MODULE_BY_PREFIX:
            return MODULE_BY_PREFIX[prefix]
    return ""

TOC_ENTRIES = [
    ("12", "ВВЕДЕНИЕ", "4"),
    ("12", "1. НАЗНАЧЕНИЕ И ОБЛАСТЬ ПРИМЕНЕНИЯ", "5"),
    ("12", "2. ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ", "6"),
    ("31", "2.1. Постановка задачи", "6"),
    ("31", "2.2. Описание организации данных", "6"),
    ("31", "2.3. Описание программных средств", "7"),
    ("31", "2.4. Проектирование интерфейса", "8"),
    ("31", "2.5. Описание физической структуры программы", "21"),
    ("12", "3. ТЕСТИРОВАНИЕ И АНАЛИЗ ПОЛУЧЕННЫХ РЕЗУЛЬТАТОВ", "26"),
    ("12", "4. РУКОВОДСТВО ПО ИСПОЛЬЗОВАНИЮ ПРОГРАММНОГО СРЕДСТВА", "28"),
    ("12", "ЗАКЛЮЧЕНИЕ", "38"),
    ("12", "СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ", "39"),
    ("12", "ПРИЛОЖЕНИЕ 1 (ОБЯЗАТЕЛЬНОЕ) – ПЕРЕЧЕНЬ ТЕСТОВЫХ СЦЕНАРИЕВ И КОНТРОЛЬНЫХ ПРИМЕРОВ", "40"),
    ("12", "ПРИЛОЖЕНИЕ 2 (ОБЯЗАТЕЛЬНОЕ) – ЛИСТИНГ ПРОГРАММЫ", "45"),
]


def is_toc_line(p: etree._Element) -> bool:
    style = paragraph_style(p)
    if style not in ("12", "31"):
        return False
    text = paragraph_text(p).strip()
    return bool(re.search(r"\d+$", text))


def is_intro_heading(p: etree._Element) -> bool:
    return paragraph_text(p).strip() == "ВВЕДЕНИЕ" and paragraph_style(p) in ("13", "1", "25")


def is_toc_paragraph(p: etree._Element) -> bool:
    if p.tag != qn("w:p"):
        return False
    text = paragraph_text(p).strip()
    if text == "СОДЕРЖАНИЕ":
        return True
    if is_toc_line(p):
        return True
    return not text


MAIN_SECTION_RE = re.compile(
    r"^(ВВЕДЕНИЕ|ЗАКЛЮЧЕНИЕ|СПИСОК ИСПОЛЬЗОВАННЫХ|ПРИЛОЖЕНИЕ"
    r"|\d+\. (НАЗНАЧЕНИЕ|ТЕХНИЧЕСКИЕ|ТЕСТИРОВАНИЕ|РУКОВОДСТВО|ЭКОНОМ|ОХРАНА))",
    re.IGNORECASE,
)

_SHKEL_TEMPLATES: dict | None = None  # reset via load_shkel_templates(force=True) if needed


def load_shkel_templates(force: bool = False) -> dict:
    global _SHKEL_TEMPLATES
    if _SHKEL_TEMPLATES is not None and not force:
        return _SHKEL_TEMPLATES
    _SHKEL_TEMPLATES = None
    body = etree.fromstring(read_zip(SHKEL)["word/document.xml"]).find("w:body", NS)
    tpl: dict = {}
    for p in body.findall("w:p", NS):
        if is_toc_line(p):
            continue
        t = paragraph_text(p).strip()
        ps = paragraph_style(p)
        if t == "ВВЕДЕНИЕ" and ps == "13" and "h13" not in tpl:
            tpl["h13"] = copy.deepcopy(p.find("w:pPr", NS))
        elif t.startswith("1. НАЗНАЧЕНИЕ") and ps not in ("12", "31", "13") and "h_center" not in tpl:
            tpl["h_center"] = copy.deepcopy(p.find("w:pPr", NS))
        elif t.startswith("2.1.") and ps == "25" and "h25" not in tpl:
            tpl["h25"] = copy.deepcopy(p.find("w:pPr", NS))
        elif t.startswith("ПРИЛОЖЕНИЕ 2") and ps == "23" and "h23" not in tpl:
            tpl["h23"] = copy.deepcopy(p.find("w:pPr", NS))
        elif t.startswith("СПИСОК ИСПОЛЬЗОВАННЫХ") and ps not in ("12", "31") and "h_center_list" not in tpl:
            tpl["h_center_list"] = copy.deepcopy(p.find("w:pPr", NS))
    tbl4 = body.findall("w:tbl", NS)[4]
    p_layout = tbl4.findall("w:tr", NS)[0].findall("w:tc", NS)[0].find("w:p", NS)
    tpl["table_layout"] = copy.deepcopy(p_layout.find("w:pPr", NS))
    tbl14 = body.findall("w:tbl", NS)[14]
    p_hdr = tbl14.findall("w:tr", NS)[0].findall("w:tc", NS)[0].find("w:p", NS)
    tpl["table_header"] = copy.deepcopy(p_hdr.find("w:pPr", NS))
    for tr in tbl14.findall("w:tr", NS)[1:]:
        for tc in tr.findall("w:tc", NS):
            p = tc.find("w:p", NS)
            if p is None or not paragraph_text(p).strip():
                continue
            p_pr = p.find("w:pPr", NS)
            if p_pr is not None and p_pr.find("w:jc", NS) is not None:
                if p_pr.find("w:jc", NS).get(qn("w:val")) == "both":
                    tpl["table_data"] = copy.deepcopy(p_pr)
                    break
        if "table_data" in tpl:
            break
    _SHKEL_TEMPLATES = tpl
    return tpl


def get_heading_kind(p: etree._Element) -> str | None:
    if is_toc_line(p):
        return None
    text = paragraph_text(p).strip()
    if not text or text in ("АННОТАЦИЯ", "СОДЕРЖАНИЕ"):
        return None
    if text.startswith("Рис.") or text.startswith("Таблица") or is_photo_placeholder(text):
        return None
    if re.match(r"^\d+\.\d+\.", text):
        return "h25"
    if text.startswith("ПРИЛОЖЕНИЕ 2"):
        return "h23"
    if text == "ВВЕДЕНИЕ" or text == "ЗАКЛЮЧЕНИЕ":
        return "h13"
    if re.match(r"^1\. НАЗНАЧЕНИЕ", text, re.IGNORECASE):
        return "h_center"
    if re.match(r"^[234]\. ", text):
        return "h13"
    if text.startswith("СПИСОК ИСПОЛЬЗОВАННЫХ") or text.startswith("ПРИЛОЖЕНИЕ 1"):
        return "h_center"
    return None


def is_section_heading(p: etree._Element) -> bool:
    kind = get_heading_kind(p)
    return kind in ("h13", "h_center", "h23")


def is_numbered_body_item(p: etree._Element) -> bool:
    text = paragraph_text(p).strip()
    if not re.match(r"^\d+\. ", text):
        return False
    return not is_section_heading(p) and not is_subsection_heading(p) and not is_toc_line(p)


def restore_body_paragraph(p: etree._Element) -> None:
    p_pr = get_or_create_p_pr(p)
    ps = p_pr.find("w:pStyle", NS)
    if ps is None:
        ps = etree.SubElement(p_pr, qn("w:pStyle"))
    ps.set(qn("w:val"), "ad")
    apply_body_p_pr(p_pr)
    for run in p.findall("w:r", NS):
        r_pr = run.find("w:rPr", NS)
        if r_pr is None:
            r_pr = etree.SubElement(run, qn("w:rPr"))
        apply_tnr_r_pr(r_pr, size="28", bold=False, caps=False)


def is_plain_body_paragraph(p: etree._Element) -> bool:
    text = paragraph_text(p).strip()
    if not text:
        return False
    if get_heading_kind(p) is not None:
        return False
    if is_toc_line(p):
        return False
    if text.startswith("Рис.") or text.startswith("Таблица"):
        return False
    if is_photo_placeholder(text):
        return False
    if paragraph_style(p) in ("ad", "a6", "aa", "12", "30", "31", "22", "13", "25", "23"):
        return False
    if has_numbering(p):
        return False
    if text in ("АННОТАЦИЯ", "СОДЕРЖАНИЕ"):
        return False
    return True


def fix_unstyled_body_paragraphs(body: etree._Element) -> int:
    fixed = 0
    for p in body.findall("w:p", NS):
        if not is_plain_body_paragraph(p):
            continue
        restore_body_paragraph(p)
        fixed += 1
    return fixed


def normalize_body_ad_spacing(body: etree._Element) -> int:
    """Убирает лишние переопределения межстрочного интервала у абзацев стиля ad."""
    fixed = 0
    for p in body.findall("w:p", NS):
        if paragraph_style(p) != "ad":
            continue
        text = paragraph_text(p).strip()
        if not text or text in ("АННОТАЦИЯ", "СОДЕРЖАНИЕ"):
            continue
        if get_heading_kind(p) is not None:
            continue
        p_pr = p.find("w:pPr", NS)
        if p_pr is None:
            continue
        sp = p_pr.find("w:spacing", NS)
        if sp is None:
            continue
        line = sp.get(qn("w:line"))
        lr = sp.get(qn("w:lineRule"))
        if line in (None, "360") and lr in (None, "exact"):
            if sp.get(qn("w:after")) == "0" and line is None:
                p_pr.remove(sp)
                fixed += 1
            continue
        if line != "360" or lr != "exact":
            apply_body_p_pr(p_pr)
            fixed += 1
    return fixed


def is_subsection_heading(p: etree._Element) -> bool:
    return get_heading_kind(p) == "h25"


def replace_p_pr(p: etree._Element, template_p_pr: etree._Element | None) -> None:
    old = p.find("w:pPr", NS)
    if old is not None:
        p.remove(old)
    if template_p_pr is not None:
        p.insert(0, copy.deepcopy(template_p_pr))


def apply_heading_runs(p: etree._Element) -> None:
    for run in p.findall("w:r", NS):
        if not run.findall("w:t", NS):
            continue
        r_pr = run.find("w:rPr", NS)
        if r_pr is None:
            r_pr = etree.SubElement(run, qn("w:rPr"))
        apply_tnr_r_pr(r_pr, size="32", bold=False, caps=False)


def fix_headings(body: etree._Element) -> tuple[int, int, int]:
    tpl = load_shkel_templates()
    sections = subsections = body_restored = 0
    for p in body.findall("w:p", NS):
        kind = get_heading_kind(p)
        if kind == "h25":
            replace_p_pr(p, tpl.get("h25"))
            apply_heading_runs(p)
            subsections += 1
        elif kind == "h13":
            replace_p_pr(p, tpl.get("h13"))
            apply_heading_runs(p)
            sections += 1
        elif kind == "h_center":
            key = "h_center_list" if paragraph_text(p).strip().startswith("СПИСОК") else "h_center"
            template = tpl.get(key)
            if template is None:
                template = tpl.get("h_center")
            replace_p_pr(p, template)
            apply_heading_runs(p)
            sections += 1
        elif kind == "h23":
            replace_p_pr(p, tpl.get("h23"))
            apply_heading_runs(p)
            sections += 1
        elif is_numbered_body_item(p):
            restore_body_paragraph(p)
            body_restored += 1
    return sections, subsections, body_restored


def fix_annotation(body: etree._Element) -> None:
    shkel_doc = etree.fromstring(read_zip(SHKEL)["word/document.xml"])
    shkel_p0 = shkel_doc.find(".//w:body/w:p", NS)
    moya_p0 = body.findall("w:p", NS)[0]
    if paragraph_text(moya_p0).strip() != "АННОТАЦИЯ":
        return
    shkel_p_pr = shkel_p0.find("w:pPr", NS)
    old = moya_p0.find("w:pPr", NS)
    if old is not None:
        moya_p0.remove(old)
    if shkel_p_pr is not None:
        moya_p0.insert(0, copy.deepcopy(shkel_p_pr))
    for run in moya_p0.findall("w:r", NS):
        r_pr = run.find("w:rPr", NS)
        if r_pr is None:
            r_pr = etree.SubElement(run, qn("w:rPr"))
        apply_tnr_r_pr(r_pr, size="32", bold=False, caps=False)


def is_layout_table(tbl: etree._Element) -> bool:
    rows = tbl.findall("w:tr", NS)
    if not rows:
        return False
    first_row = rows[0]
    if len(first_row.findall("w:tc", NS)) != 2:
        return False
    header = paragraph_text(first_row).upper()
    return "ЭЛЕМЕНТ" in header or "НАЗНАЧЕНИЕ" in header


def paragraph_jc(p: etree._Element) -> str:
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        return ""
    jc = p_pr.find("w:jc", NS)
    return jc.get(qn("w:val"), "") if jc is not None else ""


def apply_table_p_pr(p: etree._Element, template_p_pr: etree._Element | None, *, jc: str) -> None:
    replace_p_pr(p, template_p_pr)
    p_pr = get_or_create_p_pr(p)
    jc_el = p_pr.find("w:jc", NS)
    if jc_el is None:
        jc_el = etree.SubElement(p_pr, qn("w:jc"))
    jc_el.set(qn("w:val"), jc)


CASE_ID_RE = re.compile(r"^[A-Za-z]+\d+$")


def get_or_create_tc_pr(tc: etree._Element) -> etree._Element:
    tc_pr = tc.find("w:tcPr", NS)
    if tc_pr is None:
        tc_pr = etree.SubElement(tc, qn("w:tcPr"))
    return tc_pr


def cell_vmerge(tc: etree._Element) -> str:
    tc_pr = tc.find("w:tcPr", NS)
    if tc_pr is None:
        return "none"
    vm = tc_pr.find("w:vMerge", NS)
    if vm is None:
        return "none"
    val = vm.get(qn("w:val"))
    return val if val else "continue"


def set_cell_vmerge(tc: etree._Element, mode: str) -> None:
    tc_pr = get_or_create_tc_pr(tc)
    vm = tc_pr.find("w:vMerge", NS)
    if mode == "none":
        if vm is not None:
            tc_pr.remove(vm)
        return
    if vm is None:
        vm = etree.SubElement(tc_pr, qn("w:vMerge"))
    if mode == "restart":
        vm.set(qn("w:val"), "restart")
    else:
        if qn("w:val") in vm.attrib:
            del vm.attrib[qn("w:val")]


def set_cell_text(tc: etree._Element, text: str) -> None:
    paragraphs = tc.findall("w:p", NS)
    if not paragraphs:
        paragraphs = [etree.SubElement(tc, qn("w:p"))]
    p = paragraphs[0]
    for run in p.findall("w:r", NS):
        p.remove(run)
    if text:
        run = etree.SubElement(p, qn("w:r"))
        t = etree.SubElement(run, qn("w:t"))
        t.text = text
    for extra in paragraphs[1:]:
        for run in extra.findall("w:r", NS):
            extra.remove(run)


def case_id_prefix(case_id: str) -> str:
    match = re.match(r"^([A-Za-z]+)", case_id)
    return match.group(1) if match else ""


def is_checklist_table(tbl: etree._Element) -> bool:
    rows = tbl.findall("w:tr", NS)
    if not rows:
        return False
    header = paragraph_text(rows[0]).upper()
    return "ТЕСТИРУЕМЫЙ МОДУЛЬ" in header and "ИД-КЕЙСА" in header


def is_testcase_table(tbl: etree._Element) -> bool:
    rows = tbl.findall("w:tr", NS)
    if len(rows) < 2:
        return False
    header = paragraph_text(rows[1]).upper()
    return "ИДЕНТИФИКАТОР" in header and "ШАГ" in header


def find_checklist_table(body: etree._Element) -> etree._Element | None:
    for tbl in body.findall("w:tbl", NS):
        if is_checklist_table(tbl):
            return tbl
    return None


def find_testcase_table(body: etree._Element) -> etree._Element | None:
    for tbl in body.findall("w:tbl", NS):
        if is_testcase_table(tbl):
            return tbl
    return None


def parse_checklist_groups(rows: list[etree._Element]) -> list[tuple[str, list[etree._Element]]]:
    groups: list[tuple[str, list[etree._Element]]] = []
    current_name = ""
    current_rows: list[etree._Element] = []
    prev_prefix = ""
    for tr in rows[1:]:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 4:
            continue
        col0 = paragraph_text(cells[0]).strip()
        case_id = paragraph_text(cells[1]).strip()
        prefix = case_id_prefix(case_id)
        start_new = not current_rows
        if current_rows and col0:
            start_new = True
        if current_rows and prefix and prefix != prev_prefix:
            start_new = True
        if start_new and current_rows:
            groups.append((current_name, current_rows))
            current_rows = []
        if col0:
            current_name = col0
        current_rows.append(tr)
        if prefix:
            prev_prefix = prefix
    if current_rows:
        groups.append((current_name, current_rows))
    return groups


def prune_checklist_table(tbl: etree._Element, keep_ids: set[str]) -> int:
    removed = 0
    for tr in list(tbl.findall("w:tr", NS))[1:]:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 2:
            continue
        case_id = paragraph_text(cells[1]).strip()
        if case_id and case_id not in keep_ids:
            tbl.remove(tr)
            removed += 1
    return removed


def prune_testcase_table(tbl: etree._Element, keep_ids: set[str]) -> int:
    rows = tbl.findall("w:tr", NS)
    blocks = parse_testcase_blocks(rows)
    removed = 0
    for block in blocks:
        case_id, _ = collect_block_id_name(block)
        if case_id not in keep_ids:
            for tr in block:
                tbl.remove(tr)
                removed += 1
    return removed


def prune_expogo_test_tables(body: etree._Element) -> dict[str, int]:
    keep = set(EXPOGO_CASE_IDS)
    checklist_tbl = find_checklist_table(body)
    testcase_tbl = find_testcase_table(body)
    cl_removed = prune_checklist_table(checklist_tbl, keep) if checklist_tbl is not None else 0
    tc_removed = prune_testcase_table(testcase_tbl, keep) if testcase_tbl is not None else 0
    return {"checklist_removed": cl_removed, "testcase_removed": tc_removed}


def count_checklist_cases(tbl: etree._Element) -> int:
    count = 0
    for tr in tbl.findall("w:tr", NS)[1:]:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 2:
            continue
        case_id = paragraph_text(cells[1]).strip()
        if CASE_ID_RE.match(case_id):
            count += 1
    return count


def validate_expogo_test_tables(body: etree._Element) -> tuple[bool, dict]:
    checklist_tbl = find_checklist_table(body)
    testcase_tbl = find_testcase_table(body)
    info: dict = {"checklist_cases": 0, "testcase_blocks": 0, "expogo_env": False, "ids_ok": False}
    if checklist_tbl is None or testcase_tbl is None:
        return False, info
    cl_count = count_checklist_cases(checklist_tbl)
    tc_blocks = parse_testcase_blocks(testcase_tbl.findall("w:tr", NS))
    info["checklist_cases"] = cl_count
    info["testcase_blocks"] = len(tc_blocks)
    env_row = paragraph_text(testcase_tbl.findall("w:tr", NS)[0])
    info["expogo_env"] = "Экспого" in env_row and "ExpogoCrm" in env_row
    cl_ids = {
        paragraph_text(tr.findall("w:tc", NS)[1]).strip()
        for tr in checklist_tbl.findall("w:tr", NS)[1:]
        if len(tr.findall("w:tc", NS)) >= 2
    }
    tc_ids = {collect_block_id_name(b)[0] for b in tc_blocks}
    keep = set(EXPOGO_CASE_IDS)
    info["ids_ok"] = cl_ids == keep and tc_ids == keep
    count_ok = 15 <= cl_count <= 20 and 15 <= len(tc_blocks) <= 20
    ok = count_ok and info["expogo_env"] and info["ids_ok"] and cl_count == len(tc_blocks)
    return ok, info


def fix_checklist_vmerge(body: etree._Element) -> int:
    tbl = find_checklist_table(body)
    if tbl is None:
        return 0
    rows = tbl.findall("w:tr", NS)
    groups = parse_checklist_groups(rows)
    for _name, group_rows in groups:
        module_name = module_name_for_group(group_rows)
        for idx, tr in enumerate(group_rows):
            tc = tr.findall("w:tc", NS)[0]
            if idx == 0:
                set_cell_vmerge(tc, "restart")
                set_cell_text(tc, module_name)
            else:
                set_cell_vmerge(tc, "continue")
                set_cell_text(tc, "")
    return len(groups)


def collect_block_id_name(rows: list[etree._Element]) -> tuple[str, str]:
    case_id = ""
    name = ""
    for tr in rows:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 2:
            continue
        col0 = paragraph_text(cells[0]).strip()
        col1 = paragraph_text(cells[1]).strip()
        if CASE_ID_RE.match(col0):
            case_id = col0
        if col1 and not re.match(r"^\d+\.", col1):
            name = col1
    return case_id, name


def parse_testcase_blocks(rows: list[etree._Element]) -> list[list[etree._Element]]:
    blocks: list[list[etree._Element]] = []
    current: list[etree._Element] = []
    for tr in rows[2:]:
        cells = tr.findall("w:tc", NS)
        if len(cells) < 6:
            continue
        texts = [paragraph_text(tc).strip() for tc in cells]
        step_match = re.match(r"^(\d+)\.", texts[2])
        is_step_one = bool(step_match and step_match.group(1) == "1")
        has_id = bool(CASE_ID_RE.match(texts[0]))
        if is_step_one or has_id:
            if current:
                blocks.append(current)
            current = [tr]
        elif current:
            current.append(tr)
        else:
            current = [tr]
    if current:
        blocks.append(current)
    return blocks


def fix_testcase_vmerge(body: etree._Element) -> int:
    tbl = find_testcase_table(body)
    if tbl is None:
        return 0
    rows = tbl.findall("w:tr", NS)
    blocks = parse_testcase_blocks(rows)
    merge_cols = {0, 1, 4, 5}
    for block_rows in blocks:
        case_id, name = collect_block_id_name(block_rows)
        multi = len(block_rows) > 1
        for row_idx, tr in enumerate(block_rows):
            cells = tr.findall("w:tc", NS)
            for col_idx, tc in enumerate(cells):
                if not multi:
                    set_cell_vmerge(tc, "none")
                elif col_idx in merge_cols:
                    set_cell_vmerge(tc, "restart" if row_idx == 0 else "continue")
                else:
                    set_cell_vmerge(tc, "none")
            if row_idx == 0:
                set_cell_text(cells[0], case_id)
                set_cell_text(cells[1], name)
            else:
                set_cell_text(cells[0], "")
                set_cell_text(cells[1], "")
                if len(cells) > 5:
                    set_cell_text(cells[4], "")
                    set_cell_text(cells[5], "")
    return len(blocks)


def check_checklist_vmerge(tbl: etree._Element) -> tuple[bool, int]:
    rows = tbl.findall("w:tr", NS)
    groups = parse_checklist_groups(rows)
    ok = len(groups) >= 9
    for _name, group_rows in groups:
        module_name = module_name_for_group(group_rows)
        if not module_name:
            ok = False
            continue
        tc0 = group_rows[0].findall("w:tc", NS)[0]
        if cell_vmerge(tc0) != "restart":
            ok = False
        if paragraph_text(tc0).strip() != module_name:
            ok = False
        for tr in group_rows[1:]:
            tc = tr.findall("w:tc", NS)[0]
            if cell_vmerge(tc) != "continue":
                ok = False
            if paragraph_text(tc).strip():
                ok = False
    return ok, len(groups)


def check_testcase_vmerge(tbl: etree._Element) -> tuple[bool, int]:
    rows = tbl.findall("w:tr", NS)
    blocks = parse_testcase_blocks(rows)
    ok = 15 <= len(blocks) <= 20
    for block_rows in blocks:
        case_id, name = collect_block_id_name(block_rows)
        if not case_id or not name:
            ok = False
            continue
        multi = len(block_rows) > 1
        tc0 = block_rows[0].findall("w:tc", NS)[0]
        tc1 = block_rows[0].findall("w:tc", NS)[1]
        if multi:
            if cell_vmerge(tc0) != "restart" or cell_vmerge(tc1) != "restart":
                ok = False
            if paragraph_text(tc0).strip() != case_id or paragraph_text(tc1).strip() != name:
                ok = False
            for tr in block_rows[1:]:
                cells = tr.findall("w:tc", NS)
                if cell_vmerge(cells[0]) != "continue" or cell_vmerge(cells[1]) != "continue":
                    ok = False
                if paragraph_text(cells[0]).strip() or paragraph_text(cells[1]).strip():
                    ok = False
        else:
            if cell_vmerge(tc0) != "none" or cell_vmerge(tc1) != "none":
                ok = False
            if paragraph_text(tc0).strip() != case_id or paragraph_text(tc1).strip() != name:
                ok = False
    return ok, len(blocks)


def get_or_create_tr_pr(tr: etree._Element) -> etree._Element:
    tr_pr = tr.find("w:trPr", NS)
    if tr_pr is None:
        tr_pr = etree.SubElement(tr, qn("w:trPr"))
    return tr_pr


def set_row_tbl_header(tr: etree._Element) -> None:
    tr_pr = get_or_create_tr_pr(tr)
    if tr_pr.find("w:tblHeader", NS) is None:
        etree.SubElement(tr_pr, qn("w:tblHeader"), {qn("w:val"): "1"})
    if tr_pr.find("w:cantSplit", NS) is None:
        etree.SubElement(tr_pr, qn("w:cantSplit"), {qn("w:val"): "1"})


def clear_row_page_locks(tr: etree._Element) -> None:
    tr_pr = tr.find("w:trPr", NS)
    if tr_pr is None:
        return
    for tag in ("w:cantSplit", "w:tblHeader"):
        el = tr_pr.find(tag, NS)
        if el is not None:
            tr_pr.remove(el)
    if not len(tr_pr):
        tr.remove(tr_pr)


def fix_table_page_breaks(body: etree._Element) -> int:
    fixed = 0
    for tbl in body.findall("w:tbl", NS):
        rows = tbl.findall("w:tr", NS)
        if not rows:
            continue
        header_rows = [0]
        if is_testcase_table(tbl) and len(rows) > 1:
            header_rows = [0, 1]
        for r_idx, tr in enumerate(rows):
            if r_idx in header_rows:
                set_row_tbl_header(tr)
                fixed += 1
            else:
                clear_row_page_locks(tr)
    return fixed


def find_section4_range(body: etree._Element) -> tuple[int, int] | None:
    children = list(body)
    start = end = -1
    for i, ch in enumerate(children):
        if ch.tag != qn("w:p"):
            continue
        t = paragraph_text(ch).strip()
        if t.startswith("4. РУКОВОДСТВО") and not re.search(r"\d+$", t):
            start = i
        if start >= 0 and t.startswith("ЗАКЛЮЧЕНИЕ"):
            end = i
            break
    if start < 0:
        return None
    if end < 0:
        end = len(children)
    return start, end


def fix_table_fonts(body: etree._Element) -> int:
    tpl = load_shkel_templates()
    count = 0
    for tbl in body.findall("w:tbl", NS):
        layout = is_layout_table(tbl)
        rows = tbl.findall("w:tr", NS)
        for r_idx, tr in enumerate(rows):
            for tc in tr.findall("w:tc", NS):
                if not paragraph_text(tc).strip():
                    continue
                if layout:
                    template = tpl.get("table_layout")
                    jc = "both"
                elif r_idx == 0:
                    template = tpl.get("table_header")
                    jc = "center"
                else:
                    template = tpl.get("table_data")
                    jc = "both"
                for p in tc.findall("w:p", NS):
                    if not paragraph_text(p).strip():
                        continue
                    apply_table_p_pr(p, template, jc=jc)
                    for run in p.findall("w:r", NS):
                        ensure_run_tnr(run)
                        count += 1
    return count


def fix_header_kp(parts: dict[str, bytes]) -> bool:
    changed = False
    for name in list(parts.keys()):
        if not name.startswith("word/header") or not name.endswith(".xml"):
            continue
        root = etree.fromstring(parts[name])
        for t in root.findall(".//w:t", NS):
            if t.text is None:
                continue
            new_text = t.text
            # код типа документа: 5 (диплом) -> 3 (курсовой)
            if re.search(r"МКП\.5", new_text):
                new_text = re.sub(r"МКП\.5", "МКП.3", new_text, count=1)
            elif re.search(r"\.5\d{6}", new_text):
                new_text = re.sub(r"\.5(\d{6})", r".3\1", new_text, count=1)
            if new_text != t.text:
                t.text = new_text
                changed = True
        parts[name] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    return changed


def set_keep(p_pr: etree._Element, *, next_para: bool = False, lines: bool = False, with_next: bool = False) -> None:
    if next_para and p_pr.find("w:keepNext", NS) is None:
        etree.SubElement(p_pr, qn("w:keepNext"), {qn("w:val"): "1"})
    if lines and p_pr.find("w:keepLines", NS) is None:
        etree.SubElement(p_pr, qn("w:keepLines"), {qn("w:val"): "1"})
    if with_next and p_pr.find("w:keepWithNext", NS) is None:
        etree.SubElement(p_pr, qn("w:keepWithNext"), {qn("w:val"): "1"})


def ensure_placeholder_border(p_pr: etree._Element) -> None:
    if p_pr.find("w:pBdr", NS) is not None:
        return
    p_bdr = etree.SubElement(p_pr, qn("w:pBdr"))
    for side in ("top", "left", "bottom", "right"):
        border = etree.SubElement(p_bdr, qn(f"w:{side}"))
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), "12")
        border.set(qn("w:space"), "4")
        border.set(qn("w:color"), "000000")


def apply_placeholder_p_pr(p_pr: etree._Element) -> None:
    p_style = p_pr.find("w:pStyle", NS)
    if p_style is None:
        p_style = etree.SubElement(p_pr, qn("w:pStyle"))
    p_style.set(qn("w:val"), "aa")
    jc = p_pr.find("w:jc", NS)
    if jc is None:
        jc = etree.SubElement(p_pr, qn("w:jc"))
    jc.set(qn("w:val"), "center")
    ind = p_pr.find("w:ind", NS)
    if ind is None:
        ind = etree.SubElement(p_pr, qn("w:ind"))
    ind.set(qn("w:firstLine"), "0")
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:before"), PLACEHOLDER_SPACING)
    sp.set(qn("w:after"), PLACEHOLDER_SPACING)
    sp.set(qn("w:line"), "240")
    sp.set(qn("w:lineRule"), "auto")
    ensure_placeholder_border(p_pr)
    set_keep(p_pr, next_para=True)


def caption_to_placeholder_text(caption: str) -> str:
    match = re.match(r"Рис\.\s*[\d.]+\s*(.+)", caption.strip())
    suffix = match.group(1).strip() if match else caption.strip()
    return f"Сюда фото: {suffix}"


def paragraph_has_image(p: etree._Element) -> bool:
    return bool(
        p.findall(".//w:drawing", NS)
        or p.findall(".//w:pict", NS)
        or p.findall(".//w:object", NS)
    )


def has_figure_block_before(children: list[etree._Element], caption_idx: int) -> bool:
    checked = 0
    for j in range(caption_idx - 1, -1, -1):
        ch = children[j]
        if ch.tag == qn("w:tbl"):
            return False
        if ch.tag != qn("w:p"):
            continue
        text = paragraph_text(ch).strip()
        if not text:
            continue
        checked += 1
        if is_photo_placeholder(text) or paragraph_has_image(ch):
            return True
        return False
    return False


def make_placeholder_paragraph(template: etree._Element, text: str) -> etree._Element:
    p = copy.deepcopy(template)
    for run in p.findall("w:r", NS):
        p.remove(run)
    run = etree.SubElement(p, qn("w:r"))
    r_pr = etree.SubElement(run, qn("w:rPr"))
    apply_tnr_r_pr(r_pr, size="28", bold=False, caps=False)
    t = etree.SubElement(run, qn("w:t"))
    t.text = text
    p_pr = get_or_create_p_pr(p)
    apply_placeholder_p_pr(p_pr)
    return p


def ensure_missing_placeholders(body: etree._Element) -> int:
    template = next(
        (p for p in body.findall("w:p", NS) if paragraph_text(p).strip().startswith("Сюда фото:")),
        None,
    )
    if template is None:
        return 0
    inserted = 0
    for ch in list(body):
        if ch.tag != qn("w:p"):
            continue
        caption = paragraph_text(ch).strip()
        if not caption.startswith("Рис."):
            continue
        children = list(body)
        idx = children.index(ch)
        if has_figure_block_before(children, idx):
            continue
        placeholder = make_placeholder_paragraph(template, caption_to_placeholder_text(caption))
        body.insert(idx, placeholder)
        inserted += 1
    return inserted


def apply_caption_p_pr(p_pr: etree._Element) -> None:
    jc = p_pr.find("w:jc", NS)
    if jc is None:
        jc = etree.SubElement(p_pr, qn("w:jc"))
    jc.set(qn("w:val"), "center")
    ind = p_pr.find("w:ind", NS)
    if ind is None:
        ind = etree.SubElement(p_pr, qn("w:ind"))
    ind.set(qn("w:firstLine"), "0")
    sp = p_pr.find("w:spacing", NS)
    if sp is None:
        sp = etree.SubElement(p_pr, qn("w:spacing"))
    sp.set(qn("w:line"), "240")
    sp.set(qn("w:lineRule"), "auto")
    set_keep(p_pr, lines=True)


def make_caption_paragraph(text: str) -> etree._Element:
    p = etree.Element(qn("w:p"))
    p_pr = etree.SubElement(p, qn("w:pPr"))
    apply_caption_p_pr(p_pr)
    run = etree.SubElement(p, qn("w:r"))
    r_pr = etree.SubElement(run, qn("w:rPr"))
    apply_tnr_r_pr(r_pr, size="28", bold=False, caps=False)
    t = etree.SubElement(run, qn("w:t"))
    t.text = text
    return p


def clear_section4_figures(body: etree._Element) -> None:
    rng = find_section4_range(body)
    if rng is None:
        return
    start, end = rng
    for ch in list(body)[start:end]:
        if ch.tag != qn("w:p"):
            continue
        t = paragraph_text(ch).strip()
        if (is_photo_placeholder(t) and t.startswith("Здесь фотка")) or t.startswith("Рис. 4."):
            body.remove(ch)


def fix_section4_figures(body: etree._Element) -> int:
    clear_section4_figures(body)
    ph_template = next(
        (p for p in body.findall("w:p", NS) if is_photo_placeholder(paragraph_text(p).strip())),
        None,
    )
    if ph_template is None:
        return 0
    inserted = 0
    flat: list[tuple[str, int, str]] = []
    fig_num = 1
    for prefix, descriptions in SECTION4_PHOTOS:
        for desc in descriptions:
            flat.append((prefix, fig_num, desc))
            fig_num += 1
    by_prefix: dict[str, list[tuple[int, str]]] = {}
    for prefix, num, desc in flat:
        by_prefix.setdefault(prefix, []).append((num, desc))
    for prefix, items in by_prefix.items():
        rng = find_section4_range(body)
        if rng is None:
            break
        start, end = rng
        children = list(body)
        heading_elem = None
        body_elem = None
        for i in range(start, end):
            ch = children[i]
            if ch.tag != qn("w:p"):
                continue
            t = paragraph_text(ch).strip()
            if not t.startswith(prefix):
                continue
            heading_elem = ch
            for j in range(i + 1, end):
                nxt = children[j]
                if nxt.tag != qn("w:p"):
                    continue
                nt = paragraph_text(nxt).strip()
                if not nt or is_photo_placeholder(nt) or nt.startswith("Рис."):
                    continue
                if re.match(r"^\d+\. ", nt):
                    break
                body_elem = nxt
                break
            break
        if heading_elem is None:
            continue
        anchor = body_elem if body_elem is not None else heading_elem
        insert_at = list(body).index(anchor) + 1
        for num, desc in items:
            ph_text = f"Здесь фотка: {desc}"
            cap_text = f"Рис. 4.{num}. {desc}"
            body.insert(insert_at, make_placeholder_paragraph(ph_template, ph_text))
            insert_at += 1
            body.insert(insert_at, make_caption_paragraph(cap_text))
            insert_at += 1
            inserted += 2
    rng = find_section4_range(body)
    if rng is not None:
        start, end = rng
        while end > start + 1:
            ch = list(body)[end - 1]
            if ch.tag == qn("w:p") and not paragraph_text(ch).strip():
                body.remove(ch)
                end -= 1
            else:
                break
    return inserted


def fix_figure_blocks(body: etree._Element) -> int:
    inserted = ensure_missing_placeholders(body)
    fixed = inserted
    children = list(body)
    i = 0
    while i < len(children):
        ch = children[i]
        if ch.tag != qn("w:p"):
            i += 1
            continue
        text = paragraph_text(ch).strip()
        if not is_photo_placeholder(text) and not text.startswith("Рис."):
            i += 1
            continue
        if is_photo_placeholder(text):
            p_pr = get_or_create_p_pr(ch)
            apply_placeholder_p_pr(p_pr)
            for run in ch.findall("w:r", NS):
                ensure_run_tnr(run)
            fixed += 1
        if text.startswith("Рис."):
            p_pr = get_or_create_p_pr(ch)
            apply_caption_p_pr(p_pr)
            for run in ch.findall("w:r", NS):
                ensure_run_tnr(run)
            fixed += 1
        i += 1
    return fixed


def remove_existing_toc(body: etree._Element) -> etree._Element:
    children = list(body)
    intro_idx = next(i for i, ch in enumerate(children) if ch.tag == qn("w:p") and is_intro_heading(ch))
    i = intro_idx - 1
    while i >= 0:
        ch = list(body)[i]
        if is_toc_paragraph(ch):
            body.remove(ch)
            i -= 1
        else:
            break
    children = list(body)
    intro_idx = next(i for i, ch in enumerate(children) if ch.tag == qn("w:p") and is_intro_heading(ch))
    return children[intro_idx]


def make_toc_line(template_p: etree._Element, style_id: str, title: str, page: str) -> etree._Element:
    p = copy.deepcopy(template_p)
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        p_pr = etree.SubElement(p, qn("w:pPr"))
    ps = p_pr.find("w:pStyle", NS)
    if ps is None:
        ps = etree.SubElement(p_pr, qn("w:pStyle"))
    ps.set(qn("w:val"), style_id)
    for child in list(p):
        if child.tag != qn("w:pPr"):
            p.remove(child)
    r1 = etree.SubElement(p, qn("w:r"))
    ensure_run_tnr(r1)
    t1 = etree.SubElement(r1, qn("w:t"))
    t1.text = title
    r_tab = etree.SubElement(p, qn("w:r"))
    etree.SubElement(r_tab, qn("w:tab"))
    r2 = etree.SubElement(p, qn("w:r"))
    ensure_run_tnr(r2)
    t2 = etree.SubElement(r2, qn("w:t"))
    t2.text = page
    return p


def replace_toc_with_shkel(body: etree._Element) -> None:
    shkel_body = etree.fromstring(read_zip(SHKEL)["word/document.xml"]).find("w:body", NS)
    shkel_children = list(shkel_body)
    toc_title = copy.deepcopy(shkel_children[7])
    template_l1 = shkel_children[8]
    template_l2 = shkel_children[10]
    anchor = remove_existing_toc(body)
    block = [copy.deepcopy(toc_title)]
    for style_id, title, page in TOC_ENTRIES:
        tpl = template_l1 if style_id == "12" else template_l2
        block.append(make_toc_line(tpl, style_id, title, page))
    for _ in range(5):
        block.append(copy.deepcopy(shkel_children[19]))
    parent = anchor.getparent()
    pos = parent.index(anchor)
    for i, elem in enumerate(block):
        parent.insert(pos + i, elem)


def fix_all(target: str = TARGET) -> dict:
    if not os.path.exists(BACKUP):
        shutil.copy2(target, BACKUP)
    parts = read_zip(target)
    copy_styles_from_shkel(parts)
    disable_hyphenation(parts)
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
    root = etree.fromstring(parts["word/document.xml"])
    body = root.find("w:body", NS)
    set_page_margins(root)
    replace_toc_with_shkel(body)
    fix_annotation(body)
    sections, subsections, body_restored = fix_headings(body)
    unstyled_body = fix_unstyled_body_paragraphs(body)
    spacing_normalized = normalize_body_ad_spacing(body)
    pruned = prune_expogo_test_tables(body)
    checklist_groups = fix_checklist_vmerge(body)
    testcase_blocks = fix_testcase_vmerge(body)
    table_headers = fix_table_page_breaks(body)
    table_runs = fix_table_fonts(body)
    section4_figures = fix_section4_figures(body)
    figures = fix_figure_blocks(body)
    list_fix = fix_existing_list_fonts(body)
    header_changed = fix_header_kp(parts)
    parts["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    out = write_zip(target, parts)
    return {
        "output": out,
        "sections_fixed": sections,
        "subsections_fixed": subsections,
        "body_items_restored": body_restored,
        "unstyled_body_fixed": unstyled_body,
        "spacing_normalized": spacing_normalized,
        "checklist_pruned": pruned.get("checklist_removed", 0),
        "testcase_pruned": pruned.get("testcase_removed", 0),
        "checklist_groups_fixed": checklist_groups,
        "testcase_blocks_fixed": testcase_blocks,
        "table_headers_fixed": table_headers,
        "section4_figures_inserted": section4_figures,
        "table_runs_fixed": table_runs,
        "figure_blocks_fixed": figures,
        "list_font_fix": list_fix,
        "header_kp_code_fixed": header_changed,
    }


if __name__ == "__main__":
    import json
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    result = fix_all()
    print("OK")
    for k, v in result.items():
        print(f"  {k}: {v}")
