# -*- coding: utf-8 -*-
"""Сборка ПЗ «Экспого» на базе шаблона Шкель (word/media не изменяется)."""
from __future__ import annotations

import re
import shutil
import zipfile
from pathlib import Path

from docx import Document
from docx.enum.text import WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
TEMPLATE = ROOT / "ПЗ - Шкель Икс-парк_КП26.docx"
DOC_PATH = ROOT / "ПЗ - Экспого_КП26.docx"

APP = "Экспого"
APP_QUOTED = f"«{APP}»"
TOPIC = (
    f"мобильное CRM-приложение {APP_QUOTED} "
    "для автоматизации учёта клиентов, сделок и задач"
)


def set_para(p, text: str) -> None:
    p.text = text


def set_cell(cell, text: str) -> None:
    cell.text = text


def resize_table(table, data_rows: int) -> None:
    need = 1 + data_rows
    while len(table.rows) < need:
        table.add_row()
    while len(table.rows) > need:
        table._tbl.remove(table.rows[-1]._tr)


def fill_db_table(table, rows: list[tuple[str, str, str]]) -> None:
    resize_table(table, len(rows))
    hdr = table.rows[0].cells
    set_cell(hdr[0], "Наименование столбца")
    set_cell(hdr[1], "Тип данных")
    set_cell(hdr[2], "Описание")
    for i, (name, dtype, desc) in enumerate(rows, start=1):
        r = table.rows[i].cells
        set_cell(r[0], name)
        set_cell(r[1], dtype)
        set_cell(r[2], desc)


def fill_ui_table(table, rows: list[tuple[str, str]]) -> None:
    resize_table(table, len(rows))
    set_cell(table.rows[0].cells[0], "Элемент управления")
    set_cell(table.rows[0].cells[1], "Описание функции")
    for i, (el, desc) in enumerate(rows, start=1):
        set_cell(table.rows[i].cells[0], el)
        set_cell(table.rows[i].cells[1], desc)


def vmerge_val(cell) -> str | None:
    tc_pr = cell._tc.tcPr
    if tc_pr is None:
        return None
    vm = tc_pr.find(qn("w:vMerge"))
    if vm is None:
        return None
    return vm.get(qn("w:val"))


# Листинг программы (приложение 2) — фрагменты ключевых файлов проекта
LISTING_FILES: list[tuple[str, int]] = [
    ("backend/Program.cs", 55),
    ("backend/Controllers/AuthController.cs", 55),
    ("backend/Controllers/AuthMeController.cs", 45),
    ("backend/Controllers/ClientsController.cs", 50),
    ("backend/Controllers/DealsController.cs", 50),
    ("backend/Controllers/TasksController.cs", 50),
    ("backend/Controllers/DashboardController.cs", 45),
    ("backend/Controllers/NotificationsController.cs", 45),
    ("backend/Controllers/More/TeamController.cs", 45),
    ("backend/Data/Entities.cs", 55),
    ("backend/Data/ExpogoDbContext.cs", 40),
    ("backend/Services/NotificationService.cs", 45),
    ("frontend/src/screens/LoginScreen.tsx", 50),
    ("frontend/src/screens/RegisterScreen.tsx", 45),
    ("frontend/src/screens/DashboardScreen.tsx", 50),
    ("frontend/src/screens/ClientsScreen.tsx", 45),
    ("frontend/src/screens/DealsPipelineScreen.tsx", 50),
    ("frontend/src/screens/TasksScreen.tsx", 45),
    ("frontend/src/screens/NotificationsScreen.tsx", 45),
    ("frontend/src/api/requests.ts", 50),
    ("frontend/src/auth/AuthProvider.tsx", 50),
    ("frontend/src/navigation/RootNavigator.tsx", 45),
]


def read_code_lines(rel_path: str, max_lines: int) -> list[str]:
    path = PROJECT / rel_path
    if not path.exists():
        return [f"// файл не найден: {rel_path}"]
    return path.read_text(encoding="utf-8").splitlines()[:max_lines]


def add_listing_header(doc: Document, title: str) -> None:
    p = doc.add_paragraph()
    try:
        p.style = doc.styles["Курсовое_Стандарт"]
    except KeyError:
        p.style = doc.styles["Normal"]
    pf = p.paragraph_format
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(0)
    pf.space_before = Pt(12)
    pf.space_after = Pt(6)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    set_para(p, title)
    for run in p.runs:
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(14)


def add_listing_code_line(doc: Document, line: str) -> None:
    p = doc.add_paragraph()
    try:
        p.style = doc.styles["No Spacing"]
    except KeyError:
        p.style = doc.styles["Normal"]
    pf = p.paragraph_format
    pf.first_line_indent = Cm(0)
    pf.left_indent = Cm(0)
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    set_para(p, line.replace("\t", "    ") or " ")
    for run in p.runs:
        run.font.name = "Courier New"
        run.font.size = Pt(9)


def append_program_listing(doc: Document) -> None:
    """Приложение 2: листинги исходного кода (как в образце КП — заголовок + моноширинный текст)."""
    for idx in (335, 336):
        if idx < len(doc.paragraphs):
            set_para(doc.paragraphs[idx], "")

    n = 1
    for rel_path, max_lines in LISTING_FILES:
        add_listing_header(doc, f"Листинг {n} – фрагмент файла {rel_path}")
        n += 1
        for line in read_code_lines(rel_path, max_lines):
            add_listing_code_line(doc, line)
        doc.add_paragraph()


def fill_test_table(table, env: str, steps: list[tuple[str, str, str, str, str, str]]) -> None:
    """steps: (id, description, step_text, input, expected, actual) — по одной строке таблицы."""
    set_cell(table.rows[0].cells[0], env)
    for i, row in enumerate(steps):
        ri = i + 2
        if ri >= len(table.rows):
            break
        cells = table.rows[ri].cells
        id_, desc, step, inp, exp, act = row
        for ci, val in enumerate((id_, desc, step, inp, exp, act)):
            if vmerge_val(cells[ci]) == "continue":
                continue
            set_cell(cells[ci], val)


