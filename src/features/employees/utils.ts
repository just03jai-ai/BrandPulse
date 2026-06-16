import { STORAGE_KEY } from "@/constants";
import type { EmployeeWithIG, EmployeeFormData } from "./types";

export function makeLocalEmployee(form: EmployeeFormData): EmployeeWithIG {
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

export function loadLocal(): EmployeeWithIG[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveLocal(employees: EmployeeWithIG[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}
