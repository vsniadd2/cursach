import type { DealStage } from '../api/types';

export type AppLanguage = 'ru' | 'en';

export const DEAL_STAGES: readonly DealStage[] = ['Lead', 'Negotiation', 'Closed'];

/** Язык интерфейса и форматирования по умолчанию. */
export const DEFAULT_APP_LANGUAGE: AppLanguage = 'ru';

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'ru';
}

export function localeTagFor(language: AppLanguage): string {
  return language === 'en' ? 'en-US' : 'ru-RU';
}

/** @deprecated используйте localeTagFor(language) */
export const APP_LOCALE = localeTagFor(DEFAULT_APP_LANGUAGE);

/** Приветствие по локальному времени. */
export function greetingByTime(date: Date = new Date(), language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const hour = date.getHours();
  if (language === 'en') {
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    if (hour >= 18 && hour < 23) return 'Good evening';
    return 'Good night';
  }
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

/** @deprecated используйте greetingByTime(date, language) */
export function greetingByTimeRu(date: Date = new Date()): string {
  return greetingByTime(date, 'ru');
}

export function formatDate(value: Date | string | number, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString(localeTagFor(language));
}

export function formatDateTime(value: Date | string | number, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(localeTagFor(language));
}

export function formatDateRu(value: Date | string | number): string {
  return formatDate(value, 'ru');
}

export function formatDateTimeRu(value: Date | string | number): string {
  return formatDateTime(value, 'ru');
}

/** Формат изменения в процентах: +12,5% / -3,2% */
export function formatGrowthPct(value: number, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const formatted = new Intl.NumberFormat(localeTagFor(language), {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
  return formatted;
}

export function dealStageLabel(stage: DealStage, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  if (language === 'en') {
    switch (stage) {
      case 'Lead':
        return 'Lead';
      case 'Negotiation':
        return 'Negotiation';
      case 'Closed':
        return 'Closed';
    }
  }
  switch (stage) {
    case 'Lead':
      return 'Лид';
    case 'Negotiation':
      return 'Переговоры';
    case 'Closed':
      return 'Закрыто';
  }
}

export function taskPriorityLabel(
  priority: 'Low' | 'Medium' | 'High',
  language: AppLanguage = DEFAULT_APP_LANGUAGE,
): string {
  if (language === 'en') {
    switch (priority) {
      case 'High':
        return 'High';
      case 'Medium':
        return 'Medium';
      case 'Low':
        return 'Low';
    }
  }
  switch (priority) {
    case 'High':
      return 'Высокий';
    case 'Medium':
      return 'Средний';
    case 'Low':
      return 'Низкий';
  }
}

export function teamRoleLabel(role: string, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  if (language === 'en') {
    switch (role) {
      case 'Admin':
        return 'Administrator';
      case 'Member':
        return 'Member';
      case 'Owner':
        return 'Owner';
      case 'Viewer':
        return 'Viewer';
      default:
        return role;
    }
  }
  switch (role) {
    case 'Admin':
      return 'Администратор';
    case 'Member':
      return 'Пользователь';
    case 'Owner':
      return 'Владелец';
    case 'Viewer':
      return 'Наблюдатель';
    default:
      return role;
  }
}

export function auditActionLabel(action: string, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const mapRu: Record<string, string> = {
    'clients.create': 'Создание клиента',
    'clients.update': 'Изменение клиента',
    'clients.delete': 'Удаление клиента',
    'deals.create': 'Создание сделки',
    'deals.update': 'Изменение сделки',
    'deals.stage': 'Смена стадии сделки',
    'deals.delete': 'Удаление сделки',
    'deals.bulk-stage': 'Массовая смена стадии',
    'tasks.create': 'Создание задачи',
    'tasks.update': 'Изменение задачи',
    'tasks.toggle-done': 'Статус задачи',
    'tasks.bulk-done': 'Массовое выполнение задач',
    'tasks.delete': 'Удаление задачи',
    'pipelines.create': 'Создание воронки',
    'pipelines.delete': 'Удаление воронки',
    'billing.subscription.update': 'Смена тарифа',
    'billing.checkout': 'Оплата подписки',
    'team.update-role': 'Смена роли',
    'team.block': 'Блокировка пользователя',
    'team.unblock': 'Разблокировка пользователя',
    'ai.advisor.query': 'Запрос к ИИ-советнику',
    'support.ticket.create': 'Обращение в поддержку',
    'profile.update': 'Изменение настроек',
    'dashboard.quick-actions.update': 'Быстрые действия',
    'integrations.webhook.create': 'Создание webhook',
    'integrations.job.enqueue': 'Постановка фоновой задачи',
  };
  const mapEn: Record<string, string> = {
    'clients.create': 'Client created',
    'clients.update': 'Client updated',
    'clients.delete': 'Client deleted',
    'deals.create': 'Deal created',
    'deals.update': 'Deal updated',
    'deals.stage': 'Deal stage changed',
    'deals.delete': 'Deal deleted',
    'deals.bulk-stage': 'Bulk stage update',
    'tasks.create': 'Task created',
    'tasks.update': 'Task updated',
    'tasks.toggle-done': 'Task status changed',
    'tasks.bulk-done': 'Bulk task update',
    'tasks.delete': 'Task deleted',
    'pipelines.create': 'Pipeline created',
    'pipelines.delete': 'Pipeline deleted',
    'billing.subscription.update': 'Plan changed',
    'billing.checkout': 'Subscription payment',
    'team.update-role': 'Role changed',
    'team.block': 'User blocked',
    'team.unblock': 'User unblocked',
    'ai.advisor.query': 'AI advisor query',
    'support.ticket.create': 'Support ticket created',
    'profile.update': 'Settings updated',
    'dashboard.quick-actions.update': 'Quick actions updated',
    'integrations.webhook.create': 'Webhook created',
    'integrations.job.enqueue': 'Background job enqueued',
  };
  const map = language === 'en' ? mapEn : mapRu;
  return map[action] ?? action;
}

export function entityTypeLabel(entityType: string, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const mapRu: Record<string, string> = {
    Client: 'Клиент',
    Deal: 'Сделка',
    Task: 'Задача',
    TaskItem: 'Задача',
    SalesPipeline: 'Воронка',
    BillingSubscription: 'Подписка',
    TenantMembership: 'Участник',
    AppUser: 'Пользователь',
    AiAdvisor: 'ИИ-советник',
    SupportTicket: 'Тикет',
    WebhookEndpoint: 'Webhook',
    IntegrationJob: 'Фоновая задача',
  };
  const mapEn: Record<string, string> = {
    Client: 'Client',
    Deal: 'Deal',
    Task: 'Task',
    TaskItem: 'Task',
    SalesPipeline: 'Pipeline',
    BillingSubscription: 'Subscription',
    TenantMembership: 'Member',
    AppUser: 'User',
    AiAdvisor: 'AI advisor',
    SupportTicket: 'Ticket',
    WebhookEndpoint: 'Webhook',
    IntegrationJob: 'Background job',
  };
  const map = language === 'en' ? mapEn : mapRu;
  return map[entityType] ?? entityType;
}

export function integrationJobStatusLabel(status: string, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  if (language === 'en') {
    switch (status) {
      case 'Pending':
        return 'Pending';
      case 'Processing':
        return 'Processing';
      case 'Succeeded':
        return 'Succeeded';
      case 'Failed':
        return 'Failed';
      default:
        return status;
    }
  }
  switch (status) {
    case 'Pending':
      return 'В очереди';
    case 'Processing':
      return 'Выполняется';
    case 'Succeeded':
      return 'Успешно';
    case 'Failed':
      return 'Ошибка';
    default:
      return status;
  }
}

export function notificationIcon(type: string): 'assignment-late' | 'today' | 'priority-high' | 'sync-alt' | 'event' | 'admin-panel-settings' | 'block' | 'notifications' {
  switch (type) {
    case 'TaskOverdue':
      return 'assignment-late';
    case 'TaskDueToday':
      return 'today';
    case 'TaskHighPriority':
      return 'priority-high';
    case 'DealStageChanged':
      return 'sync-alt';
    case 'DealClosingSoon':
      return 'event';
    case 'TeamRoleChanged':
      return 'admin-panel-settings';
    case 'TeamBlocked':
      return 'block';
    default:
      return 'notifications';
  }
}

export function relativeTime(value: Date | string | number, language: AppLanguage = DEFAULT_APP_LANGUAGE): string {
  const d = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (language === 'en') {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d ago`;
    return formatDate(d, language);
  }
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return formatDate(d, language);
}

/** @deprecated используйте relativeTime(value, language) */
export function relativeTimeRu(value: Date | string | number): string {
  return relativeTime(value, 'ru');
}
