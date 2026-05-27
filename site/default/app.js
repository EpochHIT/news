(async function () {
  const today = new Date();
  document.getElementById("today").textContent = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
  setupLightMode();

  let feed = { wallpapers: [], notes: [], fallbackNotes: [] };
  try {
    const response = await fetch("data/feed.json", { cache: "no-store" });
    feed = await response.json();
  } catch {
    feed = {
      wallpapers: [],
      notes: [],
      fallbackNotes: [{ title: "读一页纸，留一张图，记录一个问题。", summary: "A quiet fallback signal.", source: "Local", time: "" }]
    };
  }

  const notes = feed.notes?.length ? feed.notes : feed.fallbackNotes;
  renderLead(notes[0]);
  renderNews(notes);
  renderImages(feed.wallpapers || []);
  renderFinance(feed.finance || {});
  renderAcademic(feed.academic || {});
  renderStudyArchive(feed.academic || {}, feed.archive || {});
  document.getElementById("story-count").textContent = String(notes.length || "--").padStart(2, "0");
  document.getElementById("visual-count").textContent = String((feed.wallpapers || []).length || "--").padStart(2, "0");
  document.getElementById("market-count").textContent = String((feed.finance?.markets || []).length || "--").padStart(2, "0");

  let birthdayData = { events: [] };
  try {
    const response = await fetch("data/birthdays.json", { cache: "no-store" });
    birthdayData = await response.json();
  } catch {
    birthdayData = { events: [] };
  }

  renderBirthdaySignals(birthdayData.events || []);
})();

function renderLead(note) {
  if (!note) return;
  const link = document.getElementById("feature-link");
  link.href = note.url || "https://news.stormzhang.ai/";
  document.getElementById("feature-title").textContent = note.title;
  document.getElementById("feature-summary").textContent = note.summary || "";
  document.getElementById("feature-meta").textContent = [note.source, note.time].filter(Boolean).join(" · ");
}

function renderImages(wallpapers) {
  const first = wallpapers[0];
  const main = document.getElementById("image-main");
  if (first?.url) {
    main.style.setProperty("--image", `url("${first.url}")`);
    document.getElementById("image-title").textContent = first.title || "Daily view";
    document.getElementById("image-caption").textContent = first.caption || "";
  }

  const row = document.getElementById("thumb-row");
  row.innerHTML = "";
  for (const image of wallpapers.slice(1, 5)) {
    const button = document.createElement("button");
    button.type = "button";
    button.style.setProperty("--image", `url("${image.url}")`);
    button.title = image.title || "Daily image";
    button.addEventListener("click", () => {
      main.style.setProperty("--image", `url("${image.url}")`);
      document.getElementById("image-title").textContent = image.title || "Daily view";
      document.getElementById("image-caption").textContent = image.caption || "";
    });
    row.append(button);
  }
}

function renderNews(notes) {
  const grid = document.getElementById("notes");
  grid.innerHTML = "";
  for (const note of notes.slice(1, 10)) {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = note.url || "https://news.stormzhang.ai/";
    card.target = "_blank";
    card.rel = "noreferrer";
    card.innerHTML = `
      <span>${note.index || ""}</span>
      <h3>${escapeHtml(note.title)}</h3>
      <p>${escapeHtml(note.summary || "")}</p>
      <em>${escapeHtml([note.source, note.time].filter(Boolean).join(" · "))}</em>
    `;
    grid.append(card);
  }
}

function renderAcademic(academic) {
  const papers = academic.papers || [];
  const resources = academic.resources?.length ? academic.resources : [
    { label: "arXiv cs.RO", title: "Robotics preprints", url: "https://arxiv.org/list/cs.RO/recent" },
    { label: "alphaXiv", title: "Social reading for arXiv papers", url: "https://www.alphaxiv.org/" }
  ];
  const awards = academic.awards?.length ? academic.awards : [
    { label: "RSS", title: "Outstanding Paper Award archive", url: "https://roboticsfoundation.org/awards/best-paper-award/" }
  ];
  const projects = academic.projects || [];
  const lanes = academic.lanes?.length ? academic.lanes : ["Robot learning", "Embodied AI", "SLAM / VIO", "Autonomous systems"];

  document.getElementById("paper-count").textContent = String(papers.length || "--").padStart(2, "0");

  const paperList = document.getElementById("paper-list");
  paperList.innerHTML = "";
  if (!papers.length) {
    paperList.innerHTML = `<a class="paper-card paper-empty" href="https://arxiv.org/list/cs.RO/recent" target="_blank" rel="noreferrer"><span>00</span><h3>Open the robotics stream.</h3><p>The build could not refresh papers this time, but the research lane is still here.</p><em>arXiv cs.RO</em></a>`;
  }
  for (const paper of papers.slice(0, 6)) {
    const card = document.createElement("a");
    card.className = "paper-card";
    card.href = paper.alphaxiv || paper.arxiv || paper.pdf || "https://arxiv.org/list/cs.RO/recent";
    card.target = "_blank";
    card.rel = "noreferrer";
    const authors = (paper.authors || []).join(", ");
    const categories = (paper.categories || []).slice(0, 3).join(" / ");
    card.innerHTML = `
      <span>${escapeHtml(paper.index || "")}</span>
      <h3>${escapeHtml(paper.title)}</h3>
      <p>${escapeHtml(trimText(paper.summary, 210))}</p>
      <em>${escapeHtml([authors, categories, paper.published].filter(Boolean).join(" · "))}</em>
    `;
    paperList.append(card);
  }

  renderLinkStack("resource-list", resources);
  renderLinkStack("award-list", awards);
  renderLinkStack("project-list", projects);

  const laneList = document.getElementById("lane-list");
  laneList.innerHTML = "";
  for (const lane of lanes) {
    const item = document.createElement("span");
    item.textContent = lane;
    laneList.append(item);
  }
}

