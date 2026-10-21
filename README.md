# 光之殿 · Tyndall Cathedral

WebGL2 单页视觉实验：一座哥特式教堂内的彩色玫瑰窗，阳光穿过时产生丁达尔体积散射光束，光线方向由陀螺仪（手机倾斜）或鼠标控制。

灵感来源：[Suisaeki 在 X 上的这条帖子](https://x.com/Suisaeki/status/2112523005368902054)。

## 运行

无构建、无依赖，双击 `index.html` 即可（所有 shader 以普通 `<script>` 注册到 `SHADERS` 全局，`file://` 可直接运行）。

## 结构

```
index.html        页面骨架与 <script> 装载
css/style.css
js/main.js        渲染主循环：烘焙彩窗 → 场景 → 时间累积 → 三级泛光 → 合成
shaders/*.js      GLSL（顶点 + 6 个片元阶段），字符串注册进 window.SHADERS
```

## 部署

push 到 `main` 触发 gx 上的 webhook 链自动发布到 `lc.xeed.ink`，见 `scripts/server/deploy.sh`。
