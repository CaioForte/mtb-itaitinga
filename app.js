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
  img.src = sizes[key].frame + '?v=9';
  frameImages[key] = img;
  const mask = new Image();
  mask.src = sizes[key].frame.replace('.png', '-mask.png') + '?v=9';
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

function drawClippedPhoto(targetCtx, w, h) {
  if (!photo) return;
  const mask = maskImages[mode];
  // Never draw the photo unmasked. During image loading, leaving it
  // unmasked causes the photo to briefly/incorrectly appear outside
  // the frame. Wait for the exact opening mask instead.
  if (!mask || !mask.complete || !mask.naturalWidth) {
    return;
  }
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  octx.clearRect(0, 0, w, h);
  drawPhoto(octx, w, h);
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(mask, 0, 0, w, h);
  octx.globalCompositeOperation = 'source-over';
  targetCtx.drawImage(off, 0, 0);
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

downloadButton.addEventListener('click', () => {
  if (!photo) return;

  // The preview canvas is the source of truth.  Export exactly what the
  // user sees, instead of rebuilding the composition a second time.
  // This prevents the downloaded file from ever using a different mask,
  // scale or frame position than the preview.
  draw();

  requestAnimationFrame(() => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itaitinga-mtb-${mode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  });
});

window.addEventListener('resize', draw);
for (const img of Object.values(frameImages)) img.onload = draw;
for (const img of Object.values(maskImages)) img.onload = draw;
setMode('story');
