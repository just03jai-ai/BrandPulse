"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, Upload, Search, Pencil, Trash2, Link2, Camera, Database } from "lucide-react";
import { clsx } from "clsx";
import { DEPARTMENTS, DEPT_COLORS, LEVEL_COLORS } from "@/constants";
import { getInitials, getIgHandle } from "@/lib/utils/format";
import { CsvImportModal, EmployeeFormModal, EmployeeProfilePanel } from "@/features/employees/components";
import { loadLocal, saveLocal, makeLocalEmployee } from "@/features/employees/utils";
import type { EmployeeFormData, EmployeeWithIG } from "@/features/employees/types";
import type { Employee } from "@/types/database";

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
    const { error } = await supabase!.from("organizations").insert({
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
      } else if (!editingEmployee) {
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
        setEmployees((prev) => [{ ...data, instagram_handle: form.instagram_handle || null }, ...prev]);
        toast.success("Employee added.");
      }
    } else {
      if (editingEmployee) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === editingEmployee.id
              ? { ...e, ...form, department: form.department || null, title: form.title || null, linkedin_url: form.linkedin_url || null, instagram_handle: form.instagram_handle || null, updated_at: new Date().toISOString() }
              : e
          )
        );
        toast.success("Employee updated (saved locally).");
      } else {
        setEmployees((prev) => [makeLocalEmployee(form), ...prev]);
        toast.success("Employee added (saved locally).");
      }
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
      const newRows = rows.filter((r) => !existingEmails.has(r.email));
      if (newRows.length === 0) {
        toast.success("No new employees — all emails already exist.");
        return;
      }
      const { data, error } = await supabase
        .from("employees")
        .insert(newRows.map((r) => ({
          org_id,
          name: r.name,
          email: r.email,
          department: r.department || null,
          title: r.title || null,
          linkedin_url: r.linkedin_url || null,
          is_active: true,
        })))
        .select();
      if (error) { toast.error(`Import failed: ${error.message}`); return; }
      const imported = (data ?? []).map((d, i) => ({
        ...d,
        instagram_handle: newRows[i]?.instagram_handle || null,
      }));
      setEmployees((prev) => [...imported, ...prev]);
      router.refresh();
    } else {
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
    return <div className="p-8 text-red-400 text-sm">Failed to load employees: {error}</div>;
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
              onClick={() => { setEditingEmployee(null); setShowAddModal(true); }}
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

      {/* Filters */}
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
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex gap-4 px-8 pb-8 flex-1">
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
                    {["Name", "Department", "Title", "LinkedIn", "Instagram", "Status", "Points", "Level", ""].map((h, i) => (
                      <th
                        key={i}
                        className={clsx(
                          "px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap",
                          i === 6 ? "text-right" : i === 8 ? "w-16" : "text-left"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(selectedEmployee?.id === emp.id ? null : emp)}
                      className={clsx(
                        "border-b border-white/5 last:border-0 cursor-pointer transition-colors",
                        selectedEmployee?.id === emp.id ? "bg-emerald-950/20" : "hover:bg-white/[0.025]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <div className="w-7 h-7 rounded-full bg-emerald-900/40 border border-emerald-800/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-300 text-[10px] font-bold">{getInitials(emp.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white leading-tight truncate">{emp.name}</p>
                            <p className="text-gray-500 text-xs truncate">{emp.email}</p>
                          </div>
                          {emp.org_id === "local" && (
                            <span className="text-[9px] bg-amber-900/40 text-amber-400 border border-amber-800/40 rounded px-1 py-0.5 font-medium flex-shrink-0">local</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.department ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DEPT_COLORS[emp.department] ?? "bg-gray-800 text-gray-300"}`}>
                            {emp.department}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm whitespace-nowrap">
                        {emp.title ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {emp.linkedin_url ? (
                          <a href={emp.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors">
                            <div className="w-5 h-5 rounded bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                              <Link2 className="w-3 h-3" />
                            </div>
                            <span className="hidden xl:block truncate max-w-[100px]">
                              {emp.linkedin_url.replace("https://www.linkedin.com/in/", "@")}
                            </span>
                          </a>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-pink-300 whitespace-nowrap">
                        {getIgHandle(emp.instagram_handle) ? (
                          <span className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded bg-pink-900/50 flex items-center justify-center flex-shrink-0">
                              <Camera className="w-3 h-3 text-pink-300" />
                            </div>
                            {getIgHandle(emp.instagram_handle)}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${emp.is_active ? "bg-emerald-900/50 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white whitespace-nowrap">
                        {emp.total_points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[emp.level] ?? "bg-gray-800 text-gray-400"}`}>
                          {emp.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditingEmployee(emp); setShowAddModal(true); }}
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

        {selectedEmployee && (
          <EmployeeProfilePanel
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            supabase={supabase}
          />
        )}
      </div>

      <EmployeeFormModal
        key={editingEmployee?.id ?? "new"}
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingEmployee(null); }}
        editing={editingEmployee}
        onSave={handleSave}
      />
      <CsvImportModal
        open={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        existingEmails={existingEmails}
        onImport={async (rows) => { await handleCsvImport(rows); }}
      />
    </div>
  );
}
