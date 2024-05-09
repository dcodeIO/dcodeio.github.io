// Adapted from https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/GlitchPass.js

import { DataTexture, FloatType, MathUtils, RedFormat, LuminanceFormat, ShaderMaterial, UniformsUtils } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const GlitchShader = {

  uniforms: {
    'tDiffuse': { value: null },
    'tDisp': { value: null },
    'bypass': { value: 0 },
    'amount': { value: 0.08 },
    'angle': { value: 0.02 },
    'seed': { value: 0.02 },
    'seed_x': { value: 0.02 }, //-1,1
    'seed_y': { value: 0.02 }, //-1,1
    'distortion_x': { value: 0.5 },
    'distortion_y': { value: 0.6 },
    'col_s': { value: 0.05 }
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,

  fragmentShader: /* glsl */`
    uniform int bypass; //should we apply the glitch ?
    uniform sampler2D tDiffuse;
    uniform sampler2D tDisp;
    uniform float amount;
    uniform float angle;
    uniform float seed;
    uniform float seed_x;
    uniform float seed_y;
    uniform float distortion_x;
    uniform float distortion_y;
    uniform float col_s;
    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      if (bypass < 1) {
        vec2 p = vUv;
        float xs = floor(gl_FragCoord.x * 2.);
        float ys = floor(gl_FragCoord.y * 2.);
        float disp = texture2D(tDisp, p * seed * seed).r;
        if (p.y < distortion_x + col_s && p.y > distortion_x - col_s * seed) {
          if (seed_x > 0.){
            p.y = 1. - (p.y + distortion_y);
          } else {
            p.y = distortion_y;
          }
        }
        if (p.x < distortion_y + col_s && p.x > distortion_y - col_s * seed) {
          if (seed_y > 0.){
            p.x = distortion_x;
          } else {
            p.x = 1. - (p.x + distortion_x);
          }
        }
        p.x += disp * seed_x * (seed/5.);
        p.y += disp * seed_y * (seed/5.);
        vec2 offset = amount * vec2(cos(angle), sin(angle));
        vec4 cr = texture2D(tDiffuse, p + offset);
        vec4 cga = texture2D(tDiffuse, p);
        vec4 cb = texture2D(tDiffuse, p - offset);
        gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
      } else {
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    }`

};

class GlitchPass extends Pass {

  constructor(dt_size = 64) {
    super();
    this.uniforms = UniformsUtils.clone(GlitchShader.uniforms);
    this.heightMap = this.generateHeightmap(dt_size);
    this.uniforms['tDisp'].value = this.heightMap;
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: GlitchShader.vertexShader,
      fragmentShader: GlitchShader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.generateTrigger();
    this.curF = this.randX;
  }

  render( renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */ ) {

    if (renderer.capabilities.isWebGL2 === false) this.uniforms['tDisp'].value.format = LuminanceFormat;

    this.uniforms['tDiffuse'].value = readBuffer.texture;
    this.uniforms['seed'].value = Math.random();
    this.uniforms['bypass'].value = 0;

    if (this.curF % this.randX == 0) {
      this.uniforms['amount'].value = Math.random() / 30;
      this.uniforms['angle'].value = MathUtils.randFloat( - Math.PI, Math.PI );
      this.uniforms['seed_x'].value = MathUtils.randFloat( - 1, 1 );
      this.uniforms['seed_y'].value = MathUtils.randFloat( - 1, 1 );
      this.uniforms['distortion_x'].value = MathUtils.randFloat( 0, 1 );
      this.uniforms['distortion_y'].value = MathUtils.randFloat( 0, 1 );
      this.curF++;
      this.generateTrigger();
    } else if (this.curF % this.randX < this.randX / 5) {
      this.uniforms['amount'].value = Math.random() / 90;
      this.uniforms['angle'].value = MathUtils.randFloat( - Math.PI, Math.PI );
      this.uniforms['distortion_x'].value = MathUtils.randFloat( 0, 1 );
      this.uniforms['distortion_y'].value = MathUtils.randFloat( 0, 1 );
      this.uniforms['seed_x'].value = MathUtils.randFloat( - 0.3, 0.3 );
      this.uniforms['seed_y'].value = MathUtils.randFloat( - 0.3, 0.3 );
      this.curF += 2;
    } else {
      this.uniforms['bypass'].value = 1;
    }

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.fsQuad.render(renderer);
  }

  generateTrigger() {
    this.randX = MathUtils.randInt(120, 240);
  }

  generateHeightmap(dt_size) {
    const data_arr = new Float32Array(dt_size * dt_size);
    const length = dt_size * dt_size;
    for (let i = 0; i < length; i ++) {
      const val = MathUtils.randFloat( 0, 1 );
      data_arr[i] = val;
    }
    const texture = new DataTexture( data_arr, dt_size, dt_size, RedFormat, FloatType );
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.material.dispose();
    this.heightMap.dispose();
    this.fsQuad.dispose();
  }
}

export {
  GlitchShader,
  GlitchPass
};
