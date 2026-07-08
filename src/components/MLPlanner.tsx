import React, { useState, useEffect } from 'react';
import { type Appliance } from '../types';
import { Brain, Sliders, Cpu, Plus, Trash2, Calculator, Zap, PieChart } from 'lucide-react';

interface MLPlannerProps {
  onShowToast: (title: string, message: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
  tariffRate: number;
}

export const MLPlanner: React.FC<MLPlannerProps> = ({ onShowToast, tariffRate }) => {
  const [budget, setBudget] = useState<number>(1200);
  const [appliances, setAppliances] = useState<Appliance[]>([
    { id: '1', name: 'Fan', watts: 75, priority: 8 },
    { id: '2', name: 'TV', watts: 120, priority: 5 },
    { id: '3', name: 'AC', watts: 1500, priority: 10 },
  ]);

  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [refineLevel, setRefineLevel] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Auto-run initial calculation on render
  useEffect(() => {
    handleCalculate(0);
  }, []);

  const handleAddAppliance = () => {
    const newApp: Appliance = {
      id: Date.now().toString(),
      name: '',
      watts: 100,
      priority: 1,
    };
    setAppliances([...appliances, newApp]);
  };

  const handleRemoveAppliance = (id: string) => {
    const filtered = appliances.filter((app) => app.id !== id);
    if (filtered.length === 0) {
      setAppliances([{ id: Date.now().toString(), name: '', watts: 0, priority: 1 }]);
    } else {
      setAppliances(filtered);
    }
  };

  const handleApplianceChange = (id: string, field: keyof Appliance, value: any) => {
    setAppliances(
      appliances.map((app) => {
        if (app.id === id) {
          return { ...app, [field]: value };
        }
        return app;
      })
    );
  };

  // Safe client-side fallback calculation
  const calculateEnergyPlanClient = (monthlyBudget: number, apps: Appliance[], refLevel: number) => {
    const totalBudget = parseFloat(monthlyBudget.toString()) || 0;
    const dailyBudget = totalBudget / 30.0;

    const normApps = apps
      .map((a) => ({
        name: String(a.name || 'Unknown'),
        watts: parseFloat(a.watts.toString()) || 0,
        priority: parseInt(a.priority.toString(), 10) || 1,
      }))
      .filter((a) => a.name.trim().length > 0);

    normApps.sort((a, b) => b.priority - a.priority);

    const allowedDailyCost = dailyBudget;
    const weights = normApps.map((a) => Math.max(a.priority, 1));
    const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

    const maxHours = 1000.0;
    const proposedHours = weights.map((w) => maxHours * (w / weightSum));

    // Calculate cost based on current tariff rate
    const costPerHour = normApps.map((a) => (a.watts / 1000.0) * tariffRate);
    const totalCostPerDay = proposedHours.reduce((s, h, i) => s + h * costPerHour[i], 0);

    let scale = 1.0;
    if (totalCostPerDay > 0 && totalCostPerDay > allowedDailyCost) {
      scale = allowedDailyCost / totalCostPerDay;
    }

    const adjustedHours = proposedHours.map((h) => Math.max(0.0, h * scale));
    const costFromHours = (hrs: number[]) => hrs.reduce((s, h, i) => s + h * costPerHour[i], 0);

    let adjustedHoursInt = adjustedHours.map((h) => parseFloat(h.toFixed(2)));
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
      const estimatedCostPerDay = parseFloat((energyKwh * tariffRate).toFixed(2));
      return {
        name: a.name,
        watts: a.watts,
        suggested_daily_hours: displayHours,
        estimated_cost_per_day: estimatedCostPerDay,
      };
    });

    const totalProjectedCost = parseFloat(currentCost.toFixed(2));
    const savingsNeeded = Math.max(0.0, totalProjectedCost - allowedDailyCost);

    const summaryParts = [
      'Allocated daily runtime hours within your budget using priority-based scaling.',
      `Monthly budget converted to daily: ${dailyBudget.toFixed(2)} INR/day (30-day assumption).`,
    ];

    if (refLevel === 0) {
      summaryParts.push('Refine mode: off (standard plan).');
    } else {
      summaryParts.push('Refine mode: on (aggressive cap factor 1.00).');
    }

    if (savingsNeeded > 0) {
      summaryParts.push('To meet budget, lower-priority appliances were reduced first to bring total cost down.');
    } else {
      summaryParts.push('Plan is within budget based on the required energy/cost formula.');
    }

