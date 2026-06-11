(async function () {
  const fallback = {
    date: new Date().toISOString().slice(0, 10),
    notes: [],
    fallbackNotes: [
      { title: "Signal needs context.", summary: "A quiet local fallback.", source: "LOCAL" },
      { title: "Public data belongs in public view.", summary: "Build slowly and verify sources.", source: "LOCAL" }
    ],
    finance: { markets: [], privateWatch: [] },
    academic: { papers: [] }
  };

  let feed = fallback;
  try {
    const response = await fetch("../data/feed.json", { cache: "no-store" });
    feed = await response.json();
  } catch {}

  document.getElementById("field-date").textContent = `${feed.date || fallback.date} / PUBLIC SIGNAL FIELD`;
  renderPulse(feed.notes?.length ? feed.notes : feed.fallbackNotes || fallback.fallbackNotes);
  renderMarkets(feed.finance || {});
  renderResearch(feed.academic?.papers || []);
  setupMotion();
  setupScroll();
})();

function renderPulse(notes) {
  const rail = document.getElementById("pulse-rail");
  rail.innerHTML = "";
  for (const [index, note] of notes.slice(0, 7).entries()) {
    const card = document.createElement(note.url ? "a" : "article");
    card.className = "pulse-card";
    if (note.url) {
      card.href = note.url;
      card.target = "_blank";
      card.rel = "noreferrer";
    }
    card.innerHTML = `
      <span>${String(index + 1).padStart(2, "0")} / ${escapeHtml(note.source || "SIGNAL")}</span>
      <h3>${escapeHtml(note.title || "Untitled signal")}</h3>
      <p>${escapeHtml(note.summary || "Open the signal and inspect its context.")}</p>
    `;
    rail.append(card);
  }
}

function renderMarkets(finance) {
  const nodes = document.getElementById("market-nodes");
  const listed = (finance.markets || []).slice(0, 9).map((item) => ({
    label: item.label || item.symbol,
    detail: `${Number(item.change || 0) >= 0 ? "+" : ""}${Number(item.change || 0).toFixed(1)}%`,
    url: item.url,
    private: false
  }));
  const privateWatch = (finance.privateWatch || []).slice(0, 4).map((item) => ({
    label: item.label,
    detail: "PRIVATE / WATCH",
    url: item.url,
    private: true
  }));
  const items = [...listed, ...privateWatch];
  const positions = [
    [12, 8], [55, 4], [76, 20], [28, 27], [57, 38], [8, 49], [78, 55],
    [38, 63], [60, 76], [12, 78], [34, 88], [79, 87], [50, 15]
  ];

  nodes.innerHTML = "";
  items.forEach((item, index) => {
    const node = document.createElement(item.url ? "a" : "div");
    node.className = `market-node${item.private ? " private" : ""}`;
    node.style.left = `${positions[index % positions.length][0]}%`;
    node.style.top = `${positions[index % positions.length][1]}%`;
    if (item.url) {
      node.href = item.url;
      node.target = "_blank";
      node.rel = "noreferrer";
    }
    node.innerHTML = `<strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small>`;
    nodes.append(node);
  });

  drawConnections(items.length, positions);
}

function drawConnections(count, positions) {
  const canvas = document.getElementById("market-canvas");
  const context = canvas.getContext("2d");
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.strokeStyle = "rgba(17,17,15,.22)";
    context.lineWidth = 1;
    for (let index = 0; index < count - 1; index++) {
      const from = positions[index % positions.length];
      const to = positions[(index + 3) % count];
      context.beginPath();
      context.moveTo(from[0] / 100 * rect.width + 50, from[1] / 100 * rect.height + 50);
      context.lineTo(to[0] / 100 * rect.width + 50, to[1] / 100 * rect.height + 50);
      context.stroke();
    }
  };
  resize();
  addEventListener("resize", resize);
}

function renderResearch(papers) {
  const stream = document.getElementById("research-stream");
  const items = papers.length ? papers.slice(0, 8) : [
    { title: "Robotics, embodied intelligence, and systems worth tracking.", categories: ["LOCAL"], published: "OPEN" },
    { title: "Research becomes useful when the evidence remains visible.", categories: ["METHOD"], published: "VERIFY" }
  ];
  stream.innerHTML = "";
  items.forEach((paper, index) => {
    const card = document.createElement(paper.alphaxiv || paper.arxiv ? "a" : "article");
    card.className = "research-card";
    if (card.tagName === "A") {
      card.href = paper.alphaxiv || paper.arxiv;
      card.target = "_blank";
      card.rel = "noreferrer";
    }
    card.innerHTML = `
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(paper.title)}</h3>
      <em>${escapeHtml([...(paper.categories || []).slice(0, 2), paper.published].filter(Boolean).join(" / "))}</em>
    `;
    stream.append(card);
  });
}

function setupMotion() {
  const button = document.getElementById("motion-toggle");
  button.addEventListener("click", () => {
    const paused = document.body.classList.toggle("motion-paused");
    button.textContent = paused ? "RESUME MOTION" : "PAUSE MOTION";
  });
}

function setupScroll() {
  const cards = [...document.querySelectorAll(".pulse-card")];
  const track = document.querySelector(".culture-track");
  const update = () => {
    const viewport = innerHeight;
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const distance = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      card.style.transform = `translateX(calc(var(--shift, 0px) + ${Math.max(-60, Math.min(60, distance * 55))}px))`;
    });
    const culture = document.querySelector(".culture-section").getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -culture.top / Math.max(1, culture.height - viewport)));
    if (track) track.style.setProperty("--track-x", `${-progress * Math.max(0, track.scrollWidth - innerWidth + 80)}px`);
  };
  update();
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
