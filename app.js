const cases = [];

const MODEL_ORDER = ["DK-110", "GM-X", "GM-I", "GM-H", "GM-T", "DK-80", "其他"];
const STORAGE_KEY = "printer_case_library_saved_cases";
const ADMIN_SESSION_KEY = "printer_case_library_admin_session";
const ADMIN_USERNAME_KEY = "printer_case_library_admin_username";
const ADMIN_PASSWORD_KEY = "printer_case_library_admin_password";
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {};
const ADMIN_LOGIN = window.ADMIN_LOGIN || {};
const SUPABASE_READY = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey && window.supabase);
const supabaseClient = SUPABASE_READY ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey) : null;

function normalizeModel(model) {
  return MODEL_ORDER.includes(model) ? model : "其他";
}

function loadSavedCases() {
  try {
    const savedCases = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(savedCases)) {
      cases.push(...savedCases.map((item) => ({ ...item, model: normalizeModel(item.model) })));
    }
  } catch (error) {
    console.warn("保存的案例读取失败", error);
  }
}

loadSavedCases();

const state = {
  model: "全部",
  keyword: "",
  selectedId: cases[0]?.id || null,
};

const icons = {
  printer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7V3h10v4"/><path d="M6 17H4a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>`,
  file: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-2.6z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
};

const modelFilters = document.querySelector("#modelFilters");
const caseList = document.querySelector("#caseList");
const caseDetail = document.querySelector("#caseDetail");
const searchInput = document.querySelector("#searchInput");
const resultCount = document.querySelector("#resultCount");
const toast = document.querySelector("#toast");
const caseModal = document.querySelector("#caseModal");
const caseForm = document.querySelector("#caseForm");
const caseFormTitle = document.querySelector("#caseFormTitle");
const saveCaseBtn = document.querySelector("#saveCaseBtn");
const adminModal = document.querySelector("#adminModal");
const adminForm = document.querySelector("#adminForm");
const confirmModal = document.querySelector("#confirmModal");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmCancelBtn = document.querySelector("#confirmCancelBtn");
const confirmOkBtn = document.querySelector("#confirmOkBtn");
const solutionItems = document.querySelector("#solutionItems");
const pendingFiles = {
  customer: [],
  solutions: {},
};
const imageModal = document.querySelector("#imageModal");
const imagePreview = document.querySelector("#imagePreview");
const shareModal = document.querySelector("#shareModal");
const shareLinkInput = document.querySelector("#shareLinkInput");
const shareMessageInput = document.querySelector("#shareMessageInput");
const openShareLink = document.querySelector("#openShareLink");
const adminLoginBtn = document.querySelector("#adminLoginBtn");
let shareType = "case";
let isSingleCaseView = false;
let isReadonlyView = false;
let isAdminLoggedIn = !SUPABASE_READY;
let solutionItemIndex = 0;
let editingCaseId = null;
let activeConfirmResolver = null;

function readLinkParams() {
  const params = new URLSearchParams(window.location.search);
  const caseId = Number(params.get("case"));
  if (cases.some((item) => item.id === caseId)) {
    state.selectedId = caseId;
  } else if (!state.selectedId && cases[0]) {
    state.selectedId = cases[0].id;
  }
  isSingleCaseView = params.get("view") === "single" && cases.some((item) => item.id === state.selectedId);
  isReadonlyView = isSingleCaseView || params.get("view") === "readonly";
  document.body.classList.toggle("single-case-view", isSingleCaseView);
  document.body.classList.toggle("readonly-view", isReadonlyView);
}

function prepareSingleCaseView() {
  document.querySelector(".sidebar")?.remove();
  document.querySelector(".topbar")?.remove();
  document.querySelector(".case-list-panel")?.remove();
  document.querySelector("#caseModal")?.remove();
  document.querySelector("#shareModal")?.remove();
  renderDetail();
}

function saveUserCases() {
  const userCases = cases.filter((item) => item.userCreated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userCases));
}

function rowToCase(row) {
  return {
    id: Number(row.id),
    title: row.title || "",
    model: normalizeModel(row.model),
    category: row.category || "未分类",
    level: row.level || "常见",
    problem: row.problem || "",
    summary: row.summary || row.problem || "",
    customer: row.customer || "",
    steps: row.steps || [],
    media: row.media || [],
    solutionMediaByStep: row.solution_media_by_step || [],
    solutionMedia: row.solution_media || [],
    userCreated: row.user_created !== false,
  };
}

function caseToRow(item) {
  return {
    id: item.id,
    title: item.title,
    model: normalizeModel(item.model),
    category: item.category || "未分类",
    level: item.level || "常见",
    problem: item.problem || "",
    summary: item.summary || item.problem || "",
    customer: item.customer || "",
    steps: item.steps || [],
    media: item.media || [],
    solution_media_by_step: item.solutionMediaByStep || [],
    solution_media: item.solutionMedia || [],
    user_created: item.userCreated !== false,
    updated_at: new Date().toISOString(),
  };
}

function safeFileName(name = "file") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "file";
}

function isCloudMode() {
  return SUPABASE_READY;
}

function canEditCases() {
  return !isReadonlyView && (!isCloudMode() || isAdminLoggedIn);
}

function updateAdminUi() {
  document.body.classList.toggle("cloud-view", isCloudMode());
  document.body.classList.toggle("guest-view", isCloudMode() && !isAdminLoggedIn);
  if (!adminLoginBtn) return;
  adminLoginBtn.hidden = !isCloudMode() || isReadonlyView;
  adminLoginBtn.textContent = isAdminLoggedIn ? "退出管理" : "管理员登录";
}

async function loadCloudCases() {
  if (!isCloudMode()) return;
  const { data, error } = await supabaseClient
    .from("printer_cases")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("云端案例读取失败", error);
    showToast("云端案例读取失败，请检查 Supabase 配置。");
    return;
  }

  cases.splice(0, cases.length, ...(data || []).map(rowToCase));
  state.selectedId = cases.some((item) => item.id === state.selectedId) ? state.selectedId : cases[0]?.id || null;
}

async function saveCaseToStorage(item) {
  if (!isCloudMode()) {
    saveUserCases();
    return;
  }

  const { error } = await supabaseClient.rpc("save_printer_case", {
    case_data: caseToRow(item),
    admin_username: sessionStorage.getItem(ADMIN_USERNAME_KEY) || "",
    admin_password: sessionStorage.getItem(ADMIN_PASSWORD_KEY) || "",
  });
  if (error) throw error;
}

async function deleteCaseFromStorage(caseId) {
  if (!isCloudMode()) {
    saveUserCases();
    return;
  }

  const { error } = await supabaseClient.rpc("delete_printer_case", {
    case_id: caseId,
    admin_username: sessionStorage.getItem(ADMIN_USERNAME_KEY) || "",
    admin_password: sessionStorage.getItem(ADMIN_PASSWORD_KEY) || "",
  });
  if (error) throw error;
}

async function refreshSession() {
  isAdminLoggedIn =
    !isCloudMode() ||
    (localStorage.getItem(ADMIN_SESSION_KEY) === "1" &&
      Boolean(sessionStorage.getItem(ADMIN_USERNAME_KEY)) &&
      Boolean(sessionStorage.getItem(ADMIN_PASSWORD_KEY)));
  updateAdminUi();
}

async function checkAdminPassword(username, password) {
  if (!isCloudMode()) return true;
  if (!ADMIN_LOGIN.username || username !== ADMIN_LOGIN.username) return false;

  const { data, error } = await supabaseClient.rpc("verify_admin_login", {
    admin_username: username,
    admin_password: password,
  });

  if (error) {
    console.warn("管理员账号验证失败", error);
    return false;
  }

  return data === true;
}

function parseStepLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawTitle, ...rest] = line.split(/[:：]/);
      const title = rawTitle.trim() || "处理步骤";
      const desc = rest.join("：").trim() || "按现场情况处理并记录结果。";
      return [title, desc];
    });
}

function getStepParts(step, index) {
  if (Array.isArray(step)) {
    if (/^方案\s*\d+$/.test(step[0] || "") && step[1]) {
      return [step[1], ""];
    }

    return [step[0] || `方案 ${index + 1}`, step[1] || ""];
  }

  if (step && typeof step === "object") {
    if (/^方案\s*\d+$/.test(step.title || "") && (step.desc || step.text)) {
      return [step.desc || step.text, ""];
    }

    return [step.title || `方案 ${index + 1}`, step.desc || step.text || ""];
  }

  return [`方案 ${index + 1}`, String(step || "")];
}

function parseSolutionText(text, index) {
  const cleanText = text.trim();
  const [rawTitle, ...rest] = cleanText.split(/[:：]/);

  if (rest.length) {
    return [rawTitle.trim() || `方案 ${index + 1}`, rest.join("：").trim() || "按现场情况处理并记录结果。"];
  }

  return [cleanText, ""];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        type: file.type.startsWith("video/") ? "video" : "image",
        title: file.name,
        desc: file.type.startsWith("video/") ? "上传的视频资料" : "上传的图片资料",
        fileName: file.name,
        src: reader.result,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFileAsMedia(file) {
  return readFileAsDataUrl(file);
}

async function readFilesAsMedia(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(
    files.map((file) => {
      if (file && file.src) return file;
      return uploadFileAsMedia(file);
    })
  );
}

function validMediaFiles(files) {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
}

function getFileListElement(zoneType, solutionId) {
  if (zoneType === "customer") return document.querySelector("#customerFileList");
  return document.querySelector(`[data-solution-id="${solutionId}"]`)?.querySelector(".file-list");
}

function getPendingFiles(zoneType, solutionId) {
  if (zoneType === "customer") return pendingFiles.customer;
  return pendingFiles.solutions[solutionId] || [];
}

function mediaDisplayName(file) {
  return file?.name || file?.fileName || file?.title || "已上传文件";
}

function filePreviewSrc(file) {
  if (!file) return "";
  if (file.src) return file.src;
  if (!file.previewUrl) {
    file.previewUrl = URL.createObjectURL(file);
  }
  return file.previewUrl;
}

function renderFilePreview(file) {
  const src = filePreviewSrc(file);
  const name = mediaDisplayName(file);
  const type = file?.type || "";

  if (type.startsWith("video/") || file?.type === "video") {
    return `<video class="file-preview-media" src="${src}" controls muted></video>`;
  }

  return `<img class="file-preview-media zoomable-image" src="${src}" alt="${name}" title="点击放大" />`;
}

function setPendingFiles(zoneType, solutionId, files) {
  if (zoneType === "customer") {
    pendingFiles.customer = files;
    return;
  }

  pendingFiles.solutions[solutionId] = files;
}

function updateFileList(zoneType, solutionId) {
  const list = getFileListElement(zoneType, solutionId);
  if (!list) return;

  const files = getPendingFiles(zoneType, solutionId);

  if (!files.length) {
    list.textContent = "";
    return;
  }

  list.innerHTML = files
    .map(
      (file, index) => `
        <span class="file-preview-row">
          <div class="file-preview-card">
            ${renderFilePreview(file)}
          </div>
          <button type="button" data-remove-file="${zoneType}" data-solution-id="${solutionId || ""}" data-file-index="${index}">移除</button>
        </span>
      `
    )
    .join("");
}

function addFilesToZone(zone, files) {
  const mediaFiles = validMediaFiles(files);
  if (!mediaFiles.length) {
    showToast("这里只支持图片或视频文件。");
    return;
  }

  const zoneType = typeof zone === "string" ? zone : zone.dataset.fileZone;
  const solutionId = typeof zone === "string" ? "" : zone.dataset.solutionId;

  if (zoneType === "solution") {
    setPendingFiles(zoneType, solutionId, [mediaFiles[0]]);
    updateFileList(zoneType, solutionId);
    showToast("已添加 1 个文件。每条排查方案先放 1 个图片或视频。");
    return;
  }

  pendingFiles.customer.push(...mediaFiles);
  updateFileList(zoneType, solutionId);
  showToast(`已添加 ${mediaFiles.length} 个文件。`);
}

function resetPendingFiles() {
  pendingFiles.customer = [];
  pendingFiles.solutions = {};
  updateFileList("customer");
}

function setupDropZone(zone) {
  if (!zone || zone.dataset.bound === "true") return;
  zone.dataset.bound = "true";

  const input = zone.querySelector("input[type='file']");

  zone.addEventListener("click", () => {
    input.click();
  });

  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  input.addEventListener("change", () => {
    addFilesToZone(zone, input.files);
    input.value = "";
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("drag-over");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");
    addFilesToZone(zone, event.dataTransfer.files);
  });

  zone.addEventListener("paste", (event) => {
    addFilesToZone(zone, event.clipboardData.files);
  });
}

function addSolutionItem(text = "", mediaFiles = []) {
  const id = `solution-${Date.now()}-${solutionItemIndex}`;
  solutionItemIndex += 1;
  pendingFiles.solutions[id] = [...mediaFiles];

  const item = document.createElement("div");
  item.className = "solution-form-item";
  item.dataset.solutionId = id;
  item.innerHTML = `
    <div class="solution-form-head">
      <strong>方案 ${solutionItems.children.length + 1}</strong>
      <button type="button" data-remove-solution="${id}">删除</button>
    </div>
    <label>
      <span>方案说明</span>
      <textarea class="solution-text" required>${text}</textarea>
    </label>
    <div class="file-field">
      <span>方案图片/视频</span>
      <div class="drop-zone compact-zone" data-file-zone="solution" data-solution-id="${id}" tabindex="0">
        <input type="file" accept="image/*,video/*" />
        <strong>拖入图片/视频，或点这里选择</strong>
        <small>也可以复制截图后，点一下这里再粘贴。</small>
      </div>
      <div class="file-list"></div>
    </div>
  `;

  solutionItems.appendChild(item);
  setupDropZone(item.querySelector(".drop-zone"));
  updateFileList("solution", id);
  refreshSolutionNumbers();
  return item;
}

function refreshSolutionNumbers() {
  solutionItems.querySelectorAll(".solution-form-item").forEach((item, index) => {
    item.querySelector(".solution-form-head strong").textContent = `方案 ${index + 1}`;
    item.querySelector("[data-remove-solution]").hidden = solutionItems.children.length <= 1;
  });
}

function resetSolutionItems() {
  solutionItems.innerHTML = "";
  addSolutionItem();
}

function getSolutionTextForForm(step, index) {
  const [title, desc] = getStepParts(step, index);
  return desc ? `${title}：${desc}` : title;
}

function getSolutionMediaForForm(item, index) {
  if (Array.isArray(item.solutionMediaByStep)) {
    return item.solutionMediaByStep[index] || [];
  }

  if (Array.isArray(item.solutionMedia) && item.solutionMedia[index]) {
    return [item.solutionMedia[index]];
  }

  return [];
}

async function collectSolutionItems() {
  const formItems = Array.from(solutionItems.querySelectorAll(".solution-form-item"));
  const collected = await Promise.all(
    formItems.map(async (item, index) => {
      const text = item.querySelector(".solution-text").value.trim();
      const solutionId = item.dataset.solutionId;
      const media = await readFilesAsMedia(pendingFiles.solutions[solutionId] || []);
      const [title, desc] = parseSolutionText(text, index);
      return { text, title, desc, media };
    })
  );

  return collected.filter((item) => item.text || item.media.length);
}

function fillCaseFormForEdit(item) {
  caseForm.elements.title.value = item.title || "";
  caseForm.elements.model.value = normalizeModel(item.model);
  caseForm.elements.level.value = item.level || "常见";
  caseForm.elements.problem.value = item.problem || item.summary || cleanCustomerText(item.customer);

  pendingFiles.customer = [...(item.media || [])];
  updateFileList("customer");

  solutionItems.innerHTML = "";
  pendingFiles.solutions = {};

  const steps = item.steps?.length ? item.steps : [["", ""]];
  steps.forEach((step, index) => {
    addSolutionItem(getSolutionTextForForm(step, index), getSolutionMediaForForm(item, index));
  });
}

function openCaseModal(item = null) {
  if (!canEditCases()) return;
  caseForm.reset();
  resetPendingFiles();
  resetSolutionItems();
  editingCaseId = item?.id || null;
  caseFormTitle.textContent = editingCaseId ? "编辑案例" : "新增案例";
  saveCaseBtn.textContent = editingCaseId ? "保存修改" : "保存案例";
  if (item) {
    fillCaseFormForEdit(item);
  }
  caseModal.classList.add("show");
  caseModal.setAttribute("aria-hidden", "false");
  caseForm.elements.title.focus();
}

function closeCaseModal() {
  caseModal.classList.remove("show");
  caseModal.setAttribute("aria-hidden", "true");
}

function caseFormHasContent() {
  if (!isModalOpen(caseModal)) return false;

  const hasText = ["title", "problem"].some((name) => caseForm.elements[name]?.value.trim());
  const hasSolutions = Array.from(solutionItems.querySelectorAll(".solution-text")).some((item) => item.value.trim());
  const hasCustomerFiles = pendingFiles.customer.length > 0;
  const hasSolutionFiles = Object.values(pendingFiles.solutions).some((files) => files.length > 0);

  return hasText || hasSolutions || hasCustomerFiles || hasSolutionFiles;
}

async function requestCloseCaseModal() {
  if (!isModalOpen(caseModal)) return;

  if (caseFormHasContent()) {
    const confirmed = await showConfirmModal("确定要关闭吗？");
    if (!confirmed) return;
  }

  closeCaseModal();
}

function openAdminModal() {
  adminForm.reset();
  adminModal.classList.add("show");
  adminModal.setAttribute("aria-hidden", "false");
  adminForm.elements.username.focus();
}

function closeAdminModal() {
  adminModal.classList.remove("show");
  adminModal.setAttribute("aria-hidden", "true");
}

function buildCaseFromForm(id, existingCase = {}) {
  const formData = new FormData(caseForm);
  const title = formData.get("title").trim();
  const problem = formData.get("problem").trim();

  return {
    ...existingCase,
    id,
    title,
    model: formData.get("model").trim(),
    category: existingCase.category || "未分类",
    level: formData.get("level"),
    problem,
    summary: problem,
    customer: "",
    userCreated: true,
  };
}

async function saveCaseFromForm() {
  if (!canEditCases()) return;
  const customerMedia = await readFilesAsMedia(pendingFiles.customer);
  const solutionRecords = await collectSolutionItems();

  if (!solutionRecords.length) {
    showToast("请至少填写一条排查方案。");
    return;
  }

  const caseId = editingCaseId || Date.now();
  const caseIndex = cases.findIndex((item) => item.id === caseId);
  const oldCase = caseIndex >= 0 ? cases[caseIndex] : {};
  const savedCase = {
    ...buildCaseFromForm(caseId, oldCase),
    media: customerMedia,
    steps: solutionRecords.map((item) => [item.title, item.desc]),
    solutionMediaByStep: solutionRecords.map((item) => item.media),
    solutionMedia: solutionRecords.flatMap((item) => item.media),
  };

  if (editingCaseId && caseIndex >= 0) {
    cases[caseIndex] = savedCase;
  } else {
    cases.push(savedCase);
  }

  try {
    await saveCaseToStorage(savedCase);
  } catch (error) {
    if (editingCaseId && caseIndex >= 0) {
      cases[caseIndex] = oldCase;
    } else {
      cases.pop();
    }
    console.warn("案例保存失败", error);
    showToast(isCloudMode() ? "云端保存失败，请确认已管理员登录。" : "保存失败，图片或视频可能太大。请先用小文件测试。");
    return;
  }

  state.model = "全部";
  state.keyword = "";
  state.selectedId = savedCase.id;
  searchInput.value = "";
  renderFilters();
  renderCaseList();
  updateAddressForSelectedCase();
  closeCaseModal();
  resetPendingFiles();
  showToast(editingCaseId ? "案例已修改。" : "新案例已保存。");
  editingCaseId = null;
}

function uniqueValues(key) {
  if (key === "model") return ["全部", ...MODEL_ORDER];
  return ["全部", ...new Set(cases.map((item) => item[key]))];
}

function countBy(key, value) {
  if (value === "全部") return cases.length;
  return cases.filter((item) => item[key] === value).length;
}

function renderFilters() {
  modelFilters.innerHTML = uniqueValues("model")
    .map(
      (name) => `
        <button class="filter-pill ${state.model === name ? "active" : ""}" type="button" data-filter="model" data-value="${name}">
          <span>${name}</span>
        </button>
      `
    )
    .join("");
}

function getFilteredCases() {
  const keyword = state.keyword.trim().toLowerCase();
  return cases.filter((item) => {
    const matchModel = state.model === "全部" || item.model === state.model;
    const stepText = (item.steps || []).map((step, index) => getStepParts(step, index).join(" ")).join(" ");
    const text = `${item.title} ${item.model} ${item.category} ${item.summary} ${item.problem || ""} ${item.customer} ${stepText}`.toLowerCase();
    const matchKeyword = !keyword || text.includes(keyword);
    return matchModel && matchKeyword;
  });
}

function renderCaseList() {
  const filtered = getFilteredCases();
  resultCount.textContent = `${filtered.length} 条`;

  if (!filtered.length) {
    if (!cases.length) {
      caseList.innerHTML = `<div class="empty">还没有案例，点右上角“新增案例”开始录入。</div>`;
      caseDetail.innerHTML = `<div class="empty">暂无案例。新增后，这里会显示案例详情。</div>`;
    } else {
      caseList.innerHTML = `<div class="empty">没有找到对应案例，可以换个关键词试试。</div>`;
      caseDetail.innerHTML = `<div class="empty">左侧没有匹配案例，清空筛选后再查看详情。</div>`;
    }
    return;
  }

  if (!filtered.some((item) => item.id === state.selectedId)) {
    state.selectedId = filtered[0].id;
  }

  caseList.innerHTML = filtered
    .map(
      (item) => `
        <button class="case-item ${state.selectedId === item.id ? "active" : ""}" type="button" data-id="${item.id}">
          <span>
            <h3>${item.title}</h3>
            <p>${item.problem || item.summary}</p>
            <span class="tags">
              <span class="tag">${item.model}</span>
              <span class="tag warn">${item.category}</span>
              <span class="tag ${item.level === "高频" ? "danger" : ""}">${item.level}</span>
            </span>
          </span>
        </button>
      `
    )
    .join("");

  renderDetail();
}

function mediaIcon(type) {
  if (type === "video") return `${icons.play}`;
  if (type === "image") return `${icons.image}`;
  if (type === "text") return `${icons.file}`;
  return `${icons.image}`;
}

function cleanCustomerText(text) {
  return (text || "").replace(/^客户现象[:：]/, "");
}

function renderMediaPreview(media) {
  if (media.src && media.type === "image") {
    return `<img class="uploaded-media zoomable-image" src="${media.src}" alt="${media.title}" title="点击放大" />`;
  }

  if (media.src && media.type === "video") {
    return `<video class="uploaded-media" src="${media.src}" controls></video>`;
  }

  return `<div class="media-preview ${media.type === "video" ? "video" : ""}">${mediaIcon(media.type)}</div>`;
}

function renderMediaGrid(mediaList) {
  if (!mediaList || !mediaList.length) {
    return `<p class="muted-line">暂无图片或视频资料。</p>`;
  }

  return `
    <div class="media-grid">
      ${mediaList
        .map(
          (media) => `
            <div class="media-box ${media.src ? "media-only" : ""}">
              ${renderMediaPreview(media)}
              ${media.src ? "" : `<strong>${media.title}</strong><span>${media.desc}</span>`}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderStepMedia(mediaList) {
  if (!mediaList || !mediaList.length) return "";
  return `<div class="step-media">${renderMediaGrid(mediaList)}</div>`;
}

function renderDetail() {
  const item = cases.find((caseItem) => caseItem.id === state.selectedId);
  if (!item) return;

  const hasStepMedia = Array.isArray(item.solutionMediaByStep) && item.solutionMediaByStep.some((mediaList) => mediaList?.length);

  caseDetail.innerHTML = `
    <div class="detail-cover">
      <div>
        <div class="meta-row">
          <span class="status">${item.model}</span>
          <span class="status">${item.category}</span>
          <span class="status">${item.level}</span>
        </div>
        <h2>${item.title}</h2>
        <p><span>问题描述：</span>${item.problem || item.summary || cleanCustomerText(item.customer)}</p>
      </div>
      ${
        item.userCreated && canEditCases()
          ? `<div class="detail-actions">
              <button class="icon-button secondary edit-case-button" type="button" data-edit-case="${item.id}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                编辑案例
              </button>
              <button class="icon-button secondary delete-case-button" type="button" data-delete-case="${item.id}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
                删除案例
              </button>
            </div>`
          : ""
      }
    </div>

    <div class="detail-body">
      <section>
        <div class="section-title">
          ${icons.alert}
          <h3>问题现象</h3>
        </div>
        ${renderMediaGrid(item.media)}
      </section>

      <section>
        <div class="section-title">
          ${icons.wrench}
          <h3>对应处理方案</h3>
        </div>
        <div class="steps">
          ${(item.steps || [])
            .map(
              (step, index) => {
                const [title, desc] = getStepParts(step, index);
                const stepMedia = item.solutionMediaByStep?.[index] || [];

                return `
                <div class="step">
                  <div>
                    <strong>${title}</strong>
                    ${desc ? `<p>${desc}</p>` : ""}
                    ${renderStepMedia(stepMedia)}
                  </div>
                </div>
              `;
              }
            )
            .join("")}
        </div>
        ${hasStepMedia ? "" : renderMediaGrid(item.solutionMedia)}
      </section>
    </div>
  `;
}

function currentBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function getShareLink(type = shareType) {
  const url = new URL(currentBaseUrl());
  if (type === "case" && state.selectedId) {
    url.searchParams.set("case", state.selectedId);
    url.searchParams.set("view", "single");
  } else {
    url.searchParams.set("view", "readonly");
  }
  return url.toString();
}

function getSelectedCase() {
  return cases.find((item) => item.id === state.selectedId) || cases[0] || null;
}

function buildShareMessage(type = shareType) {
  const link = getShareLink(type);

  if (type === "all") {
    return [
      "《打印机故障案例》",
      `查看链接：${link}`,
    ].join("\n");
  }

  const item = getSelectedCase();
  if (!item) {
    return ["打印机售后案例库", "目前还没有案例。", link].join("\n");
  }

  return [
    `《${item.title}》`,
    link,
  ].join("\n");
}

function updateShareLink() {
  const link = getShareLink();
  shareLinkInput.value = link;
  shareMessageInput.value = buildShareMessage();
  openShareLink.href = link;
}

function updateAddressForSelectedCase() {
  if (!window.history || new URLSearchParams(window.location.search).get("export") === "1") return;
  if (isSingleCaseView || isReadonlyView) return;
  const url = new URL(currentBaseUrl());
  if (state.selectedId) {
    url.searchParams.set("case", state.selectedId);
  }
  window.history.replaceState({}, "", url);
}

function openShareModal() {
  if (!cases.length) {
    showToast("还没有案例，先新增案例后再生成链接。");
    return;
  }
  updateShareLink();
  shareModal.classList.add("show");
  shareModal.setAttribute("aria-hidden", "false");
  shareMessageInput.focus();
  shareMessageInput.select();
}

function closeShareModal() {
  shareModal.classList.remove("show");
  shareModal.setAttribute("aria-hidden", "true");
}

function openImageModal(src, alt) {
  imagePreview.src = src;
  imagePreview.alt = alt || "图片预览";
  imageModal.classList.add("show");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  imageModal.classList.remove("show");
  imageModal.setAttribute("aria-hidden", "true");
  imagePreview.removeAttribute("src");
}

function isModalOpen(modal) {
  return modal?.classList.contains("show");
}

function closeConfirmModal(result = false) {
  confirmModal.classList.remove("show");
  confirmModal.setAttribute("aria-hidden", "true");
  if (activeConfirmResolver) {
    activeConfirmResolver(result);
    activeConfirmResolver = null;
  }
}

function showConfirmModal(message) {
  confirmMessage.textContent = message;
  confirmModal.classList.add("show");
  confirmModal.setAttribute("aria-hidden", "false");
  confirmCancelBtn.focus();

  return new Promise((resolve) => {
    activeConfirmResolver = resolve;
  });
}

async function copyShareLink() {
  updateShareLink();
  shareMessageInput.select();
  const message = shareMessageInput.value;

  try {
    await navigator.clipboard.writeText(message);
    showToast("发送内容已复制，里面包含案例说明和查看链接。");
  } catch (error) {
    document.execCommand("copy");
    showToast("发送内容已复制。如果对方打不开，需要先把网页放到线上。");
  }
}

function isImageMedia(media) {
  return media?.type === "image" || media?.type === "photo";
}

function isVideoMedia(media) {
  return media?.type === "video";
}

function renderPrintMedia(mediaList) {
  const printableList = (mediaList || []).filter((media) => isImageMedia(media) || isVideoMedia(media));
  if (!printableList.length) return "";

  return `
    <div class="print-media">
      ${printableList
        .map((media) => {
          if (media.src) {
            if (isVideoMedia(media)) {
              return `<div class="print-video-placeholder">《视频》</div>`;
            }

            return `
              <figure>
                <img src="${media.src}" alt="${media.title || "案例图片"}" />
                ${media.title ? `<figcaption>${media.title}</figcaption>` : ""}
              </figure>
            `;
          }

          if (isVideoMedia(media)) {
            return `<div class="print-video-placeholder">《视频》</div>`;
          }

          return `
            <div>
              <strong>${media.title}</strong>
              <span>图片</span>
              <p>${media.desc || ""}</p>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildExportHtml() {
  const exportDate = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const caseCards = cases
    .map(
      (item) => `
        <article class="print-case">
          <header class="print-case-head">
            <div>
              <p>${item.model} / ${item.category} / ${item.level}</p>
              <h2>${item.title}</h2>
            </div>
          </header>

          <section>
            <h3>问题现象</h3>
            <p>${item.customer}</p>
            <p>${item.summary}</p>
          </section>

          <section>
            <h3>问题现象资料</h3>
            ${renderPrintMedia(item.media)}
          </section>

          <section>
            <h3>处理方案</h3>
            <ol>
              ${(item.steps || [])
                .map((step, index) => {
                  const [title, desc] = getStepParts(step, index);
                  return `
                    <li>
                      <strong>${title}</strong>
                      ${desc ? `<p>${desc}</p>` : ""}
                      ${renderPrintMedia(item.solutionMediaByStep?.[index] || [])}
                    </li>
                  `;
                })
                .join("")}
            </ol>
          </section>
        </article>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>打印机售后案例库导出</title>
        <link rel="stylesheet" href="styles.css" />
      </head>
      <body class="print-page">
        <main class="print-wrap">
          <header class="print-title">
            <p>打印机售后案例库</p>
            <h1>全部案例导出</h1>
            <span>共 ${cases.length} 条案例 / 导出时间：${exportDate}</span>
          </header>
          ${caseCards}
        </main>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => window.print(), 300);
          });
        </script>
      </body>
    </html>
  `;
}

function exportPdf() {
  if (!cases.length) {
    showToast("还没有案例，先新增案例后再导出 PDF。");
    return;
  }

  const exportWindow = window.open("", "_blank");
  if (!exportWindow) {
    showToast("浏览器拦截了新窗口，请允许弹出窗口后再点一次导出。");
    return;
  }

  exportWindow.document.open();
  exportWindow.document.write(buildExportHtml());
  exportWindow.document.close();
  showToast("已打开导出版页面。在弹出的打印窗口里选择 WPS PDF 或“存为 PDF”即可。");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

async function deleteCaseById(caseId) {
  if (!canEditCases()) return;
  const caseIndex = cases.findIndex((item) => item.id === caseId);
  const item = cases[caseIndex];
  if (caseIndex < 0 || !item?.userCreated) return;

  const confirmed = window.confirm(`确定删除这个案例吗？\n\n${item.title}`);
  if (!confirmed) return;

  cases.splice(caseIndex, 1);
  try {
    await deleteCaseFromStorage(caseId);
  } catch (error) {
    cases.splice(caseIndex, 0, item);
    console.warn("案例删除失败", error);
    showToast("删除失败，请确认已管理员登录。");
    return;
  }

  const filtered = getFilteredCases();
  state.selectedId = filtered[0]?.id || cases[0]?.id;
  renderFilters();
  renderCaseList();
  updateAddressForSelectedCase();
  showToast("案例已删除。");
}

document.addEventListener("click", (event) => {
  const zoomImage = event.target.closest(".zoomable-image");
  if (zoomImage) {
    openImageModal(zoomImage.src, zoomImage.alt);
    return;
  }

  const removeButton = event.target.closest("[data-remove-file]");
  if (removeButton) {
    const zoneType = removeButton.dataset.removeFile;
    const solutionId = removeButton.dataset.solutionId;
    const index = Number(removeButton.dataset.fileIndex);
    const files = getPendingFiles(zoneType, solutionId);
    files.splice(index, 1);
    setPendingFiles(zoneType, solutionId, files);
    updateFileList(zoneType, solutionId);
    return;
  }

  const removeSolutionButton = event.target.closest("[data-remove-solution]");
  if (removeSolutionButton) {
    const solutionId = removeSolutionButton.dataset.removeSolution;
    const item = removeSolutionButton.closest(".solution-form-item");
    if (item && solutionItems.children.length > 1) {
      delete pendingFiles.solutions[solutionId];
      item.remove();
      refreshSolutionNumbers();
    }
    return;
  }

  const editButton = event.target.closest("[data-edit-case]");
  if (editButton) {
    if (!canEditCases()) return;
    const item = cases.find((caseItem) => caseItem.id === Number(editButton.dataset.editCase));
    if (item?.userCreated) {
      openCaseModal(item);
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-case]");
  if (deleteButton) {
    if (!canEditCases()) return;
    deleteCaseById(Number(deleteButton.dataset.deleteCase));
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    state[filterButton.dataset.filter] = filterButton.dataset.value;
    renderFilters();
    renderCaseList();
  }

  const caseButton = event.target.closest("[data-id]");
  if (caseButton) {
    state.selectedId = Number(caseButton.dataset.id);
    updateAddressForSelectedCase();
    renderCaseList();
  }
});

document.querySelectorAll(".drop-zone").forEach((zone) => setupDropZone(zone));

searchInput.addEventListener("input", (event) => {
  state.keyword = event.target.value;
  renderCaseList();
});

document.querySelector("#addCaseBtn").addEventListener("click", () => {
  if (!canEditCases()) return;
  openCaseModal();
});

adminLoginBtn?.addEventListener("click", async () => {
  if (!isCloudMode()) {
    showToast("还没有填写 Supabase 配置，当前是本机保存模式。");
    return;
  }

  if (isAdminLoggedIn) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_USERNAME_KEY);
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    isAdminLoggedIn = false;
    updateAdminUi();
    renderCaseList();
    showToast("已退出管理。");
    return;
  }

  openAdminModal();
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = adminForm.elements.username.value.trim();
  const password = adminForm.elements.password.value;
  const passed = await checkAdminPassword(username.trim(), password);
  if (!passed) {
    showToast("账号或密码不对。");
    return;
  }

  localStorage.setItem(ADMIN_SESSION_KEY, "1");
  sessionStorage.setItem(ADMIN_USERNAME_KEY, username.trim());
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
  isAdminLoggedIn = true;
  updateAdminUi();
  renderCaseList();
  closeAdminModal();
  showToast("已进入管理模式。");
});

document.querySelector("#closeAdminBtn").addEventListener("click", () => {
  closeAdminModal();
});

document.querySelector("#closeCaseBtn").addEventListener("click", () => {
  requestCloseCaseModal();
});

document.querySelector("#addSolutionBtn").addEventListener("click", () => {
  addSolutionItem();
  solutionItems.lastElementChild?.querySelector(".solution-text")?.focus();
});

caseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCaseFromForm();
});

adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) {
    closeAdminModal();
  }
});

document.querySelector("#shareBtn").addEventListener("click", () => {
  openShareModal();
});

document.querySelector("#closeShareBtn").addEventListener("click", () => {
  closeShareModal();
});

document.querySelector("#closeImageBtn").addEventListener("click", () => {
  closeImageModal();
});

confirmCancelBtn.addEventListener("click", () => {
  closeConfirmModal(false);
});

confirmOkBtn.addEventListener("click", () => {
  closeConfirmModal(true);
});

document.querySelector("#copyShareBtn").addEventListener("click", () => {
  copyShareLink();
});

shareModal.addEventListener("click", (event) => {
  if (event.target === shareModal) {
    closeShareModal();
  }
});

imageModal.addEventListener("click", (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isModalOpen(confirmModal)) {
      closeConfirmModal(false);
      return;
    }

    if (isModalOpen(imageModal)) {
      closeImageModal();
      return;
    }

    requestCloseCaseModal();
    closeShareModal();
    closeAdminModal();
  }
});

document.querySelectorAll("[data-share-type]").forEach((button) => {
  button.addEventListener("click", () => {
    shareType = button.dataset.shareType;
    document.querySelectorAll("[data-share-type]").forEach((item) => item.classList.toggle("active", item === button));
    updateShareLink();
    shareMessageInput.focus();
    shareMessageInput.select();
  });
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  exportPdf();
});

if (new URLSearchParams(window.location.search).get("export") === "1") {
  document.open();
  document.write(buildExportHtml());
  document.close();
} else {
  startApp();
}

async function startApp() {
  await refreshSession();

  if (isCloudMode()) {
    await loadCloudCases();
  }

  readLinkParams();
  updateAdminUi();

  if (isSingleCaseView) {
    prepareSingleCaseView();
  } else {
    renderFilters();
    renderCaseList();
    updateAddressForSelectedCase();
  }
}
