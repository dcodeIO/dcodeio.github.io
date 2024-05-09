// Adapted from BadTVShader by Felix Turner, MIT License

import { ShaderMaterial, UniformsUtils } from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const DistortionShader = {
	uniforms: {
		"tDiffuse": { type: "t", value: null },
		"time": { type: "f", value: 0.0 },
		"distortion": { type: "f", value: 0 },
		"fineDistortion": { type: "f", value: 0 },
		"speed": { type: "f", value: 0.2 },
		"roll": { type: "f", value: 0 }
	},

	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,

	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float time;
		uniform float distortion;
		uniform float fineDistortion;
		uniform float speed;
		uniform float roll;
		varying vec2 vUv;

		vec3 mod289(vec3 x) {
			return x - floor(x * (1.0 / 289.0)) * 289.0;
		}

		vec2 mod289(vec2 x) {
			return x - floor(x * (1.0 / 289.0)) * 289.0;
		}

		vec3 permute(vec3 x) {
			return mod289(((x*34.0)+1.0)*x);
		}

		float snoise(vec2 v) {
			const vec4 C = vec4(
				0.211324865405187, // (3.0-sqrt(3.0))/6.0
			  0.366025403784439, // 0.5*(sqrt(3.0)-1.0)
			 -0.577350269189626, // -1.0 + 2.0 * C.x
				0.024390243902439  // 1.0 / 41.0
			);
			vec2 i = floor(v + dot(v, C.yy));
			vec2 x0 = v - i + dot(i, C.xx);
			vec2 i1;
			i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
			vec4 x12 = x0.xyxy + C.xxzz;
			x12.xy -= i1;
			i = mod289(i); // Avoid truncation effects in permutation
			vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
			vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
			m = m * m;
			m = m * m;
			vec3 x = 2.0 * fract(p * C.www) - 1.0;
			vec3 h = abs(x) - 0.5;
			vec3 ox = floor(x + 0.5);
			vec3 a0 = x - ox;
			m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
			vec3 g;
			g.x  = a0.x  * x0.x  + h.x  * x0.y;
			g.yz = a0.yz * x12.xz + h.yz * x12.yw;
			return 130.0 * dot(m, g);
		}

		void main() {
			vec2 p = vUv;
			float ty = time * speed;
			float yt = p.y - ty;
			// smooth distortion
			float offset = snoise(vec2(yt * 3.0, 0.0)) * 0.2;
			// boost distortion
			offset = offset * distortion * offset * distortion * offset;
			// add fine grain distortion
			offset += snoise(vec2(yt * 50.0, 0.0)) * fineDistortion * 0.001;
			// combine distortion on X with roll on Y
			gl_FragColor = texture2D(tDiffuse, vec2(fract(p.x + offset),fract(p.y - roll)));
		}
	`
};

class DistortionPass extends Pass {

  constructor() {
    super();
    this.uniforms = UniformsUtils.clone(DistortionShader.uniforms);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: DistortionShader.vertexShader,
      fragmentShader: DistortionShader.fragmentShader
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
	DistortionShader,
	DistortionPass
};
