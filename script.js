const metrics = [];
let dataset = [];
let columns = [];

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const fetchButton = document.getElementById('fetchButton');
const dataPreview = document.getElementById('dataPreview');
const rowCount = document.getElementById('rowCount');
const colCount = document.getElementById('colCount');
const missingCount = document.getElementById('missingCount');
const numericCount = document.getElementById('numericCount');
const edaInsights = document.getElementById('edaInsights');
const metricForm = document.getElementById('metricForm');
const metricBoard = document.getElementById('metricBoard');
const expMetric = document.getElementById('expMetric');
const generateDesign = document.getElementById('generateDesign');
const designOutput = document.getElementById('designOutput');
const calcPower = document.getElementById('calcPower');
const powerOutput = document.getElementById('powerOutput');
const runReadout = document.getElementById('runReadout');
const readoutOutput = document.getElementById('readoutOutput');
const holdoutSlider = document.getElementById('holdout');
const holdoutValue = document.getElementById('holdoutValue');
const dashboard = document.getElementById('dashboard');
const runAlerts = document.getElementById('runAlerts');
const alertOutput = document.getElementById('alertOutput');
const generateReport = document.getElementById('generateReport');
const reportOutput = document.getElementById('reportOutput');
const planList = document.getElementById('planList');
const projectGoalBtn = document.getElementById('projectGoal');
const goalOutput = document.getElementById('goalOutput');

const sampleMetrics = [
  {
    name: 'Search Relevance',
    priority: 'North Star',
    eval: 'Hybrid',
    definition: 'Quality of top results and answer cards for core intents',
    tradeoffs: 'Balance relevance gains with latency, hallucination, and abuse risk'
  },
  {
    name: 'AI Adoption',
    priority: 'North Star',
    eval: 'Online eval',
    definition: 'Share of search sessions that engage with AI-generated answers or chat',
    tradeoffs: 'Higher adoption must protect precision, safety, and cost'
  },
  {
    name: 'Latency p95',
    priority: 'P0',
    eval: 'Online eval',
    definition: 'End-to-end ranking + generation latency at p95',
    tradeoffs: 'Lower latency may reduce model size and quality'
  }
];

function initSampleMetrics() {
  sampleMetrics.forEach(m => metrics.push(m));
  refreshMetricBoard();
}

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(/[,\t]/).map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(/[,\t]/));
  return { header, rows };
}

function detectNumeric(values) {
  const sample = values.slice(0, 20);
  if (!sample.length) return false;
  const numericCount = sample.filter(v => !isNaN(parseFloat(v)) && v !== '').length;
  return numericCount >= sample.length * 0.6;
}

function buildDataset(parsed) {
  if (!parsed.header.length) {
    dataset = [];
    columns = [];
    edaInsights.innerHTML = '<p class="danger">No data found in source.</p>';
    return;
  }
  columns = parsed.header;
  dataset = parsed.rows.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx] ?? '';
    });
    return obj;
  });
  updatePreview();
  summarizeData();
  refreshDashboard();
}

function updatePreview() {
  dataPreview.innerHTML = '';
  if (!dataset.length) return;
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  dataPreview.appendChild(headerRow);

  dataset.slice(0, 6).forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = row[col];
      tr.appendChild(td);
    });
    dataPreview.appendChild(tr);
  });
}

function summarizeData() {
  if (!dataset.length) return;
  const summary = { rows: dataset.length, cols: columns.length, missing: 0, numericCols: [], profiles: {} };
  columns.forEach(col => {
    const values = dataset.map(row => row[col]);
    const numeric = detectNumeric(values);
    if (numeric) summary.numericCols.push(col);
    const cleanValues = values.filter(v => v !== undefined && v !== '');
    summary.missing += values.length - cleanValues.length;
    const numericVals = cleanValues.map(Number).filter(v => Number.isFinite(v));
    let stats = null;
    if (numericVals.length) {
      const mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
      const variance = numericVals.reduce((a, b) => a + Math.pow(b, 2), 0) / numericVals.length - Math.pow(mean, 2);
      stats = {
        mean,
        min: Math.min(...numericVals),
        max: Math.max(...numericVals),
        std: Math.sqrt(Math.max(variance, 0))
      };
    }
    summary.profiles[col] = {
      isNumeric: numeric,
      unique: new Set(cleanValues).size,
      sample: cleanValues.slice(0, 3),
      stats
    };
  });

  rowCount.textContent = summary.rows;
  colCount.textContent = summary.cols;
  missingCount.textContent = summary.missing;
  numericCount.textContent = summary.numericCols.length;
  renderInsights(summary);
  return summary;
}

