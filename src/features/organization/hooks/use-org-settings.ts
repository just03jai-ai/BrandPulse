"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  updateOrganizationSettings,
  validateLinkedInConnection,
  validateInstagramConnection,
} from "@/app/actions/organization";
import type { OrgCredentialsPublic, OrgCredentialsInput } from "../types";

export type LinkedInForm = {
  company_url: string;
  client_id: string;
  company_id: string;
  client_secret: string;  // write-only; empty = don't overwrite stored value
  access_token: string;   // write-only; empty = don't overwrite stored value
};

export type InstagramForm = {
  app_id: string;
  business_account_id: string;
  handles: string[];
  app_secret: string;    // write-only
  access_token: string;  // write-only
};

export function useOrgSettings(initial: OrgCredentialsPublic | null) {
  const [linkedIn, setLinkedIn] = useState<LinkedInForm>({
    company_url: initial?.linkedin_company_url ?? "",
    client_id: initial?.linkedin_client_id ?? "",
    company_id: initial?.linkedin_company_id ?? "",
    client_secret: "",
    access_token: "",
  });

  const [instagram, setInstagram] = useState<InstagramForm>({
    app_id: initial?.instagram_app_id ?? "",
    business_account_id: initial?.instagram_business_account_id ?? "",
    handles: initial?.instagram_handles ?? [],
    app_secret: "",
    access_token: "",
  });

  const [secretsSet] = useState({
    linkedin_client_secret: initial?.has_linkedin_client_secret ?? false,
    linkedin_access_token: initial?.has_linkedin_access_token ?? false,
    instagram_app_secret: initial?.has_instagram_app_secret ?? false,
    instagram_access_token: initial?.has_instagram_access_token ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<"linkedin" | "instagram" | null>(null);

  async function save() {
    setSaving(true);
    try {
      const input: OrgCredentialsInput = {
        linkedin_company_url: linkedIn.company_url,
        linkedin_client_id: linkedIn.client_id,
        linkedin_company_id: linkedIn.company_id,
        instagram_app_id: instagram.app_id,
        instagram_business_account_id: instagram.business_account_id,
        instagram_handles: instagram.handles,
      };

      // Only include secrets when the user typed something new
      if (linkedIn.client_secret.trim()) input.linkedin_client_secret = linkedIn.client_secret.trim();
      if (linkedIn.access_token.trim()) input.linkedin_access_token = linkedIn.access_token.trim();
      if (instagram.app_secret.trim()) input.instagram_app_secret = instagram.app_secret.trim();
      if (instagram.access_token.trim()) input.instagram_access_token = instagram.access_token.trim();

      const result = await updateOrganizationSettings(input);
      if (result.error) throw new Error(result.error);

      // Clear write-only fields after successful save
      setLinkedIn((f) => ({ ...f, client_secret: "", access_token: "" }));
      setInstagram((f) => ({ ...f, app_secret: "", access_token: "" }));
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function testLinkedIn() {
    setValidating("linkedin");
    try {
      const result = await validateLinkedInConnection();
      if (result.valid) {
        toast.success("LinkedIn connection verified.");
      } else {
        toast.error(result.error ?? "LinkedIn validation failed.");
      }
    } finally {
      setValidating(null);
    }
  }

  async function testInstagram() {
    setValidating("instagram");
    try {
      const result = await validateInstagramConnection();
      if (result.valid) {
        toast.success("Instagram connection verified.");
      } else {
        toast.error(result.error ?? "Instagram validation failed.");
      }
    } finally {
      setValidating(null);
    }
  }

  return {
    linkedIn, setLinkedIn,
    instagram, setInstagram,
    secretsSet,
    saving, save,
    validating, testLinkedIn, testInstagram,
  };
}
