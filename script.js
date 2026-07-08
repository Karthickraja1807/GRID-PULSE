/**
 * GridPulse - Core Controller
 * Designed with Vanilla JavaScript (ES6+), Chart.js, and Lucide Icons
 * Features: High-fidelity Smart Energy Simulation, Threshold Management,
 * Dynamic Health Scoring, Bill Predictor, Alarm Logs, and Chart Trends.
 * Fully Commented for Final Year Engineering Project presentation.
 */

// Global App State
const state = {
  isLoggedIn: false,
  loggedInUser: '',
  isDemoMode: false,
  isDeviceOnline: false,
  fetchIntervalId: null,
  energyOffset: 0.0,
  
  // Electrical Parameters
  metrics: {
    voltage: 0.0,
    current: 0.0,
    power: 0.0,
    energy: 12.85, // Cumulative starting energy
    frequency: 50.0,
    powerFactor: 0.0,
  },
  
  // Historical Arrays (for Chart.js, keeps last 20 readings)
  history: {
    timestamps: [],
    voltage: [],
    current: [],
    power: [],
    energy: [],
  },
  
  // Max observed current for peak tracking
  peakCurrent: 0.0,
  
  // Accumulated monitoring ticks
  monitoringStartTime: Date.now(),
  
  // System Configurations (loaded from localStorage or defaults)
  config: {
    tariff: 7.50, // Cost per unit (kWh)
    targetLimit: 50, // kWh monthly limit
    
    // Thinger.io Configuration Defaults
    thingerUsername: '',
    thingerDeviceId: '',
    thingerResourceName: 'metrics',
    thingerAccessToken: '',
    thingerDemoMode: false,
    
    // Advanced: Separate Tokens / Resources configuration for each metric
    useSeparateMetrics: false,
    metricsConfig: {
      voltage: { resource: 'voltage', token: '' },
      current: { resource: 'current', token: '' },
      power: { resource: 'power', token: '' },
      energy: { resource: 'energy', token: '' },
      powerFactor: { resource: 'pf', token: '' }
    },
    
    // Alarm Thresholds
    thresholds: {
      overVoltage: 245,
      underVoltage: 205,
      maxPower: 3000,
      maxEnergy: 50
    }
  },
  
  // Alarm Trigger States to prevent duplicate logs/emails
  alertTriggered: {
    overVoltage: false,
    underVoltage: false,
    maxPower: false,
    maxEnergy: false,
    offline: false
  },
  
  // Selected Trend Tab (voltage, current, power, energy)
  activeChartTab: 'voltage',
  chartInstance: null
};

// Simulated appliances power values for Demo Mode fluctuations
const DEMO_APPLIANCES = [
  { name: "LED Lights", power: 45, pf: 0.95 },
  { name: "Refrigerator", power: 150, pf: 0.82 },
  { name: "Air Conditioner", power: 1800, pf: 0.78 },
  { name: "Water Heater", power: 2500, pf: 1.0 },
  { name: "Laptop & Router", power: 120, pf: 0.90 }
];

// Document Elements
const elements = {
  loginScreen: document.getElementById('login-screen'),
  mainDashboard: document.getElementById('main-dashboard'),
  localLoginForm: document.getElementById('local-login-form'),
  thingerLoginForm: document.getElementById('thinger-login-form'),
  tabSimulation: document.getElementById('tab-simulation'),
  tabIot: document.getElementById('tab-iot'),
  logoutBtn: document.getElementById('logout-btn'),
  
  connectionStatus: document.getElementById('connection-status'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  toggleSettingsBtn: document.getElementById('toggle-settings-btn'),
  settingsDrawer: document.getElementById('settings-drawer-panel'),
  
  // Threshold Settings Inputs
  thresholdOverVoltage: document.getElementById('over-voltage-threshold'),
  thresholdUnderVoltage: document.getElementById('under-voltage-threshold'),
  thresholdMaxPower: document.getElementById('overload-threshold'),
  thresholdMaxEnergy: document.getElementById('budget-target-threshold'),
  thresholdTariffRate: document.getElementById('tariff-rate-threshold'),
  
  // Actions
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  resetSettingsBtn: document.getElementById('reset-settings-btn'),
  
  // Metric Display Nodes
  voltageVal: document.getElementById('voltage-val'),
  voltageStatus: document.getElementById('voltage-status'),
  currentVal: document.getElementById('current-val'),
  currentPeak: document.getElementById('current-peak'),
  currentGauge: document.getElementById('current-gauge'),
  powerVal: document.getElementById('power-val'),
  powerLoad: document.getElementById('power-load'),
  energyVal: document.getElementById('energy-val'),
  carbonFootprint: document.getElementById('carbon-footprint'),
  frequencyVal: document.getElementById('frequency-val'),
  frequencyStability: document.getElementById('frequency-stability'),
  pfVal: document.getElementById('pf-val'),
  pfPhase: document.getElementById('pf-phase'),
  
  // Health Score Nodes
  healthScoreValue: document.getElementById('health-score-value'),
  healthScoreBadge: document.getElementById('health-score-badge'),
  healthProgressRing: document.getElementById('health-progress-ring'),
  healthBreakdownVoltage: document.getElementById('health-breakdown-voltage'),
  healthBreakdownPf: document.getElementById('health-breakdown-pf'),
  healthBreakdownLoad: document.getElementById('health-breakdown-load'),
  
  // Billing Predictor Nodes
  tariffInput: document.getElementById('tariff-input'),
  currentCostVal: document.getElementById('current-cost-val'),
  predictedBillVal: document.getElementById('predicted-bill-val'),
  budgetTargetLabel: document.getElementById('budget-target-label'),
  budgetProgressIndicator: document.getElementById('budget-progress-indicator'),
  
  // Chart Elements
  chartTabButtons: document.querySelectorAll('[data-chart-tab]'),
  
  // Alerts Log
  alertsLogBody: document.getElementById('alerts-log-body'),
  alertsEmptyPlaceholder: document.getElementById('alerts-empty-placeholder'),
  recommendationsContainer: document.getElementById('recommendations-container'),
  
  // Toast Center
  toastCenter: document.getElementById('toast-notification-center'),
  
  // Thinger.io Credential Elements
  thingerUsername: document.getElementById('thinger-username'),
  thingerDeviceId: document.getElementById('thinger-device-id'),
  thingerResource: document.getElementById('thinger-resource'),
  thingerToken: document.getElementById('thinger-token'),
  thingerDemoMode: document.getElementById('thinger-demo-mode')
};

// ----------------------------------------------------
// 1. Initializers & Event Listeners
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Load settings from LocalStorage
  loadConfigFromStorage();
  
  // Populate UI inputs with config values
  populateUIInputs();
  
  // Initialize dynamic Chart.js instance
  initChart();
  
  // Populate starting historical points with baseline values
  generateMockHistory();
  
  // Register DOM event listeners
  registerEventListeners();
  
  // Initialize ML Energy Budget & Runtime Planner Module
  initMlEnergyPlanner();

  // Initialize Email Dispatcher Module
  initEmailDispatcher();

  // Check session persistence
  checkActiveSession();
  
  // Initialize Lucide SVG Icons replacement
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Loads system variables from localStorage or configures factory defaults
 */
function loadConfigFromStorage() {
  const savedConfig = localStorage.getItem('smart_meter_config');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      state.config = { ...state.config, ...parsed };
      if (parsed.metricsConfig) {
        state.config.metricsConfig = { ...state.config.metricsConfig, ...parsed.metricsConfig };
      }
    } catch (e) {
      console.error("Failed to parse saved config, using defaults", e);
    }
  }
  
  const savedOffset = localStorage.getItem('smart_meter_energy_offset');
  if (savedOffset) {
    state.energyOffset = parseFloat(savedOffset) || 0.0;
  }
}

/**
 * Populates UI input elements with the state config data
 */
function populateUIInputs() {
  if (state.config.tariff) {
    elements.tariffInput.value = state.config.tariff;
    if (elements.thresholdTariffRate) elements.thresholdTariffRate.value = state.config.tariff;
  }
  if (state.config.targetLimit) {
    elements.thresholdMaxEnergy.value = state.config.targetLimit;
    state.config.thresholds.maxEnergy = state.config.targetLimit;
  }
  
  // Load Threshold Inputs
  if (state.config.thresholds) {
    elements.thresholdOverVoltage.value = state.config.thresholds.overVoltage || 245;
    elements.thresholdUnderVoltage.value = state.config.thresholds.underVoltage || 205;
    elements.thresholdMaxPower.value = state.config.thresholds.maxPower || 3000;
  }
  
  // Load Thinger.io Credentials
  if (elements.thingerUsername) {
    elements.thingerUsername.value = state.config.thingerUsername || '';
  }
  if (elements.thingerDeviceId) {
    elements.thingerDeviceId.value = state.config.thingerDeviceId || '';
  }
  if (elements.thingerResource) {
    elements.thingerResource.value = state.config.thingerResourceName || 'metrics';
  }
  if (elements.thingerToken) {
    elements.thingerToken.value = state.config.thingerAccessToken || '';
  }
  if (elements.thingerDemoMode) {
    elements.thingerDemoMode.checked = state.config.thingerDemoMode || false;
  }

  // Load Thinger.io Login Screen inputs
  const loginThingerUser = document.getElementById('login-thinger-username');
  const loginThingerDevice = document.getElementById('login-thinger-device-id');
  const loginThingerResource = document.getElementById('login-thinger-resource');
  const loginThingerToken = document.getElementById('login-thinger-token');
  const loginThingerDemo = document.getElementById('login-thinger-demo');

  if (loginThingerUser) loginThingerUser.value = state.config.thingerUsername || '';
  if (loginThingerDevice) loginThingerDevice.value = state.config.thingerDeviceId || '';
  if (loginThingerResource) loginThingerResource.value = state.config.thingerResourceName || 'metrics';
  if (loginThingerToken) loginThingerToken.value = state.config.thingerAccessToken || '';
  if (loginThingerDemo) loginThingerDemo.checked = state.config.thingerDemoMode !== undefined ? state.config.thingerDemoMode : true;

  // Populate separate metrics in settings drawer
  const settingsSeparateToggle = document.getElementById('thinger-separate-toggle');
  const settingsSeparateContainer = document.getElementById('thinger-separate-container');
  if (settingsSeparateToggle && settingsSeparateContainer) {
    settingsSeparateToggle.checked = state.config.useSeparateMetrics || false;
    settingsSeparateContainer.style.display = state.config.useSeparateMetrics ? 'block' : 'none';
    
    if (state.config.metricsConfig) {
      if (document.getElementById('settings-v-resource')) document.getElementById('settings-v-resource').value = state.config.metricsConfig.voltage?.resource || 'voltage';
      if (document.getElementById('settings-v-token')) document.getElementById('settings-v-token').value = state.config.metricsConfig.voltage?.token || '';
      if (document.getElementById('settings-i-resource')) document.getElementById('settings-i-resource').value = state.config.metricsConfig.current?.resource || 'current';
      if (document.getElementById('settings-i-token')) document.getElementById('settings-i-token').value = state.config.metricsConfig.current?.token || '';
      if (document.getElementById('settings-p-resource')) document.getElementById('settings-p-resource').value = state.config.metricsConfig.power?.resource || 'power';
      if (document.getElementById('settings-p-token')) document.getElementById('settings-p-token').value = state.config.metricsConfig.power?.token || '';
      if (document.getElementById('settings-e-resource')) document.getElementById('settings-e-resource').value = state.config.metricsConfig.energy?.resource || 'energy';
      if (document.getElementById('settings-e-token')) document.getElementById('settings-e-token').value = state.config.metricsConfig.energy?.token || '';
      if (document.getElementById('settings-pf-resource')) document.getElementById('settings-pf-resource').value = state.config.metricsConfig.powerFactor?.resource || 'pf';
      if (document.getElementById('settings-pf-token')) document.getElementById('settings-pf-token').value = state.config.metricsConfig.powerFactor?.token || '';
    }
  }

  // Populate separate metrics in login screen
  const loginSeparateToggle = document.getElementById('login-thinger-separate-toggle');
  const loginSeparateContainer = document.getElementById('login-thinger-separate-container');
  if (loginSeparateToggle && loginSeparateContainer) {
    loginSeparateToggle.checked = state.config.useSeparateMetrics || false;
    loginSeparateContainer.style.display = state.config.useSeparateMetrics ? 'block' : 'none';
    
    if (loginSeparateToggle.checked) {
      if (loginThingerResource) loginThingerResource.removeAttribute('required');
      if (loginThingerToken) loginThingerToken.removeAttribute('required');
    } else {
      if (loginThingerResource) loginThingerResource.setAttribute('required', 'required');
      if (loginThingerToken) loginThingerToken.setAttribute('required', 'required');
    }
    
    if (state.config.metricsConfig) {
      if (document.getElementById('login-v-resource')) document.getElementById('login-v-resource').value = state.config.metricsConfig.voltage?.resource || 'voltage';
      if (document.getElementById('login-v-token')) document.getElementById('login-v-token').value = state.config.metricsConfig.voltage?.token || '';
      if (document.getElementById('login-i-resource')) document.getElementById('login-i-resource').value = state.config.metricsConfig.current?.resource || 'current';
      if (document.getElementById('login-i-token')) document.getElementById('login-i-token').value = state.config.metricsConfig.current?.token || '';
      if (document.getElementById('login-p-resource')) document.getElementById('login-p-resource').value = state.config.metricsConfig.power?.resource || 'power';
      if (document.getElementById('login-p-token')) document.getElementById('login-p-token').value = state.config.metricsConfig.power?.token || '';
      if (document.getElementById('login-e-resource')) document.getElementById('login-e-resource').value = state.config.metricsConfig.energy?.resource || 'energy';
      if (document.getElementById('login-e-token')) document.getElementById('login-e-token').value = state.config.metricsConfig.energy?.token || '';
      if (document.getElementById('login-pf-resource')) document.getElementById('login-pf-resource').value = state.config.metricsConfig.powerFactor?.resource || 'pf';
      if (document.getElementById('login-pf-token')) document.getElementById('login-pf-token').value = state.config.metricsConfig.powerFactor?.token || '';
    }
  }
}

