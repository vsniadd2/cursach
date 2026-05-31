const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function formatMonthYearRu(d: Date): string {
  return `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

export function getMondayToFriday(anchor: Date): Date[] {
  const x = new Date(anchor);
  x.setHours(12, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const result: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const cur = new Date(x);
    cur.setDate(x.getDate() + i);
    result.push(cur);
  }
  return result;
}

export function weekdayShortRu(d: Date): string {
  return WEEKDAY_SHORT[d.getDay()];
}

export function shiftMonth(d: Date, delta: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + delta;
  const day = d.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
