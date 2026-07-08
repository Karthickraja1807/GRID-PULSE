import React, { useState, useRef, useEffect } from 'react';
import { type HistoryState } from '../types';
import { Activity, Zap, Bolt, BatteryCharging } from 'lucide-react';

interface TrendsChartProps {
  history: HistoryState;
}

type TabType = 'voltage' | 'current' | 'power' | 'energy';

export const TrendsChart: React.FC<TrendsChartProps> = ({ history }) => {
  const [activeTab, setActiveTab] = useState<TabType>('voltage');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 220 });

  // Handle responsive resizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(200, width),
          height: Math.max(120, height || 220),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getActiveData = (): { data: number[]; label: string; color: string; gradient: string } => {
    switch (activeTab) {
      case 'current':
        return {
          data: history.current,
          label: 'Current (A)',
          color: '#3b82f6', // blue-500
          gradient: 'url(#currentGlow)',
        };
      case 'power':
        return {
          data: history.power,
          label: 'Active Power (W)',
          color: '#f59e0b', // amber-500
          gradient: 'url(#powerGlow)',
        };
      case 'energy':
        return {
          data: history.energy,
          label: 'Total Energy (kWh)',
          color: '#ec4899', // pink-500
          gradient: 'url(#energyGlow)',
        };
      case 'voltage':
      default:
        return {
          data: history.voltage,
          label: 'Voltage (V)',
          color: '#10b981', // emerald-500
          gradient: 'url(#voltageGlow)',
        };
    }
  };

  const { data, label, color, gradient } = getActiveData();

  // Calculate SVG dimensions and scale points
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  const maxVal = data.length > 0 ? Math.max(...data, 1) : 100;
  const minVal = data.length > 0 ? Math.min(...data, 0) : 0;
  const valRange = maxVal - minVal || 1;
  const scaleY = (val: number) => chartHeight - ((val - minVal) / valRange) * chartHeight + padding.top;
  const scaleX = (index: number) => (index / Math.max(1, data.length - 1)) * chartWidth + padding.left;

  // Generate SVG grid lines and points
  const gridLinesY = 4;
  const yTicks = Array.from({ length: gridLinesY + 1 }, (_, i) => {
    const val = minVal + (valRange / gridLinesY) * i;
    return {
      y: scaleY(val),
      label: val.toFixed(activeTab === 'current' ? 2 : activeTab === 'energy' ? 2 : 1),
    };
  });

  // SVG points path generator
  const getPointsPath = () => {
    if (data.length === 0) return '';
    return data.map((val, idx) => `${scaleX(idx)},${scaleY(val)}`).join(' L ');
  };

  const pointsPathStr = getPointsPath();
  const fillPathStr = pointsPathStr
    ? `M ${scaleX(0)},${chartHeight + padding.top} L ${pointsPathStr} L ${scaleX(data.length - 1)},${chartHeight + padding.top} Z`
    : '';

  return (
    <section className="card charts-card" id="card-historical-charts" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="charts-header" id="charts-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Activity style={{ color: 'var(--primary)', width: '18px', height: '18px' }} /> Live Trends Timeline
        </h3>
        
        {/* Dataset selection tabs */}
        <div className="charts-tabs" style={{ display: 'flex', background: 'var(--bg-accent)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
          <button
            onClick={() => setActiveTab('voltage')}
            className={`chart-tab-btn ${activeTab === 'voltage' ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', background: activeTab === 'voltage' ? 'var(--bg-card)' : 'none', color: activeTab === 'voltage' ? '#10b981' : 'var(--text-secondary)' }}
          >
            <Activity style={{ width: '12px', height: '12px' }} /> Voltage
          </button>
          <button
            onClick={() => setActiveTab('current')}
            className={`chart-tab-btn ${activeTab === 'current' ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', background: activeTab === 'current' ? 'var(--bg-card)' : 'none', color: activeTab === 'current' ? '#3b82f6' : 'var(--text-secondary)' }}
          >
            <Zap style={{ width: '12px', height: '12px' }} /> Current
          </button>
          <button
            onClick={() => setActiveTab('power')}
            className={`chart-tab-btn ${activeTab === 'power' ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', background: activeTab === 'power' ? 'var(--bg-card)' : 'none', color: activeTab === 'power' ? '#f59e0b' : 'var(--text-secondary)' }}
          >
            <Bolt style={{ width: '12px', height: '12px' }} /> Power
          </button>
          <button
            onClick={() => setActiveTab('energy')}
            className={`chart-tab-btn ${activeTab === 'energy' ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', background: activeTab === 'energy' ? 'var(--bg-card)' : 'none', color: activeTab === 'energy' ? '#ec4899' : 'var(--text-secondary)' }}
          >
            <BatteryCharging style={{ width: '12px', height: '12px' }} /> Energy
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '220px', position: 'relative' }}>
        <svg width="100%" height="100%">
          <defs>
            <linearGradient id="voltageGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="currentGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="powerGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="energyGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={dimensions.width - padding.right}
                y2={tick.y}
                stroke="#27272a" // zinc-800
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                fill="#a1a1aa" // zinc-400
                fontSize="10"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {fillPathStr && (
            <path
              d={fillPathStr}
              fill={gradient}
            />
          )}

          {/* Line */}
          {pointsPathStr && (
            <path
              d={`M ${pointsPathStr}`}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'stroke 0.3s ease' }}
            />
          )}

          {/* Interaction dots */}
          {data.map((val, idx) => (
            <circle
              key={idx}
              cx={scaleX(idx)}
              cy={scaleY(val)}
              r="3"
              fill={color}
              stroke="#09090b"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '4px', right: '12px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }}></span>
          <span>{label} (rolling 20s window)</span>
        </div>
      </div>
    </section>
  );
};
export default TrendsChart;
