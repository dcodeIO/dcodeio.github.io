import { BufferGeometry, CircleGeometry, Color, CubicBezierCurve3, DoubleSide, Fog, ImageLoader, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Texture, Vector2, Vector3, WebGLRenderer, Object3D, UVMapping, TextureLoader } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshLine, MeshLineMaterial } from "./geometries/MeshLine.js";
import { BloomPass } from "./shaders/BloomPass.js";
import { DistortionPass } from "./shaders/DistortionPass.js";
import { GlitchPass } from "./shaders/GlitchPass.js";
import { AfterimagePass } from "./shaders/AfterimagePass.js";
import { easeIn, easeOut, getImageData, getPixelData, lerp, preloadAudio, toRadians, runTasksAsync, prefersReducedMotion } from "./utils.js";
import Stats from "three/addons/libs/stats.module.js";

const CAMERA_DISTANCE = 220;
const CAMERA_NEAR = 50;
const CAMERA_FAR = 400;
const CAMERA_ROTATION_Y = 1.1 * Math.PI;

const SPHERE_RADIUS = 80;
const LATITUDE_COUNT = 100;

const DOT_DENSITY = 0.6;
const DOT_SIZE = 0.6;
const DOT_COLOR = 0xffffff;

const SPLINE_COUNT = 30;
const SPLINE_SEGMENTS = 50;
const SPLINE_DISTANCE_MAX = SPHERE_RADIUS;

const LOGO_IMAGE = "assets/logo.png";
const MASK_IMAGE = "assets/earth.png";

const CLICK_SOUNDS = [
  preloadAudio("assets/sounds/glitch-a.ogg"),
  preloadAudio("assets/sounds/glitch-b.ogg"),
  preloadAudio("assets/sounds/glitch-c.ogg")
];
const FREAKOUT_SOUND = preloadAudio("assets/sounds/glitch-d.ogg");

let loading;

function setProgress(value) {
  if (!loading) loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "block";
    loading.style.setProperty("--progress", value);
  }
}