function renderFinance(finance) {
  const markets = finance.markets || [];
  const grid = document.getElementById("ticker-grid");
  grid.innerHTML = "";

  for (const item of markets.slice(0, 12)) {
    const card = document.createElement("a");
    const up = Number(item.change || 0) >= 0;
    card.className = `ticker-card ${up ? "up" : "down"}`;
    card.href = item.url || "https://finance.yahoo.com/markets/";
    card.target = "_blank";
    card.rel = "noreferrer";
    card.innerHTML = `
      <span>${escapeHtml(item.group || item.symbol)}</span>
      <h3>${escapeHtml(item.label || item.symbol)}</h3>
      <strong>${formatPrice(item.price, item.currency)}</strong>
      <em>${up ? "+" : ""}${Number(item.change || 0).toFixed(2)}% · 1M</em>
      ${sparklineSvg(item.closes || [], up)}
      ${candlesSvg(item.candles || [], up)}
    `;
    grid.append(card);
  }

  renderChipList("finance-keywords", finance.keywords?.length ? finance.keywords : ["AI", "Rates", "China", "Chips"]);
  renderLinkStack("private-watch", finance.privateWatch || []);
  renderLinkStack("finance-sources", finance.sources || []);
}

function renderChipList(id, items) {
  const list = document.getElementById(id);
  list.innerHTML = "";
  for (const item of items) {
    const chip = document.createElement("span");
    chip.textContent = item;
    list.append(chip);
  }
}

function formatPrice(value, currency) {
  const number = Number(value || 0);
  const formatted = number >= 1000 ? number.toLocaleString("en-US", { maximumFractionDigits: 1 }) : number.toFixed(number >= 10 ? 2 : 3);
  return `${formatted}${currency ? ` ${currency}` : ""}`;
}

function sparklineSvg(values, up) {
  if (!values.length) return "";
  const width = 220;
  const height = 58;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points}" class="${up ? "line-up" : "line-down"}"></polyline></svg>`;
}

