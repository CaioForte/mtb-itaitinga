(() => {
  let W = 1080;
  let H = 1350;

  const FORMATS = {
    feed: {
      w: 1080,
      h: 1350,
      label: "Feed / Post",
      overlay: "./assets/moldura-feed.png"
    },
    story: {
      w: 1080,
      h: 1920,
      label: "Story",
      overlay: "./assets/moldura-story.png"
    }
  };

  let format = "feed";

  const c = document.getElementById("editor");
  const ctx = c.getContext("2d", { alpha: false });

  const file = document.getElementById("file");
  const photo = new Image();
  const overlay = new Image();

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

  const overlayCanvas = document.createElement("canvas");
  const overlayCtx = overlayCanvas.getContext("2d");

  function loadOverlay() {
    const src = FORMATS[format].overlay;

    overlay.onload = () => {
      prepareOverlay();
      draw();
    };

    overlay.onerror = () => {
      console.error("Não foi possível carregar a moldura:", src);
    };

    overlay.src = src + "?v=" + Date.now();
  }

  /*
   * As novas molduras possuem o centro preto como área reservada
   * para a foto. Esta função transforma somente essa região preta
   * conectada ao centro em transparência.
   */
  function prepareOverlay() {
    if (!overlay.naturalWidth || !overlay.naturalHeight) return;

    overlayCanvas.width = overlay.naturalWidth;
    overlayCanvas.height = overlay.naturalHeight;

    overlayCtx.clearRect(
      0,
      0,
      overlayCanvas.width,
      overlayCanvas.height
    );

    overlayCtx.drawImage(
      overlay,
      0,
      0,
      overlay.naturalWidth,
      overlay.naturalHeight
    );

    const image = overlayCtx.getImageData(
      0,
      0,
      overlayCanvas.width,
      overlayCanvas.height
    );

    const data = image.data;
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;

    const startX = Math.floor(width / 2);
    const startY = Math.floor(height / 2);

    const startIndex = (startY * width + startX) * 4;

    if (
      data[startIndex] > 70 ||
      data[startIndex + 1] > 70 ||
      data[startIndex + 2] > 70
    ) {
      overlayCtx.putImageData(image, 0, 0);
      return;
    }

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);

    let head = 0;
    let tail = 0;

    const start = startY * width + startX;

    queue[tail++] = start;
    visited[start] = 1;

    const threshold = 70;

    while (head < tail) {
      const pos = queue[head++];

      const px = pos % width;
      const py = Math.floor(pos / width);
      const i = pos * 4;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (
        r <= threshold &&
        g <= threshold &&
        b <= threshold
      ) {
        data[i + 3] = 0;

        if (px > 0) {
          const n = pos - 1;
          if (!visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }

        if (px < width - 1) {
          const n = pos + 1;
          if (!visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }

        if (py > 0) {
          const n = pos - width;
          if (!visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }

        if (py < height - 1) {
          const n = pos + width;
          if (!visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }
    }

    overlayCtx.putImageData(image, 0, 0);
  }

  function cover() {
    if (!photo.naturalWidth || !photo.naturalHeight) {
      return 1;
    }

    return Math.max(
      W / photo.naturalWidth,
      H / photo.naturalHeight
    );
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

  function drawPhoto() {
    if (!ready || !photo.complete) return;

    const w = photo.naturalWidth * base * z;
    const h = photo.naturalHeight * base * z;

    ctx.drawImage(
      photo,
      x - w / 2,
      y - h / 2,
      w,
      h
    );
  }

  function drawOverlay() {
    if (!overlay.complete || !overlayCanvas.width) return;

    const scale = Math.min(
      W / overlay.naturalWidth,
      H / overlay.naturalHeight
    );

    const ow = overlay.naturalWidth * scale;
    const oh = overlay.naturalHeight * scale;

    const ox = (W - ow) / 2;
    const oy = (H - oh) / 2;

    ctx.drawImage(
      overlayCanvas,
      ox,
      oy,
      ow,
      oh
    );
  }

  function draw() {
    c.width = W;
    c.height = H;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);

    // A foto é desenhada primeiro.
    drawPhoto();

    // A moldura é desenhada por cima.
    drawOverlay();
  }

  function setFormat(name) {
    if (!FORMATS[name]) return;

    format = name;

    W = FORMATS[name].w;
    H = FORMATS[name].h;

    formatButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.format === name
      );
    });

    loadOverlay();

    if (ready) {
      reset();
    } else {
      draw();
    }
  }

  formatButtons.forEach(button => {
    button.addEventListener(
      "click",
      () => setFormat(button.dataset.format)
    );
  });

  file.onchange = () => {
    const f = file.files && file.files[0];

    if (!f || !f.type.startsWith("image/")) {
      return;
    }

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

  // Zoom de 50% até 300%.
  zoom.min = "0.5";
  zoom.max = "3";
  zoom.step = ".01";
  zoom.value = "1";

  zoom.oninput = () => {
    z = Number(zoom.value);

    label();
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

    pointers.set(
      e.pointerId,
      point(e)
    );

    if (pointers.size === 1) {
      const p = point(e);

      gesture = {
        t: "drag",
        s: p,
        x,
        y
      };

    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];

      gesture = {
        t: "pinch",
        d: dist(a, b),
        z,
        x,
        y
      };
    }
  };

  c.onpointermove = e => {
    if (!pointers.has(e.pointerId) || !ready) {
      return;
    }

    pointers.set(
      e.pointerId,
      point(e)
    );

    if (
      pointers.size === 1 &&
      gesture?.t === "drag"
    ) {
      const p = [...pointers.values()][0];

      x =
        gesture.x +
        p.x -
        gesture.s.x;

      y =
        gesture.y +
        p.y -
        gesture.s.y;

      draw();

    } else if (
      pointers.size === 2 &&
      gesture?.t === "pinch"
    ) {
      const [a, b] = [...pointers.values()];

      z = Math.max(
        0.5,
        Math.min(
          3,
          gesture.z *
          dist(a, b) /
          Math.max(1, gesture.d)
        )
      );

      zoom.value = z;

      label();
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
        t: "drag",
        s: p,
        x,
        y
      };
    }
  }

  c.onpointerup = end;
  c.onpointercancel = end;

  function canvasDataUrl() {
    draw();

    return c.toDataURL(
      "image/jpeg",
      0.94
    );
  }

  download.onclick = async () => {
    try {
      const dataUrl = canvasDataUrl();

      const a = document.createElement("a");

      a.href = dataUrl;
      a.download =
        `itaitinga-mtb-race-${format}.jpg`;

      a.style.display = "none";

      document.body.appendChild(a);

      a.click();
      a.remove();

    } catch (e) {
      console.error(e);

      alert(
        "Não foi possível gerar a foto. Tente novamente."
      );
    }
  };

  label();
  loadOverlay();
  draw();

})();
