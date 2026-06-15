"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  BarChart2,
  Trophy,
  FileText,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-950 text-white border-r border-gray-800">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight">BrandPulse</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-violet-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
