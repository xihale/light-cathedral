window.SHADERS ??= {};
SHADERS['fs-comp'] = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uH,uB1,uB2,uB3; uniform float uTime,uPre,uExp,uAsp;
float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
vec2 h22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
void main(){
  vec3 h=texture(uH,vUv).rgb/uPre;
  vec3 b1=texture(uB1,vUv).rgb/uPre, b2=texture(uB2,vUv).rgb/uPre, b3=texture(uB3,vUv).rgb/uPre;
  vec3 col=h+b1*0.16+b2*0.22+b3*0.3;
  // 漂浮的微尘：只在光束里被点亮
  float m=0.;
  for(int k=0;k<3;k++){
    float fk=float(k);
    vec2 uv=vUv*vec2(uAsp,1.)*(16.+fk*13.);
    uv+=vec2(sin(uTime*0.25+fk*2.)*0.35,uTime*(0.035+fk*0.02));
    vec2 id=floor(uv),f=fract(uv);
    vec2 r=h22(id+fk*17.3); float d=length(f-(0.2+0.6*r));
    float rad=0.035+0.05*h21(id+3.1);
    float tw=0.55+0.45*sin(uTime*(0.7+r.x*1.8)+r.y*6.28);
    m+=smoothstep(rad,0.,d)*tw*step(0.5,h21(id+7.7))*(1.-0.22*fk);
  }
  col+=(b1*1.2+h*0.4)*m*3.0;
  vec2 dv=vUv-0.5; col*=1.-0.9*dot(dv,dv);
  col*=uExp;
  col=aces(col);
  col=pow(col,vec3(1./2.2));
  col+=(ign(gl_FragCoord.xy)-0.5)/255.;
  o=vec4(col,1.);
}`;
