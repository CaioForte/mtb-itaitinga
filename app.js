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
let x = 0;
let y = 0;

let baseScale = 1;

let dragging = false;
let lastX = 0;
let lastY = 0;


/* =========================================================
   IMAGENS DAS MOLDURAS E MÁSCARAS
   ========================================================= */

const frameImages = {};
const maskImages = {};

for (const key of Object.keys(sizes)) {

  // Moldura
  const frame = new Image();

  frame.onload = () => {
    draw();
  };

  frame.src = sizes[key].frame + '?v=11';

  frameImages[key] = frame;


  // Máscara da abertura
  const mask = new Image();

  mask.onload = () => {
    draw();
  };

  mask.src =
    sizes[key].frame.replace('.png', '-mask.png') + '?v=11';

  maskImages[key] = mask;
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
   AJUSTE INICIAL DA FOTO
   ========================================================= */

function fitPhoto(img) {

  const s = sizes[mode];

  /*
   * Faz a foto cobrir todo o canvas.
   * Isso evita espaços vazios quando a foto é menor
   * que a área de saída.
   */

  baseScale = Math.max(
    s.w / img.naturalWidth,
    s.h / img.naturalHeight
  );

  scale = baseScale;

  x =
    (s.w - img.naturalWidth * scale) / 2;

  y =
    (s.h - img.naturalHeight * scale) / 2;

  zoom.value = 100;
  zoomValue.textContent = '100%';
}


/* =========================================================
   DESENHA A FOTO
   ========================================================= */

function drawPhoto(targetCtx, w, h) {

  if (!photo) return;

  const drawW =
    photo.naturalWidth * scale;

  const drawH =
    photo.naturalHeight * scale;

  targetCtx.drawImage(
    photo,
    x,
    y,
    drawW,
    drawH
  );
}


/* =========================================================
   APLICA A MÁSCARA REAL DA MOLDURA
   ========================================================= */

const photoLayer = document.createElement('canvas');

const photoLayerCtx =
  photoLayer.getContext('2d', {
    alpha: true
  });


function drawClippedPhoto(targetCtx, w, h) {

  if (!photo) return;

  const mask = maskImages[mode];

  /*
   * Se a máscara ainda não terminou de carregar,
   * não tenta desenhar.
   */

  if (
    !mask.complete ||
    !mask.naturalWidth
  ) {
    return;
  }


  /*
   * Garante que o canvas auxiliar tenha
   * exatamente o tamanho da saída.
   */

  if (
    photoLayer.width !== w ||
    photoLayer.height !== h
  ) {

    photoLayer.width = w;
    photoLayer.height = h;
  }


  /*
   * Limpa o canvas auxiliar.
   */

  photoLayerCtx.clearRect(
    0,
    0,
    w,
    h
  );


  /*
   * Desenha a foto normalmente.
   */

  drawPhoto(
    photoLayerCtx,
    w,
    h
  );


  /*
   * A máscara define exatamente onde
   * a foto pode aparecer.
   *
   * A área transparente da máscara
   * remove a foto.
   */

  photoLayerCtx.save();

  photoLayerCtx.globalCompositeOperation =
    'destination-in';

  photoLayerCtx.drawImage(
    mask,
    0,
    0,
    w,
    h
  );

  photoLayerCtx.restore();


  /*
   * Coloca a foto já recortada
   * no canvas principal.
   */

  targetCtx.drawImage(
    photoLayer,
    0,
    0
  );
}


/* =========================================================
   DESENHO COMPLETO
   ========================================================= */

function draw() {

  const s = sizes[mode];

  ctx.clearRect(
    0,
    0,
    s.w,
    s.h
  );


  /*
   * 1 - Foto
   * A foto é desenhada primeiro.
   */

  if (photo) {

    drawClippedPhoto(
      ctx,
      s.w,
      s.h
    );
  }


  /*
   * 2 - Moldura
   * A moldura fica por cima da foto.
   */

  const frame =
    frameImages[mode];

  if (
    frame.complete &&
    frame.naturalWidth
  ) {

    ctx.drawImage(
      frame,
      0,
      0,
      s.w,
      s.h
    );
  }


  /*
   * Estado inicial da tela.
   */

  emptyState.style.display =
    photo ? 'none' : 'flex';

  downloadButton.disabled =
    !photo;
}


/* =========================================================
   ALTERAR FORMATO
   ========================================================= */

function setMode(next) {

  mode = next;

  const s = sizes[next];

  stage.style.aspectRatio =
    `${s.w} / ${s.h}`;


  /*
   * Contador removido.
   */


  feedButton.classList.toggle(
    'active',
    next === 'feed'
  );

  storyButton.classList.toggle(
    'active',
    next === 'story'
  );


  setCanvasSize();


  if (photo) {
    fitPhoto(photo);
  }


  hint.textContent =
    photo
      ? 'Arraste a foto para reposicionar e use o zoom.'
      : 'Toque em “Escolha sua foto” para começar.';
}


/* =========================================================
   ESCOLHER FOTO
   ========================================================= */

chooseButton.addEventListener(
  'click',
  () => fileInput.click()
);


fileInput.addEventListener(
  'change',
  e => {

    const file =
      e.target.files?.[0];

    if (!file) return;


    /*
     * Libera a URL anterior.
     */

    if (photoURL) {

      URL.revokeObjectURL(
        photoURL
      );
    }


    photoURL =
      URL.createObjectURL(file);


    const img =
      new Image();


    img.onload = () => {

      photo = img;

      fitPhoto(img);

      draw();


      hint.textContent =
        'Arraste a foto para reposicionar e use o zoom.';
    };


    img.src =
      photoURL;
  }
);


/* =========================================================
   ZOOM
   ========================================================= */

zoom.addEventListener(
  'input',
  () => {

    if (!photo) return;


    const oldScale =
      scale;


    const newScale =
      baseScale *
      (Number(zoom.value) / 100);


    const cx =
      sizes[mode].w / 2;

    const cy =
      sizes[mode].h / 2;


    /*
     * Mantém o centro visual da foto
     * enquanto o zoom é alterado.
     */

    x =
      cx -
      (cx - x) *
      (newScale / oldScale);

    y =
      cy -
      (cy - y) *
      (newScale / oldScale);


    scale =
      newScale;


    zoomValue.textContent =
      `${zoom.value}%`;


    draw();
  }
);


/* =========================================================
   REAJUSTAR
   ========================================================= */

function resetPosition() {

  if (!photo) return;

  fitPhoto(photo);

  draw();
}


resetButton.addEventListener(
  'click',
  resetPosition
);


/* =========================================================
   CENTRALIZAR
   ========================================================= */

centerButton.addEventListener(
  'click',
  () => {

    if (!photo) return;


    const s =
      sizes[mode];


    x =
      (s.w -
        photo.naturalWidth * scale) / 2;


    y =
      (s.h -
        photo.naturalHeight * scale) / 2;


    draw();
  }
);


/* =========================================================
   BOTÕES FEED / STORY
   ========================================================= */

feedButton.addEventListener(
  'click',
  () => setMode('feed')
);


storyButton.addEventListener(
  'click',
  () => setMode('story')
);


/* =========================================================
   POSIÇÃO DO MOUSE / TOUCH
   ========================================================= */

function pointerPosition(e) {

  const r =
    stage.getBoundingClientRect();


  const sx =
    sizes[mode].w / r.width;

  const sy =
    sizes[mode].h / r.height;


  return {
    x:
      (e.clientX - r.left) * sx,

    y:
      (e.clientY - r.top) * sy
  };
}


/* =========================================================
   ARRASTAR FOTO
   ========================================================= */

stage.addEventListener(
  'pointerdown',
  e => {

    if (!photo) return;


    dragging = true;


    stage.setPointerCapture(
      e.pointerId
    );


    const p =
      pointerPosition(e);


    lastX = p.x;
    lastY = p.y;
  }
);


stage.addEventListener(
  'pointermove',
  e => {

    if (
      !dragging ||
      !photo
    ) {
      return;
    }


    const p =
      pointerPosition(e);


    x +=
      p.x - lastX;

    y +=
      p.y - lastY;


    lastX = p.x;
    lastY = p.y;


    draw();
  }
);


stage.addEventListener(
  'pointerup',
  () => {
    dragging = false;
  }
);


stage.addEventListener(
  'pointercancel',
  () => {
    dragging = false;
  }
);


/* =========================================================
   DOWNLOAD
   ========================================================= */

downloadButton.addEventListener(
  'click',
  async () => {

    if (!photo) return;


    /*
     * Aguarda a foto terminar de decodificar.
     */

    try {

      if (photo.decode) {
        await photo.decode();
      }

    } catch (_) {}


    /*
     * Aguarda a moldura.
     */

    const frame =
      frameImages[mode];

    try {

      if (frame.decode) {
        await frame.decode();
      }

    } catch (_) {}


    /*
     * Aguarda a máscara.
     */

    const mask =
      maskImages[mode];

    try {

      if (mask.decode) {
        await mask.decode();
      }

    } catch (_) {}


    /*
     * Redesenha tudo antes de exportar.
     */

    draw();


    /*
     * Dá dois ciclos de renderização
     * para garantir compatibilidade
     * com navegadores Android.
     */

    await new Promise(
      resolve => {

        requestAnimationFrame(
          () => {

            requestAnimationFrame(
              resolve
            );

          }
        );

      }
    );


    /*
     * Exporta o canvas.
     */

    canvas.toBlob(
      blob => {

        if (!blob) return;


        const url =
          URL.createObjectURL(blob);


        const a =
          document.createElement('a');


        a.href = url;


        a.download =
          `itaitinga-mtb-${mode}.png`;


        document.body.appendChild(a);


        a.click();


        a.remove();


        setTimeout(
          () => {
            URL.revokeObjectURL(url);
          },
          3000
        );

      },
      'image/png'
    );
  }
);


/* =========================================================
   REDESENHAR AO REDIMENSIONAR
   ========================================================= */

window.addEventListener(
  'resize',
  draw
);


/* =========================================================
   QUANDO AS IMAGENS DAS MOLDURAS CARREGAREM
   ========================================================= */

for (
  const img of Object.values(frameImages)
) {

  img.onload = draw;
}


for (
  const img of Object.values(maskImages)
) {

  img.onload = draw;
}


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

setMode('story');
