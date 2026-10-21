window.SHADERS ??= {};
SHADERS['fs-scene'] = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uTime,uFrame,uTanH,uPitch,uSun,uDens,uPre,uWinI;
uniform vec3 uL; uniform sampler2D uWin;
uniform float uQc[8]; uniform float uZk[8]; uniform float uS,uHalf;
const float W=7., H0=9., D=26., WIN_Y0=2.5, HW=3.4, WH=13.4;
const float CX=4.5, RC=0.55, PI=3.14159265;
const vec3 CAM=vec3(0.,1.65,0.);
const vec3 AVG=vec3(0.55,0.38,0.52);
const float ZK[4]=float[4](4.5,10.,15.5,21.);

float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

vec3 winTex(vec2 wq,float lod){
  vec2 uv=vec2((wq.x+HW)/(2.*HW),wq.y/WH);
  float m=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  return textureLod(uWin,clamp(uv,0.002,0.998),lod).rgb*m;
}
vec3 lightVis(vec3 P){
  float t=(D-P.z)/uL.z;
  vec3 Wp=P+uL*t;
  vec3 g=winTex(vec2(Wp.x,Wp.y-WIN_Y0),log2(1.+t*1.1));
  float q=P.x-uS*P.z;
  float sh=1.;
  for(int k=0;k<8;k++){
    float d=abs(q-uQc[k]);
    float dz=uZk[k]-P.z;
    float soft=0.05+0.012*max(dz,0.);
    sh*=1.-(1.-smoothstep(uHalf-soft,uHalf+soft,d))*smoothstep(0.,0.6,dz);
  }
  return g*sh;
}
float haze(vec3 P){
  float h=exp(-P.y*0.07);
  float n=1.+0.18*sin(P.x*0.8+P.z*0.45+uTime*0.12)*sin(P.y*0.6-uTime*0.09+P.z*0.37)
           +0.1*sin(P.x*1.9-P.z*0.9+P.y*1.3+uTime*0.2);
  return uDens*(0.5+0.5*h)*max(n,0.2);
}
void main(){
  vec2 p=vUv*2.-1.; p.x*=uRes.x/uRes.y;
  vec3 rd=normalize(vec3(p*uTanH,1.));
  float cp=cos(uPitch),sp=sin(uPitch);
  rd=vec3(rd.x,rd.y*cp+rd.z*sp,rd.z*cp-rd.y*sp);

  // ---- 几何求交 ----
  float tB=1e9; vec3 N=vec3(0,1,0); int mat=0;
  if(rd.y<-1e-4){ float t=-CAM.y/rd.y; if(t<tB){tB=t;N=vec3(0,1,0);mat=0;} }
  { float t=(D-CAM.z)/rd.z; if(t<tB){tB=t;N=vec3(0,0,-1);mat=4;} }
  if(abs(rd.x)>1e-4){ float sx=sign(rd.x); float t=(sx*W-CAM.x)/rd.x; float y=CAM.y+rd.y*t;
    if(y<H0&&t<tB){tB=t;N=vec3(-sx,0,0);mat=1;} }
  for(int s=0;s<2;s++){
    float cxx=s==0?-W:W; vec2 oc=vec2(CAM.x-cxx,CAM.y-H0); vec2 d=rd.xy;
    float a=dot(d,d),b=dot(oc,d),c=dot(oc,oc)-4.*W*W; float disc=b*b-a*c;
    if(disc>0.&&a>1e-6){ float t=(-b+sqrt(disc))/a; vec2 hp=CAM.xy+d*t;
      if(hp.y>=H0&&t<tB){tB=t;N=normalize(vec3(cxx-hp.x,H0-hp.y,0.));mat=3;} }
  }
  for(int s=0;s<2;s++) for(int k=0;k<4;k++){
    vec2 cen=vec2(s==0?-CX:CX,ZK[k]); vec2 oc=CAM.xz-cen; vec2 d=rd.xz;
    float a=dot(d,d),b=dot(oc,d),c=dot(oc,oc)-RC*RC; float disc=b*b-a*c;
    if(disc>0.){ float t=(-b-sqrt(disc))/a; if(t>0.&&t<tB){ tB=t; vec3 hp=CAM+rd*t; N=normalize(vec3(hp.x-cen.x,0.,hp.z-cen.y)); mat=2; } }
  }
  vec3 P=CAM+rd*tB;
  vec3 SUN=vec3(1.0,0.93,0.80)*uSun;

  // ---- 表面：仅靠光照显形 ----
  vec3 surf=vec3(0.);
  float footprint=tB*2.*uTanH/uRes.y/max(rd.z,0.1);
  float dwin=length(P-vec3(0.,9.2,D));
  vec3 amb=AVG*(0.010+0.6*exp(-0.30*dwin));
  if(mat==4){
    vec3 g=winTex(vec2(P.x,P.y-WIN_Y0),log2(max(1.,footprint*150.)));
    surf=g*uWinI+amb*0.35*vec3(0.5,0.55,0.7);
  } else {
    vec3 alb=vec3(0.66,0.62,0.56);
    if(mat==0){
      vec2 g=P.xz/1.8; vec2 f=abs(fract(g)-.5); float seam=smoothstep(0.47,0.5,max(f.x,f.y));
      alb*=(0.85+0.3*h21(floor(g)))*(1.-0.55*seam);
    } else if(mat==2){
      float ang=atan(N.z,N.x); vec3 T=vec3(-N.z,0.,N.x);
      N=normalize(N+T*0.3*sin(ang*18.)); alb*=0.88+0.12*cos(ang*18.);
      alb*=1.-0.5*smoothstep(0.5,0.3,P.y)*step(0.2,fract(P.y*3.));
    } else if(mat==1||mat==3){
      vec2 g=vec2(P.z/1.4,P.y/0.7); vec2 f=abs(fract(g)-.5); alb*=1.-0.35*smoothstep(0.47,0.5,f.y);
    }
    vec3 vis=lightVis(P+N*0.03);
    surf=alb*(vis*SUN*max(dot(N,uL),0.)+amb);
    if(mat==0){
      vec3 R=reflect(rd,N);
      if(R.z>0.02){
        float t=(D-P.z)/R.z; vec3 Wp=P+R*t;
        vec3 g=winTex(vec2(Wp.x,Wp.y-WIN_Y0),log2(1.+t*0.6));
        float fr=0.05+0.55*pow(1.-max(dot(-rd,N),0.),5.);
        surf+=g*uWinI*fr*0.22;
      }
    }
  }

  // ---- 丁达尔体积散射 ----
  const int STEPS=56;
  float tMax=min(tB,60.);
  float jit=ign(gl_FragCoord.xy+uFrame*5.588);
  float dt=tMax/float(STEPS);
  float cs=dot(rd,uL); float g=0.62;
  float ph=(1.-g*g)/pow(1.+g*g-2.*g*cs,1.5)/(4.*PI)+0.025;
  vec3 acc=vec3(0.); float T=1.;
  for(int i=0;i<STEPS;i++){
    float t=(float(i)+jit)*dt; vec3 Q=CAM+rd*t;
    vec3 vis=lightVis(Q);
    float dn=haze(Q);
    vec3 am=AVG*0.05*exp(-0.12*length(Q-vec3(0.,9.,D)));
    acc+=T*dn*dt*(vis*SUN*ph+am);
    T*=exp(-dn*dt*0.12);
  }
  vec3 col=surf*T+acc;
  o=vec4(col*uPre,1.);
}`;
