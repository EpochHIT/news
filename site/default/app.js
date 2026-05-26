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
      fallbackNotes: [{ title: "读一页纸，留一张图，记录一个问题。", url: "" }]
    };
  }

  const wallpaper = feed.wallpapers?.[0];
  if (wallpaper?.url) {
    document.getElementById("wall").style.setProperty("--image", `url("${wallpaper.url}")`);
    document.getElementById("image-title").textContent = wallpaper.title || "Today's view";
    document.getElementById("image-caption").textContent = wallpaper.caption || "";
  }

  const notes = feed.notes?.length ? feed.notes : feed.fallbackNotes;
  const list = document.getElementById("notes");
  list.innerHTML = "";
  for (const note of notes.slice(0, 6)) {
    const item = document.createElement("li");
    if (note.url) {
      const link = document.createElement("a");
      link.href = note.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = note.title;
      item.append(link);
    } else {
      item.textContent = note.title;
    }
    list.append(item);
  }

  let birthdayData = { events: [] };
  try {
    const response = await fetch("data/birthdays.json", { cache: "no-store" });
    birthdayData = await response.json();
  } catch {
    birthdayData = { events: [] };
  }

  renderBirthdaySignals(birthdayData.events || []);
})();

function labelForEvent(event) {
  if (event.phase === "today") {
    return "今天";
  }
  if (event.phase === "before") {
    return `${event.days} 天后`;
  }
  return `已过 ${event.days} 天`;
}

function textForEvent(event) {
  if (event.phase === "today") {
    return `${event.name} 今天生日`;
  }
  if (event.phase === "before") {
    return `${event.name} 的生日倒计时 ${event.days} 天`;
  }
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
    if (event.target === modal) {
      modal.hidden = true;
    }
  });
}
