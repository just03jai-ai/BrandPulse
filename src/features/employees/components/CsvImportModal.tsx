"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CloudUpload, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import Papa from "papaparse";
import type { EmployeeFormData } from "../types";

type CsvStep = "select" | "preview" | "success";

interface Props {
  open: boolean;
  onClose: () => void;
  existingEmails: Set<string>;
  onImport: (rows: EmployeeFormData[], newCount: number, existCount: number) => Promise<void>;
}

const STEP_LABELS = ["Import Employee Directory", "Review Import", "Import Complete"];

export function CsvImportModal({ open, onClose, existingEmails, onImport }: Props) {
  const [step, setStep] = useState<CsvStep>("select");
  const [preview, setPreview] = useState<EmployeeFormData[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resultCounts, setResultCounts] = useState({ newCount: 0, existCount: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const newCount = preview.filter((r) => !existingEmails.has(r.email)).length;
  const existCount = preview.filter((r) => existingEmails.has(r.email)).length;
  const stepIndex = step === "select" ? 0 : step === "preview" ? 1 : 2;

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
          instagram_handle: row["instagram_handle"] || row["Instagram"] || row["Instagram Handle"] || "",
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
          <div className="flex items-center gap-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={clsx(
                  "h-1 rounded-full transition-all",
                  i === stepIndex ? "bg-emerald-500 w-6" : i < stepIndex ? "bg-emerald-800 w-3" : "bg-white/10 w-3"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                dragOver ? "border-emerald-500 bg-emerald-950/20" : "border-white/10 hover:border-white/20 hover:bg-white/5"
              )}
            >
              <CloudUpload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-300 font-medium">Drag & drop your CSV file here</p>
              <p className="text-xs text-gray-600 mt-1.5">or click to browse</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </div>
            <p className="text-xs text-gray-600 text-center">
              Required: <span className="text-gray-500">name, email</span>
              {" · "}
              <span className="text-gray-600">optional: department, title, linkedin_url, instagram_handle</span>
            </p>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-2">
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
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-900/40 text-amber-300">update</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-emerald-900/40 text-emerald-300">new</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => { setStep("select"); setPreview([]); }} className="text-sm text-gray-500 hover:text-white transition-colors">
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
            <button onClick={handleClose} className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors inline-block">
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
