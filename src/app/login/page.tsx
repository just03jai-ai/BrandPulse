"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      toast.error(error.message);
    } else if (mode === "signup") {
      toast.success("Check your email to confirm your account.");
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-600">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">BrandPulse</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h1 className="text-lg font-semibold text-white mb-6">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-violet-400 hover:text-violet-300 font-medium"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