/**
 * Binds event handlers to user controls
 */
function registerEventListeners() {
  // Advanced Separate Tokens Toggle Interactions
  const loginSeparateToggle = document.getElementById('login-thinger-separate-toggle');
  const loginSeparateContainer = document.getElementById('login-thinger-separate-container');
  if (loginSeparateToggle && loginSeparateContainer) {
    loginSeparateToggle.addEventListener('change', () => {
      loginSeparateContainer.style.display = loginSeparateToggle.checked ? 'block' : 'none';
      const genericResInput = document.getElementById('login-thinger-resource');
      const genericTokenInput = document.getElementById('login-thinger-token');
      if (loginSeparateToggle.checked) {
        if (genericResInput) genericResInput.removeAttribute('required');
        if (genericTokenInput) genericTokenInput.removeAttribute('required');
      } else {
        if (genericResInput) genericResInput.setAttribute('required', 'required');
        if (genericTokenInput) genericTokenInput.setAttribute('required', 'required');
      }
    });
  }

  const settingsSeparateToggle = document.getElementById('thinger-separate-toggle');
  const settingsSeparateContainer = document.getElementById('thinger-separate-container');
  if (settingsSeparateToggle && settingsSeparateContainer) {
    settingsSeparateToggle.addEventListener('change', () => {
      settingsSeparateContainer.style.display = settingsSeparateToggle.checked ? 'block' : 'none';
    });
  }

  // Tab Switch Handling
  if (elements.tabSimulation && elements.tabIot) {
    elements.tabSimulation.addEventListener('click', () => {
      elements.tabSimulation.classList.add('active');
      elements.tabIot.classList.remove('active');
      elements.localLoginForm.classList.add('active');
      if (elements.thingerLoginForm) elements.thingerLoginForm.classList.remove('active');
    });

    elements.tabIot.addEventListener('click', () => {
      elements.tabIot.classList.add('active');
      elements.tabSimulation.classList.remove('active');
      if (elements.thingerLoginForm) elements.thingerLoginForm.classList.add('active');
      elements.localLoginForm.classList.remove('active');
    });
  }

  // Local/Dev Login Submission
  elements.localLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value.trim();
    
    if (!userVal || !passVal) {
      showToast("Missing Passcode", "Please enter both Username and Passcode to continue.", "warning");
      return;
    }
    
    const isAuthValid = (userVal.toLowerCase() === 'admin' || userVal.toLowerCase() === 'karthickraja') && passVal === 'admin123';
    
    if (isAuthValid) {
      handleLogin(userVal, true);
    } else {
      showToast("Access Denied", "Incorrect system passcode or engineer username.", "danger");
    }
  });

  // Thinger.io Login Form Submission
  if (elements.thingerLoginForm) {
    elements.thingerLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = elements.thingerLoginForm.querySelector('button[type="submit"]');
      const originalBtnHTML = submitBtn.innerHTML;
      
      const separateToggle = document.getElementById('login-thinger-separate-toggle');
      const useSeparate = separateToggle ? separateToggle.checked : false;
      
      const thingerUser = document.getElementById('login-thinger-username').value.trim();
      const thingerDevice = document.getElementById('login-thinger-device-id').value.trim();
      const thingerRes = useSeparate ? '' : document.getElementById('login-thinger-resource').value.trim();
      const thingerTkn = useSeparate ? '' : document.getElementById('login-thinger-token').value.trim();
      const thingerDemo = document.getElementById('login-thinger-demo').checked;

      let vRes = 'voltage', vTkn = '';
      let iRes = 'current', iTkn = '';
      let pRes = 'power', pTkn = '';
      let eRes = 'energy', eTkn = '';
      let pfRes = 'pf', pfTkn = '';

      if (useSeparate) {
        vRes = document.getElementById('login-v-resource').value.trim() || 'voltage';
        vTkn = document.getElementById('login-v-token').value.trim();
        iRes = document.getElementById('login-i-resource').value.trim() || 'current';
        iTkn = document.getElementById('login-i-token').value.trim();
        pRes = document.getElementById('login-p-resource').value.trim() || 'power';
        pTkn = document.getElementById('login-p-token').value.trim();
        eRes = document.getElementById('login-e-resource').value.trim() || 'energy';
        eTkn = document.getElementById('login-e-token').value.trim();
        pfRes = 'pf';
        pfTkn = '';
      }

      if (!thingerUser || !thingerDevice || (!useSeparate && (!thingerTkn || !thingerRes))) {
        showToast("Incomplete Configuration", "Please fill in all the required Thinger.io details.", "warning");
        return;
      }

      // 1. Show connecting & verifying state on the login button
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 14px; height: 14px; margin-right: 0.5rem; display: inline-block; vertical-align: middle;"></i> Connecting...`;
      if (window.lucide) window.lucide.createIcons();
      
      // Perform a validation fetch to verify credentials before logging in
      const testUrl = useSeparate
        ? `https://api.thinger.io/v2/users/${thingerUser}/devices/${thingerDevice}/${vRes}?authorization=${vTkn}`
        : `https://api.thinger.io/v2/users/${thingerUser}/devices/${thingerDevice}/${thingerRes}?authorization=${thingerTkn}`;
      
      const validationToken = useSeparate ? vTkn : thingerTkn;
      
      let validationSuccess = false;
      let errorReason = "Unknown error";
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${validationToken}`
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Verify we get a payload back
          let payload = data;
          if (data && data.out !== undefined) {
            payload = data.out;
          } else if (data && data.in !== undefined) {
            payload = data.in;
          }
          
          if (payload !== undefined) {
            validationSuccess = true;
          } else {
            errorReason = "Empty payload response from Thinger.io.";
          }
        } else {
          if (response.status === 401) {
            errorReason = "Unauthorized (Invalid Access Token).";
          } else if (response.status === 404) {
            errorReason = "Not Found (Wrong Username, Device ID, or Resource).";
          } else {
            errorReason = `HTTP Error ${response.status}.`;
          }
        }
      } catch (err) {
        console.warn("Thinger.io validation failed:", err);
        errorReason = err.name === 'AbortError' ? "Connection timed out after 4 seconds." : "Network/CORS block or Thinger.io is offline.";
      }
      
      // Restore button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
      if (window.lucide) window.lucide.createIcons();
      
      if (validationSuccess) {
        // Save Thinger.io configurations in config state
        state.config.thingerUsername = thingerUser;
        state.config.thingerDeviceId = thingerDevice;
        state.config.thingerResourceName = thingerRes;
        state.config.thingerAccessToken = thingerTkn;
        state.config.thingerDemoMode = thingerDemo;
        state.config.useSeparateMetrics = useSeparate;

        if (useSeparate) {
          state.config.metricsConfig = {
            voltage: { resource: vRes, token: vTkn },
            current: { resource: iRes, token: iTkn },
            power: { resource: pRes, token: pTkn },
            energy: { resource: eRes, token: eTkn },
            powerFactor: { resource: pfRes, token: pfTkn }
          };
        } else {
          state.config.metricsConfig = {
            voltage: { resource: 'voltage', token: '' },
            current: { resource: 'current', token: '' },
            power: { resource: 'power', token: '' },
            energy: { resource: 'energy', token: '' },
            powerFactor: { resource: 'pf', token: '' }
          };
        }

        // Update threshold inputs and setting drawer fields
        populateUIInputs();

        // Save to localStorage
        localStorage.setItem('smart_meter_config', JSON.stringify(state.config));

        // Proceed to login
        handleLogin(thingerUser, false); // isDemoMode = false for live tracking!
        
        showToast("IoT Link Successful", `Successfully connected to device: ${thingerDevice}. Streaming live readings.`, "success");
      } else {
        // Credentials failed verification!
        if (thingerDemo) {
          // Demo fallback is enabled! Save details and allow login anyway, but mark state as demo mode
          state.config.thingerUsername = thingerUser;
          state.config.thingerDeviceId = thingerDevice;
          state.config.thingerResourceName = thingerRes;
          state.config.thingerAccessToken = thingerTkn;
          state.config.thingerDemoMode = thingerDemo;
          state.config.useSeparateMetrics = useSeparate;

          if (useSeparate) {
            state.config.metricsConfig = {
              voltage: { resource: vRes, token: vTkn },
              current: { resource: iRes, token: iTkn },
              power: { resource: pRes, token: pTkn },
              energy: { resource: eRes, token: eTkn },
              powerFactor: { resource: pfRes, token: pfTkn }
            };
          } else {
            state.config.metricsConfig = {
              voltage: { resource: 'voltage', token: '' },
              current: { resource: 'current', token: '' },
              power: { resource: 'power', token: '' },
              energy: { resource: 'energy', token: '' },
              powerFactor: { resource: 'pf', token: '' }
            };
          }

          populateUIInputs();

          localStorage.setItem('smart_meter_config', JSON.stringify(state.config));

          handleLogin(thingerUser, true); // Log in using Demo/simulation mode as fallback!
          
          showToast("Credentials Unverified", `Thinger.io link failed: ${errorReason}. Logged in under Demo Fallback Mode.`, "warning");
        } else {
          // Demo fallback is disabled. Strictly abort login!
          showToast("Authentication Failed", `Cannot log in: ${errorReason} Please check your credentials.`, "danger");
        }
      }
    });
  }
  
  // Logout Trigger Button
  elements.logoutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    customConfirm("Are you sure you want to sign out of GridPulse?", () => {
      handleLogout();
    });
  });
  
  // Drawer expand toggle
  elements.toggleSettingsBtn.addEventListener('click', () => {
    elements.settingsDrawer.classList.toggle('open');
  });

  // Reset Cumulative Energy Button
  const resetEnergyBtn = document.getElementById('reset-energy-btn');
  if (resetEnergyBtn) {
    resetEnergyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      customConfirm("Reset cumulative energy consumption (kWh) to 0.00?", () => {
        const currentRaw = state.metrics.energy + state.energyOffset;
        const resetAmount = state.metrics.energy;
        state.energyOffset = currentRaw;
        localStorage.setItem('smart_meter_energy_offset', state.energyOffset.toString());
        
        // Offset active historical metrics to maintain a clean timeline on the chart
        if (state.history && state.history.energy) {
          state.history.energy = state.history.energy.map(val => Math.max(0.0, val - resetAmount));
        }
        
        state.metrics.energy = 0.0;
        processMeasurementUpdates();
        showToast("Energy Reset", "Cumulative energy reset to 0.00 kWh successfully (Offset applied).", "success");
      });
    });
  }
  
  // Reset Configuration
  elements.resetSettingsBtn.addEventListener('click', () => {
    customConfirm("Reset system thresholds to default values?", () => {
      localStorage.removeItem('smart_meter_config');
      localStorage.removeItem('smart_meter_cumulative_energy');
      localStorage.removeItem('smart_meter_energy_offset');
      state.energyOffset = 0.0;
      state.metrics.energy = 12.85;
      
      // Reset inputs in DOM
      elements.tariffInput.value = '7.50';
      if (elements.thresholdTariffRate) elements.thresholdTariffRate.value = '7.50';
      elements.thresholdOverVoltage.value = '245';
      elements.thresholdUnderVoltage.value = '205';
      elements.thresholdMaxPower.value = '3000';
      elements.thresholdMaxEnergy.value = '50';
      
      if (elements.thingerUsername) elements.thingerUsername.value = '';
      if (elements.thingerDeviceId) elements.thingerDeviceId.value = '';
      if (elements.thingerResource) elements.thingerResource.value = 'metrics';
      if (elements.thingerToken) elements.thingerToken.value = '';
      if (elements.thingerDemoMode) elements.thingerDemoMode.checked = false;
      
      // Reset config
      state.config = {
        tariff: 7.50,
        targetLimit: 50,
        thingerUsername: '',
        thingerDeviceId: '',
        thingerResourceName: 'metrics',
        thingerAccessToken: '',
        thingerDemoMode: false,
        thresholds: {
          overVoltage: 245,
          underVoltage: 205,
          maxPower: 3000,
          maxEnergy: 50
        }
      };
      
      showToast("Defaults Restored", "Safe threshold default configurations restored.", "info");
      elements.settingsDrawer.classList.remove('open');
      executeDataCycle();
    });
  });
  
  // Save Configuration
  elements.saveSettingsBtn.addEventListener('click', () => {
    state.config.tariff = parseFloat(elements.thresholdTariffRate.value) || 7.50;
    elements.tariffInput.value = state.config.tariff.toFixed(2);
    
    state.config.targetLimit = parseFloat(elements.thresholdMaxEnergy.value) || 50;
    
    // Save thresholds
    state.config.thresholds.overVoltage = parseFloat(elements.thresholdOverVoltage.value) || 245;
    state.config.thresholds.underVoltage = parseFloat(elements.thresholdUnderVoltage.value) || 205;
    state.config.thresholds.maxPower = parseFloat(elements.thresholdMaxPower.value) || 3000;
    state.config.thresholds.maxEnergy = state.config.targetLimit;
    
    // Save Thinger.io configurations
    state.config.thingerUsername = elements.thingerUsername ? elements.thingerUsername.value.trim() : '';
    state.config.thingerDeviceId = elements.thingerDeviceId ? elements.thingerDeviceId.value.trim() : '';
    state.config.thingerResourceName = elements.thingerResource ? elements.thingerResource.value.trim() : 'metrics';
    state.config.thingerAccessToken = elements.thingerToken ? elements.thingerToken.value.trim() : '';
    state.config.thingerDemoMode = elements.thingerDemoMode ? elements.thingerDemoMode.checked : false;
    
    const settingsSeparateToggle = document.getElementById('thinger-separate-toggle');
    state.config.useSeparateMetrics = settingsSeparateToggle ? settingsSeparateToggle.checked : false;
    
    if (state.config.useSeparateMetrics) {
      state.config.metricsConfig = {
        voltage: {
          resource: document.getElementById('settings-v-resource')?.value.trim() || 'voltage',
          token: document.getElementById('settings-v-token')?.value.trim() || ''
        },
        current: {
          resource: document.getElementById('settings-i-resource')?.value.trim() || 'current',
          token: document.getElementById('settings-i-token')?.value.trim() || ''
        },
        power: {
          resource: document.getElementById('settings-p-resource')?.value.trim() || 'power',
          token: document.getElementById('settings-p-token')?.value.trim() || ''
        },
        energy: {
          resource: document.getElementById('settings-e-resource')?.value.trim() || 'energy',
          token: document.getElementById('settings-e-token')?.value.trim() || ''
        },
        powerFactor: {
          resource: document.getElementById('settings-pf-resource')?.value.trim() || 'pf',
          token: document.getElementById('settings-pf-token')?.value.trim() || ''
        }
      };
    } else {
      state.config.metricsConfig = {
        voltage: { resource: 'voltage', token: '' },
        current: { resource: 'current', token: '' },
        power: { resource: 'power', token: '' },
        energy: { resource: 'energy', token: '' },
        powerFactor: { resource: 'pf', token: '' }
      };
    }

    // Synchronize inputs across forms
    populateUIInputs();
    
    // Save to LocalStorage
    localStorage.setItem('smart_meter_config', JSON.stringify(state.config));
    
    showToast("Thresholds Updated", "Parameter limits successfully applied and stored.", "success");
    elements.settingsDrawer.classList.remove('open');
    executeDataCycle();
  });
  
  // Tariff real-time change
  elements.tariffInput.addEventListener('input', (e) => {
    state.config.tariff = parseFloat(e.target.value) || 0.0;
    if (elements.thresholdTariffRate) elements.thresholdTariffRate.value = state.config.tariff;
    updateBillCalculations();
  });
  if (elements.thresholdTariffRate) {
    elements.thresholdTariffRate.addEventListener('input', (e) => {
      state.config.tariff = parseFloat(e.target.value) || 0.0;
      elements.tariffInput.value = state.config.tariff;
      updateBillCalculations();
    });
  }
  
  // Dynamic Limits Inputs Change
  elements.thresholdOverVoltage.addEventListener('change', (e) => {
    state.config.thresholds.overVoltage = parseFloat(e.target.value) || 245;
    state.alertTriggered.overVoltage = false; // Reset cooldown on parameter update
  });
  elements.thresholdUnderVoltage.addEventListener('change', (e) => {
    state.config.thresholds.underVoltage = parseFloat(e.target.value) || 205;
    state.alertTriggered.underVoltage = false;
  });
  elements.thresholdMaxPower.addEventListener('change', (e) => {
    state.config.thresholds.maxPower = parseFloat(e.target.value) || 3000;
    state.alertTriggered.maxPower = false;
  });
  elements.thresholdMaxEnergy.addEventListener('change', (e) => {
    state.config.thresholds.maxEnergy = parseFloat(e.target.value) || 50;
    state.config.targetLimit = state.config.thresholds.maxEnergy;
    state.alertTriggered.maxEnergy = false;
    updateBillCalculations();
  });
  
  // Trend Tabs Buttons Switching
  elements.chartTabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      elements.chartTabButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.activeChartTab = e.target.getAttribute('data-chart-tab');
      updateChartWithActiveTab();
    });
  });


}

/**
 * Resets alert triggers to let them trigger again if conditions arise
 */
function resetAlertCooldowns() {
  Object.keys(state.alertTriggered).forEach(k => {
    state.alertTriggered[k] = false;
  });
}

// ----------------------------------------------------
// 2. Data Acquisition Pipeline (Thinger.io & Demo)
// ----------------------------------------------------

/**
 * Triggers the 2-second repeat interval timer
 */
function startDataPipeline() {
  if (state.fetchIntervalId) clearInterval(state.fetchIntervalId);
  state.fetchIntervalId = setInterval(executeDataCycle, 2000);
}

/**
 * Core cycle executed every 2 seconds. Fetches real data from Thinger.io or falls back to demo mode.
 */
async function executeDataCycle() {
  await fetchThingerData();
  processMeasurementUpdates();
}

/**
 * Fetches real parameters from Thinger.io API
 */
async function fetchThingerData() {
  const username = state.config.thingerUsername;
  const deviceId = state.config.thingerDeviceId;
  const resource = state.config.thingerResourceName || 'metrics';
  const token = state.config.thingerAccessToken;
  const isDemo = state.config.thingerDemoMode;

  if (!username || !deviceId) {
    if (isDemo) {
      state.isDeviceOnline = true;
      updateStatusIndicator(true, "Demo Mode: Connected");
      generateSimulatedData();
    } else {
      state.isDeviceOnline = false;
      updateStatusIndicator(false, "Device Offline");
      setMetricsToZero();
    }
    return;
  }

  // Handle advanced separate token/resource setup
  if (state.config.useSeparateMetrics) {
    const metricsToFetch = ['voltage', 'current', 'power', 'energy'];
    const fetchPromises = metricsToFetch.map(async (metricKey) => {
      const cfg = state.config.metricsConfig?.[metricKey] || { resource: metricKey, token: '' };
      const mResource = cfg.resource || metricKey;
      const mToken = cfg.token || token;
      
      if (!mResource || !mToken) return { key: metricKey, value: null };
      
      const mUrl = `https://api.thinger.io/v2/users/${username}/devices/${deviceId}/${mResource}?authorization=${mToken}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout per endpoint
        
        const response = await fetch(mUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${mToken}`
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          let payload = data;
          if (data && data.out !== undefined) payload = data.out;
          else if (data && data.in !== undefined) payload = data.in;
          
          let val = null;
          if (typeof payload === 'object' && payload !== null) {
            // Check for potential nested names
            const possibleKeys = [metricKey.toLowerCase(), 'value', 'val', 'out', 'in'];
            for (const key of Object.keys(payload)) {
              if (possibleKeys.some(pk => key.toLowerCase().includes(pk))) {
                val = parseFloat(payload[key]);
                break;
              }
            }
            if (val === null && Object.keys(payload).length > 0) {
              val = parseFloat(payload[Object.keys(payload)[0]]);
            }
          } else {
            val = parseFloat(payload);
          }
          return { key: metricKey, value: val };
        }
      } catch (err) {
        console.warn(`Separate fetch failed for ${metricKey}:`, err);
      }
      return { key: metricKey, value: null };
    });

    try {
      const results = await Promise.all(fetchPromises);
      let anySuccess = false;
      
      results.forEach(res => {
        if (res.value !== null && !isNaN(res.value)) {
          anySuccess = true;
          if (res.key === 'voltage') state.metrics.voltage = parseFloat(res.value);
          else if (res.key === 'current') state.metrics.current = parseFloat(res.value);
          else if (res.key === 'power') state.metrics.power = parseFloat(res.value);
          else if (res.key === 'energy') {
            state.metrics.energy = parseFloat(res.value);
          }
        }
      });

      if (anySuccess) {
        state.metrics.frequency = 50.0; // Grid frequency is always standard 50 Hz as requested
        
        // Calculate Power Factor: Power / (Voltage * Current)
        const apparentPower = state.metrics.voltage * state.metrics.current;
        if (state.metrics.power > 0 && apparentPower > 0.1) {
          state.metrics.powerFactor = Math.min(1.0, Math.max(0.0, state.metrics.power / apparentPower));
        } else {
          state.metrics.powerFactor = 0.0;
        }

        // Handle energy calculation if separate energy resource was unreachable or zero
        const energyRes = results.find(r => r.key === 'energy');
        if (!energyRes || energyRes.value === null || isNaN(energyRes.value) || parseFloat(energyRes.value) <= 0) {
          let savedEnergy = parseFloat(localStorage.getItem('smart_meter_cumulative_energy'));
          if (isNaN(savedEnergy)) savedEnergy = 12.85;
          const deltaEnergy = (state.metrics.power / 1000.0) * (2.0 / 3600.0);
          const rawEnergy = savedEnergy + deltaEnergy;
          localStorage.setItem('smart_meter_cumulative_energy', rawEnergy.toString());
          state.metrics.energy = Math.max(0.0, rawEnergy - state.energyOffset);
        }
        
        state.isDeviceOnline = true;
        updateStatusIndicator(true, "Device Online");
        return;
      } else {
        if (isDemo) {
          state.isDeviceOnline = true;
          updateStatusIndicator(true, "Demo Mode (IoT links unreachable)");
          generateSimulatedData();
        } else {
          state.isDeviceOnline = false;
          updateStatusIndicator(false, "Device Offline");
          setMetricsToZero();
        }
      }
    } catch (e) {
      console.warn("Parallel fetch failed:", e);
      if (isDemo) {
        state.isDeviceOnline = true;
        updateStatusIndicator(true, "Demo Mode (Parallel fetch error)");
        generateSimulatedData();
      } else {
        state.isDeviceOnline = false;
        updateStatusIndicator(false, "Device Offline");
        setMetricsToZero();
      }
    }
    return;
  }

  // Fallback to original single resource payload fetch
  if (!token) {
    if (isDemo) {
      state.isDeviceOnline = true;
      updateStatusIndicator(true, "Demo Mode: Connected");
      generateSimulatedData();
    } else {
      state.isDeviceOnline = false;
      updateStatusIndicator(false, "Device Offline");
      setMetricsToZero();
    }
    return;
  }

  const url = `https://api.thinger.io/v2/users/${username}/devices/${deviceId}/${resource}?authorization=${token}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      let payload = data;
      if (data && data.out !== undefined) {
        payload = data.out;
      } else if (data && data.in !== undefined) {
        payload = data.in;
      }
      
      const mapped = parseThingerPayload(payload);
      if (mapped && (mapped.voltage !== undefined || mapped.current !== undefined || mapped.power !== undefined)) {
        state.metrics.voltage = parseFloat(mapped.voltage || 0);
        state.metrics.current = parseFloat(mapped.current || 0);
        state.metrics.power = parseFloat(mapped.power || 0);
        
        if (mapped.energy !== undefined && parseFloat(mapped.energy) > 0) {
          state.metrics.energy = parseFloat(mapped.energy);
        } else {
          let savedEnergy = parseFloat(localStorage.getItem('smart_meter_cumulative_energy'));
          if (isNaN(savedEnergy)) savedEnergy = 12.85;
          const deltaEnergy = (state.metrics.power / 1000.0) * (2.0 / 3600.0);
          const rawEnergy = savedEnergy + deltaEnergy;
          localStorage.setItem('smart_meter_cumulative_energy', rawEnergy.toString());
          state.metrics.energy = Math.max(0.0, rawEnergy - state.energyOffset);
        }
        
        state.metrics.frequency = 50.0; // Standard 50 Hz
        
        // Calculate Power Factor: Power / (Voltage * Current)
        const apparentPower = state.metrics.voltage * state.metrics.current;
        if (state.metrics.power > 0 && apparentPower > 0.1) {
          state.metrics.powerFactor = Math.min(1.0, Math.max(0.0, state.metrics.power / apparentPower));
        } else {
          state.metrics.powerFactor = 0.0;
        }
        
        state.isDeviceOnline = true;
        updateStatusIndicator(true, "Device Online");
      } else {
        if (isDemo) {
          state.isDeviceOnline = true;
          updateStatusIndicator(true, "Demo Mode (Invalid API payload)");
          generateSimulatedData();
        } else {
          state.isDeviceOnline = false;
          updateStatusIndicator(false, "Device Offline");
          setMetricsToZero();
        }
      }
    } else {
      if (isDemo) {
        state.isDeviceOnline = true;
        updateStatusIndicator(true, `Demo Mode (HTTP ${response.status})`);
        generateSimulatedData();
      } else {
        state.isDeviceOnline = false;
        updateStatusIndicator(false, "Device Offline");
        setMetricsToZero();
      }
    }
  } catch (err) {
    console.warn("Thinger.io fetch failed:", err);
    if (isDemo) {
      state.isDeviceOnline = true;
      updateStatusIndicator(true, "Demo Mode (Connection failed)");
      generateSimulatedData();
    } else {
      state.isDeviceOnline = false;
      updateStatusIndicator(false, "Device Offline");
      setMetricsToZero();
    }
  }
}

