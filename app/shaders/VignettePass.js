// Adapted from https://github.com/mrdoob/three.js/blob/master/examples/jsm/shaders/VignetteShader.js
// Applies the vignette to the alpha channel.

import { ShaderMaterial, UniformsUtils } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VignetteShader = {
	name: 'VignetteShader',
	uniforms: {
		'tDiffuse': { value: null },
		'offset': { value: 1.0 },
		'darkness': { value: 1.0 }
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */`
		uniform float offset;
		uniform float darkness;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
		void main() {
			vec4 texel = texture2D(tDiffuse, vUv);
			vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      gl_FragColor = vec4(texel.rgb, mix(texel.a, 1.0 - darkness, dot(uv, uv)));
		}`
};

class VignettePass extends Pass {

  constructor(offset = 1.0, darkness = 1.0) {
    super();
    this.uniforms = UniformsUtils.clone(VignetteShader.uniforms);
		this.uniforms['offset'].value = offset;
		this.uniforms['darkness'].value = darkness;
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VignetteShader.vertexShader,
      fragmentShader: VignetteShader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

	render(renderer, writeBuffer, readBuffer/*, deltaTime, maskActive*/) {
		if (this.uniforms["tDiffuse"]) {
			this.uniforms["tDiffuse"].value = readBuffer.texture;
		}
		this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
		this.fsQuad.render(renderer);
	}

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

export {
	VignetteShader,
	VignettePass
};
