export type WheelSet = {
  id: string;
  customer_id: string;
  front: string;
  rear: string;
  size: string;
  appointment: string;
  contact: string;
};

export type Availability = {
  id: string;
  size: string;
  units: number;
  confirmed: boolean;
};

export type InitialData = {
  case_id: string;
  data_status: string;
  clock: string;
  wheel_sets: WheelSet[];
  availability: Availability[];
  rules: string[];
};

export type WorkflowState =
  | "Inspection detected"
  | "Proposal generated"
  | "Needs review"
  | "Pending technician approval"
  | "Approved"
  | "Ready for customer message"
  | "Message simulated"
  | "Blocked: insufficient evidence"
  | "Rejected"
  | "No action required";

export type OfferState =
  | "Proposal generated"
  | "Human-corrected proposal"
  | "Technician approved"
  | "Blocked"
  | "Rejected — review required"
  | "No offer"
  | "Message simulated";

export type StockView = {
  availabilityId: string;
  size: string;
  units: number;
  confirmed: boolean;
  source: "reported";
};

export type HistoryKind = "source" | "ai" | "human" | "simulated";

export type HistoryEvent = {
  id: string;
  kind: HistoryKind;
  label: string;
  createdAt?: string;
  source?: string;
  eventType?: string;
  simulated?: boolean;
};

export type ContactChannel = "whatsapp" | "email" | "phone" | "sms";

export type CustomerContact = {
  id: string;
  displayName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  smsAvailable: boolean;
  phoneAvailable: boolean;
  whatsappAvailable: boolean;
  emailAvailable: boolean;
  preferredChannel: ContactChannel | null;
};

export type QueuePriority = "Urgent" | "Review" | "Missing evidence" | "No action";

export type QueueGroup =
  | "Urgent"
  | "Missing evidence"
  | "Awaiting technician"
  | "Awaiting stock"
  | "Ready for customer"
  | "Complete"
  | "No action required";

export type NextActionKind = "approve" | "stock" | "message" | null;

export type ReviewTask = {
  createdAt: number;
  note: string;
};

export type CaseRuntime = {
  quantity: number | null;
  size: string | null;
  aiQuantity: number | null;
  aiSize: string | null;
  note: string;
  humanCorrected: boolean;
  approved: boolean;
  rejected: boolean;
  rejectReason: string;
  messageSimulated: boolean;
  evidenceReviewed: boolean;
  task: ReviewTask | null;
  history: HistoryEvent[];
};

export type RuntimeOverlay = {
  runtimes: Record<string, CaseRuntime>;
  confirmedOverrides: Record<string, boolean>;
  stockEvents: Record<string, boolean>;
};

export type DerivedCase = {
  wheel: WheelSet;
  appointmentDay: number;
  concernSummary: string;
  blockReasons: string[];
  blocked: boolean;
  noAction: boolean;
  reviewTask: string | null;
  stock: StockView | null;
  runtime: CaseRuntime;
  status: WorkflowState;
  offerState: OfferState;
  urgent: boolean;
  whyProposed: string | null;
  priority: QueuePriority;
  queueGroup: QueueGroup;
  uncertainties: string[];
  decisionOwner: string;
  customer: CustomerContact | null;
  availableChannels: ContactChannel[];
  contactLock: string | null;
};

export type QueueGroupView = {
  group: QueueGroup;
  cases: DerivedCase[];
};

export type InsightTone = "urgent" | "bad" | "warn" | "action" | "ok" | "muted";

export type InsightIcon = "alert" | "clock" | "tyre" | "cube" | "mail" | "info" | "check";

export type Insight = {
  id: string;
  caseId: string;
  tone: InsightTone;
  icon: InsightIcon;
  title: string;
  detail: string;
};
