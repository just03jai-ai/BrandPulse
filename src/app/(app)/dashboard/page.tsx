import { createClient } from "@/lib/supabase/server";
import { BarChart2, Users, FileText, Trophy } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back{user?.email ? `, ${user.email}` : ""}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Employees", value: "—", icon: Users, color: "text-violet-400" },
          { label: "Posts Tracked", value: "—", icon: FileText, color: "text-blue-400" },
          { label: "Total Engagements", value: "—", icon: BarChart2, color: "text-emerald-400" },
          { label: "Top Advocate", value: "—", icon: Trophy, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-gray-500 text-sm text-center py-8">
          Add employees and posts to start tracking engagement.
        </p>
      </div>
    </div>
  );
}
