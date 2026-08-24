(() => {
  const FORMATS = {
    feed:  { w: 1080, h: 1350, label: "Feed / Post", file: "./assets/moldura-feed.png" },
    story: { w: 1080, h: 1920, label: "Story", file: "./assets/moldura-story.png" }
  };

  let format = "feed";
  let W = FORMATS.feed.w;
  let H = FORMATS.feed.h;

  const c = document.getElementById("editor");
  const ctx = c.getContext("2d", { alpha: false });
  const file = document.getElementById("file");
  const photo = new Image();
  const overlays = { feed: new Image(), story: new Image() };

  const empty = document.getElementById("empty");
  const editRow = document.getElementById("editRow");
  const zoomRow = document.getElementById("zoomRow");
  const zoom = document.getElementById("zoom");
  const zoomOut = document.getElementById("zoomOut");
  const download = document.getElementById("download");
  const formatBox = document.getElementById("formatBox");
  const formatButtons = [...document.querySelectorAll(".format-btn")];
  const step = document.getElementById("step");
  const hint = document.getElementById("hint");
  const stage = document.getElementById("stage");

  let ready = false;
  let url = null;
  let base = 1;
  let z = 1;
  let x = W / 2;
  let y = H / 2;
  let pointers = new Map();
  let gesture = null;

  overlays.feed.src = FORMATS.feed.file;
  overlays.story.src = FORMATS.story.file;
  overlays.feed.onload = draw;
  overlays.story.onload = draw;

  function cover() {
    if (!photo.naturalWidth || !photo.naturalHeight) return 1;
    return Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
  }

  function label() {
    zoomOut.value = Math.round(z * 100) + "%";
  }

  function reset() {
    base = cover();
    z = 1;
    x = W / 2;
    y = H / 2;
    zoom.value = 1;
    label();
    draw();
  }

  function drawOverlay(targetCtx) {
    const overlay = overlays[format];
    if (!overlay.complete || !overlay.naturalWidth) return;
    targetCtx.drawImage(overlay, 0, 0, W, H);
  }

  function draw() {
    c.width = W;
    c.height = H;

    // Fundo neutro. A área central da moldura é transparente.
    ctx.fillStyle = "#111315";
    ctx.fillRect(0, 0, W, H);

    if (ready && photo.complete && photo.naturalWidth) {
      const scale = base * z;
      const w = photo.naturalWidth * scale;
      const h = photo.naturalHeight * scale;
      ctx.drawImage(photo, x - w / 2, y - h / 2, w, h);
    }

    // A moldura sempre fica por cima da foto.
    drawOverlay(ctx);
  }

  function setFormat(name) {
    if (!FORMATS[name]) return;
    format = name;
    W = FORMATS[name].w;
    H = FORMATS[name].h;
    c.width = W;
    c.height = H;
    stage.dataset.format = name;

    formatButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.format === name);
    });

    if (ready) reset();
    else draw();
  }

  formatButtons.forEach(btn => {
    btn.addEventListener("click", () => setFormat(btn.dataset.format));
  });

  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f || !f.type.startsWith("image/")) return;

    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);

    photo.onload = () => {
      ready = true;
      empty.hidden = true;
      editRow.hidden = false;
      zoomRow.hidden = false;
      formatBox.hidden = false;
      download.disabled = false;
      step.textContent = "2 de 2";
      hint.textContent = "Escolha Feed ou Story e ajuste sua foto.";
      reset();
    };

    photo.src = url;
  });

  zoom.addEventListener("input", () => {
    z = Number(zoom.value);
    label();
    draw();
  });

  document.getElementById("reset").addEventListener("click", reset);
  document.getElementById("center").addEventListener("click", () => {
    x = W / 2;
    y = H / 2;
    draw();
  });

  function point(e) {
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  c.addEventListener("pointerdown", e => {
    if (!ready) {
      file.click();
      return;
    }

    c.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, point(e));

    if (pointers.size === 1) {
      const p = point(e);
      gesture = { t: "drag", s: p, x, y };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { t: "pinch", d: dist(a, b), z, x, y };
    }
  });

  c.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId) || !ready) return;
    pointers.set(e.pointerId, point(e));

    if (pointers.size === 1 && gesture?.t === "drag") {
      const p = [...pointers.values()][0];
      x = gesture.x + p.x - gesture.s.x;
      y = gesture.y + p.y - gesture.s.y;
      draw();
    } else if (pointers.size === 2 && gesture?.t === "pinch") {
      const [a, b] = [...pointers.values()];
      z = Math.max(0.70, Math.min(3, gesture.z * dist(a, b) / Math.max(1, gesture.d)));
      zoom.value = z;
      label();
      draw();
    }
  });

  function end(e) {
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      gesture = null;
    } else if (pointers.size === 1) {
      const p = [...pointers.values()][0];
      gesture = { t: "drag", s: p, x, y };
    }
  }

  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
  c.addEventListener("lostpointercapture", end);

  function canvasBlob() {
    return new Promise((resolve, reject) => {
      draw();
      c.toBlob(blob => blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem")), "image/jpeg", 0.94);
    });
  }

  download.addEventListener("click", async () => {
    try {
      const blob = await canvasBlob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `itaitinga-mtb-race-${format}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar a foto. Tente novamente.");
    }
  });

  label();
  setFormat("feed");
})();
