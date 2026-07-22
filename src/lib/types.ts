/** Types mirroring the backend's Part B (employee-side) response shapes. */

export type Role = "owner_admin" | "manager" | "employee";
export type PaceLabel = "light" | "steady" | "heavy" | "unclear";
export type PostType = "knowledge" | "sharing";

export interface TokenPair { access_token: string; refresh_token: string; token_type: string }

export interface Me {
  id: number; email: string; full_name: string | null; role: Role;
  team_id: number | null; avatar_url: string | null; joined_at: string;
}
export interface TeamInfo { id: number; name: string }
export interface CompanyInfo { id: number; name: string; logo_url: string | null; timezone: string }

export interface AttendanceStatus {
  checked_in: boolean; session_id: number | null; check_in_at: string | null; checked_in_outside_desk: boolean;
  late_minutes: number | null;
  on_break: boolean;
  break_started_at: string | null;
  total_break_minutes_today: number;
  deducted_minutes_today: number;
  working_outside_today: boolean;
  actual_working_minutes_today: number;
  work_outside_available: boolean;
  report_submitted_today: boolean;
  pending_presence_check_id: number | null;
}
export interface AttendanceSession {
  id: number; user_id: number; check_in_at: string; check_out_at: string | null;
  checked_in_outside_desk: boolean;
  late_minutes: number | null;
  early_checkout_minutes: number | null;
}
export interface LeaveRequest {
  id: number; type: string; start_date: string; end_date: string;
  status: "pending" | "approved" | "rejected"; requested_at: string;
  start_time: string | null;
  end_time: string | null;
}

export interface Project { id: number; name: string; description: string | null; active: boolean }
export interface Report {
  id: number; user_id: number; project_id: number | null; hours: number; summary: string;
  report_date: string; editable_until: string; created_at: string;
}
export interface ReportDetail extends Report {
  employee_name?: string | null; project_name?: string | null;
  /** Mid+ plan feature — null/absent on Startup-tier companies. */
  ai_analysis: { pace_label: PaceLabel; reasoning: string; model_version: string } | null;
  comments: { id: number; author_id: number; comment: string; created_at: string }[];
}

export interface Overtime {
  id: number; project_id: number | null; initiated_by: "self" | "manager";
  start_at: string; end_at: string | null; hours: number | null;
  summary: string | null; ai_summary: string | null;
  reason: string | null; request_id: number | null;
}

export interface OvertimeRequest {
  id: number;
  user_id: number;
  requested_date: string;
  planned_start_time: string;
  planned_end_time: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
}

export interface HealthLog { id: number; type: string; value: number; logged_at: string }
export interface HealthDashboard {
  water: { value: number; logged_at: string }[];
  mood: { value: number; logged_at: string }[];
  sleep: { value: number; logged_at: string }[];
}

export interface KnowledgePost {
  id: number; title: string; body?: string; category: string | null;
  pinned: boolean; must_acknowledge: boolean; created_at?: string;
  post_type: PostType;
}
export interface FeedbackTicket {
  id: number; category: string; message: string; status: string;
  anonymous: boolean; created_at: string;
}
export interface Certificate {
  id: number; period_type: "monthly" | "yearly"; period_start: string;
  period_end: string; pdf_url: string | null;
}
export interface Recognition { id: number; reason: string; created_at: string; report_id: number | null }
export interface ChecklistItem {
  id: number; title: string; type: "task" | "read" | "watch"; required: boolean; completed: boolean;
}
export interface Notification {
  id: number; category: string; title: string; body: string;
  read_at: string | null; created_at: string;
  extra_data?: Record<string, string> | null;
}
export interface NotificationPreferences { muted_categories: string[]; non_mutable_categories: string[] }

// ---------- payroll invoicing ----------
// Named PayrollInvoice, not Invoice -- no naming collision risk exists on
// mobile the way it did on the dashboard (there's no Stripe billing type
// here), but kept the same name across platforms for consistency.
export interface PayrollInvoice {
  id: number; user_id: number;
  period_start: string; period_end: string;
  hourly_fee: number; total_hours: number; total_amount: number;
  actual_working_hours: boolean;
  pdf_url: string | null; generated_at: string;
}