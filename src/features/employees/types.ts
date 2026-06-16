import type { Employee } from "@/types/database";

export type EmployeeWithIG = Employee & { instagram_handle?: string | null };

export interface EmployeeFormData {
  name: string;
  email: string;
  department: string;
  title: string;
  linkedin_url: string;
  instagram_handle: string;
}

export const EMPTY_FORM: EmployeeFormData = {
  name: "",
  email: "",
  department: "",
  title: "",
  linkedin_url: "",
  instagram_handle: "",
};

export function formFromEmployee(emp: EmployeeWithIG | null): EmployeeFormData {
  if (!emp) return EMPTY_FORM;
  return {
    name: emp.name,
    email: emp.email,
    department: emp.department ?? "",
    title: emp.title ?? "",
    linkedin_url: emp.linkedin_url ?? "",
    instagram_handle: emp.instagram_handle ?? "",
  };
}
