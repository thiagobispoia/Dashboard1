const SUBJECTS = [
  { key: "Portugues", label: "Português" },
  { key: "Matematica", label: "Matemática" },
  { key: "Historia", label: "História" },
  { key: "Geografia", label: "Geografia" },
  { key: "Biologia", label: "Biologia" },
  { key: "Fisica", label: "Física" },
  { key: "Quimica", label: "Química" },
  { key: "Ingles", label: "Inglês" },
  { key: "Educacao_Fisica", label: "Ed. Física" },
];

const STATUS_META = {
  aprovado: { label: "Aprovado", color: "#3b9eff" },
  recuperacao: { label: "Recuperação", color: "#f97316" },
  reprovado: { label: "Reprovado", color: "#f87171" },
};

const COLORS = {
  blue: "#3b9eff",
  cyan: "#22d3ee",
  purple: "#a855f7",
  violet: "#7c5cff",
  orange: "#f97316",
  amber: "#fbbf24",
  green: "#34d399",
  red: "#f87171",
  muted: "rgba(255,255,255,0.12)",
};

const PALETTE = [
  COLORS.blue,
  COLORS.purple,
  COLORS.orange,
  COLORS.cyan,
  COLORS.violet,
  COLORS.amber,
  COLORS.green,
  "#ec4899",
  "#14b8a6",
];

const state = {
  all: [],
  view: "overview",
  selectedClass: null, // { serie, turma }
  filters: {
    serie: "",
    turma: "",
    disciplina: "",
    status: "",
  },
  turmaFilters: {
    serie: "",
    turma: "",
  },
};

const charts = {};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = cols[i]?.trim() ?? "";
    });
    SUBJECTS.forEach(({ key }) => {
      row[key] = Number(row[key]);
    });
    row.Media_Geral = Number(row.Media_Geral);
    return row;
  });
}

function getNota(aluno) {
  const { disciplina } = state.filters;
  if (disciplina && SUBJECTS.some((s) => s.key === disciplina)) {
    return aluno[disciplina];
  }
  return aluno.Media_Geral;
}

function getStatus(nota) {
  if (nota >= 7) return "aprovado";
  if (nota >= 5) return "recuperacao";
  return "reprovado";
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function filteredStudents() {
  return state.all.filter((a) => {
    if (state.filters.serie && a.Serie !== state.filters.serie) return false;
    if (state.filters.turma && a.Turma !== state.filters.turma) return false;
    const nota = getNota(a);
    if (state.filters.status && getStatus(nota) !== state.filters.status) return false;
    return true;
  });
}

function subjectLabel(key) {
  return SUBJECTS.find((s) => s.key === key)?.label || key;
}

function setFilter(key, value, { skipSelectSync = false } = {}) {
  state.filters[key] = value ?? "";
  if (!skipSelectSync) {
    const map = {
      serie: "filterSerie",
      turma: "filterTurma",
      disciplina: "filterDisciplina",
      status: "filterStatus",
    };
    const el = document.getElementById(map[key]);
    if (el) el.value = state.filters[key];
  }
  refresh();
}

function clearFilters() {
  state.filters = { serie: "", turma: "", disciplina: "", status: "" };
  document.getElementById("filterSerie").value = "";
  document.getElementById("filterTurma").value = "";
  document.getElementById("filterDisciplina").value = "";
  document.getElementById("filterStatus").value = "";
  refresh();
}

function renderChips() {
  const box = document.getElementById("activeChips");
  const chips = [];
  if (state.filters.serie) {
    chips.push({ key: "serie", text: `Série: ${state.filters.serie}` });
  }
  if (state.filters.turma) {
    chips.push({ key: "turma", text: `Turma: ${state.filters.turma}` });
  }
  if (state.filters.disciplina) {
    chips.push({
      key: "disciplina",
      text: `Disc.: ${subjectLabel(state.filters.disciplina)}`,
    });
  }
  if (state.filters.status) {
    chips.push({
      key: "status",
      text: STATUS_META[state.filters.status].label,
    });
  }
  box.innerHTML = chips
    .map(
      (c) =>
        `<span class="chip">${c.text}<button type="button" data-clear="${c.key}" aria-label="Remover filtro">×</button></span>`
    )
    .join("");
  box.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.clear, ""));
  });
}

