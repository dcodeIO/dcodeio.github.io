// Adapted from https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/AfterimagePass.js
// Maintains background transparency and adds a configurable damping threshold.

import { HalfFloatType, MeshBasicMaterial, NearestFilter, ShaderMaterial, UniformsUtils, WebGLRenderTarget } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const defaultDamp = 0.96;
const defaultThreshold = 0.02;

const AfterimageShader = {
	name: 'AfterimageShader',
	uniforms: {
		'damp': { value: defaultDamp },
		'threshold': { value: defaultThreshold },
		'tOld': { value: null },
		'tNew': { value: null }
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */`
		uniform float damp;
		uniform float threshold;
		uniform sampler2D tOld;
		uniform sampler2D tNew;
		varying vec2 vUv;
		vec4 when_gt(vec4 x, float y) {
			return max(sign(x - y), 0.0);
		}
		void main() {
			vec4 texelOld = texture2D(tOld, vUv);
			vec4 texelNew = texture2D(tNew, vUv);
			texelOld *= damp * when_gt(texelOld, threshold);
			gl_FragColor = max(texelNew, texelOld);
		}`
};

class AfterimagePass extends Pass {

	constructor(damp = defaultDamp, threshold = defaultThreshold) {
		super();
		this.shader = AfterimageShader;
		this.uniforms = UniformsUtils.clone(this.shader.uniforms);
		this.uniforms['damp'].value = damp;
		this.uniforms['threshold'].value = threshold;
		this.textureComp = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
			magFilter: NearestFilter,
			type: HalfFloatType
		});
		this.textureOld = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
			magFilter: NearestFilter,
			type: HalfFloatType
		});
		this.compFsMaterial = new ShaderMaterial({
			uniforms: this.uniforms,
			vertexShader: this.shader.vertexShader,
			fragmentShader: this.shader.fragmentShader
		});
		this.compFsQuad = new FullScreenQuad(this.compFsMaterial);
		this.copyFsMaterial = new MeshBasicMaterial();
		this.copyFsMaterial.transparent = true;
		this.copyFsQuad = new FullScreenQuad(this.copyFsMaterial);
	}

	render(renderer, writeBuffer, readBuffer/*, deltaTime, maskActive*/) {
		this.uniforms['tOld'].value = this.textureOld.texture;
		this.uniforms['tNew'].value = readBuffer.texture;
		renderer.setRenderTarget(this.textureComp);
		this.compFsQuad.render(renderer);
		this.copyFsQuad.material.map = this.textureComp.texture;
		if (this.renderToScreen) {
			renderer.setRenderTarget(null);
			this.copyFsQuad.render(renderer);
		} else {
			renderer.setRenderTarget(writeBuffer);
			if (this.clear) renderer.clear();
			this.copyFsQuad.render(renderer);
		}
		const temp = this.textureOld;
		this.textureOld = this.textureComp;
		this.textureComp = temp;
	}

	setSize(width, height) {
		this.textureComp.setSize(width, height);
		this.textureOld.setSize(width, height);
	}

	dispose() {
		this.textureComp.dispose();
		this.textureOld.dispose();
		this.compFsMaterial.dispose();
		this.copyFsMaterial.dispose();
		this.compFsQuad.dispose();
		this.copyFsQuad.dispose();
	}
}

export { AfterimageShader, AfterimagePass };