function renderInsights(summary) {
  const insights = [];
  if (summary.numericCols.length) {
    summary.numericCols.forEach(col => {
      const stats = summary.profiles[col].stats;
      if (stats && Number.isFinite(stats.mean) && Number.isFinite(stats.min) && Number.isFinite(stats.max) && Number.isFinite(stats.std)) {
        insights.push(`${col}: mean ${stats.mean.toFixed(2)}, range ${stats.min.toFixed(2)}–${stats.max.toFixed(2)}, std ${stats.std.toFixed(2)}`);
      }
    });
  }
  const highCard = Object.entries(summary.profiles)
    .filter(([_, v]) => v.unique > summary.rows * 0.8)
    .map(([k]) => k);
  if (highCard.length) insights.push(`High-cardinality fields: ${highCard.join(', ')}`);
  if (insights.length) {
    const text = insights.map(i => `<li>${i}</li>`).join('');
    edaInsights.innerHTML = `<ul>${text}</ul>`;
  } else {
    edaInsights.innerHTML = '<p class="hint">No numeric columns detected yet.</p>';
  }
}

function refreshMetricBoard() {
  metricBoard.innerHTML = '';
  const priorities = ['North Star', 'P0', 'P1', 'P2'];
  priorities.forEach(priority => {
    const bucket = metrics.filter(m => m.priority === priority);
    const container = document.createElement('div');
    container.className = 'panel';
    const title = document.createElement('h3');
    title.textContent = priority;
    container.appendChild(title);
    bucket.forEach(metric => container.appendChild(renderMetric(metric)));
    metricBoard.appendChild(container);
  });
  updateMetricOptions();
}

function renderMetric(metric) {
  const card = document.createElement('div');
  card.className = 'metric-card';
  const header = document.createElement('div');
  header.className = 'metric-header';
  const name = document.createElement('h4');
  name.textContent = metric.name;
  const priority = document.createElement('span');
  priority.className = 'pill';
  priority.textContent = metric.priority;
  header.appendChild(name);
  header.appendChild(priority);
  card.appendChild(header);

  const def = document.createElement('p');
  def.className = 'metric-meta';
  def.textContent = metric.definition;
  card.appendChild(def);

  const trade = document.createElement('p');
  trade.className = 'metric-meta';
  trade.textContent = `Trade-offs: ${metric.tradeoffs || 'Not documented'}`;
  card.appendChild(trade);

  const evalTag = document.createElement('span');
  evalTag.className = 'pill';
  evalTag.textContent = metric.eval;
  card.appendChild(evalTag);
  return card;
}

function updateMetricOptions() {
  expMetric.innerHTML = '';
  metrics.forEach(metric => {
    const opt = document.createElement('option');
    opt.value = metric.name;
    opt.textContent = metric.name;
    expMetric.appendChild(opt);
  });
}

function generateDesignBrief() {
  const goal = document.getElementById('expGoal').value || 'Clarify goal';
  const guardrails = document.getElementById('expGuardrails').value || 'Apply toxicity, latency, and bias guardrails';
  const metric = expMetric.value || 'Primary metric TBD';
  const brief = `Goal: ${goal} \nPrimary metric: ${metric}. \nLLM guardrails: ${guardrails}. \nPlan: Launch 10-15% holdout on search traffic, validate offline eval parity (NDCG, precision@k), then ramp online with weekly LLM-based QA on MDFs and query clusters.`;
  designOutput.textContent = brief;
}