/** Creates the scene once prerequisites are loaded. */
async function createScene(maskImage, logoTexture) {
  setProgress(0.4);

  // Initialize transparent WebGL renderer
  const domElement = document.querySelector("header canvas");
  const renderer = new WebGLRenderer({
    canvas: domElement,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0, 0);

  // Let camera orbit around scene center
  const yAxis = new Vector3(0, 1, 0);
  const camera = new PerspectiveCamera(20, domElement.width / domElement.height, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, CAMERA_DISTANCE, 0);

  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.025;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = 0.001;
  controls.maxPolarAngle = Math.PI - controls.minPolarAngle;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;
  controls.rotateSpeed = 0.3;

  camera.position.applyAxisAngle(yAxis, CAMERA_ROTATION_Y);
  controls.update();

  // Create a foggy scene aiding our bloom effect
  const scene = new Scene();
  scene.fog = new Fog(new Color(0x070809), CAMERA_DISTANCE, CAMERA_DISTANCE + SPHERE_RADIUS);

  // Place dots on sphere where there is land
  const sphereCenter = new Vector3();
  const dotGeometries = [];
  const dotPositions = [];
  const maskImageData = getImageData(maskImage);

  // Generate sphere in chunks
  async function makeLatitudes(startLat, endLat) {
    for (let lat = startLat; lat < endLat; ++lat) {
      const latRadius = Math.cos((180 * lat / LATITUDE_COUNT - 90) * toRadians) * SPHERE_RADIUS;
      const latCircumference = 2 * Math.PI * latRadius;
      const lonCount = Math.ceil(latCircumference * DOT_DENSITY);
      for (let lon = 0; lon < lonCount; lon += 1) {
        const deltaLat = lat / LATITUDE_COUNT; // [0,1], phi = π * deltaLat
        const deltaLon = lon / lonCount; // [0,1], theta = 2π * deltaLon
        if (!getPixelData(maskImageData, deltaLon, deltaLat)[0]) continue;
        const pointOnSphere = new Vector3().setFromSphericalCoords(SPHERE_RADIUS, Math.PI * deltaLat, 2 * Math.PI * deltaLon);
        dotPositions.push(pointOnSphere);
        const dotGeometry = new CircleGeometry(DOT_SIZE, 6);
        dotGeometry.rotateZ(Math.PI * 0.5);
        dotGeometry.lookAt(pointOnSphere);
        dotGeometry.translate(pointOnSphere.x, pointOnSphere.y, pointOnSphere.z);
        dotGeometries.push(dotGeometry);
      }
    }
  }
  const tasks = [];
  let pending = 0;
  let done = 0;
  for (let iLat = 0, step = Math.ceil(LATITUDE_COUNT / 10); iLat < LATITUDE_COUNT; iLat += step) {
    ++pending;
    tasks.push(async () => {
      await makeLatitudes(iLat, iLat + Math.min(step, LATITUDE_COUNT - iLat));
      ++done;
      setProgress(0.4 + 0.6 * (done / pending));
    });
  }
  await runTasksAsync(tasks);

  // As an optimization, merge all dots into a single geometry with a shared material
  const mergedDotGeometries = mergeGeometries(dotGeometries);
  const dotMaterial = new MeshBasicMaterial({
    color: DOT_COLOR,
    side: DoubleSide,
    opacity: 0.8,
    transparent: true
  });
  const dotMesh = new Mesh(mergedDotGeometries, dotMaterial);
  dotMesh.renderOrder = 1;
  scene.add(dotMesh);

  /** Makes an elavated spline between two dots. */
  function makeSpline(start, end, color = 0xe8e8e8, minAltitude = 1.025, maxAltitude = 1.5) {
    const distanceDelta = start.distanceTo(end) / SPLINE_DISTANCE_MAX; // TODO: haversine?
    const altitude = lerp(minAltitude, maxAltitude, distanceDelta);
    const mid1 = new Vector3();
    mid1.lerpVectors(start, end, 0.25);
    mid1.lerpVectors(sphereCenter, mid1, altitude);
    const mid2 = new Vector3();
    mid2.lerpVectors(start, end, 0.75);
    mid2.lerpVectors(sphereCenter, mid2, altitude);
    const spline = new CubicBezierCurve3(start, mid1, mid2, end);
    const length = spline.getLength();
    const points = spline.getPoints(SPLINE_SEGMENTS - 1);
    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new MeshLineMaterial({
      color,
      lineWidth: 0.5,
      fog: true,
      dashArray: 2,
      dashRatio: 0.5,
      dashOffset: 0,
      alphaTest: 0.01,
      depthTest: true,
      transparent: true
    });

    const line = new MeshLine();
    line.setGeometry(geometry);
    line.setPoints(points, p => Math.max(easeOut(p), 0.2));
    const mesh = new Mesh(line, material);
    mesh.end = end;
    mesh.length = length;
    return mesh;
  }

  function getRandomDot() {
    return dotPositions[(Math.random() * dotPositions.length) | 0];
  }

  function getTargetDot(dot) {
    let target;
    do {
      target = getRandomDot();
    } while (target === dot || target.distanceTo(dot) > SPLINE_DISTANCE_MAX);
    return target;
  }

  // Add a bunch of random splines
  const lines = [];
  if (!prefersReducedMotion) {
    for (let i = 0; i < SPLINE_COUNT; ++i) {
      const p1 = getRandomDot();
      const p2 = getTargetDot(p1);
      const line = makeSpline(p1, p2, i == 0 ? 0x00d1b2 : 0xe8e8e8);
      line.material.dashOffset = -1 * Math.random();
      lines.push(line);
      scene.add(line);
    }
  }

  // Add the logo texture at the center of the sphere, facing the camera.
  const defaultLogoScale = new Vector3(1, 1, 1);
  const logoMaterial = new MeshBasicMaterial({ map: logoTexture, transparent: true });
  const logoGeometry = new PlaneGeometry(38, 38);
  const logoMesh = new Mesh(logoGeometry, logoMaterial);
  logoMesh.position.set(0, 5, 0);
  logoMesh.scale.copy(defaultLogoScale);
  logoMesh.lookAt(camera.position);
  logoMesh.renderOrder = 2;
  logoMesh.isLogo = true;
  scene.add(logoMesh);

  // Set up postprocessing pipeline
  const composer = new EffectComposer(renderer);
  composer.render = (render => function beforeRenderHook(deltaTime) {
    beforeRender();
    render.call(this, deltaTime);
  })(composer.render);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomStrength = 0.5;
  const bloomStrengthFreakout = 1.2;
  const bloomRadius = 0.02;
  const bloomRadiusFreakout = 0.05;
  const bloomThreshold = 0.797;
  const bloomThresholdFreakout = 0.1;
  const bloomPass = new BloomPass(new Vector2(domElement.width, domElement.height), bloomStrength, bloomRadius, bloomThreshold); // strength, radius, threshold
  composer.addPass(bloomPass);

  const afterImagePass = new AfterimagePass(0.6);
  composer.addPass(afterImagePass);

  const glitchPass = new GlitchPass(10);
  composer.addPass(glitchPass);

  const distortionPass = new DistortionPass();
  composer.addPass(distortionPass);

  // Make interactive
  let lastSound = -1;
  let clickTimes = [];
  let freakoutStart = 0;

  const raycaster = new Raycaster();
  raycaster.linePrecision = 0.1;
  const rayorigin = new Vector2();
  domElement.addEventListener("pointerdown", e => {
    if (prefersReducedMotion) return;
    rayorigin.set((e.offsetX * window.devicePixelRatio / domElement.width) * 2 - 1, -(e.offsetY * window.devicePixelRatio / domElement.height) * 2 + 1);
    raycaster.setFromCamera(rayorigin, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    intersects.forEach(hit => {
      if (hit.object.isLogo) {
        handleTouch();
      }
    });
  });

  function handleTouch() {
    if (freakoutStart) return;
    glitchPass.curF = 0;
    let nextSound;
    logoMesh.scale.multiplyScalar(0.7);
    while ((nextSound = (Math.random() * CLICK_SOUNDS.length) | 0) == lastSound);
    CLICK_SOUNDS[lastSound = nextSound].play()
      .catch(() => {
        // Work around DOMException on first interaction
        setTimeout(() => CLICK_SOUNDS[lastSound = nextSound].play(), 0);
      });
    const now = Date.now();
    clickTimes = clickTimes.filter(t => t + 1000 > now);
    clickTimes.push(now);
    if (clickTimes.length >= 5) {
      handleFreakout();
      clickTimes.length = 0;
    }
  }

  function handleFreakout() {
      if (freakoutStart) return;
      FREAKOUT_SOUND.play();
      freakoutStart = Date.now();
      const erraticGrow = setInterval(() => {
        const dt = Date.now() - freakoutStart;
        logoMesh.scale.multiplyScalar(0.5 + dt * 0.002);
      }, 40);
      const prevAutoRotateSpeed = controls.autoRotateSpeed;
      controls.autoRotateSpeed *= 10;
      setTimeout(() => {
        clearInterval(erraticGrow);
        controls.autoRotateSpeed = prevAutoRotateSpeed;
      }, 700);
  }

  function beforeRender() {
    if (!freakoutStart) return;
    const now = Date.now();
    let diff = now - freakoutStart;
    const time1 = 800;
    const time2 = 2300;
    const time3 = 600;
    const maxDistortion = 5;
    const maxFineDistortion = 4;
    if (diff < time1) {
      const dt = diff / time1;
      const dt_ease = easeIn(dt);
      distortionPass.uniforms.distortion.value = lerp(0, maxDistortion, dt_ease);
      distortionPass.uniforms.fineDistortion.value = lerp(0, maxFineDistortion, dt_ease);
      bloomPass.threshold = lerp(bloomThreshold, bloomThresholdFreakout, dt_ease);
      bloomPass.radius = lerp(bloomRadius, bloomRadiusFreakout, dt_ease);
      bloomPass.strength = lerp(bloomStrength, bloomStrengthFreakout, dt);
    } else if (diff < time1 + time2) {
      diff -= time1;
      const dt = diff / time2;
      const dt_ease = easeOut(dt);;
      distortionPass.uniforms.distortion.value = lerp(maxDistortion, 0, dt_ease);;
      distortionPass.uniforms.fineDistortion.value = maxFineDistortion;
      bloomPass.threshold = lerp(bloomThresholdFreakout, bloomThreshold, dt_ease);
      bloomPass.radius = lerp(bloomRadiusFreakout, bloomRadius, dt_ease);
      bloomPass.strength = lerp(bloomStrengthFreakout, bloomStrength, dt_ease);
    } else if (diff < time1 + time2 + time3) {
      diff -= time1 + time2;
      const dt = diff / time3;
      distortionPass.uniforms.distortion.value = 0;
      distortionPass.uniforms.fineDistortion.value = lerp(maxFineDistortion, 0, dt);
      bloomPass.threshold = bloomThreshold;
      bloomPass.radius = bloomRadius;
      bloomPass.strength = bloomStrength;
    } else {
      // Prior clauses are not guaranteed to execute when window is blurred
      distortionPass.uniforms.distortion.value = 0;
      distortionPass.uniforms.fineDistortion.value = 0;
      bloomPass.threshold = bloomThreshold;
      bloomPass.radius = bloomRadius;
      bloomPass.strength = bloomStrength;
      freakoutStart = 0;
    }
  }

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const stats = new Stats();
  // document.body.appendChild(stats.dom);
  let running = false;
  let lastAnimateTime = 0;

  function maybeAnimate(time) {
    if (running) animate(time * 0.001);
    requestAnimationFrame(maybeAnimate);
  }

  function animate(time) {
    const deltaTime = Math.max(time - lastAnimateTime, 0.033);
    lastAnimateTime = time;
    logoMesh.scale.lerp(defaultLogoScale, deltaTime * 4);
    Object3D.DEFAULT_UP = camera.up;
    logoMesh.lookAt(camera.position);
    distortionPass.uniforms.time.value = time * 5;

    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      let dashOffset = line.material.dashOffset;
      if (dashOffset < -1 && !line.jumped) {
        line.jumped = true;
        const start = line.end;
        const spline = makeSpline(start, getTargetDot(start));
        spline.material.color = line.material.color;
        lines.push(spline);
        scene.add(spline);
        ++i;
      } else if (dashOffset < -2) {
        lines.splice(i, 1);
        scene.remove(line);
      } else {
        line.material.dashOffset = dashOffset - deltaTime * 4 / line.length;
        ++i;
      }
    }

    controls.update();
    composer.render();

    domElement.parentNode.style.background = "none";
    loading.style.setProperty("display", "none");
    stats.update();
  }

  function resize() {
    const { width, height } = domElement.getBoundingClientRect();
    if (domElement.width != width) {
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    // Don't suppress scrolling downwards when scene fills almost
    // the entire screen.
    domElement.style.touchAction = window.innerHeight < height * 1.5 ? "pan-y" : "none";
  }

  resize();
  window.addEventListener("resize", resize);

  requestAnimationFrame(maybeAnimate);

  const observer = new IntersectionObserver(items =>
    items.forEach(({ isIntersecting }) => {
      running = isIntersecting;
    }),
    { rootMargin: "20px" }
  );
  observer.observe(renderer.domElement);
}

function load() {
  let maskImage;
  let logoTexture;
  setProgress(0.2);
  const maskImageLoader = new ImageLoader();
  maskImageLoader.load(MASK_IMAGE, function onMaskImageLoad(image) {
    if (logoTexture) createScene(image, logoTexture);
    else {
      maskImage = image;
      setProgress(0.3);
    }
  }, null, err => { throw err; });
  const logoTextureLoader = new TextureLoader();
  logoTextureLoader.load(LOGO_IMAGE, function onLogoImageLoad(image) {
    if (maskImage) createScene(maskImage, image);
    else {
      logoTexture = image;
      setProgress(0.3);
    }
  }, null, (err) => { throw err; });
}

window.addEventListener("load", load);
