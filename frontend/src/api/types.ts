export type DashboardQuickAction = {
  id: string;
  title: string;
  icon: string;
  gradientIdx: number;
};

export type AuthMeResponse = {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  theme: string;
  currency: string;
  language: string;
  tenantRole: string;
  dashboardQuickActions: DashboardQuickAction[];
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
    avatarHue: number;
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
    avatarHue?: number;
  };
};

export type DealsPipelineResponse = {
  pipelineId?: number;
  totals: { total: number; weighted: number; avg: number };
  stages: Record<DealStage, PipelineDeal[]>;
};

export type SalesPipelineItem = {
  id: number;
  name: string;
  isDefault: boolean;
  createdAtUtc: string;
};

export type DashboardResponse = {
  monthSales: number;
  monthSalesGrowthPct?: number | null;
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
    avatarHue?: number;
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

