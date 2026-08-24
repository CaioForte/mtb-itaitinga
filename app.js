(() => {
  const FORMATS={feed:{w:1080,h:1350,file:"./assets/moldura-feed.png"},story:{w:1080,h:1920,file:"./assets/moldura-story.png"}};
  let format="feed",W=1080,H=1350;
  const c=document.getElementById("editor"),ctx=c.getContext("2d",{alpha:false});
  const file=document.getElementById("file"),photo=new Image(),overlays={feed:new Image(),story:new Image()};
  const empty=document.getElementById("empty"),editRow=document.getElementById("editRow"),zoomRow=document.getElementById("zoomRow"),zoom=document.getElementById("zoom"),zoomOut=document.getElementById("zoomOut"),download=document.getElementById("download"),formatBox=document.getElementById("formatBox"),step=document.getElementById("step"),hint=document.getElementById("hint"),stage=document.getElementById("stage");
  let ready=false,url=null,base=1,z=1,x=W/2,y=H/2,pointers=new Map(),gesture=null;
  overlays.feed.src=FORMATS.feed.file;overlays.story.src=FORMATS.story.file;overlays.feed.onload=draw;overlays.story.onload=draw;
  function cover(){return photo.naturalWidth?Math.max(W/photo.naturalWidth,H/photo.naturalHeight):1}
  function label(){zoomOut.value=Math.round(z*100)+"%"}
  function reset(){base=cover();z=1;x=W/2;y=H/2;zoom.value=1;label();draw()}
  function drawOverlay(t){const o=overlays[format];if(o.complete&&o.naturalWidth)t.drawImage(o,0,0,W,H)}
  function draw(){c.width=W;c.height=H;ctx.fillStyle="#111315";ctx.fillRect(0,0,W,H);if(ready&&photo.complete&&photo.naturalWidth){const s=base*z,w=photo.naturalWidth*s,h=photo.naturalHeight*s;ctx.drawImage(photo,x-w/2,y-h/2,w,h)}drawOverlay(ctx)}
  function setFormat(name){if(!FORMATS[name])return;format=name;W=FORMATS[name].w;H=FORMATS[name].h;stage.dataset.format=name;document.querySelectorAll(".format-btn").forEach(b=>b.classList.toggle("active",b.dataset.format===name));if(ready)reset();else draw()}
  document.querySelectorAll(".format-btn").forEach(b=>b.addEventListener("click",()=>setFormat(b.dataset.format)));
  file.addEventListener("change",()=>{const f=file.files&&file.files[0];if(!f||!f.type.startsWith("image/"))return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);photo.onload=()=>{ready=true;empty.hidden=true;editRow.hidden=false;zoomRow.hidden=false;formatBox.hidden=false;download.disabled=false;step.textContent="2 de 2";hint.textContent="Arraste, use o zoom e escolha Feed ou Story.";reset()};photo.src=url;});
  zoom.addEventListener("input",()=>{z=Number(zoom.value);label();draw()});
  document.getElementById("reset").onclick=reset;document.getElementById("center").onclick=()=>{x=W/2;y=H/2;draw()};
  function point(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  c.addEventListener("pointerdown",e=>{if(!ready)return;c.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));if(pointers.size===1){const p=point(e);gesture={t:"drag",s:p,x,y}}else if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={t:"pinch",d:dist(a,b),z,x,y}}});
  c.addEventListener("pointermove",e=>{if(!ready||!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));if(pointers.size===1&&gesture?.t==="drag"){const p=[...pointers.values()][0];x=gesture.x+p.x-gesture.s.x;y=gesture.y+p.y-gesture.s.y;draw()}else if(pointers.size===2&&gesture?.t==="pinch"){const [a,b]=[...pointers.values()];z=Math.max(.70,Math.min(3,gesture.z*dist(a,b)/Math.max(1,gesture.d)));zoom.value=z;label();draw()}});
  function end(e){pointers.delete(e.pointerId);if(!pointers.size)gesture=null;else if(pointers.size===1){const p=[...pointers.values()][0];gesture={t:"drag",s:p,x,y}}}
  c.addEventListener("pointerup",end);c.addEventListener("pointercancel",end);c.addEventListener("lostpointercapture",end);
  download.addEventListener("click",async()=>{try{draw();const blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("Falha")),"image/jpeg",.94));const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download=`itaitinga-mtb-race-${format}.jpg`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000)}catch(e){console.error(e);alert("Não foi possível gerar a foto. Tente novamente.")}});
  label();setFormat("feed");
})();