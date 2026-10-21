window.SHADERS ??= {};
SHADERS['fs-down'] = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr;
void main(){
  vec3 c=vec3(0.);
  c+=texture(uTex,vUv+uTexel*vec2(-1.,-1.)).rgb; c+=texture(uTex,vUv+uTexel*vec2(1.,-1.)).rgb;
  c+=texture(uTex,vUv+uTexel*vec2(-1.,1.)).rgb;  c+=texture(uTex,vUv+uTexel*vec2(1.,1.)).rgb;
  c*=0.25; c=max(c-uThr,0.);
  o=vec4(c,1.);
}`;
