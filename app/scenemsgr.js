import { PerspectiveCamera, WebGLRenderer, Scene, Sprite, TextureLoader, SpriteMaterial, Fog, Vector3 } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { AfterimagePass } from "./shaders/AfterimagePass.js";
import { VignettePass } from "./shaders/VignettePass.js";
import Stats from "three/addons/libs/stats.module.js";

const WIDTH = 600;
const HEIGHT = 250;
const SPRITES = 200;
const CHANGEDELAY = 5000;
const VIEWDISTANCE = 2000;
const CENTEROFFSET = 100;

const textureLoader = new TextureLoader();
let messageTex;
const materials = [
  messageTex = new SpriteMaterial({ map: textureLoader.load("assets/message-solid.svg"), color: 0xeeeeee }),
  messageTex,
  new SpriteMaterial({ map: textureLoader.load("assets/message-lock.svg"), color: 0xeeeeee })
];
const platformMaterials = [
  new SpriteMaterial({ map: textureLoader.load("assets/message-android.svg"), color: 0xcccccc, opacity: 0.8 }),
  new SpriteMaterial({ map: textureLoader.load("assets/message-ios.svg"), color: 0xcccccc, opacity: 0.8 }),
  new SpriteMaterial({ map: textureLoader.load("assets/message-chrome.svg"), color: 0xcccccc, opacity: 0.8 })
];

function updateMaterial(sprite) {
  let index;
  const numMaterials = materials.length;
  do {
    index = (Math.random() * (numMaterials + 1)) | 0;
  } while (index == sprite.current);
  if (index == numMaterials) {
    sprite.material = platformMaterials[sprite.platform];
  } else {
    sprite.material = materials[index];
  }
  sprite.current = index;
  sprite.nextChange = Date.now() + CHANGEDELAY + Math.random() * CHANGEDELAY;
}

addEventListener("load", () => {
  const camera = new PerspectiveCamera(75, WIDTH / HEIGHT, 1, VIEWDISTANCE);
  camera.position.set(0, 0, VIEWDISTANCE);
  camera.lookAt(0, 0, 0);
  const scene = new Scene();
  scene.fog = new Fog(0x060708, VIEWDISTANCE * 0.5, VIEWDISTANCE);
  const sprites = [];
  for (let i = 0; i < SPRITES; ++i) {
    const sprite = new Sprite(materials[0]);
    sprite.platform = (Math.random() * platformMaterials.length) | 0;
    sprite.current = -1;
    updateMaterial(sprite);
    let x, y;
    do {
      x = (Math.random() * 2 - 1) * 5 * WIDTH;
      y = (Math.random() * 2 - 1) * HEIGHT;
    } while (x * x + y * y < CENTEROFFSET * CENTEROFFSET);
    sprite.position.x = x;
    sprite.position.y = y;
    sprite.position.z = i / SPRITES * VIEWDISTANCE;
    sprite.scale.x = 252;
    sprite.scale.y = 198;
    sprite.scale.multiplyScalar(0.75 - Math.random() * 0.25);
    sprite.initialX = x;
    sprite.initialY = y;
    sprite.initialScale = sprite.scale.y;
    scene.add(sprite);
    sprites.push(sprite);
  }

  const canvas = document.getElementById("msgr");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.touchAction = "pan-y";
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0, 0);
  // renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(WIDTH, HEIGHT, false);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const vignettePass = new VignettePass(1.4);
  composer.addPass(vignettePass);
  const afterImagePass = new AfterimagePass(0.9);
  composer.addPass(afterImagePass);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  composer.setSize(WIDTH, HEIGHT, false);

  const pointer = new Vector3(0, 0, VIEWDISTANCE);
  function updatePointer(evt) {
    pointer.x = -evt.offsetX / WIDTH + 0.5;
    pointer.y = evt.offsetY / HEIGHT - 0.5;
  }
  canvas.addEventListener("pointerdown", updatePointer);
  canvas.addEventListener("pointermove", updatePointer);

  let running = false;
  const stats = new Stats();
  stats.dom.style.marginLeft = "100px";
  // document.body.appendChild(stats.dom);
  let lastAnimateTime = 0;
  const pointerTemp = new Vector3();
  function animate(time) {
    requestAnimationFrame(animate);
    if (!running) return;
    const now = Date.now();
    const deltaTime = Math.max(time - lastAnimateTime, 0.033);
    lastAnimateTime = time;
    sprites.forEach(sprite => {
      const zPos = sprite.position.z;
      sprite.position.z = zPos > VIEWDISTANCE
        ? zPos % VIEWDISTANCE
        : zPos + deltaTime * 0.1;
      if (now > sprite.nextChange) updateMaterial(sprite);
      if (sprite.current == materials.length - 1) sprite.visible = (time + sprite.nextChange) % 1000 > 500;
      else sprite.visible = true;
    });
    pointerTemp.copy(pointer);
    pointerTemp.x *= 50;
    pointerTemp.y *= 50;
    camera.position.lerp(pointerTemp, 0.05);
    camera.rotation.x = Math.cos(time * 0.0004) * 0.15;
    camera.rotation.z = Math.sin(time * 0.0005) * 0.1;
    composer.render();
    stats.update();
  }
  requestAnimationFrame(animate);

  const observer = new IntersectionObserver(items =>
    items.forEach(({ isIntersecting }) => {
      running = isIntersecting;
    }),
    { rootMargin: "20px" }
  );
  observer.observe(canvas);
});