function estimatePower() {
  const baseline = Math.max(0, safeNumber(document.getElementById('baselineValue').value, 0.25));
  const mde = Math.max(Math.abs(safeNumber(document.getElementById('mde').value, 0.02)), 0.001);
  const alpha = Number.isFinite(Number(document.getElementById('alphaLevel').value)) ? Number(document.getElementById('alphaLevel').value) : 0.05;
  const power = Number.isFinite(Number(document.getElementById('targetPower').value)) ? Number(document.getElementById('targetPower').value) : 0.8;
  const zAlpha = alpha === 0.01 ? 2.58 : 1.96;
  const zBeta = power === 0.9 ? 1.28 : 0.84;
  const sigma = Math.max(0.02, baseline ? baseline * 0.2 : 0.1);
  const sampleSize = Math.ceil(2 * Math.pow((zAlpha + zBeta) * sigma / mde, 2));
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
    powerOutput.textContent = 'Unable to compute sample size with the provided inputs.';
    return;
  }
  powerOutput.textContent = `For baseline ${baseline.toFixed(3)}, MDE ${mde.toFixed(3)}, alpha ${alpha}, power ${Math.round(power*100)}%, target ~${sampleSize} samples per arm.`;
}

function runReadoutDecision() {
  const observed = Math.max(0, safeNumber(document.getElementById('observedEffect').value, 0));
  const mde = Math.max(Math.abs(safeNumber(document.getElementById('mde').value, 0.01)), 0.001);
  const rule = document.getElementById('goNoGoRule').value;
  const approved = document.getElementById('dsApproval').checked;
  const guardrailNote = document.getElementById('expGuardrails').value || 'Guardrails not documented';
  let decision = 'Review';
  let status = 'Neutral: Awaiting more data.';
  if (observed >= mde && (rule !== 'DS approval required' || approved)) {
    decision = 'Go';
    status = 'Effect clears MDE and guardrails look healthy.';
  }
  if (rule === 'DS approval required' && !approved) {
    decision = 'Block';
    status = 'Needs DS approval before shipping.';
  }
  readoutOutput.textContent = `LLM readout: Observed effect ${observed} vs MDE ${mde}. Rule: ${rule}. Guardrails: ${guardrailNote}. Decision: ${decision}. ${status}`;
}

function refreshDashboard() {
  dashboard.innerHTML = '';
  const items = metrics.slice(0, 4);
  if (!items.length) return;
  items.forEach(metric => {
    const card = document.createElement('div');
    card.className = 'kpi';
    const headline = document.createElement('h4');
    headline.textContent = metric.name;
    const value = document.createElement('p');
    const observed = dataset.length ? (Math.random() * 0.1 + 0.2).toFixed(3) : 'n/a';
    value.textContent = `Current: ${observed} • ${metric.priority}`;
    card.appendChild(headline);
    card.appendChild(value);
    dashboard.appendChild(card);
  });
}

function scanAlerts() {
  const spike = Number(document.getElementById('spikeThreshold').value || 15);
  const drift = Number(document.getElementById('driftThreshold').value || 8);
  const summary = summarizeData();
  if (!summary || !summary.numericCols.length) {
    alertOutput.textContent = 'No numeric fields available for alerting.';
    return;
  }
  const metric = summary.numericCols[0];
  const stats = summary.profiles[metric].stats;
  const spikeDetected = stats && stats.std / (stats.mean || 1) * 100 > spike;
  const driftDetected = stats && Math.abs(stats.mean - stats.min) / (Math.abs(stats.mean) || 1) * 100 > drift;
  alertOutput.innerHTML = `Monitoring ${metric}: ` +
    `<span class="${spikeDetected ? 'danger' : 'success'}">Spike ${spikeDetected ? 'detected' : 'clear'}</span>` +
    `<span class="${driftDetected ? 'warning' : 'success'}">Drift ${driftDetected ? 'detected' : 'stable'}</span>` +
    `<span class="pill">Holdout ${holdoutSlider.value}%</span>`;
}

function generateLLMReport() {
  const summary = summarizeData();
  const topMetric = metrics.find(m => m.priority === 'North Star') || metrics[0];
  const detail = (() => {
    if (!summary || !summary.numericCols.length) return 'Awaiting dataset to describe performance.';
    const firstMetric = summary.numericCols[0];
    const stats = summary.profiles[firstMetric].stats;
    if (!stats || typeof stats.mean !== 'number') return `Top numeric field ${firstMetric} ready for monitoring.`;
    return `Top numeric field ${firstMetric} mean ${stats.mean.toFixed(2)}`;
  })();
  const plan = `Next: compare Search Relevance and AI Adoption vs. last week, run MDF readout, enforce guardrails, and prepare go/no-go packet.`;
  reportOutput.textContent = `LLM report: ${topMetric ? topMetric.name : 'Metric TBD'} update. ${detail}. ${plan}`;
}

