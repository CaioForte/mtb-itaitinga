(() => {
  const FORMATS = {
    feed:  { w: 1080, h: 1350, label: "Feed / Post" },
    story: { w: 1080, h: 1920, label: "Story" }
  };

  let format = "feed";
  let W = FORMATS[format].w, H = FORMATS[format].h;

  const c = document.getElementById("editor");
  const ctx = c.getContext("2d", { alpha:false });
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

  // Foto transform: x/y are canvas coordinates of the photo center.
  let base = 1, z = 1, x = W/2, y = H/2;
  let pointers = new Map(), gesture = null;

  overlay.src = "./assets/moldura.png";
  overlay.onload = draw;

  function photoScale() {
    if (!photo.naturalWidth || !photo.naturalHeight) return 1;
    return Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
  }

  function updateZoomLabel() {
    zoomOut.value = Math.round(z * 100) + "%";
  }

  function reset() {
    base = photoScale();
    z = 1;
    x = W/2;
    y = H/2;
    zoom.value = 1;
    updateZoomLabel();
    draw();
  }

  // Draw the overlay exactly the same way for preview and final export.
  // It covers the complete output canvas; the transparent center remains transparent.
  function drawOverlay(target) {
    if (!overlay.complete || !overlay.naturalWidth) return;

    const scale = Math.max(W / overlay.naturalWidth, H / overlay.naturalHeight);
    const ow = overlay.naturalWidth * scale;
    const oh = overlay.naturalHeight * scale;
    const ox = (W - ow) / 2;
    const oy = (H - oh) / 2;

    target.drawImage(overlay, ox, oy, ow, oh);
  }

  function render(target) {
    target.save();
    target.clearRect(0, 0, W, H);
    target.fillStyle = "#111";
    target.fillRect(0, 0, W, H);

    if (ready && photo.complete && photo.naturalWidth) {
      const scale = base * z;
      const pw = photo.naturalWidth * scale;
      const ph = photo.naturalHeight * scale;

      // The canvas itself is the clipping boundary.
      target.save();
      target.beginPath();
      target.rect(0, 0, W, H);
      target.clip();
      target.drawImage(photo, x - pw/2, y - ph/2, pw, ph);
      target.restore();
    }

    // ALWAYS on top, and identical in preview/download.
    drawOverlay(target);
    target.restore();
  }

  function draw() {
    c.width = W;
    c.height = H;
    render(ctx);
  }

  function setFormat(name) {
    if (!FORMATS[name]) return;
    format = name;
    W = FORMATS[name].w;
    H = FORMATS[name].h;

    formatButtons.forEach(btn =>
      btn.classList.toggle("active", btn.dataset.format === format)
    );

    // Recalculate the initial cover scale for the new canvas.
    if (ready) reset();
    else draw();
  }

  formatButtons.forEach(btn =>
    btn.addEventListener("click", () => setFormat(btn.dataset.format))
  );

  file.onchange = () => {
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
  };

  zoom.oninput = () => {
    z = Number(zoom.value);
    updateZoomLabel();
    draw();
  };

  document.getElementById("reset").onclick = reset;

  document.getElementById("center").onclick = () => {
    x = W/2;
    y = H/2;
    draw();
  };

  function point(e) {
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  }

  function dist(a,b) {
    return Math.hypot(a.x-b.x, a.y-b.y);
  }

  c.onpointerdown = e => {
    if (!ready) return;

    c.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, point(e));

    if (pointers.size === 1) {
      const p = point(e);
      gesture = { t:"drag", s:p, x, y };
    } else if (pointers.size === 2) {
      const [a,b] = [...pointers.values()];
      gesture = { t:"pinch", d:dist(a,b), z, x, y };
    }
  };

  c.onpointermove = e => {
    if (!pointers.has(e.pointerId) || !ready) return;

    pointers.set(e.pointerId, point(e));

    if (pointers.size === 1 && gesture?.t === "drag") {
      const p = [...pointers.values()][0];
      x = gesture.x + p.x - gesture.s.x;
      y = gesture.y + p.y - gesture.s.y;
      draw();
    } else if (pointers.size === 2 && gesture?.t === "pinch") {
      const [a,b] = [...pointers.values()];
      z = Math.max(
        1,
        Math.min(3, gesture.z * dist(a,b) / Math.max(1, gesture.d))
      );
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
      gesture = { t:"drag", s:p, x, y };
    }
  }

  c.onpointerup = end;
  c.onpointercancel = end;

  download.onclick = () => {
    try {
      // Render into a fresh canvas so export can never inherit CSS dimensions.
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = W;
      exportCanvas.height = H;
      const exportCtx = exportCanvas.getContext("2d", { alpha:false });

      // Same renderer as preview.
      render(exportCtx);

      exportCanvas.toBlob(blob => {
        if (!blob) {
          alert("Não foi possível gerar a foto. Tente novamente.");
          return;
        }

        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `itaitinga-mtb-race-${format}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }, "image/jpeg", 0.94);
    } catch (e) {
      console.error(e);
      alert("Não foi possível gerar a foto. Tente novamente.");
    }
  };

  updateZoomLabel();
  draw();
})();
