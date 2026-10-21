(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('c');
const gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if(!gl){ $('err').style.display='flex'; return; }
const params=new URLSearchParams(location.search);

// ---------- GL 基础 ----------
const hdrExt=gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');
let HDR=!!hdrExt;
function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); throw new Error(gl.getShaderInfoLog(s)); } return s; }
const vsSrc=SHADERS.vs.trim();
const vs=compile(gl.VERTEX_SHADER,vsSrc);
function prog(id){
  const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,SHADERS[id].trim()));
  gl.bindAttribLocation(p,0,'aPos'); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  p._u={}; return p;
}
function U(p,n){ if(!(n in p._u)) p._u[n]=gl.getUniformLocation(p,n); return p._u[n]; }
const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
const vbo=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function makeRT(w,h,hdr){
  w=Math.max(1,w|0); h=Math.max(1,h|0);
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  if(hdr) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
  else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.viewport(0,0,w,h); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  return {tex,fbo,w,h,ok};
}
function freeRT(r){ if(!r) return; gl.deleteTexture(r.tex); gl.deleteFramebuffer(r.fbo); }
if(HDR){ const t=makeRT(4,4,true); if(!t.ok) HDR=false; freeRT(t); }

function bindTex(unit,tex){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,tex); }
function draw(target){ gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fbo:null);
  gl.viewport(0,0,target?target.w:canvas.width,target?target.h:canvas.height); gl.drawArrays(gl.TRIANGLES,0,3); }

const P={
  bake:prog('fs-bake'), scene:prog('fs-scene'), temporal:prog('fs-temporal'),
  down:prog('fs-down'), blur:prog('fs-blur'), comp:prog('fs-comp')
};

// ---------- 烘焙彩窗 ----------
const winRT=makeRT(1024,2048,false);
gl.useProgram(P.bake); draw(winRT);
gl.bindTexture(gl.TEXTURE_2D,winRT.tex); gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);

// ---------- 渲染目标 / 自适应分辨率 ----------
let q=parseFloat(params.get('q'))||(Math.min(devicePixelRatio||1,2)>1.5?0.5:0.62);
let RT={}, cw=0, ch=0, resetHist=true;
function resize(){
  const dpr=Math.min(devicePixelRatio||1,1.5);
  const w=Math.round(innerWidth*dpr), h=Math.round(innerHeight*dpr);
  const sw=Math.max(64,Math.round(w*q)), sh=Math.max(64,Math.round(h*q));
  if(w!==cw||h!==ch||!RT.S||RT.S.w!==sw){
    canvas.width=cw=w; canvas.height=ch=h;
    ['S','H0','H1','A1','A2','B1','B2','C1','C2'].forEach(k=>freeRT(RT[k]));
    RT.S=makeRT(sw,sh,HDR); RT.H0=makeRT(sw,sh,HDR); RT.H1=makeRT(sw,sh,HDR);
    RT.A1=makeRT(sw/4,sh/4,HDR); RT.A2=makeRT(sw/4,sh/4,HDR);
    RT.B1=makeRT(sw/8,sh/8,HDR); RT.B2=makeRT(sw/8,sh/8,HDR);
    RT.C1=makeRT(sw/16,sh/16,HDR); RT.C2=makeRT(sw/16,sh/16,HDR);
    resetHist=true; hi=0;
  }
}
let hi=0;
addEventListener('resize',resize); resize();

// ---------- 光照角度：陀螺仪 / 鼠标 / 自动 ----------
const DEG=Math.PI/180;
const AZ_MAX=0.78, EL_MIN=0.20, EL_MAX=1.10, EL0=0.62;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let target={az:0.25,el:EL0}, cur={az:0.25,el:EL0};
let sensorAt=-1e9, pointerAt=-1e9, base=null;
const fixed=params.has('az')||params.has('el');
if(fixed){ target.az=cur.az=parseFloat(params.get('az')||0); target.el=cur.el=parseFloat(params.get('el')||EL0); }

