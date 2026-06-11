let orbitItems = [];
let orbitCards = [];
let orbitRotation = 0;
let orbitScrollRotation = 0;
let dragStart = null;
let dragged = false;

(async function () {
  const data = await fetch("../data/public-index.json", { cache: "no-store" }).then((response) => response.json());
  const machines = data.machines || data.motorsport || [];
  setIntroImage(machines);
  renderLedger(data.ledger || {});
  renderMachines(machines);
  renderWall(machines);
  renderArchive([...(data.policies || []), ...(data.sources || []).map((item) => ({ ...item, title: item.label, type: "SOURCE", date: "ORIGINAL" }))]);
  setupScroll();
  setupArchiveControls();

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

function setIntroImage(items) {
  const images = items.slice(0, 5).map((item) => `url("${String(item.image || "").replace(/"/g, "%22")}")`).join(",");
  document.querySelector(".intro-word").style.setProperty("--intro-images", images || "none");
}

function renderLedger(ledger) {
  document.getElementById("debt-total").textContent = money(ledger.debt);
  document.getElementById("debt-change").textContent = `${ledger.debtDate || ""} · ${signedMoney(ledger.dailyChange)}`;
  const list = document.getElementById("indicator-list");
  (ledger.indicators || []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "indicator-row";
    row.innerHTML = `<span>${escapeHtml(item.country?.value || item.countryiso3code)} / ${escapeHtml(item.date)}</span><strong>${compactMoney(item.value)}</strong>`;
    list.append(row);
  });
}

function renderMachines(items) {
  const track = document.getElementById("machine-track");
  items.forEach((item, index) => {
    const card = document.createElement("a");
    card.className = "machine-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.style.setProperty("--rot", `${[-6, 4, -3, 7, -5, 3][index % 6]}deg`);
    card.innerHTML = `<img src="${escapeAttr(item.image)}" alt=""><span>${String(index + 1).padStart(2, "0")} / ${escapeHtml(item.kind || "MACHINE")}</span><h2>${escapeHtml(item.title)}</h2>`;
    track.append(card);
  });
}

function renderWall(items) {
  if (!items.length) return;
  const columns = [...document.querySelectorAll(".wall-col")];
  columns.forEach((column, columnIndex) => {
    [...items, ...items].forEach((item, index) => {
      const image = document.createElement("img");
      image.src = items[(index + columnIndex * 3) % items.length]?.image || item.image;
      image.alt = "";
      image.loading = "lazy";
      column.append(image);
    });
  });
}

function renderArchive(items) {
  orbitItems = items;
  const orbit = document.getElementById("archive-orbit");
  document.getElementById("archive-count").textContent = String(items.length).padStart(2, "0");
  orbitCards = items.map((item, index) => {
    const card = document.createElement("button");
    card.className = `archive-card archive-card-${index % 5}`;
    card.type = "button";
    card.innerHTML = `<span>${String(index + 1).padStart(2, "0")} / ${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.date)}</small>`;
    card.addEventListener("click", () => {
      if (!dragged) inspectItem(item);
    });
    orbit.append(card);
    return card;
  });
  positionArchive();
}

function positionArchive() {
  const width = innerWidth;
  const radius = Math.min(width * (width < 800 ? 0.25 : 0.34), 520);
  orbitCards.forEach((card, index) => {
    const ring = index % 3;
    const ringItems = orbitCards.filter((_, itemIndex) => itemIndex % 3 === ring).length;
    const ringPosition = Math.floor(index / 3);
    const angle = orbitRotation + orbitScrollRotation + (ringPosition / ringItems) * Math.PI * 2 + ring * 0.22;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = (ring - 1) * Math.min(innerHeight * 0.22, 190) + Math.sin(angle * 2) * 28;
    const depth = (z + radius) / (radius * 2);
    card.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${-Math.sin(angle) * 22}deg)`;
    card.style.opacity = String(0.28 + depth * 0.72);
    card.style.zIndex = String(Math.round(depth * 100));
    card.style.setProperty("--blur", `${(1 - depth) * 1.7}px`);
  });
}

function inspectItem(item) {
  const panel = document.getElementById("inspect-panel");
  document.getElementById("inspect-type").textContent = item.type || "FILE";
  document.getElementById("inspect-title").textContent = item.title || item.label;
  document.getElementById("inspect-date").textContent = item.date || "ORIGINAL";
  document.getElementById("inspect-open").href = item.url;
  panel.hidden = false;
}

function setupArchiveControls() {
  const viewport = document.getElementById("archive-viewport");
  viewport.addEventListener("pointerdown", (event) => {
    dragStart = { x: event.clientX, rotation: orbitRotation };
    dragged = false;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    if (Math.abs(event.clientX - dragStart.x) > 5) dragged = true;
    orbitRotation = dragStart.rotation + (event.clientX - dragStart.x) * 0.006;
    positionArchive();
  });
  viewport.addEventListener("pointerup", () => {
    dragStart = null;
    setTimeout(() => { dragged = false; }, 0);
  });
  viewport.addEventListener("pointercancel", () => { dragStart = null; });
  document.getElementById("inspect-close").addEventListener("click", () => {
    document.getElementById("inspect-panel").hidden = true;
  });
}

function setupScroll() {
  const progress = document.getElementById("progress");
  const track = document.querySelector(".machine-track");
  const wall = document.querySelector(".wall");
  const wallColumns = [...document.querySelectorAll(".wall-col")];
  const archive = document.querySelector(".archive-field");
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? scrollY / max : 0;
    progress.textContent = String(Math.round(ratio * 100)).padStart(3, "0");

    const machineRect = document.querySelector(".machines").getBoundingClientRect();
    const machineProgress = Math.max(0, Math.min(1, -machineRect.top / Math.max(1, machineRect.height - innerHeight)));
    track.style.transform = `translateX(${-machineProgress * Math.max(0, track.scrollWidth - innerWidth + 80)}px)`;

    const wallRect = wall.getBoundingClientRect();
    const wallProgress = Math.max(0, Math.min(1, -wallRect.top / Math.max(1, wallRect.height - innerHeight)));
    wallColumns.forEach((column, index) => {
      const direction = index === 1 ? 1 : -1;
      column.style.transform = `translateY(${direction * wallProgress * 34 - (index === 1 ? 34 : 0)}%)`;
    });

    const archiveRect = archive.getBoundingClientRect();
    const archiveProgress = Math.max(0, Math.min(1, -archiveRect.top / Math.max(1, archiveRect.height - innerHeight)));
    orbitScrollRotation = archiveProgress * Math.PI * 2.2;
    positionArchive();
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
