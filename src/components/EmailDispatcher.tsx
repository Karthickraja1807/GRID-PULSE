import React, { useState, useEffect } from 'react';
import { type EmailLogEntry } from '../types';
import { Mail, Radio, Send, Settings, CheckCircle, AlertTriangle } from 'lucide-react';

interface EmailDispatcherProps {
  onShowToast: (title: string, message: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
  lastMlPlan: any;
  emailLogs: EmailLogEntry[];
  onAddLog: (log: EmailLogEntry) => void;
  autoAlertsEnabled: boolean;
  onToggleAutoAlerts: (enabled: boolean) => void;
  recipientEmail: string;
  onRecipientEmailChange: (email: string) => void;
}

export const EmailDispatcher: React.FC<EmailDispatcherProps> = ({
  onShowToast,
  lastMlPlan,
  emailLogs,
  onAddLog,
  autoAlertsEnabled,
  onToggleAutoAlerts,
  recipientEmail,
  onRecipientEmailChange,
}) => {
  const [emailServiceStatus, setEmailServiceStatus] = useState<{ smtpConfigured: boolean; smtpHost?: string }>({ smtpConfigured: false });
  const [preset, setPreset] = useState<string>('custom');
  const [subject, setSubject] = useState<string>('GridPulse Smart Energy Report');
  const [message, setMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Check email status from API
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/email-status');
        if (res.ok) {
          const data = await res.json();
          setEmailServiceStatus(data);
        }
      } catch (e) {
        console.warn('Could not read email service status:', e);
      }
    };
    checkStatus();
  }, []);

  // Update subject and message based on preset selection
  const handlePresetChange = (selected: string) => {
    setPreset(selected);
    if (selected === 'ml_plan') {
      setSubject('⚡ ML Energy Budget Plan & Appliance Runtime Optimization');
      setMessage('Attached is your automated GridPulse energy allocation plan based on your monthly budget and appliance priorities.');
    } else if (selected === 'usage_alert') {
      setSubject('🚨 HIGH ENERGY USAGE ALERT - GridPulse Threshold Exceeded');
      setMessage('Alert: Current instantaneous power consumption has spiked above safety thresholds. Please review active appliances on your dashboard.');
    } else if (selected === 'monthly_summary') {
      setSubject('📊 GridPulse Smart Energy Dashboard - Monthly Executive Summary');
      setMessage('Here is your monthly energy usage summary, estimated billing projections, and efficiency recommendations from GridPulse.');
    } else if (selected === 'custom') {
      setSubject('GridPulse Energy Update');
      setMessage('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientEmail || !recipientEmail.includes('@')) {
      onShowToast('Invalid Email', 'Please enter a valid recipient email address.', 'warning');
      return;
    }

    setIsSending(true);

    const reportData = preset === 'ml_plan' ? lastMlPlan : null;

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail,
          subject: subject,
          message: message,
          reportData: reportData,
        }),
      });
      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error(responseText.slice(0, 200) || `Server returned HTML or raw text error status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      onShowToast(
        result.mode === 'SMTP' ? 'Email Delivered!' : 'Email Dispatched (Simulation)',
        result.message || `Sent report to ${recipientEmail}`,
        'success'
      );

      // Add to logs
      onAddLog({
        id: Date.now().toString(),
        to: recipientEmail,
        subject: subject,
        sentAt: new Date().toLocaleTimeString(),
        status: result.mode === 'SMTP' ? 'DELIVERED' : 'SIMULATED',
      });
    } catch (err: any) {
      console.error('Email sending error:', err);
      onShowToast('Email Failed', err.message || 'Could not dispatch email.', 'danger');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="card email-card" id="card-email-notifications" style={{ gridColumn: 'span 12', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', margin: 0, marginBottom: '0.25rem' }}>
            <Mail style={{ color: 'var(--primary)', width: '20px', height: '20px' }} /> Email Report & Alert Dispatcher
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Send real-time energy reports, budget alerts, and consumption updates directly to any email address via `/api/send-email`.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {emailServiceStatus.smtpConfigured ? (
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle style={{ width: '12px', height: '12px' }} /> SMTP Configured ({emailServiceStatus.smtpHost})
            </span>
          ) : (
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertTriangle style={{ width: '12px', height: '12px' }} /> Active (Simulation Fallback Mode)
            </span>
          )}
        </div>
      </div>

      <div className="ml-planner-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Send Email Form */}
        <form onSubmit={handleFormSubmit} style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Send style={{ width: '16px', height: '16px', color: 'var(--primary)' }} /> Dispatch Email Report
          </h3>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>Recipient Email Address *</label>
            <input
              type="email"
              className="form-control"
              value={recipientEmail}
              onChange={(e) => onRecipientEmailChange(e.target.value)}
              placeholder="e.g. your_email@domain.com"
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>Report Template / Preset</label>
            <select
              className="form-control"
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              <option value="ml_plan">⚡ ML Energy Budget Plan Report (Attach Current ML Calculation)</option>
              <option value="usage_alert">🚨 High Energy Consumption Alert</option>
              <option value="monthly_summary">📊 Monthly Energy Dashboard Executive Summary</option>
              <option value="custom">✏️ Custom Email Message</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>Subject Line</label>
            <input
              type="text"
              className="form-control"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>Message Body</label>
            <textarea
              className="form-control"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Enter email message description..."
            ></textarea>
          </div>

          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: 'var(--bg-card)', padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              id="email-auto-alerts-toggle"
              checked={autoAlertsEnabled}
              onChange={(e) => onToggleAutoAlerts(e.target.checked)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '16px', height: '16px', marginTop: '0.15rem' }}
            />
            <label htmlFor="email-auto-alerts-toggle" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none', lineHeight: 1.4, margin: 0 }}>
              <strong>Auto-Trigger Condition Email Alerts</strong><br/>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Automatically sends an email alert to this recipient when Over-Voltage, Under-Voltage, Power Overload, or Budget limits are breached.</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={isSending} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary)', color: '#09090b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem', border: 'none', borderRadius: 'var(--radius-sm)' }}>
              <Send style={{ width: '14px', height: '14px' }} /> {isSending ? 'Sending Email...' : 'Send Email Now'}
            </button>
          </div>
        </form>

        {/* Status & Instructions Panel */}
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Settings style={{ width: '16px', height: '16px', color: 'var(--info)' }} /> How Email Dispatch Works
            </h3>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              <p style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                <strong>1. Immediate Delivery / Testing:</strong> If SMTP credentials are set on the server (like Gmail App Password or SendGrid), the website sends actual emails to the inbox.
              </p>
              <p style={{ marginBottom: '0.6rem' }}>
                <strong>2. Built-in Simulation Mode:</strong> If SMTP credentials aren't configured yet, the API smoothly dispatches the email in simulation mode so you can test website functionality without errors!
              </p>
            </div>

            <h4 style={{ fontSize: '0.85rem', margin: '1.5rem 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Radio style={{ width: '14px', height: '14px' }} /> Recent Dispatches
            </h4>
            <div id="email-recent-logs-list" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxHeight: '150px', overflowY: 'auto' }}>
              {emailLogs.length === 0 ? (
                'No emails dispatched yet in this session.'
              ) : (
                emailLogs.map((log) => (
                  <div key={log.id} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{log.to}</strong> — {log.subject}
                    </div>
                    <div style={{ fontSize: '0.7rem' }} className="mono">
                      <span style={{ color: log.status === 'DELIVERED' ? 'var(--success)' : 'var(--info)' }}>[{log.status}]</span> {log.sentAt}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default EmailDispatcher;
