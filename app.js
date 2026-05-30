const STORAGE_KEY = "construction-board-v1";

const BOARD_FIELDS = [
  { key: "workType", labelKey: "labelWorkType", showKey: "showWorkType", defaultLabel: "工種", type: "text" },
  { key: "location", labelKey: "labelLocation", showKey: "showLocation", defaultLabel: "場所", type: "text" },
  { key: "workDate", labelKey: "labelWorkDate", showKey: "showWorkDate", defaultLabel: "施工日", type: "date" },
  { key: "worker", labelKey: "labelWorker", showKey: "showWorker", defaultLabel: "施工者", type: "text" },
  { key: "workContent1", labelKey: "labelWorkContent1", showKey: "showWorkContent1", defaultLabel: "作業内容", type: "text" },
  { key: "workContent2", labelKey: "labelWorkContent2", showKey: "showWorkContent2", defaultLabel: "作業内容", type: "text" },
  { key: "workContent3", labelKey: "labelWorkContent3", showKey: "showWorkContent3", defaultLabel: "作業内容", type: "text" },
  { key: "workContent4", labelKey: "labelWorkContent4", showKey: "showWorkContent4", defaultLabel: "作業内容", type: "text" },
  { key: "note", labelKey: "labelNote", showKey: "showNote", defaultLabel: "備考", type: "text" },
];

const defaultBoard = {
  projectName: "〇〇道路改良工事",
  workType: "施工状況",
  location: "現場内",
  workDate: new Date().toISOString().slice(0, 10),
  worker: "",
  workContent1: "",
  workContent2: "",
  workContent3: "",
  workContent4: "",
  note: "",
  photoNumber: "1",
  albumCategory: "施工状況",
  labelWorkType: "工種",
  labelLocation: "場所",
  labelWorkDate: "施工日",
  labelWorker: "施工者",
  labelWorkContent1: "作業内容",
  labelWorkContent2: "作業内容",
  labelWorkContent3: "作業内容",
  labelWorkContent4: "作業内容",
  labelNote: "備考",
  showWorkType: true,
  showLocation: true,
  showWorkDate: true,
  showWorker: true,
  showWorkContent1: true,
  showWorkContent2: true,
  showWorkContent3: true,
  showWorkContent4: true,
  showNote: true,
};

