const gate = document.querySelector("#adminGate");
const gateForm = document.querySelector("#gateForm");
const gatePassword = document.querySelector("#gatePassword");
const gateStatus = document.querySelector("#gateStatus");
const adminPanel = document.querySelector("#adminPanel");
const adminPreviewPane = document.querySelector("#adminPreviewPane");
const preview = document.querySelector("#lecturePreview");
const statusBox = document.querySelector("#adminStatus");
const tabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
const panels = Array.from(document.querySelectorAll("[data-admin-panel]"));
const addForm = document.querySelector("#addForm");
const editForm = document.querySelector("#editForm");
const deleteForm = document.querySelector("#deleteForm");
const addFileInput = document.querySelector("#htmlFile");
const editFileInput = document.querySelector("#editHtmlFile");
const editLectureSelect = document.querySelector("#editLectureSelect");
const deleteLectureSelect = document.querySelector("#deleteLectureSelect");
const deleteSummary = document.querySelector("#deleteSummary");
const pullRequestList = document.querySelector("#pullRequestList");
const refreshPulls = document.querySelector("#refreshPulls");
const orderBoard = document.querySelector("#orderBoard");
const saveOrderButton = document.querySelector("#saveOrderButton");

let adminPassword = "";
let activeMode = "add";
let catalog = null;
let addHtmlContent = "";
let editHtmlContent = "";
let orderState = {};
let tagState = {
  add: [],
  edit: []
};

gateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = gatePassword.value;

  setGateStatus("Проверяю пароль...", "info");

  try {
    const response = await fetch("/api/admin/check-password", {
      method: "POST",
      headers: {
        "X-Admin-Password": password
      }
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Неверный пароль");
    }

    adminPassword = password;
    gate.hidden = true;
    adminPanel.hidden = false;
    adminPreviewPane.hidden = false;
    setGateStatus("", "");
    await loadAdminData();
  } catch (error) {
    setGateStatus(error.message, "error");
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.adminTab));
});

refreshPulls?.addEventListener("click", loadPullRequests);

addFileInput?.addEventListener("change", async () => {
  const file = addFileInput.files?.[0];
  addHtmlContent = file ? await file.text() : "";
  syncPreview();
});

editFileInput?.addEventListener("change", async () => {
  const file = editFileInput.files?.[0];
  editHtmlContent = file ? await file.text() : "";
});

addForm?.addEventListener("input", syncPreview);
editForm?.addEventListener("input", syncPreview);

addForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(addForm);
  const file = addFileInput.files?.[0];

  if (!file || !addHtmlContent) {
    setStatus("Выберите HTML-файл конспекта.", "error");
    return;
  }

  await submitAdminRequest("/api/admin/submit-lecture", {
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description"),
    tags: formData.get("tags"),
    status: formData.get("status"),
    filename: file.name,
    htmlContent: addHtmlContent
  }, "Создаю Pull Request...");

  addForm.reset();
  addHtmlContent = "";
  tagState.add = [];
  renderTags("add");
  syncPreview();
});

editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(editForm);

  if (!formData.get("href")) {
    setStatus("Выберите карточку для редактирования.", "error");
    return;
  }

  await submitAdminRequest("/api/admin/update-lecture", {
    courseId: formData.get("courseId"),
    href: formData.get("href"),
    title: formData.get("title"),
    description: formData.get("description"),
    tags: formData.get("tags"),
    status: formData.get("status"),
    htmlContent: editHtmlContent
  }, "Создаю PR на редактирование...");

  editHtmlContent = "";
  if (editFileInput) editFileInput.value = "";
});

deleteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selected = getSelectedLecture(deleteLectureSelect?.value);

  if (!selected) {
    setStatus("Выберите карточку для удаления.", "error");
    return;
  }

  await submitAdminRequest("/api/admin/delete-lecture", {
    courseId: selected.course.id,
    href: selected.lecture.href
  }, "Создаю PR на удаление...");
});

editLectureSelect?.addEventListener("change", () => {
  fillEditForm(editLectureSelect.value);
  syncPreview();
});

deleteLectureSelect?.addEventListener("change", () => {
  fillDeleteSummary(deleteLectureSelect.value);
  syncPreview();
});

saveOrderButton?.addEventListener("click", async () => {
  await submitAdminRequest("/api/admin/reorder-lectures", {
    orders: orderState
  }, "Создаю PR с новым порядком...");
});

setupTagEditor("add");
setupTagEditor("edit");

async function loadAdminData() {
  await Promise.all([loadCatalog(), loadPullRequests()]);
  populateLectureSelects();
  syncPreview();
}

async function loadCatalog() {
  const response = await fetch("data/lectures.json");
  if (!response.ok) throw new Error("Не удалось загрузить каталог");
  catalog = await response.json();
  buildOrderState();
}

