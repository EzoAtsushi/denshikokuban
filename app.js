const STORAGE_KEY = "construction-board-v1";
const BOARD_FIELDS = [
  { key: "workType", labelKey: "labelWorkType", showKey: "showWorkType", defaultLabel: "工種", type: "text" },
  { key: "location", labelKey: "labelLocation", showKey: "showLocation", defaultLabel: "場所", type: "text" },
  { key: "workDate", labelKey: "labelWorkDate", showKey: "showWorkDate", defaultLabel: "施工日", type: "date" },
  { key: "worker", labelKey: "labelWorker", showKey: "showWorker", defaultLabel: "施工者", type: "text" },
  { key: "workContent", labelKey: "labelWorkContent", showKey: "showWorkContent", defaultLabel: "作業内容", type: "multiline" },
  { key: "note", labelKey: "labelNote", showKey: "showNote", defaultLabel: "備考", type: "text" },
];
const DEFAULT_FIELD_ORDER = BOARD_FIELDS.map((field) => field.key);

const defaultBoard = {
  projectName: "〇〇道路改良工事",
  workType: "施工状況",
  location: "現場内",
  workDate: new Date().toISOString().slice(0, 10),
  worker: "",
  workContent: "",
  note: "",
  labelWorkType: "工種",
  labelLocation: "場所",
  labelWorkDate: "施工日",
  labelWorker: "施工者",
  labelWorkContent: "作業内容",
  labelNote: "備考",
  showWorkType: true,
  showLocation: true,
  showWorkDate: true,
  showWorker: true,
  showWorkContent: true,
  showNote: true,
};

