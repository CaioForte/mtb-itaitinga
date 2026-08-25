const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

const stage = document.getElementById('previewStage');
const fileInput = document.getElementById('fileInput');
const chooseButton = document.getElementById('chooseButton');
const emptyState = document.getElementById('emptyState');

const zoom = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');

const feedButton = document.getElementById('feedButton');
const storyButton = document.getElementById('storyButton');

const resetButton = document.getElementById('resetButton');
const centerButton = document.getElementById('centerButton');
const downloadButton = document.getElementById('downloadButton');
const hint = document.getElementById('hint');

/*
  IMPORTANTE:
  As molduras corretas já possuem a área da foto transparente.
  Portanto, NÃO fazemos nenhum recorte oval/ellipse na foto.

  A foto é desenhada primeiro ocupando o canvas e, depois,
  a moldura original é desenhada por cima. A transparência da
  própria PNG da moldura define exatamente onde a foto aparece.
*/

const sizes = {
  story: {
    w: 1080,
    h: 1920,
    frame: 'assets/moldura-story.png'
  },
  feed: {
    w: 1080,
    h: 1350,
    frame: 'assets/moldura-feed.png'
  }
};

let mode = 'story';

let photo = null;
let photoURL = null;

let scale = 1;
let baseScale = 1;
let x = 0;
let y = 0;

let dragging = false;
let lastX = 0;
let lastY = 0;

const frameImages = {};

for (const key of Object.keys(sizes)) {
  const img = new Image();

  // Evita problemas de cache ao trocar/atualizar a moldura.
  img.src = `${sizes[key].frame}?v=11`;

  frameImages[key] = img;
}

/* =========================================================
   CANVAS
   ========================================================= */

function setCanvasSize() {
  const s = sizes[mode];

  canvas.width = s.w;
  canvas.height = s.h;

  draw();
}

/* =========================================================
   AJUSTE DA FOTO
   ========================================================= */

function fitPhoto(img) {
  const s = sizes[mode];

  /*
    A foto cobre todo o canvas.
    Isso evita barras vazias quando a proporção da foto
    for diferente da proporção da moldura.
  */
  baseScale = Math.max(
    s.w / img.naturalWidth,
    s.h / img.naturalHeight
  );

  scale = baseScale;

  x = (s.w - img.naturalWidth * scale) / 2;
  y = (s.h - img.naturalHeight * scale) / 2;

  zoom.value = 100;
  zoomValue.textContent = '100%';
}

function drawPhoto(targetCtx) {
  if (!photo) return;

  const drawW = photo.naturalWidth * scale;
  const drawH = photo.naturalHeight * scale;

  targetCtx.drawImage(
    photo,
    x,
    y,
    drawW,
    drawH
  );
}

/* =========================================================
   DESENHO FINAL
   ========================================================= */

function draw() {
  const s = sizes[mode];

  // Limpa completamente o canvas.
  ctx.clearRect(0, 0, s.w, s.h);

  /*
    1. Foto primeiro.
    A foto NÃO recebe clip(), ellipse() ou qualquer recorte.
  */
  if (photo) {
    drawPhoto(ctx);
  }

  /*
    2. Moldura original por cima.

    A PNG possui transparência na região destinada à foto.
    É essa transparência que faz o recorte correto,
    incluindo todos os respingos e detalhes irregulares.
  */
  const frame = frameImages[mode];

  if (frame.complete && frame.naturalWidth > 0) {
    ctx.drawImage(
      frame,
      0,
      0,
      s.w,
      s.h
    );
  }

  emptyState.style.display = photo ? 'none' : 'flex';
  downloadButton.disabled = !photo;
}

/* =========================================================
   MODO FEED / STORY
   ========================================================= */

function setMode(next) {
  mode = next;

  const s = sizes[next];

  stage.style.aspectRatio = `${s.w} / ${s.h}`;

  feedButton.classList.toggle('active', next === 'feed');
  storyButton.classList.toggle('active', next === 'story');

  setCanvasSize();

  if (photo) {
    fitPhoto(photo);
    draw();
  }

  hint.textContent = photo
    ? 'Arraste a foto para reposicionar e use o zoom.'
    : 'Toque em “Escolha sua foto” para começar.';
}

