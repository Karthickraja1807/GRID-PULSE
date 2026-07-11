import express from "express";
import path from "path";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

// In-memory email log for testing and dashboard status
const emailLogs: Array<{ id: string; to: string; subject: string; sentAt: string; status: string; mode: string }> = [];

app.use(express.json());

// Health Check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

interface ApplianceInput {
  name?: string;
  watts?: number | string;
  power?: number | string;
  priority?: number | string;
}

interface NormalizedAppliance {
  name: string;
  watts: number;
  priority: number;
}

interface ApplianceOutput {
  name: string;
  watts: number;
  suggested_daily_hours: number;
  estimated_cost_per_day: number;
}

function normalizeAppliance(appliance: ApplianceInput): NormalizedAppliance {
  const wattsVal = appliance.watts ?? appliance.power ?? 0;
  const priorityVal = appliance.priority ?? 1;
  return {
    name: String(appliance.name || "Unknown"),
    watts: Math.max(0, parseFloat(String(wattsVal)) || 0),
    priority: Math.max(1, parseInt(String(priorityVal), 10) || 1),
  };
}

function calculateEnergyPlan(
  monthlyBudget: number,
  appliances: ApplianceInput[],
  refineLevel = 0
) {
  const totalBudget = Number(monthlyBudget);
  if (isNaN(totalBudget) || totalBudget <= 0) {
    throw new Error("monthly budget must be > 0");
  }

  const dailyBudget = totalBudget / 30.0;

  const rawApps = Array.isArray(appliances) ? appliances : [];
  const normApps: NormalizedAppliance[] = rawApps
    .map(normalizeAppliance)
    .filter((a) => a.name.trim().length > 0);

  if (normApps.length === 0) {
    throw new Error("At least one appliance is required");
  }

  // Basic prioritization: higher priority gets more hours.
  normApps.sort((a, b) => b.priority - a.priority);

  const allowedDailyCost = dailyBudget;
  const refineFactor = 1.0;

  const weights = normApps.map((a) => Math.max(a.priority, 1));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  const maxHours = 1000.0;
  const proposedHours: number[] = [];

  // Cost per hour: (watts / 1000) * 8.0 INR
  const costPerHour = normApps.map((a) => (a.watts / 1000.0) * 8.0);

  for (const w of weights) {
    proposedHours.push(maxHours * (w / weightSum));
  }

  const totalCostPerDay = proposedHours.reduce(
    (sum, h, i) => sum + h * costPerHour[i],
    0
  );
  let scale = 1.0;
  if (totalCostPerDay > 0 && totalCostPerDay > allowedDailyCost) {
    scale = allowedDailyCost / totalCostPerDay;
  }

  const adjustedHours = proposedHours.map((h) => Math.max(0.0, h * scale));

  const costFromHours = (hours: number[]) =>
    hours.reduce((sum, h, i) => sum + h * costPerHour[i], 0);

  const adjustedHoursInt = adjustedHours.map((h) => Number(h.toFixed(2)));
  let currentCost = costFromHours(adjustedHoursInt);

  // Greedily reduce from lowest priority until within allowed.
  const reduceOrder = normApps.map((_, i) => i).reverse();
  let idx = 0;

  while (currentCost > allowedDailyCost + 1e-6 && idx < reduceOrder.length) {
    const j = reduceOrder[idx];
    const step = 0.5;
    while (adjustedHoursInt[j] > 0 && currentCost > allowedDailyCost + 1e-6) {
      adjustedHoursInt[j] = Number(
        Math.max(0.0, adjustedHoursInt[j] - step).toFixed(2)
      );
      currentCost = costFromHours(adjustedHoursInt);
    }
    idx++;
  }

  const appliancesOut: ApplianceOutput[] = [];
  const totalProjectedCost = Number(currentCost.toFixed(2));

  for (let i = 0; i < normApps.length; i++) {
    const a = normApps[i];
    const hours = adjustedHoursInt[i];
    const displayHours = Number(Math.min(hours, 24.0).toFixed(2));

    const energyKwh = (a.watts / 1000.0) * hours;
    const estimatedCostPerDay = Number((energyKwh * 8.0).toFixed(2));

    appliancesOut.push({
      name: a.name,
      watts: a.watts,
      suggested_daily_hours: displayHours,
      estimated_cost_per_day: estimatedCostPerDay,
    });
  }

  const savingsNeeded = Math.max(0.0, totalProjectedCost - allowedDailyCost);
  const summaryParts: string[] = [
    "Allocated daily runtime hours within your budget using priority-based scaling.",
    `Monthly budget converted to daily: ${dailyBudget.toFixed(
      2
    )} INR/day (30-day assumption).`,
  ];

  if (refineLevel === 0) {
    summaryParts.push("Refine mode: off (standard plan).");
  } else {
    summaryParts.push(
      `Refine mode: on (aggressive cap factor ${refineFactor.toFixed(2)}).`
    );
  }

  if (savingsNeeded > 0) {
    summaryParts.push(
      "To meet budget, lower-priority appliances were reduced first (greedy clamp) to bring total cost down."
    );
  } else {
    summaryParts.push(
      "Plan is within budget based on the required energy/cost formula."
    );
  }

  return {
    summary: summaryParts.join(" "),
    total_budget: Number(totalBudget.toFixed(2)),
    total_projected_cost: Number(totalProjectedCost.toFixed(2)),
    appliances: appliancesOut,
  };
}