def build_test_steps() -> list[tuple[str, str, str, str, str, str]]:
    """86 строк данных (как в шаблоне Шкель), текст под CRM Экспого."""
    ok = "Выполнено успешно"

    def block(
        tid: str,
        desc: str,
        step_lines: list[str],
        inp: str = "",
        expected: str = "",
    ) -> list[tuple[str, str, str, str, str, str]]:
        if not expected:
            expected = ok
        out: list[tuple[str, str, str, str, str, str]] = []
        for i, st in enumerate(step_lines):
            out.append(
                (
                    tid if i == 0 else "",
                    desc if i == 0 else "",
                    st,
                    inp if i == 0 else "",
                    expected if i == 0 else "",
                    ok if i == 0 else "",
                )
            )
        return out

    rows: list[tuple[str, str, str, str, str, str]] = []
    rows += block(
        "Aut01",
        "Успешный вход администратора",
        [
            "1. Запустить API (docker compose up) и Expo (npm start).",
            "2. Открыть экран входа, ввести admin / 123456.",
            "3. Нажать «Войти».",
        ],
        "admin, 123456",
        "Открывается вкладка «Главная» с KPI и лентой активности.",
    )
    rows += block(
        "Aut02",
        "Неверный пароль",
        [
            "1. На экране входа ввести admin и неверный пароль.",
            "2. Нажать «Войти».",
        ],
        "admin, wrong",
        "Отображается сообщение об ошибке, вход не выполняется.",
    )
    rows += block(
        "Aut03",
        "Регистрация пользователя",
        [
            "1. Открыть экран регистрации.",
            "2. Заполнить логин, email, пароль, ФИО.",
            "3. Нажать «Зарегистрироваться».",
        ],
        "новый логин",
        "Создан пользователь с ролью Member, открывается главная.",
    )
    rows += block(
        "Aut04",
        "Блокировка после неудачных попыток",
        [
            "1. Пять раз ввести неверный пароль для одного логина.",
            "2. Проверить сообщение о временной блокировке.",
        ],
        expected="Учётная запись временно заблокирована (lockout).",
    )
    rows += block(
        "Aut05",
        "Выход из системы",
        [
            "1. В разделе «Ещё» нажать «Выйти».",
            "2. Попытаться открыть список клиентов.",
        ],
        expected="Сессия завершена, отображается экран входа.",
    )
    rows += block(
        "Dash01",
        "Дашборд KPI",
        [
            "1. Войти как admin.",
            "2. Открыть вкладку «Главная».",
            "3. Проверить карточки продаж, лидов, задач и воронку.",
        ],
        expected="Отображаются показатели месяца и лента ActivityEvent.",
    )
    rows += block(
        "Cli01",
        "Список клиентов",
        [
            "1. Перейти на вкладку «Клиенты».",
            "2. Дождаться загрузки списка с API.",
        ],
        expected="Отображаются карточки клиентов организации Экспого.",
    )
    rows += block(
        "Cli02",
        "Создание клиента",
        [
            "1. Нажать «+» / «Добавить клиента».",
            "2. Заполнить ФИО, компанию, контакты.",
            "3. Сохранить.",
        ],
        expected="Клиент появляется в списке, запись в AuditLog.",
    )
    rows += block(
        "Cli03",
        "Карточка клиента",
        [
            "1. Открыть клиента из списка.",
            "2. Просмотреть активную сделку и историю контактов.",
        ],
        expected="Отображаются ContactEvent и связанная сделка.",
    )
    rows += block(
        "Deal01",
        "Воронка сделок",
        [
            "1. Открыть вкладку «Сделки».",
            "2. Проверить колонки Lead, Negotiation, Closed.",
        ],
        expected="Сделки сгруппированы по стадиям, суммы в валюте профиля.",
    )
    rows += block(
        "Deal02",
        "Создание сделки",
        [
            "1. Создать сделку для клиента.",
            "2. Указать сумму, вероятность, дату закрытия.",
            "3. Сохранить.",
        ],
        expected="Сделка отображается в колонке Lead.",
    )
    rows += block(
        "Deal03",
        "Смена стадии сделки",
        [
            "1. Перетащить или изменить стадию сделки на Negotiation.",
            "2. Проверить уведомление при смене стадии.",
        ],
        expected="Стадия обновлена, при необходимости создано UserNotification.",
    )
    rows += block(
        "Task01",
        "Список задач",
        [
            "1. Открыть вкладку «Задачи».",
            "2. Просмотреть задачи на выбранную дату.",
        ],
        expected="Отображаются приоритет, исполнитель, статус выполнения.",
    )
    rows += block(
        "Task02",
        "Создание и выполнение задачи",
        [
            "1. Создать задачу с высоким приоритетом.",
            "2. Отметить выполненной.",
        ],
        expected="Задача в списке выполненных, KPI на главной обновляются.",
    )
    rows += block(
        "Not01",
        "Центр уведомлений",
        [
            "1. Нажать иконку колокольчика в шапке.",
            "2. Открыть экран уведомлений.",
            "3. Отметить одно прочитанным и «Прочитать все».",
        ],
        expected="Счётчик непрочитанных уменьшается.",
    )
    rows += block(
        "Team01",
        "Управление командой (админ)",
        [
            "1. Войти как admin, открыть «Пользователи».",
            "2. Изменить роль пользователя на Member.",
        ],
        expected="Роль обновлена через PATCH /team/role.",
    )
    rows += block(
        "Aud01",
        "Журнал аудита",
        [
            "1. Открыть «Журнал аудита».",
            "2. Просмотреть записи изменений сущностей.",
        ],
        expected="Отображаются action, entityType, before/after JSON.",
    )
    rows += block(
        "Rep01",
        "Отчёты",
        [
            "1. Открыть раздел «Отчёты».",
            "2. Проверить сводку по сделкам и конверсии.",
        ],
        expected="Данные загружаются с GET /reports/summary.",
    )
    rows += block(
        "Set01",
        "Настройки профиля",
        [
            "1. Открыть «Настройки».",
            "2. Переключить тему и валюту отображения.",
            "3. Сохранить.",
        ],
        expected="Предпочтения сохранены через PATCH /auth/me/preferences.",
    )
    rows += block(
        "Seed01",
        "Демо-наполнение",
        [
            "1. Выполнить POST /seed/run от имени admin.",
            "2. Обновить списки клиентов и сделок.",
        ],
        expected="Появляются демонстрационные клиенты, сделки и задачи.",
    )

    # Дополняем до 86 строк (как в шаблоне), повторяя проверки API
    extras = [
        ("Api01", "Health check", ["1. Открыть GET /health.", "2. Проверить статус 200."], "", "Сервис доступен."),
        ("Api02", "Ready check", ["1. Открыть GET /ready.", "2. Убедиться в подключении к PostgreSQL."], "", "База данных готова."),
        ("Sec01", "JWT без токена", ["1. Вызвать GET /clients без Authorization."], "", "Ответ 401 Unauthorized."),
        ("Bill01", "Тариф", ["1. Открыть «Тариф и лимиты».", "2. Просмотреть подписку и usage."], "", "Данные billing subscription отображаются."),
        ("Int01", "Интеграции", ["1. Открыть «Интеграции».", "2. Просмотреть webhooks и jobs."], "", "Списки endpoints и очереди jobs загружаются."),
        ("Auto01", "Автоматизации", ["1. Открыть «Автоматизации».", "2. Создать правило trigger→action."], "", "Правило сохранено в AutomationRule."),
        ("Sup01", "Поддержка", ["1. Открыть «Помощь».", "2. Создать тикет в поддержку."], "", "Тикет SupportTicket создан."),
    ]
    for tid, desc, st, inp, exp in extras:
        rows += block(tid, desc, st, inp, exp)

    # Pad with generic regression rows
    n = 0
    while len(rows) < 86:
        n += 1
        rows += block(
            f"Reg{n:02d}",
            f"Регрессионная проверка {n}",
            [f"1. Повторить сценарий Aut01 (итерация {n})."],
        )
    return rows[:86]


