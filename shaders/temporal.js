window.SHADERS ??= {};
SHADERS['fs-temporal'] = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uCur,uHist; uniform float uBlend;
void main(){ o=mix(texture(uHist,vUv),texture(uCur,vUv),uBlend); }`;
