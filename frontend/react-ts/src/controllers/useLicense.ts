// controllers/useLicense.ts
// Hook that manages the license state machine supporting Model 1 (Key) and Model 2 (Trial).

import { useState, useEffect, useCallback } from 'react';
import type { LicenseState, LicenseStatus } from '../models/licenseStatus';
import { getLicenseStatus, activateLicense, startTrial as apiStartTrial } from '../services/licenseService';

export interface UseLicenseResult {
  licenseState: LicenseState;
  licenseInfo: LicenseStatus | null;
  activationError: string | null;
  isActivating: boolean;
  activate: (token: string) => Promise<void>;
  startTrial: (name: string, email: string) => Promise<void>;
  isStartingTrial: boolean;
  trialError: string | null;
}

export function useLicense(): UseLicenseResult {
  const [licenseState, setLicenseState] = useState<LicenseState>('checking');
  const [licenseInfo, setLicenseInfo] = useState<LicenseStatus | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  //  Startup check 
  useEffect(() => {
    let cancelled = false;

    getLicenseStatus()
      .then((status) => {
        if (cancelled) return;
        setLicenseInfo(status);
        setLicenseState(status.is_valid ? 'licensed' : 'unlicensed');
      })
      .catch(() => {
        // Backend not reachable yet — treat as unlicensed
        if (!cancelled) setLicenseState('unlicensed');
      });

    return () => { cancelled = true; };
  }, []);

  //  Model 1: Full License Activation 
  const activate = useCallback(async (token: string) => {
    setIsActivating(true);
    setActivationError(null);
    try {
      const status = await activateLicense(token.trim());
      setLicenseInfo(status);
      setLicenseState('licensed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      setActivationError(msg);
    } finally {
      setIsActivating(false);
    }
  }, []);

  //  Model 2: Start 7-Day Free Trial 
  const startTrial = useCallback(async (name: string, email: string) => {
    setIsStartingTrial(true);
    setTrialError(null);
    try {
      const status = await apiStartTrial(name, email);
      setLicenseInfo(status);
      setLicenseState('licensed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Trial activation failed.';
      setTrialError(msg);
    } finally {
      setIsStartingTrial(false);
    }
  }, []);

  return {
    licenseState,
    licenseInfo,
    activationError,
    isActivating,
    activate,
    startTrial,
    isStartingTrial,
    trialError,
  };
}