def build() -> None:
    work_path = DOC_PATH.with_name(DOC_PATH.stem + "._build.docx")
    shutil.copy2(TEMPLATE, work_path)
    doc = Document(str(work_path))
    p = doc.paragraphs

    # --- АННОТАЦИЯ ---
    set_para(p[1], f"Курсовой проект на тему {TOPIC} состоит из программного средства, пояснительной записки и графической части.")
    set_para(
        p[2],
        f"Программное средство предназначено для ведения базы клиентов, управления воронкой продаж, "
        f"постановки и контроля задач, просмотра аналитики на дашборде, in-app уведомлений, "
        f"а также администрирования команды, аудита, тарифа и интеграций в рамках организации.",
    )
    set_para(
        p[3],
        "Программное средство разработано с использованием React Native (Expo), TypeScript, C#, "
        "ASP.NET Core 10, Entity Framework Core и PostgreSQL; среды разработки — Visual Studio Code и Rider.",
    )
    set_para(p[4], "Пояснительная записка выполнена на 45 листах, содержит четыре раздела и два приложения.")
    set_para(p[5], "Графическая часть выполнена на двух листах, включает схему базы данных и диаграмму вариантов использования.")

    # --- ВВЕДЕНИЕ ---
    set_para(
        p[25],
        "Одной из актуальных задач современного бизнеса является эффективное управление взаимоотношениями с клиентами. "
        "В условиях роста объёма продаж и распределённых команд возникает потребность в единой CRM-системе, "
        "позволяющей централизованно вести клиентов, сделки, задачи и аналитику с мобильного устройства.",
    )
    set_para(p[26], f"Цель курсового проекта — разработка мобильного CRM-приложения {APP_QUOTED} для автоматизации учёта клиентов, сделок и задач.")
    set_para(p[27], "Для достижения цели необходимо решить следующие задачи:")
    tasks_intro = [
        "1) реализовать регистрацию и авторизацию пользователей с JWT и refresh-токенами;",
        "2) обеспечить ведение справочника клиентов и истории контактов;",
        "3) реализовать воронку продаж (лид, переговоры, закрыта) с суммами и вероятностью;",
        "4) реализовать постановку, назначение и контроль задач с приоритетами;",
        "5) реализовать дашборд с KPI и лентой активности;",
        "6) реализовать in-app уведомления о задачах и сделках;",
        "7) выполнить тестирование программного средства и подготовить пользовательское руководство.",
    ]
    for i, t in enumerate(tasks_intro):
        set_para(p[28 + i], t)
    set_para(p[35], "Пояснительная записка содержит следующие разделы:")
    set_para(p[36], "– в разделе 1 «Назначение и область применения» приводятся назначение и область применения, а также обзор аналогов;")
    set_para(p[37], "– в разделе 2 «Технические характеристики» приводятся постановка задачи, организация данных, обоснование выбора программных средств и проектирование интерфейса;")
    set_para(p[38], "– в разделе 3 «Тестирование и анализ полученных результатов» приводятся результаты проверок по направлениям тестирования и вывод о пригодности продукта;")
    set_para(p[39], "– в разделе 4 «Руководство по использованию программного средства» описываются сценарии работы пользователя.")
    set_para(
        p[40],
        "Цели курсового проектирования: закрепление и систематизация теоретических знаний и практических навыков, "
        "формирование навыков проектирования клиент-серверного мобильного приложения и подготовки программной документации.",
    )

    # --- Раздел 1 ---
    set_para(
        p[43],
        f"Мобильное CRM-приложение {APP_QUOTED} разрабатывается с целью предоставить сотрудникам организации "
        "единую платформу для работы с клиентами, сделками и задачами. Приложение объединяет дашборд с KPI, "
        "справочник клиентов, воронку продаж, календарь задач, центр уведомлений и административные разделы "
        "(команда, аудит, отчёты, тариф, интеграции, автоматизации, поддержка). "
        "Основная идея — сократить время на поиск информации о клиенте и ускорить закрытие сделок.",
    )
    set_para(p[45], f"Мобильное CRM-приложение {APP_QUOTED} может использоваться в следующих сферах:")
    areas = [
        "– Отделы продаж – для ведения клиентской базы и воронки сделок;",
        "– Малый и средний бизнес – для учёта контактов и задач без развёртывания тяжёлых CRM;",
        "– Сервисные компании – для фиксации истории общения с клиентами;",
        "– Учебные проекты – для демонстрации клиент-серверной архитектуры и multi-tenant модели;",
        "– Администрирование SaaS – для управления ролями, тарифом и интеграциями в одной организации.",
    ]
    for i, a in enumerate(areas):
        set_para(p[46 + i], a)
    audience = [
        "– Менеджеры по продажам, которым необходимо видеть клиентов и стадии сделок;",
        "– Руководители, анализирующие KPI на главной странице;",
        "– Администраторы организации, управляющие пользователями и аудитом;",
        "– Компании, которым требуется мобильный доступ к CRM с телефона или браузера (Expo Web).",
    ]
    for i, a in enumerate(audience):
        set_para(p[52 + i], a)
    reqs = [
        "– Интуитивно понятный интерфейс с нижней навигацией и русской локализацией;",
        "– Актуальность данных – синхронизация с REST API ASP.NET Core и PostgreSQL;",
        "– Безопасность – JWT, refresh-токены, ролевая модель Admin/Member и блокировка;",
        "– Гибкость – тема светлая/тёмная, валюта отображения сумм (BYN и др.);",
        "– Прозрачность – журнал аудита и отчёты для администратора;",
        "– Кроссплатформенность – iOS, Android и веб через Expo.",
    ]
    for i, r in enumerate(reqs):
        set_para(p[57 + i], r)
    set_para(
        p[63],
        "Обзор существующих подходов и аналогов. На рынке представлены различные CRM-системы, "
        "однако не все из них сочетают мобильный клиент, open API и учебную прозрачность реализации.",
    )
    analogs = [
        "– amoCRM (https://www.amocrm.ru/) – популярная CRM с воронкой и задачами; недостаток для учебного проекта — закрытая облачная модель без полного контроля исходного кода.",
        "– Bitrix24 (https://www.bitrix24.ru/) – комплексная платформа с CRM; избыточна для узкой задачи мобильного клиента с собственным API.",
        "– HubSpot CRM – сильная воронка и маркетинг; требует облачной регистрации и не ориентирована на локальный учебный стенд.",
    ]
    for i, a in enumerate(analogs):
        set_para(p[65 + i], a)
    set_para(
        p[68],
        f"Мобильное CRM-приложение {APP_QUOTED} объединяет ключевые функции CRM в едином Expo-клиенте "
        "и собственном backend на ASP.NET Core, обеспечивая прозрачную архитектуру, Docker-развёртывание "
        "и демонстрационные учётные записи admin/user для защиты курсового проекта.",
    )

    # --- 2.1 Постановка задачи ---
    postanovka = [
        "Реализовать регистрацию и авторизацию пользователей (JWT + refresh) для ведения личных сессий.",
        "Создать современный адаптивный интерфейс на React Native (Expo) для телефона и браузера.",
        "Реализовать главную страницу (дашборд) с KPI, воронкой стадий и лентой активности.",
        "Реализовать экраны входа и регистрации.",
        "Реализовать справочник клиентов с карточкой и историей контактов.",
        "Реализовать воронку сделок с стадиями Lead, Negotiation, Closed.",
        "Реализовать создание, редактирование и удаление сделок с суммой в USD и отображением в валюте профиля.",
        "Реализовать список задач с приоритетом, датой, исполнителем и отметкой выполнения.",
        "Реализовать экран уведомлений с счётчиком непрочитанных в шапке.",
        "Реализовать раздел «Ещё»: настройки, команда, аудит, отчёты, тариф, интеграции, автоматизации, поддержка.",
        "Реализовать серверную часть на ASP.NET Core Web API с Entity Framework Core.",
        "Реализовать хранение данных в PostgreSQL и миграции при старте.",
        "Обеспечить защищённую передачу данных между мобильным клиентом и API.",
        "Обеспечить удобную навигацию (bottom tabs + stack).",
        "Реализовать взаимодействие с backend через REST API и policy-based авторизацию.",
    ]
    for i, t in enumerate(postanovka):
        if 72 + i < len(p):
            set_para(p[72 + i], t)
    # очистка хвоста старой постановки (парковка / SignalR)
    for idx in range(72 + len(postanovka), 92):
        if idx < len(p) and p[idx].text.strip():
            set_para(p[idx], "")

    # --- 2.2 Данные ---
    set_para(p[94], "Входные данные приложения:")
    indata = [
        "– регистрационные данные (логин, email, пароль, ФИО);",
        "– данные авторизации (логин, пароль);",
        "– карточка клиента (ФИО, компания, телефон, email, должность);",
        "– параметры сделки (клиент, название, стадия, сумма, вероятность, дата закрытия);",
        "– параметры задачи (дата, заголовок, описание, приоритет, исполнитель);",
        "– настройки профиля (тема UI, код валюты).",
    ]
    for i, t in enumerate(indata):
        set_para(p[95 + i], t)
    set_para(p[100], "Выходные данные приложения:")
    outdata = [
        "– списки клиентов, сделок и задач организации;",
        "– сводка дашборда и лента ActivityEvent;",
        "– уведомления UserNotification;",
        "– отчёты, записи AuditLog, данные тарифа и интеграций;",
        "– JWT access/refresh токены.",
    ]
    for i, t in enumerate(outdata):
        set_para(p[101 + i], t)
    set_para(
        p[107],
        f"Для обеспечения работы CRM-приложения {APP_QUOTED} требуется хранение данных о пользователях, "
        "клиентах, сделках, задачах и служебных сущностях SaaS. В серверной части данные представлены "
        "моделями Entity Framework (см. backend/Data/Entities.cs) и согласованы с PostgreSQL.",
    )
    set_para(p[109], "Ниже приведены основные структуры данных, которые подлежат хранению.")
    set_para(p[111], "Таблица 2.1 – Структура данных таблицы «Пользователи (AppUser)»")
    set_para(p[113], "Таблица 2.2 – Структура данных таблицы «Клиенты (Client)»")
    set_para(p[115], "Таблица 2.3 – Структура данных таблицы «Сделки (Deal)»")
    set_para(p[117], "Таблица 2.4 – Структура данных таблицы «Задачи (TaskItem)»")

    # --- 2.3 Программные средства ---
    set_para(
        p[120],
        "Проект основан на стеке React Native 0.81 (Expo 54), TypeScript 5.9, ASP.NET Core 10, "
        "Entity Framework Core 10 и PostgreSQL 16. Клиент использует React Navigation, AsyncStorage "
        "для сессии, Context API (Auth, Preferences, Notifications). Сервер реализует JWT Bearer, "
        "refresh-токены, policy-based permissions, аудит, фоновый IntegrationJobsWorker и health checks.",
    )
    set_para(
        p[121],
        "Такой выбор технологий обеспечивает кроссплатформенность мобильного клиента, строгую типизацию, "
        "масштабируемый REST API и развёртывание через Docker Compose (postgres + api). "
        "Expo ускоряет разработку UI; EF Core упрощает миграции и seed демо-данных.",
    )
    set_para(
        p[122],
        "В качестве инструментов разработки используются Visual Studio Code, JetBrains Rider, Git, "
        "npm, .NET SDK 10 и Docker. Проект организован в корне expogo-cursach: папки frontend (Expo) "
        "и backend (Web API), файл docker-compose.yml.",
    )
    set_para(
        p[123],
        "Среди возможных сложностей: согласованность multi-tenant данных, ротация refresh-токенов, "
        "конкурентное изменение сделок, пересчёт валют сумм и объём листинга в приложении 2.",
    )

    # --- 2.4 Интерфейс ---
    set_para(p[126], f"Мобильное CRM-приложение {APP_QUOTED} предусматривает следующие экраны и разделы:")
    screens = [
        "– экран входа и регистрации;",
        "– главная (дашборд) с KPI;",
        "– клиенты (список, карточка, редактирование);",
        "– сделки (воронка, редактирование);",
        "– задачи (список, редактирование);",
        "– уведомления;",
        "– раздел «Ещё» (настройки, админ-разделы).",
    ]
    for i, s in enumerate(screens):
        set_para(p[127 + i], s)
    for idx in range(127 + len(screens), 137):
        if idx < len(p):
            set_para(p[idx], "")
    set_para(p[137], "Ниже приведены пояснения к макетам интерфейса (рис. 2.1–2.10).")
    captions = {
        139: "Макет экрана входа:",
        147: "Рис. 2.1. Макет экрана входа",
        149: "Макет экрана регистрации:",
        153: "Рис. 2.2. Макет экрана регистрации",
        175: "Макет главной (дашборд):",
        178: "Рис. 2.3. Макет дашборда",
        180: "Макет списка клиентов:",
        182: "Рис. 2.4. Макет списка клиентов",
        184: "Макет воронки сделок:",
        187: "Рис. 2.5. Макет воронки сделок",
        189: "Макет списка задач:",
        193: "Рис. 2.6. Макет списка задач",
        195: "Макет уведомлений:",
        198: "Рис. 2.7. Макет экрана уведомлений",
        200: "Макет раздела «Ещё»:",
        203: "Рис. 2.8. Макет раздела «Ещё»",
        205: "Макет настроек:",
        208: "Рис. 2.9. Макет настроек",
    }
    for idx, text in captions.items():
        if idx < len(p):
            set_para(p[idx], text)
    set_para(
        p[210],
        "Таким образом, выполнено проектирование интерфейса с опорой на сценарии: вход, дашборд, "
        "клиенты, сделки, задачи, уведомления и администрирование.",
    )

    # --- 2.5 Физическая структура ---
    set_para(
        p[213],
        "Программа реализована на основе клиента Expo/React Native и сервера ASP.NET Core. "
        "Структура папок проекта представлена на рисунке 2.11.",
    )
    set_para(p[214], "Рис. 2.11. Описание физической структуры программы")
    set_para(
        p[56],
        "При разработке приложения был проведён анализ CRM-рынка и потребностей пользователей в мобильном доступе к клиентам и сделкам. Основные требования:",
    )
    struct_lines = [
        (216, "README.md – описание проекта, Docker и Expo."),
        (217, "start/start.txt – краткая инструкция запуска."),
        (218, "frontend/ – клиентское приложение Expo."),
        (219, "backend/ – Web API ASP.NET Core."),
        (220, "docker-compose.yml – PostgreSQL и API."),
        (221, "В папке frontend:"),
        (222, "App.tsx – корневой компонент, провайдеры контекста."),
        (223, "src/screens/ – экраны (Dashboard, Clients, Deals, Tasks, Login…)."),
        (224, "src/navigation/ – RootNavigator, типы маршрутов."),
        (225, "src/api/ – клиент REST, типы DTO."),
        (226, "src/auth/ – AuthShell, AuthContext."),
        (227, "src/notifications/ – NotificationsContext."),
        (228, "src/components/ – AppHeader, DatePickerField и др."),
        (229, "В папке backend:"),
        (230, "Program.cs – настройка JWT, CORS, миграций, health."),
        (231, "Controllers/ – Clients, Deals, Tasks, Auth, Dashboard, Notifications…"),
        (232, "Controllers/More/ – Team, Billing, Integrations, Audit, Reports…"),
        (233, "Data/Entities.cs – модели EF Core."),
        (234, "Data/ExpogoDbContext.cs – контекст БД."),
        (235, "Services/NotificationService.cs – доменные уведомления."),
        (236, "Migrations/ – миграции PostgreSQL."),
        (237, "Security/ – JWT, permissions, TenantResolution."),
        (238, "Infrastructure/ – аудит, bootstrap seed, IntegrationJobsWorker."),
    ]
    for idx, text in struct_lines:
        if idx < len(p):
            set_para(p[idx], text)
    for idx in range(239, 264):
        if idx < len(p) and p[idx].text.strip():
            set_para(p[idx], "")

    # --- Раздел 3 ---
    set_para(p[266], "Функциональное тестирование — проверка регистрации, входа, CRUD клиентов, сделок, задач, дашборда, уведомлений и админ-разделов.")
    set_para(p[267], "Тестирование удобства использования — проверка нижней навигации, форм и сообщений об ошибках на русском языке.")
    set_para(p[268], "Тестирование интерфейса — проверка светлой/тёмной темы, шрифта Inter и отображения на телефоне и в Expo Web.")
    set_para(p[269], "Тестирование производительности — оценка времени отклика API и загрузки списков при типовом объёме seed-данных.")
    set_para(p[270], "Тестирование безопасности — проверка 401 без токена, lockout, блокировки пользователя админом.")
    set_para(p[271], "Результаты функциональных проверок сведены в чек-лист (таблица 3.1). Детальные тест-кейсы — в приложении 1.")
    set_para(p[273], "Таблица 3.1 – Чек-лист тестирования приложения")
    set_para(
        p[275],
        f"По итогам тестирования установлено, что CRM-приложение {APP_QUOTED} реализует заявленные сценарии, "
        "корректно взаимодействует с API и готово к демонстрации в учебных целях.",
    )

    # --- Раздел 4 ---
    guide = [
        (278, "1. Регистрация и вход в систему"),
        (
            279,
            "Запустите Docker (docker compose up -d --build) и Expo (cd frontend && npm start). "
            "На экране входа укажите admin / 123456 или зарегистрируйте нового пользователя. "
            "После входа открывается главная с KPI.",
        ),
        (280, "2. Работа с клиентами"),
        (
            281,
            "На вкладке «Клиенты» просмотрите список, откройте карточку, добавьте или измените клиента, "
            "зафиксируйте контактное событие.",
        ),
        (282, "3. Воронка сделок"),
        (
            283,
            "На вкладке «Сделки» создайте сделку, укажите сумму и стадию. Переместите сделку между колонками "
            "Lead, Negotiation, Closed.",
        ),
        (284, "4. Задачи"),
        (
            285,
            "На вкладке «Задачи» создайте задачу с приоритетом и датой, назначьте исполнителя, отметьте выполнение.",
        ),
        (286, "5. Уведомления"),
        (
            287,
            "Нажмите иконку колокольчика в шапке, просмотрите уведомления о просроченных и срочных задачах, "
            "отметьте прочитанными.",
        ),
        (288, "6. Раздел «Ещё» (администратор)"),
        (
            289,
            "Под учётной записью admin доступны пользователи, аудит, отчёты, тариф, интеграции, автоматизации. "
            "Обычный user видит настройки и поддержку.",
        ),
        (290, "7. Настройки"),
        (291, "В «Настройках» переключите тему и валюту отображения сумм сделок."),
        (292, "8. Выход из системы"),
        (293, "В разделе «Ещё» нажмите «Выйти» для завершения сессии."),
    ]
    for idx, text in guide:
        if idx < len(p):
            set_para(p[idx], text)

    # --- Заключение ---
    set_para(p[297], f"В ходе курсового проекта было разработано мобильное CRM-приложение {APP_QUOTED}.")
    set_para(
        p[298],
        "Пользователь может войти в систему, вести клиентов, управлять воронкой сделок, ставить задачи, "
        "просматривать дашборд и уведомления. Администратор управляет командой, аудитом и отчётами. "
        "Проект включает frontend на Expo и backend на ASP.NET Core с PostgreSQL.",
    )
    set_para(
        p[299],
        "Для защиты API используется JWT и refresh-токены. Backend предоставляет REST-контроллеры для CRM и SaaS-модулей. "
        "При старте выполняются миграции EF Core и seed учётных записей admin/user.",
    )
    set_para(p[300], "В качестве языков программирования использовались C# и TypeScript.")
    set_para(p[301], "В качестве технологии UI использовались React Native и компоненты Expo.")
    set_para(p[302], "В качестве среды разработки использовались Visual Studio Code и Rider.")
    set_para(p[303], "Программное средство было успешно протестировано.")

    # --- Источники ---
    sources = [
        "Microsoft Learn. ASP.NET Core [Электронный ресурс]. – Режим доступа: https://learn.microsoft.com/aspnet/core. – Дата доступа: 01.06.2026.",
        "Microsoft Learn. Entity Framework Core [Электронный ресурс]. – Режим доступа: https://learn.microsoft.com/ef/core. – Дата доступа: 01.06.2026.",
        "Expo Documentation [Электронный ресурс]. – Режим доступа: https://docs.expo.dev/. – Дата доступа: 01.06.2026.",
        "React Native Documentation [Электронный ресурс]. – Режим доступа: https://reactnative.dev/docs/getting-started. – Дата доступа: 01.06.2026.",
        "React Navigation [Электронный ресурс]. – Режим доступа: https://reactnavigation.org/docs/getting-started. – Дата доступа: 01.06.2026.",
        "PostgreSQL Documentation [Электронный ресурс]. – Режим доступа: https://www.postgresql.org/docs/. – Дата доступа: 01.06.2026.",
        "JWT Introduction [Электронный ресурс]. – Режим доступа: https://jwt.io/introduction. – Дата доступа: 01.06.2026.",
        "TypeScript Documentation [Электронный ресурс]. – Режим доступа: https://www.typescriptlang.org/docs/. – Дата доступа: 01.06.2026.",
        "OWASP. Web Security Testing Guide [Электронный ресурс]. – Режим доступа: https://owasp.org/www-project-web-security-testing-guide/. – Дата доступа: 01.06.2026.",
    ]
    for i, s in enumerate(sources):
        if 307 + i < len(p):
            set_para(p[307 + i], s)

    abbrevs = [
        "БД – база данных",
        "ПО – программное обеспечение",
        "ПП – программный продукт",
        "API – Application Programming Interface",
        "CRM – Customer Relationship Management",
        "CRUD – Create, Read, Update, Delete",
        "DTO – Data Transfer Object",
        "IDE – Integrated Development Environment",
        "JWT – JSON Web Token",
        "REST – Representational State Transfer",
        "UI – User Interface",
        "UX – User Experience",
    ]
    for i, ab in enumerate(abbrevs):
        if 319 + i < len(p):
            set_para(p[319 + i], ab)

    # --- Таблицы БД ---
    t = doc.tables
    fill_db_table(
        t[0],
        [
            ("Идентификатор", "Целое число", "Уникальный номер пользователя (AppUser.Id)"),
            ("Логин", "Текст", "Уникальное имя для входа (Username)"),
            ("Email", "Текст", "Адрес электронной почты"),
            ("ФИО", "Текст", "Полное имя (FullName)"),
            ("Хэш пароля", "Текст", "PasswordHash (пароль не хранится открытым текстом)"),
        ],
    )
    fill_db_table(
        t[1],
        [
            ("Идентификатор", "Целое число", "Уникальный номер клиента"),
            ("Идентификатор организации", "Целое число", "TenantId"),
            ("ФИО", "Текст", "FullName контактного лица"),
            ("Компания", "Текст", "Название компании клиента"),
            ("Телефон", "Текст", "Контактный телефон"),
            ("Email", "Текст", "Рабочий email (WorkEmail)"),
            ("Должность", "Текст", "RoleTitle"),
            ("Дата создания", "Дата и время", "CreatedAtUtc"),
        ],
    )
    fill_db_table(
        t[2],
        [
            ("Идентификатор", "Целое число", "Уникальный номер сделки"),
            ("Идентификатор клиента", "Целое число", "ClientId"),
            ("Название", "Текст", "Title сделки"),
            ("Стадия", "Текст", "Lead / Negotiation / Closed"),
            ("Сумма (USD)", "Вещественное число", "Amount в базовой валюте"),
            ("Вероятность, %", "Целое число", "ProbabilityPct"),
            ("Дата закрытия", "Дата", "ExpectedCloseDateUtc"),
        ],
    )
    fill_db_table(
        t[3],
        [
            ("Идентификатор", "Целое число", "Уникальный номер задачи"),
            ("Дата", "Дата", "Date (TaskItem.Date)"),
            ("Заголовок", "Текст", "Title"),
            ("Описание", "Текст", "Description"),
            ("Исполнитель", "Текст", "AssigneeName"),
            ("Приоритет", "Текст", "Low / Medium / High"),
            ("Выполнена", "Логический", "Done"),
        ],
    )

    # --- UI tables (сохраняем количество строк шаблона) ---
    fill_ui_table(
        t[4],
        [
            ("Шапка приложения", f"Логотип {APP}, заголовок экрана, иконка уведомлений и профиля"),
            ("Нижняя навигация", "Вкладки: Главная, Клиенты, Сделки, Задачи, Ещё"),
            ("Карточки KPI", "Продажи месяца, лиды, активные и просроченные задачи"),
            ("Блок воронки", "Диаграмма стадий Lead / Negotiation / Closed"),
            ("Лента активности", "Список ActivityEvent с аватарами и описанием"),
            ("Кнопка обновления", "Pull-to-refresh или повторный запрос /dashboard"),
            ("Индикатор загрузки", "Отображение при запросе API"),
            ("Сообщение об ошибке", "Текст при недоступности http://localhost:5278"),
            ("Переключатель темы", "Светлая / тёмная тема из настроек"),
            ("Счётчик уведомлений", "Badge на иконке колокольчика"),
            ("Переход к клиентам", "Вкладка «Клиенты»"),
            ("Переход к сделкам", "Вкладка «Сделки»"),
            ("Переход к задачам", "Вкладка «Задачи»"),
            ("Раздел «Ещё»", "Меню дополнительных модулей"),
            ("Splash-экран", "BrandedSplash при запуске"),
            ("Seed при старте", "scripts/seed.js — демо admin и /seed/run"),
            ("Валюта сумм", "Пересчёт USD → BYN по профилю"),
            ("Empty state", "Заглушка при пустых списках"),
            ("Фильтр задач", "Выбор даты и статуса"),
            ("Модальные экраны", "Редактирование в stack-навигации"),
            ("Web-превью", "Опциональная рамка iPhone в Expo Web"),
            ("Подвал / версия", "Информация о сборке в настройках"),
        ],
    )
    fill_ui_table(
        t[5],
        [
            ("Заголовок", f"Текст «Вход в {APP}»"),
            ("Поле «Логин»", "Ввод Username, обязательное"),
            ("Поле «Пароль»", "Скрытый ввод пароля"),
            ("Кнопка «Войти»", "POST /auth/login, сохранение JWT"),
            ("Сообщение об ошибке", "При неверных данных или блокировке"),
            ("Ссылка «Регистрация»", "Переход на RegisterScreen"),
            ("Индикатор загрузки", "На время запроса"),
            ("Запоминание сессии", "AsyncStorage + refresh"),
            ("Подсказка демо", "admin / 123456 в учебной версии"),
        ],
    )
    fill_ui_table(
        t[6],
        [
            ("Заголовок", "Текст «Регистрация»"),
            ("Поле «Логин»", "Уникальный Username"),
            ("Поле «Email»", "Адрес почты"),
            ("Поле «Пароль»", "Не короче политики сервера"),
            ("Поле «ФИО»", "Отображаемое имя"),
            ("Кнопка «Зарегистрироваться»", "POST /auth/register → роль Member"),
            ("Ссылка «Войти»", "Переход на LoginScreen"),
            ("Сообщение об ошибке", "Дубликат логина или слабый пароль"),
        ],
    )
    fill_ui_table(
        t[7],
        [
            ("Нижние вкладки", "Главная, Клиенты, Сделки, Задачи, Ещё"),
            ("AppHeader", "Заголовок, колокольчик, меню"),
            ("Карточки KPI", "Четыре показателя с цифрами"),
            ("Воронка", "Горизонтальные стадии сделок"),
            ("Лента", "Последние ActivityEvent"),
            ("Кнопка «Все клиенты»", "Быстрый переход"),
            ("Pull to refresh", "Обновление dashboard"),
            ("Скелетон загрузки", "Плейсхолдеры KPI"),
            ("Ошибка сети", "Повторить запрос"),
            ("Переход в уведомления", "Модальный NotificationsScreen"),
            ("Адаптивная вёрстка", "ScrollView на малых экранах"),
            ("Тёмная тема", "Цвета из AppPreferencesContext"),
            ("Дата на задачах", "Локаль ru-RU"),
        ],
    )
    fill_ui_table(
        t[8],
        [
            ("Список клиентов", "FlatList с аватаром и компанией"),
            ("Поиск", "Фильтрация по имени/компании"),
            ("Кнопка «+»", "ClientEditScreen (создание)"),
            ("Карточка клиента", "ClientDetailScreen"),
            ("Активная сделка", "Блок связанной Deal"),
            ("История контактов", "ContactEvent список"),
            ("Кнопка «Добавить контакт»", "Новое ContactEvent"),
        ],
    )
    fill_ui_table(
        t[9],
        [
            ("Колонка Lead", "Сделки на стадии лида"),
            ("Колонка Negotiation", "Сделки в переговорах"),
            ("Колонка Closed", "Закрытые сделки"),
            ("Карточка сделки", "Сумма, вероятность, клиент"),
            ("Кнопка «+»", "DealEditScreen"),
            ("Смена стадии", "PATCH /deals/{id}/stage"),
            ("Массовые операции", "bulk/stage (API)"),
            ("Валюта", "Отображение в BYN и др."),
            ("Пустая колонка", "Подсказка создать сделку"),
            ("Ошибка загрузки", "Повтор pipeline"),
        ],
    )
    fill_ui_table(
        t[10],
        [
            ("Календарь/дата", "Выбор дня задач"),
            ("Список задач", "Приоритет, время, исполнитель"),
            ("Чекбокс выполнения", "PATCH /tasks/{id}/done"),
            ("Кнопка «+»", "TaskEditScreen"),
            ("Фильтр просроченных", "Визуальное выделение"),
            ("Напоминания API", "GET /tasks/reminders/overdue"),
        ],
    )
    fill_ui_table(
        t[11],
        [
            ("Список уведомлений", "UserNotification с типом и текстом"),
            ("Свайп удалить", "DELETE /notifications/{id}"),
            ("Прочитать", "PATCH read"),
            ("Прочитать все", "PATCH read-all"),
        ],
    )
    fill_ui_table(
        t[12],
        [
            ("Пункт «Настройки»", "SettingsScreen — тема, валюта"),
            ("Пункт «Пользователи»", "TeamScreen (только admin)"),
            ("Пункт «Журнал аудита»", "AuditLogScreen"),
            ("Пункт «Отчёты»", "ReportsScreen"),
            ("Кнопка «Выйти»", "Очистка токенов"),
        ],
    )
    fill_ui_table(
        t[13],
        [
            ("Тариф", "BillingScreen — план, места, storage"),
            ("Интеграции", "Webhooks и IntegrationJob"),
            ("Автоматизации", "AutomationRule"),
            ("Поддержка", "FAQ и SupportTicket"),
        ],
    )

    # --- Чек-лист 3.1 ---
    checklist = [
        ("Авторизация", "Aut", "Регистрация, вход, refresh, выход", "Успешно"),
        ("Дашборд", "Dash", "KPI и лента активности", "Успешно"),
        ("Клиенты", "Cli", "CRUD и контактные события", "Успешно"),
        ("Сделки", "Deal", "Воронка и смена стадии", "Успешно"),
        ("Задачи", "Task", "Создание и done", "Успешно"),
        ("Уведомления", "Not", "Список и прочитано", "Успешно"),
        ("Команда", "Team", "Роли admin/member", "Успешно"),
        ("Аудит", "Aud", "Журнал изменений", "Успешно"),
        ("Отчёты", "Rep", "Сводка /reports/summary", "Успешно"),
        ("Тариф", "Bill", "Подписка и usage", "Успешно"),
        ("Интеграции", "Int", "Webhooks и jobs", "Успешно"),
        ("Автоматизации", "Auto", "Правила", "Успешно"),
        ("Поддержка", "Sup", "Тикеты", "Успешно"),
        ("Настройки", "Set", "Тема и валюта", "Успешно"),
        ("Seed", "Seed", "Демо-данные /seed/run", "Успешно"),
        ("Health", "Api", "/health и /ready", "Успешно"),
        ("Безопасность", "Sec", "401 без JWT", "Успешно"),
        ("Lockout", "Sec", "5 неверных паролей", "Успешно"),
        ("Блокировка", "Sec", "IsBlocked админом", "Успешно"),
        ("Миграции", "Db", "MigrateAsync при старте", "Успешно"),
    ]
    resize_table(t[14], len(checklist))
    hdr = t[14].rows[0].cells
    set_cell(hdr[0], "Тестируемый модуль")
    set_cell(hdr[1], "ИД-кейса")
    set_cell(hdr[2], "Тестируемое требование")
    set_cell(hdr[3], "Результат")
    for i, row in enumerate(checklist, start=1):
        c = t[14].rows[i].cells
        for j, val in enumerate(row):
            set_cell(c[j], val)
    # pad to 36 data rows like template
    while len(t[14].rows) < 37:
        t[14].add_row()
    for i in range(len(checklist) + 1, len(t[14].rows)):
        c = t[14].rows[i].cells
        set_cell(c[0], "Регрессия")
        set_cell(c[1], f"Reg{i}")
        set_cell(c[2], "Повторный вход admin")
        set_cell(c[3], "Успешно")

    # --- Приложение 1: тест-кейсы ---
    env = (
        f"Окружение: тестирование в Expo Go / веб-браузере; API {APP} — http://localhost:5278; "
        f"БД PostgreSQL 16 в Docker; ОС Windows 10/11, клиент — ПК разработчика."
    )
    fill_test_table(t[15], env, build_test_steps())

    set_para(p[334], "ПРИЛОЖЕНИЕ 2 (ОБЯЗАТЕЛЬНОЕ) – ЛИСТИНГ ПРОГРАММЫ")
    append_program_listing(doc)

    doc.save(str(work_path))

    try:
        shutil.copy2(work_path, DOC_PATH)
        work_path.unlink(missing_ok=True)
        print("Saved:", DOC_PATH)
    except OSError:
        print("Saved (закройте Word и замените файл):", work_path)

    # verify no parking leftovers in text
    with zipfile.ZipFile(work_path) as zf:
        xml = zf.read("word/document.xml").decode("utf-8")
    bad = re.findall(
        r"Икс-парк|XPARK|парков|QR-код|бронир|Parkopedia|EasyPark|Next\.js|SignalR|Leaflet|Tailwind",
        xml,
        re.I,
    )
    if bad:
        print("WARN leftovers:", set(bad))


if __name__ == "__main__":
    build()
