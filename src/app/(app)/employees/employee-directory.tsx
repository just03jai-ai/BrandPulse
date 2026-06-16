"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UserPlus,
  Upload,
  Search,
  Pencil,
  Trash2,
  X,
  Database,
  Link2,
  Camera,
  ThumbsUp,
  MessageSquare,
  Share2,
  Repeat2,
  CloudUpload,
  CheckCircle2,
} from "lucide-react";
import type { Employee } from "@/types/database";
import Papa from "papaparse";
import { clsx } from "clsx";

const STORAGE_KEY = "brandpulse_employees";

const DEPARTMENTS = [
  "Marketing",
  "Sales",
  "Engineering",
  "Operations",
  "Design",
  "HR",
  "Finance",
];

const DEPT_COLORS: Record<string, string> = {
  Marketing: "bg-emerald-900/50 text-emerald-300",
  Sales: "bg-blue-900/50 text-blue-300",
  Engineering: "bg-orange-900/50 text-orange-300",
  Operations: "bg-purple-900/50 text-purple-300",
  Design: "bg-pink-900/50 text-pink-300",
  HR: "bg-teal-900/50 text-teal-300",
  Finance: "bg-violet-900/50 text-violet-300",
};

const LEVEL_COLORS: Record<string, string> = {
  Newcomer: "bg-gray-800 text-gray-400",
  "Rising Star": "bg-amber-900/60 text-amber-300",
  Champion: "bg-blue-900/60 text-blue-300",
  Legend: "bg-yellow-900/60 text-yellow-300",
  Ambassador: "bg-violet-900/60 text-violet-300",
};

type EmployeeWithIG = Employee & { instagram_handle?: string | null };

interface EmployeeFormData {
  name: string;
  email: string;
  department: string;
  title: string;
  linkedin_url: string;
  instagram_handle: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: "",
  email: "",
  department: "",
  title: "",
  linkedin_url: "",
  instagram_handle: "",
};

