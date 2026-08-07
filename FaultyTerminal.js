import { Renderer, Camera, Transform, Geometry, Program, Mesh, Vec2 } from 'ogl';

const vertexShader = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  varying vec2 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vPos;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uGridMul;
  uniform float uDigitSize;
  uniform float uTimeScale;
  uniform float uScanlineIntensity;
  uniform float uGlitchAmount;
  uniform float uFlickerAmount;
  uniform float uNoiseAmp;
  uniform float uChromaticAberration;
  uniform float uDither;
  uniform float uCurvature;
  uniform vec3 uTint;
  uniform float uMouseX;
  uniform float uMouseY;
  uniform float uMouseStrength;
  uniform float uPageLoadProgress;
  uniform float uBrightness;

  // Hash and noise functions
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float hash3D(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // Random character glyph
  float glyph(vec2 uv, float seed) {
    vec2 grid = floor(uv * 16.0);
    float h = hash(grid + seed);
    // Simple blocky character shapes
    vec2 gv = fract(uv * 16.0) - 0.5;
    float d = 0.0;

    // Random horizontal lines
    if (h > 0.1) d = max(d, 1.0 - abs(gv.y * 2.0 + h * 2.0 - 1.0) * 2.0);
    if (h > 0.3) d = max(d, 1.0 - abs(gv.x * 3.0) * 0.8);
    if (h > 0.5) d = max(d, step(0.2, abs(gv.x)) * step(0.0, gv.y) * (1.0 - abs(gv.y * 2.0 - 0.5) * 3.0));
    if (h > 0.7) d = max(d, step(0.15, abs(gv.y)) * step(abs(gv.x), 0.3));

    return smoothstep(0.15, 0.25, d) * (0.3 + h * 0.7);
  }

  void main() {
    vec2 uv = vUv;

    // CRT curvature
    vec2 curvedUV = uv * 2.0 - 1.0;
    float dist = length(curvedUV);
    curvedUV *= 1.0 + uCurvature * dist * dist;
    uv = curvedUV * 0.5 + 0.5;

    // Bounds check for curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // Mouse distortion
    float mouseDist = length(uv - vec2(uMouseX, uMouseY));
    float mouseEffect = uMouseStrength * exp(-mouseDist * 3.0);
    uv.x += mouseEffect * 0.02 * sin(uv.y * 50.0 + uTime);
    uv.y += mouseEffect * 0.01 * cos(uv.x * 50.0 + uTime);

    // Glitch: horizontal slice shifts
    float glitchLine = floor(uv.y * uResolution.y / uScale * uGridMul.y);
    float glitchHash = hash(vec2(glitchLine, floor(uTime * 3.0)));
    float glitchShift = 0.0;
    if (glitchHash < uGlitchAmount * 0.3) {
      glitchShift = (hash(vec2(glitchLine, 1.0)) - 0.5) * uGlitchAmount * 0.15;
    }
    uv.x += glitchShift;

    // Big glitch
    float bigGlitch = hash(vec2(floor(uTime * 0.5), 42.0));
    if (bigGlitch < uGlitchAmount * 0.05) {
      uv.x += (hash(vec2(glitchLine, 99.0)) - 0.5) * uGlitchAmount * 0.4;
      uv.y += (hash(vec2(glitchLine, 88.0)) - 0.5) * uGlitchAmount * 0.1;
    }

    // Scale and grid
    vec2 scaledUV = uv * uResolution / uScale;
    vec2 gridUV = scaledUV * uGridMul;

    // Character rendering
    float seed = floor(gridUV.y) * 100.0 + floor(gridUV.x) * 0.1;
    float char = glyph(fract(gridUV) / uDigitSize + 0.5 - 0.5 / uDigitSize, seed + uTime * 0.2);

    // Scanlines
    float scanline = sin(uv.y * uResolution.y * 0.7) * 0.5 + 0.5;
    scanline = mix(1.0, scanline, uScanlineIntensity);

    // Flicker
    float flicker = 1.0;
    float flickerNoise = hash(vec2(floor(uTime * 15.0), 0.0));
    if (flickerNoise < uFlickerAmount * 0.1) {
      flicker = 0.6 + flickerNoise * 0.4;
    }

    // Noise
    float n = noise(uv * uResolution / 4.0 + uTime * 0.5) * uNoiseAmp;

    // Combine
    float brightness = char * scanline * flicker + n;
    brightness = clamp(brightness, 0.0, 1.0);

    // Dither
    if (uDither > 0.0) {
      float ditherPattern = hash(floor(gl_FragCoord.xy));
      brightness = brightness > ditherPattern * uDither ? brightness : brightness * 0.5;
    }

    // Page load animation: fade/glitch in
    float loadFade = smoothstep(0.0, 0.3, uPageLoadProgress);
    float loadGlitch = smoothstep(0.2, 0.5, uPageLoadProgress);
    brightness *= loadFade;

    // Initial glitch during page load
    if (uPageLoadProgress < 0.8) {
      float initGlitch = (1.0 - uPageLoadProgress) * 0.5;
      if (hash(vec2(floor(uv.y * 30.0), 0.0)) < initGlitch) {
        brightness = hash(vec2(uv.x, uTime)) * 0.8;
      }
    }

    brightness *= uBrightness;

    // Color tint
    vec3 color = uTint * brightness;

    // Vignette
    float vignette = 1.0 - dist * 0.5;
    color *= vignette;

    // Chromatic aberration (RGB split)
    float caShift = uChromaticAberration * 0.005 * (mouseEffect + 0.2);
    if (uChromaticAberration > 0.0) {
      color.r = uTint.r * brightness;
      color.g = uTint.g * brightness * 0.7;
      color.b = uTint.b * brightness;
      // Offset red and blue channels
      float rShift = brightness * (1.0 + caShift * 2.0);
      float bShift = brightness * (1.0 - caShift * 2.0);
      color.r = uTint.r * rShift;
      color.b = uTint.b * bShift;
    }

    // Edge darkening
    float edgeDark = 1.0 - dist * dist * 0.8;
    color *= edgeDark;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default class FaultyTerminal {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      scale: 1.5,
      gridMul: [2, 1],
      digitSize: 1.2,
      timeScale: 0.5,
      pause: false,
      scanlineIntensity: 0.5,
      glitchAmount: 1,
      flickerAmount: 1,
      noiseAmp: 1,
      chromaticAberration: 0,
      dither: 0,
      curvature: 0.1,
      tint: '#A7EF9E',
      mouseReact: false,
      mouseStrength: 0.5,
      pageLoadAnimation: false,
      brightness: 0.6,
      ...options
    };

    this.time = 0;
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.targetMouseX = 0.5;
    this.targetMouseY = 0.5;
    this.pageLoadProgress = this.options.pageLoadAnimation ? 0 : 1;
    this.paused = this.options.pause;
    this.rafId = null;

    this._init();
  }

  _init() {
    // Create renderer
    this.renderer = new Renderer({
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
    });
    this.renderer.gl.canvas.style.position = 'absolute';
    this.renderer.gl.canvas.style.top = '0';
    this.renderer.gl.canvas.style.left = '0';
    this.renderer.gl.canvas.style.width = '100%';
    this.renderer.gl.canvas.style.height = '100%';
    this.renderer.gl.canvas.style.pointerEvents = 'none';
    this.container.appendChild(this.renderer.gl.canvas);

    // Camera
    this.camera = new Camera(this.renderer.gl);
    this.camera.position.z = 1;

    // Scene
    this.scene = new Transform();

    // Fullscreen quad geometry
    this.geometry = new Geometry(this.renderer.gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]) },
      uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]) },
    });

    // Parse tint color
    const tint = this.options.tint;
    const r = parseInt(tint.slice(1, 3), 16) / 255;
    const g = parseInt(tint.slice(3, 5), 16) / 255;
    const b = parseInt(tint.slice(5, 7), 16) / 255;

    // Program
    this.program = new Program(this.renderer.gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uResolution: { value: new Vec2(1, 1) },
        uTime: { value: 0 },
        uScale: { value: this.options.scale },
        uGridMul: { value: new Vec2(this.options.gridMul[0], this.options.gridMul[1]) },
        uDigitSize: { value: this.options.digitSize },
        uTimeScale: { value: this.options.timeScale },
        uScanlineIntensity: { value: this.options.scanlineIntensity },
        uGlitchAmount: { value: this.options.glitchAmount },
        uFlickerAmount: { value: this.options.flickerAmount },
        uNoiseAmp: { value: this.options.noiseAmp },
        uChromaticAberration: { value: this.options.chromaticAberration },
        uDither: { value: this.options.dither },
        uCurvature: { value: this.options.curvature },
        uTint: { value: [r, g, b] },
        uMouseX: { value: 0.5 },
        uMouseY: { value: 0.5 },
        uMouseStrength: { value: this.options.mouseStrength },
        uPageLoadProgress: { value: this.pageLoadProgress },
        uBrightness: { value: this.options.brightness },
      },
    });

    this.mesh = new Mesh(this.renderer.gl, { geometry: this.geometry, program: this.program });
    this.mesh.setParent(this.scene);

    // Resize
    this._resize();
    window.addEventListener('resize', this._resize.bind(this));

    // Mouse
    if (this.options.mouseReact) {
      window.addEventListener('mousemove', this._onMouseMove.bind(this));
    }

    // Start
    this._animate();
  }

  _resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height);
    this.program.uniforms.uResolution.value.set(width, height);
  }

  _onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.targetMouseX = (e.clientX - rect.left) / rect.width;
    this.targetMouseY = 1.0 - (e.clientY - rect.top) / rect.height;
  }

  _animate() {
    if (this.paused) {
      this.rafId = requestAnimationFrame(this._animate.bind(this));
      return;
    }

    this.time += 0.016 * this.options.timeScale;

    // Smooth mouse follow
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.1;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.1;

    // Page load animation
    if (this.pageLoadProgress < 1) {
      this.pageLoadProgress += 0.008;
      if (this.pageLoadProgress > 1) this.pageLoadProgress = 1;
    }

    // Update uniforms
    this.program.uniforms.uTime.value = this.time;
    this.program.uniforms.uMouseX.value = this.mouseX;
    this.program.uniforms.uMouseY.value = this.mouseY;
    this.program.uniforms.uPageLoadProgress.value = this.pageLoadProgress;

    // Render
    this.renderer.render({ scene: this.scene, camera: this.camera });

    this.rafId = requestAnimationFrame(this._animate.bind(this));
  }

  // Public API
  updateOptions(options = {}) {
    const o = this.options;
    Object.assign(o, options);

    if (options.scale !== undefined) this.program.uniforms.uScale.value = o.scale;
    if (options.gridMul !== undefined) this.program.uniforms.uGridMul.value.set(o.gridMul[0], o.gridMul[1]);
    if (options.digitSize !== undefined) this.program.uniforms.uDigitSize.value = o.digitSize;
    if (options.timeScale !== undefined) this.program.uniforms.uTimeScale.value = o.timeScale;
    if (options.scanlineIntensity !== undefined) this.program.uniforms.uScanlineIntensity.value = o.scanlineIntensity;
    if (options.glitchAmount !== undefined) this.program.uniforms.uGlitchAmount.value = o.glitchAmount;
    if (options.flickerAmount !== undefined) this.program.uniforms.uFlickerAmount.value = o.flickerAmount;
    if (options.noiseAmp !== undefined) this.program.uniforms.uNoiseAmp.value = o.noiseAmp;
    if (options.chromaticAberration !== undefined) this.program.uniforms.uChromaticAberration.value = o.chromaticAberration;
    if (options.dither !== undefined) this.program.uniforms.uDither.value = o.dither;
    if (options.curvature !== undefined) this.program.uniforms.uCurvature.value = o.curvature;
    if (options.tint !== undefined) {
      const r = parseInt(o.tint.slice(1, 3), 16) / 255;
      const g = parseInt(o.tint.slice(3, 5), 16) / 255;
      const b = parseInt(o.tint.slice(5, 7), 16) / 255;
      this.program.uniforms.uTint.value = [r, g, b];
    }
    if (options.mouseStrength !== undefined) this.program.uniforms.uMouseStrength.value = o.mouseStrength;
    if (options.brightness !== undefined) this.program.uniforms.uBrightness.value = o.brightness;
    if (options.pause !== undefined) this.paused = o.pause;
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._resize.bind(this));
    window.removeEventListener('mousemove', this._onMouseMove.bind(this));
    if (this.renderer.gl.canvas.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas);
    }
  }
}
