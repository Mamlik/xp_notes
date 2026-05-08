const searchInput = document.querySelector("#lectureSearch");
const courseGrids = {
  acos: document.querySelector("#acosLectureGrid"),
  algorithms: document.querySelector("#algorithmsLectureGrid"),
  distributed: document.querySelector("#distributedLectureGrid")
};

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
  try {
    const catalog = await loadCatalog();

    catalog.courses.forEach((course) => {
      const grid = courseGrids[course.id];
      if (!grid) return;

      const publishedLectures = (course.items || []).filter((lecture) => lecture.status === "published");

      if (publishedLectures.length === 0) {
        grid.replaceChildren();
        return;
      }

      grid.replaceChildren(...publishedLectures.map(createLectureCard));
    });

    lectureCards = Array.from(document.querySelectorAll(".lecture-card:not(.lecture-card--loading)"));
    applyLectureSearch();
  } catch (error) {
    Object.values(courseGrids).forEach((grid) => {
      if (!grid) return;
      grid.innerHTML = `
      <article class="lecture-card lecture-card--loading">
        <div class="card-topline">
          <span class="lecture-index">!</span>
        </div>
        <h3>Не удалось загрузить каталог</h3>
        <p>Проверьте, что сайт открыт через веб-сервер, а файл data/lectures.json доступен.</p>
      </article>
    `;
    });
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
