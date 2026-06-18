/** Safe to send to the client — secrets replaced with boolean indicators */
export interface OrgCredentialsPublic {
  // LinkedIn — public fields
  linkedin_company_url: string | null;
  linkedin_client_id: string | null;
  linkedin_company_id: string | null;
  // LinkedIn — secret indicators (actual values never leave the server)
  has_linkedin_client_secret: boolean;
  has_linkedin_access_token: boolean;

  // Instagram — public fields
  instagram_app_id: string | null;
  instagram_business_account_id: string | null;
  instagram_handles: string[] | null;
  // Instagram — secret indicators
  has_instagram_app_secret: boolean;
  has_instagram_access_token: boolean;
}

/** Input accepted by updateOrgSettings — empty string means "leave unchanged" */
export interface OrgCredentialsInput {
  linkedin_company_url?: string;
  linkedin_client_id?: string;
  linkedin_client_secret?: string;  // only update when non-empty
  linkedin_access_token?: string;   // only update when non-empty
  linkedin_company_id?: string;
  instagram_app_id?: string;
  instagram_app_secret?: string;    // only update when non-empty
  instagram_access_token?: string;  // only update when non-empty
  instagram_business_account_id?: string;
  instagram_handles?: string[];
}

/**
 * Server-only shape consumed by sync jobs and cron routes.
 * Never serialise this to the client.
 */
export interface SyncConfig {
  orgId: string;
  linkedin: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    companyId: string;
    companyUrl: string;
  } | null;
  instagram: {
    appId: string;
    appSecret: string;
    accessToken: string;
    businessAccountId: string;
    handles: string[];
  } | null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
