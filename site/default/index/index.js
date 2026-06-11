(async function () {
  const data = await fetch("../data/public-index.json", { cache: "no-store" }).then((response) => response.json());
  buildWord(data.motorsport || []);
  renderLedger(data.ledger || {});
  renderPolicyOrbit(data.policies || []);
  renderMotorsport(data.motorsport || []);
  renderWall(data.motorsport || []);
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
  "FIELD".split("").forEach((letter, index) => {
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

function renderPolicyOrbit(items) {
  const orbit = document.getElementById("policy-orbit");
  document.getElementById("policy-count").textContent = String(items.length).padStart(2, "0");
  const rings = [
    { count: 7, rx: 24, ry: 20, offset: -1.45 },
    { count: 9, rx: 39, ry: 31, offset: -1.25 },
    { count: Math.max(0, items.length - 16), rx: 55, ry: 43, offset: -1.05 }
  ];
  let itemIndex = 0;
  rings.forEach((ring, ringIndex) => {
    for (let position = 0; position < ring.count && itemIndex < items.length; position++, itemIndex++) {
      const item = items[itemIndex];
      const angle = ring.offset + (Math.PI * 2 * position) / Math.max(1, ring.count);
      const card = document.createElement("a");
      card.className = `policy-card policy-card-${itemIndex % 5}`;
      card.href = item.url;
      card.target = "_blank";
      card.rel = "noreferrer";
      card.style.left = `${50 + Math.cos(angle) * ring.rx}%`;
      card.style.top = `${52 + Math.sin(angle) * ring.ry}%`;
      card.style.setProperty("--rot", `${Math.sin(angle) * 11 + (ringIndex - 1) * 2}deg`);
      card.style.setProperty("--delay", `${itemIndex * -0.18}s`);
      card.innerHTML = `
        <span>${String(itemIndex + 1).padStart(2, "0")} / ${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.date)}</small>`;
      card.addEventListener("mouseenter", () => {
        document.querySelector(".policy-core span").textContent = item.type || "POLICY FILE";
        document.querySelector(".policy-core small").textContent = item.date || "OPEN FILE";
      });
      orbit.append(card);
    }
  });
}

function renderMotorsport(items) {
  const track = document.getElementById("motorsport-track");
  items.forEach((item, index) => {
    const card = document.createElement("a");
    card.className = "motorsport-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.style.setProperty("--rot", `${[-6, 4, -3, 7, -5, 3][index % 6]}deg`);
    card.innerHTML = `<img src="${escapeAttr(item.image)}" alt=""><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.meta)}</p>`;
    track.append(card);
  });
}

function renderWall(items) {
  if (!items.length) return;
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
  const track = document.querySelector(".motorsport-track");
  const wall = document.querySelector(".wall");
  const wallColumns = [...document.querySelectorAll(".wall-col")];
  const policySection = document.querySelector(".policy-field");
  const orbit = document.getElementById("policy-orbit");
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? scrollY / max : 0;
    progress.textContent = String(Math.round(ratio * 100)).padStart(3, "0");

    const policyRect = policySection.getBoundingClientRect();
    const policyProgress = Math.max(0, Math.min(1, -policyRect.top / Math.max(1, policyRect.height - innerHeight)));
    orbit.style.transform = `scale(${0.82 + policyProgress * 0.3}) rotate(${(policyProgress - 0.5) * 7}deg)`;

    const section = document.querySelector(".motorsport").getBoundingClientRect();
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
