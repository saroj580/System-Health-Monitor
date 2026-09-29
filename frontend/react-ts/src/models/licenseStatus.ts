// models/licenseStatus.ts
// TypeScript interfaces for the offline license and trial verification system.

export interface LicenseStatus {
  is_valid: boolean;
  message: string;
  is_trial?: boolean;
  trial_available?: boolean;
  days_left?: number | null;
  licensee_name?: string | null;
  licensee_email?: string | null;
  expires_at?: string | null;
}

export type LicenseState =
  | 'checking'     // startup: waiting for GET /api/license/status
  | 'unlicensed'   // no valid license/trial → show ActivationView
  | 'licensed';    // valid license or active trial → show DashboardView
