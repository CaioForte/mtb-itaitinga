(() => {
  const FORMATS = {
    feed:  { w: 1080, h: 1350, label: "Feed / Post" },
    story: { w: 1080, h: 1920, label: "Story" }
  };

  let format = "feed";
  let W = FORMATS.feed.w;
  let H = FORMATS.feed.h;

  const c = document.getElementById("editor");
  const ctx = c.getContext("2d", { alpha: false });

  const file = document.getElementById("file");
  const overlay = new Image();
  const photo = new Image();

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

  let ready = false;
  let url = null;
  let base = 1;
  let z = 1;
  let x = W / 2;
  let y = H / 2;

  let pointers = new Map();
  let gesture = null;

  overlay.src = "./assets/moldura.png";
  overlay.onload = draw;

  function containScale() {
    if (!photo.naturalWidth || !photo.naturalHeight) return 1;

    // A foto inteira sempre cabe no quadro.
    return Math.min(
      W / photo.naturalWidth,
      H / photo.naturalHeight
    );
  }

  function updateZoomLabel() {
    zoomOut.value = Math.round(z * 100) + "%";
  }

  function reset() {
    base = containScale();
    z = 1;
    x = W / 2;
    y = H / 2;
    zoom.value = 1;
    updateZoomLabel();
    draw();
  }

  function drawBackground(targetCtx) {
    targetCtx.fillStyle = "#111";
    targetCtx.fillRect(0, 0, W, H);
  }

  function drawPhoto(targetCtx) {
    if (!ready || !photo.complete || !photo.naturalWidth) return;

    const scale = base * z;
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;

    targetCtx.drawImage(
      photo,
      x - w / 2,
      y - h / 2,
      w,
      h
    );
  }

  function drawOverlay(targetCtx) {
    if (!overlay.complete || !overlay.naturalWidth) return;

    /*
      A moldura é preservada sem deformação.
      Para o Feed, ela ocupa exatamente 1080x1350.
      Para o Story, ela é escalada proporcionalmente para caber
      na largura, evitando esticar a arte.
    */
    let scale;

    if (format === "feed") {
      scale = Math.max(
        W / overlay.naturalWidth,
        H / overlay.naturalHeight
      );
    } else {
      // Mantém a proporção original da moldura.
      // Não estica a arte para preencher 9:16.
      scale = Math.min(
        W / overlay.naturalWidth,
        H / overlay.naturalHeight
      );
    }

    const ow = overlay.naturalWidth * scale;
    const oh = overlay.naturalHeight * scale;

    const ox = (W - ow) / 2;
    const oy = (H - oh) / 2;

    targetCtx.drawImage(
      overlay,
      ox,
      oy,
      ow,
      oh
    );
  }

  function draw() {
    c.width = W;
    c.height = H;

    drawBackground(ctx);
    drawPhoto(ctx);
    drawOverlay(ctx);
  }

  function setFormat(name) {
    format = name;

    W = FORMATS[name].w;
    H = FORMATS[name].h;

    formatButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.format === name
      );
    });

    if (ready) {
      reset();
    } else {
      draw();
    }
  }

  formatButtons.forEach(button => {
    button.addEventListener("click", () => {
      setFormat(button.dataset.format);
    });
  });

  file.onchange = () => {
    const f = file.files && file.files[0];

    if (!f || !f.type.startsWith("image/")) return;

    if (url) {
      URL.revokeObjectURL(url);
    }

    url = URL.createObjectURL(f);

    photo.onload = () => {
      ready = true;

      empty.hidden = true;
      editRow.hidden = false;
      zoomRow.hidden = false;
      formatBox.hidden = false;
      download.disabled = false;

      step.textContent = "2 de 2";
      hint.textContent =
        "Escolha Feed ou Story e ajuste sua foto.";

      reset();
    };

    photo.src = url;
  };

  zoom.oninput = () => {
    z = Number(zoom.value);
    updateZoomLabel();
    draw();
  };

  document.getElementById("reset").onclick = reset;

  document.getElementById("center").onclick = () => {
    x = W / 2;
    y = H / 2;
    draw();
  };

  function point(e) {
    const r = c.getBoundingClientRect();

    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  }

  function dist(a, b) {
    return Math.hypot(
      a.x - b.x,
      a.y - b.y
    );
  }

  c.onpointerdown = e => {
    if (!ready) return;

    c.setPointerCapture(e.pointerId);

    const p = point(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 1) {
      gesture = {
        type: "drag",
        start: p,
        x,
        y
      };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];

      gesture = {
        type: "pinch",
        distance: dist(a, b),
        zoom: z,
        x,
        y
      };
    }
  };

  c.onpointermove = e => {
    if (!pointers.has(e.pointerId) || !ready) return;

    pointers.set(e.pointerId, point(e));

    if (
      pointers.size === 1 &&
      gesture?.type === "drag"
    ) {
      const p = [...pointers.values()][0];

      x = gesture.x + p.x - gesture.start.x;
      y = gesture.y + p.y - gesture.start.y;

      draw();
    }

    if (
      pointers.size === 2 &&
      gesture?.type === "pinch"
    ) {
      const [a, b] = [...pointers.values()];

      const newZoom =
        gesture.zoom *
        dist(a, b) /
        Math.max(1, gesture.distance);

      z = Math.max(1, Math.min(3, newZoom));

      zoom.value = z;
      updateZoomLabel();
      draw();
    }
  };

  function end(e) {
    pointers.delete(e.pointerId);

    if (!pointers.size) {
      gesture = null;
    } else if (pointers.size === 1) {
      const p = [...pointers.values()][0];

      gesture = {
        type: "drag",
        start: p,
        x,
        y
      };
    }
  }

  c.onpointerup = end;
  c.onpointercancel = end;

  function canvasDataUrl() {
    draw();

    return c.toDataURL("image/jpeg", 0.95);
  }

  download.onclick = () => {
    try {
      const dataUrl = canvasDataUrl();

      const a = document.createElement("a");

      a.href = dataUrl;
      a.download = `itaitinga-mtb-race-${format}.jpg`;

      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar a foto. Tente novamente.");
    }
  };

  updateZoomLabel();
  draw();
})();