async function loadPullRequests() {
  if (!pullRequestList) return;

  pullRequestList.textContent = "Загрузка...";

  try {
    const response = await fetch("/api/admin/pulls", {
      headers: {
        "X-Admin-Password": adminPassword
      }
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Не удалось загрузить PR");

    if (result.pulls.length === 0) {
      pullRequestList.innerHTML = `<div class="empty-state">Открытых PR нет.</div>`;
      return;
    }

    pullRequestList.innerHTML = result.pulls.map((pull) => `
      <a class="pr-item" href="${pull.url}" target="_blank" rel="noopener noreferrer">
        <span>#${pull.number}</span>
        <strong>${escapeHtml(pull.title)}</strong>
        <small>${escapeHtml(pull.branch)}</small>
      </a>
    `).join("");
  } catch (error) {
    pullRequestList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function populateLectureSelects() {
  const options = getAllLectures().map(({ course, lecture }) => {
    const key = makeLectureKey(course.id, lecture.href);
    return `<option value="${escapeHtml(key)}">${escapeHtml(course.shortTitle || course.title)} · ${escapeHtml(lecture.title)}</option>`;
  }).join("");

  const placeholder = `<option value="">Выберите конспект</option>`;
  if (editLectureSelect) editLectureSelect.innerHTML = placeholder + options;
  if (deleteLectureSelect) deleteLectureSelect.innerHTML = placeholder + options;
  renderOrderBoard();
}

function fillEditForm(key) {
  const selected = getSelectedLecture(key);
  if (!selected || !editForm) return;

  editForm.elements.courseTitle.value = selected.course.title;
  editForm.elements.courseId.value = selected.course.id;
  editForm.elements.href.value = selected.lecture.href;
  editForm.elements.status.value = selected.lecture.status || "published";
  editForm.elements.title.value = selected.lecture.title;
  editForm.elements.description.value = selected.lecture.description;
  tagState.edit = [...(selected.lecture.tags || [])];
  editHtmlContent = "";
  if (editFileInput) editFileInput.value = "";
  renderTags("edit");
}

function fillDeleteSummary(key) {
  const selected = getSelectedLecture(key);
  if (!deleteSummary) return;

  if (!selected) {
    deleteSummary.textContent = "Выберите карточку, которую нужно удалить.";
    return;
  }

  deleteSummary.innerHTML = `
    <strong>${escapeHtml(selected.lecture.title)}</strong>
    <span>${escapeHtml(selected.course.title)}</span>
    <code>${escapeHtml(selected.lecture.href)}</code>
  `;
}

async function submitAdminRequest(url, payload, pendingMessage) {
  setStatus(pendingMessage, "info");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Не удалось создать Pull Request");
    }

    setStatus(`Pull Request создан: ${result.prUrl}`, "success", result.prUrl);
    await loadPullRequests();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function setMode(mode) {
  activeMode = mode;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === mode));
  panels.forEach((panel) => {
    const isActive = panel.dataset.adminPanel === mode;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
  setStatus("", "");
  if (mode === "order") renderOrderBoard();
  syncPreview();
}

function syncPreview() {
  if (!preview) return;

  if (activeMode === "delete") {
    const selected = getSelectedLecture(deleteLectureSelect?.value);
    renderPreview(selected?.lecture, selected?.course, "DEL");
    return;
  }

  const form = activeMode === "edit" ? editForm : addForm;
  if (!form) return;

  const formData = new FormData(form);
  const selected = activeMode === "edit" ? getSelectedLecture(editLectureSelect?.value) : null;
  const lecture = {
    title: formData.get("title") || selected?.lecture.title || "Название конспекта",
    description: formData.get("description") || selected?.lecture.description || "Короткое описание появится здесь.",
    tags: tagState[activeMode].length > 0 ? tagState[activeMode] : ["tag"]
  };

  renderPreview(lecture, selected?.course, activeMode === "edit" ? "EDIT" : "PR");
}

function renderPreview(lecture, course, marker) {
  const current = lecture || {
    title: "Карточка не выбрана",
    description: "Выберите конспект, чтобы увидеть предпросмотр.",
    tags: ["empty"]
  };
  const tags = current.tags?.length ? current.tags : ["tag"];

  preview.innerHTML = `
    <div class="card-topline">
      <span class="lecture-index">${marker}</span>
    </div>
    <h3>${escapeHtml(current.title)}</h3>
    <p>${escapeHtml(current.description)}</p>
    <div class="tags">
      ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
    <span class="card-action card-action--disabled">${course ? escapeHtml(course.shortTitle || course.title) : "Предпросмотр карточки"}</span>
  `;
}

function setupTagEditor(scope) {
  const input = document.querySelector(`[data-tag-input="${scope}"]`);

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(scope, input.value);
    }

    if (event.key === "Backspace" && input.value === "" && tagState[scope].length > 0) {
      tagState[scope].pop();
      renderTags(scope);
    }
  });

  input?.addEventListener("blur", () => addTag(scope, input.value));
  renderTags(scope);
}

function addTag(scope, value) {
  const input = document.querySelector(`[data-tag-input="${scope}"]`);
  const tag = normalizeTag(value);

  if (!tag) {
    if (input) input.value = "";
    return;
  }

  if (!tagState[scope].includes(tag)) {
    tagState[scope].push(tag);
  }

  if (input) input.value = "";
  renderTags(scope);
}

function removeTag(scope, tag) {
  tagState[scope] = tagState[scope].filter((item) => item !== tag);
  renderTags(scope);
}

function renderTags(scope) {
  const value = document.querySelector(`[data-tags-value="${scope}"]`);
  const chips = document.querySelector(`[data-tag-chips="${scope}"]`);

  if (value) value.value = tagState[scope].join(", ");
  if (!chips) return;

  chips.innerHTML = tagState[scope].map((tag) => `
    <button class="tag-chip" type="button" data-tag="${escapeHtml(tag)}" aria-label="Удалить тег ${escapeHtml(tag)}">
      <span>${escapeHtml(tag)}</span>
      <span aria-hidden="true">×</span>
    </button>
  `).join("");

  chips.querySelectorAll(".tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeTag(scope, chip.dataset.tag));
  });

  syncPreview();
}

