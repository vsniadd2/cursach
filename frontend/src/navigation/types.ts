import type { NavigatorScreenParams } from '@react-navigation/native';

export type DealsStackParamList = {
  DealsPipeline: undefined;
  ClientDetail: { clientId: number };
  DealEdit: { dealId?: number; clientId?: number } | undefined;
};

export type ClientsStackParamList = {
  /** Список клиентов (имя отличается от вкладки `Clients`, чтобы не дублировать маршруты). */
  ClientsList: undefined;
  ClientDetail: { clientId: number };
  ClientEdit: { clientId?: number } | undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  MoreSettings: undefined;
  MoreTeam: undefined;
  MoreReports: undefined;
  MoreSupport: undefined;
  MoreBilling: undefined;
  MoreIntegrations: undefined;
  MoreAutomations: undefined;
  MoreAuditLog: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Clients: NavigatorScreenParams<ClientsStackParamList>;
  Deals: NavigatorScreenParams<DealsStackParamList>;
  Tasks: undefined;
  More: NavigatorScreenParams<MoreStackParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<MainTabParamList>;
  TaskEdit: { taskId?: number; presetTitle?: string } | undefined;
  Notifications: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