function onOri(e){
  if(e.beta==null||e.gamma==null) return;
  sensorAt=performance.now();
  const ang=(((screen.orientation&&screen.orientation.angle)??window.orientation??0)%360+360)%360;
  const b=e.beta,g=e.gamma; let tx,ty;
  if(ang===90){tx=b;ty=-g;} else if(ang===270){tx=-b;ty=g;} else if(ang===180){tx=-g;ty=-b;} else {tx=g;ty=b;}
  if(!base) base={tx,ty};
  const dx=tx-base.tx, dy=ty-base.ty;
  target.az=clamp(dx*DEG*0.95,-AZ_MAX,AZ_MAX);
  target.el=clamp(EL0-dy*DEG*0.95,EL_MIN,EL_MAX);
}
function onPointer(e){
  if(e.pointerType==='touch'&&performance.now()-sensorAt<1500) return;
  if(e.pointerType!=='mouse'&&e.type==='pointermove'&&e.buttons===0) return;
  pointerAt=performance.now();
  const x=e.clientX/innerWidth, y=e.clientY/innerHeight;
  target.az=clamp((x-0.5)*2*AZ_MAX,-AZ_MAX,AZ_MAX);
  target.el=clamp(EL_MIN+(1-y)*(EL_MAX-EL_MIN),EL_MIN,EL_MAX);
}
addEventListener('pointermove',onPointer); addEventListener('pointerdown',onPointer);
function recenter(){ base=null; }
$('cal').addEventListener('click',e=>{e.stopPropagation();recenter();});
let lastTap=0; addEventListener('touchend',e=>{ const n=performance.now(); if(n-lastTap<320) recenter(); lastTap=n; },{passive:true});

(async()=>{
  try{
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
      await DeviceOrientationEvent.requestPermission();
    }
  }catch(err){}
  addEventListener('deviceorientation',onOri,true);
  addEventListener('deviceorientationabsolute',e=>{ if(performance.now()-sensorAt>1500) onOri(e); },true);
  $('cal').classList.add('on');
})();

