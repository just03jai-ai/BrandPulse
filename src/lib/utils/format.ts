import { AVATAR_PALETTE } from "@/constants";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function getPlatform(url: string): "linkedin" | "instagram" | "unknown" {
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("instagram.com")) return "instagram";
  return "unknown";
}

export function getIgHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