/**
 * Parses Thinger.io payloads into electrical metrics
 */
function parseThingerPayload(payload) {
  if (!payload) return null;
  if (typeof payload !== 'object') return null;
  
  const findValue = (keys) => {
    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();
      if (keys.some(k => lowerKey === k || lowerKey.includes(k))) {
        return payload[key];
      }
    }
    return undefined;
  };

  const voltage = findValue(['voltage', 'volt', 'v']);
  const current = findValue(['current', 'amp', 'curr', 'i', 'a']);
  const power = findValue(['power', 'watt', 'w', 'p']);
  const energy = findValue(['energy', 'kwh', 'e']);
  const frequency = findValue(['frequency', 'freq', 'f', 'hz']);
  const powerFactor = findValue(['powerfactor', 'power_factor', 'pf']);

  return { voltage, current, power, energy, frequency, powerFactor };
}

/**
 * Resets grid variables to zero when offline
 */
function setMetricsToZero() {
  state.metrics.voltage = 0.0;
  state.metrics.current = 0.0;
  state.metrics.power = 0.0;
  state.metrics.energy = 0.0;
  state.metrics.frequency = 0.0;
  state.metrics.powerFactor = 0.0;
}

/**
 * Generates beautifully fluctuating simulated measurements
 */
function generateSimulatedData() {
  if (!state.isDeviceOnline) {
    setMetricsToZero();
    return;
  }
  
  // 1. Simulate stable grid Voltage (Normally ~230V, fluctuates +/- 1.5V naturally)
  const baseVoltage = 230.0;
  const voltFluctuation = Math.sin(Date.now() / 15000) * 1.2 + (Math.random() * 0.4 - 0.2);
  state.metrics.voltage = parseFloat((baseVoltage + voltFluctuation).toFixed(1));
  
  // 2. Simulate Active Power based on normal household appliance loads
  // We have base load (LED Lights + Laptop/Router) and a cycling Refrigerator
  let activeW = DEMO_APPLIANCES[0].power + DEMO_APPLIANCES[4].power; // 45W + 120W = 165W base
  let totalPF = (DEMO_APPLIANCES[0].power * DEMO_APPLIANCES[0].pf) + (DEMO_APPLIANCES[4].power * DEMO_APPLIANCES[4].pf);
  
  // Refrigerator cycles on and off naturally over 1-minute intervals (30s on, 30s off)
  const fridgeCycle = Math.floor(Date.now() / 1000) % 60;
  if (fridgeCycle < 30) {
    activeW += DEMO_APPLIANCES[1].power; // +150W
    totalPF += (DEMO_APPLIANCES[1].power * DEMO_APPLIANCES[1].pf);
  }
  
  // Calculate power factor with tiny noise
  const computedPf = parseFloat((totalPF / activeW).toFixed(2));
  state.metrics.powerFactor = Math.max(0.8, Math.min(0.99, computedPf + (Math.random() * 0.01 - 0.005)));
  
  // Small load variation (simulating fine adjustments in devices)
  activeW += (Math.random() * 6 - 3);
  state.metrics.power = parseFloat(Math.max(50.0, activeW).toFixed(1));
  
  // 3. Current (A) = Power (W) / (Voltage (V) * PF)
  const denominator = state.metrics.voltage * state.metrics.powerFactor;
  const calcCurrent = denominator > 0 ? (state.metrics.power / denominator) : 0;
  state.metrics.current = parseFloat(Math.max(0.05, calcCurrent).toFixed(2));
  
  // Track peak current observed
  if (state.metrics.current > state.peakCurrent) {
    state.peakCurrent = state.metrics.current;
  }
  
  // 4. Energy (kWh) increments based on Power over 2-second tick (2/3600 hour)
  let savedEnergy = parseFloat(localStorage.getItem('smart_meter_cumulative_energy'));
  if (isNaN(savedEnergy)) savedEnergy = 12.85;
  
  const increment = (state.metrics.power / 1000.0) * (2.0 / 3600.0);
  const rawEnergy = parseFloat((savedEnergy + increment).toFixed(5));
  localStorage.setItem('smart_meter_cumulative_energy', rawEnergy);
  
  state.metrics.energy = Math.max(0.0, rawEnergy - state.energyOffset);
  
  // 5. Grid Frequency (50 Hz is standard so display it as it is)
  state.metrics.frequency = 50.00;
}

