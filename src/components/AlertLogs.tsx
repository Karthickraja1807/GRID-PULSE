import React from 'react';
import { type AlertLogEntry } from '../types';
import { ShieldAlert, Check } from 'lucide-react';

interface AlertLogsProps {
  logs: AlertLogEntry[];
}

export const AlertLogs: React.FC<AlertLogsProps> = ({ logs }) => {
  const getBadgeClass = (severity: AlertLogEntry['severity'], desc: string) => {
    if (desc.includes('Restored')) return 'alert-normal';
    switch (severity) {
      case 'CRITICAL':
        return 'alert-danger';
      case 'WARNING':
        return 'alert-warning';
      case 'NORMAL':
      default:
        return 'alert-normal';
    }
  };

  return (
    <section className="card" id="card-alerts-log" style={{ gridColumn: 'span 12', marginTop: '0.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldAlert style={{ width: '18px', height: '18px', color: 'var(--primary)' }} /> Historical Alert Breaches
      </h3>
      <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
        <table className="wiring-table" id="alerts-log-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-accent)' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Time</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Alert Description</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Value</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Severity</th>
            </tr>
          </thead>
          <tbody id="alerts-log-body">
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td className="mono" style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.timestamp}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{log.description}</td>
                <td className="mono" style={{ padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{log.value}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                  <span className={`alert-type-badge ${getBadgeClass(log.severity, log.description)}`}>
                    {log.description.includes('Restored') ? 'NORMAL' : log.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {logs.length === 0 && (
          <div className="alerts-empty-state" id="alerts-empty-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Check style={{ width: '32px', height: '32px', marginBottom: '0.5rem', color: 'var(--success)' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No alerts triggered. System operating within safe limits.</p>
          </div>
        )}
      </div>
    </section>
  );
};
export default AlertLogs;