function getAllLectures() {
  return (catalog?.courses || []).flatMap((course) =>
    (course.items || []).map((lecture) => ({ course, lecture }))
  );
}

function buildOrderState() {
  orderState = Object.fromEntries((catalog?.courses || []).map((course) => [
    course.id,
    (course.items || []).map((lecture) => lecture.href)
  ]));
}

function renderOrderBoard() {
  if (!orderBoard || !catalog) return;

  orderBoard.innerHTML = catalog.courses.map((course) => {
    const itemsByHref = new Map((course.items || []).map((lecture) => [lecture.href, lecture]));
    const orderedItems = (orderState[course.id] || [])
      .map((href) => itemsByHref.get(href))
      .filter(Boolean);

    return `
      <section class="order-course" data-course-id="${escapeHtml(course.id)}">
        <div class="order-course__head">
          <strong>${escapeHtml(course.title)}</strong>
          <span>${orderedItems.length} конспектов</span>
        </div>
        <div class="order-list" data-order-list="${escapeHtml(course.id)}">
          ${orderedItems.length === 0 ? `<div class="empty-state">Пока нет конспектов.</div>` : orderedItems.map((lecture, index) => renderOrderItem(lecture, index)).join("")}
        </div>
      </section>
    `;
  }).join("");

  orderBoard.querySelectorAll(".order-item").forEach((item) => {
    item.addEventListener("dragstart", onOrderDragStart);
    item.addEventListener("dragover", onOrderDragOver);
    item.addEventListener("drop", onOrderDrop);
    item.addEventListener("dragend", onOrderDragEnd);
  });
}

function renderOrderItem(lecture, index) {
  return `
    <div class="order-item" draggable="true" data-href="${escapeHtml(lecture.href)}">
      <span class="order-index">${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(lecture.title)}</strong>
        <small>${escapeHtml(lecture.href)}</small>
      </div>
      <span class="order-handle" aria-hidden="true">⋮⋮</span>
    </div>
  `;
}

function onOrderDragStart(event) {
  event.currentTarget.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", event.currentTarget.dataset.href);
}

function onOrderDragOver(event) {
  event.preventDefault();
  const dragging = document.querySelector(".order-item.is-dragging");
  const target = event.currentTarget;
  if (!dragging || dragging === target) return;

  const rect = target.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  target.parentNode.insertBefore(dragging, after ? target.nextSibling : target);
}

function onOrderDrop(event) {
  event.preventDefault();
  const list = event.currentTarget.closest("[data-order-list]");
  if (!list) return;

  const courseId = list.dataset.orderList;
  orderState[courseId] = Array.from(list.querySelectorAll(".order-item")).map((item) => item.dataset.href);
  renderOrderBoard();
}

function onOrderDragEnd(event) {
  event.currentTarget.classList.remove("is-dragging");
}

function getSelectedLecture(key) {
  if (!key) return null;
  return getAllLectures().find(({ course, lecture }) => makeLectureKey(course.id, lecture.href) === key) || null;
}

function makeLectureKey(courseId, href) {
  return `${courseId}::${href}`;
}

function normalizeTag(value) {
  return String(value)
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function setGateStatus(message, type) {
  if (!gateStatus) return;
  gateStatus.className = type ? `admin-status admin-status--${type}` : "admin-status";
  gateStatus.textContent = message;
}

function setStatus(message, type, url) {
  if (!statusBox) return;

  statusBox.className = type ? `admin-status admin-status--${type}` : "admin-status";
  statusBox.innerHTML = url
    ? `${escapeHtml(message)}<br><a href="${url}" target="_blank" rel="noopener noreferrer">Открыть Pull Request</a>`
    : escapeHtml(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

setMode("add");