function candlesSvg(candles, up) {
  if (!candles.length) return "";
  const width = 220;
  const height = 54;
  const lows = candles.map((item) => item.low);
  const highs = candles.map((item) => item.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || 1;
  const step = width / candles.length;
  const bars = candles.map((item, index) => {
    const x = index * step + step / 2;
    const high = height - ((item.high - min) / span) * (height - 8) - 4;
    const low = height - ((item.low - min) / span) * (height - 8) - 4;
    const open = height - ((item.open - min) / span) * (height - 8) - 4;
    const close = height - ((item.close - min) / span) * (height - 8) - 4;
    const rising = item.close >= item.open;
    const bodyTop = Math.min(open, close);
    const bodyHeight = Math.max(2, Math.abs(close - open));
    return `<g class="${rising ? "candle-up" : "candle-down"}"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${high.toFixed(1)}" y2="${low.toFixed(1)}"></line><rect x="${(x - 3).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="6" height="${bodyHeight.toFixed(1)}"></rect></g>`;
  }).join("");
  return `<svg class="candles" viewBox="0 0 ${width} ${height}" aria-hidden="true">${bars}</svg>`;
}

function renderStudyArchive(academic, archive) {
  const studySources = [
    ...(academic.resources || []),
    ...(academic.projects || [])
  ];
  renderSourceGrid("study-source-grid", studySources.slice(0, 8));
  renderSourceGrid("archive-source-grid", archive.sources || []);
  renderArchiveGrid(archive.items || []);
}

function renderSourceGrid(id, links) {
  const grid = document.getElementById(id);
  grid.innerHTML = "";
  for (const link of links) {
    const item = document.createElement("a");
    item.href = link.url || "#";
    item.target = "_blank";
    item.rel = "noreferrer";
    item.className = "source-card";
    item.innerHTML = `
      <span>${escapeHtml(link.label || "Source")}</span>
      <strong>${escapeHtml(link.title || link.url || "")}</strong>
      <p>${escapeHtml(link.summary || "Structured source for the daily page.")}</p>
    `;
    grid.append(item);
  }
}

function renderArchiveGrid(items) {
  const grid = document.getElementById("archive-grid");
  grid.innerHTML = "";
  const fallback = [
    {
      label: "Archive",
      title: "Open a public collection",
      summary: "The workflow could not refresh archive cards this time, so the page keeps a stable public source ready.",
      url: "https://publicdomainreview.org/"
    }
  ];

  for (const item of (items.length ? items : fallback)) {
    const card = document.createElement("a");
    card.className = `archive-card${item.image ? " has-image" : ""}`;
    card.href = item.url || "#";
    card.target = "_blank";
    card.rel = "noreferrer";
    if (item.image) card.style.setProperty("--image", `url("${item.image}")`);
    card.innerHTML = `
      <span>${escapeHtml(item.label || "Archive")}</span>
      <h3>${escapeHtml(item.title || "")}</h3>
      <p>${escapeHtml(trimText(item.summary, 180))}</p>
      <em>${escapeHtml(item.meta || "")}</em>
    `;
    grid.append(card);
  }
}

function renderLinkStack(id, links) {
  const stack = document.getElementById(id);
  stack.innerHTML = "";
  for (const link of links) {
    const item = document.createElement("a");
    item.href = link.url || "#";
    item.target = "_blank";
    item.rel = "noreferrer";
    item.innerHTML = `<span>${escapeHtml(link.label || "Link")}</span><strong>${escapeHtml(link.title || link.url || "")}</strong>${link.summary ? `<p>${escapeHtml(link.summary)}</p>` : ""}`;
    stack.append(item);
  }
}

function setupLightMode() {
  const button = document.getElementById("light-toggle");
  if (!button) return;

  const updateButton = () => {
    const isLight = document.body.classList.contains("field-light");
    button.textContent = isLight ? "Dark" : "Light";
    button.dataset.tip = isLight
      ? "Hover to preview night. Click to keep the dark field."
      : "Hover to preview daylight. Click to keep the bright field.";
    button.setAttribute("aria-pressed", isLight ? "true" : "false");
  };
  const addPreview = () => {
    const isLight = document.body.classList.contains("field-light");
    document.body.classList.toggle("field-dark-preview", isLight);
    document.body.classList.toggle("field-light-preview", !isLight);
  };
  const removePreview = () => {
    document.body.classList.remove("field-light-preview", "field-dark-preview");
  };

  button.addEventListener("mouseenter", addPreview);
  button.addEventListener("mouseleave", removePreview);
  button.addEventListener("focus", addPreview);
  button.addEventListener("blur", removePreview);
  button.addEventListener("click", () => {
    removePreview();
    document.body.classList.toggle("field-light");
    updateButton();
  });
  updateButton();
}

function trimText(text, length) {
  const value = String(text || "").trim();
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelForEvent(event) {
  if (event.phase === "today") return "今天";
  if (event.phase === "before") return `${event.days} 天后`;
  return `已过 ${event.days} 天`;
}

function textForEvent(event) {
  if (event.phase === "today") return `${event.name} 今天生日`;
  if (event.phase === "before") return `${event.name} 的生日倒计时 ${event.days} 天`;
  return `${event.name} 的祝福仍可查看`;
}

function renderBirthdaySignals(events) {
  const signal = document.getElementById("birthday-signal");
  const birthdayList = document.getElementById("birthday-list");
  const birthdayHeading = document.getElementById("birthday-heading");
  const modal = document.getElementById("birthday-modal");
  const modalList = document.getElementById("modal-list");
  const modalTitle = document.getElementById("modal-title");
  const closeButton = document.getElementById("modal-close");

  if (!events.length) {
    signal.hidden = true;
    modal.hidden = true;
    return;
  }

  const todayEvents = events.filter((event) => event.phase === "today");
  signal.hidden = false;
  birthdayHeading.textContent = todayEvents.length ? "Today's signal is bright." : "A small signal is nearby.";
  birthdayList.innerHTML = "";

  for (const event of events) {
    const link = document.createElement("a");
    link.className = `birthday-chip ${event.phase}`;
    link.href = event.url;
    link.innerHTML = `<span>${labelForEvent(event)}</span><strong>${textForEvent(event)}</strong>`;
    birthdayList.append(link);
  }

  if (todayEvents.length) {
    modal.hidden = false;
    modalTitle.textContent = todayEvents.length > 1 ? "今天有几束很亮的祝福" : `${todayEvents[0].name} 今天生日`;
    modalList.innerHTML = "";
    for (const event of todayEvents) {
      const link = document.createElement("a");
      link.className = "modal-card";
      link.href = event.url;
      link.innerHTML = `<span>${event.birthdayEntry?.label || "生日"}</span><strong>${event.name}</strong><em>打开祝福页</em>`;
      modalList.append(link);
    }
  }

  closeButton.addEventListener("click", () => {
    modal.hidden = true;
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.hidden = true;
  });
}
