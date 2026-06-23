"use client";

import { useState } from "react";
import {
  Link2,
  Camera,
  Eye,
  EyeOff,
  Copy,
  X,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOrgSettings } from "@/features/organization/hooks/use-org-settings";
import type { OrgCredentialsPublic } from "@/features/organization/types";

const TABS = [
  { id: "linkedin",  label: "LinkedIn",  icon: Link2 },
  { id: "instagram", label: "Instagram", icon: Camera },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── SecretInput ────────────────────────────────────────────────────────────────

function SecretInput({
  isSet,
  value,
  onChange,
  placeholder,
}: {
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(false);

  if (isSet && !editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-9 bg-gray-800 border border-gray-600 rounded-md px-3 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span className="text-gray-400 text-sm">•••••••••••• (saved)</span>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(true); onChange(""); }}
          className="h-9 px-3 rounded-md border border-gray-600 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Update
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={editing}
        className="h-9 border-gray-600 bg-gray-900 pr-16 text-white"
      />
      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
        <button type="button" onClick={() => setShow(!show)} className="rounded p-1 text-gray-400 hover:text-white">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied."); }}
            className="rounded p-1 text-gray-400 hover:text-white"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab views ──────────────────────────────────────────────────────────────────

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied:
    "Authorization was denied. If you approved, check that your LinkedIn app has the r_organization_social product enabled.",
  missing_scope_approval:
    "Your LinkedIn app is not approved for r_organization_social. Submit your app for LinkedIn's Marketing Developer Platform review.",
  unauthorized_client:
    "This app is not authorized for the required LinkedIn scopes. Check your app's product settings.",
  missing_client_id:
    "Save your Client ID above first, then try connecting.",
  missing_company_id:
    "Save your Company ID above first, then try connecting.",
  missing_credentials:
    "Save your Client ID and Client Secret above before connecting.",
  state_mismatch:
    "Security check failed. Please try connecting again.",
  invalid_grant:
    "The authorization code was invalid or expired. Please try connecting again.",
  token_exchange_failed:
    "Could not exchange the authorization code for a token. Verify your Client Secret and try again.",
  network_error:
    "Could not reach LinkedIn servers. Check your connection and try again.",
  db_save_failed:
    "Connected successfully but failed to save credentials. Please try again.",
  not_authenticated:
    "You are not signed in. Please refresh the page.",
  db_not_configured:
    "Database not configured. Contact your administrator.",
  unknown_error:
    "An unknown error occurred. Please try again.",
};

interface LinkedInViewProps {
  form: { company_url: string; client_id: string; company_id: string; client_secret: string; access_token: string };
  secretsSet: { linkedin_client_secret: boolean; linkedin_access_token: boolean };
  connectionStatus: "connected" | "error" | "disconnected";
  oauthResult?: "connected" | "error";
  oauthReason?: string;
  onChange: (field: string, value: string) => void;
  onValidate: () => Promise<void>;
  onClear: () => Promise<void>;
  validating: boolean;
  clearing: boolean;
}

function LinkedInView({
  form, secretsSet, connectionStatus, oauthResult, oauthReason,
  onChange, onValidate, onClear, validating, clearing,
}: LinkedInViewProps) {
  const [editing, setEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const disabled = !editing;

  // OAuth connect requires client_id + client_secret + company_id to be saved
  const canConnect =
    Boolean(form.client_id) &&
    Boolean(form.company_id) &&
    secretsSet.linkedin_client_secret;

  const hasToken = secretsSet.linkedin_access_token;

  return (
    <div className="space-y-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-start justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-white">LinkedIn Integration</h2>
          <p className="mt-1 text-sm text-gray-400">
            Connect your LinkedIn company page to track employee engagement on posts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            editing
              ? "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white"
              : "border-green-700 bg-green-500/10 text-green-400 hover:bg-green-500/20"
          )}
        >
          {editing ? (
            <><X className="h-3.5 w-3.5" /> Cancel</>
          ) : (
            <><Pencil className="h-3.5 w-3.5" /> Edit</>
          )}
        </button>
      </div>

      {/* OAuth result banner */}
      {oauthResult && (
        <div className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          oauthResult === "connected"
            ? "border-emerald-900/50 bg-emerald-950/40"
            : "border-red-900/50 bg-red-950/40"
        )}>
          {oauthResult === "connected"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
          <div>
            <p className={cn(
              "text-sm font-medium",
              oauthResult === "connected" ? "text-emerald-300" : "text-red-300"
            )}>
              {oauthResult === "connected"
                ? "LinkedIn connected successfully via OAuth."
                : "LinkedIn connection failed."}
            </p>
            {oauthResult === "error" && oauthReason && (
              <p className="mt-1 text-xs text-gray-400">
                {OAUTH_ERROR_MESSAGES[oauthReason] ?? OAUTH_ERROR_MESSAGES.unknown_error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Connection status + OAuth button */}
      <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-2 w-2 rounded-full shrink-0",
            connectionStatus === "connected" ? "bg-emerald-400" :
            connectionStatus === "error" ? "bg-red-400" : "bg-gray-500"
          )} />
          <div>
            <p className="text-sm font-medium text-white">
              {connectionStatus === "connected" ? "Connected via OAuth" :
               connectionStatus === "error" ? "Connection Error" : "Not Connected"}
            </p>
            <p className="text-xs text-gray-400">
              {connectionStatus === "connected"
                ? "Access token active — sync is enabled."
                : connectionStatus === "error"
                ? "Token invalid or expired. Reconnect to restore sync."
                : "Authorize via OAuth 2.0 to enable sync."}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!canConnect}
          title={!canConnect ? "Save Client ID, Client Secret, and Company ID above first" : undefined}
          onClick={() => { window.location.href = "/api/auth/linkedin/start"; }}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shrink-0",
            canConnect
              ? connectionStatus === "connected"
                ? "border border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white"
                : "bg-[#0077B5] text-white hover:bg-[#005f91]"
              : "border border-gray-700 text-gray-600 cursor-not-allowed"
          )}
        >
          <div className="flex h-4 w-4 items-center justify-center rounded bg-white/20">
            <span className="text-[8px] font-bold leading-none">in</span>
          </div>
          {connectionStatus === "connected" ? "Reconnect" : "Connect LinkedIn"}
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-gray-300">Company Page URL</Label>
        <p className="text-xs text-gray-500">The URL of your company&apos;s LinkedIn page.</p>
        <Input
          value={form.company_url}
          onChange={(e) => onChange("company_url", e.target.value)}
          placeholder="https://linkedin.com/company/farmart"
          disabled={disabled}
          className="h-9 border-gray-700 bg-gray-800 text-white focus-visible:border-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-gray-300">API Credentials</Label>
          <p className="mt-0.5 text-xs text-gray-500">
            Generate these from the{" "}
            <a href="https://developer.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
              LinkedIn Developer Portal
            </a>{" "}
            under your app&apos;s Auth settings. Save these before clicking Connect LinkedIn.
          </p>
        </div>
        <div className={cn("space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-4 transition-opacity", disabled && "opacity-60")}>
          <div className="flex items-center gap-2 border-b border-gray-700 pb-3">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#0077B5]">
              <span className="text-[9px] font-bold text-white">in</span>
            </div>
            <span className="text-sm font-medium text-white">LinkedIn App</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Client ID</Label>
            <Input
              value={form.client_id}
              onChange={(e) => onChange("client_id", e.target.value)}
              placeholder="86xxxxxxxxxxxxxxxx"
              disabled={disabled}
              className="h-9 border-gray-600 bg-gray-900 text-white disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Client Secret</Label>
            <SecretInput
              isSet={secretsSet.linkedin_client_secret}
              value={form.client_secret}
              onChange={(v) => onChange("client_secret", v)}
              placeholder="Your LinkedIn client secret"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Organization / Company ID</Label>
            <Input
              value={form.company_id}
              onChange={(e) => onChange("company_id", e.target.value)}
              placeholder="123456789"
              disabled={disabled}
              className="h-9 border-gray-600 bg-gray-900 text-white disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Access Token <span className="text-gray-600 font-normal">(manual override)</span></Label>
            <p className="text-xs text-gray-500">Optional. Paste a long-lived token here to skip OAuth, or if your LinkedIn app is in development mode.</p>
            <SecretInput
              isSet={secretsSet.linkedin_access_token}
              value={form.access_token}
              onChange={(v) => onChange("access_token", v)}
              placeholder="AQV…"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onValidate}
            disabled={validating || !hasToken}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-sm text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {!hasToken && (
            <p className="text-xs text-gray-500">Connect via OAuth or save a token to test.</p>
          )}
        </div>

        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Remove all LinkedIn credentials?</span>
            <button
              type="button"
              onClick={async () => { await onClear(); setConfirmClear(false); setEditing(false); }}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Yes, clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/60 text-red-400 hover:bg-red-950/40 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear data
          </button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-green-900/50 bg-green-950/40 p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
        <p className="text-xs text-gray-300">
          Credentials are stored server-side and never exposed to the browser. Secrets are never returned after saving.
        </p>
      </div>
    </div>
  );
}

