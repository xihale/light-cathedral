window.SHADERS ??= {};
SHADERS['fs-bake'] = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
const float HW=3.4, WH=13.4, SPR=7.5, RCY=9.6, RCR=2.45;
const float TAU=6.28318530718, PI=3.14159265359;
const vec3 SAPH=vec3(0.02,0.09,0.78), AZURE=vec3(0.03,0.34,0.95), RUBY=vec3(0.90,0.03,0.07),
           EMER=vec3(0.02,0.60,0.22), AMBER=vec3(1.0,0.52,0.04), GOLD=vec3(1.0,0.76,0.16),
           VIOL=vec3(0.44,0.07,0.75), WGOLD=vec3(1.0,0.93,0.72), ROSE=vec3(0.96,0.20,0.40);
float gLead=0., gStone=0.;
float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
vec3 voro(vec2 x){
  vec2 n=floor(x), f=fract(x), mg=vec2(0), mr=vec2(0); float md=8.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j)); vec2 r=g+h22(n+g)-f; float d=dot(r,r);
    if(d<md){md=d;mr=r;mg=g;}
  }
  md=8.;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){
    vec2 g=mg+vec2(float(i),float(j)); vec2 r=g+h22(n+g)-f;
    if(dot(mr-r,mr-r)>1e-5) md=min(md,dot(0.5*(mr+r),normalize(r-mr)));
  }
  return vec3(md,n+mg);
}
float sdBox(vec2 p,vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float ring(float d,float w){ return 1.-smoothstep(w*0.5,w,abs(d)); }

vec3 rose(vec2 rc,float r,float ang){
  float s12=ang/TAU*12.; float i12=floor(s12), f12=fract(s12);
  float dSp=min(f12,1.-f12)*(TAU/12.)*r;
  bool even=mod(i12,2.)<0.5;
  if(r>RCR-0.10 || abs(r-0.55)<0.04 || abs(r-1.55)<0.04){ gStone=1.; return vec3(0.); }
  if(r<0.55){
    vec3 col=mix(WGOLD,GOLD,smoothstep(0.08,0.5,r));
    float s24=ang/TAU*24.; float f24=fract(s24);
    float ray=step(0.5,fract(s24*0.5));
    col=mix(col,AMBER,ray*smoothstep(0.12,0.5,r)*0.85);
    float de=min(f24,1.-f24)*(TAU/24.)*r;
    gLead=max(ring(de,0.02)*step(0.14,r),0.);
    if(r>0.1){ float k=floor(s24); }
    return col;
  }
  if(r<1.55){
    if(dSp<0.03){ gStone=1.; return vec3(0.); }
    vec3 col=even?RUBY:SAPH;
    col=mix(col,GOLD,(1.-smoothstep(0.6,1.5,r))*0.45);
    float lat=(f12-0.5)*(TAU/12.)*r;
    float hw=0.21*sin(PI*clamp((r-0.66)/0.78,0.,1.));
    float dl=abs(lat)-hw;
    if(r>0.66&&r<1.44){
      if(dl<0.){ col=even?ROSE:AZURE; col=mix(col,WGOLD,0.45*(1.-smoothstep(0.66,1.44,r))); }
      gLead=ring(dl,0.03);
    }
    return col;
  }
  float cang=(i12+0.5)/12.*TAU; vec2 cp=1.95*vec2(cos(cang),sin(cang));
  float dc=length(rc-cp);
  vec3 vr=voro(rc*5.);
  vec3 col=mix(RUBY,VIOL,step(0.72,h21(vr.yz)));
  gLead=1.-smoothstep(0.03,0.08,vr.x);
  if(dc<0.37){
    col=even?EMER:AZURE; gLead=0.;
    if(dc<0.19) col=GOLD;
    if(dc<0.07) col=WGOLD;
    gLead=max(ring(dc-0.19,0.03),0.);
  }
  gLead=max(gLead,ring(dc-0.37,0.035));
  return col;
}

vec3 window(vec2 q){
  float X=q.x,Y=q.y,aX=abs(X);
  float sd;
  if(Y<SPR) sd=HW-aX; else sd=2.*HW-length(q-vec2(X<0.?HW:-HW,SPR));
  sd=min(sd,Y);
  if(sd<0.22){ gStone=1.; return vec3(0.); }
  vec2 rc=q-vec2(0.,RCY); float r=length(rc); float ang=atan(rc.y,rc.x);
  vec3 col=vec3(0.);
  if(r<RCR){ col=rose(rc,r,ang); }
  else if(Y>7.1){
    vec3 vr=voro(q*3.2); float rr=h21(vr.yz);
    col=rr<0.5?SAPH:(rr<0.75?VIOL:(rr<0.92?AZURE:GOLD));
    gLead=1.-smoothstep(0.045,0.1,vr.x);
    // 拱缘金线
    if(sd<0.45){ col=mix(GOLD,AMBER,step(0.5,fract(ang*6.))); gLead=max(ring(sd-0.45,0.03),ring(fract(ang*6.)-0.5,0.05)*0.0); }
  }
  else if(Y>6.9){ gStone=1.; }
  else{
    if(abs(aX-1.133)<0.06){ gStone=1.; return vec3(0.); }
    if(aX<1.133){
      vec3 vr=voro(q*4.6); float rr=h21(vr.yz);
      col=rr<0.6?SAPH:(rr<0.82?AZURE:(rr<0.93?VIOL:RUBY));
      gLead=1.-smoothstep(0.04,0.09,vr.x);
      // 1. 四叶花
      vec2 p=q-vec2(0.,1.3); float R=length(p);
      if(R<0.9){
        vec2 ap=abs(p); float dl=min(length(ap-vec2(0.38,0.)),length(ap-vec2(0.,0.38)));
        col=AZURE; gLead=0.;
        if(dl<0.33){ col=RUBY; if(dl<0.14) col=GOLD; if(dl<0.05) col=WGOLD; gLead=max(ring(dl-0.14,0.03),0.); }
        gLead=max(gLead,ring(dl-0.33,0.035));
      }
      gLead=max(gLead,ring(R-0.9,0.04));
      // 2. 十字圣光
      p=q-vec2(0.,3.65); R=length(p); float a2=atan(p.y,p.x);
      if(R<0.96){
        gLead=0.;
        if(R>0.82){ col=mix(GOLD,AMBER,step(0.5,fract(a2/TAU*24.))); gLead=ring(fract(a2/TAU*24.)-0.5,0.08)*0.8; }
        else{
          col=mix(SAPH,AZURE,smoothstep(0.7,0.1,R));
          float s16=a2/TAU*16.; float f16=fract(s16);
          float d=abs(f16-0.5)*(TAU/16.)*R;
          float wdt=0.05+0.075*(1.-R/0.82);
          if(d<wdt*0.55 && R>0.05){ col=mix(GOLD,WGOLD,smoothstep(0.7,0.2,R)); }
          gLead=max(gLead,ring(d-wdt*0.55,0.03)*step(0.05,R));
          float dc=min(sdBox(p-vec2(0.,-0.02),vec2(0.085,0.66)),sdBox(p-vec2(0.,0.2),vec2(0.4,0.085)));
          if(dc<0.){ col=WGOLD; if(dc<-0.04) col=vec3(1.0,0.97,0.88); }
          gLead=max(gLead,ring(dc,0.035));
        }
        gLead=max(gLead,ring(R-0.82,0.035));
      }
      gLead=max(gLead,ring(R-0.96,0.04));
      // 3. 八角星
      p=q-vec2(0.,5.95); R=length(p); float a3=atan(p.y,p.x);
      if(R<0.88){
        float Rs=0.85*mix(0.42,1.,pow(abs(cos(4.*a3)),1.4));
        gLead=0.; col=AZURE;
        if(R<Rs){ col=mix(GOLD,AMBER,step(0.5,fract(a3/TAU*16.))); if(R<0.3) col=RUBY; if(R<0.1) col=WGOLD; }
        gLead=max(ring((R-Rs)*0.8,0.035),ring(R-0.3,0.03)*step(R,Rs));
      }
      gLead=max(gLead,ring(R-0.88,0.04));
    } else {
      float dB=min(aX-1.193,3.18-aX);
      if(dB<0.17){
        float u=Y*2.4; float fu=fract(u);
        col=fu<0.5?AMBER:GOLD;
        if(abs(fract(u*0.5+0.25)-0.5)<0.0) col=SAPH;
        float dj=length(vec2(dB-0.085,(fu-0.5)*0.4167));
        if(dj<0.06){ col=SAPH; if(dj<0.025) col=WGOLD; }
        gLead=max(ring(dB-0.17,0.035),ring(fract(u+0.0)<0.5?min(fu,0.5-fu)*0.4167*2.:min(fu-0.5,1.-fu)*0.4167*2.,0.03)*0.9);
        gLead=max(gLead,ring(dj-0.06,0.03));
      } else {
        vec2 pp=vec2(X+Y,Y-X)/0.62; vec2 id=floor(pp); vec2 f=fract(pp)-0.5; float m=max(abs(f.x),abs(f.y));
        float ck=mod(id.x+id.y,2.);
        col=ck<0.5?SAPH:RUBY;
        float hr=h21(id);
        if(m<0.30){ col=hr>0.55?AMBER:(hr>0.25?EMER:VIOL); if(length(f)<0.13) col=WGOLD; }
        gLead=max(ring(m-0.30,0.05),ring(m-0.5,0.06));
        gLead=max(gLead,ring(length(f)-0.13,0.04)*step(m,0.30));
        gLead=max(gLead,ring(dB-0.17,0.035));
      }
    }
  }
  return col;
}
void main(){
  vec2 q=vec2((vUv.x-0.5)*2.*HW, vUv.y*WH);
  vec3 col=window(q);
  col*=0.8+0.4*vn(q*vec2(11.,5.))*vn(q*3.7+4.);
  col*=1.-0.96*clamp(gLead,0.,1.);
  if(gStone>0.5) col=vec3(0.);
  o=vec4(col,1.);
}`;
