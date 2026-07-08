import React from 'react';
import { type ToastMessage } from '../types';
import { CheckCircle, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="toast-icon text-emerald-500" style={{ width: '18px', height: '18px' }} />;
      case 'warning':
        return <AlertTriangle className="toast-icon text-amber-500" style={{ width: '18px', height: '18px' }} />;
      case 'danger':
        return <AlertOctagon className="toast-icon text-rose-500" style={{ width: '18px', height: '18px' }} />;
      case 'info':
      default:
        return <Info className="toast-icon text-sky-500" style={{ width: '18px', height: '18px' }} />;
    }
  };

  return (
    <div className="toast-container" id="toast-notification-center" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type} active`} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '8px', background: '#09090b', border: '1px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', width: '320px', transition: 'all 0.3s ease' }}>
          <div style={{ marginTop: '2px' }}>{getIcon(toast.type)}</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)' }}>{toast.title}</h4>
            <p style={{ fontSize: '0.78rem', margin: '4px 0 0 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{toast.message}</p>
          </div>
          <button onClick={() => onRemove(toast.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px', alignSelf: 'flex-start' }}>
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      ))}
    </div>
  );
};
export default ToastContainer;
