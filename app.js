(() => {
  let W=1080,H=1350;
  const FORMATS={feed:{w:1080,h:1350,label:"Feed / Post"},story:{w:1080,h:1920,label:"Story"}};
  let format="feed";
  const c=document.getElementById("editor"),ctx=c.getContext("2d",{alpha:false});
  const file=document.getElementById("file"), overlay=new Image(), photo=new Image();
  const empty=document.getElementById("empty"), editRow=document.getElementById("editRow");
  const zoomRow=document.getElementById("zoomRow"), zoom=document.getElementById("zoom"), zoomOut=document.getElementById("zoomOut");
  const download=document.getElementById("download");
  const formatBox=document.getElementById("formatBox");
  const formatButtons=[...document.querySelectorAll(".format-btn")];
  const step=document.getElementById("step"), hint=document.getElementById("hint");
  let ready=false,url=null,base=1,z=1,x=W/2,y=H/2,pointers=new Map(),gesture=null;

  overlay.src="./assets/moldura.png";
  overlay.onload=draw;

  function cover(){return Math.max(W/photo.naturalWidth,H/photo.naturalHeight)}
  function label(){zoomOut.value=Math.round(z*100)+"%"}
  function reset(){base=cover();z=1;x=W/2;y=H/2;zoom.value=1;label();draw()}
  function drawOverlay(targetCtx){
    if(!overlay.complete)return;
    // Mantém a arte original inteira, sem cortar elementos.
    const scale=Math.min(W/overlay.naturalWidth,H/overlay.naturalHeight);
    const ow=overlay.naturalWidth*scale, oh=overlay.naturalHeight*scale;
    const ox=(W-ow)/2, oy=(H-oh)/2;
    targetCtx.drawImage(overlay,ox,oy,ow,oh);
  }
  function draw(){
    c.width=W;c.height=H;
    ctx.fillStyle="#111";ctx.fillRect(0,0,W,H);
    if(ready&&photo.complete){
      const w=photo.naturalWidth*base*z,h=photo.naturalHeight*base*z;
      ctx.drawImage(photo,x-w/2,y-h/2,w,h);
    }
    drawOverlay(ctx);
  }
  function setFormat(name){
    format=name;
    W=FORMATS[name].w;H=FORMATS[name].h;
    formatButtons.forEach(b=>b.classList.toggle("active",b.dataset.format===name));
    if(ready)reset(); else draw();
  }
  formatButtons.forEach(b=>b.addEventListener("click",()=>setFormat(b.dataset.format)));

  // A área central de "Escolha sua foto" também abre a galeria/câmera.
  // O clique é disparado diretamente pela ação do usuário, funcionando em iPhone,
  // Android e navegadores de desktop.

  file.onchange=()=>{
    const f=file.files&&file.files[0];if(!f||!f.type.startsWith("image/"))return;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);
    photo.onload=()=>{ready=true;empty.hidden=true;editRow.hidden=false;zoomRow.hidden=false;formatBox.hidden=false;download.disabled=false;step.textContent="2 de 2";hint.textContent="Escolha Feed ou Story e ajuste sua foto.";reset()};
    photo.src=url;
  };
  zoom.oninput=()=>{z=+zoom.value;label();draw()};
  document.getElementById("reset").onclick=reset;
  document.getElementById("center").onclick=()=>{x=W/2;y=H/2;draw()};

  function point(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

  c.onpointerdown=e=>{
    if(!ready)return;c.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));
    if(pointers.size===1){const p=point(e);gesture={t:"drag",s:p,x,y}}
    else if(pointers.size===2){const [a,b]=[...pointers.values()];gesture={t:"pinch",d:dist(a,b),z,x,y}}
  };
  c.onpointermove=e=>{
    if(!pointers.has(e.pointerId)||!ready)return;pointers.set(e.pointerId,point(e));
    if(pointers.size===1&&gesture?.t==="drag"){
      const p=[...pointers.values()][0];x=gesture.x+p.x-gesture.s.x;y=gesture.y+p.y-gesture.s.y;draw();
    }else if(pointers.size===2&&gesture?.t==="pinch"){
      const [a,b]=[...pointers.values()];z=Math.max(1,Math.min(3,gesture.z*dist(a,b)/Math.max(1,gesture.d)));zoom.value=z;label();draw();
    }
  };
  function end(e){pointers.delete(e.pointerId);if(!pointers.size)gesture=null;else if(pointers.size===1){const p=[...pointers.values()][0];gesture={t:"drag",s:p,x,y}}}
  c.onpointerup=end;c.onpointercancel=end;

  function canvasDataUrl() {
    draw();
    return c.toDataURL("image/jpeg", 0.94);
  }

  download.onclick=async()=>{
    try {
      const dataUrl=canvasDataUrl();
      const a=document.createElement("a");
      a.href=dataUrl;
      a.download=`itaitinga-mtb-race-${format}.jpg`;
      a.style.display="none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch(e) {
      console.error(e);
      alert("Não foi possível gerar a foto. Tente novamente.");
    }
  };

  label();draw();
})();