interface InstagramViewProps {
  form: { app_id: string; business_account_id: string; handles: string[]; app_secret: string; access_token: string };
  secretsSet: { instagram_app_secret: boolean; instagram_access_token: boolean };
  onChange: (field: string, value: string) => void;
  onHandlesChange: (handles: string[]) => void;
  onValidate: () => Promise<void>;
  onClear: () => Promise<void>;
  validating: boolean;
  clearing: boolean;
}

function InstagramView({ form, secretsSet, onChange, onHandlesChange, onValidate, onClear, validating, clearing }: InstagramViewProps) {
  const [handleInput, setHandleInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const disabled = !editing;

  function addHandle() {
    const v = handleInput.trim().replace(/^@?/, "@");
    if (v === "@" || form.handles.includes(v)) return;
    onHandlesChange([...form.handles, v]);
    setHandleInput("");
  }

  return (
    <div className="space-y-6 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-start justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Instagram Integration</h2>
          <p className="mt-1 text-sm text-gray-400">
            Track company Instagram posts and employee engagement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            editing
              ? "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white"
              : "border-green-700 bg-green-500/10 text-green-400 hover:bg-green-500/20"
          )}
        >
          {editing ? (
            <><X className="h-3.5 w-3.5" /> Cancel</>
          ) : (
            <><Pencil className="h-3.5 w-3.5" /> Edit</>
          )}
        </button>
      </div>

      <div className={cn("space-y-3 transition-opacity", disabled && "opacity-60")}>
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-300">Instagram Handles</Label>
            <span className="text-xs font-medium text-green-400">{form.handles.length} added</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">All official company Instagram accounts to monitor.</p>
        </div>
        <div className="space-y-2">
          {form.handles.map((h) => (
            <div key={h} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                  <Camera className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-white">{h}</span>
              </div>
              {!disabled && (
                <button onClick={() => onHandlesChange(form.handles.filter((x) => x !== h))} className="text-gray-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <div className="flex gap-2">
              <Input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addHandle()}
                placeholder="@handle"
                className="h-9 border-gray-700 bg-gray-800 text-white"
              />
              <Button onClick={addHandle} className="h-9 shrink-0 gap-1.5 bg-green-600 text-white hover:bg-green-700">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-gray-300">API Credentials</Label>
          <p className="mt-0.5 text-xs text-gray-500">
            From the{" "}
            <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
              Meta for Developers
            </a>{" "}
            dashboard.
          </p>
        </div>
        <div className={cn("space-y-4 rounded-lg border border-gray-700 bg-gray-800 p-4 transition-opacity", disabled && "opacity-60")}>
          <div className="flex items-center gap-2 border-b border-gray-700 pb-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
              <Camera className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Instagram / Meta App</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">App ID</Label>
            <Input
              value={form.app_id}
              onChange={(e) => onChange("app_id", e.target.value)}
              placeholder="123456789012345"
              disabled={disabled}
              className="h-9 border-gray-600 bg-gray-900 text-white disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">App Secret</Label>
            <SecretInput
              isSet={secretsSet.instagram_app_secret}
              value={form.app_secret}
              onChange={(v) => onChange("app_secret", v)}
              placeholder="Your Meta app secret"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Business Account ID</Label>
            <Input
              value={form.business_account_id}
              onChange={(e) => onChange("business_account_id", e.target.value)}
              placeholder="17841400000000000"
              disabled={disabled}
              className="h-9 border-gray-600 bg-gray-900 text-white disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-400">Access Token</Label>
            <p className="text-xs text-gray-500">Long-lived page token with instagram_basic, pages_read_engagement scopes.</p>
            <SecretInput
              isSet={secretsSet.instagram_access_token}
              value={form.access_token}
              onChange={(v) => onChange("access_token", v)}
              placeholder="EAAxxxxxxx…"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onValidate}
            disabled={validating || !secretsSet.instagram_access_token}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-sm text-gray-300 hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {!secretsSet.instagram_access_token && (
            <p className="text-xs text-gray-500">Save an access token first to test.</p>
          )}
        </div>

        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Remove all Instagram credentials?</span>
            <button
              type="button"
              onClick={async () => { await onClear(); setConfirmClear(false); setEditing(false); }}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Yes, clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/60 text-red-400 hover:bg-red-950/40 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear data
          </button>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-green-900/50 bg-green-950/40 p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
        <p className="text-xs text-gray-300">
          Credentials are stored server-side and never exposed to the browser. Secrets are never returned after saving.
        </p>
      </div>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export function SettingsClient({
  initialSettings,
  linkedInConnectionStatus = "disconnected",
  oauthResult,
  oauthReason,
  initialTab = "linkedin",
}: {
  userEmail?: string;
  initialSettings: OrgCredentialsPublic | null;
  linkedInConnectionStatus?: "connected" | "error" | "disconnected";
  oauthResult?: "connected" | "error";
  oauthReason?: string;
  initialTab?: "linkedin" | "instagram";
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const {
    linkedIn, setLinkedIn,
    instagram, setInstagram,
    secretsSet,
    saving, save,
    clearing, clearLinkedIn, clearInstagram,
    validating, testLinkedIn, testInstagram,
  } = useOrgSettings(initialSettings);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <div className="flex items-start justify-between px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-400">Platform configuration for BrandPulse</p>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="gap-2 bg-green-500 font-medium text-white hover:bg-green-600 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="flex flex-1 gap-5 px-8 pb-8">
        <nav className="h-fit w-44 shrink-0 space-y-0.5 rounded-xl border border-gray-800 bg-gray-900 p-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                activeTab === id
                  ? "border-l-2 border-green-500 bg-green-500/10 pl-[10px] text-green-400"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === "linkedin" && (
            <LinkedInView
              form={linkedIn}
              secretsSet={{ linkedin_client_secret: secretsSet.linkedin_client_secret, linkedin_access_token: secretsSet.linkedin_access_token }}
              connectionStatus={linkedInConnectionStatus}
              oauthResult={oauthResult}
              oauthReason={oauthReason}
              onChange={(field, value) => setLinkedIn((f) => ({ ...f, [field]: value }))}
              onValidate={testLinkedIn}
              onClear={clearLinkedIn}
              validating={validating === "linkedin"}
              clearing={clearing === "linkedin"}
            />
          )}

          {activeTab === "instagram" && (
            <InstagramView
              form={instagram}
              secretsSet={{ instagram_app_secret: secretsSet.instagram_app_secret, instagram_access_token: secretsSet.instagram_access_token }}
              onChange={(field, value) => setInstagram((f) => ({ ...f, [field]: value }))}
              onHandlesChange={(handles) => setInstagram((f) => ({ ...f, handles }))}
              onValidate={testInstagram}
              onClear={clearInstagram}
              validating={validating === "instagram"}
              clearing={clearing === "instagram"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
