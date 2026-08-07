import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uTrailSize;
  uniform float uGridSize;
  uniform float uGooStrength;
  uniform bool uGooeyEnabled;
  uniform vec2 uPoints[32];
  uniform float uPointAges[32];
  uniform float uMaxAge;
  uniform int uPointCount;

  // Smooth minimum for gooey/metaball effect
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  void main() {
    vec2 uv = vUv;

    // Quantize to grid for pixel effect
    vec2 gridUV = floor(uv * uGridSize) / uGridSize;
    float aspect = uResolution.x / uResolution.y;

    float d = 1e10;
    float totalWeight = 0.0;

    for (int i = 0; i < 32; i++) {
      if (i >= uPointCount) break;

      float age = uPointAges[i];
      float alpha = 1.0 - age / uMaxAge;
      if (alpha <= 0.0) continue;

      vec2 p = uPoints[i];
      vec2 dp = gridUV - p;
      dp.x *= aspect;
      float dist = length(dp);

      // Metaball field
      float r = uTrailSize * (0.5 + alpha * 0.5);
      float field = r / max(dist, 0.001);

      if (uGooeyEnabled) {
        d = smin(d, 1.0 / field, uGooStrength * r);
      } else {
        d = min(d, dist / r);
      }

      totalWeight += alpha;
    }

    float brightness;
    if (uGooeyEnabled) {
      brightness = 1.0 - d;
    } else {
      brightness = exp(-d * 3.0);
    }

    brightness = clamp(brightness, 0.0, 1.0);

    // Edge glow
    float glow = brightness * brightness;

    vec3 color = uColor * glow;
    color += uColor * brightness * 0.3;

    // Vignette
    float vignette = 1.0 - length(vUv - 0.5) * 0.3;
    color *= vignette;

    gl_FragColor = vec4(color, brightness * 0.9);
  }
`;

export default class PixelTrail {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      gridSize: 50,
      trailSize: 0.1,
      maxAge: 250,
      interpolate: 5,
      color: '#06B6D4',
      gooeyEnabled: true,
      gooStrength: 2,
      ...options
    };

    // Trail state
    this.points = [];
    this.pointAges = [];
    this.targetPoints = [];
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.lastMouseX = 0.5;
    this.lastMouseY = 0.5;
    this.isMouseDown = false;
    this.maxPoints = 32;

    this._init();
  }

  _init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // Parse color
    const c = new THREE.Color(this.options.color);

    // Uniform data arrays
    this.pointData = new Float32Array(this.maxPoints * 2);
    this.ageData = new Float32Array(this.maxPoints);

    // Shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
        uTrailSize: { value: this.options.trailSize },
        uGridSize: { value: this.options.gridSize },
        uGooStrength: { value: this.options.gooStrength },
        uGooeyEnabled: { value: this.options.gooeyEnabled },
        uPoints: { value: new Float32Array(this.maxPoints * 2) },
        uPointAges: { value: new Float32Array(this.maxPoints) },
        uMaxAge: { value: this.options.maxAge / 1000.0 },
        uPointCount: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    // Fullscreen quad
    const geom = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.scene.add(this.mesh);

    // Resize
    this._resize();
    window.addEventListener('resize', this._resize.bind(this));

    // Mouse events on the container
    this.container.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.container.addEventListener('mouseenter', this._onMouseEnter.bind(this));
    this.container.addEventListener('mouseleave', this._onMouseLeave.bind(this));
    this.container.addEventListener('mousedown', () => { this.isMouseDown = true; });
    

    // Touch support
    this.container.addEventListener('touchmove', this._onTouchMove.bind(this));
    this.container.addEventListener('touchstart', () => { this.isMouseDown = true; });
    

    // Animation loop
    this.clock = new THREE.Clock();
    this.rafId = requestAnimationFrame(this._animate.bind(this));
  }

  _resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.material.uniforms.uResolution.value.set(w, h);
  }

  _getUV(e) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1.0 - (e.clientY - rect.top) / rect.height,
    };
  }

  _onMouseMove(e) {
    const uv = this._getUV(e);
    this.mouseX = uv.x;
    this.mouseY = uv.y;
  }

  _onTouchMove(e) {
    if (e.touches.length > 0) {
      const uv = this._getUV(e.touches[0]);
      this.mouseX = uv.x;
      this.mouseY = uv.y;
    }
  }

  _onMouseEnter(e) {
    const uv = this._getUV(e);
    this.mouseX = uv.x;
    this.mouseY = uv.y;
    this.lastMouseX = this.mouseX;
    this.lastMouseY = this.mouseY;
  }

  _onMouseLeave() {
    this.mouseX = -1;
    this.mouseY = -1;
  }

  _addPoint(x, y) {
    const points = this.material.uniforms.uPoints.value;
    const ages = this.material.uniforms.uPointAges.value;

    // Shift existing points
    for (let i = this.maxPoints - 1; i > 0; i--) {
      points[i * 2] = points[(i - 1) * 2];
      points[i * 2 + 1] = points[(i - 1) * 2 + 1];
      ages[i] = ages[i - 1];
    }

    // Add new point at front
    points[0] = x;
    points[1] = y;
    ages[0] = 0;

    // Update count
    const count = this.material.uniforms.uPointCount.value;
    this.material.uniforms.uPointCount.value = Math.min(count + 1, this.maxPoints);
  }

  _animate() {
    const dt = this.clock.getDelta();

    // Interpolate mouse
    const lerp = this.options.interpolate * dt * 10;
    this.lastMouseX += (this.mouseX - this.lastMouseX) * Math.min(lerp, 1);
    this.lastMouseY += (this.mouseY - this.lastMouseY) * Math.min(lerp, 1);

    // Add points along the mouse trail
    if (this.mouseX >= 0 && this.mouseY >= 0 && this.isMouseDown) {
      this._addPoint(this.lastMouseX, this.lastMouseY);
    }

    // Age existing points
    const ages = this.material.uniforms.uPointAges.value;
    let activeCount = 0;
    for (let i = 0; i < this.material.uniforms.uPointCount.value; i++) {
      ages[i] += dt;
      if (ages[i] < this.options.maxAge / 1000.0) {
        activeCount++;
      }
    }
    this.material.uniforms.uPointCount.value = activeCount;

    // Render
    this.material.uniforms.uTime.value += dt;
    this.renderer.render(this.scene, this.camera);

    this.rafId = requestAnimationFrame(this._animate.bind(this));
  }

  // Public API
  updateOptions(options = {}) {
    Object.assign(this.options, options);

    if (options.color !== undefined) {
      const c = new THREE.Color(options.color);
      this.material.uniforms.uColor.value.set(c.r, c.g, c.b);
    }
    if (options.trailSize !== undefined) this.material.uniforms.uTrailSize.value = options.trailSize;
    if (options.gridSize !== undefined) this.material.uniforms.uGridSize.value = options.gridSize;
    if (options.gooStrength !== undefined) this.material.uniforms.uGooStrength.value = options.gooStrength;
    if (options.gooeyEnabled !== undefined) this.material.uniforms.uGooeyEnabled.value = options.gooeyEnabled;
    if (options.maxAge !== undefined) this.material.uniforms.uMaxAge.value = options.maxAge / 1000.0;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._resize.bind(this));
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.renderer.dispose();
  }
}