function updateKPIs(students) {
  const notas = students.map(getNota);
  const media = avg(notas);
  const aprovados = students.filter((a) => getStatus(getNota(a)) === "aprovado");
  const pct = students.length ? (aprovados.length / students.length) * 100 : 0;

  let top = null;
  students.forEach((a) => {
    const n = getNota(a);
    if (!top || n > getNota(top)) top = a;
  });

  document.getElementById("kpiTotal").textContent = students.length;
  document.getElementById("kpiMedia").textContent = media.toFixed(1);
  document.getElementById("kpiAprovacaoPct").textContent = `${pct.toFixed(0)}%`;
  document.getElementById("kpiAprovacaoDetail").textContent = students.length
    ? `${aprovados.length} de ${students.length} alunos`
    : "Sem alunos";
  document.getElementById("kpiTop").textContent = top ? top.Nome : "—";
  document.getElementById("kpiTopNota").textContent = top
    ? `Nota ${getNota(top).toFixed(1)} · ${top.Serie} ${top.Turma}`
    : "—";

  updateRing(pct);
}

function updateRing(pct) {
  const canvas = document.getElementById("kpiRing");
  if (charts.ring) {
    charts.ring.data.datasets[0].data = [pct, Math.max(0, 100 - pct)];
    charts.ring.update();
    return;
  }
  charts.ring = new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [pct, Math.max(0, 100 - pct)],
          backgroundColor: [COLORS.cyan, COLORS.muted],
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    },
    options: {
      cutout: "78%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { animateRotate: true },
    },
  });
}

function chartDefaults() {
  Chart.defaults.color = "#8b95a8";
  Chart.defaults.font.family = "'Outfit', system-ui, sans-serif";
  Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
}

