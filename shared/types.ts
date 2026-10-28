// Types and constants shared by the API server and the web client.

export const STATUSES = ['new', 'in_progress', 'resolved', 'dismissed'] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  'Facilities',
  'IT & Network',
  'Safety',
  'Food',
  'Transport',
  'Services',
  'Policy',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Identity colours a box can take (the categorical chart palette, light steps). */
export const BOX_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const;

export type ProblemSource = 'web' | 'demo' | 'sample';

export interface User {
  id: number;
  name: string;
  email: string;
  org: string;
  demoFeed: boolean;
  createdAt: number;
}

export interface Box {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  isOpen: boolean;
  createdAt: number;
  total: number;
  open: number;
  resolved: number;
  lastProblemAt: number | null;
}

export interface Problem {
  id: number;
  boxId: number;
  boxName: string;
  boxColor: string;
  title: string;
  body: string;
  category: Category;
  priority: Priority;
  status: Status;
  author: string | null;
  contact: string | null;
  source: ProblemSource;
  autoFlag: string | null;
  createdAt: number;
  updatedAt: number;
  firstResponseAt: number | null;
  resolvedAt: number | null;
}

export type ProblemEvent =
  | { id: number; kind: 'created'; at: number; actor: string | null }
  | { id: number; kind: 'status'; at: number; actor: string | null; from: Status; to: Status }
  | { id: number; kind: 'priority'; at: number; actor: string | null; from: Priority; to: Priority }
  | { id: number; kind: 'category'; at: number; actor: string | null; from: Category; to: Category }
  | { id: number; kind: 'note'; at: number; actor: string | null; text: string };

export interface ProblemList {
  items: Problem[];
  total: number;
  counts: Record<Status | 'all', number>;
}

export interface Analytics {
  range: number;
  from: number;
  to: number;
  kpis: {
    received: number;
    receivedPrev: number;
    resolved: number;
    resolvedPrev: number;
    /** Resolved ÷ received in the period. Above 1 means the backlog is shrinking. */
    clearanceRate: number | null;
    clearanceRatePrev: number | null;
    /** Median hours from received → resolved, for problems resolved in the period. */
    medianResolveHours: number | null;
    medianResolveHoursPrev: number | null;
    /** Median hours from received → first action (status change or note). */
    medianFirstResponseHours: number | null;
    medianFirstResponseHoursPrev: number | null;
    openNow: number;
    newNow: number;
    urgentOpen: number;
  };
  daily: { date: string; received: number; resolved: number }[];
  byCategory: { category: Category; count: number; open: number }[];
  byBox: { boxId: number; name: string; color: string; count: number; open: number; resolved: number }[];
  /** Received problems by weekday (0 = Monday) × hour (0–23), viewer's local time. */
  heatmap: number[][];
  backlogByPriority: { priority: Priority; count: number }[];
}

export interface PublicBox {
  name: string;
  slug: string;
  description: string;
  color: string;
  org: string;
  isOpen: boolean;
}
