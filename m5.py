from __future__ import annotations

import json
from typing import Any, Dict, List, Sequence, Tuple

from flask import Flask, jsonify, render_template_string, request


def _normalize_appliance(appliance: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": str(appliance.get("name", "Unknown")),
        "watts": float(appliance.get("watts", appliance.get("power", 0.0)) or 0.0),
        "priority": int(appliance.get("priority", 1) or 1),
    }


def calculate_energy_plan(
    monthly_budget: float,
    appliances: Sequence[Dict[str, Any]],
    refine_level: int = 0,
) -> Dict[str, Any]:
    """Deterministic budget fitter.

    Uses REQUIRED formula:
      Energy(kWh) = (Power in Watts / 1000) * Hours
      Cost = Energy(kWh) * 8 (INR)

    monthly_budget is converted to daily assuming 30 days/month.
    """

    total_budget = float(monthly_budget)
    if total_budget <= 0:
        raise ValueError("monthly budget must be > 0")

    daily_budget = total_budget / 30.0

    norm_apps = [_normalize_appliance(a) for a in appliances if str(a.get("name", "")).strip()]
    if not norm_apps:
        raise ValueError("At least one appliance is required")

    # Basic prioritization: higher priority gets more hours.
    norm_apps.sort(key=lambda x: x["priority"], reverse=True)

    # Refine is more aggressive: cap total spend by an extra factor.
    refine_factor = 1.0
    if refine_level >= 1:
        refine_factor = 0.85  # reduce allowed daily cost by 15%
    if refine_level >= 2:
        refine_factor = 0.80  # reduce allowed daily cost by 30%

    allowed_daily_cost = daily_budget * refine_factor

    # Allocate hours proportionally to priority weights while respecting budget.
    # Start with a small minimum and then distribute.
    weights = [max(a["priority"], 1) for a in norm_apps]
    weight_sum = float(sum(weights))

    # Start with an initial guess: each appliance gets at most 24 hours/day.
    # Then shrink to fit (we still enforce total <= 24 later).
    proposed_hours: List[float] = []
    max_hours = 24.0

    # Convert cost-per-hour for each appliance.
    cost_per_hour = [(_a["watts"] / 1000.0) * 8.0 for _a in norm_apps]  # INR per hour

    # Initial hours: proportional to priority.
    for w in weights:
        proposed_hours.append(max_hours * (w / weight_sum))

    # Budget fitting: scale down all hours if budget exceeded.
    total_cost_per_day = sum(h * cph for h, cph in zip(proposed_hours, cost_per_hour))
    scale = 1.0
    if total_cost_per_day > 0 and total_cost_per_day > allowed_daily_cost:
        scale = allowed_daily_cost / total_cost_per_day

    adjusted_hours = [max(0.0, h * scale) for h in proposed_hours]

    # Enforce: total suggested runtime should not exceed 24 hours/day.
    current_total_hours = sum(adjusted_hours)
    if current_total_hours > 24.0 and current_total_hours > 0:
        hours_scale = 24.0 / current_total_hours
        adjusted_hours = [h * hours_scale for h in adjusted_hours]


    # Optional: if still over (due to rounding later), reduce low-priority appliances.
    # We'll do a final greedy clamp.
    def cost_from_hours(hours: Sequence[float]) -> float:
        return sum(h * cph for h, cph in zip(hours, cost_per_hour))

    adjusted_hours_int = [round(h, 2) for h in adjusted_hours]
    current_cost = cost_from_hours(adjusted_hours_int)

    # Greedily reduce from lowest priority until within allowed.
    # Determine order: lowest priority first.
    reduce_order = list(range(len(norm_apps) - 1, -1, -1))
    idx = 0
    while current_cost > allowed_daily_cost + 1e-6 and idx < len(reduce_order):
        j = reduce_order[idx]
        # Reduce this appliance by 0.5 hours steps.
        step = 0.5
        while adjusted_hours_int[j] > 0 and current_cost > allowed_daily_cost + 1e-6:
            adjusted_hours_int[j] = round(max(0.0, adjusted_hours_int[j] - step), 2)
            current_cost = cost_from_hours(adjusted_hours_int)
        idx += 1

    # Compute final per-appliance cost.
    appliances_out: List[Dict[str, Any]] = []
    total_projected_cost = round(current_cost, 2)

    # Ensure every appliance runs every day (non-zero hours) based on priority.
    # Trigger the floor when any appliance is effectively zero/sleeping.
    if any(h < 0.01 for h in adjusted_hours_int):

        min_hours_share = 0.25  # hours/day minimum if budget allows
        min_weights = [max(a["priority"], 1) for a in norm_apps]
        mw_sum = float(sum(min_weights)) if min_weights else 1.0

        hours_target = daily_budget * 0.9

        # Proposed minimum allocation (sum may exceed target)
        min_alloc = [min_hours_share * (w / mw_sum) * len(min_weights) for w in min_weights]
        if sum(min_alloc) > 0 and sum(min_alloc) > hours_target:
            scale_min = hours_target / sum(min_alloc)
            min_alloc = [h * scale_min for h in min_alloc]

        # Merge: keep original allocation if larger than minimum
        merged = [max(float(orig), float(mi)) for orig, mi in zip(adjusted_hours_int, min_alloc)]

        # Re-scale merged to exactly match hours_target
        total_merged = sum(merged)
        if total_merged > 0:
            merged = [h * (hours_target / total_merged) for h in merged]

        adjusted_hours_int = [round(h, 2) for h in merged]

    for a, hours in zip(norm_apps, adjusted_hours_int):
        energy_kwh = (a["watts"] / 1000.0) * float(hours)
        estimated_cost_per_day = round(energy_kwh * 8.0, 2)
        appliances_out.append(
            {
                "name": a["name"],
                "watts": a["watts"],
                "suggested_daily_hours": float(hours),
                "estimated_cost_per_day": estimated_cost_per_day,
            }
        )


    # Summary + actionable trade-offs.
    savings_needed = max(0.0, total_projected_cost - allowed_daily_cost)
    summary_parts = [
        "Allocated daily runtime hours within your budget using priority-based scaling.",
        f"Monthly budget converted to daily: {daily_budget:.2f} INR/day (30-day assumption).",
    ]
    if refine_level == 0:
        summary_parts.append("Refine mode: off (standard plan).")
    else:
        summary_parts.append(f"Refine mode: on (aggressive cap factor {refine_factor:.2f}).")

    if savings_needed > 0:
        summary_parts.append(
            "To meet budget, lower-priority appliances were reduced first (greedy clamp) to bring total cost down."
        )
    else:
        summary_parts.append("Plan is within budget based on the required energy/cost formula.")

    return {
        "summary": " ".join(summary_parts),
        "total_budget": round(total_budget, 2),
        "total_projected_cost": round(total_projected_cost, 2),
        "appliances": appliances_out,
    }


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health() -> Any:
        return jsonify({"status": "ok"})

    def _parse_request_json() -> Tuple[float, List[Dict[str, Any]], int]:
        payload = request.get_json(silent=True) or {}
        monthly_budget = float(payload.get("budget") or payload.get("total_budget") or payload.get("monthly_budget") or 0)
        appliances = payload.get("appliances") or []
        refine_level = int(payload.get("refine_level") or 0)
        return monthly_budget, appliances, refine_level

    @app.post("/api/calculate")
    def api_calculate() -> Any:
        monthly_budget, appliances, _ = _parse_request_json()
        result = calculate_energy_plan(monthly_budget=monthly_budget, appliances=appliances, refine_level=0)
        return jsonify(result)

    @app.post("/api/refine")
    def api_refine() -> Any:
        monthly_budget, appliances, _ = _parse_request_json()
        result = calculate_energy_plan(monthly_budget=monthly_budget, appliances=appliances, refine_level=1)
        return jsonify(result)

    @app.get("/")
    def ui() -> Any:
        # Simple HTML UI matching required behavior.
        default_appliances = [
            {"name": "Fan", "watts": 75, "priority": 8},
            {"name": "TV", "watts": 120, "priority": 5},
            {"name": "AC", "watts": 1500, "priority": 10},
        ]
        html = """
<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'/>
  <meta name='viewport' content='width=device-width, initial-scale=1'/>
  <title>Energy Usage Calculator</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f4f7fb; color:#111827; }
    .container { max-width: 1050px; margin: 24px auto; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    h1 { margin-top: 0; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    input, button { width:100%; box-sizing:border-box; padding:8px; border-radius: 10px; border:1px solid #cbd5e1; }
    button { cursor:pointer; background:#2563eb; color:#fff; border:none; }
    button.secondary { background:#64748b; }
    .row { display:grid; grid-template-columns: 1fr 0.6fr 0.6fr; gap: 8px; margin-bottom: 8px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding:8px; text-align:left; font-size: 14px; }
    th { background:#f9fafb; }
    .muted { color:#6b7280; font-size: 13px; }
    @media(max-width:900px){ .grid{ grid-template-columns:1fr; } .row{ grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class='container'>
    <h1>Energy Usage Calculator (Budget → Daily Runtime Plan)</h1>
    <div class='muted'>Cost formula used: Energy(kWh)=(W/1000)*Hours; Cost=Energy*8 INR.</div>

    <div class='grid'>
      <div class='card'>
        <h2>Inputs</h2>
        <div class='row' style='grid-template-columns:1fr;'>
          <label>Monthly Budget (₹)</label>
          <input id='budget' type='number' min='1' value='1200'/>
        </div>

        <div id='applianceRows'></div>

        <button class='secondary' style='margin-top:10px' type='button' onclick='addRow()'>Add Appliance</button>
        <div style='display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;'>
          <button style='flex:1; min-width: 220px;' type='button' onclick='calculatePlan()'>Calculate</button>
          <button class='secondary' style='flex:1; min-width: 220px;' type='button' onclick='refinePlan()'>Refine</button>
        </div>
      </div>

      <div class='card'>
        <h2>Result (JSON Table)</h2>
        <div class='muted' id='summary'></div>
        <div style='margin-top:12px;' class='muted'>Total Budget: <span id='totalBudget'></span> INR</div>
        <div class='muted'>Total Projected Cost (per day): <span id='totalProjectedCost'></span> INR</div>

        <div style='margin-top:12px;'>
          <table>
            <thead>
              <tr>
                <th>Appliance</th>
                <th>Watts</th>
                <th>Suggested Daily Hours</th>
                <th>Estimated Cost / Day (₹)</th>
              </tr>
            </thead>
            <tbody id='applianceTableBody'></tbody>
          </table>
        </div>

        <pre id='rawJson' style='background:#0b1220; color:#e5e7eb; padding:12px; border-radius: 12px; margin-top: 12px; overflow:auto; max-height: 280px;'></pre>
      </div>
    </div>
  </div>

  <script>
    const initial = {{ default_appliances|tojson }};
    const state = { lastPayload: null };

    function renderRows(appliances){
      const container = document.getElementById('applianceRows');
      container.innerHTML = '';
      appliances.forEach((a, idx) => {
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = `
          <input type='text' value='${a.name}' data-field='name' placeholder='Name' />
          <input type='number' value='${a.watts}' data-field='watts' placeholder='Watts' min='0' />
          <input type='number' value='${a.priority}' data-field='priority' placeholder='Priority' min='1' />
        `;
        container.appendChild(div);
      });
    }

    function addRow(){
      renderRows(getAppliances().concat([{name:'', watts:0, priority:1}]));
    }

    function getAppliances(){
      const rows = [...document.getElementById('applianceRows').children];
      return rows.map(r => {
        const name = r.querySelector("input[data-field='name']").value;
        const watts = parseFloat(r.querySelector("input[data-field='watts']").value || '0');
        const priority = parseInt(r.querySelector("input[data-field='priority']").value || '1');
        return { name, watts, priority };
      }).filter(a => a.name.trim().length > 0);
    }

    function setResult(result){
      document.getElementById('summary').textContent = result.summary;
      document.getElementById('totalBudget').textContent = result.total_budget;
      document.getElementById('totalProjectedCost').textContent = result.total_projected_cost;

      const body = document.getElementById('applianceTableBody');
      body.innerHTML = '';
      result.appliances.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${a.name}</td>
          <td>${a.watts}</td>
          <td>${a.suggested_daily_hours}</td>
          <td>${a.estimated_cost_per_day}</td>
        `;
        body.appendChild(tr);
      });
      document.getElementById('rawJson').textContent = JSON.stringify(result, null, 2);
    }

    async function calculatePlan(){
      const payload = {
        budget: parseFloat(document.getElementById('budget').value || '0'),
        appliances: getAppliances(),
        refine_level: 0
      };
      state.lastPayload = payload;
      const res = await fetch('/api/calculate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await res.json();
      setResult(data);
    }

    async function refinePlan(){
      const payload = state.lastPayload || {
        budget: parseFloat(document.getElementById('budget').value || '0'),
        appliances: getAppliances(),
        refine_level: 0
      };
      const res = await fetch('/api/refine', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await res.json();
      setResult(data);
    }

    renderRows(initial);
  </script>
</body>
</html>
"""
        return render_template_string(html, default_appliances=default_appliances)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)