function baseTooltip() {
  return {
    backgroundColor: "rgba(12, 16, 28, 0.95)",
    titleColor: "#f3f6ff",
    bodyColor: "#c7d0e0",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
  };
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function renderDisciplinas(students) {
  const labels = SUBJECTS.map((s) => s.label);
  const data = SUBJECTS.map((s) => avg(students.map((a) => a[s.key])));
  const active = state.filters.disciplina;

  destroyChart("disciplinas");
  charts.disciplinas = new Chart(document.getElementById("chartDisciplinas"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: SUBJECTS.map((s, i) =>
            !active || active === s.key
              ? PALETTE[i % PALETTE.length]
              : "rgba(255,255,255,0.08)"
          ),
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: {
            label: (ctx) => `Média: ${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const key = SUBJECTS[idx].key;
        setFilter("disciplina", state.filters.disciplina === key ? "" : key);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderSeries(students) {
  const series = [...new Set(state.all.map((a) => a.Serie))].sort();
  const counts = series.map((s) => students.filter((a) => a.Serie === s).length);
  const active = state.filters.serie;

  destroyChart("series");
  charts.series = new Chart(document.getElementById("chartSeries"), {
    type: "doughnut",
    data: {
      labels: series,
      datasets: [
        {
          data: counts,
          backgroundColor: series.map((s, i) =>
            !active || active === s ? PALETTE[i] : "rgba(255,255,255,0.08)"
          ),
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: baseTooltip(),
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const val = series[elements[0].index];
        setFilter("serie", state.filters.serie === val ? "" : val);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderStatus(students) {
  const keys = ["aprovado", "recuperacao", "reprovado"];
  const counts = keys.map(
    (k) => students.filter((a) => getStatus(getNota(a)) === k).length
  );
  const active = state.filters.status;

  destroyChart("status");
  charts.status = new Chart(document.getElementById("chartStatus"), {
    type: "doughnut",
    data: {
      labels: keys.map((k) => STATUS_META[k].label),
      datasets: [
        {
          data: counts,
          backgroundColor: keys.map((k) =>
            !active || active === k ? STATUS_META[k].color : "rgba(255,255,255,0.08)"
          ),
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: baseTooltip(),
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const val = keys[elements[0].index];
        setFilter("status", state.filters.status === val ? "" : val);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderTurmas(students) {
  const turmas = ["A", "B", "C"];
  const medias = turmas.map((t) => {
    const group = students.filter((a) => a.Turma === t);
    return avg(group.map(getNota));
  });
  const active = state.filters.turma;

  destroyChart("turmas");
  charts.turmas = new Chart(document.getElementById("chartTurmas"), {
    type: "bar",
    data: {
      labels: turmas.map((t) => `Turma ${t}`),
      datasets: [
        {
          data: medias,
          backgroundColor: turmas.map((t, i) =>
            !active || active === t
              ? [COLORS.blue, COLORS.purple, COLORS.orange][i]
              : "rgba(255,255,255,0.08)"
          ),
          borderRadius: 12,
          borderSkipped: false,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: {
            label: (ctx) => `Média: ${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const val = turmas[elements[0].index];
        state.filters.turma = val;
        const el = document.getElementById("filterTurma");
        if (el) el.value = val;
        showView("turmas", { turma: val });
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderDistribuicao(students) {
  const bins = [
    { label: "< 5", min: 0, max: 5, status: "reprovado" },
    { label: "5 – 5,9", min: 5, max: 6, status: "recuperacao" },
    { label: "6 – 6,9", min: 6, max: 7, status: "recuperacao" },
    { label: "7 – 7,9", min: 7, max: 8, status: "aprovado" },
    { label: "8 – 8,9", min: 8, max: 9, status: "aprovado" },
    { label: "9 – 10", min: 9, max: 10.01, status: "aprovado" },
  ];
  const counts = bins.map(
    (b) =>
      students.filter((a) => {
        const n = getNota(a);
        return n >= b.min && n < b.max;
      }).length
  );

  destroyChart("distribuicao");
  charts.distribuicao = new Chart(document.getElementById("chartDistribuicao"), {
    type: "bar",
    data: {
      labels: bins.map((b) => b.label),
      datasets: [
        {
          data: counts,
          backgroundColor: bins.map((b) => STATUS_META[b.status].color),
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} aluno(s)`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const status = bins[elements[0].index].status;
        setFilter("status", state.filters.status === status ? "" : status);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderRanking(students) {
  const sorted = [...students].sort((a, b) => getNota(b) - getNota(a)).slice(0, 10);
  const tbody = document.querySelector("#rankingTable tbody");
  tbody.innerHTML = sorted
    .map((a, i) => {
      const nota = getNota(a);
      const cls = nota >= 7 ? "high" : nota >= 5 ? "mid" : "low";
      return `<tr>
        <td><span class="rank-badge ${i === 0 ? "gold" : ""}">${i + 1}</span></td>
        <td>${a.Nome}</td>
        <td>${a.Serie}</td>
        <td>${a.Turma}</td>
        <td><span class="nota-pill ${cls}">${nota.toFixed(1)}</span></td>
      </tr>`;
    })
    .join("");
  if (!sorted.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:24px">Nenhum aluno com os filtros atuais</td></tr>';
  }
}

function renderProgress(students) {
  const total = students.length || 1;
  const keys = ["aprovado", "recuperacao", "reprovado"];
  const box = document.getElementById("progressList");
  box.innerHTML = keys
    .map((k) => {
      const count = students.filter((a) => getStatus(getNota(a)) === k).length;
      const pct = (count / total) * 100;
      return `<div class="progress-item">
        <label><span>${STATUS_META[k].label}</span><span>${count} · ${pct.toFixed(0)}%</span></label>
        <div class="bar-track"><div class="bar-fill ${k}" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");
}

function refresh() {
  if (state.view === "overview") {
    const students = filteredStudents();
    renderChips();
    updateKPIs(students);
    renderDisciplinas(students);
    renderSeries(students);
    renderStatus(students);
    renderTurmas(students);
    renderDistribuicao(students);
    renderRanking(students);
    renderProgress(students);
  } else {
    refreshTurmasView();
  }
}

function classKey(serie, turma) {
  return `${serie}|${turma}`;
}

function getAllClasses() {
  const map = new Map();
  state.all.forEach((a) => {
    const key = classKey(a.Serie, a.Turma);
    if (!map.has(key)) map.set(key, { serie: a.Serie, turma: a.Turma, students: [] });
    map.get(key).students.push(a);
  });
  return [...map.values()].sort((a, b) =>
    a.serie === b.serie ? a.turma.localeCompare(b.turma) : a.serie.localeCompare(b.serie)
  );
}

function classStats(students) {
  const notas = students.map((a) => a.Media_Geral);
  const media = avg(notas);
  const aprovados = students.filter((a) => getStatus(a.Media_Geral) === "aprovado").length;
  const pct = students.length ? (aprovados / students.length) * 100 : 0;
  let top = null;
  students.forEach((a) => {
    if (!top || a.Media_Geral > top.Media_Geral) top = a;
  });
  const subjectAvgs = SUBJECTS.map((s) => ({
    ...s,
    media: avg(students.map((a) => a[s.key])),
  }));
  const weakest = [...subjectAvgs].sort((a, b) => a.media - b.media)[0];
  const strongest = [...subjectAvgs].sort((a, b) => b.media - a.media)[0];
  return { media, aprovados, pct, top, subjectAvgs, weakest, strongest };
}

function filteredClasses() {
  return getAllClasses().filter((c) => {
    if (state.turmaFilters.serie && c.serie !== state.turmaFilters.serie) return false;
    if (state.turmaFilters.turma && c.turma !== state.turmaFilters.turma) return false;
    return true;
  });
}

function selectedClassStudents() {
  if (!state.selectedClass) {
    return filteredClasses().flatMap((c) => c.students);
  }
  return state.all.filter(
    (a) =>
      a.Serie === state.selectedClass.serie && a.Turma === state.selectedClass.turma
  );
}

function renderTurmaCards() {
  const box = document.getElementById("turmaCards");
  const classes = filteredClasses();
  box.innerHTML = classes
    .map((c) => {
      const st = classStats(c.students);
      const key = classKey(c.serie, c.turma);
      const active =
        state.selectedClass &&
        classKey(state.selectedClass.serie, state.selectedClass.turma) === key;
      return `<article class="glass-card turma-card ${active ? "active" : ""}" data-serie="${c.serie}" data-turma="${c.turma}">
        <h3 class="turma-card-title">${c.serie} — Turma ${c.turma}</h3>
        <div class="turma-card-meta">
          <div class="turma-stat"><span>Alunos</span><strong>${c.students.length}</strong></div>
          <div class="turma-stat"><span>Média</span><strong>${st.media.toFixed(1)}</strong></div>
          <div class="turma-stat"><span>Aprovação</span><strong>${st.pct.toFixed(0)}%</strong></div>
          <div class="turma-stat"><span>Destaque</span><strong style="font-size:0.95rem">${st.top ? st.top.Media_Geral.toFixed(1) : "—"}</strong></div>
        </div>
        <div class="turma-card-footer">
          <span>${st.top ? st.top.Nome.split(" ").slice(0, 2).join(" ") : "—"}</span>
          <span>${st.aprovados} aprovados</span>
        </div>
      </article>`;
    })
    .join("");

  box.querySelectorAll(".turma-card").forEach((card) => {
    card.addEventListener("click", () => {
      const serie = card.dataset.serie;
      const turma = card.dataset.turma;
      const same =
        state.selectedClass &&
        state.selectedClass.serie === serie &&
        state.selectedClass.turma === turma;
      state.selectedClass = same ? null : { serie, turma };
      refreshTurmasView();
    });
  });
}

function renderTurmaDetail() {
  const detail = document.getElementById("turmaDetail");
  const overviewCharts = document.getElementById("turmaOverviewCharts");
  const students = selectedClassStudents();
  const st = classStats(students);

  detail.hidden = false;
  overviewCharts.hidden = !!state.selectedClass;

  if (state.selectedClass) {
    document.getElementById("turmaDetailTitle").textContent =
      `${state.selectedClass.serie} — Turma ${state.selectedClass.turma}`;
    document.getElementById("turmaDetailSub").textContent =
      `Detalhamento completo · Prof. Thiago Bispo`;
  } else {
    document.getElementById("turmaDetailTitle").textContent = "Resumo das turmas filtradas";
    document.getElementById("turmaDetailSub").textContent =
      "Selecione um card para focar em uma turma específica";
  }

  document.getElementById("tkpiAlunos").textContent = students.length;
  document.getElementById("tkpiMedia").textContent = st.media.toFixed(1);
  document.getElementById("tkpiAprov").textContent = `${st.pct.toFixed(0)}%`;
  document.getElementById("tkpiAprovDetail").textContent =
    `${st.aprovados} de ${students.length} alunos`;
  document.getElementById("tkpiTop").textContent = st.top ? st.top.Nome : "—";
  document.getElementById("tkpiTopNota").textContent = st.top
    ? `Média ${st.top.Media_Geral.toFixed(1)}`
    : "—";

  const weakBox = document.getElementById("weakSubject");
  if (st.weakest) {
    weakBox.innerHTML = `
      <p class="ws-name">${st.weakest.label}</p>
      <p class="ws-nota">${st.weakest.media.toFixed(1)}</p>
      <p class="ws-hint">Menor média · Melhor: ${st.strongest.label} (${st.strongest.media.toFixed(1)})</p>`;
  } else {
    weakBox.innerHTML = `<p class="ws-hint">Sem dados</p>`;
  }

  renderTurmaDiscChart(students);
  renderTurmaStatusChart(students);
  renderTurmaComparativo();
  renderTurmaAlunosTable(students);
  if (!state.selectedClass) renderAllTurmasChart();
}

function renderTurmaDiscChart(students) {
  const labels = SUBJECTS.map((s) => s.label);
  const data = SUBJECTS.map((s) => avg(students.map((a) => a[s.key])));
  destroyChart("turmaDisc");
  charts.turmaDisc = new Chart(document.getElementById("chartTurmaDisc"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: PALETTE,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: { label: (ctx) => `Média: ${ctx.parsed.y.toFixed(2)}` },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

function renderTurmaStatusChart(students) {
  const keys = ["aprovado", "recuperacao", "reprovado"];
  const counts = keys.map(
    (k) => students.filter((a) => getStatus(a.Media_Geral) === k).length
  );
  destroyChart("turmaStatus");
  charts.turmaStatus = new Chart(document.getElementById("chartTurmaStatus"), {
    type: "doughnut",
    data: {
      labels: keys.map((k) => STATUS_META[k].label),
      datasets: [
        {
          data: counts,
          backgroundColor: keys.map((k) => STATUS_META[k].color),
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: baseTooltip(),
      },
    },
  });
}

function renderTurmaComparativo() {
  const classes = filteredClasses();
  const labels = classes.map((c) => `${c.serie.replace(" Ano", "")} ${c.turma}`);
  const data = classes.map((c) => classStats(c.students).media);
  const activeKey = state.selectedClass
    ? classKey(state.selectedClass.serie, state.selectedClass.turma)
    : null;

  destroyChart("turmaComparativo");
  charts.turmaComparativo = new Chart(document.getElementById("chartTurmaComparativo"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: classes.map((c, i) => {
            const key = classKey(c.serie, c.turma);
            if (activeKey && activeKey !== key) return "rgba(255,255,255,0.08)";
            return PALETTE[i % PALETTE.length];
          }),
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: { label: (ctx) => `Média: ${ctx.parsed.y.toFixed(2)}` },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const c = classes[elements[0].index];
        state.selectedClass = { serie: c.serie, turma: c.turma };
        refreshTurmasView();
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function renderAllTurmasChart() {
  const classes = filteredClasses();
  const labels = classes.map((c) => `${c.serie} ${c.turma}`);
  destroyChart("allTurmas");
  charts.allTurmas = new Chart(document.getElementById("chartAllTurmas"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Média",
          data: classes.map((c) => classStats(c.students).media),
          backgroundColor: COLORS.blue,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 36,
        },
        {
          label: "Aprovação % / 10",
          data: classes.map((c) => classStats(c.students).pct / 10),
          backgroundColor: COLORS.orange,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: {
          ...baseTooltip(),
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 1) {
                return `Aprovação: ${(ctx.parsed.y * 10).toFixed(0)}%`;
              }
              return `Média: ${ctx.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
      onClick: (_, elements) => {
        if (!elements.length) return;
        const c = classes[elements[0].index];
        state.selectedClass = { serie: c.serie, turma: c.turma };
        refreshTurmasView();
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
    },
  });
}

function bestWorstSubject(aluno) {
  let best = SUBJECTS[0];
  let worst = SUBJECTS[0];
  SUBJECTS.forEach((s) => {
    if (aluno[s.key] > aluno[best.key]) best = s;
    if (aluno[s.key] < aluno[worst.key]) worst = s;
  });
  return { best, worst };
}

function renderTurmaAlunosTable(students) {
  const sorted = [...students].sort((a, b) => b.Media_Geral - a.Media_Geral);
  const tbody = document.querySelector("#turmaAlunosTable tbody");
  tbody.innerHTML = sorted
    .map((a, i) => {
      const status = getStatus(a.Media_Geral);
      const { best, worst } = bestWorstSubject(a);
      const cls = a.Media_Geral >= 7 ? "high" : a.Media_Geral >= 5 ? "mid" : "low";
      return `<tr>
        <td><span class="rank-badge ${i === 0 ? "gold" : ""}">${i + 1}</span></td>
        <td>${a.Matricula}</td>
        <td>${a.Nome}</td>
        <td><span class="nota-pill ${cls}">${a.Media_Geral.toFixed(1)}</span></td>
        <td><span class="status-tag ${status}">${STATUS_META[status].label}</span></td>
        <td>${best.label} (${a[best.key].toFixed(1)})</td>
        <td>${worst.label} (${a[worst.key].toFixed(1)})</td>
      </tr>`;
    })
    .join("");
  if (!sorted.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:24px">Nenhum aluno encontrado</td></tr>';
  }
}

function refreshTurmasView() {
  renderTurmaCards();
  renderTurmaDetail();
}

const VIEW_META = {
  overview: {
    title: "Dashboard de Notas — Prof. Thiago Bispo",
    subtitle: "Clique nos gráficos para filtrar · Clique em Turmas para ver o detalhe",
  },
  turmas: {
    title: "Turmas — Prof. Thiago Bispo",
    subtitle: "Cards por turma · clique para ver médias, situação e lista de alunos",
  },
};

function showView(view, opts = {}) {
  state.view = view;

  if (opts.turma) {
    state.turmaFilters.turma = opts.turma;
    const sel = document.getElementById("turmaFilterLetra");
    if (sel) sel.value = opts.turma;
  }
  if (opts.serie) {
    state.turmaFilters.serie = opts.serie;
    const sel = document.getElementById("turmaFilterSerie");
    if (sel) sel.value = opts.serie;
  }
  if (opts.selectedClass) {
    state.selectedClass = opts.selectedClass;
  } else if (opts.turma && !opts.keepSelection) {
    // Prefere não auto-selecionar série+turma só pela letra; mostra cards filtrados
    state.selectedClass = null;
  }

  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `view-${view}`);
  });

  document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
    const matchView = btn.dataset.view === view;
    const hasScroll = Boolean(btn.dataset.scroll);
    if (opts.scroll) {
      btn.classList.toggle("active", matchView && btn.dataset.scroll === opts.scroll);
    } else {
      btn.classList.toggle("active", matchView && !hasScroll);
    }
  });

  // Se nenhum botão ficou ativo (ex.: scroll sem match), ativa o principal da view
  if (!document.querySelector(".nav-btn[data-view].active")) {
    const primary = document.querySelector(`.nav-btn[data-view="${view}"]:not([data-scroll])`);
    if (primary) primary.classList.add("active");
  }

  const meta = VIEW_META[view];
  document.getElementById("pageTitle").textContent = meta.title;
  document.getElementById("pageSubtitle").textContent = meta.subtitle;
  document.title = meta.title;

  const resetBtn = document.getElementById("btnReset");
  resetBtn.style.display = view === "overview" ? "" : "none";

  refresh();

  if (opts.scroll) {
    requestAnimationFrame(() => {
      const target = document.getElementById(opts.scroll);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function populateSelects() {
  const series = [...new Set(state.all.map((a) => a.Serie))].sort();
  const turmas = [...new Set(state.all.map((a) => a.Turma))].sort();
  const serieSel = document.getElementById("filterSerie");
  const turmaSel = document.getElementById("filterTurma");
  const discSel = document.getElementById("filterDisciplina");
  const turmaSerieSel = document.getElementById("turmaFilterSerie");

  series.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    serieSel.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = s;
    opt2.textContent = s;
    turmaSerieSel.appendChild(opt2);
  });
  turmas.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = `Turma ${t}`;
    turmaSel.appendChild(opt);
  });
  SUBJECTS.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = s.label;
    discSel.appendChild(opt);
  });
}

function bindFilters() {
  document.getElementById("filterSerie").addEventListener("change", (e) => {
    setFilter("serie", e.target.value, { skipSelectSync: true });
  });
  document.getElementById("filterTurma").addEventListener("change", (e) => {
    setFilter("turma", e.target.value, { skipSelectSync: true });
  });
  document.getElementById("filterDisciplina").addEventListener("change", (e) => {
    setFilter("disciplina", e.target.value, { skipSelectSync: true });
  });
  document.getElementById("filterStatus").addEventListener("change", (e) => {
    setFilter("status", e.target.value, { skipSelectSync: true });
  });
  document.getElementById("btnReset").addEventListener("click", clearFilters);

  document.getElementById("turmaFilterSerie").addEventListener("change", (e) => {
    state.turmaFilters.serie = e.target.value;
    state.selectedClass = null;
    refreshTurmasView();
  });
  document.getElementById("turmaFilterLetra").addEventListener("change", (e) => {
    state.turmaFilters.turma = e.target.value;
    state.selectedClass = null;
    refreshTurmasView();
  });
  document.getElementById("btnClearTurma").addEventListener("click", () => {
    state.selectedClass = null;
    refreshTurmasView();
  });
}

function bindNavigation() {
  document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showView(btn.dataset.view, { scroll: btn.dataset.scroll || null });
    });
  });
}

function updateClock() {
  const el = document.getElementById("clock");
  const tick = () => {
    el.textContent = new Date().toLocaleString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  tick();
  setInterval(tick, 30000);
}

const EMBEDDED_CSV = `Matricula,Nome,Serie,Turma,Portugues,Matematica,Historia,Geografia,Biologia,Fisica,Quimica,Ingles,Educacao_Fisica,Media_Geral
2024001,Ana Beatriz Silva,1º Ano,A,8.5,7.0,9.0,8.0,7.5,6.5,7.0,8.5,9.0,7.9
2024002,Bruno Henrique Costa,1º Ano,A,6.0,8.5,7.0,6.5,8.0,9.0,8.5,7.0,8.0,7.6
2024003,Carla Fernanda Oliveira,1º Ano,A,9.0,6.5,8.5,9.0,7.0,5.5,6.0,9.5,7.5,7.6
2024004,Diego Rafael Santos,1º Ano,B,5.5,7.5,6.0,5.0,6.5,7.0,6.0,5.5,8.5,6.4
2024005,Eduarda Lima Pereira,1º Ano,B,8.0,8.0,8.5,8.0,8.5,7.5,8.0,8.0,9.0,8.2
2024006,Felipe Augusto Rocha,1º Ano,B,7.0,9.5,6.5,7.0,7.5,9.0,9.5,6.5,8.0,7.8
2024007,Gabriela Souza Alves,1º Ano,C,9.5,7.5,9.0,9.5,8.0,7.0,7.5,9.0,8.5,8.4
2024008,Henrique Martins Dias,1º Ano,C,4.5,5.0,5.5,4.0,5.0,4.5,5.5,6.0,7.0,5.2
2024009,Isabela Cristina Nunes,1º Ano,C,8.5,8.0,8.0,8.5,9.0,8.0,8.5,8.5,9.5,8.5
2024010,João Pedro Ferreira,1º Ano,C,7.5,6.0,7.0,7.5,6.5,6.0,6.5,7.0,8.0,6.9
2024011,Larissa Mendes Carvalho,2º Ano,A,9.0,8.5,9.5,9.0,8.5,8.0,8.0,9.0,9.0,8.7
2024012,Marcos Vinícius Barbosa,2º Ano,A,6.5,9.0,6.0,6.5,7.0,9.5,9.0,6.0,7.5,7.4
2024013,Natália Ribeiro Gomes,2º Ano,A,8.0,7.0,8.5,8.0,8.0,6.5,7.0,8.5,8.0,7.7
2024014,Otávio César Pinto,2º Ano,B,5.0,6.5,5.5,5.0,6.0,7.0,6.5,5.5,7.5,6.1
2024015,Patrícia Almeida Torres,2º Ano,B,9.5,9.0,9.0,9.5,9.0,8.5,9.0,9.5,9.0,9.1
2024016,Rafael da Silva Moreira,2º Ano,B,7.0,7.5,7.0,6.5,7.5,7.0,7.5,7.0,8.5,7.3
2024017,Sofia Helena Campos,2º Ano,C,8.5,6.5,9.0,8.5,8.0,6.0,6.5,9.0,8.0,7.8
2024018,Thiago Luiz Azevedo,2º Ano,C,6.0,8.0,6.5,6.0,7.0,8.5,8.0,6.5,9.0,7.3
2024019,Úrsula Benedita Freitas,2º Ano,C,9.0,8.0,8.5,9.0,8.5,7.5,8.0,8.5,8.5,8.4
2024020,Vinícius Teixeira Lopes,2º Ano,C,4.0,5.5,4.5,5.0,5.5,6.0,5.0,4.5,7.0,5.2
2024021,Amanda Júlia Correia,3º Ano,A,8.0,8.5,8.0,8.5,9.0,8.0,8.5,8.0,8.5,8.3
2024022,Bernardo Augusto Melo,3º Ano,A,7.5,9.5,7.0,7.5,8.0,9.0,9.5,7.0,8.0,8.1
2024023,Camila Duarte Ramos,3º Ano,A,9.5,7.0,9.5,9.0,8.5,6.5,7.0,9.5,9.0,8.4
2024024,Daniel Henrique Batista,3º Ano,B,6.0,6.5,6.0,5.5,6.5,7.0,6.5,6.0,8.0,6.4
2024025,Elena Cristina Vargas,3º Ano,B,8.5,8.0,9.0,8.5,8.0,7.5,8.0,8.5,9.0,8.3
2024026,Fernando Paulo Guimarães,3º Ano,B,5.5,7.0,5.0,5.5,6.0,7.5,7.0,5.0,7.5,6.2
2024027,Giovanna Maria Castro,3º Ano,C,9.0,9.0,9.5,9.0,9.5,8.5,9.0,9.0,9.5,9.1
2024028,Hugo Leonardo Siqueira,3º Ano,C,7.0,8.5,7.5,7.0,7.5,8.0,8.5,7.0,8.0,7.7
2024029,Ingrid Beatriz Monteiro,3º Ano,C,8.0,6.0,8.5,8.0,7.5,5.5,6.0,8.5,8.5,7.4
2024030,José Carlos Antunes,3º Ano,C,6.5,7.5,6.0,6.5,7.0,7.5,7.0,6.0,9.0,7.0
2024031,Karen Priscila Andrade,1º Ano,A,7.5,7.0,8.0,7.5,7.0,6.5,7.0,8.0,8.5,7.4
2024032,Leonardo Fábio Cunha,1º Ano,B,9.0,9.5,8.0,8.5,9.0,9.5,9.0,8.0,8.5,8.8
2024033,Mariana Luiza Peixoto,1º Ano,B,8.5,5.5,9.0,8.5,7.5,5.0,5.5,9.0,9.0,7.5
2024034,Nicolas Eduardo Braga,1º Ano,C,5.0,6.0,5.5,5.0,6.0,6.5,6.0,5.5,7.5,5.9
2024035,Olívia Fernanda Reis,2º Ano,A,9.5,8.5,9.0,9.5,9.0,8.0,8.5,9.5,9.0,9.0
2024036,Paulo Roberto Nascimento,2º Ano,A,6.5,8.0,6.0,6.5,7.0,8.5,8.0,6.0,8.0,7.2
2024037,Queila Vanessa Duarte,2º Ano,B,8.0,7.5,8.5,8.0,8.0,7.0,7.5,8.5,8.5,7.9
2024038,Renato César Magalhães,2º Ano,B,4.5,5.5,4.0,4.5,5.0,5.5,5.0,4.0,6.5,4.9
2024039,Sabrina Teles Fonseca,2º Ano,C,9.0,9.0,8.5,9.0,9.5,9.0,9.0,8.5,9.0,9.0
2024040,Túlio Henrique Prado,2º Ano,C,7.0,6.5,7.5,7.0,6.5,6.0,6.5,7.5,8.0,7.0
2024041,Valentina Rocha Miranda,3º Ano,A,8.5,8.0,9.0,8.5,8.5,7.5,8.0,9.0,9.0,8.4
2024042,Wagner Luís Cardoso,3º Ano,A,6.0,9.0,5.5,6.0,7.0,9.5,9.0,5.5,7.5,7.2
2024043,Ximena Paula Figueiredo,3º Ano,B,9.0,7.5,9.5,9.0,8.5,7.0,7.5,9.5,8.5,8.4
2024044,Yuri Alexandre Borges,3º Ano,B,5.5,6.0,5.0,5.5,6.0,6.5,6.0,5.0,8.0,6.0
2024045,Zélia Aparecida Moura,3º Ano,C,8.0,8.5,8.0,8.0,8.5,8.0,8.5,8.0,8.5,8.2
2024046,Arthur Miguel Dantas,1º Ano,A,7.5,8.0,7.0,7.5,8.0,8.5,8.0,7.0,9.0,7.8
2024047,Beatriz Helena Tavares,1º Ano,B,9.5,6.5,9.0,9.5,8.0,6.0,6.5,9.0,8.5,8.1
2024048,Caio Fernando Xavier,2º Ano,A,6.0,7.0,6.5,6.0,6.5,7.5,7.0,6.0,8.0,6.7
2024049,Débora Cristina Leal,3º Ano,B,8.5,9.0,8.5,8.0,9.0,8.5,9.0,8.5,9.0,8.7
2024050,Enzo Gabriel Pacheco,3º Ano,C,7.0,7.5,7.0,7.5,7.5,7.0,7.5,7.0,8.5,7.4`;

async function loadData() {
  try {
    const res = await fetch("Notas%20Alunos.csv");
    if (!res.ok) throw new Error("fetch failed");
    const text = await res.text();
    state.all = parseCSV(text);
  } catch {
    state.all = parseCSV(EMBEDDED_CSV);
  }
}

async function init() {
  chartDefaults();
  updateClock();
  await loadData();
  populateSelects();
  bindFilters();
  bindNavigation();
  showView("overview");
}

init();
