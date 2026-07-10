import React, { useState, useEffect, useRef } from 'react';
import {
  type DashboardConfig,
  type HistoryState,
  type AlertLogEntry,
  type EmailLogEntry,
  type ToastMessage,
} from './types';
import { useLiveData } from './hooks/useLiveData';
import { Login } from './components/Login';
import { MetricsGrid } from './components/MetricsGrid';
import { TrendsChart } from './components/TrendsChart';
import { HealthCard } from './components/HealthCard';
import { MLPlanner } from './components/MLPlanner';
import { EmailDispatcher } from './components/EmailDispatcher';
import { AlertLogs } from './components/AlertLogs';
import { ToastContainer } from './components/ToastContainer';
import { Zap, User, LogOut, Settings, RotateCcw, Save, ShieldAlert, Calculator, Sliders } from 'lucide-react';

const DEFAULT_CONFIG: DashboardConfig = {
  overVoltage: 245,
  underVoltage: 205,
  maxPower: 3000,
  maxEnergy: 50,
  tariff: 7.50,
  thingerUsername: 'KADHIR',
  thingerDeviceId: '123',
  thingerResourceName: 'metrics',
  thingerAccessToken: '-c0vw7#nzINhOI3G',
  useSeparateMetrics: false,
  metricsConfig: {
    voltage: { resource: 'voltage', token: '' },
    current: { resource: 'current', token: '' },
    power: { resource: 'power', token: '' },
    energy: { resource: 'energy', token: '' },
  },
  thingerDemoMode: false,
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loggedInUser, setLoggedInUser] = useState<string>('Guest');
  const [isThingerMode, setIsThingerMode] = useState<boolean>(false);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [peakCurrent, setPeakCurrent] = useState<number>(0);
  const [energyOffset, setEnergyOffset] = useState<number>(0);

  // Recent logs state
  const [alertLogs, setAlertLogs] = useState<AlertLogEntry[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Local storage alert toggles
  const [autoAlertsEnabled, setAutoAlertsEnabled] = useState<boolean>(true);
  const [recipientEmail, setRecipientEmail] = useState<string>('');

  // 20 points rolling history
  const [history, setHistory] = useState<HistoryState>({
    timestamps: [],
    voltage: [],
    current: [],
    power: [],
    energy: [],
  });

  const activeAlertsRef = useRef<{ [key: string]: boolean }>({});

  // 1. Restore sessions & config from localStorage on bootup
  useEffect(() => {
    // Restore email settings
    const savedEmail = localStorage.getItem('smart_meter_alert_email') || '';
    setRecipientEmail(savedEmail);

    const savedAutoAlerts = localStorage.getItem('smart_meter_auto_alerts') !== 'false';
    setAutoAlertsEnabled(savedAutoAlerts);

    // Restore threshold settings
    const savedConfig = localStorage.getItem('gridpulse_thresholds');
    if (savedConfig) {
      try {
        setConfig((prev) => ({ ...prev, ...JSON.parse(savedConfig) }));
      } catch (e) {
        console.warn('Failed parsing saved thresholds config');
      }
    }

    // Prepopulate rolling history with zeros (Offline start)
    const now = Date.now();
    const initTimestamps: string[] = [];
    const initZeros: number[] = [];
    for (let i = 19; i >= 0; i--) {
      const timestamp = new Date(now - i * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      initTimestamps.push(timestamp);
      initZeros.push(0);
    }
    setHistory({
      timestamps: initTimestamps,
      voltage: [...initZeros],
      current: [...initZeros],
      power: [...initZeros],
      energy: [...initZeros],
    });

    // Check active user session
    const savedSession = localStorage.getItem('gridpulse_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setIsLoggedIn(true);
        setLoggedInUser(session.username);
        setIsThingerMode(session.isThingerMode || false);
        showToast('Session Restored', `Welcome back, ${session.username}!`, 'success');
      } catch (e) {
        localStorage.removeItem('gridpulse_session');
      }
    }
  }, []);

  // Sync auto alert and email changes to localStorage
  const handleToggleAutoAlerts = (enabled: boolean) => {
    setAutoAlertsEnabled(enabled);
    localStorage.setItem('smart_meter_auto_alerts', String(enabled));
  };

  const handleRecipientEmailChange = (email: string) => {
    setRecipientEmail(email);
    localStorage.setItem('smart_meter_alert_email', email);
  };

  // 2. Fetch live data using our secure custom hook
  const { data: liveData, error, isLoading } = useLiveData(
    {
      username: config.thingerUsername,
      deviceId: config.thingerDeviceId,
      token: config.thingerAccessToken,
      resource: config.thingerResourceName,
      useSeparateMetrics: config.useSeparateMetrics,
      metricsConfig: config.metricsConfig,
      demoMode: config.thingerDemoMode,
    },
    isLoggedIn
  );

  // Helper helper to push Toasts
  const showToast = (title: string, message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString() + '_' + Math.random().toString().substring(2, 6);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // Auto-remove after 5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleRemoveToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getAlarmHeading = (key: string) => {
    switch (key) {
      case 'overVoltage': return 'Over-Voltage Violation';
      case 'underVoltage': return 'Under-Voltage Violation';
      case 'maxPower': return 'Power Overload Alert';
      case 'maxEnergy': return 'Energy Budget Expended';
      default: return 'System Alert Warning';
    }
  };

  const triggerAlarmCheck = (key: string, isTriggered: boolean, message: string, measuredValue: string) => {
    const wasTriggered = activeAlertsRef.current[key];
    if (isTriggered && !wasTriggered) {
      activeAlertsRef.current[key] = true;
      
      const newAlert: AlertLogEntry = {
        id: Date.now().toString() + '_' + key,
        timestamp: new Date().toLocaleTimeString(),
        description: message,
        value: measuredValue,
        severity: key === 'overVoltage' || key === 'maxPower' ? 'CRITICAL' : 'WARNING',
      };
      setAlertLogs((prev) => [newAlert, ...prev].slice(0, 25));
      showToast(getAlarmHeading(key), message, 'danger');

      // Automated email alert
      if (autoAlertsEnabled && recipientEmail && recipientEmail.includes('@')) {
        const heading = getAlarmHeading(key);
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientEmail,
            subject: `🚨 [GRIDPULSE THRESHOLD ALERT] ${heading}`,
            message: `GridPulse Smart Energy Alert Triggered:\n\nViolation: ${heading}\nMessage: ${message}\nMeasured Parameter: ${measuredValue}\nTimestamp: ${new Date().toLocaleString()}\n\nGridPulse Automated Grid Safety System`,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            setEmailLogs((prev) => [
              {
                id: Date.now().toString() + '_auto',
                to: recipientEmail,
                subject: `🚨 [AUTO ALERT] ${heading}`,
                sentAt: new Date().toLocaleTimeString(),
                status: data.mode === 'SMTP' ? 'DELIVERED' : 'SIMULATED',
              },
              ...prev,
            ]);
          })
          .catch((err) => console.warn('Failed automated email dispatch:', err));
      }
    } else if (!isTriggered && wasTriggered) {
      activeAlertsRef.current[key] = false;

      const newAlert: AlertLogEntry = {
        id: Date.now().toString() + '_' + key + '_reset',
        timestamp: new Date().toLocaleTimeString(),
        description: `System Alert Restored: parameters returned within safe baseline bounds.`,
        value: 'Resolved',
        severity: 'NORMAL',
      };
      setAlertLogs((prev) => [newAlert, ...prev].slice(0, 25));
      showToast(`${getAlarmHeading(key)} Resolved`, 'Energy parameter has returned to standard operating margins.', 'success');
    }
  };

  // 3. Telemetry evaluations: updates history and evaluates safety thresholds
  useEffect(() => {
    if (!liveData || !isLoggedIn) return;

    // Apply offset for energy calculations if active
    const finalEnergy = Math.max(0.0, liveData.energy - energyOffset);
    const resolvedData = {
      ...liveData,
      energy: finalEnergy,
    };

    // Track Peak Current
    if (resolvedData.current > peakCurrent) {
      setPeakCurrent(resolvedData.current);
    }

    // Append to rolling history
    setHistory((prev) => {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        timestamps: [...prev.timestamps, timestamp].slice(-20),
        voltage: [...prev.voltage, resolvedData.voltage].slice(-20),
        current: [...prev.current, resolvedData.current].slice(-20),
        power: [...prev.power, resolvedData.power].slice(-20),
        energy: [...prev.energy, resolvedData.energy].slice(-20),
      };
    });

    // Evaluate electrical safety rules
    const { overVoltage, underVoltage, maxPower, maxEnergy } = config;

    // Check Overvoltage
    if (resolvedData.voltage > overVoltage) {
      triggerAlarmCheck('overVoltage', true, `Critical High Voltage Warning! Measured ${resolvedData.voltage}V, exceeding safe limit of ${overVoltage}V.`, `${resolvedData.voltage} V`);
    } else {
      triggerAlarmCheck('overVoltage', false, '', '');
    }

    // Check Undervoltage
    if (resolvedData.voltage < underVoltage && resolvedData.voltage > 50) {
      triggerAlarmCheck('underVoltage', true, `Low Voltage Warning! Grid drop detected at ${resolvedData.voltage}V, below threshold of ${underVoltage}V.`, `${resolvedData.voltage} V`);
    } else {
      triggerAlarmCheck('underVoltage', false, '', '');
    }

    // Check Overpower overload
    if (resolvedData.power > maxPower) {
      triggerAlarmCheck('maxPower', true, `System Overload Alert! Wattage drawn is ${resolvedData.power}W, exceeding threshold of ${maxPower}W.`, `${resolvedData.power} W`);
    } else {
      triggerAlarmCheck('maxPower', false, '', '');
    }

    // Check energy target limit
    if (resolvedData.energy > maxEnergy) {
      triggerAlarmCheck('maxEnergy', true, `Monthly Budget Limit Crossed! Energy consumption is ${resolvedData.energy.toFixed(2)} kWh, exceeding target limit of ${maxEnergy} kWh.`, `${resolvedData.energy.toFixed(2)} kWh`);
    } else {
      triggerAlarmCheck('maxEnergy', false, '', '');
    }
  }, [liveData, isLoggedIn, energyOffset]);

  // Handle Login success
  const handleLoginSuccess = (user: string, configUpdates: Partial<DashboardConfig>, isThinger: boolean) => {
    const updated = { ...config, ...configUpdates };
    setConfig(updated);
    setIsLoggedIn(true);
    setLoggedInUser(user);
    setIsThingerMode(isThinger);

    // Save session
    localStorage.setItem(
      'gridpulse_session',
      JSON.stringify({
        username: user,
        isThingerMode: isThinger,
        timestamp: Date.now(),
      })
    );

    // Save configuration thresholds
    localStorage.setItem('gridpulse_thresholds', JSON.stringify(updated));

    showToast('Login Successful', `Access granted as ${user}.`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('gridpulse_session');
    setIsLoggedIn(false);
    setLoggedInUser('Guest');
    setIsSettingsOpen(false);
    showToast('Logged Out', 'Session closed successfully.', 'info');
  };

  // Settings drawer saving handlers
  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const updated: DashboardConfig = {
      ...config,
      overVoltage: parseFloat(data.get('overVoltage') as string) || DEFAULT_CONFIG.overVoltage,
      underVoltage: parseFloat(data.get('underVoltage') as string) || DEFAULT_CONFIG.underVoltage,
      maxPower: parseFloat(data.get('maxPower') as string) || DEFAULT_CONFIG.maxPower,
      maxEnergy: parseFloat(data.get('maxEnergy') as string) || DEFAULT_CONFIG.maxEnergy,
      tariff: parseFloat(data.get('tariff') as string) || DEFAULT_CONFIG.tariff,
      thingerUsername: data.get('thingerUsername') as string || config.thingerUsername,
      thingerDeviceId: data.get('thingerDeviceId') as string || config.thingerDeviceId,
      thingerResourceName: data.get('thingerResourceName') as string || config.thingerResourceName,
      thingerAccessToken: data.get('thingerAccessToken') as string || config.thingerAccessToken,
      useSeparateMetrics: data.get('useSeparateMetrics') === 'on',
      thingerDemoMode: data.get('thingerDemoMode') === 'on',
    };

    setConfig(updated);
    localStorage.setItem('gridpulse_thresholds', JSON.stringify(updated));
    setIsSettingsOpen(false);
    showToast('Settings Saved', 'Grid diagnostics parameters updated.', 'success');
  };

  const handleResetSettings = () => {
    setConfig(DEFAULT_CONFIG);
    localStorage.setItem('gridpulse_thresholds', JSON.stringify(DEFAULT_CONFIG));
    showToast('Defaults Restored', 'Standard Department of ECE baselines loaded.', 'info');
  };

  // Reset local cumulative energy
  const handleResetEnergy = () => {
    if (window.confirm('Are you sure you want to reset accumulated energy offset on this browser session?')) {
      if (liveData) {
        setEnergyOffset(liveData.energy);
        showToast('Energy Reset', 'Accrued consumption set to 0.00 kWh.', 'info');
      }
    }
  };

  // Calculate bill estimations
  const currentEnergy = liveData ? Math.max(0, liveData.energy - energyOffset) : 0;
  const tariff = config.tariff;
  const accruedCost = currentEnergy * tariff;

  // Monthly projections
  const elapsedDaysSimulated = 7.5;
  const totalDaysCycle = 30.0;
  const remainingDays = totalDaysCycle - elapsedDaysSimulated;
  const currentKW = (liveData?.power || 0) / 1000.0;
  const remainingHours = remainingDays * 24;
  const averageDutyFactor = 0.40;

  const estimatedRemainingKWh = currentKW * remainingHours * averageDutyFactor;
  const projectedMonthlyKWh = liveData ? (currentEnergy + estimatedRemainingKWh) : 0;
  const projectedBill = projectedMonthlyKWh * tariff;

  const budgetProgressPct = Math.min(100, (currentEnergy / config.maxEnergy) * 100);

  // If user is not authenticated, show the login screen
  if (!isLoggedIn) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} savedConfig={config} />
        <ToastContainer toasts={toasts} onRemove={handleRemoveToast} />
      </>
    );
  }

  // Active metrics object for the grid and health index
  const activeMetrics = liveData
    ? {
        voltage: liveData.voltage,
        current: liveData.current,
        power: liveData.power,
        energy: Math.max(0, liveData.energy - energyOffset),
        frequency: liveData.frequency,
        powerFactor: liveData.powerFactor,
      }
    : {
        voltage: 0,
        current: 0,
        power: 0,
        energy: 0,
        frequency: 0,
        powerFactor: 0,
      };

  const isOnline = liveData ? !liveData.isSimulated && !liveData.fallbackActive : false;
  const statusText = liveData
    ? liveData.isSimulated || liveData.fallbackActive
      ? 'Demo Mode (Simulation Fallback)'
      : 'Device Online (Streaming Thinger.io)'
    : 'Connecting to server...';

  const progressColor = () => {
    if (budgetProgressPct >= 90) return 'var(--danger)';
    if (budgetProgressPct >= 70) return 'var(--warning)';
    return 'var(--primary)';
  };

  return (
    <div className="dashboard-container" id="main-dashboard" style={{ display: 'block', minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem' }}>
      
      {/* Top Header / Navigation Bar */}
      <header className="header" id="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="brand" id="brand-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="brand-icon" id="brand-logo" style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
            <Zap style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>GridPulse</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Smart Energy Meter Simulation & Analytics Console</p>
          </div>
        </div>
        
        {/* Live System Status Widget */}
        <div className="system-status" id="system-status-widget" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          
          {/* User profile badge */}
          <div className="user-profile-badge" id="user-profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-accent)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            <User style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
            <span id="logged-in-user-name" style={{ fontWeight: 500 }}>{loggedInUser}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--danger)', marginLeft: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.15rem' }} title="Logout Session">
              <LogOut style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
          
          <div className={`status-indicator ${isOnline ? 'status-online' : 'status-offline'}`} id="connection-status">
            <span className="pulse-dot" id="status-dot"></span>
            <span id="status-text">{statusText}</span>
          </div>
          
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="settings-btn" id="toggle-settings-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Settings style={{ width: '14px', height: '14px' }} /> Settings
          </button>
        </div>
      </header>

      {/* Settings Drawer Panel (Collapsible) */}
      {isSettingsOpen && (
        <form onSubmit={handleSaveSettings} className="settings-drawer active" id="settings-drawer-panel" style={{ maxHeight: '85vh', overflowY: 'auto', marginBottom: '1.5rem', display: 'block', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            <Sliders style={{ width: '18px', height: '18px' }} /> Threshold & Alert Settings
          </h3>
          
          <div className="settings-grid" id="settings-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label htmlFor="over-voltage-threshold" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Over-Voltage Alert (V)</label>
              <input type="number" id="over-voltage-threshold" name="overVoltage" className="form-control" defaultValue={config.overVoltage} min="220" max="280" />
            </div>
            
            <div className="form-group">
              <label htmlFor="under-voltage-threshold" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Under-Voltage Alert (V)</label>
              <input type="number" id="under-voltage-threshold" name="underVoltage" className="form-control" defaultValue={config.underVoltage} min="180" max="240" />
            </div>
            
            <div className="form-group">
              <label htmlFor="overload-threshold" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Overload Threshold (Watts)</label>
              <input type="number" id="overload-threshold" name="maxPower" className="form-control" defaultValue={config.maxPower} min="500" max="10000" />
            </div>
            
            <div className="form-group">
              <label htmlFor="budget-target-threshold" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Target Energy Limit (kWh)</label>
              <input type="number" id="budget-target-threshold" name="maxEnergy" className="form-control" defaultValue={config.maxEnergy} min="5" max="1000" />
            </div>

            <div className="form-group">
              <label htmlFor="tariff-rate-threshold" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Base Tariff (₹/kWh)</label>
              <input type="number" id="tariff-rate-threshold" name="tariff" className="form-control" defaultValue={config.tariff} step="0.10" min="0" />
            </div>
          </div>

          <h3 style={{ margin: '1.5rem 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            <Zap style={{ width: '18px', height: '18px' }} /> Thinger.io IoT Server Credentials
          </h3>

          <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Thinger.io Username</label>
              <input type="text" name="thingerUsername" className="form-control" defaultValue={config.thingerUsername} placeholder="Thinger.io Username" />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Device ID</label>
              <input type="text" name="thingerDeviceId" className="form-control" defaultValue={config.thingerDeviceId} placeholder="esp32_energy" />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Resource Name</label>
              <input type="text" name="thingerResourceName" className="form-control" defaultValue={config.thingerResourceName} placeholder="metrics" />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Device Access Token (Bearer Token)</label>
              <input type="password" name="thingerAccessToken" className="form-control" defaultValue={config.thingerAccessToken} placeholder="Bearer token string" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="thinger-demo-mode" name="thingerDemoMode" defaultChecked={config.thingerDemoMode} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="thinger-demo-mode" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                Enable Demo Mode (Generate simulated data if Thinger.io is offline)
              </label>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="use-separate-metrics" name="useSeparateMetrics" defaultChecked={config.useSeparateMetrics} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="use-separate-metrics" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                Advanced: Use Separate Tokens / Resources for Sensors
              </label>
            </div>
          </div>

          <div className="settings-actions" id="settings-drawer-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button type="button" onClick={handleResetSettings} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <RotateCcw style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Reset Defaults
            </button>
            <button type="submit" className="btn btn-primary" style={{ cursor: 'pointer', background: 'var(--primary)', color: '#09090b', fontWeight: 600 }}>
              <Save style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Update Settings
            </button>
          </div>
        </form>
      )}

      {/* Main Dashboard Grid */}
      <main className="dashboard-grid" id="dashboard-main-grid">
        
        {/* LEFT COLUMN: Live Meters & Trends Charts */}
        <div className="live-readings-column" id="left-layout-column">
          <MetricsGrid
            metrics={activeMetrics}
            isOnline={isLoggedIn}
            peakCurrent={peakCurrent}
            thresholds={config}
            onResetEnergy={handleResetEnergy}
          />

          <TrendsChart history={history} />
        </div>

        {/* RIGHT COLUMN: Health Score & Predictive Bill Card */}
        <div className="analytics-column" id="right-layout-column">
          
          <HealthCard
            metrics={activeMetrics}
            isOnline={isLoggedIn}
            thresholds={config}
          />

          {/* Predictive Bill Card */}
          <section className="card" id="card-bill-prediction" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator style={{ width: '18px', height: '18px' }} /> Electricity Bill Predictor
            </h3>
            
            <div className="predictive-bill-body" id="billing-prediction-body">
              <div className="tariff-input-row" id="tariff-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--bg-accent)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <span className="tariff-label" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Energy Tariff / Unit:</span>
                <div className="tariff-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="currency-symbol" style={{ fontWeight: 600, color: 'var(--primary)' }}>₹</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{config.tariff.toFixed(2)}</span>
                </div>
              </div>

              <div className="bill-calculations" id="billing-calculated-numbers" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="bill-calc-box" id="calc-box-current" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', textAlign: 'center' }}>
                  <div className="calc-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accrued Cost</div>
                  <div className="calc-val mono" id="current-cost-val" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>₹{accruedCost.toFixed(2)}</div>
                </div>
                
                <div className="bill-calc-box" id="calc-box-predicted" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', textAlign: 'center' }}>
                  <div className="calc-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Est. Month Bill</div>
                  <div className="calc-val mono" id="predicted-bill-val" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.2rem' }}>₹{projectedBill.toFixed(2)}</div>
                </div>
              </div>

              {/* Budget Progression Bar */}
              <div className="budget-alert-bar" id="budget-progress-bar-section">
                <div className="budget-progress-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  <span>Monthly Energy Target:</span>
                  <strong id="budget-target-label" style={{ color: 'var(--text-primary)' }}>{currentEnergy.toFixed(2)} / {config.maxEnergy} kWh</strong>
                </div>
                <div className="budget-progress-container" style={{ background: 'var(--bg-accent)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="budget-progress-fill" id="budget-progress-indicator" style={{ width: `${budgetProgressPct}%`, backgroundColor: progressColor(), height: '100%', transition: 'all 0.5s ease' }}></div>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* ML Energy Budget & Appliance Planner */}
        <MLPlanner
          onShowToast={showToast}
          tariffRate={config.tariff}
          lastMlPlan={null} // Controlled locally inside component
        />

        {/* Email dispatcher & alert logger */}
        <EmailDispatcher
          onShowToast={showToast}
          lastMlPlan={null}
          emailLogs={emailLogs}
          onAddLog={(log) => setEmailLogs((prev) => [log, ...prev])}
          autoAlertsEnabled={autoAlertsEnabled}
          onToggleAutoAlerts={handleToggleAutoAlerts}
          recipientEmail={recipientEmail}
          onRecipientEmailChange={handleRecipientEmailChange}
        />

        {/* Alert log threshold breaches */}
        <AlertLogs logs={alertLogs} />

      </main>

      <ToastContainer toasts={toasts} onRemove={handleRemoveToast} />
    </div>
  );
}