/* =========================================================
   ESCOLHER FOTO
   ========================================================= */

chooseButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', event => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (photoURL) {
    URL.revokeObjectURL(photoURL);
  }

  photoURL = URL.createObjectURL(file);

  const img = new Image();

  img.onload = () => {
    photo = img;

    fitPhoto(img);
    draw();

    hint.textContent =
      'Arraste a foto para reposicionar e use o zoom.';
  };

  img.src = photoURL;
});

/* =========================================================
   ZOOM
   ========================================================= */

zoom.addEventListener('input', () => {
  if (!photo) return;

  const oldScale = scale;

  const newScale =
    baseScale * (Number(zoom.value) / 100);

  const s = sizes[mode];

  const cx = s.w / 2;
  const cy = s.h / 2;

  /*
    Mantém o centro visual da foto enquanto o zoom é alterado.
  */
  x = cx - (cx - x) * (newScale / oldScale);
  y = cy - (cy - y) * (newScale / oldScale);

  scale = newScale;

  zoomValue.textContent = `${zoom.value}%`;

  draw();
});

/* =========================================================
   REAJUSTAR
   ========================================================= */

function resetPosition() {
  if (!photo) return;

  fitPhoto(photo);
  draw();
}

resetButton.addEventListener('click', resetPosition);

/* =========================================================
   CENTRALIZAR
   ========================================================= */

centerButton.addEventListener('click', () => {
  if (!photo) return;

  const s = sizes[mode];

  x = (s.w - photo.naturalWidth * scale) / 2;
  y = (s.h - photo.naturalHeight * scale) / 2;

  draw();
});

/* =========================================================
   TROCAR FORMATO
   ========================================================= */

feedButton.addEventListener('click', () => {
  setMode('feed');
});

storyButton.addEventListener('click', () => {
  setMode('story');
});

/* =========================================================
   ARRASTAR FOTO
   ========================================================= */

function pointerPosition(event) {
  const rect = stage.getBoundingClientRect();

  const sx = sizes[mode].w / rect.width;
  const sy = sizes[mode].h / rect.height;

  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy
  };
}

stage.addEventListener('pointerdown', event => {
  if (!photo) return;

  dragging = true;

  stage.setPointerCapture(event.pointerId);

  const p = pointerPosition(event);

  lastX = p.x;
  lastY = p.y;
});

stage.addEventListener('pointermove', event => {
  if (!dragging || !photo) return;

  const p = pointerPosition(event);

  x += p.x - lastX;
  y += p.y - lastY;

  lastX = p.x;
  lastY = p.y;

  draw();
});

stage.addEventListener('pointerup', event => {
  dragging = false;

  try {
    stage.releasePointerCapture(event.pointerId);
  } catch (_) {}
});

stage.addEventListener('pointercancel', event => {
  dragging = false;

  try {
    stage.releasePointerCapture(event.pointerId);
  } catch (_) {}
});

/* =========================================================
   DOWNLOAD
   ========================================================= */

downloadButton.addEventListener('click', async () => {
  if (!photo) return;

  const frame = frameImages[mode];

  /*
    Aguarda as imagens estarem realmente decodificadas.
    Isso evita que o Android exporte uma versão anterior
    da moldura.
  */
  try {
    if (photo.decode) {
      await photo.decode();
    }
  } catch (_) {}

  try {
    if (frame.decode) {
      await frame.decode();
    }
  } catch (_) {}

  // Redesenha antes da exportação.
  draw();

  /*
    Aguarda dois ciclos de renderização.
    Isso é importante principalmente no Chrome Android.
  */
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

  canvas.toBlob(blob => {
    if (!blob) return;

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = `itaitinga-mtb-${mode}.png`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 3000);
  }, 'image/png');
});

/* =========================================================
   EVENTOS DA MOLDURA
   ========================================================= */

for (const img of Object.values(frameImages)) {
  img.onload = () => {
    draw();
  };

  img.onerror = () => {
    console.error('Não foi possível carregar a moldura:', img.src);
  };
}

window.addEventListener('resize', () => {
  draw();
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

setMode('story');
