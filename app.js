const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d', {alpha:true});
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
const counter = document.getElementById('counter');

const sizes = {
  story: {w:1080,h:1920, frame:'assets/moldura-story.png'},
  feed:  {w:1080,h:1350, frame:'assets/moldura-feed.png'}
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

const frameImages = {};
const maskImages = {};
for (const key of Object.keys(sizes)) {
  const img = new Image();
  img.src = sizes[key].frame + '?v=10';
  frameImages[key] = img;
  const mask = new Image();
  mask.src = sizes[key].frame.replace('.png', '-mask.png') + '?v=10';
  maskImages[key] = mask;
}

function setCanvasSize() {
  const s = sizes[mode];
  canvas.width = s.w;
  canvas.height = s.h;
  draw();
}

function fitPhoto(img) {
  const s = sizes[mode];
  // Cover the entire output canvas so no bars can appear.
  baseScale = Math.max(s.w / img.naturalWidth, s.h / img.naturalHeight);
  scale = baseScale;
  x = (s.w - img.naturalWidth * scale) / 2;
  y = (s.h - img.naturalHeight * scale) / 2;
  zoom.value = 100;
  zoomValue.textContent = '100%';
}

function drawPhoto(targetCtx, w, h) {
  if (!photo) return;
  const drawW = photo.naturalWidth * scale;
  const drawH = photo.naturalHeight * scale;
  targetCtx.drawImage(photo, x, y, drawW, drawH);
}

function getOpening(mode) {
  // Coordinates are in the final 1080px canvas and match the transparent
  // opening in the supplied frame.  A 2px inset guarantees the photo never
  // crosses the frame edge, including on Android canvas export.
  if (mode === 'story') return { cx: 540, cy: 965, rx: 409, ry: 658 };
  return { cx: 542, cy: 691, rx: 404, ry: 396 };
}

function drawClippedPhoto(targetCtx, w, h) {
  if (!photo) return;

  const o = getOpening(mode);
  targetCtx.save();

  // Use a real canvas clipping path instead of destination-in compositing.
  // This is more reliable on mobile browsers when the final canvas is
  // converted to a PNG with toBlob().
  targetCtx.beginPath();
  targetCtx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
  targetCtx.clip();

  drawPhoto(targetCtx, w, h);
  targetCtx.restore();
}

function draw() {
  const s = sizes[mode];
  ctx.clearRect(0,0,s.w,s.h);

  // Photo is always drawn first and covers the whole canvas.
  if (photo) drawClippedPhoto(ctx, s.w, s.h);

  // Frame is always full-size 1080x1920 or 1080x1350.
  const frame = frameImages[mode];
  if (frame.complete && frame.naturalWidth) {
    ctx.drawImage(frame, 0, 0, s.w, s.h);
  }

  emptyState.style.display = photo ? 'none' : 'flex';
  downloadButton.disabled = !photo;
}

function setMode(next) {
  mode = next;
  const s = sizes[next];
  stage.style.aspectRatio = `${s.w} / ${s.h}`;
  counter.textContent = next === 'story' ? '2 de 2' : '1 de 2';
  feedButton.classList.toggle('active', next === 'feed');
  storyButton.classList.toggle('active', next === 'story');
  setCanvasSize();
  if (photo) fitPhoto(photo);
  hint.textContent = photo ? 'Arraste a foto para reposicionar e use o zoom.' : 'Toque em “Escolha sua foto” para começar.';
}

chooseButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (photoURL) URL.revokeObjectURL(photoURL);
  photoURL = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    photo = img;
    fitPhoto(img);
    draw();
    hint.textContent = 'Arraste a foto para reposicionar e use o zoom.';
  };
  img.src = photoURL;
});

zoom.addEventListener('input', () => {
  if (!photo) return;
  const oldScale = scale;
  const newScale = baseScale * (Number(zoom.value) / 100);
  const cx = sizes[mode].w / 2;
  const cy = sizes[mode].h / 2;
  // Keep the visual center fixed while zooming.
  x = cx - (cx - x) * (newScale / oldScale);
  y = cy - (cy - y) * (newScale / oldScale);
  scale = newScale;
  zoomValue.textContent = `${zoom.value}%`;
  draw();
});

function resetPosition() {
  if (!photo) return;
  fitPhoto(photo);
  draw();
}
resetButton.addEventListener('click', resetPosition);
centerButton.addEventListener('click', () => {
  if (!photo) return;
  const s = sizes[mode];
  x = (s.w - photo.naturalWidth * scale) / 2;
  y = (s.h - photo.naturalHeight * scale) / 2;
  draw();
});

feedButton.addEventListener('click', () => setMode('feed'));
storyButton.addEventListener('click', () => setMode('story'));

function pointerPosition(e) {
  const r = stage.getBoundingClientRect();
  const sx = sizes[mode].w / r.width;
  const sy = sizes[mode].h / r.height;
  return {x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy};
}
stage.addEventListener('pointerdown', e => {
  if (!photo) return;
  dragging = true;
  stage.setPointerCapture(e.pointerId);
  const p = pointerPosition(e);
  lastX = p.x; lastY = p.y;
});
stage.addEventListener('pointermove', e => {
  if (!dragging || !photo) return;
  const p = pointerPosition(e);
  x += p.x-lastX; y += p.y-lastY;
  lastX = p.x; lastY = p.y;
  draw();
});
stage.addEventListener('pointerup', () => dragging=false);
stage.addEventListener('pointercancel', () => dragging=false);

downloadButton.addEventListener('click', async () => {
  if (!photo) return;

  // Wait until the selected photo and the frame are decoded before exporting.
  // Android browsers can otherwise export a canvas from a previous render.
  try {
    if (photo.decode) await photo.decode();
  } catch (_) {}

  const frame = frameImages[mode];
  try {
    if (frame.decode) await frame.decode();
  } catch (_) {}

  draw();

  // Force one paint cycle before reading the canvas.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itaitinga-mtb-${mode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }, 'image/png');
});

window.addEventListener('resize', draw);
for (const img of Object.values(frameImages)) img.onload = draw;
for (const img of Object.values(maskImages)) img.onload = draw;
setMode('story');
