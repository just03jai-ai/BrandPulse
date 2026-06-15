"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Upload, Search, Pencil, Trash2, X } from "lucide-react";
import type { Employee } from "@/types/database";
import Papa from "papaparse";

const LEVEL_COLORS: Record<string, string> = {
  Newcomer: "bg-gray-700 text-gray-300",
  "Rising Star": "bg-amber-900 text-amber-300",
  Champion: "bg-gray-600 text-gray-100",
  Legend: "bg-yellow-900 text-yellow-300",
  Ambassador: "bg-violet-900 text-violet-300",
};

interface EmployeeFormData {
  name: string;
  email: string;
  department: string;
  title: string;
  linkedin_url: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: "",
  email: "",
  department: "",
  title: "",
  linkedin_url: "",
};

export function EmployeeDirectory({
  initialEmployees,
  error,
}: {
  initialEmployees: Employee[];
  error?: string;
}) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<EmployeeFormData[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingEmployee(null);
    setShowAddModal(true);
  }

  function openEdit(emp: Employee) {
    setForm({
      name: emp.name,
      email: emp.email,
      department: emp.department ?? "",
      title: emp.title ?? "",
      linkedin_url: emp.linkedin_url ?? "",
    });
    setEditingEmployee(emp);
    setShowAddModal(true);
  }

  async function handleSave() {
    if (!supabase) { toast.error("Supabase not configured. Add credentials to .env.local."); return; }
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);

    if (editingEmployee) {
      const { data, error } = await supabase
        .from("employees")
        .update({
          name: form.name,
          email: form.email,
          department: form.department || null,
          title: form.title || null,
          linkedin_url: form.linkedin_url || null,
        })
        .eq("id", editingEmployee.id)
        .select()
        .single();

      if (error) {
        toast.error(error.message);
      } else {
        setEmployees((prev) =>
          prev.map((e) => (e.id === editingEmployee.id ? data : e))
        );
        toast.success("Employee updated.");
        setShowAddModal(false);
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      // Get or create org_id — for now use user id as org placeholder
      const org_id = user!.id;

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

      if (error) {
        toast.error(error.message);
      } else {
        setEmployees((prev) => [data, ...prev]);
        toast.success("Employee added.");
        setShowAddModal(false);
      }
    }
    setSaving(false);
  }

  async function handleDelete(emp: Employee) {
    if (!supabase) { toast.error("Supabase not configured."); return; }
    if (!confirm(`Remove ${emp.name} from the directory?`)) return;

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", emp.id);

    if (error) {
      toast.error(error.message);
    } else {
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      toast.success("Employee removed.");
    }
  }

  function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row) => ({
          name: row["name"] || row["Name"] || row["Full Name"] || "",
          email: row["email"] || row["Email"] || "",
          department: row["department"] || row["Department"] || "",
          title: row["title"] || row["Title"] || row["Job Title"] || "",
          linkedin_url:
            row["linkedin_url"] ||
            row["LinkedIn URL"] ||
            row["LinkedIn"] ||
            "",
        }));
        const valid = rows.filter((r) => r.name && r.email);
        if (valid.length === 0) {
          toast.error("No valid rows found. Make sure CSV has 'name' and 'email' columns.");
          return;
        }
        setCsvPreview(valid);
      },
      error: () => {
        toast.error("Failed to parse CSV.");
      },
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleCsvImport() {
    if (!supabase) { toast.error("Supabase not configured. Add credentials to .env.local."); return; }
    if (!csvPreview) return;
    setCsvUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const org_id = user!.id;

    const toInsert = csvPreview.map((row) => ({
      org_id,
      name: row.name,
      email: row.email,
      department: row.department || null,
      title: row.title || null,
      linkedin_url: row.linkedin_url || null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from("employees")
      .upsert(toInsert, { onConflict: "email" })
      .select();

    if (error) {
      toast.error(error.message);
    } else {
      const imported = data ?? [];
      setEmployees((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newOnes = imported.filter((e) => !existingIds.has(e.id));
        return [
          ...newOnes,
          ...prev.map((e) => imported.find((i) => i.id === e.id) ?? e),
        ];
      });
      toast.success(`Imported ${imported.length} employees.`);
      setCsvPreview(null);
    }
    setCsvUploading(false);
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        Failed to load employees: {error}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Employees</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {employees.length} {employees.length === 1 ? "employee" : "employees"} in directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCsvSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload CSV
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* CSV Preview Banner */}
      {csvPreview && (
        <div className="mb-4 bg-blue-950 border border-blue-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-blue-200 text-sm font-medium">
              {csvPreview.length} employees ready to import
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setCsvPreview(null)}
                variant="ghost"
                className="text-blue-400 hover:text-white h-7 px-2"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleCsvImport}
                disabled={csvUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white h-7"
              >
                {csvUploading ? "Importing..." : "Import All"}
              </Button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-blue-900/40 border border-blue-800/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-blue-800/50">
                  <th className="text-left px-3 py-2 text-blue-300 font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-blue-300 font-medium">Email</th>
                  <th className="text-left px-3 py-2 text-blue-300 font-medium">Department</th>
                  <th className="text-left px-3 py-2 text-blue-300 font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.map((row, i) => (
                  <tr key={i} className="border-b border-blue-800/30 last:border-0">
                    <td className="px-3 py-1.5 text-blue-100">{row.name}</td>
                    <td className="px-3 py-1.5 text-blue-200">{row.email}</td>
                    <td className="px-3 py-1.5 text-blue-300">{row.department}</td>
                    <td className="px-3 py-1.5 text-blue-300">{row.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-blue-400 mt-2">
            Existing employees with matching emails will be updated.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or department..."
          className="pl-9 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 focus:border-violet-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500 text-sm">
              {search
                ? "No employees match your search."
                : "No employees yet. Add your first employee or upload a CSV."}
            </p>
            {!search && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload CSV
                </Button>
                <Button
                  size="sm"
                  onClick={openAdd}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Add Employee
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400 font-medium">Name</TableHead>
                <TableHead className="text-gray-400 font-medium">Department</TableHead>
                <TableHead className="text-gray-400 font-medium">Title</TableHead>
                <TableHead className="text-gray-400 font-medium">LinkedIn</TableHead>
                <TableHead className="text-gray-400 font-medium text-right">Points</TableHead>
                <TableHead className="text-gray-400 font-medium">Level</TableHead>
                <TableHead className="text-gray-400 font-medium w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="border-gray-800 hover:bg-gray-800/50"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-white text-sm">{emp.name}</p>
                      <p className="text-gray-500 text-xs">{emp.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {emp.department ?? <span className="text-gray-600">—</span>}
                  </TableCell>
                  <TableCell className="text-gray-300 text-sm">
                    {emp.title ?? <span className="text-gray-600">—</span>}
                  </TableCell>
                  <TableCell>
                    {emp.linkedin_url ? (
                      <a
                        href={emp.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 text-xs truncate max-w-[160px] block"
                      >
                        {emp.linkedin_url.replace("https://www.linkedin.com/in/", "@")}
                      </a>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-white font-medium text-sm">
                      {emp.total_points.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        LEVEL_COLORS[emp.level] ?? "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {emp.level}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(emp)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingEmployee ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-gray-300 text-sm">
                  Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-gray-300 text-sm">
                  Work Email <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="Marketing"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Job Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Brand Manager"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-gray-300 text-sm">LinkedIn Profile URL</Label>
                <Input
                  value={form.linkedin_url}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://www.linkedin.com/in/username"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Saving..." : editingEmployee ? "Save Changes" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
