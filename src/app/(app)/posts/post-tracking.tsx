"use client";

import { useState, useEffect } from "react";
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
  Pencil,
} from "lucide-react";
import type { Post } from "@/types/database";
import { clsx } from "clsx";
import { getPlatform, formatDate } from "@/lib/utils/format";

function totalEngagements(post: Post) {
  return post.total_likes + post.total_comments + post.total_shares + post.total_reposts;
}

function PlatformBadge({ platform }: { platform: Post["platform"] }) {
  if (platform === "linkedin") {
    return (
      <div className="w-7 h-7 rounded-md bg-blue-900/60 border border-blue-700/30 flex items-center justify-center flex-shrink-0">
        <Link2 className="w-3.5 h-3.5 text-blue-400" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md bg-pink-900/60 border border-pink-700/30 flex items-center justify-center flex-shrink-0">
      <Camera className="w-3.5 h-3.5 text-pink-400" />
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  synced:   "bg-emerald-900/50 text-emerald-300",
  syncing:  "bg-blue-900/50 text-blue-300",
  pending:  "bg-gray-800 text-gray-400",
  error:    "bg-red-900/50 text-red-300",
  archived: "bg-gray-800/50 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status === "syncing" && <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" />}
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

  const detectedPlatform = url ? getPlatform(url) : null;

  async function handleSubmit() {
    if (!url.trim()) { toast.error("Post URL is required."); return; }
    if (!url.startsWith("http")) { toast.error("Please enter a valid URL starting with https://"); return; }
    if (!supabase) { toast.error("Supabase is not configured."); return; }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    let org_id = membership?.org_id;
    if (!org_id) {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: "My Organization", slug: `org-${user!.id.slice(0, 8)}` })
        .select("id")
        .single();
      if (orgError) { toast.error(orgError.message); setSaving(false); return; }
      await supabase.from("org_members").insert({ org_id: org.id, user_id: user!.id, role: "owner" });
      org_id = org.id;
    }

    const platform: Post["platform"] =
      detectedPlatform === "instagram" ? "instagram" : "linkedin";

    const { data, error } = await supabase
      .from("company_posts")
      .insert({
        org_id,
        platform,
        post_url: url.trim(),
        title: title.trim() || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    onAdd(data);
    toast.success("Post added — sync will pull engagement data on the next run.");
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
            {detectedPlatform && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5 pt-0.5">
                {detectedPlatform === "linkedin" && <span className="text-blue-400">LinkedIn post detected</span>}
                {detectedPlatform === "instagram" && <span className="text-pink-400">Instagram post detected</span>}
                {detectedPlatform === "unknown" && <span className="text-gray-500">Platform not recognised — will track as LinkedIn</span>}
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
          <button onClick={handleClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
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

// ── Update Stats Modal ────────────────────────────────────────────────────────

interface UpdateStatsModalProps {
  post: Post | null;
  onClose: () => void;
  onSave: (post: Post) => void;
}

function UpdateStatsModal({ post, onClose, onSave }: UpdateStatsModalProps) {
  const supabase = createClient();
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [reposts, setReposts] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setLikes(post.total_likes > 0 ? String(post.total_likes) : "");
      setComments(post.total_comments > 0 ? String(post.total_comments) : "");
      setShares(post.total_shares > 0 ? String(post.total_shares) : "");
      setReposts(post.total_reposts > 0 ? String(post.total_reposts) : "");
    }
  }, [post]);

  function numVal(v: string) { return Math.max(0, parseInt(v, 10) || 0); }

  async function handleSave() {
    if (!post || !supabase) return;
    setSaving(true);
    const patch = {
      total_likes: numVal(likes),
      total_comments: numVal(comments),
      total_shares: numVal(shares),
      total_reposts: numVal(reposts),
      status: "synced" as const,
      last_synced_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("company_posts").update(patch).eq("id", post.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSave({ ...post, ...patch });
    toast.success("Stats updated.");
    onClose();
  }

  function handleClose() {
    setLikes(""); setComments(""); setShares(""); setReposts("");
    onClose();
  }

  const fields = [
    { label: "Likes",    icon: ThumbsUp,      color: "text-emerald-400", value: likes,    set: setLikes },
    { label: "Comments", icon: MessageSquare,  color: "text-blue-400",    value: comments, set: setComments },
    { label: "Shares",   icon: Share2,         color: "text-orange-400",  value: shares,   set: setShares },
    { label: "Reposts",  icon: Repeat2,        color: "text-purple-400",  value: reposts,  set: setReposts },
  ];

  return (
    <Dialog open={!!post} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">Update Engagement Stats</DialogTitle>
        </DialogHeader>

        {post && (
          <div className="space-y-5 py-1">
            {/* Post info */}
            <div className="flex items-start gap-3 rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
              <PlatformBadge platform={post.platform} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{post.title ?? "Untitled"}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{post.post_url}</p>
              </div>
            </div>

            {/* Stat inputs */}
            <div className="grid grid-cols-2 gap-3">
              {fields.map(({ label, icon: Icon, color, value, set }) => (
                <div key={label} className="space-y-1.5">
                  <label className={`text-xs font-medium flex items-center gap-1.5 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={value}
                    onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
                    placeholder="0"
                    className="w-full h-10 rounded-lg bg-[#111] border border-white/10 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              Saving will mark this post as <span className="text-emerald-400 font-medium">synced</span> with today&apos;s timestamp.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <button onClick={handleClose} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save Stats"}
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
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const filtered = posts.filter((p) => {
    const isArchived = p.status === "archived";
    if (!showArchived && isArchived) return false;
    if (showArchived && !isArchived) return false;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (p.title ?? "").toLowerCase().includes(q) ||
      p.post_url.toLowerCase().includes(q);

    const matchPlatform = platformFilter === "all" || p.platform === platformFilter;

    return matchSearch && matchPlatform;
  });

  const activePosts = posts.filter((p) => p.status !== "archived");
  const archivedPosts = posts.filter((p) => p.status === "archived");
  const totalEngs = activePosts.reduce((sum, p) => sum + totalEngagements(p), 0);
  const syncedCount = activePosts.filter((p) => p.status === "synced").length;

  async function handleArchive(post: Post) {
    if (!supabase) { toast.error("Supabase is not configured."); return; }
    const newStatus = post.status === "archived" ? "pending" : "archived";
    const { error } = await supabase
      .from("company_posts")
      .update({ status: newStatus })
      .eq("id", post.id);
    if (error) { toast.error(error.message); return; }
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: newStatus } : p)));
    toast.success(newStatus === "archived" ? "Post archived." : "Post restored.");
  }

  if (error) {
    return <div className="p-8 text-red-400 text-sm">Failed to load posts: {error}</div>;
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
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-gray-500 text-sm font-medium cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-56 px-3 py-2 bg-gray-900 border border-white/10 rounded-lg text-xs text-gray-400 hidden group-hover:block z-10 shadow-xl">
                Automated sync coming soon. Add credentials in Settings and we&apos;ll pull engagement data automatically.
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Track New Post
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Posts</p>
            <p className="text-3xl font-bold text-white">{activePosts.length}</p>
            <p className="text-xs text-gray-600 mt-0.5">Currently tracked</p>
          </div>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Engagements</p>
            <p className="text-3xl font-bold text-white">{totalEngs.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-0.5">Likes + comments + shares + reposts</p>
          </div>
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-5 py-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Synced</p>
            <p className="text-3xl font-bold text-white">{syncedCount}</p>
            <p className="text-xs text-gray-600 mt-0.5">Posts with live data</p>
          </div>
        </div>
      </div>

      {/* Demo guidance banner */}
      {activePosts.length > 0 && syncedCount === 0 && (
        <div className="px-8 pb-4">
          <div className="flex items-start gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-3 text-sm text-blue-300">
            <span className="mt-0.5 shrink-0 text-blue-400">ℹ</span>
            <span>
              Posts are tracked but show <span className="font-medium text-white">pending</span> — engagement data will populate once automated sync is configured.
              In the meantime, use{" "}
              <a href="/submissions" className="text-white font-medium underline underline-offset-2 hover:text-blue-200">
                Submissions
              </a>{" "}
              to manually log employee engagement on these posts.
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 pb-4 flex items-center gap-3">
        <div className="flex items-center bg-[#1a1a1a] border border-white/5 rounded-lg p-1 gap-0.5">
          {(["all", "linkedin", "instagram"] as PlatformFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPlatformFilter(f)}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                platformFilter === f ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {f === "all" ? "All Platforms" : f === "linkedin" ? "LinkedIn" : "Instagram"}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or URL…"
            className="pl-9 bg-[#1a1a1a] border-white/10 text-white placeholder:text-gray-600 focus:border-emerald-500 h-9"
          />
        </div>

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
                  : showArchived ? "No archived posts." : "No posts tracked yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-8" />
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Post</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
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
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
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
                      <td className="px-4 py-3">
                        <PlatformBadge platform={post.platform} />
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-white text-sm truncate">
                          {post.title ?? <span className="text-gray-500 italic">Untitled</span>}
                        </p>
                        <a
                          href={post.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-300 truncate flex items-center gap-1 mt-0.5 max-w-[220px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{post.post_url}</span>
                        </a>
                        {post.content_preview && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{post.content_preview}</p>
                        )}
                        {post.sync_error && (
                          <p className="text-xs text-red-400 mt-0.5 truncate">{post.sync_error}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(post.published_at ?? post.created_at)}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-white">{post.total_likes}</td>
                      <td className="px-3 py-3 text-center font-semibold text-white">{post.total_comments}</td>
                      <td className="px-3 py-3 text-center font-semibold text-white">{post.total_shares}</td>
                      <td className="px-3 py-3 text-center font-semibold text-white">{post.total_reposts}</td>

                      <td className="px-4 py-3">
                        <StatusBadge status={post.status} />
                        {post.last_synced_at && (
                          <p className="text-[10px] text-gray-600 mt-0.5">{formatDate(post.last_synced_at)}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {post.status !== "archived" && (
                            <button
                              onClick={() => setEditingPost(post)}
                              title="Update stats manually"
                              className="p-1.5 rounded-md text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleArchive(post)}
                            title={post.status === "archived" ? "Restore post" : "Archive post"}
                            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            {post.status === "archived"
                              ? <ArchiveRestore className="w-4 h-4" />
                              : <Archive className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {syncedCount > 0 && (
          <p className="text-xs text-gray-600 mt-3 text-right">
            Last synced: {activePosts.filter((p) => p.last_synced_at).map((p) => p.last_synced_at).sort().at(-1)
              ? formatDate(activePosts.filter((p) => p.last_synced_at).map((p) => p.last_synced_at).sort().at(-1)!)
              : "—"}
          </p>
        )}
      </div>

      <TrackNewPostModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdd={(post) => setPosts((prev) => [post, ...prev])}
      />

      <UpdateStatsModal
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSave={(updated) => setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
      />
    </div>
  );
}
