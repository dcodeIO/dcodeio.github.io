import { Spherical } from "three";

export const toDegrees = 180 / Math.PI;
export const toRadians = Math.PI / 180;

const twoPi = 2 * Math.PI;
const halfPi = Math.PI * 0.5;

// === Image helpers ===

/** Obtains image data given a DOM image. */
export function getImageData(image) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}

/** Obtains pixel data at relative coordiates `dx` and `dy` given image data. */
export function getPixelData(imageData, dx, dy) {
  const offset = 4 * Math.floor(dx * imageData.width) + Math.floor(dy * imageData.height) * (4 * imageData.width);
  return imageData.data.slice(offset, offset + 4);
}

// Display helpers

const prefersReducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
export const prefersReducedMotion = !prefersReducedMotionQuery || prefersReducedMotionQuery.matches;

const printMotionQuery = matchMedia("print");
export const printing = !printMotionQuery || printMotionQuery.matches;

// Audio helpers

export function preloadAudio(src) {
  const audio = new Audio();
  audio.src = src;
  audio.preload = "auto";
  return audio;
}

// === Easing functions ===

/** Cubic ease-in for `t` in [0,1]. */
export function easeIn(t) {
  return t * t * t;
}

/** Cubic ease-out for `t` in [0,1]. */
export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Cubic ease-in and -out for `t` in [0,1]. */
export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Interpolates linearly between `start` and `end` for `t` in [0,1]. */
export function lerp(start, end, t) {
  return (1 - t) * start + t * end;
}

export function clamp(num, min, max) {
  return num <= min ? min : (num >= max ? max : num);
}

// === Sphere helpers ===

/** Normalizes radians in range [0,2π]. */
function normalizeTheta(theta) {
  return theta < 0 ? theta % twoPi + twoPi : theta >= twoPi ? theta % twoPi : theta;
}

/** Converts from latitude and longitude to spherical coordinates. */
export function geoToSpherical(latlng, radius = 1) {
  // NOTE: In THREE.js, phi maps to latitude and theta maps to longitude.
  const phi = (90 - latlng[0]) * toRadians; // [90,-90] -> [0,180] -> [0,π]
  const theta = (latlng[1] + 180) * toRadians; // [-180,180] -> [0,360] -> [0,2π]
  return new Spherical(radius, phi, theta);
}

/** Converts from spherical coordinates to latitude and longitude. */
export function sphericalToGeo(spherical) {
  return [
    (halfPi - spherical.phi) * toDegrees, // [0,π] -> [π/2,-π/2] -> [90,-90]
    (normalizeTheta(spherical.theta) - Math.PI) * toDegrees // [0,2π] -> [-π,π] -> [-180,180]
  ];
}

/** Computes the latitude and longitude from a 3D surface point on a sphere. */
export function sphereToLatLng(pointOnSphere, sphereCenter) {
  return sphericalToGeo(
    new Spherical().setFromVector3(
      pointOnSphere.clone().sub(sphereCenter).normalize()
    )
  );
}

// Async helpers

export async function runTasksAsync(tasks) {
  for (let i = 0; i < tasks.length; ++i) {
    tasks[i]();
    await new Promise(resolve => setTimeout(resolve));
  }
}