/**
 * Triggers all values to zero when system goes offline
 */
function triggerOfflineState() {
  state.metrics.voltage = 0.0;
  state.metrics.current = 0.0;
  state.metrics.power = 0.0;
  state.metrics.frequency = 0.0;
  state.metrics.powerFactor = 0.0;
  
  processMeasurementUpdates();
}

/**
 * Clean offline alarm cooldown when device returns online
 */
function resetOfflineAlertCooldown() {
  state.alertTriggered.offline = false;
}

// ----------------------------------------------------
// 3. Calculations & Diagnostics (Health and Bill)
// ----------------------------------------------------

/**
 * Process new calculations, update charts history, triggers alarm bounds, and renders metrics to DOM
 */
function processMeasurementUpdates() {
  // Keep values bounded
  state.metrics.voltage = Math.max(0, state.metrics.voltage);
  state.metrics.current = Math.max(0, state.metrics.current);
  state.metrics.power = Math.max(0, state.metrics.power);
  state.metrics.energy = Math.max(0, state.metrics.energy);
  state.metrics.frequency = Math.max(0, state.metrics.frequency);
  state.metrics.powerFactor = Math.max(0, Math.min(1.0, state.metrics.powerFactor));

  // Update DOM readouts
  renderMetricsToDOM();
  
  // Evaluate health index rating
  const healthScore = calculateHealthScore();
  updateHealthDisplay(healthScore);
  
  // Evaluate monthly billing projections
  updateBillCalculations();
  
  // Update recommendations box based on active indicators
  generateDynamicRecommendations(healthScore);
  
  // Perform Safety Boundaries Checks
  evaluateAlarms();
  
  // Record current tick metrics to scroll chart history
  recordHistoryPoint();
}

/**
 * Renders numerical telemetry parameters to their respective DOM coordinates
 */
