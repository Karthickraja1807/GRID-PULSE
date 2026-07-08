import React from 'react';
import { type MetricsState, type ThresholdConfig } from '../types';
import { Activity, Zap, Bolt, BatteryCharging, Percent, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface MetricsGridProps {
  metrics: MetricsState;
  isOnline: boolean;
  peakCurrent: number;
  thresholds: ThresholdConfig;
  onResetEnergy: () => void;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  isOnline,
  peakCurrent,
  thresholds,
  onResetEnergy,
}) => {
  const { voltage, current, power, energy, powerFactor, frequency } = metrics;

  // 1. Voltage Stability Badge
  const getVoltageStatus = () => {
    if (!isOnline) {
      return <span style={{ color: 'var(--danger)' }}>Grid Disconnected</span>;
    }
    if (voltage > thresholds.overVoltage) {
      return (
        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle style={{ width: '14px', height: '14px' }} /> Over-Voltage
        </span>
      );
    }
    if (voltage < thresholds.underVoltage) {
      return (
        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle style={{ width: '14px', height: '14px' }} /> Under-Voltage
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle style={{ width: '14px', height: '14px' }} /> Grid Stable
      </span>
    );
  };

  // 2. Current Gauge Bar
  const currentPercentage = Math.min(100, (current / 16.0) * 100); // 16A as limit
  const getGaugeColor = () => {
    if (current > 12) return 'var(--danger)';
    if (current > 7) return 'var(--warning)';
    return 'var(--success)';
  };

  // 3. Active Power Load Assessment
  const getPowerLoadStatus = () => {
    if (!isOnline) {
      return 'Load Status: Offline';
    }
    if (power > 2000) {
      return <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Critical Load (Heavy)</span>;
    }
    if (power > 800) {
      return <span style={{ color: 'var(--warning)', fontWeight: 500 }}>Medium Load</span>;
    }
    if (power > 30) {
      return <span style={{ color: 'var(--success)' }}>Normal Active Load</span>;
    }
    return 'Load: Standby / Low';
  };

  // 4. Energy Carbon Footprint
  const co2 = energy * 0.85;

  // 5. Power Factor Phase Indicator
  const getPfPhaseStatus = () => {
    if (!isOnline) {
      return 'Load Phase: N/A';
    }
    if (powerFactor > 0.95) {
      return 'Phase: Highly Resistive';
    }
    if (powerFactor < 0.85) {
      return <span style={{ color: 'var(--warning)', fontWeight: 500 }}>Phase: Highly Inductive</span>;
    }
    return 'Phase: Balanced Inductive';
  };

  return (
    <section className="metrics-grid" id="metrics-deck" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      
      {/* Voltage Card */}
      <div className="card voltage-card" id="card-voltage">
        <div className="card-header-simple">
          <span className="card-title-simple">Voltage</span>
          <div className="card-icon-container"><Activity style={{ width: '16px', height: '16px' }} /></div>
        </div>
        <div className="card-value mono" id="voltage-val">{voltage.toFixed(1)} V</div>
        <div className="card-subtext" id="voltage-status">
          {getVoltageStatus()}
        </div>
      </div>
      
      {/* Current Card */}
      <div className="card current-card" id="card-current">
        <div className="card-header-simple">
          <span className="card-title-simple">Current</span>
          <div className="card-icon-container"><Zap style={{ width: '16px', height: '16px' }} /></div>
        </div>
        <div className="card-value mono" id="current-val">{current.toFixed(2)} A</div>
        <div className="card-subtext" id="current-peak">
          Peak: {peakCurrent.toFixed(2)} A
        </div>
        <div className="gauge-bar-wrapper">
          <div className="gauge-bar" id="current-gauge" style={{ width: `${currentPercentage}%`, backgroundColor: getGaugeColor(), transition: 'all 0.5s ease' }}></div>
        </div>
      </div>
      
      {/* Active Power Card */}
      <div className="card power-card" id="card-power">
        <div className="card-header-simple">
          <span className="card-title-simple">Active Power</span>
          <div className="card-icon-container"><Bolt style={{ width: '16px', height: '16px' }} /></div>
        </div>
        <div className="card-value mono" id="power-val">{power.toFixed(1)} W</div>
        <div className="card-subtext" id="power-load">
          {getPowerLoadStatus()}
        </div>
      </div>
      
      {/* Energy Card */}
      <div className="card energy-card" id="card-energy">
        <div className="card-header-simple">
          <span className="card-title-simple">Total Energy</span>
          <button onClick={onResetEnergy} className="card-icon-container reset-btn-clickable" title="Reset Energy to 0 (Click to reset)" style={{ cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BatteryCharging className="energy-icon-default" style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div className="card-value mono" id="energy-val">{energy.toFixed(2)} kWh</div>
        <div className="card-subtext" id="carbon-footprint">
          Est CO₂: {co2.toFixed(2)} kg
        </div>
      </div>
      
      {/* Power Factor Card */}
      <div className="card pf-card" id="card-pf">
        <div className="card-header-simple">
          <span className="card-title-simple">Power Factor</span>
          <div className="card-icon-container"><Percent style={{ width: '16px', height: '16px' }} /></div>
        </div>
        <div className="card-value mono" id="pf-val">{powerFactor.toFixed(2)}</div>
        <div className="card-subtext" id="pf-phase">
          {getPfPhaseStatus()}
        </div>
      </div>

      {/* Grid Frequency Card */}
      <div className="card frequency-card" id="card-frequency">
        <div className="card-header-simple">
          <span className="card-title-simple">Grid Frequency</span>
          <div className="card-icon-container"><RefreshCw style={{ width: '16px', height: '16px' }} /></div>
        </div>
        <div className="card-value mono" id="frequency-val">{(frequency || 50.0).toFixed(2)} Hz</div>
        <div className="card-subtext" id="frequency-status">
          {!isOnline ? 'Offline' : 'Within normal limits (49.5 - 50.5 Hz)'}
        </div>
      </div>
      
    </section>
  );
};
export default MetricsGrid;
