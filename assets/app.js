const searchInput = document.querySelector("#lectureSearch");
const lectureGrid = document.querySelector("#acosLectureGrid");

let lectureCards = [];

function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

function createLectureCard(lecture, index) {
  const card = document.createElement("article");
  const searchableText = [
    lecture.title,
    lecture.description,
    ...(lecture.tags || [])
  ].join(" ");

  card.className = "lecture-card";
  card.dataset.title = searchableText;
  card.innerHTML = `
    <div class="card-topline">
      <span class="lecture-index">${formatIndex(index)}</span>
    </div>
    <h3>${lecture.title}</h3>
    <p>${lecture.description}</p>
    <div class="tags">
      ${(lecture.tags || []).map((tag) => `<span>${tag}</span>`).join("")}
    </div>
    <a class="card-action" href="${lecture.href}">Открыть конспект</a>
  `;

  return card;
}

function applyLectureSearch() {
  const query = searchInput?.value.trim().toLowerCase() || "";

  lectureCards.forEach((card) => {
    const text = `${card.dataset.title} ${card.textContent}`.toLowerCase();
    card.hidden = query.length > 0 && !text.includes(query);
  });
}

async function renderLectures() {
  if (!lectureGrid) return;

  try {
    const catalog = await loadCatalog();
    const acos = catalog.courses.find((course) => course.id === "acos");
    const publishedLectures = (acos?.items || []).filter((lecture) => lecture.status === "published");

    lectureGrid.replaceChildren(...publishedLectures.map(createLectureCard));
    lectureCards = Array.from(lectureGrid.querySelectorAll(".lecture-card"));
    applyLectureSearch();
  } catch (error) {
    lectureGrid.innerHTML = `
      <article class="lecture-card lecture-card--loading">
        <div class="card-topline">
          <span class="lecture-index">!</span>
        </div>
        <h3>Не удалось загрузить каталог</h3>
        <p>Проверьте, что сайт открыт через веб-сервер, а файл data/lectures.json доступен.</p>
      </article>
    `;
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("data/lectures.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (window.LECTURE_CATALOG) return window.LECTURE_CATALOG;
    throw error;
  }
}

searchInput?.addEventListener("input", applyLectureSearch);
renderLectures();
