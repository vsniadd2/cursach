export type AuthMeResponse = {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  theme: string;
  currency: string;
  tenantRole: string;
};

export type DealStage = 'Lead' | 'Negotiation' | 'Closed';

export type ClientsListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: number;
    fullName: string;
    company: string;
    roleTitle: string | null;
    avatarSmallUrl: string | null;
    createdAtUtc: string;
  }>;
};

export type PipelineDeal = {
  id: number;
  title: string;
  stage: DealStage;
  amount: number;
  probabilityPct: number;
  client: {
    clientId: number;
    fullName: string;
    company: string;
    avatarSmallUrl: string | null;
  };
};

export type DealsPipelineResponse = {
  totals: { total: number; weighted: number; avg: number };
  stages: Record<DealStage, PipelineDeal[]>;
};

export type DashboardResponse = {
  monthSales: number;
  newLeads: number;
  activeTasks: number;
  overdueTasks?: number;
  dealsByStage?: {
    countByStage: Record<DealStage, number>;
    sumByStage: Record<DealStage, number>;
  };
  activities: Array<{
    id: number;
    title: string;
    description: string;
    avatarUrl: string | null;
    badgeIcon: string | null;
    createdAtUtc: string;
  }>;
};

export type TasksResponse = {
  date: string;
  done: number;
  total: number;
  items: Array<{
    id: number;
    date?: string;
    title: string;
    description: string | null;
    assigneeName: string | null;
    time: string | null;
    priority: 'Low' | 'Medium' | 'High';
    done: boolean;
    createdAtUtc?: string;
  }>;
};

export type ClientDetailResponse = {
  client: {
    id: number;
    fullName: string;
    company: string;
    roleTitle: string | null;
    phone: string | null;
    workEmail: string | null;
    avatarLargeUrl: string | null;
    avatarSmallUrl: string | null;
    createdAtUtc?: string;
  };
  activeDeal: {
    id: number;
    title: string;
    stage: DealStage;
    amount: number;
    probabilityPct: number;
    expectedCloseDateUtc: string | null;
    decisionMaker: string | null;
  } | null;
  events: Array<{
    id: number;
    title: string;
    body: string | null;
    occurredAtUtc: string;
  }>;
};

export type NotificationType =
  | 'TaskOverdue'
  | 'TaskDueToday'
  | 'TaskHighPriority'
  | 'DealStageChanged'
  | 'DealClosingSoon'
  | 'TeamRoleChanged'
  | 'TeamBlocked';

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAtUtc: string;
};

export type NotificationsResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