const state = {
  board: { ...defaultBoard },
  history: [],
  photoBookRecords: [],
  projects: ["〇〇道路改良工事"],
  selectedBoardId: "",
  editingBoardId: "",
  selectedPanel: "inputPanel",
  fieldOrder: [...DEFAULT_FIELD_ORDER],
  photo: null,
  photoName: "",
  composedUrl: "",
};

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  refreshAppButton: document.querySelector("#refreshAppButton"),
  projectSelect: document.querySelector("#projectSelect"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  deleteProjectButton: document.querySelector("#deleteProjectButton"),
  boardForm: document.querySelector("#boardForm"),
  blackboardPreview: document.querySelector("#blackboardPreview"),
  photoInput: document.querySelector("#photoInput"),
  photoName: document.querySelector("#photoName"),
  shootBoardSelect: document.querySelector("#shootBoardSelect"),
  editSelectedBoardButton: document.querySelector("#editSelectedBoardButton"),
  boardPosition: document.querySelector("#boardPosition"),
  boardScale: document.querySelector("#boardScale"),
  composeCanvas: document.querySelector("#composeCanvas"),
  downloadLink: document.querySelector("#downloadLink"),
  historyList: document.querySelector("#historyList"),
  exportProjectButton: document.querySelector("#exportProjectButton"),
  importProjectInput: document.querySelector("#importProjectInput"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, {
      ...saved,
      board: normalizeBoard({ ...defaultBoard, ...saved.board }),
      history: Array.isArray(saved.history) ? saved.history.map(normalizeRecord) : [],
      photoBookRecords: Array.isArray(saved.photoBookRecords)
        ? saved.photoBookRecords.map(normalizePhotoBookRecord)
        : [],
      fieldOrder: normalizeFieldOrder(saved.fieldOrder),
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
    photoBookRecords: state.photoBookRecords,
    projects: state.projects,
    selectedBoardId: state.selectedBoardId,
    editingBoardId: state.editingBoardId,
    selectedPanel: state.selectedPanel,
    fieldOrder: state.fieldOrder,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  els.syncStatus.textContent = `端末内に保存済み ${new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

async function refreshAppCache() {
  els.syncStatus.textContent = "最新版を読み込み中...";
  els.refreshAppButton.disabled = true;
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    window.location.replace(url.toString());
  }
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
  renderFieldOrder();
}

function normalizeBoard(board) {
  const normalized = { ...defaultBoard, ...board };
  delete normalized.station;
  delete normalized.photoNumber;
  delete normalized.albumCategory;
  delete normalized.fieldOrder;
  if (!normalized.workContent) {
    normalized.workContent = [1, 2, 3, 4]
      .map((number) => normalized[`workContent${number}`])
      .filter(Boolean)
      .join("\n");
  }
  normalized.workContent = normalizeWorkContent(normalized.workContent);
  if (!normalized.labelWorkContent) {
    normalized.labelWorkContent =
      normalized.labelWorkContent1 ||
      normalized.labelWorkContent2 ||
      normalized.labelWorkContent3 ||
      normalized.labelWorkContent4 ||
      "作業内容";
  }
  if (normalized.showWorkContent === undefined) {
    normalized.showWorkContent = [1, 2, 3, 4].some((number) => normalized[`showWorkContent${number}`] !== false);
  }
  [1, 2, 3, 4].forEach((number) => {
    delete normalized[`workContent${number}`];
    delete normalized[`labelWorkContent${number}`];
    delete normalized[`showWorkContent${number}`];
  });
  BOARD_FIELDS.forEach((field) => {
    normalized[field.labelKey] = normalized[field.labelKey] || field.defaultLabel;
    normalized[field.showKey] = normalized[field.showKey] !== false && normalized[field.showKey] !== "false";
  });
  return normalized;
}

function normalizeRecord(record) {
  const { id, createdAt, composedImageName, fieldOrder, ...board } = record;
  return {
    id: id || crypto.randomUUID(),
    createdAt: createdAt || new Date().toISOString(),
    ...normalizeBoard(board),
    fieldOrder: normalizeFieldOrder(fieldOrder),
    composedImageName,
  };
}

function normalizePhotoBookRecord(record) {
  const board = normalizeBoard(record.board || record);
  return {
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || new Date().toISOString(),
    projectName: record.projectName || board.projectName || "",
    imageName: record.imageName || record.composedImageName || "",
    sourcePhotoName: record.sourcePhotoName || "",
    boardRecordId: record.boardRecordId || "",
    sortOrder: Number(record.sortOrder || 0),
    boardPosition: record.boardPosition || "bottom-left",
    boardScale: Number(record.boardScale || 34),
    fieldOrder: normalizeFieldOrder(record.fieldOrder),
    board,
  };
}

function normalizeFieldOrder(order) {
  const validKeys = new Set(DEFAULT_FIELD_ORDER);
  const orderedKeys = Array.isArray(order)
    ? order.filter((key) => validKeys.has(key))
    : [];
  return [...new Set([...orderedKeys, ...DEFAULT_FIELD_ORDER])];
}

function getOrderedBoardFields(order = state.fieldOrder) {
  const fieldsByKey = new Map(BOARD_FIELDS.map((field) => [field.key, field]));
  return normalizeFieldOrder(order)
    .map((key) => fieldsByKey.get(key))
    .filter(Boolean);
}

function normalizeWorkContent(value) {
  return String(value ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split("\n")
    .slice(0, 4)
    .join("\n");
}

function enforceWorkContentLimit() {
  const field = els.boardForm.elements.namedItem("workContent");
  if (!field) return;
  const normalized = normalizeWorkContent(field.value);
  if (field.value !== normalized) field.value = normalized;
}

function setActivePanel(panelId) {
  const targetPanelId = document.getElementById(panelId) ? panelId : "inputPanel";
  state.selectedPanel = targetPanelId;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetPanelId);
  });
  document.querySelectorAll(".step-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === targetPanelId);
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

function renderFieldOrder() {
  const fieldset = els.boardForm.querySelector(".board-items");
  if (!fieldset) return;
  state.fieldOrder = normalizeFieldOrder(state.fieldOrder);
  const rows = new Map(
    [...fieldset.querySelectorAll("[data-field-key]")].map((row) => [row.dataset.fieldKey, row]),
  );
  state.fieldOrder.forEach((key) => {
    const row = rows.get(key);
    if (row) fieldset.appendChild(row);
  });
  state.fieldOrder.forEach((key, index) => {
    const row = rows.get(key);
    if (!row) return;
    const upButton = row.querySelector('[data-direction="up"]');
    const downButton = row.querySelector('[data-direction="down"]');
    if (upButton) upButton.disabled = index === 0;
    if (downButton) downButton.disabled = index === state.fieldOrder.length - 1;
  });
}

function moveField(key, direction) {
  readForm();
  const order = normalizeFieldOrder(state.fieldOrder);
  const index = order.indexOf(key);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  state.fieldOrder = order;
  renderFieldOrder();
  renderBlackboard();
  renderShootBoardSelect();
  persistState();
  composePhoto();
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
  els.blackboardPreview.innerHTML = `
    <div class="board-title">
      <span>${escapeHtml(state.board.projectName || "工事件名")}</span>
    </div>
    <div class="board-table">
      ${rows
        .map(
          ([label, value]) => `
            <div class="board-cell board-label">${escapeHtml(label)}</div>
            <div class="board-cell board-value" style="font-size:${getPreviewTextSize(value || "-")}px">${escapeHtml(value || "-")}</div>
          `,
        )
        .join("")}
    </div>
  `;
}

function getBoardRows(board) {
  return getOrderedBoardFields(board.fieldOrder || state.fieldOrder).filter((field) => board[field.showKey]).map((field) => {
    const value = field.type === "date" ? formatDate(board[field.key]) : board[field.key];
    return [board[field.labelKey] || field.defaultLabel, value];
  });
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getPreviewTextSize(value) {
  const text = String(value || "");
  const length = Array.from(text.replace(/\s/g, "")).length;
  const lines = text.split("\n").length;
  if (length > 90 || lines > 5) return 11;
  if (length > 60 || lines > 4) return 12;
  if (length > 38 || lines > 3) return 13;
  return 15;
}

function makeBoardRecord(extra = {}) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    fieldOrder: [...state.fieldOrder],
    ...state.board,
    ...extra,
  };
}

function saveCurrentBoard(extra = {}) {
  readForm();
  const editingIndex = state.editingBoardId
    ? state.history.findIndex((record) => record.id === state.editingBoardId)
    : -1;
  const record =
    editingIndex >= 0
      ? {
          ...state.history[editingIndex],
          ...state.board,
          fieldOrder: [...state.fieldOrder],
          ...extra,
          updatedAt: new Date().toISOString(),
        }
      : makeBoardRecord(extra);
  if (editingIndex >= 0) state.history.splice(editingIndex, 1, record);
  else state.history = [record, ...state.history].slice(0, 80);
  state.selectedBoardId = record.id;
  state.editingBoardId = record.id;
  if (state.board.projectName && !state.projects.includes(state.board.projectName)) {
    state.projects.unshift(state.board.projectName);
  }
  persistState();
  renderAll();
  return record;
}

function prepareNextBoard() {
  state.board = {
    ...state.board,
    workContent: "",
    note: "",
  };
  state.selectedBoardId = "";
  state.editingBoardId = "";
  fillForm();
  renderAll();
  persistState();
}

function copyFromRecord(record, panelId = "inputPanel") {
  const { id, createdAt, composedImageName, fieldOrder, ...board } = record;
  state.board = normalizeBoard({ ...defaultBoard, ...board });
  state.fieldOrder = normalizeFieldOrder(fieldOrder || state.fieldOrder);
  state.selectedBoardId = id || "";
  state.editingBoardId = panelId === "inputPanel" ? id || "" : "";
  fillForm();
  renderAll();
  if (panelId) setActivePanel(panelId);
  else persistState();
}

function renderHistory() {
  const records = currentProjectRecords();
  if (!records.length) {
    els.historyList.innerHTML = `<li class="history-item"><div><h3>この案件の黒板はまだありません</h3><p>保存するとここに一覧で残ります。</p></div></li>`;
    return;
  }

  els.historyList.innerHTML = records
    .map(
      (record) => `
        <li class="history-item">
          <div>
            <h3>${escapeHtml(recordTitle(record))}</h3>
            <p>${escapeHtml(record.projectName || "")}</p>
            <p>${escapeHtml(formatDate(record.workDate))} / ${escapeHtml(record.location || "-")}</p>
          </div>
          <div class="history-actions">
            <button type="button" data-edit-record="${record.id}">編集</button>
            <button type="button" data-use-record="${record.id}">撮影に使う</button>
            <button class="danger-button" type="button" data-delete-record="${record.id}">削除</button>
          </div>
        </li>
      `,
    )
    .join("");
}

function recordTitle(record) {
  const workContentHead = String(record.workContent || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return [record.workType, record.location, workContentHead].filter(Boolean).join(" / ") || "黒板データ";
}

function renderShootBoardSelect() {
  const selectedValue = state.selectedBoardId || "__current";
  const records = currentProjectRecords();
  const historyOptions = records
    .map(
      (record) =>
        `<option value="${escapeHtml(record.id)}">${escapeHtml(recordTitle(record))}</option>`,
    )
    .join("");
  els.shootBoardSelect.innerHTML = `<option value="__current">入力中の黒板</option>${historyOptions}`;
  els.shootBoardSelect.value = records.some((record) => record.id === selectedValue) ? selectedValue : "__current";
}

function drawBoardOnCanvas(ctx, x, y, width, board) {
  const rows = getBoardRows(board);
  const height = Math.round(width * 0.72);
  const labelWidth = Math.round(width * 0.28);
  const titleHeight = Math.round(height * 0.18);
  const rowWeights = rows.map(([, value]) => Math.min(4, Math.max(1, String(value || "-").split("\n").length)));
  const totalWeight = rowWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const bodyHeight = height - titleHeight;

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
  drawText(ctx, board.projectName || "工事件名", x + 10, y + titleHeight / 2, width - 20, titleHeight * 0.8);
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(239,247,231,.78)";
  ctx.lineWidth = Math.max(1, width * 0.0035);
  ctx.beginPath();
  ctx.moveTo(x, y + titleHeight);
  ctx.lineTo(x + width, y + titleHeight);
  ctx.moveTo(x + labelWidth, y + titleHeight);
  ctx.lineTo(x + labelWidth, y + height);
  let cursorY = y + titleHeight;
  rows.forEach((_, index) => {
    cursorY += (bodyHeight * rowWeights[index]) / totalWeight;
    const rowY = cursorY;
    ctx.moveTo(x, rowY);
    ctx.lineTo(x + width, rowY);
  });
  ctx.stroke();

  cursorY = y + titleHeight;
  rows.forEach(([label, value], index) => {
    const rowHeight = (bodyHeight * rowWeights[index]) / totalWeight;
    const rowY = cursorY;
    cursorY += rowHeight;
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
  const baseFont = ctx.font;
  const baseSize = Number(baseFont.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
  const minSize = Math.max(7, Math.floor(baseSize * 0.5));
  let fittedLines = [];
  let fittedSize = baseSize;
  let fittedLineHeight = baseSize * 1.18;

  for (let size = baseSize; size >= minSize; size -= 1) {
    ctx.font = baseFont.replace(/(\d+(?:\.\d+)?)px/, `${size}px`);
    const lines = wrapCanvasText(ctx, text, maxWidth);
    const lineHeight = size * 1.18;
    if (lines.length * lineHeight <= maxHeight) {
      fittedLines = lines;
      fittedSize = size;
      fittedLineHeight = lineHeight;
      break;
    }
    if (!fittedLines.length || size === minSize) {
      fittedLines = lines;
      fittedSize = size;
      fittedLineHeight = lineHeight;
    }
  }

  ctx.font = baseFont.replace(/(\d+(?:\.\d+)?)px/, `${fittedSize}px`);
  const maxVisibleLines = Math.max(1, Math.floor(maxHeight / fittedLineHeight));
  const lines = fittedLines.slice(0, maxVisibleLines);
  const lineHeight = Math.min(fittedLineHeight, maxHeight / Math.max(1, lines.length));
  const top = centerY - (lineHeight * lines.length) / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, top + lineHeight * index);
  });
  ctx.font = baseFont;
}

function wrapCanvasText(ctx, text, maxWidth) {
  const wrapped = [];
  String(text || "-")
    .split("\n")
    .forEach((sourceLine) => {
      const chars = Array.from(sourceLine || " ");
      let current = "";
      chars.forEach((char) => {
        const next = current + char;
        if (ctx.measureText(next).width > maxWidth && current) {
          wrapped.push(current);
          current = char.trimStart();
        } else {
          current = next;
        }
      });
      wrapped.push(current || " ");
    });
  return wrapped;
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
  const position = els.boardPosition.value;
  const x = position.endsWith("right") ? width - boardWidth : 0;
  const y = position.startsWith("top") ? 0 : height - boardHeight;
  drawBoardOnCanvas(ctx, x, y, boardWidth, state.board);

  if (state.composedUrl) URL.revokeObjectURL(state.composedUrl);
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      state.composedUrl = URL.createObjectURL(blob);
      const fileName = makeImageName();
      els.downloadLink.href = state.composedUrl;
      els.downloadLink.download = fileName;
      els.downloadLink.setAttribute("aria-disabled", "false");
    },
    "image/jpeg",
    0.92,
  );
}

function makeImageName() {
  const project = (state.board.projectName || "project").replace(/[\\/:*?"<>|\s]+/g, "_");
  const title = recordTitle(state.board).replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 32) || "board";
  const timestamp = compactDateTime(new Date());
  return `${project}_${state.board.workDate || "date"}_${title}_${timestamp}.jpg`;
}

function currentProjectRecords() {
  const projectName = state.board.projectName || "";
  return state.history.filter((record) => (record.projectName || "") === projectName);
}

function currentProjectPhotoBookRecords() {
  const projectName = state.board.projectName || "";
  return state.photoBookRecords.filter((record) => (record.projectName || "") === projectName);
}

function deleteCurrentProject() {
  const projectName = state.board.projectName || els.projectSelect.value || "";
  if (!projectName) {
    alert("削除する案件がありません。");
    return;
  }
  const boardCount = state.history.filter((record) => (record.projectName || "") === projectName).length;
  const photoCount = state.photoBookRecords.filter((record) => (record.projectName || "") === projectName).length;
  const message = `${projectName} を削除しますか？\n保存した黒板 ${boardCount}件と写真帳データ ${photoCount}件も削除されます。`;
  if (!confirm(message)) return;

  state.history = state.history.filter((record) => (record.projectName || "") !== projectName);
  state.photoBookRecords = state.photoBookRecords.filter((record) => (record.projectName || "") !== projectName);
  state.projects = state.projects.filter((project) => project !== projectName);

  const nextProject = state.projects.find(Boolean) || "";
  state.board = normalizeBoard({
    ...defaultBoard,
    projectName: nextProject,
    workDate: new Date().toISOString().slice(0, 10),
  });
  if (!nextProject) state.board.projectName = "";
  state.selectedBoardId = "";
  state.editingBoardId = "";
  fillForm();
  renderAll();
  persistState();
}

function rememberPhotoBookRecord() {
  readForm();
  const imageName = els.downloadLink.download || makeImageName();
  const existingIndex = state.photoBookRecords.findIndex((record) => record.imageName === imageName);
  const record = normalizePhotoBookRecord({
    id: existingIndex >= 0 ? state.photoBookRecords[existingIndex].id : crypto.randomUUID(),
    createdAt: existingIndex >= 0 ? state.photoBookRecords[existingIndex].createdAt : new Date().toISOString(),
    projectName: state.board.projectName || "",
    imageName,
    sourcePhotoName: state.photoName || "",
    boardRecordId: state.selectedBoardId || state.editingBoardId || "",
    sortOrder: state.photoBookRecords.length + 1,
    boardPosition: els.boardPosition.value,
    boardScale: Number(els.boardScale.value),
    fieldOrder: state.fieldOrder,
    board: state.board,
  });
  if (existingIndex >= 0) state.photoBookRecords.splice(existingIndex, 1, record);
  else state.photoBookRecords.push(record);
  persistState();
}

function exportProjectBundle() {
  readForm();
  const projectName = state.board.projectName || "案件";
  const boards = currentProjectRecords().map((record) => ({
    ...normalizeRecord(record),
    fieldOrder: normalizeFieldOrder(record.fieldOrder || state.fieldOrder),
  }));
  if (!boards.length) {
    alert("この案件の保存済み黒板がありません。先に黒板を保存してください。");
    return;
  }
  const payload = {
    app: "denshikokuban",
    type: "case-board-bundle",
    version: 2,
    exportedAt: new Date().toISOString(),
    projectName,
    fieldOrder: normalizeFieldOrder(state.fieldOrder),
    boards,
    photoBookRecords: currentProjectPhotoBookRecords(),
  };
  const fileName = `${sanitizeFileName(projectName)}_案件黒板一式.json`;
  downloadText(fileName, JSON.stringify(payload, null, 2), "application/json");
}

function importProjectBundle(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      const imported = normalizeProjectBundle(payload);
      if (!imported.boards.length) {
        alert("読み込める黒板データがありません。");
        return;
      }
      const merged = [...state.history];
      imported.boards
        .slice()
        .reverse()
        .forEach((record) => {
          const index = merged.findIndex((item) => item.id === record.id);
          if (index >= 0) merged.splice(index, 1, record);
          else merged.unshift(record);
        });
      state.history = merged.slice(0, 80);
      if (imported.photoBookRecords.length) {
        const mergedPhotoBookRecords = [...state.photoBookRecords];
        imported.photoBookRecords.forEach((record) => {
          const index = mergedPhotoBookRecords.findIndex((item) => item.id === record.id || item.imageName === record.imageName);
          if (index >= 0) mergedPhotoBookRecords.splice(index, 1, record);
          else mergedPhotoBookRecords.push(record);
        });
        state.photoBookRecords = mergedPhotoBookRecords;
      }
      state.projects = [...new Set([imported.projectName, ...state.projects].filter(Boolean))];
      state.fieldOrder = imported.fieldOrder;
      copyFromRecord(imported.boards[0], "inputPanel");
      persistState();
      alert(`${imported.projectName} の黒板 ${imported.boards.length}件を読み込みました。`);
    } catch {
      alert("案件ファイルを読み込めませんでした。");
    } finally {
      els.importProjectInput.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeProjectBundle(payload) {
  const projectName = String(payload.projectName || state.board.projectName || "案件");
  const fieldOrder = normalizeFieldOrder(payload.fieldOrder);
  const sourceBoards = Array.isArray(payload.boards)
    ? payload.boards
    : Array.isArray(payload.history)
      ? payload.history
      : [];
  const boards = sourceBoards.map((record) =>
    normalizeRecord({
      ...record,
      projectName: record.projectName || projectName,
      fieldOrder: normalizeFieldOrder(record.fieldOrder || fieldOrder),
    }),
  );
  const photoBookRecords = Array.isArray(payload.photoBookRecords)
    ? payload.photoBookRecords.map((record) =>
        normalizePhotoBookRecord({
          ...record,
          projectName: record.projectName || projectName,
          fieldOrder: normalizeFieldOrder(record.fieldOrder || fieldOrder),
        }),
      )
    : [];
  return {
    projectName,
    fieldOrder,
    boards,
    photoBookRecords,
  };
}

function sanitizeFileName(value) {
  return String(value || "project").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 48) || "project";
}

function compactDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function exportJson() {
  const records = currentProjectPhotoBookRecords();
  if (!records.length) {
    alert("写真帳に渡す写真データがありません。写真タブで合成画像を保存してください。");
    return;
  }
  const projectName = state.board.projectName || "案件";
  const payload = {
    app: "denshikokuban",
    type: "photo-book-link-data",
    version: 2,
    exportedAt: new Date().toISOString(),
    projectName,
    photos: records.map(toPhotoBookRecord),
    photoBookRecords: records.map(toPhotoBookRecord),
  };
  downloadText(`${sanitizeFileName(projectName)}_写真帳データ.json`, JSON.stringify(payload, null, 2), "application/json");
}

function toPhotoBookRecord(record) {
  const board = normalizeBoard(record.board || record);
  return {
    id: record.id,
    projectName: record.projectName || board.projectName,
    imageName: record.imageName || "",
    sourcePhotoName: record.sourcePhotoName || "",
    boardRecordId: record.boardRecordId || "",
    sortOrder: record.sortOrder || 0,
    boardPosition: record.boardPosition || "bottom-left",
    boardScale: record.boardScale || 34,
    fieldOrder: normalizeFieldOrder(record.fieldOrder),
    title: board.workType,
    location: board.location,
    shootingDate: board.workDate,
    photographer: board.worker,
    workContent: board.workContent,
    memo: board.note,
    labels: Object.fromEntries(
      getOrderedBoardFields(record.fieldOrder || state.fieldOrder).map((field) => [
        field.key,
        board[field.labelKey] || field.defaultLabel,
      ]),
    ),
    visibleFields: getOrderedBoardFields(record.fieldOrder || state.fieldOrder)
      .filter((field) => board[field.showKey])
      .map((field) => field.key),
    board,
    createdAt: record.createdAt,
  };
}

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
  renderFieldOrder();
  renderBlackboard();
  renderHistory();
  renderShootBoardSelect();
  if (!els.downloadLink.href) {
    els.downloadLink.setAttribute("aria-disabled", "true");
  }
}

function bindEvents() {
  els.refreshAppButton.addEventListener("click", refreshAppCache);

  els.boardForm.addEventListener("input", () => {
    readForm();
    enforceWorkContentLimit();
    if (!state.editingBoardId) state.selectedBoardId = "";
    renderBlackboard();
    renderShootBoardSelect();
    persistState();
  });

  els.boardForm.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-move-field]");
    if (!moveButton) return;
    moveField(moveButton.dataset.moveField, moveButton.dataset.direction);
  });

  els.projectSelect.addEventListener("change", () => {
    state.board.projectName = els.projectSelect.value;
    state.selectedBoardId = "";
    state.editingBoardId = "";
    fillForm();
    renderAll();
    persistState();
  });

  els.saveProjectButton.addEventListener("click", () => {
    readForm();
    if (state.board.projectName && !state.projects.includes(state.board.projectName)) {
      state.projects.unshift(state.board.projectName);
    }
    renderAll();
    persistState();
  });
  els.deleteProjectButton.addEventListener("click", deleteCurrentProject);

  document.querySelectorAll(".step-tabs button").forEach((button) => {
    button.addEventListener("click", () => setActivePanel(button.dataset.panel));
  });

  document.querySelector("#copyLastButton").addEventListener("click", () => {
    const lastRecord = currentProjectRecords()[0];
    if (!lastRecord) return;
    copyFromRecord(lastRecord);
    state.selectedBoardId = "";
    state.editingBoardId = "";
    renderShootBoardSelect();
    persistState();
  });
  document.querySelector("#duplicateButton").addEventListener("click", prepareNextBoard);
  document.querySelector("#newBoardButton").addEventListener("click", () => {
    state.board = normalizeBoard({ ...defaultBoard, workDate: new Date().toISOString().slice(0, 10) });
    state.selectedBoardId = "";
    state.editingBoardId = "";
    fillForm();
    renderAll();
    persistState();
  });
  document.querySelector("#saveButton").addEventListener("click", () => saveCurrentBoard());
  document.querySelectorAll(".save-and-next-action").forEach((button) => {
    button.addEventListener("click", () => {
      saveCurrentBoard();
      prepareNextBoard();
    });
  });
  document.querySelector("#composeButton").addEventListener("click", () => {
    composePhoto();
    setActivePanel("photoPanel");
  });

  els.photoInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      state.photo = image;
      state.photoName = file.name;
      els.photoName.textContent = file.name;
      composePhoto();
    };
    image.src = URL.createObjectURL(file);
  });

  document.querySelector("#clearPhotoButton").addEventListener("click", () => {
    state.photo = null;
    state.photoName = "";
    els.photoName.textContent = "未選択";
    els.photoInput.value = "";
    composePhoto();
  });

  els.boardPosition.addEventListener("change", composePhoto);
  els.boardScale.addEventListener("input", composePhoto);
  els.downloadLink.addEventListener("click", (event) => {
    if (els.downloadLink.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    rememberPhotoBookRecord();
  });

  els.shootBoardSelect.addEventListener("change", () => {
    const record = state.history.find((item) => item.id === els.shootBoardSelect.value);
    if (record) {
      copyFromRecord(record, null);
      composePhoto();
      return;
    }
    state.selectedBoardId = "";
    persistState();
  });

  els.editSelectedBoardButton.addEventListener("click", () => {
    const record = state.history.find((item) => item.id === els.shootBoardSelect.value);
    if (record) copyFromRecord(record, "inputPanel");
    else setActivePanel("inputPanel");
  });

  els.historyList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-record]");
    if (editButton) {
      const record = state.history.find((item) => item.id === editButton.dataset.editRecord);
      if (record) copyFromRecord(record, "inputPanel");
      return;
    }

    const useButton = event.target.closest("[data-use-record]");
    if (useButton) {
      const record = state.history.find((item) => item.id === useButton.dataset.useRecord);
      if (record) {
        copyFromRecord(record, null);
        composePhoto();
        setActivePanel("photoPanel");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-record]");
    if (!deleteButton) return;
    const record = state.history.find((item) => item.id === deleteButton.dataset.deleteRecord);
    if (!record || !confirm(`「${recordTitle(record)}」を削除しますか？`)) return;
    state.history = state.history.filter((item) => item.id !== record.id);
    if (state.selectedBoardId === record.id) state.selectedBoardId = "";
    if (state.editingBoardId === record.id) state.editingBoardId = "";
    renderAll();
    persistState();
  });

  document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
  els.exportProjectButton.addEventListener("click", exportProjectBundle);
  els.importProjectInput.addEventListener("change", (event) => importProjectBundle(event.target.files?.[0]));
  document.querySelector("#clearHistoryButton").addEventListener("click", () => {
    const projectName = state.board.projectName || "";
    const displayName = projectName || "この案件";
    if (!confirm(`${displayName} の保存した黒板をすべて削除しますか？`)) return;
    state.history = state.history.filter((record) => (record.projectName || "") !== projectName);
    state.selectedBoardId = "";
    state.editingBoardId = "";
    renderAll();
    persistState();
  });
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