function parseRequestPayload(req: express.Request) {
  const payload = req.body || {};
  const monthlyBudget = parseFloat(
    String(
      payload.budget ?? payload.total_budget ?? payload.monthly_budget ?? 0
    )
  );
  const appliances = payload.appliances || [];
  const refineLevel = parseInt(String(payload.refine_level ?? 0), 10);
  return { monthlyBudget, appliances, refineLevel };
}

app.post("/api/calculate", (req, res) => {
  try {
    const { monthlyBudget, appliances } = parseRequestPayload(req);
    const result = calculateEnergyPlan(monthlyBudget, appliances, 0);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Invalid calculation payload" });
  }
});

app.post("/api/refine", (req, res) => {
  try {
    const { monthlyBudget, appliances } = parseRequestPayload(req);
    const result = calculateEnergyPlan(monthlyBudget, appliances, 1);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Invalid calculation payload" });
  }
});

// Server-side simulated state for fallback
let serverSimEnergy = 12.85;
let serverPeakCurrent = 0.0;
let lastServerSimTime = Date.now();

function getSimulatedData() {
  const now = Date.now();
  const baseVoltage = 230.0;
  const voltFluctuation = Math.sin(now / 15000) * 1.2 + (Math.random() * 0.4 - 0.2);
  const voltage = parseFloat((baseVoltage + voltFluctuation).toFixed(1));

  // Household appliances
  const DEMO_APPLIANCES = [
    { name: "LED Lights", power: 45, pf: 0.95 },
    { name: "Refrigerator", power: 150, pf: 0.82 },
    { name: "Air Conditioner", power: 1800, pf: 0.78 },
    { name: "Water Heater", power: 2500, pf: 1.0 },
    { name: "Laptop & Router", power: 120, pf: 0.90 }
  ];

  let activeW = DEMO_APPLIANCES[0].power + DEMO_APPLIANCES[4].power; // 165W base
  let totalPF = (DEMO_APPLIANCES[0].power * DEMO_APPLIANCES[0].pf) + (DEMO_APPLIANCES[4].power * DEMO_APPLIANCES[4].pf);

  const fridgeCycle = Math.floor(now / 1000) % 60;
  if (fridgeCycle < 30) {
    activeW += DEMO_APPLIANCES[1].power;
    totalPF += (DEMO_APPLIANCES[1].power * DEMO_APPLIANCES[1].pf);
  }

  const computedPf = parseFloat((totalPF / activeW).toFixed(2));
  const powerFactor = Math.max(0.8, Math.min(0.99, computedPf + (Math.random() * 0.01 - 0.005)));

  activeW += (Math.random() * 6 - 3);
  const power = parseFloat(Math.max(50.0, activeW).toFixed(1));

  const denominator = voltage * powerFactor;
  const calcCurrent = denominator > 0 ? (power / denominator) : 0;
  const current = parseFloat(Math.max(0.05, calcCurrent).toFixed(2));

  if (current > serverPeakCurrent) {
    serverPeakCurrent = current;
  }

  const elapsedSeconds = (now - lastServerSimTime) / 1000;
  lastServerSimTime = now;
  const increment = (power / 1000.0) * (elapsedSeconds / 3600.0);
  serverSimEnergy = parseFloat((serverSimEnergy + increment).toFixed(5));

  const freqFluctuation = Math.sin(now / 20000) * 0.03 + (Math.random() * 0.01 - 0.005);
  const frequency = parseFloat((50.00 + freqFluctuation).toFixed(2));

  return {
    voltage,
    current,
    power,
    energy: serverSimEnergy,
    frequency,
    powerFactor,
    peakCurrent: serverPeakCurrent
  };
}

