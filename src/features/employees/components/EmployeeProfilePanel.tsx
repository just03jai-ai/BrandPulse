"use client";

import { useState, useEffect } from "react";
import { X, Link2, Camera, ThumbsUp, MessageSquare, Share2, Repeat2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInitials, getIgHandle } from "@/lib/utils/format";
import { DEPT_COLORS, LEVEL_COLORS } from "@/constants";
import type { EmployeeWithIG } from "../types";

interface Stats {
  likes: number;
  comments: number;
  shares: number;
  reposts: number;
}

interface Props {
  employee: EmployeeWithIG;
  onClose: () => void;
  supabase: ReturnType<typeof createClient>;
}

export function EmployeeProfilePanel({ employee, onClose, supabase }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("engagement_events")
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
  const igHandle = getIgHandle(employee.instagram_handle);

  const engagementStats = [
    { label: "Likes", icon: ThumbsUp, color: "text-emerald-400", value: stats?.likes ?? 0 },
    { label: "Comments", icon: MessageSquare, color: "text-blue-400", value: stats?.comments ?? 0 },
    { label: "Shares", icon: Share2, color: "text-orange-400", value: stats?.shares ?? 0 },
    { label: "Reposts", icon: Repeat2, color: "text-purple-400", value: stats?.reposts ?? 0 },
  ];

  return (
    <div className="w-72 flex-shrink-0 bg-[#1a1a1a] border border-white/5 rounded-xl flex flex-col overflow-hidden">
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

        {/* Social links */}
        {(employee.linkedin_url || igHandle) && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Social</p>
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
            {engagementStats.map(({ label, icon: Icon, color, value }) => (
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
              employee.is_active ? "bg-emerald-900/50 text-emerald-300" : "bg-gray-800 text-gray-400"
            }`}
          >
            {employee.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
    </div>
  );
}