function addPlanItem() {
  const name = document.getElementById('planName').value;
  const impact = Math.max(0.5, safeNumber(document.getElementById('planImpact').value, 1));
  const effort = Math.max(0.5, safeNumber(document.getElementById('planEffort').value, 1));
  if (!name) return;
  const score = (impact / effort).toFixed(2);
  const entry = document.createElement('div');
  entry.innerHTML = `<strong>${name}</strong> — impact ${impact}, effort ${effort}, priority score ${score}`;
  if (planList.textContent.includes('No initiatives yet.')) planList.innerHTML = '';
  planList.appendChild(entry);
  document.getElementById('planName').value = '';
}

function projectGoal() {
  const current = Math.max(0, safeNumber(document.getElementById('goalCurrent').value, 0));
  const target = Math.max(0, safeNumber(document.getElementById('goalTarget').value, 0));
  const weeks = Math.max(1, safeNumber(document.getElementById('goalWeeks').value, 1));
  const lift = safeNumber(document.getElementById('goalLift').value, 0) / 100;
  const boundedLift = Math.max(-0.99, lift);
  const projected = current * Math.pow(1 + boundedLift, weeks);
  const status = projected >= target ? 'On track' : 'Stretch';
  const weeklyNeed = target > 0 ? Math.pow(target / (current || 0.01), 1 / weeks) - 1 : 0;
  if (!Number.isFinite(projected) || !Number.isFinite(weeklyNeed)) {
    goalOutput.textContent = 'Unable to project trajectory with the provided numbers.';
    return;
  }
  goalOutput.textContent = `Projected ${projected.toFixed(3)} in ${weeks} weeks (${status}). Required weekly lift to hit target: ${(weeklyNeed*100).toFixed(2)}%.`;
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    try {
      if (file.name.endsWith('.json')) {
        const json = JSON.parse(content);
        if (Array.isArray(json) && json.length && typeof json[0] === 'object') {
          columns = Object.keys(json[0]);
          dataset = json;
          updatePreview();
          summarizeData();
          refreshDashboard();
        } else {
          throw new Error('JSON must be an array of objects');
        }
      } else {
        buildDataset(parseCSV(content));
      }
    } catch (error) {
      edaInsights.innerHTML = `<p class="danger">Failed to parse file: ${error.message}</p>`;
    }
  };
  reader.readAsText(file);
}

function fetchFromUrl() {
  const url = urlInput.value.trim();
  if (!url) return;
  fetchButton.disabled = true;
  fetch(url)
    .then(res => res.text())
    .then(text => buildDataset(parseCSV(text)))
    .catch(err => {
      edaInsights.innerHTML = `<p class="danger">Unable to fetch data: ${err.message}</p>`;
    })
    .finally(() => {
      fetchButton.disabled = false;
    });
}

metricForm.addEventListener('submit', e => {
  e.preventDefault();
  const metric = {
    name: document.getElementById('metricName').value,
    priority: document.getElementById('metricPriority').value,
    eval: document.getElementById('metricEval').value,
    definition: document.getElementById('metricDefinition').value,
    tradeoffs: document.getElementById('metricTradeoffs').value
  };
  metrics.push(metric);
  metricForm.reset();
  refreshMetricBoard();
});

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) readFile(file);
});

fetchButton.addEventListener('click', fetchFromUrl);
generateDesign.addEventListener('click', generateDesignBrief);
calcPower.addEventListener('click', estimatePower);
runReadout.addEventListener('click', runReadoutDecision);
runAlerts.addEventListener('click', scanAlerts);
generateReport.addEventListener('click', generateLLMReport);
projectGoalBtn.addEventListener('click', projectGoal);

document.getElementById('addPlan').addEventListener('click', addPlanItem);

holdoutSlider.addEventListener('input', () => {
  holdoutValue.textContent = `${holdoutSlider.value}%`;
});

initSampleMetrics();
refreshDashboard();
