import { createClient } from "@/lib/supabase/server";
import { EmployeeDirectory } from "./employee-directory";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: employees, error } = await supabase
    .from("employees")
    .select("*")
    .order("total_points", { ascending: false });

  return (
    <div className="p-8">
      <EmployeeDirectory initialEmployees={employees ?? []} error={error?.message} />
    </div>
  );
}
