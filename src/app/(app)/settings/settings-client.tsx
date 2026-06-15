"use client";

import { Link2, Camera, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export function SettingsClient({ userEmail }: { userEmail: string }) {
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSaveOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    // TODO: upsert organization record
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Organization saved.");
    setSaving(false);
  }

  function handleLinkedInConnect() {
    toast.info("LinkedIn OAuth coming soon. Wire up LINKEDIN_CLIENT_ID in .env.local first.");
  }

  function handleInstagramConnect() {
    toast.info("Instagram OAuth coming soon. Wire up META_APP_ID in .env.local first.");
  }

  return (
    <div className="space-y-6">
      {/* Account */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Account</h2>
        <div className="space-y-1.5">
          <Label className="text-gray-400 text-sm">Email</Label>
          <p className="text-white text-sm">{userEmail}</p>
        </div>
      </section>

      {/* Organization */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Organization</h2>
        <form onSubmit={handleSaveOrg} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Organization Name</Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="FarMart"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500 max-w-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </section>

      {/* Social Connections */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-1">Social Connections</h2>
        <p className="text-gray-400 text-sm mb-5">
          Connect your company LinkedIn and Instagram accounts to start pulling engagement data.
        </p>

        <div className="space-y-3">
          {/* LinkedIn */}
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0077B5]/20 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-[#0077B5]" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">LinkedIn</p>
                <p className="text-gray-500 text-xs">Pull likes, comments, and shares</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <AlertCircle className="w-3.5 h-3.5" />
                Not connected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLinkedInConnect}
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 text-xs h-7"
              >
                Connect
              </Button>
            </div>
          </div>

          {/* Instagram */}
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-pink-900/30 flex items-center justify-center">
                <Camera className="w-4 h-4 text-pink-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Instagram</p>
                <p className="text-gray-500 text-xs">Pull likes and comments (Business accounts)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <AlertCircle className="w-3.5 h-3.5" />
                Not connected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleInstagramConnect}
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 text-xs h-7"
              >
                Connect
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CSV Template Download */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-1">CSV Import Template</h2>
        <p className="text-gray-400 text-sm mb-4">
          Download the template to bulk import employees. Required columns:{" "}
          <code className="text-violet-400">name</code>,{" "}
          <code className="text-violet-400">email</code>. Optional:{" "}
          <code className="text-violet-400">department</code>,{" "}
          <code className="text-violet-400">title</code>,{" "}
          <code className="text-violet-400">linkedin_url</code>.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
          onClick={() => {
            const csv =
              "name,email,department,title,linkedin_url\nJane Smith,jane@company.com,Marketing,Brand Manager,https://www.linkedin.com/in/janesmith";
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "brandpulse-employees-template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download Template
        </Button>
      </section>
    </div>
  );
}
