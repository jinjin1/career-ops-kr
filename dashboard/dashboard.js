// career-ops-kr Dashboard
// applications.md 파일을 파싱하여 시각화합니다.
// parseApplications와 STATUS_MAP은 parser.js에서 로드 (브라우저: <script> 태그, Node: require)

let allData = [];
let scoreChart = null;
let statusChart = null;

const STATUS_COLORS = {
  evaluated: '#0ea5e9',
  applied: '#3b82f6',
  responded: '#8b5cf6',
  interview: '#10b981',
  offer: '#f59e0b',
  rejected: '#ef4444',
  discarded: '#6b7280',
  skip: '#9ca3af'
};

// parseApplications()와 STATUS_MAP은 parser.js에서 제공됨

// Update dashboard with parsed data
function updateDashboard(data) {
  allData = data;

  // Summary cards
  document.getElementById('totalCount').textContent = data.length;
  document.getElementById('appliedCount').textContent =
    data.filter(d => ['applied', 'responded', 'interview', 'offer'].includes(d.statusKey)).length;
  document.getElementById('interviewCount').textContent =
    data.filter(d => d.statusKey === 'interview').length;
  document.getElementById('topCount').textContent =
    data.filter(d => d.score >= 4.0).length;

  // Charts
  renderScoreChart(data);
  renderStatusChart(data);

  // Table
  renderTable(data);

  // Show dashboard, hide empty state
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('refreshBtn').disabled = false;
}

// Score distribution histogram
function renderScoreChart(data) {
  const bins = { '1.0-2.0': 0, '2.0-2.5': 0, '2.5-3.0': 0, '3.0-3.5': 0, '3.5-4.0': 0, '4.0-4.5': 0, '4.5-5.0': 0 };

  data.forEach(d => {
    if (d.score < 2.0) bins['1.0-2.0']++;
    else if (d.score < 2.5) bins['2.0-2.5']++;
    else if (d.score < 3.0) bins['2.5-3.0']++;
    else if (d.score < 3.5) bins['3.0-3.5']++;
    else if (d.score < 4.0) bins['3.5-4.0']++;
    else if (d.score < 4.5) bins['4.0-4.5']++;
    else bins['4.5-5.0']++;
  });

  const ctx = document.getElementById('scoreChart').getContext('2d');
  if (scoreChart) scoreChart.destroy();

  scoreChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(bins),
      datasets: [{
        data: Object.values(bins),
        backgroundColor: ['#fee2e2', '#fed7aa', '#fef3c7', '#d9f99d', '#bbf7d0', '#a7f3d0', '#6ee7b7'],
        borderColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#059669'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

// Status distribution pie chart
function renderStatusChart(data) {
  const counts = {};
  data.forEach(d => {
    const label = d.status;
    counts[label] = (counts[label] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const colors = labels.map(l => STATUS_COLORS[STATUS_MAP[l]] || '#9ca3af');

  const ctx = document.getElementById('statusChart').getContext('2d');
  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 } } }
      }
    }
  });
}

// Render table
function renderTable(data, filter = 'all') {
  let filtered = data;

  switch (filter) {
    case 'evaluated': filtered = data.filter(d => d.statusKey === 'evaluated'); break;
    case 'applied': filtered = data.filter(d => d.statusKey === 'applied'); break;
    case 'interview': filtered = data.filter(d => d.statusKey === 'interview'); break;
    case 'top': filtered = data.filter(d => d.score >= 4.0); break;
    case 'skip': filtered = data.filter(d => d.statusKey === 'skip' || d.statusKey === 'discarded'); break;
  }

  // Sort by score descending
  filtered.sort((a, b) => b.score - a.score);

  const tbody = document.getElementById('appTableBody');
  tbody.innerHTML = '';
  filtered.forEach(d => {
    const scoreClass = d.score >= 4.0 ? 'score-high' : d.score >= 3.0 ? 'score-mid' : 'score-low';
    const statusClass = `status-${d.statusKey}`;
    const tr = document.createElement('tr');

    const cells = [
      { text: d.id },
      { text: d.company, bold: true },
      { text: d.role },
      { text: `★${d.score.toFixed(1)}`, className: `score-badge ${scoreClass}` },
      { text: d.status, className: `status-badge ${statusClass}` },
      { text: d.date },
      { text: d.note }
    ];

    cells.forEach(cell => {
      const td = document.createElement('td');
      if (cell.className) {
        const span = document.createElement('span');
        span.className = cell.className;
        span.textContent = cell.text;
        td.appendChild(span);
      } else if (cell.bold) {
        const strong = document.createElement('strong');
        strong.textContent = cell.text;
        td.appendChild(strong);
      } else {
        td.textContent = cell.text;
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// File input handler
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = parseApplications(ev.target.result);
    if (data.length > 0) {
      updateDashboard(data);
    } else {
      alert('파싱할 수 있는 데이터가 없습니다. applications.md 형식을 확인해주세요.');
    }
  };
  reader.readAsText(file);
});

// Drag and drop
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.getElementById('dropZone').style.display = 'flex';
});
document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) {
    document.getElementById('dropZone').style.display = 'none';
  }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.getElementById('dropZone').style.display = 'none';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = parseApplications(ev.target.result);
    if (data.length > 0) {
      updateDashboard(data);
    }
  };
  reader.readAsText(file);
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTable(allData, btn.dataset.filter);
  });
});

// Card click -> filter
document.querySelectorAll('.card[data-filter]').forEach(card => {
  card.addEventListener('click', () => {
    const filter = card.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filter);
    });
    renderTable(allData, filter);
  });
});

// Try auto-loading via fetch (works with local server)
(async function tryAutoLoad() {
  try {
    const res = await fetch('../data/applications.md');
    if (res.ok) {
      const text = await res.text();
      const data = parseApplications(text);
      if (data.length > 0) updateDashboard(data);
    }
  } catch (e) {
    // Expected to fail with file:// protocol
  }
})();
