import React from 'react';
import { type MetricsState, type ThresholdConfig } from '../types';
import { ShieldCheck, Sliders, Activity, Percent, Bolt, Lightbulb } from 'lucide-react';

interface HealthCardProps {
  metrics: MetricsState;
  isOnline: boolean;
  thresholds: ThresholdConfig;
}

export const HealthCard: React.FC<HealthCardProps> = ({ metrics, isOnline, thresholds }) => {
  const { voltage, current, power, energy, powerFactor } = metrics;

  // 1. Calculate Grid Health Score (0 - 100)
  const calculateScore = () => {
    if (!isOnline) return 0;

    // Voltage safety score (deviation from 230V baseline)
    const vDev = Math.abs(voltage - 230);
    let vScore = 100 - vDev * 3.0;
    vScore = Math.max(0, Math.min(100, vScore));

    // Power Factor quality score (optimal is 1.0)
    let pfScore = 100;
    if (powerFactor < 0.90) {
      pfScore = 100 - (0.90 - powerFactor) * 150;
    }
    pfScore = Math.max(0, Math.min(100, pfScore));

    // Current Load margin score (rating limit 16.0 A)
    let loadScore = 100;
    if (current > 10.0) {
      loadScore = 100 - (current - 10.0) * 16.6;
    }
    loadScore = Math.max(0, Math.min(100, loadScore));

    // Weightings: 40% Voltage, 40% PF, 20% Load safety margin
    const finalScore = Math.round(vScore * 0.40 + pfScore * 0.40 + loadScore * 0.20);
    return Math.max(0, Math.min(100, finalScore));
  };

  const score = calculateScore();

  // Determine badge styling based on score
  const getScoreDetails = () => {
    if (!isOnline) {
      return { text: 'Offline', colorClass: 'health-poor', strokeColor: 'var(--danger)' };
    }
    if (score >= 90) {
      return { text: 'Excellent', colorClass: 'health-excellent', strokeColor: 'var(--success)' };
    }
    if (score >= 75) {
      return { text: 'Good', colorClass: 'health-good', strokeColor: 'var(--primary)' };
    }
    if (score >= 50) {
      return { text: 'Fair', colorClass: 'health-fair', strokeColor: 'var(--warning)' };
    }
    return { text: 'Poor', colorClass: 'health-poor', strokeColor: 'var(--danger)' };
  };

  const { text: statusText, colorClass, strokeColor } = getScoreDetails();

  // Circle radius 58, perimeter is 2 * pi * 58 = 364.4. Set dasharray = 364
  const strokeOffset = 364 - (score / 100) * 364;

  // Breakdown status texts
  const getVoltageStatusText = () => {
    if (!isOnline) return { text: 'N/A', color: 'var(--text-muted)' };
    const vDev = Math.abs(voltage - 230);
    if (vDev <= 5) return { text: 'Excellent (Stable)', color: 'var(--success)' };
    if (vDev <= 12) return { text: 'Normal (Minor Dev)', color: 'var(--warning)' };
    return { text: 'Poor (Unstable)', color: 'var(--danger)' };
  };

  const getPfStatusText = () => {
    if (!isOnline) return { text: 'N/A', color: 'var(--text-muted)' };
    if (powerFactor >= 0.90) return { text: 'Excellent (High Eff)', color: 'var(--success)' };
    if (powerFactor >= 0.80) return { text: 'Good (Inductive)', color: 'var(--warning)' };
    return { text: 'Poor (Lagging Low)', color: 'var(--danger)' };
  };

  const getLoadStatusText = () => {
    if (!isOnline) return { text: 'N/A', color: 'var(--text-muted)' };
    if (current < 8) return { text: 'Safe (Low Load)', color: 'var(--success)' };
    if (current < 12) return { text: 'Caution (Medium)', color: 'var(--warning)' };
    return { text: 'Overload Threat', color: 'var(--danger)' };
  };

  const vStatus = getVoltageStatusText();
  const pfStatus = getPfStatusText();
  const loadStatus = getLoadStatusText();

  // Generate dynamic recommendation rules
  const getRecommendations = () => {
    const list = [];
    if (!isOnline) {
      list.push({
        priority: 'high',
        title: 'Simulation Paused',
        desc: 'Ensure the telemetry data loop is running in the control panel to view real-time fluctuations.',
        icon: '🚨',
        priorityClass: 'reco-high-priority',
      });
      return list;
    }

    if (voltage > thresholds.overVoltage) {
      list.push({
        priority: 'high',
        title: 'Over-voltage Protection Triggered',
        desc: `Line Voltage reached ${voltage.toFixed(1)}V. Isolate sensitive electronic devices or activate servo stabilizers immediately.`,
        icon: '🚨',
        priorityClass: 'reco-high-priority',
      });
    }

    if (voltage < thresholds.underVoltage) {
      list.push({
        priority: 'high',
        title: 'Low Grid Voltage Detected',
        desc: `Line voltage dropped to ${voltage.toFixed(1)}V. Running heavy inductive loads during low voltage can damage motor coils. Power down heavy equipment.`,
        icon: '🚨',
        priorityClass: 'reco-high-priority',
      });
    }

    if (powerFactor < 0.85) {
      list.push({
        priority: 'medium',
        title: 'Power Factor (PF) Inefficiency',
        desc: `Current Power Factor is lagging at ${powerFactor.toFixed(2)}. Install capacitor shunt terminals at high inductive loads to correct power efficiency.`,
        icon: '⚠️',
        priorityClass: 'reco-medium-priority',
      });
    }

    if (power > thresholds.maxPower) {
      list.push({
        priority: 'high',
        title: 'Peak Energy Consumption Exceeded',
        desc: `Active load is drawing ${power.toFixed(0)}W, exceeding threshold. Defer high-current appliances (ACs, Water Heaters) from active slots.`,
        icon: '🚨',
        priorityClass: 'reco-high-priority',
      });
    }

    const budgetPct = (energy / thresholds.maxEnergy) * 100;
    if (budgetPct > 80) {
      list.push({
        priority: 'high',
        title: 'Daily Energy Budget Warning',
        desc: `You have consumed ${budgetPct.toFixed(0)}% of your target limit. Shift heavy cycles to off-peak slots.`,
        icon: '🚨',
        priorityClass: 'reco-high-priority',
      });
    } else if (budgetPct > 50) {
      list.push({
        priority: 'medium',
        title: 'Moderate Consumption Warning',
        desc: 'Usage has crossed 50% of the target limit. Check active idle power levels.',
        icon: '⚠️',
        priorityClass: 'reco-medium-priority',
      });
    }

    if (score >= 92) {
      list.push({
        priority: 'low',
        title: 'Optimal Energy Operation',
        desc: 'All electrical parameters are operating within safe optimal boundaries, minimizing grid heat losses.',
        icon: '💡',
        priorityClass: 'reco-low-priority',
      });
    }

    return list;
  };

  const recommendations = getRecommendations();

  return (
    <>
      {/* Energy Health Score Card */}
      <section className="card" id="card-health-score" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck style={{ width: '18px', height: '18px' }} /> Grid Health Index
        </h3>
        
        <div className="health-score-container" id="health-gauge-container">
          {/* Radial progress ring */}
          <div className="radial-progress-wrapper" id="health-radial-wrapper">
            <svg className="radial-progress-svg" viewBox="0 0 140 140">
              <circle className="radial-progress-bg" cx="70" cy="70" r="58"></circle>
              <circle
                className="radial-progress-fill"
                id="health-progress-ring"
                cx="70"
                cy="70"
                r="58"
                style={{
                  strokeDashoffset: strokeOffset,
                  stroke: strokeColor,
                  transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease',
                }}
              ></circle>
            </svg>
            <div className="radial-progress-text" id="health-score-text-box">
              <span className="radial-progress-val" id="health-score-value">{score}</span>
              <span className="radial-progress-pct">/100</span>
            </div>
          </div>
          
          <div className={`health-status-badge ${colorClass}`} id="health-score-badge">
            {statusText}
          </div>
          
          {/* Diagnostic Details */}
          <div className="health-breakdown" id="health-breakdown-details" style={{ width: '100%' }}>
            <div className="health-breakdown-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <Sliders style={{ width: '14px', height: '14px' }} /> Diagnostic Metrics
            </div>
            
            <div className="health-breakdown-row" style={{ display: 'flex', justifySpace: 'space-between', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Activity style={{ width: '14px', height: '14px', color: '#10b981' }} /> Voltage Stability
              </span>
              <strong style={{ fontSize: '0.82rem', color: vStatus.color }}>{vStatus.text}</strong>
            </div>
            
            <div className="health-breakdown-row" style={{ display: 'flex', justifySpace: 'space-between', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Percent style={{ width: '14px', height: '14px', color: '#3b82f6' }} /> Power Factor Quality
              </span>
              <strong style={{ fontSize: '0.82rem', color: pfStatus.color }}>{pfStatus.text}</strong>
            </div>
            
            <div className="health-breakdown-row" style={{ display: 'flex', justifySpace: 'space-between', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Bolt style={{ width: '14px', height: '14px', color: '#ef4444' }} /> Load Balancing
              </span>
              <strong style={{ fontSize: '0.82rem', color: loadStatus.color }}>{loadStatus.text}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Recommendations Panel */}
      <section className="card recommendations-card" id="card-recommendations" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb style={{ width: '18px', height: '18px' }} /> AI Recommendations
        </h3>
        <div className="recommendations-list" id="recommendations-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {recommendations.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem' }}>System is highly balanced. No active recommendations.</p>
            </div>
          ) : (
            recommendations.map((item, idx) => (
              <div key={idx} className={`recommendation-item ${item.priorityClass}`} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div className="reco-icon" style={{ fontSize: '1.1rem' }}>{item.icon}</div>
                <div className="reco-content" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="reco-title" style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{item.title}</span>
                  <span className="reco-desc" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{item.desc}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
};
export default HealthCard;
