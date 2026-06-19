"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, CheckCircle2, XCircle, Clock, Link2, ClipboardCheck, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { clsx } from "clsx";
import { getInitials } from "@/lib/utils/format";
import { POINTS_MAP } from "@/constants";
import type { EngagementType } from "@/constants";

type SubmissionStatus = "pending" | "approved" | "rejected";

type Submission = {
  id: string;
  employee_id: string;
  employee_name: string;
  engagement_type: string | null;
  platform: string | null;
  post_url: string | null;
  notes: string | null;
  status: SubmissionStatus;
  points_awarded: number;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Employee = { id: string; name: string; email: string };

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  pending:  "bg-amber-900/40 text-amber-300 border-amber-800/40",
  approved: "bg-emerald-900/50 text-emerald-300 border-emerald-800/40",
  rejected: "bg-red-900/40 text-red-400 border-red-800/40",
};

const STATUS_ICONS: Record<SubmissionStatus, React.ElementType> = {
  pending:  Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const ENGAGEMENT_OPTIONS: { value: EngagementType; label: string }[] = [
  { value: "like",    label: "Like" },
  { value: "comment", label: "Comment" },
  { value: "share",   label: "Share" },
  { value: "repost",  label: "Repost" },
  { value: "mention", label: "Mention" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SubmissionsClient({
  initialSubmissions,
  employees,
  orgId,
}: {
  initialSubmissions: Submission[];
  employees: Employee[];
  orgId: string;
}) {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<Submission | null>(null);

  const [submitForm, setSubmitForm] = useState({
    employee_id: "",
    engagement_type: "" as EngagementType | "",
    platform: "" as "linkedin" | "instagram" | "",
    post_url: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    status: "approved" as SubmissionStatus,
    points_awarded: 1,
    reviewer_notes: "",
  });
  const [reviewing, setReviewing] = useState(false);

  const counts = {
    all:      submissions.length,
    pending:  submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  const filtered = statusFilter === "all"
    ? submissions
    : submissions.filter((s) => s.status === statusFilter);

  function handleEngagementTypeChange(type: EngagementType | "") {
    const pts = type ? POINTS_MAP[type] : 1;
    setSubmitForm((f) => ({ ...f, engagement_type: type }));
    setReviewForm((f) => ({ ...f, points_awarded: pts }));
  }

  async function handleSubmit() {
    if (!submitForm.employee_id) { toast.error("Select an employee."); return; }
    if (!submitForm.engagement_type) { toast.error("Select an engagement type."); return; }
    if (!submitForm.platform) { toast.error("Select a platform."); return; }
    if (!submitForm.post_url && !submitForm.notes) { toast.error("Add a post URL or notes."); return; }
    if (!supabase || !orgId) { toast.error("Not connected to database."); return; }
    setSubmitting(true);
    try {
      const emp = employees.find((e) => e.id === submitForm.employee_id);
      const pts = POINTS_MAP[submitForm.engagement_type as EngagementType] ?? 1;
      const { data, error } = await supabase
        .from("manual_submissions")
        .insert({
          org_id: orgId,
          employee_id: submitForm.employee_id,
          engagement_type: submitForm.engagement_type,
          platform: submitForm.platform,
          post_url: submitForm.post_url || null,
          notes: submitForm.notes || null,
          status: "pending",
          points_awarded: pts,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setSubmissions((prev) => [{
        ...data,
        employee_name: emp?.name ?? "Unknown",
      }, ...prev]);
      setSubmitForm({ employee_id: "", engagement_type: "", platform: "", post_url: "", notes: "" });
      setShowSubmitModal(false);
      toast.success("Proof submitted for review.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function openReview(s: Submission) {
    const pts = s.engagement_type
      ? (POINTS_MAP[s.engagement_type as EngagementType] ?? s.points_awarded)
      : s.points_awarded;
    setReviewTarget(s);
    setReviewForm({ status: "approved", points_awarded: pts, reviewer_notes: "" });
  }

  async function handleReview() {
    if (!reviewTarget || !supabase) return;
    setReviewing(true);
    try {
      const { data, error } = await supabase
        .from("manual_submissions")
        .update({
          status: reviewForm.status,
          points_awarded: reviewForm.points_awarded,
          reviewer_notes: reviewForm.reviewer_notes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reviewTarget.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setSubmissions((prev) =>
        prev.map((s) => s.id === reviewTarget.id ? { ...s, ...data } : s)
      );
      setReviewTarget(null);
      toast.success(reviewForm.status === "approved" ? "Submission approved." : "Submission rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setReviewing(false);
    }
  }

  const FILTER_TABS = [
    { id: "all",      label: "All" },
    { id: "pending",  label: "Pending Review" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#111]">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Submissions</h1>
            <p className="text-gray-500 text-sm mt-1">
              Employee advocacy proof — submit and review manual participation
            </p>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Proof
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Pending Review", value: counts.pending,  color: "text-amber-400" },
            { label: "Approved",       value: counts.approved, color: "text-emerald-400" },
            { label: "Rejected",       value: counts.rejected, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/5 mb-6">
          {FILTER_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={clsx(
                "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                statusFilter === id
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              {label}
              {id !== "all" && counts[id as keyof typeof counts] > 0 && (
                <span className={clsx(
                  "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  id === "pending" ? "bg-amber-900/50 text-amber-400" : "opacity-50"
                )}>
                  {counts[id as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-[#1a1a1a] border border-white/5 rounded-xl">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <ClipboardCheck className="w-7 h-7 text-gray-500" />
            </div>
            <p className="text-white font-semibold text-base mb-1">
              {statusFilter === "all" ? "No submissions yet" : `No ${statusFilter} submissions`}
            </p>
            <p className="text-gray-500 text-sm max-w-sm mb-5">
              {statusFilter === "all"
                ? "Manually log employee engagement on official FarMart posts. This is the recommended way to track advocacy until automated sync is live."
                : "No submissions match this filter."}
            </p>
            {statusFilter === "all" && (
              <>
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors mb-4"
                >
                  <Plus className="w-4 h-4" /> Submit Proof
                </button>
                <p className="text-xs text-gray-600 max-w-xs">
                  Once automated sync is configured in Settings, employee engagement will be captured automatically and reflected on the Leaderboard and Dashboard.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Employee", "Platform", "Type", "Post URL", "Notes", "Status", "Points", "Date", ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const StatusIcon = STATUS_ICONS[sub.status];
                  return (
                    <tr key={sub.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-300 text-[10px] font-bold">{getInitials(sub.employee_name)}</span>
                          </div>
                          <span className="text-white font-medium text-sm">{sub.employee_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs capitalize whitespace-nowrap">
                        {sub.platform ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs capitalize whitespace-nowrap">
                        {sub.engagement_type ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {sub.post_url ? (
                          <a
                            href={sub.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                          >
                            <Link2 className="w-3 h-3" />
                            <span className="max-w-[120px] truncate">{sub.post_url.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px]">
                        <span className="line-clamp-1">{sub.notes ?? <span className="text-gray-600">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                          STATUS_STYLES[sub.status]
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">
                        {sub.status === "approved" ? `+${sub.points_awarded}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(sub.created_at)}</td>
                      <td className="px-4 py-3">
                        {sub.status === "pending" && (
                          <button
                            onClick={() => openReview(sub)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors whitespace-nowrap"
                          >
                            Review →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit Proof Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-5">Submit Advocacy Proof</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Employee *</label>
                <select
                  value={submitForm.employee_id}
                  onChange={(e) => setSubmitForm((f) => ({ ...f, employee_id: e.target.value }))}
                  className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-md px-3 h-9 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Platform *</label>
                <select
                  value={submitForm.platform}
                  onChange={(e) => setSubmitForm((f) => ({ ...f, platform: e.target.value as "linkedin" | "instagram" | "" }))}
                  className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-md px-3 h-9 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select platform…</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Engagement Type *</label>
                <select
                  value={submitForm.engagement_type}
                  onChange={(e) => handleEngagementTypeChange(e.target.value as EngagementType | "")}
                  className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-md px-3 h-9 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select type…</option>
                  {ENGAGEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({POINTS_MAP[o.value]} pt{POINTS_MAP[o.value] !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Post URL</label>
                <Input
                  value={submitForm.post_url}
                  onChange={(e) => setSubmitForm((f) => ({ ...f, post_url: e.target.value }))}
                  placeholder="https://linkedin.com/posts/…"
                  className="bg-[#111] border-white/10 text-white h-9 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Notes</label>
                <textarea
                  value={submitForm.notes}
                  onChange={(e) => setSubmitForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Describe the engagement…"
                  rows={2}
                  className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-md px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder:text-gray-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {submitting ? "Submitting…" : "Submit for Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">Review Submission</h2>
            <p className="text-gray-500 text-sm mb-5">
              From <span className="text-white">{reviewTarget.employee_name}</span>
              {reviewTarget.engagement_type && (
                <> · <span className="text-emerald-400 capitalize">{reviewTarget.engagement_type}</span></>
              )}
              {reviewTarget.platform && (
                <> on <span className="text-blue-400 capitalize">{reviewTarget.platform}</span></>
              )}
            </p>

            {reviewTarget.post_url && (
              <a
                href={reviewTarget.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm mb-4 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View submitted post
              </a>
            )}
            {reviewTarget.notes && (
              <div className="bg-[#111] border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-300 mb-5">
                {reviewTarget.notes}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Decision *</label>
                <div className="flex gap-2">
                  {(["approved", "rejected"] as SubmissionStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReviewForm((f) => ({ ...f, status: s }))}
                      className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors",
                        reviewForm.status === s && s === "approved" && "bg-emerald-900/50 border-emerald-600 text-emerald-300",
                        reviewForm.status === s && s === "rejected" && "bg-red-900/40 border-red-700 text-red-300",
                        reviewForm.status !== s && "border-white/10 text-gray-500 hover:text-gray-300"
                      )}
                    >
                      {s === "approved" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {reviewForm.status === "approved" && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">Points to Award</label>
                  <Input
                    type="number"
                    value={reviewForm.points_awarded}
                    onChange={(e) => setReviewForm((f) => ({ ...f, points_awarded: Number(e.target.value) }))}
                    min={0}
                    className="bg-[#111] border-white/10 text-white h-9"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Reviewer Notes (optional)</label>
                <textarea
                  value={reviewForm.reviewer_notes}
                  onChange={(e) => setReviewForm((f) => ({ ...f, reviewer_notes: e.target.value }))}
                  placeholder="Add feedback for the employee…"
                  rows={2}
                  className="w-full bg-[#111] border border-white/10 text-white text-sm rounded-md px-3 py-2 resize-none focus:outline-none focus:border-emerald-500 placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setReviewTarget(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing}
                className={clsx(
                  "px-5 py-2 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors",
                  reviewForm.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-700 hover:bg-red-600"
                )}
              >
                {reviewing ? "Saving…" : reviewForm.status === "approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
