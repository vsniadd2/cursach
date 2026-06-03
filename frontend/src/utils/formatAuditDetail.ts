import type { AppLanguage } from './locale';
import type { DealStage } from '../api/types';
import { dealStageLabel, teamRoleLabel } from './locale';

function asDealStage(value: string): DealStage {
  if (value === 'Lead' || value === 'Negotiation' || value === 'Closed') return value;
  return 'Lead';
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function planLabel(code: unknown, language: AppLanguage): string | null {
  const c = str(code);
  if (!c) return null;
  return c.toUpperCase();
}

export function formatAuditDetail(
  action: string,
  beforeJson: string | null,
  afterJson: string | null,
  language: AppLanguage,
): string | null {
  const before = parseJson(beforeJson);
  const after = parseJson(afterJson);

  if (action === 'billing.checkout' || action === 'billing.subscription.update') {
    const from = planLabel(before?.PlanCode ?? before?.planCode, language);
    const to = planLabel(after?.PlanCode ?? after?.planCode, language);
    const receiptNo = str(after?.receiptNumber ?? after?.ReceiptNumber);
    const txnId = str(after?.transactionId ?? after?.TransactionId);
    const parts: string[] = [];
    if (from && to && from !== to) {
      parts.push(language === 'en' ? `Plan: ${from} → ${to}` : `Тариф: ${from} → ${to}`);
    } else if (to) {
      parts.push(language === 'en' ? `Plan: ${to}` : `Тариф: ${to}`);
    }
    const last4 = str(after?.cardLast4 ?? after?.CardLast4);
    if (last4) parts.push(language === 'en' ? `Card ****${last4}` : `Карта ****${last4}`);
    if (receiptNo) parts.push(language === 'en' ? `Receipt ${receiptNo}` : `Чек ${receiptNo}`);
    if (txnId) parts.push(language === 'en' ? `Txn ${txnId}` : `Транзакция ${txnId}`);
    if (parts.length) return parts.join(' · ');
  }

  if (action === 'deals.stage' || action === 'deals.bulk-stage') {
    const from = str(before?.Stage ?? before?.stage);
    const to = str(after?.Stage ?? after?.stage);
    if (from && to) {
      return language === 'en'
        ? `Stage: ${dealStageLabel(asDealStage(from), language)} → ${dealStageLabel(asDealStage(to), language)}`
        : `Стадия: ${dealStageLabel(asDealStage(from), language)} → ${dealStageLabel(asDealStage(to), language)}`;
    }
  }

  if (action === 'tasks.toggle-done' || action === 'tasks.bulk-done') {
    const done = after?.Done ?? after?.done;
    if (typeof done === 'boolean') {
      return language === 'en'
        ? done
          ? 'Marked as done'
          : 'Marked as open'
        : done
          ? 'Отмечена выполненной'
          : 'Снята отметка выполнения';
    }
  }

  if (action === 'team.update-role') {
    const from = str(before?.role);
    const to = str(after?.role);
    if (from && to) {
      return language === 'en'
        ? `Role: ${teamRoleLabel(from, language)} → ${teamRoleLabel(to, language)}`
        : `Роль: ${teamRoleLabel(from, language)} → ${teamRoleLabel(to, language)}`;
    }
  }

  if (action === 'team.block' || action === 'team.unblock') {
    const blocked = after?.isBlocked ?? after?.IsBlocked;
    if (typeof blocked === 'boolean') {
      return language === 'en'
        ? blocked
          ? 'User blocked'
          : 'User unblocked'
        : blocked
          ? 'Пользователь заблокирован'
          : 'Пользователь разблокирован';
    }
  }

  if (action === 'profile.update') {
    const parts: string[] = [];
    const themeFrom = str(before?.UiTheme);
    const themeTo = str(after?.UiTheme);
    if (themeFrom && themeTo && themeFrom !== themeTo) {
      parts.push(language === 'en' ? `Theme: ${themeFrom} → ${themeTo}` : `Тема: ${themeFrom} → ${themeTo}`);
    }
    const curFrom = str(before?.CurrencyCode);
    const curTo = str(after?.CurrencyCode);
    if (curFrom && curTo && curFrom !== curTo) {
      parts.push(language === 'en' ? `Currency: ${curFrom} → ${curTo}` : `Валюта: ${curFrom} → ${curTo}`);
    }
    const langFrom = str(before?.UiLanguage);
    const langTo = str(after?.UiLanguage);
    if (langFrom && langTo && langFrom !== langTo) {
      parts.push(language === 'en' ? `Language: ${langFrom} → ${langTo}` : `Язык: ${langFrom} → ${langTo}`);
    }
    if (parts.length) return parts.join(' · ');
  }

  if (action === 'dashboard.quick-actions.update') {
    return language === 'en' ? 'Quick actions updated' : 'Обновлены быстрые действия';
  }

  if (action.endsWith('.create')) {
    return language === 'en' ? 'Record created' : 'Создана запись';
  }

  if (action.endsWith('.delete')) {
    return language === 'en' ? 'Record deleted' : 'Запись удалена';
  }

  if (action.endsWith('.update')) {
    return language === 'en' ? 'Record updated' : 'Запись обновлена';
  }

  return null;
}