const state = {
  board: { ...defaultBoard },
  history: [],
  projects: ["〇〇道路改良工事"],
  selectedPanel: "inputPanel",
  boardSize: "compact",
  photo: null,
  photoName: "",
  composedUrl: "",
};

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  projectSelect: document.querySelector("#projectSelect"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  boardForm: document.querySelector("#boardForm"),
  blackboardPreview: document.querySelector("#blackboardPreview"),
  photoInput: document.querySelector("#photoInput"),
  photoName: document.querySelector("#photoName"),
  boardPosition: document.querySelector("#boardPosition"),
  boardScale: document.querySelector("#boardScale"),
  composeCanvas: document.querySelector("#composeCanvas"),
  downloadLink: document.querySelector("#downloadLink"),
  historyList: document.querySelector("#historyList"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, {
      ...saved,
      board: normalizeBoard({ ...defaultBoard, ...saved.board }),
      photo: null,
      composedUrl: "",
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistState() {
  const saved = {
    board: state.board,
    history: state.history,
    projects: state.projects,
    selectedPanel: state.selectedPanel,
    boardSize: state.boardSize,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  els.syncStatus.textContent = `端末内に保存済み ${new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function readForm() {
  const data = new FormData(els.boardForm);
  const values = Object.fromEntries(data.entries());
  BOARD_FIELDS.forEach((field) => {
    const checkbox = els.boardForm.elements.namedItem(field.showKey);
    values[field.showKey] = Boolean(checkbox?.checked);
  });
  state.board = normalizeBoard({ ...state.board, ...values });
}

function fillForm() {
  for (const [key, value] of Object.entries(state.board)) {
    const field = els.boardForm.elements.namedItem(key);
    if (!field) continue;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  }
}

function normalizeBoard(board) {
  const normalized = { ...defaultBoard, ...board };
  delete normalized.station;
  BOARD_FIELDS.forEach((field) => {
    normalized[field.labelKey] = normalized[field.labelKey] || field.defaultLabel;
    normalized[field.showKey] = normalized[field.showKey] !== false && normalized[field.showKey] !== "false";
  });
  return normalized;
}

function setActivePanel(panelId) {
  state.selectedPanel = panelId;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.querySelectorAll(".step-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelId);
  });
  persistState();
}

function renderProjectSelect() {
  const options = [...new Set([state.board.projectName, ...state.projects].filter(Boolean))];
  state.projects = options;
  els.projectSelect.innerHTML = options
    .map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`)
    .join("");
  els.projectSelect.value = state.board.projectName;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderBlackboard() {
  const rows = getBoardRows(state.board);
  els.blackboardPreview.classList.toggle("large", state.boardSize === "large");
  els.blackboardPreview.innerHTML = `
    <div class="board-title">
      <span>${escapeHtml(state.board.projectName || "工事件名")}</span>
      <span class="board-no">No.${escapeHtml(state.board.photoNumber || "-")}</span>
    </div>
    <div class="board-table">
      ${rows
        .map(
          ([label, value]) => `
            <div class="board-cell board-label">${escapeHtml(label)}</div>
            <div class="board-cell board-value">${escapeHtml(value || "-")}</div>
          `,
        )
        .join("")}
    </div>
  `;
}

function getBoardRows(board) {
  return BOARD_FIELDS.filter((field) => board[field.showKey]).map((field) => {
    const value = field.type === "date" ? formatDate(board[field.key]) : board[field.key];
    return [board[field.labelKey] || field.defaultLabel, value];
  });
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function makeBoardRecord(extra = {}) {
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...state.board, ...extra };
}

function saveCurrentBoard(extra = {}) {
  readForm();
  const record = makeBoardRecord(extra);
  state.history = [record, ...state.history].slice(0, 80);
  if (state.board.projectName && !state.projects.includes(state.board.projectName)) {
    state.projects.unshift(state.board.projectName);
  }
  persistState();
  renderAll();
  return record;
}

function duplicateWithNextNumber() {
  const next = Number.parseInt(state.board.photoNumber || "0", 10) + 1;
  state.board = { ...state.board, photoNumber: Number.isFinite(next) ? String(next) : state.board.photoNumber };
  fillForm();
  renderAll();
  persistState();
}

function copyFromRecord(record) {
  const { id, createdAt, composedImageName, ...board } = record;
  state.board = normalizeBoard({ ...defaultBoard, ...board });
  fillForm();
  renderAll();
  setActivePanel("inputPanel");
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = `<li class="history-item"><div><h3>まだ履歴がありません</h3><p>保存すると写真帳用データとしてここに残ります。</p></div></li>`;
    return;
  }
  els.historyList.innerHTML = state.history
    .map(
      (record) => `
        <li class="history-item">
          <div>
            <h3>No.${escapeHtml(record.photoNumber || "-")} ${escapeHtml(record.workType || "工種未入力")}</h3>
            <p>${escapeHtml(record.projectName || "")}</p>
            <p>${escapeHtml(record.albumCategory || "施工状況")} / ${escapeHtml(formatDate(record.workDate))} / ${escapeHtml(record.location || "-")}</p>
          </div>
          <button type="button" data-copy-record="${record.id}">再利用</button>
        </li>
      `,
    )
    .join("");
}

function drawBoardOnCanvas(ctx, x, y, width, board) {
  const rows = getBoardRows(board);
  const height = Math.round(width * 0.72);
  const labelWidth = Math.round(width * 0.28);
  const titleHeight = Math.round(height * 0.18);
  const rowHeight = (height - titleHeight) / Math.max(1, rows.length);

  ctx.save();
  ctx.fillStyle = "#143d2c";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#6a4f2b";
  ctx.lineWidth = Math.max(2, width * 0.006);
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#0d2b20";
  ctx.fillRect(x, y, width, titleHeight);
  ctx.fillStyle = "#f7fff4";
  ctx.font = `800 ${Math.max(16, width * 0.045)}px sans-serif`;
  ctx.textBaseline = "middle";
  drawText(ctx, board.projectName || "工事件名", x + 10, y + titleHeight / 2, width - 80, titleHeight * 0.8);
  ctx.fillStyle = "#f1e08a";
  ctx.textAlign = "right";
  ctx.fillText(`No.${board.photoNumber || "-"}`, x + width - 10, y + titleHeight / 2);
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(239,247,231,.78)";
  ctx.lineWidth = Math.max(1, width * 0.0035);
  ctx.beginPath();
  ctx.moveTo(x, y + titleHeight);
  ctx.lineTo(x + width, y + titleHeight);
  ctx.moveTo(x + labelWidth, y + titleHeight);
  ctx.lineTo(x + labelWidth, y + height);
  rows.forEach((_, index) => {
    const rowY = y + titleHeight + rowHeight * (index + 1);
    ctx.moveTo(x, rowY);
    ctx.lineTo(x + width, rowY);
  });
  ctx.stroke();

  rows.forEach(([label, value], index) => {
    const rowY = y + titleHeight + rowHeight * index;
    ctx.fillStyle = "#eef7e9";
    ctx.font = `800 ${Math.max(12, width * 0.033)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + labelWidth / 2, rowY + rowHeight / 2 + 1);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fbfff7";
    ctx.font = `800 ${Math.max(13, width * 0.036)}px sans-serif`;
    drawText(ctx, value || "-", x + labelWidth + 8, rowY + rowHeight / 2, width - labelWidth - 16, rowHeight * 0.86);
  });
  ctx.restore();
}

function drawText(ctx, text, x, centerY, maxWidth, maxHeight) {
  const words = String(text).split(/(\s+)/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words.length ? words : [String(text)]) {
    const next = current + word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trim());
      current = word.trimStart();
    } else {
      current = next;
    }
  }
  if (current) lines.push(current.trim());
  const lineHeight = Math.min(maxHeight / Math.max(1, lines.length), parseInt(ctx.font, 10) * 1.18);
  const top = centerY - (lineHeight * lines.length) / 2 + lineHeight / 2;
  lines.slice(0, 2).forEach((line, index) => {
    let fitted = line;
    while (ctx.measureText(fitted).width > maxWidth && fitted.length > 1) fitted = fitted.slice(0, -2) + "…";
    ctx.fillText(fitted, x, top + lineHeight * index);
  });
}

function composePhoto() {
  readForm();
  const canvas = els.composeCanvas;
  const ctx = canvas.getContext("2d");
  const width = state.photo?.naturalWidth || 1280;
  const height = state.photo?.naturalHeight || 960;
  canvas.width = width;
  canvas.height = height;

  if (state.photo) {
    ctx.drawImage(state.photo, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#c6d0d9";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#51606f";
    ctx.font = "700 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("写真未選択", width / 2, height / 2);
    ctx.textAlign = "left";
  }

  const scale = Number(els.boardScale.value) / 100;
  const boardWidth = Math.round(width * scale);
  const boardHeight = Math.round(boardWidth * 0.72);
  const margin = Math.round(width * 0.025);
  const position = els.boardPosition.value;
  const x = position.endsWith("right") ? width - boardWidth - margin : margin;
  const y = position.startsWith("top") ? margin : height - boardHeight - margin;
  drawBoardOnCanvas(ctx, x, y, boardWidth, state.board);

  if (state.composedUrl) URL.revokeObjectURL(state.composedUrl);
  canvas.toBlob((blob) => {
    if (!blob) return;
    state.composedUrl = URL.createObjectURL(blob);
    els.downloadLink.href = state.composedUrl;
    els.downloadLink.download = makeImageName();
    els.downloadLink.setAttribute("aria-disabled", "false");
  }, "image/jpeg", 0.92);
}

function makeImageName() {
  const project = (state.board.projectName || "project").replace(/[\\/:*?"<>|\s]+/g, "_");
  return `${project}_${state.board.photoNumber || "no"}_${state.board.workDate || "date"}.jpg`;
}

function exportJson() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), photoBookRecords: state.history.map(toPhotoBookRecord) };
  downloadText("photo-book-records.json", JSON.stringify(payload, null, 2), "application/json");
}

function exportCsv() {
  const headers = ["写真番号", "分類", "工事件名", "工種", "場所", "施工日", "施工者", "作業内容1", "作業内容2", "作業内容3", "作業内容4", "備考", "作成日時"];
  const rows = state.history.map((record) => [record.photoNumber, record.albumCategory, record.projectName, record.workType, record.location, record.workDate, record.worker, record.workContent1, record.workContent2, record.workContent3, record.workContent4, record.note, record.createdAt]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadText("photo-book-records.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function toPhotoBookRecord(record) {
  return {
    photoNo: record.photoNumber,
    category: record.albumCategory,
    projectName: record.projectName,
    title: record.workType,
    location: record.location,
    shootingDate: record.workDate,
    photographer: record.worker,
    workContents: [1, 2, 3, 4].map((number) => ({ label: record[`labelWorkContent${number}`] || "作業内容", text: record[`workContent${number}`] || "", visible: record[`showWorkContent${number}`] !== false })),
    memo: record.note,
    createdAt: record.createdAt,
  };
}

function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderProjectSelect();
  renderBlackboard();
  renderHistory();
  if (!els.downloadLink.href) els.downloadLink.setAttribute("aria-disabled", "true");
}

function bindEvents() {
  els.boardForm.addEventListener("input", () => { readForm(); renderBlackboard(); persistState(); });
  els.projectSelect.addEventListener("change", () => { state.board.projectName = els.projectSelect.value; fillForm(); renderAll(); persistState(); });
  els.saveProjectButton.addEventListener("click", () => { readForm(); if (state.board.projectName && !state.projects.includes(state.board.projectName)) state.projects.unshift(state.board.projectName); renderAll(); persistState(); });
  document.querySelectorAll(".step-tabs button").forEach((button) => button.addEventListener("click", () => setActivePanel(button.dataset.panel)));
  document.querySelectorAll("[data-board-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.boardSize = button.dataset.boardSize;
      document.querySelectorAll("[data-board-size]").forEach((sizeButton) => sizeButton.classList.toggle("active", sizeButton === button));
      renderBlackboard();
      persistState();
    });
  });
  document.querySelector("#copyLastButton").addEventListener("click", () => { if (state.history[0]) copyFromRecord(state.history[0]); });
  document.querySelector("#duplicateButton").addEventListener("click", duplicateWithNextNumber);
  document.querySelector("#newBoardButton").addEventListener("click", () => { state.board = normalizeBoard({ ...defaultBoard, workDate: new Date().toISOString().slice(0, 10) }); fillForm(); renderAll(); persistState(); });
  document.querySelector("#saveButton").addEventListener("click", () => saveCurrentBoard());
  document.querySelector("#composeButton").addEventListener("click", () => { composePhoto(); setActivePanel("photoPanel"); });
  els.photoInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => { state.photo = image; state.photoName = file.name; els.photoName.textContent = file.name; composePhoto(); };
    image.src = URL.createObjectURL(file);
  });
  document.querySelector("#clearPhotoButton").addEventListener("click", () => { state.photo = null; state.photoName = ""; els.photoName.textContent = "未選択"; els.photoInput.value = ""; composePhoto(); });
  els.boardPosition.addEventListener("change", composePhoto);
  els.boardScale.addEventListener("input", composePhoto);
  els.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-record]");
    if (!button) return;
    const record = state.history.find((item) => item.id === button.dataset.copyRecord);
    if (record) copyFromRecord(record);
  });
  document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
  document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
  document.querySelector("#clearHistoryButton").addEventListener("click", () => { if (!confirm("履歴を削除しますか？")) return; state.history = []; renderHistory(); persistState(); });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

loadState();
fillForm();
bindEvents();
renderAll();
setActivePanel(state.selectedPanel || "inputPanel");
composePhoto();
registerServiceWorker();
