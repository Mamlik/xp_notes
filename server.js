import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const rootDir = resolve(process.cwd());
loadDotEnv();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";

const courseDirs = {
  acos: "acos",
  algorithms: "algorithms",
  distributed: "distributed"
};

const publicSiteUrl = (process.env.PUBLIC_SITE_URL || "https://mamlik.github.io/xp_notes").replace(/\/$/, "");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/admin/submit-lecture") {
      await submitLecture(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/check-password") {
      await checkAdminPassword(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/update-lecture") {
      await updateLecture(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/delete-lecture") {
      await deleteLecture(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/reorder-lectures") {
      await reorderLectures(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/pulls") {
      await listPullRequests(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    console.error(error);
    sendJson(response, error.status || 500, { error: error.message || "Internal server error" });
  }
});

server.listen(port, host, () => {
  console.log(`Site is running at http://${host}:${port}/`);
});

function loadDotEnv() {
  try {
    const envPath = join(rootDir, ".env");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env is optional in production.
  }
}

async function serveStatic(pathname, response, headOnly) {
  const decodedPath = decodeURIComponent(pathname);
  const safePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const pathSegments = safePath.split("/").filter(Boolean);

  if (pathSegments.some((segment) => segment.startsWith("."))) {
    sendText(response, 404, "Not found");
    return;
  }

  const filePath = normalize(join(rootDir, safePath));

  if (!filePath.startsWith(rootDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    if (!headOnly) response.end(body);
    else response.end();
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function submitLecture(request, response) {
  if (!requireAdmin(request, response)) return;

  const payload = await readJsonBody(request);
  const lecture = validateLecturePayload(payload);
  const pr = await createLecturePullRequest(lecture);

  sendJson(response, 201, {
    message: "Pull request created",
    prUrl: pr.html_url,
    branch: pr.head.ref
  });
}

async function checkAdminPassword(request, response) {
  if (!requireAdmin(request, response)) return;
  sendJson(response, 200, { ok: true });
}

async function updateLecture(request, response) {
  if (!requireAdmin(request, response)) return;

  const payload = await readJsonBody(request);
  const lecture = validateManagedLecturePayload(payload);
  const pr = await createUpdateLecturePullRequest(lecture);

  sendJson(response, 201, {
    message: "Pull request created",
    prUrl: pr.html_url,
    branch: pr.head.ref
  });
}

async function deleteLecture(request, response) {
  if (!requireAdmin(request, response)) return;

  const payload = await readJsonBody(request);
  const courseId = String(payload.courseId || "").trim();
  const href = String(payload.href || "").trim();

  if (!courseDirs[courseId]) throw httpError(400, "Unknown course");
  if (!href.startsWith(`lectures/${courseDirs[courseId]}/`)) throw httpError(400, "Invalid lecture path");

  const pr = await createDeleteLecturePullRequest({ courseId, href });

  sendJson(response, 201, {
    message: "Pull request created",
    prUrl: pr.html_url,
    branch: pr.head.ref
  });
}

async function reorderLectures(request, response) {
  if (!requireAdmin(request, response)) return;

  const payload = await readJsonBody(request);
  const orders = validateReorderPayload(payload);
  const pr = await createReorderLecturesPullRequest(orders);

  sendJson(response, 201, {
    message: "Pull request created",
    prUrl: pr.html_url,
    branch: pr.head.ref
  });
}

async function listPullRequests(request, response) {
  if (!requireAdmin(request, response)) return;

  const owner = requiredEnv("GITHUB_OWNER");
  const repo = requiredEnv("GITHUB_REPO");
  const token = requiredEnv("GITHUB_TOKEN");
  const pulls = await github(`/repos/${owner}/${repo}/pulls?state=open&per_page=30&sort=created&direction=desc`, { token });

  sendJson(response, 200, {
    pulls: pulls.map((pull) => ({
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      branch: pull.head.ref,
      author: pull.user?.login || "unknown",
      createdAt: pull.created_at
    }))
  });
}

function requireAdmin(request, response) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = request.headers["x-admin-password"];

  if (!configuredPassword) {
    sendJson(response, 503, { error: "ADMIN_PASSWORD is not configured" });
    return false;
  }

  if (providedPassword !== configuredPassword) {
    sendJson(response, 401, { error: "Invalid admin password" });
    return false;
  }

  return true;
}

function validateLecturePayload(payload) {
  const courseId = String(payload.courseId || "").trim();
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const tags = String(payload.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const htmlContent = String(payload.htmlContent || "").trim();
  const originalFilename = String(payload.filename || "").trim();

  if (!courseDirs[courseId]) throw httpError(400, "Unknown course");
  if (title.length < 3) throw httpError(400, "Title is too short");
  if (description.length < 10) throw httpError(400, "Description is too short");
  if (!htmlContent.toLowerCase().includes("<html")) throw httpError(400, "HTML file must contain a full HTML document");

  const safeFilename = sanitizeFilename(originalFilename || `${slugify(title)}.html`);
  if (!safeFilename.endsWith(".html")) throw httpError(400, "Only .html files are supported");

  return {
    courseId,
    title,
    description,
    tags,
    htmlContent,
    filename: safeFilename,
    status: payload.status === "draft" ? "draft" : "published"
  };
}

function validateManagedLecturePayload(payload) {
  const courseId = String(payload.courseId || "").trim();
  const href = String(payload.href || "").trim();
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const tags = parseTags(payload.tags);
  const htmlContent = String(payload.htmlContent || "").trim();

  if (!courseDirs[courseId]) throw httpError(400, "Unknown course");
  if (!href.startsWith(`lectures/${courseDirs[courseId]}/`)) throw httpError(400, "Invalid lecture path");
  if (title.length < 3) throw httpError(400, "Title is too short");
  if (description.length < 10) throw httpError(400, "Description is too short");
  if (htmlContent && !htmlContent.toLowerCase().includes("<html")) {
    throw httpError(400, "HTML file must contain a full HTML document");
  }

  return {
    courseId,
    href,
    title,
    description,
    tags,
    htmlContent,
    status: payload.status === "draft" ? "draft" : "published"
  };
}

function validateReorderPayload(payload) {
  const orders = payload.orders;
  if (!orders || typeof orders !== "object" || Array.isArray(orders)) {
    throw httpError(400, "Invalid order payload");
  }

  return Object.fromEntries(Object.entries(orders).map(([courseId, hrefs]) => {
    if (!courseDirs[courseId]) throw httpError(400, "Unknown course");
    if (!Array.isArray(hrefs)) throw httpError(400, "Course order must be an array");

    const cleanHrefs = hrefs.map((href) => String(href || "").trim());
    if (cleanHrefs.some((href) => !href.startsWith(`lectures/${courseDirs[courseId]}/`))) {
      throw httpError(400, "Invalid lecture path");
    }

    if (new Set(cleanHrefs).size !== cleanHrefs.length) {
      throw httpError(400, "Duplicate lecture path in order");
    }

    return [courseId, cleanHrefs];
  }));
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function createLecturePullRequest(lecture) {
  const owner = requiredEnv("GITHUB_OWNER");
  const repo = requiredEnv("GITHUB_REPO");
  const token = requiredEnv("GITHUB_TOKEN");
  const baseBranch = process.env.GITHUB_BASE_BRANCH || "main";
  const branch = `add-lecture/${Date.now()}-${slugify(lecture.title)}`;
  const lecturePath = `lectures/${courseDirs[lecture.courseId]}/${lecture.filename}`;

  const baseRef = await github(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, { token });

  await github(`/repos/${owner}/${repo}/git/refs`, {
    token,
    method: "POST",
    body: {
      ref: `refs/heads/${branch}`,
      sha: baseRef.object.sha
    }
  });

  const catalogFile = await github(`/repos/${owner}/${repo}/contents/data/lectures.json?ref=${encodeURIComponent(baseBranch)}`, { token });
  const catalog = JSON.parse(decodeBase64(catalogFile.content));
  const catalogScriptFile = await github(`/repos/${owner}/${repo}/contents/assets/catalog.js?ref=${encodeURIComponent(baseBranch)}`, { token });
  const course = catalog.courses.find((item) => item.id === lecture.courseId);
  if (!course) throw httpError(400, "Course is missing in lectures.json");

  course.items.push({
    title: lecture.title,
    description: lecture.description,
    tags: lecture.tags,
    href: lecturePath,
    status: lecture.status
  });

  await github(`/repos/${owner}/${repo}/contents/${lecturePath}`, {
    token,
    method: "PUT",
    body: {
      message: `Add lecture: ${lecture.title}`,
      content: encodeBase64(lecture.htmlContent),
      branch
    }
  });

  await github(`/repos/${owner}/${repo}/contents/data/lectures.json`, {
    token,
    method: "PUT",
    body: {
      message: `Register lecture: ${lecture.title}`,
      content: encodeBase64(`${JSON.stringify(catalog, null, 2)}\n`),
      branch,
      sha: catalogFile.sha
    }
  });

  await github(`/repos/${owner}/${repo}/contents/assets/catalog.js`, {
    token,
    method: "PUT",
    body: {
      message: `Update browser catalog: ${lecture.title}`,
      content: encodeBase64(createCatalogScript(catalog)),
      branch,
      sha: catalogScriptFile.sha
    }
  });

  return github(`/repos/${owner}/${repo}/pulls`, {
    token,
    method: "POST",
    body: {
      title: `Добавить конспект: ${lecture.title}`,
      head: branch,
      base: baseBranch,
      body: [
        "Автоматически создано из админ-панели.",
        "",
        `Дисциплина: ${lecture.courseId}`,
        `Файл: ${lecturePath}`,
        `Статус: ${lecture.status}`,
        "",
        ...createLectureReviewLinks({ owner, repo, branch, path: lecturePath }),
        "",
        "Проверьте HTML-конспект и карточку в каталоге перед merge."
      ].join("\n")
    }
  });
}

async function createUpdateLecturePullRequest(lecture) {
  const context = await createGithubChangeContext(`edit-lecture/${Date.now()}-${slugify(lecture.title)}`);
  const course = context.catalog.courses.find((item) => item.id === lecture.courseId);
  const item = course?.items.find((entry) => entry.href === lecture.href);

  if (!course || !item) throw httpError(404, "Lecture is missing in lectures.json");

  item.title = lecture.title;
  item.description = lecture.description;
  item.tags = lecture.tags;
  item.status = lecture.status;

  if (lecture.htmlContent) {
    const existingFile = await github(`/repos/${context.owner}/${context.repo}/contents/${lecture.href}?ref=${encodeURIComponent(context.baseBranch)}`, { token: context.token });
    await github(`/repos/${context.owner}/${context.repo}/contents/${lecture.href}`, {
      token: context.token,
      method: "PUT",
      body: {
        message: `Update lecture HTML: ${lecture.title}`,
        content: encodeBase64(lecture.htmlContent),
        branch: context.branch,
        sha: existingFile.sha
      }
    });
  }

  await commitCatalogFiles(context, `Update lecture card: ${lecture.title}`);

  return createPullRequest(context, {
    title: `Обновить конспект: ${lecture.title}`,
    body: [
      "Автоматически создано из админ-панели.",
      "",
      `Дисциплина: ${lecture.courseId}`,
      `Файл: ${lecture.href}`,
      `Статус: ${lecture.status}`,
      "",
      ...createLectureReviewLinks({
        owner: context.owner,
        repo: context.repo,
        branch: context.branch,
        path: lecture.href
      }),
      "",
      "Проверьте изменения карточки и HTML-конспекта перед merge."
    ].join("\n")
  });
}

async function createDeleteLecturePullRequest(lecture) {
  const context = await createGithubChangeContext(`delete-lecture/${Date.now()}-${slugify(lecture.href)}`);
  const course = context.catalog.courses.find((item) => item.id === lecture.courseId);
  const itemIndex = course?.items.findIndex((entry) => entry.href === lecture.href) ?? -1;

  if (!course || itemIndex < 0) throw httpError(404, "Lecture is missing in lectures.json");

  const [removed] = course.items.splice(itemIndex, 1);
  const existingFile = await github(`/repos/${context.owner}/${context.repo}/contents/${lecture.href}?ref=${encodeURIComponent(context.baseBranch)}`, { token: context.token });

  await github(`/repos/${context.owner}/${context.repo}/contents/${lecture.href}`, {
    token: context.token,
    method: "DELETE",
    body: {
      message: `Delete lecture: ${removed.title}`,
      branch: context.branch,
      sha: existingFile.sha
    }
  });

  await commitCatalogFiles(context, `Remove lecture from catalog: ${removed.title}`);

  return createPullRequest(context, {
    title: `Удалить конспект: ${removed.title}`,
    body: [
      "Автоматически создано из админ-панели.",
      "",
      `Дисциплина: ${lecture.courseId}`,
      `Файл: ${lecture.href}`,
      "",
      `Файл в PR: ${createGithubFileUrl(context.owner, context.repo, context.branch, lecture.href)}`,
      "",
      "Проверьте удаление карточки и HTML-файла перед merge."
    ].join("\n")
  });
}

async function createReorderLecturesPullRequest(orders) {
  const context = await createGithubChangeContext(`reorder-lectures/${Date.now()}`);

  for (const [courseId, hrefs] of Object.entries(orders)) {
    const course = context.catalog.courses.find((item) => item.id === courseId);
    if (!course) throw httpError(400, "Course is missing in lectures.json");

    const byHref = new Map(course.items.map((item) => [item.href, item]));
    if (hrefs.some((href) => !byHref.has(href))) {
      throw httpError(400, "Order contains unknown lecture");
    }

    const ordered = hrefs.map((href) => byHref.get(href));
    const leftovers = course.items.filter((item) => !hrefs.includes(item.href));
    course.items = [...ordered, ...leftovers];
  }

  await commitCatalogFiles(context, "Reorder lectures");

  return createPullRequest(context, {
    title: "Изменить порядок конспектов",
    body: [
      "Автоматически создано из админ-панели.",
      "",
      "Изменен порядок карточек внутри дисциплин.",
      "",
      "Проверьте очередность конспектов перед merge."
    ].join("\n")
  });
}

async function createGithubChangeContext(branch) {
  const owner = requiredEnv("GITHUB_OWNER");
  const repo = requiredEnv("GITHUB_REPO");
  const token = requiredEnv("GITHUB_TOKEN");
  const baseBranch = process.env.GITHUB_BASE_BRANCH || "main";

  const baseRef = await github(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, { token });

  await github(`/repos/${owner}/${repo}/git/refs`, {
    token,
    method: "POST",
    body: {
      ref: `refs/heads/${branch}`,
      sha: baseRef.object.sha
    }
  });

  const catalogFile = await github(`/repos/${owner}/${repo}/contents/data/lectures.json?ref=${encodeURIComponent(baseBranch)}`, { token });
  const catalogScriptFile = await github(`/repos/${owner}/${repo}/contents/assets/catalog.js?ref=${encodeURIComponent(baseBranch)}`, { token });
  const catalog = JSON.parse(decodeBase64(catalogFile.content));

  return {
    owner,
    repo,
    token,
    baseBranch,
    branch,
    catalog,
    catalogFile,
    catalogScriptFile
  };
}

async function commitCatalogFiles(context, message) {
  await github(`/repos/${context.owner}/${context.repo}/contents/data/lectures.json`, {
    token: context.token,
    method: "PUT",
    body: {
      message,
      content: encodeBase64(`${JSON.stringify(context.catalog, null, 2)}\n`),
      branch: context.branch,
      sha: context.catalogFile.sha
    }
  });

  await github(`/repos/${context.owner}/${context.repo}/contents/assets/catalog.js`, {
    token: context.token,
    method: "PUT",
    body: {
      message: "Update browser catalog",
      content: encodeBase64(createCatalogScript(context.catalog)),
      branch: context.branch,
      sha: context.catalogScriptFile.sha
    }
  });
}

function createPullRequest(context, pull) {
  return github(`/repos/${context.owner}/${context.repo}/pulls`, {
    token: context.token,
    method: "POST",
    body: {
      title: pull.title,
      head: context.branch,
      base: context.baseBranch,
      body: pull.body
    }
  });
}

function createLectureReviewLinks({ owner, repo, branch, path }) {
  const fileUrl = createGithubFileUrl(owner, repo, branch, path);
  return [
    `Файл в PR: ${fileUrl}`,
    `Предпросмотр HTML до merge: ${createHtmlPreviewUrl(fileUrl)}`,
    `Адрес после merge: ${publicSiteUrl}/${path}`
  ];
}

function createGithubFileUrl(owner, repo, branch, path) {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
}

function createHtmlPreviewUrl(fileUrl) {
  return `https://htmlpreview.github.io/?${fileUrl}`;
}

function createCatalogScript(catalog) {
  return `window.LECTURE_CATALOG = ${JSON.stringify(catalog, null, 2)};\n`;
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method || "GET",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${options.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mephi-xp-notes-admin"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `GitHub API error ${response.status}`;
    throw httpError(response.status, message);
  }

  return data;
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        rejectBody(httpError(413, "Payload is too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body || "{}"));
      } catch {
        rejectBody(httpError(400, "Invalid JSON"));
      }
    });
  });
}

function sanitizeFilename(filename) {
  const base = filename.split(/[\\/]/).pop() || "lecture.html";
  const ascii = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return ascii || "lecture.html";
}

function slugify(value) {
  const translit = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };

  return value
    .toLowerCase()
    .split("")
    .map((char) => translit[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "lecture";
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw httpError(503, `${name} is not configured`);
  return value;
}

function encodeBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64(value) {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(text);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
