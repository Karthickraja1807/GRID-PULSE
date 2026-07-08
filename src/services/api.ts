export interface LiveTelemetry {
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  powerFactor: number;
  status: 'Power Failure' | 'Standby' | 'Active';
  lastUpdated: string;
  isSimulated: boolean;
  peakCurrent?: number;
  fallbackActive?: boolean;
}

export interface ThingerCredentials {
  username?: string;
  deviceId?: string;
  token?: string;
  resource?: string;
  useSeparateMetrics?: boolean;
  metricsConfig?: {
    voltage?: { resource: string; token: string };
    current?: { resource: string; token: string };
    power?: { resource: string; token: string };
    energy?: { resource: string; token: string };
  };
  demoMode?: boolean;
}

/**
 * Fetches live telemetry from the backend secure API proxy.
 * Pass the credentials in headers to prevent exposure on the browser.
 */
export async function fetchLiveTelemetry(creds: ThingerCredentials): Promise<LiveTelemetry> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (creds.username) headers['x-thinger-username'] = creds.username;
  if (creds.deviceId) headers['x-thinger-device-id'] = creds.deviceId;
  if (creds.token) headers['x-thinger-token'] = creds.token;
  if (creds.resource) headers['x-thinger-resource'] = creds.resource;
  if (creds.useSeparateMetrics) headers['x-use-separate-metrics'] = 'true';
  if (creds.demoMode) headers['x-thinger-demo-mode'] = 'true';

  // Inject advanced separate metrics parameters if enabled
  if (creds.useSeparateMetrics && creds.metricsConfig) {
    const { voltage, current, power, energy } = creds.metricsConfig;
    if (voltage) {
      if (voltage.resource) headers['x-thinger-resource-voltage'] = voltage.resource;
      if (voltage.token) headers['x-thinger-token-voltage'] = voltage.token;
    }
    if (current) {
      if (current.resource) headers['x-thinger-resource-current'] = current.resource;
      if (current.token) headers['x-thinger-token-current'] = current.token;
    }
    if (power) {
      if (power.resource) headers['x-thinger-resource-power'] = power.resource;
      if (power.token) headers['x-thinger-token-power'] = power.token;
    }
    if (energy) {
      if (energy.resource) headers['x-thinger-resource-energy'] = energy.resource;
      if (energy.token) headers['x-thinger-token-energy'] = energy.token;
    }
  }

  const response = await fetch('/api/live', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch telemetry (HTTP ${response.status})`);
  }

  return response.json();
}
