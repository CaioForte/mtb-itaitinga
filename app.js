(() => {
  const W=1024,H=1536;
  const c=document.getElementById("editor"),ctx=c.getContext("2d",{alpha:false});
  const file=document.getElementById("file"), overlay=new Image(), photo=new Image();
  const empty=document.getElementById("empty"), editRow=document.getElementById("editRow");
  const zoomRow=document.getElementById("zoomRow"), zoom=document.getElementById("zoom"), zoomOut=document.getElementById("zoomOut");
  const download=document.getElementById("download"), share=document.getElementById("share");
  const step=document.getElementById("step"), hint=document.getElementById("hint");
  let ready=false,url=null,base=1,z=1,x=W/2,y=H/2,pointers=new Map(),gesture=null;

  overlay.src="./assets/moldura.png";
  overlay.onload=draw;

  function cover(){return Math.max(W/photo.naturalWidth,H/photo.naturalHeight)}
  function label(){zoomOut.value=Math.round(z*100)+"%"}
  function reset(){base=cover();z=1;x=W/2;y=H/2;zoom.value=1;label();draw()}
  function draw(){
    ctx.fillStyle="#111";ctx.fillRect(0,0,W,H);
    if(ready&&photo.complete){
      const w=photo.naturalWidth*base*z,h=photo.naturalHeight*base*z;
      ctx.drawImage(photo,x-w/2,y-h/2,w,h);
    }
    if(overlay.complete)ctx.drawImage(overlay,0,0,W,H);
  }
  // A área central de "Escolha sua foto" também abre a galeria/câmera.
  // O clique é disparado diretamente pela ação do usuário, funcionando em iPhone,
  // Android e navegadores de desktop.
  empty.addEventListener("click",()=>file.click());
  empty.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();file.click();}
  });

  file.onchange=()=>{
    const f=file.files&&file.files[0];if(!f||!f.type.startsWith("image/"))return;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);
    photo.onload=()=>{ready=true;empty.hidden=true;editRow.hidden=false;zoomRow.hidden=false;download.disabled=false;share.disabled=!navigator.share;step.textContent="2 de 2";hint.textContent="Arraste a foto. Use dois dedos para aproximar ou afastar.";reset()};
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

  function blob(){return new Promise(r=>c.toBlob(r,"image/jpeg",.94))}
  function canvasDataUrl() {
    draw();
    // O dataURL é mais compatível quando o site é aberto diretamente
    // pelo arquivo index.html (file://), sem um servidor.
    return c.toDataURL("image/jpeg", 0.94);
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  download.onclick=async()=>{
    try {
      const dataUrl = canvasDataUrl();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "itaitinga-mtb-race.jpg";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch(e) {
      console.error(e);
      alert("O navegador bloqueou a geração da imagem. Abra o site pelo endereço da Cloudflare e tente novamente.");
    }
  };

  share.onclick=async()=>{
    try {
      const dataUrl = canvasDataUrl();
      const b = dataUrlToBlob(dataUrl);
      const f = new File([b], "itaitinga-mtb-race.jpg", {type:"image/jpeg"});

      if(navigator.share && (!navigator.canShare || navigator.canShare({files:[f]}))) {
        await navigator.share({
          title:"Itaitinga MTB Race",
          text:"Minha foto da Itaitinga MTB Race!",
          files:[f]
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "itaitinga-mtb-race.jpg";
        a.click();
      }
    } catch(e) {
      if(e.name!=="AbortError") {
        console.error(e);
        alert("Não foi possível compartilhar a foto. Use o botão Baixar foto pronta.");
      }
    }
  };
  label();draw();
})();