    return {
      summary: summaryParts.join(' '),
      total_budget: totalBudget,
      total_projected_cost: totalProjectedCost,
      appliances: appliancesOut,
    };
  };

  const handleCalculate = async (refLevel: number) => {
    const validApps = appliances.filter((a) => a.name.trim().length > 0);
    if (budget <= 0) {
      onShowToast('Invalid Budget', 'Please enter a monthly budget greater than ₹0.', 'warning');
      return;
    }
    if (validApps.length === 0) {
      onShowToast('No Appliances', 'Please add at least one appliance name and power rating.', 'warning');
      return;
    }

    setIsLoading(true);
    setRefineLevel(refLevel);

    const endpoint = refLevel === 1 ? '/api/refine' : '/api/calculate';
    const payload = {
      budget,
      appliances: validApps,
      refine_level: refLevel,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const data = await response.json();
      setCalculationResult(data);
      onShowToast(
        refLevel === 1 ? 'Plan Refined' : 'Plan Calculated',
        'Energy budget runtime optimization complete.',
        'success'
      );
    } catch (err) {
      console.warn('API connection failed. Running local optimization model fallback:', err);
      const fallbackData = calculateEnergyPlanClient(budget, validApps, refLevel);
      setCalculationResult(fallbackData);
      onShowToast('Plan Calculated', 'Calculated energy budget plan locally (Demo Fallback).', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  const dailyBudgetVal = (budget / 30).toFixed(2);
  const dailyProjectedVal = calculationResult?.total_projected_cost?.toFixed(2) || '0.00';
  const monthlyProjectedVal = (calculationResult?.total_projected_cost * 30 || 0).toFixed(2);

  return (
    <section className="card ml-planner-card" id="card-ml-energy-planner" style={{ gridColumn: 'span 12', marginTop: '0.5rem' }}>
      <div className="ml-planner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', marginBottom: '0.25rem', margin: 0 }}>
            <Brain style={{ color: 'var(--primary)', width: '20px', height: '20px' }} /> ML Energy Budget & Runtime Planner
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Deterministic budget fitting algorithm (Formula: Energy = (W/1000) × Hours; Cost = kWh × {tariffRate} ₹)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu style={{ width: '12px', height: '12px' }} /> API Active (/api/calculate)
          </span>
        </div>
      </div>

      <div className="ml-planner-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Panel: Budget & Appliance Inputs */}
        <div className="ml-planner-inputs" style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Sliders style={{ width: '16px', height: '16px', color: 'var(--primary)' }} /> Monthly Budget & Appliances
          </h3>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>Monthly Budget (₹ INR)</label>
            <div className="input-icon-wrapper" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>₹</span>
              <input
                type="number"
                className="form-control"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                min="1"
                step="10"
                style={{ paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }}
                placeholder="e.g., 1200"
                required
              />
            </div>
            <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
              Daily Budget cap: <strong style={{ color: 'var(--text-primary)' }}>₹{dailyBudgetVal} / day</strong> (30-day assumption)
            </small>
          </div>

          <div className="appliances-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connected Appliances</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Priority (1=Low, 10=High)</span>
          </div>

          <div id="ml-appliance-rows-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '1rem' }}>
            {appliances.map((app) => (
              <div key={app.id} className="ml-appliance-row" style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 32px', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-control"
                  value={app.name}
                  onChange={(e) => handleApplianceChange(app.id, 'name', e.target.value)}
                  placeholder="Appliance (e.g. Fridge)"
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                />
                <input
                  type="number"
                  className="form-control"
                  value={app.watts}
                  onChange={(e) => handleApplianceChange(app.id, 'watts', parseFloat(e.target.value) || 0)}
                  placeholder="Watts"
                  min="0"
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                />
                <input
                  type="number"
                  className="form-control"
                  value={app.priority}
                  onChange={(e) => handleApplianceChange(app.id, 'priority', parseInt(e.target.value, 10) || 1)}
                  placeholder="Prio"
                  min="1"
                  max="10"
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAppliance(app.id)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '4px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', transition: 'var(--transition)' }}
                  title="Delete Appliance"
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={handleAddAppliance} style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem', padding: '0.5rem 0.75rem', cursor: 'pointer' }}>
              <Plus style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Add Appliance
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleCalculate(0)} style={{ flex: 1.2, minWidth: '150px', fontSize: '0.85rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--primary)', color: '#09090b', cursor: 'pointer' }}>
              <Calculator style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Calculate Plan
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => handleCalculate(1)} style={{ flex: 1, minWidth: '120px', fontSize: '0.85rem', padding: '0.5rem 0.75rem', cursor: 'pointer' }}>
              <Zap style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Refine
            </button>
          </div>
        </div>

        {/* Right Panel: Energy Plan Execution Results */}
        <div className="ml-planner-results" style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart style={{ width: '16px', height: '16px', color: 'var(--success)' }} /> Daily Runtime Allocation
              </span>
              <span className="badge" style={{ fontSize: '0.72rem', background: 'var(--bg-accent)', padding: '0.2rem 0.6rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                {refineLevel === 1 ? 'Refined Plan' : 'Standard Plan'}
              </span>
            </h3>

            {/* Summary Box */}
            <div id="ml-summary-box" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 0.85rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '1rem' }}>
              {calculationResult?.summary || 'Click Calculate Plan to optimize runtime allocations across appliances.'}
            </div>

            {/* KPI Row */}
            <div className="ml-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Daily Budget</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '0.1rem' }}>₹{dailyBudgetVal}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Daily Projected</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', marginTop: '0.1rem' }}>₹{dailyProjectedVal}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Projected</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--warning)', marginTop: '0.1rem' }}>₹{monthlyProjectedVal}</div>
              </div>
            </div>

            {/* Allocation Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="wiring-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-accent)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Appliance</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Power (W)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Suggested Daily Hrs</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Est. Cost / Day (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {!calculationResult?.appliances || calculationResult.appliances.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0.5rem' }}>
                        No calculation run yet. Click Calculate Plan.
                      </td>
                    </tr>
                  ) : (
                    calculationResult.appliances.map((app: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>{app.name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }} className="mono">{app.watts} W</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }} className="mono">
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                            {app.suggested_daily_hours} hrs/day
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }} className="mono">₹{app.estimated_cost_per_day?.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collapsible raw JSON */}
          <details style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
            <summary style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              View API JSON Payload Output
            </summary>
            <pre className="mono" style={{ background: '#09090b', color: '#34d399', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify({ budget, refineLevel, result: calculationResult }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
};
export default MLPlanner;
