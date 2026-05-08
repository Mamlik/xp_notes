const gate = document.querySelector("#adminGate");
const gateForm = document.querySelector("#gateForm");
const gatePassword = document.querySelector("#gatePassword");
const gateStatus = document.querySelector("#gateStatus");
const adminPanel = document.querySelector("#adminPanel");
const adminPreviewPane = document.querySelector("#adminPreviewPane");
const form = document.querySelector("#lectureForm");
const fileInput = document.querySelector("#htmlFile");
const preview = document.querySelector("#lecturePreview");
const statusBox = document.querySelector("#adminStatus");
const tagsValue = document.querySelector("#tagsValue");
const tagInput = document.querySelector("#tagInput");
const tagChips = document.querySelector("#tagChips");

let htmlContent = "";
let adminPassword = "";
let tags = [];

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
  } catch (error) {
    setGateStatus(error.message, "error");
  }
});

fileInput?.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    htmlContent = "";
    return;
  }

  htmlContent = await file.text();
  syncPreview();
});

form?.addEventListener("input", syncPreview);

tagInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addTag(tagInput.value);
  }

  if (event.key === "Backspace" && tagInput.value === "" && tags.length > 0) {
    tags.pop();
    renderTags();
  }
});

tagInput?.addEventListener("blur", () => {
  addTag(tagInput.value);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Отправляю заявку в GitHub...", "info");

  const formData = new FormData(form);
  const file = fileInput.files?.[0];

  if (!file || !htmlContent) {
    setStatus("Выберите HTML-файл конспекта.", "error");
    return;
  }

  const payload = {
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description"),
    tags: formData.get("tags"),
    status: formData.get("status"),
    filename: file.name,
    htmlContent
  };

  try {
    const response = await fetch("/api/admin/submit-lecture", {
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
    form.reset();
    tags = [];
    htmlContent = "";
    renderTags();
    syncPreview();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

function setGateStatus(message, type) {
  if (!gateStatus) return;
  gateStatus.className = type ? `admin-status admin-status--${type}` : "admin-status";
  gateStatus.textContent = message;
}

function syncPreview() {
  if (!preview || !form) return;

  const formData = new FormData(form);
  const title = formData.get("title") || "Название конспекта";
  const description = formData.get("description") || "Короткое описание появится здесь.";
  const previewTags = tags.length > 0 ? tags : ["tag"];

  preview.innerHTML = `
    <div class="card-topline">
      <span class="lecture-index">PR</span>
    </div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    <div class="tags">
      ${previewTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
    <span class="card-action card-action--disabled">Предпросмотр карточки</span>
  `;
}

function addTag(value) {
  const tag = normalizeTag(value);
  if (!tag) {
    if (tagInput) tagInput.value = "";
    return;
  }

  if (!tags.includes(tag)) {
    tags.push(tag);
  }

  if (tagInput) tagInput.value = "";
  renderTags();
}

function removeTag(tag) {
  tags = tags.filter((item) => item !== tag);
  renderTags();
}

function renderTags() {
  if (tagsValue) tagsValue.value = tags.join(", ");
  if (!tagChips) return;

  tagChips.innerHTML = tags
    .map((tag) => `
      <button class="tag-chip" type="button" data-tag="${escapeHtml(tag)}" aria-label="Удалить тег ${escapeHtml(tag)}">
        <span>${escapeHtml(tag)}</span>
        <span aria-hidden="true">×</span>
      </button>
    `)
    .join("");

  tagChips.querySelectorAll(".tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeTag(chip.dataset.tag));
  });

  syncPreview();
}

function normalizeTag(value) {
  return String(value)
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function setStatus(message, type, url) {
  if (!statusBox) return;

  statusBox.className = `admin-status admin-status--${type}`;
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

syncPreview();
renderTags();
