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
})();
