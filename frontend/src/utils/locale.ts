import type { DealStage } from '../api/types';

/** Язык интерфейса и форматирования по умолчанию. */
export const APP_LOCALE = 'ru-RU';

/** Приветствие по локальному времени: утро / день / вечер / ночь. */
export function greetingByTimeRu(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function formatDateRu(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString(APP_LOCALE);
}

export function formatDateTimeRu(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(APP_LOCALE);
}

export function dealStageLabel(stage: DealStage): string {
  switch (stage) {
    case 'Lead':
      return 'Лид';
    case 'Negotiation':
      return 'Переговоры';
    case 'Closed':
      return 'Закрыто';
  }
}

export function taskPriorityLabel(priority: 'Low' | 'Medium' | 'High'): string {
  switch (priority) {
    case 'High':
      return 'Высокий';
    case 'Medium':
      return 'Средний';
    case 'Low':
      return 'Низкий';
  }
}

export function teamRoleLabel(role: string): string {
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

export function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
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
    'tasks.delete': 'Удаление задачи',
    'integrations.webhook.create': 'Создание webhook',
    'integrations.job.enqueue': 'Постановка фоновой задачи',
  };
  return map[action] ?? action;
}

export function entityTypeLabel(entityType: string): string {
  const map: Record<string, string> = {
    Client: 'Клиент',
    Deal: 'Сделка',
    Task: 'Задача',
    TaskItem: 'Задача',
    WebhookEndpoint: 'Webhook',
    IntegrationJob: 'Фоновая задача',
  };
  return map[entityType] ?? entityType;
}

export function integrationJobStatusLabel(status: string): string {
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

export function relativeTimeRu(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return formatDateRu(d);
}
