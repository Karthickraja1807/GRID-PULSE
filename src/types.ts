export interface MetricsState {
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  powerFactor: number;
}

export interface ThresholdConfig {
  overVoltage: number;
  underVoltage: number;
  maxPower: number;
  maxEnergy: number;
  tariff: number;
}

export interface ThingerConfig {
  thingerUsername: string;
  thingerDeviceId: string;
  thingerResourceName: string;
  thingerAccessToken: string;
  useSeparateMetrics: boolean;
  metricsConfig: {
    voltage: { resource: string; token: string };
    current: { resource: string; token: string };
    power: { resource: string; token: string };
    energy: { resource: string; token: string };
  };
  thingerDemoMode: boolean;
}

export interface DashboardConfig extends ThresholdConfig, ThingerConfig {}

export interface HistoryState {
  timestamps: string[];
  voltage: number[];
  current: number[];
  power: number[];
  energy: number[];
}

export interface AlertLogEntry {
  id: string;
  timestamp: string;
  description: string;
  value: string;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  status: 'DELIVERED' | 'SIMULATED';
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

export interface Appliance {
  id: string;
  name: string;
  watts: number;
  priority: number;
}
