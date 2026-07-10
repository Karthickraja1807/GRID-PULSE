import React, { useState, useEffect } from 'react';
import { type DashboardConfig } from '../types';
import { Zap, Sliders, Wifi, User, Lock, Cpu, Database, Key, Play, Plug, Info } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: string, config: Partial<DashboardConfig>, isThinger: boolean) => void;
  savedConfig: Partial<DashboardConfig>;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, savedConfig }) => {
  const [activeTab, setActiveTab] = useState<'simulation' | 'iot'>('simulation');
  
  // Simulation Mode form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');

  // Thinger.io form state
  const [thingerUsername, setThingerUsername] = useState(savedConfig.thingerUsername || 'KADHIR');
  const [thingerDeviceId, setThingerDeviceId] = useState(savedConfig.thingerDeviceId || '123');
  const [thingerResourceName, setThingerResourceName] = useState(savedConfig.thingerResourceName || 'metrics');
  const [thingerAccessToken, setThingerAccessToken] = useState(savedConfig.thingerAccessToken || '-c0vw7#nzINhOI3G');
  const [useSeparateMetrics, setUseSeparateMetrics] = useState(savedConfig.useSeparateMetrics || false);
  const [thingerDemoMode, setThingerDemoMode] = useState(savedConfig.thingerDemoMode !== undefined ? savedConfig.thingerDemoMode : false);

  // Separate metrics configuration state
  const [vResource, setVResource] = useState(savedConfig.metricsConfig?.voltage?.resource || 'voltage');
  const [vToken, setVToken] = useState(savedConfig.metricsConfig?.voltage?.token || '');
  const [iResource, setIResource] = useState(savedConfig.metricsConfig?.current?.resource || 'current');
  const [iToken, setIToken] = useState(savedConfig.metricsConfig?.current?.token || '');
  const [pResource, setPResource] = useState(savedConfig.metricsConfig?.power?.resource || 'power');
  const [pToken, setPToken] = useState(savedConfig.metricsConfig?.power?.token || '');
  const [eResource, setEResource] = useState(savedConfig.metricsConfig?.energy?.resource || 'energy');
  const [eToken, setEToken] = useState(savedConfig.metricsConfig?.energy?.token || '');

  // Local validation alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && password === 'admin123') {
      onLoginSuccess('Admin (Simulation)', {
        thingerDemoMode: true
      }, false);
    } else {
      setErrorMsg('Invalid username or passcode. (Use admin / admin123)');
    }
  };

  const handleIotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thingerUsername.trim() || !thingerDeviceId.trim()) {
      setErrorMsg('Please enter both your Username and Device ID.');
      return;
    }

    const metricsConfig = {
      voltage: { resource: vResource, token: vToken },
      current: { resource: iResource, token: iToken },
      power: { resource: pResource, token: pToken },
      energy: { resource: eResource, token: eToken }
    };

    onLoginSuccess(thingerUsername, {
      thingerUsername,
      thingerDeviceId,
      thingerResourceName,
      thingerAccessToken,
      useSeparateMetrics,
      thingerDemoMode,
      metricsConfig
    }, true);
  };

  return (
    <div className="login-container" id="login-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="login-card" style={{ maxHeight: '95vh', overflowY: 'auto', width: '450px', maxWidth: '90%', padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="login-brand-icon" style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', marginBottom: '1rem' }}>
            <Zap style={{ width: '28px', height: '28px' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>GridPulse Portal</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>IoT Smart Energy Meter Management Console</p>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        {/* Connection Option Tabs */}
        <div className="login-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--bg-accent)', padding: '0.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`login-tab-btn ${activeTab === 'simulation' ? 'active' : ''}`}
            onClick={() => { setActiveTab('simulation'); setErrorMsg(null); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', cursor: 'pointer', background: activeTab === 'simulation' ? 'var(--bg-card)' : 'none', color: activeTab === 'simulation' ? 'var(--primary)' : 'var(--text-secondary)' }}
          >
            <Sliders style={{ width: '14px', height: '14px' }} /> Simulation Mode
          </button>
          <button
            type="button"
            className={`login-tab-btn ${activeTab === 'iot' ? 'active' : ''}`}
            onClick={() => { setActiveTab('iot'); setErrorMsg(null); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', cursor: 'pointer', background: activeTab === 'iot' ? 'var(--bg-card)' : 'none', color: activeTab === 'iot' ? 'var(--primary)' : 'var(--text-secondary)' }}
          >
            <Wifi style={{ width: '14px', height: '14px' }} /> Thinger.io IoT Mode
          </button>
        </div>
        
        {/* Standard Username/Password Credentials Form */}
        {activeTab === 'simulation' && (
          <form id="local-login-form" onSubmit={handleSimSubmit} className="login-form active">
            <div className="form-info-alert" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '1rem', lineHeight: 1.4 }}>
              <Info style={{ color: 'var(--primary)', width: '16px', height: '16px', flexShrink: 0 }} />
              <span>Authenticate using your engineer credentials to access the live simulation dashboard and diagnostic monitoring suite.</span>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Engineer Username <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <User className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., admin"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                System Passcode <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <Lock className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passcode (Default: admin123)"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%', marginTop: '1rem', background: 'var(--primary)', color: '#09090b', fontWeight: 600, padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Play style={{ width: '16px', height: '16px' }} /> Access Dev Simulation Mode
            </button>
            
            <div className="credentials-hint" style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              <strong>Passcode Hint:</strong> Use Username: <code className="mono" style={{ background: 'var(--bg-accent)', padding: '2px 4px', borderRadius: '4px', color: 'var(--warning)' }}>admin</code> & Passcode: <code className="mono" style={{ background: 'var(--bg-accent)', padding: '2px 4px', borderRadius: '4px', color: 'var(--warning)' }}>admin123</code>
            </div>
          </form>
        )}

        {/* Thinger.io IoT Credentials Form */}
        {activeTab === 'iot' && (
          <form id="thinger-login-form" onSubmit={handleIotSubmit} className="login-form">
            <div className="form-info-alert" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              <Wifi style={{ color: 'var(--success)', width: '16px', height: '16px', flexShrink: 0 }} />
              <span>Connect directly to your ESP32 + ZMPT101B & ACS712 hardware nodes by entering your Thinger.io account parameters below.</span>
            </div>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Thinger.io Username <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <User className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  value={thingerUsername}
                  onChange={(e) => setThingerUsername(e.target.value)}
                  placeholder="Thinger.io account username"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Device ID <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <Cpu className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  value={thingerDeviceId}
                  onChange={(e) => setThingerDeviceId(e.target.value)}
                  placeholder="e.g., esp32_energy"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {!useSeparateMetrics && (
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Resource Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                  <Database className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    value={thingerResourceName}
                    onChange={(e) => setThingerResourceName(e.target.value)}
                    placeholder="e.g., metrics"
                    required
                    style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {!useSeparateMetrics && (
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Device Access Token <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                  <Key className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="form-control"
                    value={thingerAccessToken}
                    onChange={(e) => setThingerAccessToken(e.target.value)}
                    placeholder="Paste your bearer token here"
                    required
                    style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Demo Mode Fallback Checkbox */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
              <input
                type="checkbox"
                id="login-thinger-demo"
                checked={thingerDemoMode}
                onChange={(e) => setThingerDemoMode(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="login-thinger-demo" style={{ margin: 0, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Enable Demo Mode fallback if device is offline
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%', marginTop: '1rem', background: 'var(--success)', color: '#09090b', fontWeight: 600, padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Plug style={{ width: '16px', height: '16px' }} /> Connect & Stream Live Readings
            </button>
          </form>
        )}
        
        <div className="login-footer" style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>GridPulse IoT Smart Energy Management Platform &copy; 2026</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Designed for Final Year Presentation — Dept. of ECE</p>
        </div>
      </div>
    </div>
  );
};
export default Login;