function renderMetricsToDOM() {
  if (elements.voltageVal) elements.voltageVal.innerText = `${state.metrics.voltage.toFixed(1)} V`;
  if (elements.currentVal) elements.currentVal.innerText = `${state.metrics.current.toFixed(2)} A`;
  if (elements.powerVal) elements.powerVal.innerText = `${state.metrics.power.toFixed(1)} W`;
  if (elements.energyVal) elements.energyVal.innerText = `${state.metrics.energy.toFixed(2)} kWh`;
  if (elements.frequencyVal) elements.frequencyVal.innerText = `${state.metrics.frequency.toFixed(2)} Hz`;
  if (elements.pfVal) elements.pfVal.innerText = `${state.metrics.powerFactor.toFixed(2)}`;
  
  // Voltage Stability Indicator
  if (!state.isDeviceOnline) {
    elements.voltageStatus.innerHTML = `<span style="color: var(--danger);">Grid Disconnected</span>`;
  } else if (state.metrics.voltage > state.config.thresholds.overVoltage) {
    elements.voltageStatus.innerHTML = `<span style="color: var(--danger);"><i data-lucide="alert-triangle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> Over-Voltage</span>`;
  } else if (state.metrics.voltage < state.config.thresholds.underVoltage) {
    elements.voltageStatus.innerHTML = `<span style="color: var(--danger);"><i data-lucide="alert-triangle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> Under-Voltage</span>`;
  } else {
    elements.voltageStatus.innerHTML = `<span style="color: var(--success);"><i data-lucide="check-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> Grid Stable</span>`;
  }
  
  // Current Peak and Load Gauge
  elements.currentPeak.innerText = `Peak load: ${state.peakCurrent.toFixed(2)} A`;
  const currentPercentage = Math.min(100, (state.metrics.current / 16.0) * 100); // 16A as rating limit
  elements.currentGauge.style.width = `${currentPercentage}%`;
  if (state.metrics.current > 12) {
    elements.currentGauge.style.backgroundColor = "var(--danger)";
  } else if (state.metrics.current > 7) {
    elements.currentGauge.style.backgroundColor = "var(--warning)";
  } else {
    elements.currentGauge.style.backgroundColor = "var(--success)";
  }
  
  // Active Power Load Assessment
  if (!state.isDeviceOnline) {
    elements.powerLoad.innerText = "Load Status: Offline";
  } else if (state.metrics.power > 2000) {
    elements.powerLoad.innerHTML = `<span style="color: var(--danger); font-weight: 600;">Critical Load (Heavy)</span>`;
  } else if (state.metrics.power > 800) {
    elements.powerLoad.innerHTML = `<span style="color: var(--warning); font-weight: 500;">Medium Load</span>`;
  } else if (state.metrics.power > 30) {
    elements.powerLoad.innerHTML = `<span style="color: var(--success);">Normal Active Load</span>`;
  } else {
    elements.powerLoad.innerText = "Load: Standby / Low";
  }
  
  // Energy carbon calculation (Standard AC Grid constant: ~0.85 kg CO2 per kWh)
  const co2 = state.metrics.energy * 0.85;
  if (elements.carbonFootprint) elements.carbonFootprint.innerText = `Est CO₂: ${co2.toFixed(2)} kg`;
  
  // Frequency Status
  if (elements.frequencyStability) {
    if (!state.isDeviceOnline) {
      elements.frequencyStability.innerText = "Status: Grid Sync Lost";
    } else if (Math.abs(state.metrics.frequency - 50) > 0.5) {
      elements.frequencyStability.innerHTML = `<span style="color: var(--danger);">Frequency Fluctuations</span>`;
    } else {
      elements.frequencyStability.innerHTML = `<span style="color: var(--text-muted);">Synchronized (50 Hz)</span>`;
    }
  }
  
  // Power Factor Phase Indicators
  if (elements.pfPhase) {
    if (!state.isDeviceOnline) {
      elements.pfPhase.innerText = "Load Phase: N/A";
    } else if (state.metrics.powerFactor > 0.95) {
      elements.pfPhase.innerText = "Phase: Highly Resistive";
    } else if (state.metrics.powerFactor < 0.85) {
      elements.pfPhase.innerHTML = `<span style="color: var(--warning); font-weight: 500;">Phase: Highly Inductive</span>`;
    } else {
      elements.pfPhase.innerText = "Phase: Balanced Inductive";
    }
  }
  
  // Refresh Lucide Icons inside dynamic text elements
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Calculates a unified energy health score (0-100) based on Voltage stability, PF, and Current load margins
 */
function calculateHealthScore() {
  if (!state.isDeviceOnline) return 0;
  
  // 1. Voltage Stability Component (Base is 230V, drops outside 220V-240V penalize score)
  const vDev = Math.abs(state.metrics.voltage - 230);
  let vScore = 100 - (vDev * 3.0); // 10V deviation = -30 points
  vScore = Math.max(0, Math.min(100, vScore));
  
  // 2. Power Factor quality component (Perfect PF is 1.0, low PF penalizes heavily)
  let pfScore = 100;
  if (state.metrics.powerFactor < 0.90) {
    // Drop points for inductive power inefficiencies
    pfScore = 100 - ((0.90 - state.metrics.powerFactor) * 150);
  }
  pfScore = Math.max(0, Math.min(100, pfScore));
  
  // 3. Current Load capacity safety (16A limit, running > 10A starts dropping score safety factor)
  let loadScore = 100;
  if (state.metrics.current > 10.0) {
    loadScore = 100 - ((state.metrics.current - 10.0) * 16.6); // 16A limit drops score towards 0
  }
  loadScore = Math.max(0, Math.min(100, loadScore));
  
  // Weightings: 40% Voltage, 40% PF Efficiency, 20% Load Safety margins
  const finalScore = Math.round((vScore * 0.40) + (pfScore * 0.40) + (loadScore * 0.20));
  return finalScore;
}

/**
 * Updates UI gauge displays for the health index score
 */
function updateHealthDisplay(score) {
  elements.healthScoreValue.innerText = score;
  
  // Configure SVG Dash Offset mapping (total dash array is 402)
  const offset = 364 - (score / 100) * 364; // Adjust according to scale
  elements.healthProgressRing.style.strokeDashoffset = offset;
  
  // Reset badges styling
  elements.healthScoreBadge.className = "health-status-badge";
  
  if (!state.isDeviceOnline) {
    elements.healthScoreBadge.innerText = "Offline";
    elements.healthScoreBadge.classList.add("health-poor");
    elements.healthProgressRing.style.stroke = "var(--danger)";
    
    elements.healthBreakdownVoltage.innerText = "N/A";
    elements.healthBreakdownPf.innerText = "N/A";
    elements.healthBreakdownLoad.innerText = "N/A";
    return;
  }
  
  // Select color & diagnosis text
  if (score >= 90) {
    elements.healthScoreBadge.innerText = "Excellent";
    elements.healthScoreBadge.classList.add("health-excellent");
    elements.healthProgressRing.style.stroke = "var(--success)";
  } else if (score >= 75) {
    elements.healthScoreBadge.innerText = "Good";
    elements.healthScoreBadge.classList.add("health-good");
    elements.healthProgressRing.style.stroke = "var(--primary)";
  } else if (score >= 50) {
    elements.healthScoreBadge.innerText = "Fair";
    elements.healthScoreBadge.classList.add("health-fair");
    elements.healthProgressRing.style.stroke = "var(--warning)";
  } else {
    elements.healthScoreBadge.innerText = "Poor";
    elements.healthScoreBadge.classList.add("health-poor");
    elements.healthProgressRing.style.stroke = "var(--danger)";
  }
  
  // Update breakdown stats
  const vDev = Math.abs(state.metrics.voltage - 230);
  elements.healthBreakdownVoltage.innerText = vDev <= 5 ? "Excellent (Stable)" : (vDev <= 12 ? "Normal (Minor Dev)" : "Poor (Highly Unstable)");
  elements.healthBreakdownVoltage.style.color = vDev <= 5 ? "var(--success)" : (vDev <= 12 ? "var(--warning)" : "var(--danger)");
  
  elements.healthBreakdownPf.innerText = state.metrics.powerFactor >= 0.90 ? "Excellent (Highly Eff)" : (state.metrics.powerFactor >= 0.80 ? "Good (Inductive)" : "Poor (Lagging Low)");
  elements.healthBreakdownPf.style.color = state.metrics.powerFactor >= 0.90 ? "var(--success)" : (state.metrics.powerFactor >= 0.80 ? "var(--warning)" : "var(--danger)");
  
  elements.healthBreakdownLoad.innerText = state.metrics.current < 8 ? "Safe (Low Load)" : (state.metrics.current < 12 ? "Caution (Medium Load)" : "Overload Threat");
  elements.healthBreakdownLoad.style.color = state.metrics.current < 8 ? "var(--success)" : (state.metrics.current < 12 ? "var(--warning)" : "var(--danger)");
}

/**
 * Predicts electricity bill dynamically using accumulated energy + current load extrapolation
 */
function updateBillCalculations() {
  const tariff = state.config.tariff;
  const accruedCost = state.metrics.energy * tariff;
  elements.currentCostVal.innerText = `₹${accruedCost.toFixed(2)}`;
  
  // Estimate Month-end Bill (Extrapolating current load parameters safely)
  // Assume we have a simulated billing cycle of 30 days.
  // We assume the project has been running for a simulated average elapsed period of 7 days
  // during which energy of state.metrics.energy was consumed.
  // The rest of the 23 days are forecasted based on active wattage running at a 45% utilization coefficient.
  const elapsedDaysSimulated = 7.5;
  const totalDaysCycle = 30.0;
  const remainingDays = totalDaysCycle - elapsedDaysSimulated;
  
  // Projected energy in kWh = Active cumulative energy + (Current load in kW * hours remaining * duty factor)
  const currentKW = state.metrics.power / 1000.0;
  const remainingHours = remainingDays * 24;
  const averageDutyFactor = 0.40; // 40% typical household load duty cycle
  
  const estimatedRemainingKWh = currentKW * remainingHours * averageDutyFactor;
  const projectedMonthlyKWh = state.isDeviceOnline ? (state.metrics.energy + estimatedRemainingKWh) : state.metrics.energy;
  const projectedBill = projectedMonthlyKWh * tariff;
  
  elements.predictedBillVal.innerText = `₹${projectedBill.toFixed(2)}`;
  
  // Progress Bar for Budget/Target Limit
  const limitKWh = state.config.targetLimit;
  elements.budgetTargetLabel.innerText = `${state.metrics.energy.toFixed(2)} / ${limitKWh} kWh`;
  
  const budgetPct = Math.min(100, (state.metrics.energy / limitKWh) * 100);
  elements.budgetProgressIndicator.style.width = `${budgetPct}%`;
  
  if (budgetPct >= 90) {
    elements.budgetProgressIndicator.style.backgroundColor = "var(--danger)";
  } else if (budgetPct >= 70) {
    elements.budgetProgressIndicator.style.backgroundColor = "var(--warning)";
  } else {
    elements.budgetProgressIndicator.style.backgroundColor = "var(--primary)";
  }
}

// ----------------------------------------------------
// 4. Safety Alarm & Email Engine
// ----------------------------------------------------

/**
 * Validates current electrical parameters against safety boundaries
 */
function evaluateAlarms() {
  if (!state.isDeviceOnline) return;
  
  const { overVoltage, underVoltage, maxPower, maxEnergy } = state.config.thresholds;
  
  // 1. Check Over-voltage bounds
  if (state.metrics.voltage > overVoltage) {
    triggerAlarmCheck("overVoltage", true, `Critical High Voltage Warning! Measured ${state.metrics.voltage}V, exceeding safe limit of ${overVoltage}V.`);
  } else {
    triggerAlarmCheck("overVoltage", false);
  }
  
  // 2. Check Under-voltage bounds
  if (state.metrics.voltage < underVoltage && state.metrics.voltage > 50) { // Exclude 0V shutdown state
    triggerAlarmCheck("underVoltage", true, `Low Voltage Warning! Grid drop detected at ${state.metrics.voltage}V, below threshold of ${underVoltage}V.`);
  } else {
    triggerAlarmCheck("underVoltage", false);
  }
  
  // 3. Check Over-power load bounds
  if (state.metrics.power > maxPower) {
    triggerAlarmCheck("maxPower", true, `System Overload Alert! Wattage drawn is ${state.metrics.power}W, exceeding threshold of ${maxPower}W.`);
  } else {
    triggerAlarmCheck("maxPower", false);
  }
  
  // 4. Check energy target limit bounds
  if (state.metrics.energy > maxEnergy) {
    triggerAlarmCheck("maxEnergy", true, `Monthly Budget Limit Crossed! Energy consumption is ${state.metrics.energy.toFixed(2)} kWh, exceeding target limit of ${maxEnergy} kWh.`);
  } else {
    triggerAlarmCheck("maxEnergy", false);
  }
}

/**
 * Handles state transitions for safety alarms to avoid repeated logging and alerts spamming
 */
function triggerAlarmCheck(key, isTriggered, message) {
  // If state changed to active: log, toast, and send alert email
  if (isTriggered && !state.alertTriggered[key]) {
    state.alertTriggered[key] = true;
    
    // Log to alarm dashboard table
    addAlertToLog(key, message);
    
    // UI Toast Notification popup
    showToast(getAlarmHeading(key), message, "danger");

    // Automatically dispatch condition email alert if enabled
    dispatchConditionEmailAlert(key, message);
  } 
  // If state resets below safe limits
  else if (!isTriggered && state.alertTriggered[key]) {
    state.alertTriggered[key] = false;
    addAlertToLog(key + "_reset", `System Alert Restored: parameters returned within safe baseline bounds.`);
    showToast(`${getAlarmHeading(key)} Resolved`, "Energy parameter has returned to standard operating margins.", "success");
  }
}

/**
 * Returns clean labels for Alms headings
 */
function getAlarmHeading(key) {
  switch(key) {
    case 'overVoltage': return "Over-Voltage Violation";
    case 'underVoltage': return "Under-Voltage Violation";
    case 'maxPower': return "Power Overload Alert";
    case 'maxEnergy': return "Energy Budget Expended";
    case 'offline': return "ESP32 Device Offline";
    default: return "System Alert Warning";
  }
}

/**
 * Extract value parameter for the alerts emails
 */
function getMeasuredValString(key) {
  switch(key) {
    case 'overVoltage': return `${state.metrics.voltage} V`;
    case 'underVoltage': return `${state.metrics.voltage} V`;
    case 'maxPower': return `${state.metrics.power} W`;
    case 'maxEnergy': return `${state.metrics.energy.toFixed(2)} kWh`;
    case 'offline': return "Network Timeout";
    default: return "N/A";
  }
}

/**
 * Appends a row entry into the Alerts Logger element
 */
function addAlertToLog(key, description) {
  elements.alertsEmptyPlaceholder.style.display = "none";
  
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  
  const isReset = key.endsWith("_reset");
  const baseKey = isReset ? key.replace("_reset", "") : key;
  
  const severity = isReset ? "NORMAL" : (baseKey === "overVoltage" || baseKey === "maxPower" ? "CRITICAL" : "WARNING");
  const badgeClass = isReset ? "alert-normal" : (severity === "CRITICAL" ? "alert-danger" : "alert-warning");
  
  const valueCol = isReset ? "Resolved" : getMeasuredValString(baseKey);
  
  const rowHtml = `
    <tr>
      <td class="mono">${timestamp}</td>
      <td>${description}</td>
      <td class="mono">${valueCol}</td>
      <td><span class="alert-type-badge ${badgeClass}">${severity}</span></td>
    </tr>
  `;
  
  elements.alertsLogBody.insertAdjacentHTML('afterbegin', rowHtml);
  
  // Cap table log size at 25 items for memory safety
  if (elements.alertsLogBody.children.length > 25) {
    elements.alertsLogBody.lastElementChild.remove();
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ----------------------------------------------------
// 5. Smart Dynamic Recommendations
// ----------------------------------------------------

/**
 * Analyzes live readings and updates the recommendation panel with smart advice
 */
function generateDynamicRecommendations(healthScore) {
  const recommendationsList = [];
  
  if (!state.isDeviceOnline) {
    recommendationsList.push({
      priority: "high",
      title: "Simulation Paused",
      desc: "Ensure the telemetry data loop is running in the control panel to view real-time fluctuations."
    });
  } else {
    // 1. High voltage warnings
    if (state.metrics.voltage > state.config.thresholds.overVoltage) {
      recommendationsList.push({
        priority: "high",
        title: "Over-voltage Protection Triggered",
        desc: `Line Voltage reached ${state.metrics.voltage}V. Isolate sensitive electronic devices or activate servo stabilizers immediately.`
      });
    }
    
    // 2. Low voltage warnings
    if (state.metrics.voltage < state.config.thresholds.underVoltage) {
      recommendationsList.push({
        priority: "high",
        title: "Low Grid Voltage Detected",
        desc: `Line voltage dropped to ${state.metrics.voltage}V. Running heavy motor loads (AC, Fridge, Water pump) during low voltage can overheat coils. Power down heavy loads.`
      });
    }
    
    // 3. Power Factor analysis
    if (state.metrics.powerFactor < 0.85) {
      recommendationsList.push({
        priority: "medium",
        title: "Power Factor (PF) Inefficiency",
        desc: `Current Power Factor is lagging at ${state.metrics.powerFactor}. Install small shunt capacitor banks at high inductive load terminals to correct PF and reduce reactive penalties.`
      });
    }
    
    // 4. Overload power warning
    if (state.metrics.power > state.config.thresholds.maxPower) {
      recommendationsList.push({
        priority: "high",
        title: "Peak Energy Consumption Exceeded",
        desc: `Active load is drawing ${state.metrics.power}W. Defer high-current loads (AC, Washing Machine, Geyser) from active usage to avoid breaker trips.`
      });
    }
    
    // 5. Energy Target progress
    const budgetPct = (state.metrics.energy / state.config.targetLimit) * 100;
    if (budgetPct > 80) {
      recommendationsList.push({
        priority: "high",
        title: "Daily Energy Budget Warning",
        desc: `You have consumed ${budgetPct.toFixed(0)}% of your target electricity limit. Power down optional appliances to save cost.`
      });
    } else if (budgetPct > 50) {
      recommendationsList.push({
        priority: "medium",
        title: "Moderate Consumption Warning",
        desc: "Usage has crossed 50% of the daily limit. Shift heavy loads to off-peak periods."
      });
    }
    
    // 6. Good grid status feedback
    if (healthScore >= 92) {
      recommendationsList.push({
        priority: "low",
        title: "Optimal Energy Operation",
        desc: "All parameter balances are within excellent ratings. High power factor and stable voltages are minimizing active circuit losses."
      });
    }
  }
  
  // Render recommendations
  elements.recommendationsContainer.innerHTML = '';
  
  if (recommendationsList.length === 0) {
    elements.recommendationsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
        <i data-lucide="check" style="margin-bottom: 0.5rem; display: block; margin-left: auto; margin-right: auto;"></i>
        <p style="font-size: 0.85rem;">System is highly balanced. No active recommendations.</p>
      </div>
    `;
  } else {
    recommendationsList.forEach(item => {
      const priorityClass = item.priority === "high" ? "reco-high-priority" : (item.priority === "medium" ? "reco-medium-priority" : "reco-low-priority");
      const icon = item.priority === "high" ? "🚨" : (item.priority === "medium" ? "⚠️" : "💡");
      
      const itemHtml = `
        <div class="recommendation-item ${priorityClass}">
          <div class="reco-icon">${icon}</div>
          <div class="reco-content">
            <span class="reco-title">${item.title}</span>
            <span class="reco-desc">${item.desc}</span>
          </div>
        </div>
      `;
      elements.recommendationsContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ----------------------------------------------------
// 6. Chart.js Dynamic Trends Graph
// ----------------------------------------------------

/**
 * Pre-populates the historical timeline series so the graphs start with realistic trajectories
 */
function generateMockHistory() {
  const now = Date.now();
  for (let i = 19; i >= 0; i--) {
    const timestamp = new Date(now - i * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.history.timestamps.push(timestamp);
    
    // Start with 0.0 values as device begins in offline mode
    state.history.voltage.push(0.0);
    state.history.current.push(0.0);
    state.history.power.push(0.0);
    state.history.energy.push(0.0);
  }
}

/**
 * Pushes newest telemetry coordinates onto our historical array timeline
 */
function recordHistoryPoint() {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.history.timestamps.push(timestamp);
  
  state.history.voltage.push(state.metrics.voltage);
  state.history.current.push(state.metrics.current);
  state.history.power.push(state.metrics.power);
  state.history.energy.push(state.metrics.energy);
  
  // Splice old values beyond 20 intervals
  if (state.history.timestamps.length > 20) {
    state.history.timestamps.shift();
    state.history.voltage.shift();
    state.history.current.shift();
    state.history.power.shift();
    state.history.energy.shift();
  }
  
  // Redraw the graph dataset
  updateChartWithActiveTab();
}

/**
 * Initializes single, responsive Chart.js canvas object
 */
function initChart() {
  const ctx = document.getElementById('historicalTrendsChart').getContext('2d');
  
  // Set default configurations
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#a1a1aa'; // zinc-400
  
  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.history.timestamps,
      datasets: [{
        label: 'Voltage (V)',
        data: state.history.voltage,
        borderColor: '#10b981', // Emerald-500
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        backgroundColor: function(context) {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
          gradient.addColorStop(1, 'rgba(24, 24, 27, 0.00)');
          return gradient;
        },
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#09090b', // zinc-950
          titleColor: '#f4f4f5', // zinc-100
          bodyColor: '#a1a1aa', // zinc-400
          padding: 10,
          cornerRadius: 6,
          borderColor: '#27272a', // zinc-800
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 7, font: { size: 10 }, color: '#a1a1aa' }
        },
        y: {
          grid: { color: '#27272a' }, // zinc-800 grid lines
          ticks: { font: { size: 10 }, color: '#a1a1aa' }
        }
      },
      animations: {
        y: { duration: 300, easing: 'easeOutQuart' }
      }
    }
  });
}

/**
 * Binds active measurements to chart lines when users click dataset tabs
 */
function updateChartWithActiveTab() {
  if (!state.chartInstance) return;
  
  let dataSeries = [];
  let color = '#10b981';
  let fillGradientStart = 'rgba(16, 185, 129, 0.25)';
  let label = 'Voltage (V)';
  
  switch(state.activeChartTab) {
    case 'voltage':
      dataSeries = state.history.voltage;
      color = '#10b981'; // Emerald
      fillGradientStart = 'rgba(16, 185, 129, 0.25)';
      label = 'Voltage (V)';
      break;
    case 'current':
      dataSeries = state.history.current;
      color = '#f59e0b'; // Amber
      fillGradientStart = 'rgba(245, 158, 11, 0.25)';
      label = 'Current (A)';
      break;
    case 'power':
      dataSeries = state.history.power;
      color = '#ef4444'; // Red
      fillGradientStart = 'rgba(239, 68, 68, 0.25)';
      label = 'Active Power (W)';
      break;
    case 'energy':
      dataSeries = state.history.energy;
      color = '#8b5cf6'; // Purple
      fillGradientStart = 'rgba(139, 92, 246, 0.25)';
      label = 'Total Energy (kWh)';
      break;
  }
  
  // Set parameters dynamically
  state.chartInstance.data.labels = state.history.timestamps;
  state.chartInstance.data.datasets[0].label = label;
  state.chartInstance.data.datasets[0].data = dataSeries;
  state.chartInstance.data.datasets[0].borderColor = color;
  state.chartInstance.data.datasets[0].pointBackgroundColor = color;
  
  // Update Gradient
  state.chartInstance.data.datasets[0].backgroundColor = function(context) {
    const chart = context.chart;
    const {ctx, chartArea} = chart;
    if (!chartArea) return null;
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, fillGradientStart);
    gradient.addColorStop(1, 'rgba(24, 24, 27, 0.00)');
    return gradient;
  };
  
  state.chartInstance.update('none'); // Update smoothly without reset flickers
}

// ----------------------------------------------------
// 7. General Helper Functions
// ----------------------------------------------------

/**
 * Renders beautiful dynamic banner alerts to our Toast center
 */
function showToast(title, message, type = 'info') {
  const id = `toast-${Date.now()}`;
  const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'alert-octagon' : (type === 'warning' ? 'alert-triangle' : 'info'));
  const typeClass = `toast-${type}`;
  
  const html = `
    <div class="toast ${typeClass}" id="${id}">
      <i data-lucide="${icon}"></i>
      <div class="toast-content">
        <strong class="toast-title">${title}</strong>
        <span class="toast-msg">${message}</span>
      </div>
    </div>
  `;
  
  elements.toastCenter.insertAdjacentHTML('beforeend', html);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  const toastNode = document.getElementById(id);
  
  // Auto-expire toast after 5 seconds
  setTimeout(() => {
    toastNode.style.animation = 'slide-in-toast 0.3s ease-in reverse forwards';
    setTimeout(() => {
      toastNode.remove();
    }, 300);
  }, 5000);
}

/**
 * Triggers changes in connection widget color classes
 */
function updateStatusIndicator(online, text) {
  elements.statusText.innerText = text;
  if (online) {
    elements.connectionStatus.className = "status-indicator status-online";
  } else {
    elements.connectionStatus.className = "status-indicator status-offline";
  }

  // Live Connectivity Diagnostic updates
  const dConn = document.getElementById('diag-active-conn');
  const dUser = document.getElementById('diag-username');
  const dDev = document.getElementById('diag-device-id');
  const dRes = document.getElementById('diag-resource');
  const dUrl = document.getElementById('diag-api-url');

  if (dConn) {
    if (online) {
      dConn.innerText = text.includes("Demo") ? "Demo Fallback" : "Online & Synced";
      dConn.style.color = text.includes("Demo") ? "var(--warning)" : "var(--success)";
    } else {
      dConn.innerText = "Disconnected";
      dConn.style.color = "var(--danger)";
    }
  }

  if (dUser) dUser.innerText = state.config.thingerUsername || "None (Demo Mode)";
  if (dDev) dDev.innerText = state.config.thingerDeviceId || "None";
  if (dRes) dRes.innerText = state.config.thingerResourceName || "metrics";

  if (dUrl) {
    const maskedToken = state.config.thingerAccessToken ? "••••••••" : "";
    if (state.config.thingerUsername && state.config.thingerDeviceId) {
      dUrl.innerText = `https://api.thinger.io/v2/users/${state.config.thingerUsername}/devices/${state.config.thingerDeviceId}/${state.config.thingerResourceName || 'metrics'}${maskedToken ? '?authorization=' + maskedToken : ''}`;
    } else {
      dUrl.innerText = "N/A (Demo mode does not query Thinger.io server)";
    }
  }
}

/**
 * Renders a safe, beautiful, cross-iframe confirmation dialog modal.
 * Replaces standard window.confirm which is blocked inside sandboxed iframes.
 */
function customConfirm(message, onConfirm) {
  const id = `modal-${Date.now()}`;
  const html = `
    <div class="custom-modal-backdrop" id="${id}">
      <div class="custom-modal-content">
        <div class="custom-modal-header">
          <div class="custom-modal-icon">
            <i data-lucide="alert-triangle"></i>
          </div>
          <h3>Confirm Action</h3>
        </div>
        <div class="custom-modal-body">
          <p>${message}</p>
        </div>
        <div class="custom-modal-footer">
          <button class="custom-modal-btn btn-cancel">Cancel</button>
          <button class="custom-modal-btn btn-confirm">Confirm</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  const modalNode = document.getElementById(id);
  const cancelBtn = modalNode.querySelector('.btn-cancel');
  const confirmBtn = modalNode.querySelector('.btn-confirm');
  
  const closeModal = () => {
    modalNode.classList.add('fade-out');
    setTimeout(() => {
      modalNode.remove();
    }, 200);
  };
  
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });
  
  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
    onConfirm();
  });
  
  // Also close on background click
  modalNode.addEventListener('click', (e) => {
    if (e.target === modalNode) {
      closeModal();
    }
  });
}

/**
 * Checks for stored user sessions on app launch and restores state
 */
function checkActiveSession() {
  const savedSession = localStorage.getItem('gridpulse_session');
  if (savedSession) {
    try {
      const session = JSON.parse(savedSession);
      state.isLoggedIn = true;
      state.loggedInUser = session.username;
      state.isDemoMode = session.isDemoMode !== undefined ? session.isDemoMode : true;
      
      // Update UI state
      const userNameEl = document.getElementById('logged-in-user-name');
      if (userNameEl) {
        userNameEl.innerText = state.loggedInUser;
      }
      
      const loginScreenEl = document.getElementById('login-screen');
      if (loginScreenEl) {
        loginScreenEl.style.display = 'none';
      }
      
      const mainDashboardEl = document.getElementById('main-dashboard');
      if (mainDashboardEl) {
        mainDashboardEl.style.display = 'block';
      }
      
      if (window.lucide) {
        window.lucide.createIcons();
      }
      
      // Resume data pipeline
      resetAlertCooldowns();
      state.isDeviceOnline = false;
      updateStatusIndicator(false, "Device Offline");
      
      executeDataCycle();
      startDataPipeline();
      
      showToast("Session Restored", `Welcome back, ${state.loggedInUser}!`, "success");
    } catch (e) {
      console.error("Failed to parse saved session", e);
      clearSession();
    }
  } else {
    // Show login screen, hide dashboard, ensure pipeline is stopped
    const loginScreenEl = document.getElementById('login-screen');
    if (loginScreenEl) {
      loginScreenEl.style.display = 'flex';
    }
    
    const mainDashboardEl = document.getElementById('main-dashboard');
    if (mainDashboardEl) {
      mainDashboardEl.style.display = 'none';
    }
    
    if (state.fetchIntervalId) {
      clearInterval(state.fetchIntervalId);
      state.fetchIntervalId = null;
    }
  }
}

/**
 * Custom function to handle user login, session storage, and dashboard display
 */
function handleLogin(username, isDemoMode) {
  state.isLoggedIn = true;
  state.loggedInUser = username;
  state.isDemoMode = isDemoMode;
  
  // Persist session to local storage
  const session = {
    username: username,
    isDemoMode: isDemoMode,
    timestamp: Date.now()
  };
  localStorage.setItem('gridpulse_session', JSON.stringify(session));
  
  // Update UI profile elements
  const userNameEl = document.getElementById('logged-in-user-name');
  if (userNameEl) {
    userNameEl.innerText = username;
  }
  
  const loginScreenEl = document.getElementById('login-screen');
  if (loginScreenEl) {
    loginScreenEl.style.display = 'none';
  }
  
  const mainDashboardEl = document.getElementById('main-dashboard');
  if (mainDashboardEl) {
    mainDashboardEl.style.display = 'block';
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Reset alarm triggers & initiate pipeline
  resetAlertCooldowns();
  
  state.isDeviceOnline = false;
  updateStatusIndicator(false, "Device Offline");
  
  // Start execution and pipeline
  executeDataCycle();
  startDataPipeline();
  
  showToast("Authentication Success", `Welcome to GridPulse, ${username}!`, "success");
}

/**
 * Handles clearing sessions and returning back to the login screen
 */
function handleLogout() {
  state.isLoggedIn = false;
  state.loggedInUser = '';
  localStorage.removeItem('gridpulse_session');
  
  // Stop background telemetry loop
  if (state.fetchIntervalId) {
    clearInterval(state.fetchIntervalId);
    state.fetchIntervalId = null;
  }
  
  // Swap page views
  const mainDashboardEl = document.getElementById('main-dashboard');
  if (mainDashboardEl) {
    mainDashboardEl.style.display = 'none';
  }
  
  const loginScreenEl = document.getElementById('login-screen');
  if (loginScreenEl) {
    loginScreenEl.style.display = 'flex';
  }
  
  // Clear any inputs
  const pwdEl = document.getElementById('login-password');
  if (pwdEl) pwdEl.value = '';
  
  showToast("Logged Out", "You have been successfully logged out of GridPulse.", "info");
}

/**
 * Clears stale session state in case of exceptions
 */
function clearSession() {
  localStorage.removeItem('gridpulse_session');
  state.isLoggedIn = false;
  state.loggedInUser = '';
  checkActiveSession();
}

/* ==========================================================================
   ML Energy Budget & Appliance Runtime Planner Module
   ========================================================================== */

let mlAppliancesList = [
  { name: "Fan", watts: 75, priority: 8 },
  { name: "TV", watts: 120, priority: 5 },
  { name: "AC", watts: 1500, priority: 10 }
];

function initMlEnergyPlanner() {
  const container = document.getElementById('ml-appliance-rows-container');
  const budgetInput = document.getElementById('ml-budget-input');
  const addBtn = document.getElementById('ml-add-appliance-btn');
  const calculateBtn = document.getElementById('ml-calculate-btn');
  const refineBtn = document.getElementById('ml-refine-btn');

  if (!container || !budgetInput) return;

  // Update daily budget subtext on budget input change
  budgetInput.addEventListener('input', () => {
    const b = parseFloat(budgetInput.value) || 0;
    const dailyB = (b / 30).toFixed(2);
    const label = document.getElementById('ml-daily-budget-calc');
    if (label) label.innerText = `₹${dailyB} / day`;
  });

  renderMlApplianceRows();

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      mlAppliancesList = getMlAppliancesFromRows();
      mlAppliancesList.push({ name: '', watts: 100, priority: 1 });
      renderMlApplianceRows();
    });
  }

  if (calculateBtn) {
    calculateBtn.addEventListener('click', () => executeMlPlanCalculation(0));
  }

  if (refineBtn) {
    refineBtn.addEventListener('click', () => executeMlPlanCalculation(1));
  }

  // Auto-run initial calculation on render
  setTimeout(() => {
    executeMlPlanCalculation(0);
  }, 300);
}

function renderMlApplianceRows() {
  const container = document.getElementById('ml-appliance-rows-container');
  if (!container) return;

  container.innerHTML = '';

  mlAppliancesList.forEach((app, idx) => {
    const row = document.createElement('div');
    row.className = 'ml-appliance-row';
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 90px 80px 32px; gap: 0.4rem; align-items: center;';

    row.innerHTML = `
      <input type="text" class="form-control ml-app-name" value="${app.name}" placeholder="Appliance (e.g. Fridge)" style="padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
      <input type="number" class="form-control ml-app-watts" value="${app.watts}" placeholder="Watts" min="0" style="padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
      <input type="number" class="form-control ml-app-priority" value="${app.priority}" placeholder="Prio" min="1" max="10" style="padding: 0.4rem 0.5rem; font-size: 0.8rem;" />
      <button type="button" class="ml-remove-row-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--danger); border-radius: 4px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: var(--transition);" title="Delete Appliance">
        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
      </button>
    `;

    // Delete row event
    const removeBtn = row.querySelector('.ml-remove-row-btn');
    removeBtn.addEventListener('click', () => {
      mlAppliancesList = getMlAppliancesFromRows();
      mlAppliancesList.splice(idx, 1);
      if (mlAppliancesList.length === 0) {
        mlAppliancesList = [{ name: '', watts: 0, priority: 1 }];
      }
      renderMlApplianceRows();
    });

    container.appendChild(row);
  });

  if (window.lucide) window.lucide.createIcons();
}

function getMlAppliancesFromRows() {
  const container = document.getElementById('ml-appliance-rows-container');
  if (!container) return mlAppliancesList;

  const rows = [...container.querySelectorAll('.ml-appliance-row')];
  return rows.map(r => {
    const name = r.querySelector('.ml-app-name')?.value || '';
    const watts = parseFloat(r.querySelector('.ml-app-watts')?.value || '0') || 0;
    const priority = parseInt(r.querySelector('.ml-app-priority')?.value || '1', 10) || 1;
    return { name, watts, priority };
  });
}

async function executeMlPlanCalculation(refineLevel = 0) {
  const budgetInput = document.getElementById('ml-budget-input');
  const monthlyBudget = parseFloat(budgetInput?.value || '0') || 0;
  const currentAppliances = getMlAppliancesFromRows().filter(a => a.name.trim().length > 0);

  if (monthlyBudget <= 0) {
    showToast("Invalid Budget", "Please enter a monthly budget greater than ₹0.", "warning");
    return;
  }

  if (currentAppliances.length === 0) {
    showToast("No Appliances", "Please add at least one appliance name and power rating.", "warning");
    return;
  }

  const endpoint = refineLevel === 1 ? '/api/refine' : '/api/calculate';
  const payload = {
    budget: monthlyBudget,
    appliances: currentAppliances,
    refine_level: refineLevel
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    renderMlPlanResults(data, refineLevel);
    showToast(
      refineLevel === 1 ? "Plan Refined" : "Plan Calculated",
      "Energy budget runtime optimization complete.",
      "success"
    );
  } catch (err) {
    console.warn("API request failed, executing client-side fallback calculation:", err);
    const fallbackData = calculateEnergyPlanClient(monthlyBudget, currentAppliances, refineLevel);
    renderMlPlanResults(fallbackData, refineLevel);
    showToast("Plan Calculated", "Calculated energy budget plan locally.", "info");
  }
}

function renderMlPlanResults(data, refineLevel) {
  lastMlCalculationResult = data;
  const summaryBox = document.getElementById('ml-summary-box');
  const dailyBudgetKpi = document.getElementById('ml-kpi-daily-budget');
  const dailyProjectedKpi = document.getElementById('ml-kpi-daily-projected');
  const monthlyProjectedKpi = document.getElementById('ml-kpi-monthly-projected');
  const tableBody = document.getElementById('ml-result-table-body');
  const rawJsonBlock = document.getElementById('ml-raw-json-block');
  const statusBadge = document.getElementById('ml-plan-status-badge');

  if (summaryBox) {
    summaryBox.innerHTML = `<strong>Optimization Result:</strong> ${data.summary || 'Plan generated successfully.'}`;
  }

  const dailyBudgetVal = ((data.total_budget || 0) / 30).toFixed(2);
  const dailyProjectedVal = (data.total_projected_cost || 0).toFixed(2);
  const monthlyProjectedVal = ((data.total_projected_cost || 0) * 30).toFixed(2);

  if (dailyBudgetKpi) dailyBudgetKpi.innerText = `₹${dailyBudgetVal}`;
  if (dailyProjectedKpi) dailyProjectedKpi.innerText = `₹${dailyProjectedVal}`;
  if (monthlyProjectedKpi) monthlyProjectedKpi.innerText = `₹${monthlyProjectedVal}`;

  if (statusBadge) {
    statusBadge.innerText = refineLevel === 1 ? 'Refined Plan' : 'Standard Plan';
    statusBadge.style.background = refineLevel === 1 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    statusBadge.style.color = refineLevel === 1 ? '#3b82f6' : 'var(--success)';
  }

  if (tableBody) {
    tableBody.innerHTML = '';
    const apps = data.appliances || [];
    if (apps.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1rem;">No valid appliances returned.</td></tr>`;
    } else {
      apps.forEach(a => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
          <td style="padding: 0.5rem; font-weight: 500; color: var(--text-primary);">${a.name}</td>
          <td style="padding: 0.5rem; text-align: center;" class="mono">${a.watts} W</td>
          <td style="padding: 0.5rem; text-align: center;" class="mono">
            <span style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 2px 8px; border-radius: 12px; font-weight: 600;">
              ${a.suggested_daily_hours} hrs/day
            </span>
          </td>
          <td style="padding: 0.5rem; text-align: right; font-weight: 600; color: var(--text-primary);" class="mono">₹${(a.estimated_cost_per_day || 0).toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  }

  if (rawJsonBlock) {
    rawJsonBlock.textContent = JSON.stringify(data, null, 2);
  }
}

// Client-side fallback algorithm strictly implementing model requirements
function calculateEnergyPlanClient(monthlyBudget, appliances, refineLevel = 0) {
  const totalBudget = parseFloat(monthlyBudget) || 0;
  const dailyBudget = totalBudget / 30.0;

  const normApps = appliances
    .map(a => ({
      name: String(a.name || 'Unknown'),
      watts: parseFloat(a.watts) || 0,
      priority: parseInt(a.priority, 10) || 1
    }))
    .filter(a => a.name.trim().length > 0);

  normApps.sort((a, b) => b.priority - a.priority);

  const allowedDailyCost = dailyBudget;
  const weights = normApps.map(a => Math.max(a.priority, 1));
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

  const maxHours = 1000.0;
  const proposedHours = weights.map(w => maxHours * (w / weightSum));

  const costPerHour = normApps.map(a => (a.watts / 1000.0) * 8.0);
  const totalCostPerDay = proposedHours.reduce((s, h, i) => s + h * costPerHour[i], 0);

  let scale = 1.0;
  if (totalCostPerDay > 0 && totalCostPerDay > allowedDailyCost) {
    scale = allowedDailyCost / totalCostPerDay;
  }

  const adjustedHours = proposedHours.map(h => Math.max(0.0, h * scale));
  const costFromHours = (hrs) => hrs.reduce((s, h, i) => s + h * costPerHour[i], 0);

  let adjustedHoursInt = adjustedHours.map(h => parseFloat(h.toFixed(2)));
  let currentCost = costFromHours(adjustedHoursInt);

  const reduceOrder = normApps.map((_, i) => i).reverse();
  let idx = 0;
  while (currentCost > allowedDailyCost + 1e-6 && idx < reduceOrder.length) {
    const j = reduceOrder[idx];
    const step = 0.5;
    while (adjustedHoursInt[j] > 0 && currentCost > allowedDailyCost + 1e-6) {
      adjustedHoursInt[j] = parseFloat(Math.max(0.0, adjustedHoursInt[j] - step).toFixed(2));
      currentCost = costFromHours(adjustedHoursInt);
    }
    idx++;
  }

  const appliancesOut = normApps.map((a, i) => {
    const hours = adjustedHoursInt[i];
    const displayHours = parseFloat(Math.min(hours, 24.0).toFixed(2));
    const energyKwh = (a.watts / 1000.0) * hours;
    const estimatedCostPerDay = parseFloat((energyKwh * 8.0).toFixed(2));
    return {
      name: a.name,
      watts: a.watts,
      suggested_daily_hours: displayHours,
      estimated_cost_per_day: estimatedCostPerDay
    };
  });

  const totalProjectedCost = parseFloat(currentCost.toFixed(2));
  const savingsNeeded = Math.max(0.0, totalProjectedCost - allowedDailyCost);

  const summaryParts = [
    "Allocated daily runtime hours within your budget using priority-based scaling.",
    `Monthly budget converted to daily: ${dailyBudget.toFixed(2)} INR/day (30-day assumption).`
  ];

  if (refineLevel === 0) {
    summaryParts.push("Refine mode: off (standard plan).");
  } else {
    summaryParts.push("Refine mode: on (aggressive cap factor 1.00).");
  }

  if (savingsNeeded > 0) {
    summaryParts.push("To meet budget, lower-priority appliances were reduced first to bring total cost down.");
  } else {
    summaryParts.push("Plan is within budget based on the required energy/cost formula.");
  }

  return {
    summary: summaryParts.join(" "),
    total_budget: parseFloat(totalBudget.toFixed(2)),
    total_projected_cost: totalProjectedCost,
    appliances: appliancesOut
  };
}

/* ==========================================================================
   Email Dispatcher & Report Alert Module
   ========================================================================== */

let lastMlCalculationResult = null;

function initEmailDispatcher() {
  const form = document.getElementById('email-dispatch-form');
  const presetSelect = document.getElementById('email-preset-select');
  const subjectInput = document.getElementById('email-subject-input');
  const messageInput = document.getElementById('email-message-input');
  const recipientInput = document.getElementById('email-recipient-input');

  if (!form) return;

  // Load saved recipient email
  const savedEmail = localStorage.getItem('smart_meter_alert_email');
  if (savedEmail && recipientInput && !recipientInput.value) {
    recipientInput.value = savedEmail;
  }

  if (recipientInput) {
    recipientInput.addEventListener('input', () => {
      const val = recipientInput.value.trim();
      if (val) localStorage.setItem('smart_meter_alert_email', val);
    });
  }

  // Check email API status
  checkEmailServiceStatus();

  // Handle Preset Selection changes
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const selected = presetSelect.value;
      if (selected === 'ml_plan') {
        if (subjectInput) subjectInput.value = "⚡ ML Energy Budget Plan & Appliance Runtime Optimization";
        if (messageInput) messageInput.value = "Attached is your automated GridPulse energy allocation plan based on your monthly budget and appliance priorities.";
      } else if (selected === 'usage_alert') {
        if (subjectInput) subjectInput.value = "🚨 HIGH ENERGY USAGE ALERT - GridPulse Threshold Exceeded";
        if (messageInput) messageInput.value = "Alert: Current instantaneous power consumption has spiked above safety thresholds. Please review active appliances on your dashboard.";
      } else if (selected === 'monthly_summary') {
        if (subjectInput) subjectInput.value = "📊 GridPulse Smart Energy Dashboard - Monthly Executive Summary";
        if (messageInput) messageInput.value = "Here is your monthly energy usage summary, estimated billing projections, and efficiency recommendations from GridPulse.";
      } else if (selected === 'custom') {
        if (subjectInput) subjectInput.value = "GridPulse Energy Update";
        if (messageInput) messageInput.value = "";
      }
    });
  }

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipient = document.getElementById('email-recipient-input')?.value?.trim();
    const subject = subjectInput?.value?.trim() || "GridPulse Energy Update";
    const message = messageInput?.value?.trim() || "";
    const preset = presetSelect?.value;

    if (!recipient || !recipient.includes('@')) {
      showToast("Invalid Email", "Please enter a valid recipient email address.", "warning");
      return;
    }

    const sendBtn = document.getElementById('email-send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Sending Email...`;
      if (window.lucide) window.lucide.createIcons();
    }

    let reportData = null;
    if (preset === 'ml_plan' && lastMlCalculationResult) {
      reportData = lastMlCalculationResult;
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          message: message,
          reportData: reportData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send email");
      }

      showToast(
        result.mode === "SMTP" ? "Email Delivered!" : "Email Dispatched (Simulation)",
        result.message || `Sent report to ${recipient}`,
        "success"
      );

      // Add to recent logs list
      addEmailLogToList({
        to: recipient,
        subject: subject,
        sentAt: new Date().toLocaleTimeString(),
        status: result.mode === "SMTP" ? "DELIVERED" : "SIMULATED"
      });

    } catch (err) {
      console.error("Email API error:", err);
      showToast("Email Failed", err.message || "Could not dispatch email.", "danger");
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i data-lucide="send"></i> Send Email Now`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  });
}

async function checkEmailServiceStatus() {
  const badge = document.getElementById('email-server-status-badge');
  if (!badge) return;

  try {
    const res = await fetch('/api/email-status');
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (data.smtpConfigured) {
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = 'var(--success)';
      badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      badge.innerHTML = `<i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> SMTP Configured (${data.smtpHost})`;
    } else {
      badge.style.background = 'rgba(245, 158, 11, 0.15)';
      badge.style.color = 'var(--warning)';
      badge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      badge.innerHTML = `<i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> Active (Simulation Fallback Mode)`;
    }
  } catch (e) {
    badge.style.background = 'rgba(59, 130, 246, 0.15)';
    badge.style.color = 'var(--info)';
    badge.innerHTML = `<i data-lucide="check" style="width: 12px; height: 12px;"></i> Client Dispatch Ready`;
  }
  if (window.lucide) window.lucide.createIcons();
}

function addEmailLogToList(log) {
  const container = document.getElementById('email-recent-logs-list');
  if (!container) return;

  if (container.innerText.includes('No emails dispatched')) {
    container.innerHTML = '';
  }

  const div = document.createElement('div');
  div.style.cssText = 'padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;';
  div.innerHTML = `
    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
      <strong style="color: var(--text-primary);">${log.to}</strong> — ${log.subject}
    </div>
    <div style="font-size: 0.7rem;" class="mono">
      <span style="color: ${log.status === 'DELIVERED' ? 'var(--success)' : 'var(--info)'};">[${log.status}]</span> ${log.sentAt}
    </div>
  `;
  container.prepend(div);
}

/**
 * Automatically dispatches an email alert whenever an electrical condition threshold is breached
 */
function dispatchConditionEmailAlert(key, message) {
  const toggle = document.getElementById('email-auto-alerts-toggle');
  if (toggle && !toggle.checked) return;

  const recipientInput = document.getElementById('email-recipient-input');
  const recipient = recipientInput?.value?.trim() || localStorage.getItem('smart_meter_alert_email');

  if (!recipient || !recipient.includes('@')) {
    console.log("No valid email recipient configured for automatic condition alert.");
    return;
  }

  const heading = getAlarmHeading(key);
  const valStr = getMeasuredValString(key);

  fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: recipient,
      subject: `🚨 [GRIDPULSE THRESHOLD ALERT] ${heading}`,
      message: `GridPulse Smart Energy Alert Triggered:\n\nViolation: ${heading}\nMessage: ${message}\nMeasured Parameter: ${valStr}\nTimestamp: ${new Date().toLocaleString()}\n\nGridPulse Automated Grid Safety System`
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log("Automated condition email alert dispatched:", data);
    addEmailLogToList({
      to: recipient,
      subject: `🚨 [AUTO ALERT] ${heading}`,
      sentAt: new Date().toLocaleTimeString(),
      status: data.mode === "SMTP" ? "DELIVERED" : "SIMULATED"
    });
  })
  .catch(err => {
    console.warn("Failed to dispatch automated condition email alert:", err);
  });
}

