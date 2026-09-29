// App.tsx — Root: License gate → Dashboard.
// On mount, checks GET /api/license/status via useLicense().
// If unlicensed → ActivationView (full-screen block).
// If licensed   → DashboardView with live stats & tasks.

import './index.css';
import { useSystemStats } from './controllers/useSystemStats';
import { useTaskRunner } from './controllers/useTaskRunner';
import { useLicense } from './controllers/useLicense';
import { DashboardView } from './views/DashboardView';
import { ActivationView } from './views/ActivationView';

function App() {
  const {
    licenseState,
    licenseInfo,
    activationError,
    isActivating,
    activate,
    startTrial,
    isStartingTrial,
    trialError,
  } = useLicense();

  // Always call hooks unconditionally (Rules of Hooks)
  const statsData = useSystemStats();
  const taskData = useTaskRunner();

  //  Startup splash 
  if (licenseState === 'checking') {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-10 h-10 animate-spin-ring text-cpu" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeDasharray="40" strokeDashoffset="20" />
          </svg>
          <span className="text-[0.8rem] text-slate-500 font-mono tracking-widest">
            INITIALIZING…
          </span>
        </div>
      </div>
    );
  }

  //  License gate 
  if (licenseState === 'unlicensed') {
    return (
      <ActivationView
        error={activationError}
        isLoading={isActivating}
        onActivate={activate}
        trialAvailable={licenseInfo?.trial_available ?? true}
        onStartTrial={startTrial}
        isStartingTrial={isStartingTrial}
        trialError={trialError}
      />
    );
  }

  //  Main dashboard 
  return <DashboardView statsData={statsData} taskData={taskData} licenseInfo={licenseInfo} />;
}

export default App;