function parseThingerValue(data: any, metricKey: string): number | null {
  let payload = data;
  if (data && data.out !== undefined) payload = data.out;
  else if (data && data.in !== undefined) payload = data.in;
  
  let val: number | null = null;
  if (typeof payload === 'object' && payload !== null) {
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
  return (val !== null && !isNaN(val)) ? val : null;
}

function cleanNumber(val: any, defaultVal: number): number {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? defaultVal : parsed;
}

function parseThingerPayload(payload: any) {
  if (!payload) return null;
  if (typeof payload !== "object") return null;

  const findValue = (keys: string[]) => {
    // 1. Try exact match first (case-insensitive)
    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();
      if (keys.some((k) => lowerKey === k)) {
        return payload[key];
      }
    }
    // 2. Try partial match only for keys that are not single-character abbreviations
    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();
      if (keys.some((k) => k.length >= 3 && lowerKey.includes(k))) {
        return payload[key];
      }
    }
    // 3. Try exact match for single-character abbreviations
    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();
      if (keys.some((k) => k.length === 1 && lowerKey === k)) {
        return payload[key];
      }
    }
    return undefined;
  };

  const voltage = findValue(["voltage", "volt", "v"]);
  const current = findValue(["current", "amp", "curr", "i", "a"]);
  const power = findValue(["power", "watt", "w", "p"]);
  const energy = findValue(["energy", "kwh", "e"]);
  const frequency = findValue(["frequency", "freq", "f", "hz"]);
  const powerFactor = findValue(["powerfactor", "power_factor", "pf"]);
  const status = findValue(["status", "state", "grid_status"]);

  return { voltage, current, power, energy, frequency, powerFactor, status };
}