function makeLocalEmployee(form: EmployeeFormData): EmployeeWithIG {
  return {
    id: crypto.randomUUID(),
    org_id: "local",
    name: form.name,
    email: form.email,
    department: form.department || null,
    title: form.title || null,
    linkedin_url: form.linkedin_url || null,
    linkedin_id: null,
    instagram_handle: form.instagram_handle || null,
    avatar_url: null,
    total_points: 0,
    level: "Newcomer",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function loadLocal(): EmployeeWithIG[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(employees: EmployeeWithIG[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formFromEmployee(editing: EmployeeWithIG | null): EmployeeFormData {
  return editing
    ? {
        name: editing.name,
        email: editing.email,
        department: editing.department ?? "",
        title: editing.title ?? "",
        linkedin_url: editing.linkedin_url ?? "",
        instagram_handle: editing.instagram_handle ?? "",
      }
    : EMPTY_FORM;
}

// ── CSV Upload Modal ──────────────────────────────────────────────────────────

type CsvStep = "select" | "preview" | "success";

interface CsvModalProps {
  open: boolean;
  onClose: () => void;
  existingEmails: Set<string>;
  onImport: (rows: EmployeeFormData[], newCount: number, existCount: number) => Promise<void>;
}

function CsvUploadModal({ open, onClose, existingEmails, onImport }: CsvModalProps) {
  const [step, setStep] = useState<CsvStep>("select");
  const [preview, setPreview] = useState<EmployeeFormData[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resultCounts, setResultCounts] = useState({ newCount: 0, existCount: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const newCount = preview.filter((r) => !existingEmails.has(r.email)).length;
  const existCount = preview.filter((r) => existingEmails.has(r.email)).length;

  function parseFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) => ({
          name: row["name"] || row["Name"] || row["Full Name"] || "",
          email: row["email"] || row["Email"] || "",
          department: row["department"] || row["Department"] || "",
          title: row["title"] || row["Title"] || row["Job Title"] || "",
          linkedin_url: row["linkedin_url"] || row["LinkedIn URL"] || row["LinkedIn"] || "",
          instagram_handle:
            row["instagram_handle"] || row["Instagram"] || row["Instagram Handle"] || "",
        }));
        const valid = rows.filter((r) => r.name && r.email);
        if (valid.length === 0) {
          toast.error("No valid rows. CSV needs 'name' and 'email' columns.");
          return;
        }
        setPreview(valid);
        setStep("preview");
      },
      error: () => toast.error("Failed to parse CSV."),
    });
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file.");
      return;
    }
    parseFile(file);
  }

  async function handleImport() {
    setImporting(true);
    setResultCounts({ newCount, existCount });
    await onImport(preview, newCount, existCount);
    setImporting(false);
    setStep("success");
  }

  function handleClose() {
    setStep("select");
    setPreview([]);
    setImporting(false);
    onClose();
  }

  const STEP_LABELS = ["Import Employee Directory", "Review Import", "Import Complete"];
  const stepIndex = step === "select" ? 0 : step === "preview" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-lg">
              {STEP_LABELS[stepIndex]}
            </DialogTitle>
            {step !== "success" && (
              <span className="text-xs text-gray-500 font-medium">
                Step {stepIndex + 1} of 3
              </span>
            )}
          </div>

          {/* Step progress dots */}
          <div className="flex items-center gap-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={clsx(
                  "h-1 rounded-full transition-all",
                  i === stepIndex
                    ? "bg-emerald-500 w-6"
                    : i < stepIndex
                    ? "bg-emerald-800 w-3"
                    : "bg-white/10 w-3"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        {/* ── Step 1: Import Employee Directory ── */}
        {step === "select" && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-emerald-500 bg-emerald-950/20"
                  : "border-white/10 hover:border-white/20 hover:bg-white/5"
              )}
            >
              <CloudUpload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-medium">
                Drag & drop your CSV file here
              </p>
              <p className="text-xs text-gray-600 mt-1.5">or click to browse</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-gray-600 text-center">
              Required columns:{" "}
              <span className="text-gray-500">name, email</span>
              {" · "}
              <span className="text-gray-600">optional: department, title, linkedin_url, instagram_handle</span>
            </p>
          </div>
        )}

        {/* ── Step 2: Review Import ── */}
        {step === "preview" && (
          <div className="space-y-4 py-2">
            {/* Stats */}
            <div className="flex items-stretch gap-3">
              <div className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white">{preview.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
              </div>
              <div className="flex-1 bg-amber-950/40 border border-amber-800/30 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-amber-300">{existCount}</p>
                <p className="text-xs text-amber-600 mt-0.5">Already exist</p>
              </div>
              <div className="flex-1 bg-emerald-950/40 border border-emerald-800/30 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-300">{newCount}</p>
                <p className="text-xs text-emerald-700 mt-0.5">New employees</p>
              </div>
            </div>

            {/* Preview table */}
            <div className="max-h-52 overflow-y-auto rounded-xl bg-[#111] border border-white/5">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#1a1a1a]">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Name</th>
                    <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Email</th>
                    <th className="text-left px-3 py-2.5 text-gray-500 font-semibold">Department</th>
                    <th className="px-3 py-2.5 text-gray-500 font-semibold w-14 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2 text-white font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-gray-400">{row.email}</td>
                      <td className="px-3 py-2 text-gray-400">{row.department || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {existingEmails.has(row.email) ? (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-900/40 text-amber-300">
                            update
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-900/40 text-emerald-300">
                            new
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setStep("select");
                  setPreview([]);
                }}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {importing ? "Importing…" : `Import ${preview.length} Employees`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Import Complete ── */}
        {step === "success" && (
          <div className="py-10 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white">Import Complete!</p>
            <p className="text-sm text-gray-400">
              <span className="text-emerald-300 font-medium">{resultCounts.newCount} added</span>
              {" · "}
              <span className="text-amber-300 font-medium">{resultCounts.existCount} updated</span>
            </p>
            <button
              onClick={handleClose}
              className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors inline-block"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Employee Form Modal ───────────────────────────────────────────────────────

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  editing: EmployeeWithIG | null;
  onSave: (form: EmployeeFormData) => Promise<void>;
}

function EmployeeFormModal({ open, onClose, editing, onSave }: FormModalProps) {
  const [form, setForm] = useState<EmployeeFormData>(() => formFromEmployee(editing));
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {editing ? "Edit Employee" : "Add Employee"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">
              Full Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Jane Smith"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">
              Work Email <span className="text-red-400">*</span>
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@company.com"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs font-medium">Department</Label>
              <select
                value={form.department}
                onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="w-full h-9 bg-[#111] border border-white/10 text-sm rounded-md px-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs font-medium">Job Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brand Manager"
                className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">LinkedIn Profile URL</Label>
            <Input
              value={form.linkedin_url}
              onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              placeholder="https://linkedin.com/in/username"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">Instagram Handle</Label>
            <Input
              value={form.instagram_handle}
              onChange={(e) => setForm((f) => ({ ...f, instagram_handle: e.target.value }))}
              placeholder="@username"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Employee"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────

interface ProfilePanelProps {
  employee: EmployeeWithIG;
  onClose: () => void;
  supabase: ReturnType<typeof createClient>;
}

function ProfilePanel({ employee, onClose, supabase }: ProfilePanelProps) {
  const [stats, setStats] = useState<{
    likes: number;
    comments: number;
    shares: number;
    reposts: number;
  } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("engagements")
      .select("engagement_type")
      .eq("employee_id", employee.id)
      .then(({ data }) => {
        if (data) {
          setStats({
            likes: data.filter((e) => e.engagement_type === "like").length,
            comments: data.filter((e) => e.engagement_type === "comment").length,
            shares: data.filter((e) => e.engagement_type === "share").length,
            reposts: data.filter((e) => e.engagement_type === "repost").length,
          });
        }
      });
  }, [employee.id, supabase]);

  const initials = getInitials(employee.name);
  const igHandle = employee.instagram_handle
    ? employee.instagram_handle.startsWith("@")
      ? employee.instagram_handle
      : `@${employee.instagram_handle}`
    : null;

  return (
    <div className="w-72 flex-shrink-0 bg-[#1a1a1a] border border-white/5 rounded-xl flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Employee Profile
        </p>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-14 h-14 rounded-full bg-emerald-900/50 border border-emerald-700/30 flex items-center justify-center mb-3">
            <span className="text-emerald-300 text-lg font-bold">{initials}</span>
          </div>
          <p className="text-white font-semibold text-base leading-tight">{employee.name}</p>
          <p className="text-gray-400 text-xs mt-1">{employee.title ?? "No title set"}</p>
          {employee.department && (
            <span
              className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                DEPT_COLORS[employee.department] ?? "bg-gray-800 text-gray-400"
              }`}
            >
              {employee.department}
            </span>
          )}
        </div>

        {/* Points + Level */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{employee.total_points.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Points</p>
          </div>
          <div className="flex-1 bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                LEVEL_COLORS[employee.level] ?? "bg-gray-800 text-gray-400"
              }`}
            >
              {employee.level}
            </span>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Level</p>
          </div>
        </div>

        {/* Links */}
        {(employee.linkedin_url || igHandle) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Social
            </p>
            {employee.linkedin_url && (
              <a
                href={employee.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-3 h-3" />
                </div>
                <span className="truncate">
                  {employee.linkedin_url.replace("https://www.linkedin.com/in/", "@")}
                </span>
              </a>
            )}
            {igHandle && (
              <div className="flex items-center gap-2.5 text-xs text-pink-400">
                <div className="w-6 h-6 rounded bg-pink-900/50 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-3 h-3" />
                </div>
                <span>{igHandle}</span>
              </div>
            )}
          </div>
        )}

        {/* Engagement breakdown */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Engagement
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Likes", icon: ThumbsUp, color: "text-emerald-400", value: stats?.likes ?? 0 },
              { label: "Comments", icon: MessageSquare, color: "text-blue-400", value: stats?.comments ?? 0 },
              { label: "Shares", icon: Share2, color: "text-orange-400", value: stats?.shares ?? 0 },
              { label: "Reposts", icon: Repeat2, color: "text-purple-400", value: stats?.reposts ?? 0 },
            ].map(({ label, icon: Icon, color, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
                <p className="text-sm font-bold text-white">{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between py-2 border-t border-white/5">
          <span className="text-xs text-gray-500">Status</span>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              employee.is_active
                ? "bg-emerald-900/50 text-emerald-300"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {employee.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main EmployeeDirectory ────────────────────────────────────────────────────

export function EmployeeDirectory({
  initialEmployees,
  error,
}: {
  initialEmployees: Employee[];
  error?: string;
}) {
  const supabase = createClient();
  const isOnline = supabase !== null;
  const router = useRouter();

  const [employees, setEmployees] = useState<EmployeeWithIG[]>(initialEmployees);

  // Merge localStorage-only employees after hydration to avoid SSR mismatch.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const local = loadLocal();
      const serverEmails = new Set(initialEmployees.map((e) => e.email));
      const localOnly = local.filter((e) => !serverEmails.has(e.email));
      if (localOnly.length === 0) return;

      setEmployees((prev) => {
        const existEmails = new Set(prev.map((e) => e.email));
        return [...prev, ...localOnly.filter((e) => !existEmails.has(e.email))];
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialEmployees]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithIG | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithIG | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  useEffect(() => {
    saveLocal(employees.filter((e) => e.org_id === "local"));
  }, [employees]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.department ?? "").toLowerCase().includes(q);
    const matchDept = !deptFilter || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  const existingEmails = new Set(employees.map((e) => e.email));
  const localCount = employees.filter((e) => e.org_id === "local").length;

  async function ensureOrg(userId: string): Promise<string> {
    const { data: existing } = await supabase!
      .from("organizations")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (existing) return existing.id;

    const { error } = await supabase!
      .from("organizations")
      .insert({
        id: userId,
        name: "My Organization",
        slug: userId,
        linkedin_org_id: null,
        instagram_account_id: null,
        linkedin_access_token: null,
        instagram_access_token: null,
      });

    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return userId;
  }

  async function handleSave(form: EmployeeFormData) {
    if (supabase) {
      if (editingEmployee && editingEmployee.org_id !== "local") {
        const { data, error } = await supabase
          .from("employees")
          .update({
            name: form.name,
            email: form.email,
            department: form.department || null,
            title: form.title || null,
            linkedin_url: form.linkedin_url || null,
            is_active: true,
          })
          .eq("id", editingEmployee.id)
          .select()
          .single();

        if (error) { toast.error(error.message); return; }
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === editingEmployee.id
              ? { ...data, instagram_handle: form.instagram_handle || null }
              : e
          )
        );
        toast.success("Employee updated.");
        setShowAddModal(false);
        setEditingEmployee(null);
        return;
      }

      if (!editingEmployee) {
        const { data: { user } } = await supabase.auth.getUser();
        const org_id = await ensureOrg(user!.id);
        const { data, error } = await supabase
          .from("employees")
          .insert({
            org_id,
            name: form.name,
            email: form.email,
            department: form.department || null,
            title: form.title || null,
            linkedin_url: form.linkedin_url || null,
            is_active: true,
          })
          .select()
          .single();

        if (error) { toast.error(error.message); return; }
        setEmployees((prev) => [
          { ...data, instagram_handle: form.instagram_handle || null },
          ...prev,
        ]);
        toast.success("Employee added.");
        setShowAddModal(false);
        setEditingEmployee(null);
        return;
      }
    }

    // Offline path
    if (editingEmployee) {
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                name: form.name,
                email: form.email,
                department: form.department || null,
                title: form.title || null,
                linkedin_url: form.linkedin_url || null,
                instagram_handle: form.instagram_handle || null,
                updated_at: new Date().toISOString(),
              }
            : e
        )
      );
      toast.success("Employee updated (saved locally).");
    } else {
      setEmployees((prev) => [makeLocalEmployee(form), ...prev]);
      toast.success("Employee added (saved locally).");
    }
    setShowAddModal(false);
    setEditingEmployee(null);
  }

  async function handleDelete(emp: EmployeeWithIG) {
    if (!confirm(`Remove ${emp.name} from the directory?`)) return;
    if (supabase && emp.org_id !== "local") {
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) { toast.error(error.message); return; }
    }
    setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    if (selectedEmployee?.id === emp.id) setSelectedEmployee(null);
    toast.success("Employee removed.");
  }

  async function handleCsvImport(rows: EmployeeFormData[]) {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const org_id = user!.id;

      // Only insert rows whose email isn't already in the directory
      const newRows = rows.filter((r) => !existingEmails.has(r.email));
      if (newRows.length === 0) {
        toast.success("No new employees to import — all emails already exist.");
        return;
      }

      const toInsert = newRows.map((r) => ({
        org_id,
        name: r.name,
        email: r.email,
        department: r.department || null,
        title: r.title || null,
        linkedin_url: r.linkedin_url || null,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("employees")
        .insert(toInsert)
        .select();

      if (error) {
        toast.error(`Import failed: ${error.message}`);
        return;
      }

      const imported = (data ?? []).map((d, i) => ({
        ...d,
        instagram_handle: newRows[i]?.instagram_handle || null,
      }));
      setEmployees((prev) => [...imported, ...prev]);
      router.refresh();
    } else {
      // Offline
      const emailMap = new Map(employees.map((e) => [e.email, e]));
      const newEmps: EmployeeWithIG[] = [];
      const updatedMap = new Map(employees.map((e) => [e.id, e]));

      for (const row of rows) {
        const existing = emailMap.get(row.email);
        if (existing) {
          updatedMap.set(existing.id, {
            ...existing,
            name: row.name,
            department: row.department || existing.department,
            title: row.title || existing.title,
            linkedin_url: row.linkedin_url || existing.linkedin_url,
            instagram_handle: row.instagram_handle || existing.instagram_handle,
            updated_at: new Date().toISOString(),
          });
        } else {
          newEmps.push(makeLocalEmployee(row));
        }
      }
      setEmployees([...newEmps, ...Array.from(updatedMap.values())]);
      toast.success(`Imported ${newEmps.length} new employees (saved locally).`);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm">Failed to load employees: {error}</div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#111]">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white">Employee Directory</h1>
            <p className="text-gray-500 text-sm mt-1">
              {employees.length} {employees.length === 1 ? "employee" : "employees"} in directory
              {localCount > 0 && !isOnline && (
                <span className="text-amber-400 ml-2">· {localCount} saved locally</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => {
                setEditingEmployee(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        </div>

        {!isOnline && (
          <div className="mt-4 flex items-start gap-2.5 bg-amber-950/50 border border-amber-800/40 rounded-xl px-4 py-3 text-sm text-amber-300">
            <Database className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Supabase not connected — data is saved locally in your browser. Add credentials
              to <code className="text-amber-200">.env.local</code> to persist to the database.
            </span>
          </div>
        )}
      </div>

      {/* Search + dept filter */}
      <div className="px-8 py-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or department…"
            className="pl-9 bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-9 bg-[#1a1a1a] border border-white/10 text-gray-400 text-sm rounded-md px-3 focus:border-emerald-500 focus:outline-none min-w-[160px]"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Main content (table + optional profile panel) */}
      <div className="flex gap-4 px-8 pb-8 flex-1">
        {/* Table */}
        <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden min-w-0">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-500 text-sm">
                {search || deptFilter
                  ? "No employees match your filters."
                  : "No employees yet. Add your first employee or import a CSV."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Department
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Title
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      LinkedIn
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Instagram
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-4 py-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() =>
                        setSelectedEmployee(
                          selectedEmployee?.id === emp.id ? null : emp
                        )
                      }
                      className={clsx(
                        "border-b border-white/5 last:border-0 cursor-pointer transition-colors",
                        selectedEmployee?.id === emp.id
                          ? "bg-emerald-950/20"
                          : "hover:bg-white/[0.025]"
                      )}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <div className="w-7 h-7 rounded-full bg-emerald-900/40 border border-emerald-800/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-300 text-[10px] font-bold">
                              {getInitials(emp.name)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white leading-tight truncate">
                              {emp.name}
                            </p>
                            <p className="text-gray-500 text-xs truncate">{emp.email}</p>
                          </div>
                          {emp.org_id === "local" && (
                            <span className="text-[9px] bg-amber-900/40 text-amber-400 border border-amber-800/40 rounded px-1 py-0.5 font-medium flex-shrink-0">
                              local
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.department ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              DEPT_COLORS[emp.department] ?? "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {emp.department}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                        {emp.title ?? <span className="text-gray-600">—</span>}
                      </td>

                      {/* LinkedIn */}
                      <td className="px-4 py-3">
                        {emp.linkedin_url ? (
                          <a
                            href={emp.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                          >
                            <div className="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                              <Link2 className="w-3 h-3" />
                            </div>
                            <span className="hidden xl:block truncate max-w-[100px]">
                              {emp.linkedin_url.replace("https://www.linkedin.com/in/", "@")}
                            </span>
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Instagram */}
                      <td className="px-4 py-3 text-xs text-pink-300 whitespace-nowrap">
                        {emp.instagram_handle ? (
                          <span className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded bg-pink-900/50 flex items-center justify-center flex-shrink-0">
                              <Camera className="w-3 h-3 text-pink-300" />
                            </div>
                            {emp.instagram_handle.startsWith("@")
                              ? emp.instagram_handle
                              : `@${emp.instagram_handle}`}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            emp.is_active
                              ? "bg-emerald-900/50 text-emerald-300"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {emp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Points */}
                      <td className="px-4 py-3 text-right font-semibold text-white whitespace-nowrap">
                        {emp.total_points.toLocaleString()}
                      </td>

                      {/* Level */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            LEVEL_COLORS[emp.level] ?? "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {emp.level}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setEditingEmployee(emp);
                              setShowAddModal(true);
                            }}
                            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Employee Profile Panel */}
        {selectedEmployee && (
          <ProfilePanel
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            supabase={supabase}
          />
        )}
      </div>

      {/* Modals */}
      <EmployeeFormModal
        key={editingEmployee?.id ?? "new"}
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingEmployee(null);
        }}
        editing={editingEmployee}
        onSave={handleSave}
      />
      <CsvUploadModal
        open={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        existingEmails={existingEmails}
        onImport={async (rows) => {
          await handleCsvImport(rows);
        }}
      />
    </div>
  );
}
