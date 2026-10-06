// services/licenseService.ts
// API client for the /api/license/* endpoints.

import type { LicenseStatus } from '../models/licenseStatus';

const BASE = 'http://127.0.0.1:8003';


export async function getLicenseStatus(): Promise<LicenseStatus> {
  const res = await fetch(`${BASE}/api/license/status`);
  if (!res.ok) throw new Error(`License status check failed: ${res.status}`);
  return res.json();
}


export async function activateLicense(token: string): Promise<LicenseStatus> {
  const res = await fetch(`${BASE}/api/license/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data: LicenseStatus = await res.json();
  if (!res.ok) {
    const detail = (data as unknown as { detail?: string }).detail ?? 'Activation failed.';
    throw new Error(detail);
  }
  return data;
}


export async function startTrial(name: string, email: string): Promise<LicenseStatus> {
  const res = await fetch(`${BASE}/api/license/trial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  });
  const data: LicenseStatus = await res.json();
  if (!res.ok) {
    const detail = (data as unknown as { detail?: string }).detail ?? 'Trial activation failed.';
    throw new Error(detail);
  }
  return data;
}
