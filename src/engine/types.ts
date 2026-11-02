import type { Bucket, Component, DatasetKey } from './glossary';
import type { Row } from './util';

export interface ColumnMapping {
  source: string;
  target: string | null;
  confidence: number; // 0..1
  reason: string;
  method: 'rule' | 'ai' | 'user';
  confirmed: boolean;
}

export interface DatasetState {
  key: DatasetKey;
  fileName: string;
  uploadedAt: string; // ISO datetime
  rawCount: number;
  rows: Row[];
  mapping: ColumnMapping[];
  text?: string; // for text datasets (SPA)
  piiMasked?: { fields: string[]; originalRows: number };
  ingestNotes?: string[];
}

export type IssueType = 'missing' | 'duplicate' | 'lookalike' | 'broken_link' | 'stale' | 'orphan';

export interface Suggestion {
  value: string;
  reason: string;
  source: 'rule' | 'ai' | 'fallback';
  confidence: number;
  model?: string;
}

export interface Issue {
  id: string;
  dataset: DatasetKey;
  rid: string;
  type: IssueType;
  field?: string;
  label: string; // human readable record label
  message: string;
  relatedRid?: string;
  suggestion?: Suggestion;
  status: 'open' | 'resolved' | 'dismissed';
  resolution?: string;
}

export interface OwnerItem {
  id: string;
  question: string;
  context: string;
  owner: string;
  role: string;
  due: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'open' | 'answered' | 'escalated';
  answer?: string;
  issueId?: string;
  createdAt: string;
}

export type LinkType = 'runs_on' | 'connects_via' | 'requires_licence' | 'data_flow' | 'uses_seller_service';
export type Ownership = 'buyer' | 'shared' | 'seller';

export interface ManualLink {
  id: string;
  from: string;
  to: string;
  type: LinkType;
  source: 'questionnaire' | 'ai' | 'manual' | 'trial_run';
  status: 'suggested' | 'confirmed' | 'rejected' | 'unclear';
  reason?: string;
  confidence?: number;
}

export interface AppOverride {
  bucket?: Bucket;
  bucketReason?: string;
  component?: Component;
  componentConfirmed?: boolean;
  C?: number; R?: number; S?: number;
}

export interface DecisionState {
  status: 'pending' | 'approved' | 'changes_requested';
  summary?: string;
  summarySource?: string;
  comment?: string;
  approvedAt?: string;
  approvedBy?: string;
  chosen?: string;
}

export type PatchOp = { path: (string | number)[]; op: 'set' | 'insert' | 'remove'; before?: any; after?: any; index?: number };

export interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  action: string;
  detail: string;
  kind: 'approve' | 'override' | 'ai' | 'data' | 'system' | 'access' | 'escalate';
  /** Screen where the decision was taken (for module decision logs). */
  module?: string;
  /** Inverse-able change set; present when the action can be undone. */
  patch?: PatchOp[];
  undone?: boolean;
  undoOf?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  sources?: string[];
  model?: string;
  feedback?: 'helpful' | 'not_helpful';
}

export interface FundingPackage {
  id: string;
  createdAt: string;
  bridge: { amount: number; months: number; rate: number; monthly: number };
  escrow: { amount: number; fee: number };
  lease: { amount: number; months: number; monthly: number };
  recommendation: string;
  status: 'draft' | 'shared_with_bank' | 'approved';
}

export interface LearningDraft {
  id: string;
  answers: { worked: string; didNot: string; day1OnTime: string; tsaExtended: string; lesson: string };
  record?: { id: string; summary: string; industry: string; dealType: string; appsBand: string; sizeBand: string; keyLesson: string; hiddenTerms: string[] };
  status: 'draft' | 'anonymised' | 'approved' | 'saved' | 'blocked';
  stewardNote?: string;
}

export type RoleKey = 'pwc_manager' | 'pwc_consultant' | 'client_leader' | 'seller_it' | 'bank';

export interface Config {
  priorityWeights: { C: number; D: number; R: number; S: number };
  day1Threshold: number; // PI >= -> Day-1 critical
  readinessWeights: { tasks: number; tests: number; hygiene: number };
  goThreshold: number; conditionsThreshold: number; blockerCap: number;
  hygieneGate: number;
  staleMonths: number;
  optionWeights: { security: number; productivity: number; cost: number; speed: number };
  securityFloor: number;
  costSplitWeights: { cause: number; likeForLike: number; contract: number };
  componentWeights: Record<string, number>;
  bridgeRate: number; leaseRate: number; escrowFeePct: number;
}

export interface FundingFlow {
  costId: string;
  step1?: { text: string; source: string };
  step2?: { text: string; source: string };
  /** Set when the bank funding plan is agreed (bank loan + escrow). */
  path?: 'underwriting';
  decidedBy?: string;
  a1?: { pack: string; source: string; approved: boolean };
  a2?: { fields: Record<string, boolean>; consented: boolean; independence: boolean };
  a3?: { questions: { q: string; answer?: string; sent?: boolean }[]; decision?: 'approved' | 'approved_with_conditions' | 'declined'; conditions?: string };
  a4?: { released: boolean[]; updates: string[] };
  settle?: { sellerPct: number; method: 'spa' | 'negotiated'; quote?: string; summary?: string; source?: string; settled: boolean };
  learn?: { lesson: string; source: string; saved: boolean };
}

export interface DealInfo {
  id: string; name: string; buyer: string; seller: string; dealType: string; industry: string;
  asOf: string; day1: string; sites: string[];
  /** 'day1' = Day-1 readiness deal (Rioja); 'tsa_exit' = post-close TSA exit deal (Phoenix). */
  mode: 'day1' | 'tsa_exit';
  milestoneLabel: string;
  closeDate?: string;
  scope?: string;
}

export interface WorkspaceState {
  version: number;
  deal: DealInfo;
  datasets: Partial<Record<DatasetKey, DatasetState>>;
  issues: Issue[];
  ownerQueue: OwnerItem[];
  links: ManualLink[];
  appOverrides: Record<string, AppOverride>;
  decisions: Record<string, DecisionState>;
  waveOverrides: Record<string, number>;
  waveReleased: Record<string, boolean>;
  waveChecklist: Record<string, boolean[]>;
  funding: { packages: FundingPackage[]; flows?: Record<string, FundingFlow>; spaReading?: { lines: Record<string, { answer: string; quote: string; confirmed: boolean }>; source: string } };
  learning: LearningDraft[];
  chat: ChatMessage[];
  consents: Record<string, 'Granted' | 'Pending' | 'Not granted'>;
  controls: { maskPII: boolean; humanApproval: boolean; crossDealTraining: boolean };
  retention: string;
  users: { name: string; role: RoleKey; title: string }[];
  currentUser: string;
  role: RoleKey;
  config: Config;
  audit: AuditEvent[];
  readNotifications: string[];
  dismissedNotice: boolean;
  aiCache: Record<string, { text: string; source: string; at: string }>;
}
