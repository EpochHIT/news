(async function () {
  const today = new Date();
  document.getElementById("today").textContent = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });

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
  document.getElementById("story-count").textContent = String(notes.length || "--").padStart(2, "0");

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