// Secure proxy endpoint for fetching live telemetry from Thinger.io
app.get("/api/live", async (req, res) => {
  // Get credentials from headers, query params, or environment variables
  const username = (req.headers["x-thinger-username"] as string) || (req.query.username as string) || process.env.THINGER_USERNAME || "";
  const deviceId = (req.headers["x-thinger-device-id"] as string) || (req.query.deviceId as string) || process.env.THINGER_DEVICE_ID || "";
  const token = (req.headers["x-thinger-token"] as string) || (req.query.token as string) || process.env.THINGER_ACCESS_TOKEN || "";
  const resource = (req.headers["x-thinger-resource"] as string) || (req.query.resource as string) || process.env.THINGER_RESOURCE_NAME || "metrics";
  const useSeparate = (req.headers["x-use-separate-metrics"] === "true") || (req.query.useSeparate === "true");
  const isDemo = (req.headers["x-thinger-demo-mode"] === "true") || (req.query.isDemo === "true") || (!username || !deviceId);

  if (isDemo) {
    const sim = getSimulatedData();
    let status = "Active";
    if (sim.voltage < 80) {
      status = "Power Failure";
    } else if (sim.power < 20) {
      status = "Standby";
    }
    
    return res.json({
      voltage: sim.voltage,
      current: sim.current,
      power: sim.power,
      energy: sim.energy,
      frequency: sim.frequency,
      powerFactor: sim.powerFactor,
      peakCurrent: sim.peakCurrent,
      status,
      lastUpdated: new Date().toISOString(),
      isSimulated: true
    });
  }

  try {
    let voltage = 0;
    let current = 0;
    let power = 0;
    let energy = 0;
    let frequency = 50.0;
    let powerFactor = 0.0;
    let parsed: any = null;

    if (useSeparate) {
      const metrics = ["voltage", "current", "power", "energy"];
      const promises = metrics.map(async (metric) => {
        const metricResource = (req.headers[`x-thinger-resource-${metric}`] as string) || (req.query[`resource_${metric}`] as string) || metric;
        const metricToken = (req.headers[`x-thinger-token-${metric}`] as string) || (req.query[`token_${metric}`] as string) || token;
        
        const mUrl = `https://api.thinger.io/v2/users/${username}/devices/${deviceId}/${metricResource}?authorization=${encodeURIComponent(metricToken)}`;
        const mRes = await fetch(mUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${metricToken}`
          }
        });
        if (!mRes.ok) throw new Error(`Separate fetch failed for ${metric}: ${mRes.status}`);
        const data = await mRes.json();
        return { key: metric, value: parseThingerValue(data, metric) };
      });

      const results = await Promise.all(promises);
      results.forEach((res) => {
        if (res.value !== null) {
          if (res.key === "voltage") voltage = res.value;
          else if (res.key === "current") current = res.value;
          else if (res.key === "power") power = res.value;
          else if (res.key === "energy") energy = res.value;
        }
      });
    } else {
      const url = `https://api.thinger.io/v2/users/${username}/devices/${deviceId}/${resource}?authorization=${encodeURIComponent(token)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error(`Thinger.io API returned HTTP ${response.status}`);
      }
      const data = await response.json();
      let payload = data;
      if (data && data.out !== undefined) payload = data.out;
      else if (data && data.in !== undefined) payload = data.in;

      parsed = parseThingerPayload(payload);
      voltage = cleanNumber(parsed?.voltage, 0);
      current = cleanNumber(parsed?.current, 0);
      power = cleanNumber(parsed?.power, 0);
      energy = cleanNumber(parsed?.energy, 0);
      frequency = cleanNumber(parsed?.frequency, 50.0);
      powerFactor = cleanNumber(parsed?.powerFactor, 0.0);
    }

    frequency = frequency || 50.0;
    
    // Calculate Power Factor: Power / (Voltage * Current)
    const apparentPower = voltage * current;
    if (power > 0 && apparentPower > 0.1) {
      powerFactor = Math.min(1.0, Math.max(0.0, power / apparentPower));
    } else {
      powerFactor = powerFactor || 0.0;
    }

    let status = "Active";
    const devStatus = parsed?.status ? String(parsed.status).toUpperCase() : "";
    if (devStatus === "POWER_FAILURE" || voltage < 80) {
      status = "Power Failure";
    } else if (devStatus === "STANDBY" || power < 20) {
      status = "Standby";
    } else if (devStatus === "ACTIVE") {
      status = "Active";
    } else {
      if (voltage < 80) {
        status = "Power Failure";
      } else if (power < 20) {
        status = "Standby";
      }
    }

    res.json({
      voltage,
      current,
      power,
      energy,
      frequency,
      powerFactor,
      status,
      lastUpdated: new Date().toISOString(),
      isSimulated: false
    });
  } catch (err: any) {
    console.error("Thinger.io fetch error:", err);
    
    // Fall back to simulation if real fetch fails
    const sim = getSimulatedData();
    let status = "Active";
    if (sim.voltage < 80) {
      status = "Power Failure";
    } else if (sim.power < 20) {
      status = "Standby";
    }
    
    res.json({
      voltage: sim.voltage,
      current: sim.current,
      power: sim.power,
      energy: sim.energy,
      frequency: sim.frequency,
      powerFactor: sim.powerFactor,
      peakCurrent: sim.peakCurrent,
      status,
      lastUpdated: new Date().toISOString(),
      isSimulated: true,
      fallbackActive: true,
      error: err.message
    });
  }
});

// Email Service API Status Check
app.get("/api/email-status", (_req, res) => {
  const isSmtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  res.json({
    status: "ok",
    smtpConfigured: isSmtpConfigured,
    smtpHost: process.env.SMTP_HOST || "Not configured (Using simulation fallback)",
    smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : "Not set",
    recentLogs: emailLogs.slice(-10).reverse()
  });
});

// Send Email API Endpoint
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, message, html, reportData } = req.body || {};

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return res.status(400).json({ error: "A valid recipient email address ('to') is required." });
    }

    const emailSubject = subject || "GridPulse Smart Energy Report & Alert";
    const emailText = message || "Attached is your automated GridPulse energy usage report.";
    const emailHtml = html || `
      <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #38bdf8; margin-top: 0;">⚡ GridPulse Energy Report</h2>
        <p style="font-size: 15px; color: #cbd5e1; line-height: 1.5;">${emailText}</p>
        ${
          reportData
            ? `<div style="background: #1e293b; padding: 16px; border-radius: 8px; margin-top: 16px; border: 1px solid #334155;">
                <h4 style="margin: 0 0 8px 0; color: #34d399;">Energy Plan Summary</h4>
                <p style="font-size: 14px; color: #94a3b8; margin: 0 0 8px 0;">Budget: ₹${reportData.total_budget || 'N/A'} | Daily Projected: ₹${reportData.total_projected_cost || 'N/A'}</p>
                <p style="font-size: 13px; color: #cbd5e1; margin: 0;">${reportData.summary || ''}</p>
              </div>`
            : ""
        }
        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; margin: 0;">Sent automatically by GridPulse Smart Energy Dashboard.</p>
      </div>
    `;

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || `"GridPulse Energy" <${smtpUser || "noreply@gridpulse.app"}>`;

    // Check if SMTP credentials exist
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to: to.trim(),
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });

      const logEntry = {
        id: info.messageId || String(Date.now()),
        to: to.trim(),
        subject: emailSubject,
        sentAt: new Date().toISOString(),
        status: "DELIVERED",
        mode: "SMTP"
      };
      emailLogs.push(logEntry);

      return res.json({
        success: true,
        message: `Email successfully sent to ${to.trim()} via SMTP.`,
        mode: "SMTP",
        messageId: info.messageId,
        recipient: to.trim()
      });
    } else {
      // Simulation / Fallback Mode (Runs smoothly without crashing even if user hasn't set credentials yet)
      const logEntry = {
        id: `sim_${Date.now()}`,
        to: to.trim(),
        subject: emailSubject,
        sentAt: new Date().toISOString(),
        status: "SIMULATED_SUCCESS",
        mode: "SIMULATION"
      };
      emailLogs.push(logEntry);

      return res.json({
        success: true,
        message: `Email dispatched to ${to.trim()} (Simulation Mode). To enable live delivery to inbox, configure SMTP_USER & SMTP_PASS in your Google AI Studio Settings / Secrets panel.`,
        mode: "SIMULATION",
        smtpConfigured: false,
        recipient: to.trim(),
        emailPreview: {
          to: to.trim(),
          subject: emailSubject,
          message: emailText,
          sentAt: logEntry.sentAt
        }
      });
    }
  } catch (err: any) {
    console.error("Error sending email:", err);
    return res.status(500).json({
      error: err.message || "Failed to send email. Check SMTP credentials or configuration."
    });
  }
});

// Vite server setup
// Vite server setup
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await eval('import("vite")');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`- Local:   http://localhost:${PORT}`);
    console.log(`- Network: http://127.0.0.1:${PORT}`);
  });
}

// Only start the server when running outside of Vercel serverless environment
if (!process.env.VERCEL) {
  startServer();
}

export default app;
