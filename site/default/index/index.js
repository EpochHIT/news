(async function () {
  const data = await fetch("../data/public-index.json", { cache: "no-store" }).then((response) => response.json());
  buildWord(data.fashion || []);
  renderLedger(data.ledger || {});
  renderPolicy(data.policies || []);
  renderMotion(data.motion);
  renderFashion(data.fashion || []);
  renderWall(data.fashion || []);
  renderSources(data.sources || []);
  setupScroll();
  let count = 0;
  const timer = setInterval(() => {
    count += 4;
    document.querySelector(".intro-count").textContent = String(Math.min(count, 100)).padStart(3, "0");
    if (count >= 100) {
      clearInterval(timer);
      document.body.classList.add("loaded");
    }
  }, 20);
})();

function buildWord(images) {
  const wrap = document.querySelector(".word-cells");
  "INDEX".split("").forEach((letter, index) => {
    const cell = document.createElement("div");
    cell.className = "word-cell";
    const image = images[index % Math.max(images.length, 1)]?.image || "";
    cell.style.setProperty("--image", `url("${image.replace(/"/g, "%22")}")`);
    cell.innerHTML = `<span>${letter}</span>`;
    wrap.append(cell);
    cell.addEventListener("mouseenter", () => light(index));
  });
  let active = -1;
  function light(index) {
    [...wrap.children].forEach((cell, cellIndex) => cell.classList.toggle("is-lit", cellIndex === index));
    active = index;
  }
  light(0);
  setInterval(() => light((active + 1) % 5), 1600);
}

function renderLedger(ledger) {
  document.getElementById("debt-total").textContent = money(ledger.debt);
  document.getElementById("debt-change").textContent = `${ledger.debtDate || ""} · DAILY CHANGE ${signedMoney(ledger.dailyChange)}`;
  const list = document.getElementById("indicator-list");
  (ledger.indicators || []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "indicator-row";
    row.innerHTML = `<div><span>${escapeHtml(item.country?.value || item.countryiso3code)}</span><strong>${escapeHtml(item.date)}</strong></div><strong>${compactMoney(item.value)}</strong>`;
    list.append(row);
  });
}

function renderPolicy(items) {
  const list = document.getElementById("policy-list");
  items.forEach((item, index) => {
    const row = document.createElement("li");
    row.innerHTML = `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)} · ${escapeHtml(item.date)}</span></a>`;
    list.append(row);
  });
}

function renderMotion(race) {
  if (!race) return;
  document.getElementById("race-round").textContent = `ROUND ${race.round} · ${race.date}`;
  document.getElementById("race-name").textContent = race.name;
  document.getElementById("race-meta").textContent = `${race.circuit} · ${race.locality}, ${race.country}`;
}

function renderFashion(items) {
  const track = document.getElementById("fashion-track");
  items.forEach((item, index) => {
    const card = document.createElement("a");
    card.className = "fashion-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.style.setProperty("--rot", `${[-6, 4, -3, 7, -5, 3][index % 6]}deg`);
    card.innerHTML = `<img src="${escapeAttr(item.image)}" alt=""><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.meta)}</p>`;
    track.append(card);
  });
}

function renderWall(items) {
  const columns = [...document.querySelectorAll(".wall-col")];
  columns.forEach((column, columnIndex) => {
    [...items, ...items].forEach((item, index) => {
      const image = document.createElement("img");
      image.src = items[(index + columnIndex * 2) % items.length]?.image || item.image;
      image.alt = "";
      image.loading = "lazy";
      column.append(image);
    });
  });
}

function renderSources(items) {
  const list = document.getElementById("source-list");
  items.forEach((item, index) => {
    const row = document.createElement("li");
    row.innerHTML = `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.label)}</strong><span>OPEN ORIGINAL ↗</span></a>`;
    list.append(row);
  });
}

function setupScroll() {
  const progress = document.getElementById("progress");
  const track = document.querySelector(".fashion-track");
  const wall = document.querySelector(".wall");
  const wallColumns = [...document.querySelectorAll(".wall-col")];
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? scrollY / max : 0;
    progress.textContent = String(Math.round(ratio * 100)).padStart(3, "0");
    const section = document.querySelector(".dress").getBoundingClientRect();
    const p = Math.max(0, Math.min(1, -section.top / Math.max(1, section.height - innerHeight)));
    track.style.transform = `translateX(${-p * Math.max(0, track.scrollWidth - innerWidth + 80)}px)`;
    const wallRect = wall.getBoundingClientRect();
    const wallProgress = Math.max(0, Math.min(1, -wallRect.top / Math.max(1, wallRect.height - innerHeight)));
    wallColumns.forEach((column, index) => {
      const direction = index === 1 ? 1 : -1;
      column.style.transform = `translateY(${direction * wallProgress * 34 - (index === 1 ? 34 : 0)}%)`;
    });
  };
  update();
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function signedMoney(value) { return `${Number(value || 0) >= 0 ? "+" : ""}${money(value)}`; }
function compactMoney(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
  if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(2)}B`;
  return money(number);
}
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function escapeAttr(value) { return escapeHtml(value); }
