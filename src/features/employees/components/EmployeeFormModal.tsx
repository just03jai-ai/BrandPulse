"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/constants";
import type { EmployeeFormData, EmployeeWithIG } from "../types";
import { formFromEmployee } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  editing: EmployeeWithIG | null;
  onSave: (form: EmployeeFormData) => Promise<void>;
}

export function EmployeeFormModal({ open, onClose, editing, onSave }: Props) {
  const [form, setForm] = useState<EmployeeFormData>(() => formFromEmployee(editing));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
              onChange={(e) => set("name", e.target.value)}
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
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@company.com"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs font-medium">Department</Label>
              <select
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
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
                onChange={(e) => set("title", e.target.value)}
                placeholder="Brand Manager"
                className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">LinkedIn Profile URL</Label>
            <Input
              value={form.linkedin_url}
              onChange={(e) => set("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">Instagram Handle</Label>
            <Input
              value={form.instagram_handle}
              onChange={(e) => set("instagram_handle", e.target.value)}
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