// ---------- 主循环 ----------
const ZK=[4.5,10,15.5,21], CXc=4.5, RCc=0.55;
const qc=new Float32Array(8), zk=new Float32Array(8);
let last=performance.now(), time=0, frame=0, acc=0, nacc=0, testFrames=parseInt(params.get('frames'))||0;
let prevAz=cur.az, prevEl=cur.el;
function loop(now){
  const dt=Math.min((now-last)/1000,0.1); last=now; time+=dt; frame++;

  if(!fixed){
    const sensorLive=now-sensorAt<1200, pointerLive=now-pointerAt<7000;
    if(!sensorLive&&!pointerLive){
      target.az=0.42*Math.sin(time*0.13+0.6);
      target.el=0.66+0.26*Math.sin(time*0.085);
    }
    const k=1-Math.exp(-dt*(sensorLive?9:4));
    cur.az+=(target.az-cur.az)*k; cur.el+=(target.el-cur.el)*k;
  }
  const dAng=Math.hypot(cur.az-prevAz,cur.el-prevEl); prevAz=cur.az; prevEl=cur.el;
  const L=[Math.sin(cur.az)*Math.cos(cur.el),Math.sin(cur.el),Math.cos(cur.az)*Math.cos(cur.el)];
  const s=L[0]/L[2], half=RCc*Math.sqrt(1+s*s);
  let n=0; for(const side of [-1,1]) for(const z of ZK){ qc[n]=side*CXc-s*z; zk[n]=z; n++; }

  const landscape=innerWidth>=innerHeight;
  const tanH=Math.tan((landscape?52:70)*DEG/2), pitch=(landscape?8:10)*DEG;
  const pre=HDR?1:0.2;
  const S=RT.S;

  // 1) 场景
  gl.useProgram(P.scene);
  gl.uniform2f(U(P.scene,'uRes'),S.w,S.h);
  gl.uniform1f(U(P.scene,'uTime'),time); gl.uniform1f(U(P.scene,'uFrame'),frame%1024);
  gl.uniform1f(U(P.scene,'uTanH'),tanH); gl.uniform1f(U(P.scene,'uPitch'),pitch);
  gl.uniform1f(U(P.scene,'uSun'),3.0); gl.uniform1f(U(P.scene,'uDens'),0.05);
  gl.uniform1f(U(P.scene,'uPre'),pre); gl.uniform1f(U(P.scene,'uWinI'),2.0);
  gl.uniform3f(U(P.scene,'uL'),L[0],L[1],L[2]);
  gl.uniform1fv(U(P.scene,'uQc'),qc); gl.uniform1fv(U(P.scene,'uZk'),zk);
  gl.uniform1f(U(P.scene,'uS'),s); gl.uniform1f(U(P.scene,'uHalf'),half);
  bindTex(0,winRT.tex); gl.uniform1i(U(P.scene,'uWin'),0);
  draw(S);

  // 2) 时间累积（降噪）
  const Hr=hi?RT.H1:RT.H0, Hw=hi?RT.H0:RT.H1; hi^=1;
  gl.useProgram(P.temporal);
  const blend=resetHist?1:clamp(0.14+dAng*160,0.14,0.65); resetHist=false;
  gl.uniform1f(U(P.temporal,'uBlend'),blend);
  bindTex(0,S.tex); gl.uniform1i(U(P.temporal,'uCur'),0);
  bindTex(1,Hr.tex); gl.uniform1i(U(P.temporal,'uHist'),1);
  draw(Hw);

  // 3) 泛光（三级）
  const dn=(src,dst,thr)=>{ gl.useProgram(P.down); bindTex(0,src.tex); gl.uniform1i(U(P.down,'uTex'),0);
    gl.uniform2f(U(P.down,'uTexel'),1/src.w,1/src.h); gl.uniform1f(U(P.down,'uThr'),thr*pre); draw(dst); };
  const bl=(src,dst,dx,dy)=>{ gl.useProgram(P.blur); bindTex(0,src.tex); gl.uniform1i(U(P.blur,'uTex'),0);
    gl.uniform2f(U(P.blur,'uDir'),dx/src.w,dy/src.h); draw(dst); };
  dn(Hw,RT.A1,0.15); bl(RT.A1,RT.A2,1,0); bl(RT.A2,RT.A1,0,1);
  dn(RT.A1,RT.B1,0.); bl(RT.B1,RT.B2,1,0); bl(RT.B2,RT.B1,0,1);
  dn(RT.B1,RT.C1,0.); bl(RT.C1,RT.C2,1,0); bl(RT.C2,RT.C1,0,1);

  // 4) 合成
  gl.useProgram(P.comp);
  bindTex(0,Hw.tex); gl.uniform1i(U(P.comp,'uH'),0);
  bindTex(1,RT.A1.tex); gl.uniform1i(U(P.comp,'uB1'),1);
  bindTex(2,RT.B1.tex); gl.uniform1i(U(P.comp,'uB2'),2);
  bindTex(3,RT.C1.tex); gl.uniform1i(U(P.comp,'uB3'),3);
  gl.uniform1f(U(P.comp,'uTime'),time); gl.uniform1f(U(P.comp,'uPre'),pre);
  gl.uniform1f(U(P.comp,'uExp'),parseFloat(params.get('exp'))||1.0); gl.uniform1f(U(P.comp,'uAsp'),canvas.width/canvas.height);
  draw(null);

  // 自适应画质
  if(dt>0){ acc+=dt; nacc++; if(nacc>=40&&!params.has('q')){ const avg=acc/nacc*1000; acc=0; nacc=0;
      if(avg>22&&q>0.36){ q=Math.max(0.36,q-0.08); resize(); }
      else if(avg<11.5&&q<0.95){ q=Math.min(0.95,q+0.06); resize(); } } }
  if(testFrames&&frame>=testFrames){ window.__done=true; return; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
