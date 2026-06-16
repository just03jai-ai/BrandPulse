"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Link2,
  Camera,
  ThumbsUp,
  MessageSquare,
  Share2,
  Repeat2,
  Archive,
  ArchiveRestore,
  RefreshCw,
  ExternalLink,
  FileText,
} from "lucide-react";
import type { Post } from "@/types/database";
import { clsx } from "clsx";

import { getPlatform, formatDate } from "@/lib/utils/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalEngagements(post: Post) {
  return post.total_likes + post.total_comments + post.total_shares + post.total_reposts;
}

// ── Platform Badge ────────────────────────────────────────────────────────────

function PlatformBadge({ url }: { url: string }) {
  const platform = getPlatform(url);
  if (platform === "linkedin") {
    return (
      <div className="w-7 h-7 rounded-md bg-blue-900/60 border border-blue-700/30 flex items-center justify-center flex-shrink-0">
        <Link2 className="w-3.5 h-3.5 text-blue-400" />
      </div>
    );
  }
  if (platform === "instagram") {
    return (
      <div className="w-7 h-7 rounded-md bg-pink-900/60 border border-pink-700/30 flex items-center justify-center flex-shrink-0">
        <Camera className="w-3.5 h-3.5 text-pink-400" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md bg-gray-800 flex items-center justify-center flex-shrink-0">
      <FileText className="w-3.5 h-3.5 text-gray-500" />
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  synced: "bg-emerald-900/50 text-emerald-300",
  syncing: "bg-blue-900/50 text-blue-300",
  pending: "bg-gray-800 text-gray-400",
  error: "bg-red-900/50 text-red-300",
  archived: "bg-gray-800/50 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? "bg-gray-800 text-gray-400"
      }`}
    >
      {status === "syncing" && (
        <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" />
      )}
      {status}
    </span>
  );
}

// ── Track New Post Modal ──────────────────────────────────────────────────────

interface TrackModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (post: Post) => void;
}

function TrackNewPostModal({ open, onClose, onAdd }: TrackModalProps) {
  const supabase = createClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const platform = url ? getPlatform(url) : null;

  async function handleSubmit() {
    if (!url.trim()) {
      toast.error("Post URL is required.");
      return;
    }
    if (!url.startsWith("http")) {
      toast.error("Please enter a valid URL starting with https://");
      return;
    }

    setSaving(true);

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const org_id = user!.id;

      const { data, error } = await supabase
        .from("posts")
        .insert({
          org_id,
          linkedin_post_url: url.trim(),
          title: title.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      onAdd(data);
      toast.success("Post added — sync will pull engagement data shortly.");
    } else {
      // Offline: local placeholder
      const local: Post = {
        id: crypto.randomUUID(),
        org_id: "local",
        linkedin_post_url: url.trim(),
        linkedin_post_id: null,
        title: title.trim() || null,
        content_preview: null,
        published_at: null,
        last_synced_at: null,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
        total_reposts: 0,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      onAdd(local);
      toast.success("Post saved locally (Supabase not connected).");
    }

    setUrl("");
    setTitle("");
    setSaving(false);
    onClose();
  }

  function handleClose() {
    setUrl("");
    setTitle("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Track New Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">
              Post URL <span className="text-red-400">*</span>
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/posts/..."
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
            {platform && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5 pt-0.5">
                {platform === "linkedin" && (
                  <span className="text-blue-400">LinkedIn post detected</span>
                )}
                {platform === "instagram" && (
                  <span className="text-pink-400">Instagram post detected</span>
                )}
                {platform === "unknown" && (
                  <span className="text-gray-500">Platform not recognised — will track as generic</span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs font-medium">
              Title <span className="text-gray-600">(optional)</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. FarMart Q2 Announcement"
              className="bg-[#111] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-1">
          <button
            onClick={handleClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? "Tracking…" : "Track Post"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main PostTracking Component ───────────────────────────────────────────────

type PlatformFilter = "all" | "linkedin" | "instagram";

export function PostTracking({
  initialPosts,
  error,
}: {
  initialPosts: Post[];
  error?: string;
}) {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const filtered = posts.filter((p) => {
    const isArchived = p.status === "archived";
    if (!showArchived && isArchived) return false;
    if (showArchived && !isArchived) return false;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (p.title ?? "").toLowerCase().includes(q) ||
      p.linkedin_post_url.toLowerCase().includes(q);

    const platform = getPlatform(p.linkedin_post_url);
    const matchPlatform =
      platformFilter === "all" || platform === platformFilter;

    return matchSearch && matchPlatform;
  });

  const activePosts = posts.filter((p) => p.status !== "archived");
  const archivedPosts = posts.filter((p) => p.status === "archived");
  const totalEngs = activePosts.reduce((sum, p) => sum + totalEngagements(p), 0);
  const syncedCount = activePosts.filter((p) => p.status === "synced").length;

  async function handleArchive(post: Post) {
    const newStatus = post.status === "archived" ? "pending" : "archived";
    if (supabase && post.org_id !== "local") {
      const { error } = await supabase
        .from("posts")
        .update({ status: newStatus })
        .eq("id", post.id);
      if (error) { toast.error(error.message); return; }
    }
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, status: newStatus } : p))
    );
    toast.success(newStatus === "archived" ? "Post archived." : "Post restored.");
  }

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm">Failed to load posts: {error}</div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#111]">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Post Tracking</h1>
            <p className="text-gray-500 text-sm mt-1">
              Track LinkedIn &amp; Instagram posts and monitor employee engagement
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Track New Post
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Total Posts
            </p>
            <p className="text-3xl font-bold text-white">{activePosts.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">Currently tracked</p>
          </div>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Total Engagements
            </p>
            <p className="text-3xl font-bold text-white">{totalEngs.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-0.5">Likes + comments + shares + reposts</p>
          </div>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Synced
            </p>
            <p className="text-3xl font-bold text-white">{syncedCount}</p>
            <p className="text-xs text-gray-600 mt-0.5">Posts with live data</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex items-center gap-3">
        {/* Platform tabs */}
        <div className="flex items-center bg-[#1a1a1a] border border-white/5 rounded-lg p-1 gap-0.5">
          {(["all", "linkedin", "instagram"] as PlatformFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPlatformFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                platformFilter === f
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {f === "all" ? "All Platforms" : f === "linkedin" ? "LinkedIn" : "Instagram"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or URL…"
            className="pl-9 bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9"
          />
        </div>

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
            showArchived
              ? "border-amber-700/50 bg-amber-950/40 text-amber-300"
              : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Archive className="w-3.5 h-3.5" />
          {showArchived ? `Archived (${archivedPosts.length})` : "Show Archived"}
        </button>
      </div>

      {/* Table */}
      <div className="px-8 pb-8 flex-1">
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <FileText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {search || platformFilter !== "all"
                  ? "No posts match your filters."
                  : showArchived
                  ? "No archived posts."
                  : "No posts tracked yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-8" />
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <ThumbsUp className="w-3.5 h-3.5 inline text-emerald-500" />
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <MessageSquare className="w-3.5 h-3.5 inline text-blue-500" />
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <Share2 className="w-3.5 h-3.5 inline text-orange-500" />
                    </th>
                    <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <Repeat2 className="w-3.5 h-3.5 inline text-purple-500" />
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((post) => (
                    <tr
                      key={post.id}
                      className={clsx(
                        "border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.025]",
                        post.status === "archived" && "opacity-50"
                      )}
                    >
                      {/* Platform */}
                      <td className="px-4 py-3">
                        <PlatformBadge url={post.linkedin_post_url} />
                      </td>

                      {/* Title + URL */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-white text-sm truncate">
                          {post.title ?? (
                            <span className="text-gray-500 italic">Untitled</span>
                          )}
                        </p>
                        <a
                          href={post.linkedin_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-300 truncate flex items-center gap-1 mt-0.5 max-w-[220px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{post.linkedin_post_url}</span>
                        </a>
                        {post.content_preview && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {post.content_preview}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(post.published_at ?? post.created_at)}
                      </td>

                      {/* Likes */}
                      <td className="px-3 py-3 text-center font-semibold text-white">
                        {post.total_likes}
                      </td>

                      {/* Comments */}
                      <td className="px-3 py-3 text-center font-semibold text-white">
                        {post.total_comments}
                      </td>

                      {/* Shares */}
                      <td className="px-3 py-3 text-center font-semibold text-white">
                        {post.total_shares}
                      </td>

                      {/* Reposts */}
                      <td className="px-3 py-3 text-center font-semibold text-white">
                        {post.total_reposts}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={post.status} />
                        {post.last_synced_at && (
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {formatDate(post.last_synced_at)}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleArchive(post)}
                          title={post.status === "archived" ? "Restore post" : "Archive post"}
                          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {post.status === "archived" ? (
                            <ArchiveRestore className="w-4 h-4" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Last synced info */}
        {syncedCount > 0 && (
          <p className="text-xs text-gray-600 mt-3 text-right">
            Engagement data synced via Vercel Cron — updates automatically every 6 hours.
          </p>
        )}
      </div>

      <TrackNewPostModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdd={(post) => setPosts((prev) => [post, ...prev])}
      />
    </div>
  );
}
