// Motor WebGL del orbe (raymarching volumétrico). Depende de SMOKE_PALETTE.

/**
 * ==========================================================================
 * MOTOR DE SHADER GLSL PROCEDIMENTAL 3D — EL ORBE MÁGICO DEL PENSADERO
 * ==========================================================================
 * Renderiza un orbe volumétrico fluido en WebGL con Simplex/Perlin noise 3D,
 * dispersión de partículas, pulsos armónicos y transición dinámica de uniforms.
 */
class PensaderoShaderEngine {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.animId = null;
    this.startTime = Date.now();
    this.uniforms = {};

    this.current = {
      color: [0.88, 0.91, 0.94],
      coreColor: [0.5, 0.55, 0.65],
      turbulence: 0.15,
      pulse: 0.0,
      density: 0.75,
      dissipation: 0.5,
      satellites: 0.0,
      sink: 0.0,
      expansion: 0.0,
      flash: 0.0,
      multiColor: 1.0
    };
    this.target = { ...this.current };
    this.activeCategory = 'humo_general';
  }

  init(canvas) {
    if (!canvas) return;
    if (this.canvas === canvas && this.gl && this.program) {
      this.startLoop();
      return;
    }
    this.stopLoop();
    this.canvas = canvas;

    // Context loss / restoration listeners para prevenir que la orbe se quede en blanco
    if (!canvas._webglListenersAttached) {
      canvas._webglListenersAttached = true;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('WebGL context lost, pausing loop.');
        this.stopLoop();
      }, false);
      canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored, reinitializing engine.');
        this.canvas = null;
        this.init(canvas);
      }, false);
    }

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'high-performance' }) || 
               canvas.getContext('experimental-webgl', { alpha: true, antialias: false });
    if (!gl) {
      console.warn("WebGL no disponible en este dispositivo.");
      return;
    }
    this.gl = gl;

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_color;
      uniform vec3 u_coreColor;
      uniform float u_turbulence;
      uniform float u_pulse;
      uniform float u_density;
      uniform float u_dissipation;
      uniform float u_satellites;
      uniform float u_sink;
      uniform float u_expansion;
      uniform float u_flash;
      uniform float u_multiColor;

      // Simplex 3D Noise (Ian McEwan, Stefan Gustavson)
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        float dist = length(uv);

        // Paleta de humo seleccionada (reactiva dinámicamente a u_color y u_coreColor)
        vec3 colSmoke = u_color;
        vec3 colBase = u_coreColor;
        vec3 colHighlight = mix(u_color, vec3(1.0), 0.72);
        vec3 colDark = mix(colBase * 0.12, vec3(0.015, 0.022, 0.038), 0.78);

        // Deformación convectiva térmica del humo (Stitch Reactor Convective Model)
        float t = u_time * (0.35 + u_turbulence * 0.32);
        vec3 p = vec3(uv * (3.1 + u_expansion * 0.45), t);
        p.y -= u_time * 0.18 * (1.0 - u_sink * 1.4);

        float n1 = snoise(p);
        float n2 = snoise(p + vec3(n1 * 1.5, t * 0.6, 0.5));
        float n3 = snoise(p + vec3(n2 * 2.0, -t * 0.4, n1));

        // Esfera volumétrica con refracción de cristal
        float sphereEdge = smoothstep(0.48, 0.42, dist);
        float rim = smoothstep(0.35, 0.46, dist) * sphereEdge;
        float innerGlow = smoothstep(0.44, 0.05, dist);

        // Densidad de volutas de humo confinadas en la esfera
        float smoke = smoothstep(-0.35 + (1.0 - u_density) * 0.35, 0.65, n3) * innerGlow;
        smoke *= (1.0 - u_dissipation * 0.68);
        float coreSpark = smoothstep(0.40, 0.82, n2) * smoothstep(0.25, 0.0, dist);

        // Pulso y modulación
        float pulseMod = 1.0 + 0.35 * u_pulse * sin(u_time * 8.0);

        // Mezcla cromática del humo según el espectro seleccionado
        vec3 smokeColor = mix(colDark, colSmoke, clamp(smoke * 1.45, 0.0, 1.0));
        smokeColor = mix(smokeColor, colBase, clamp(n2 * 0.80, 0.0, 1.0));
        smokeColor += colHighlight * (coreSpark * (1.25 + u_pulse * 1.6) * pulseMod);
        smokeColor += colSmoke * (rim * (1.5 + u_pulse * 0.85));

        // Destello de impacto
        if (u_flash > 0.01) {
          smokeColor += vec3(u_flash * 0.95);
        }

        // Satélites o partículas de resonancia
        if (u_satellites > 0.01) {
          float satNoise = snoise(vec3(uv * 4.5, u_time * 0.9));
          float satGlow = smoothstep(0.08, 0.0, abs(dist - 0.38)) * (0.6 + 0.4 * satNoise) * u_satellites;
          smokeColor += mix(colHighlight, vec3(1.0), 0.5) * satGlow * 1.5;
        }

        // Halo ambiental exterior de plasma
        float halo = exp(-dist * 4.2) * (0.42 + u_pulse * 0.38);
        vec3 finalColor = smokeColor * sphereEdge + colSmoke * halo;

        // Reflejo especular primario en cristal
        vec2 lightPos = vec2(-0.16, 0.18);
        float spec = smoothstep(0.18, 0.0, length(uv - lightPos)) * 0.78;
        finalColor += vec3(1.0) * spec * sphereEdge;

        // Reflejo especular secundario sutil (rebote)
        vec2 lightPos2 = vec2(0.20, -0.22);
        float spec2 = smoothstep(0.24, 0.0, length(uv - lightPos2)) * 0.28;
        finalColor += colHighlight * spec2 * sphereEdge;

        gl_FragColor = vec4(finalColor, clamp(sphereEdge + halo * 0.7, 0.0, 1.0));
      }
    `;

    const vs = this.createShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Shader Link Error:", gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      resolution: gl.getUniformLocation(prog, "u_resolution"),
      time: gl.getUniformLocation(prog, "u_time"),
      color: gl.getUniformLocation(prog, "u_color"),
      coreColor: gl.getUniformLocation(prog, "u_coreColor"),
      turbulence: gl.getUniformLocation(prog, "u_turbulence"),
      pulse: gl.getUniformLocation(prog, "u_pulse"),
      density: gl.getUniformLocation(prog, "u_density"),
      dissipation: gl.getUniformLocation(prog, "u_dissipation"),
      satellites: gl.getUniformLocation(prog, "u_satellites"),
      sink: gl.getUniformLocation(prog, "u_sink"),
      expansion: gl.getUniformLocation(prog, "u_expansion"),
      flash: gl.getUniformLocation(prog, "u_flash"),
      multiColor: gl.getUniformLocation(prog, "u_multiColor")
    };

    this.startLoop();
  }

  createShader(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.error("Shader Compile Error:", this.gl.getShaderInfoLog(s));
      this.gl.deleteShader(s);
      return null;
    }
    return s;
  }

  setSmokeState(category, customParams = null) {
    const meta = SMOKE_PALETTE[category] || SMOKE_PALETTE.humo_general;
    this.activeCategory = category;
    this.target.color = [...meta.vec3];
    this.target.coreColor = [...meta.coreVec3];

    if (category === 'humo_general' || category === 'all') {
      this.target.multiColor = 1.0;
    } else {
      this.target.multiColor = 0.22;
    }

    const s = customParams || meta.shader;
    this.target.turbulence = s.turbulence;
    this.target.pulse = s.pulse;
    this.target.density = s.density;
    this.target.dissipation = s.dissipation;
    this.target.satellites = s.satellites;
    this.target.sink = s.sink;
    this.target.expansion = s.expansion;
    this.target.flash = s.flash || 0.0;
    this.current.flash = s.flash || 0.0;

    const ind = document.getElementById('orbe-color-indicator');
    const lbl = document.getElementById('orbe-status-label');
    if (ind) {
      ind.style.background = meta.hex;
      ind.style.boxShadow = `0 0 14px ${meta.hex}`;
    }
    if (lbl) {
      lbl.textContent = `${meta.icon} ${meta.name}: ${meta.title}`;
    }
  }

  pulseShockwave() {
    this.current.flash = 1.0;
    this.current.pulse = 1.0;
    setTimeout(() => { this.target.pulse = 0.0; }, 1200);
  }

  randomizeSmoke() {
    const keys = Object.keys(SMOKE_PALETTE);
    const chosen = keys[Math.floor(Math.random() * keys.length)];
    this.setSmokeState(chosen);
  }

  startLoop() {
    if (this.animId) cancelAnimationFrame(this.animId);

    // Accesibilidad TDAH / Sensibilidad visual: no marear si el usuario prefiere movimiento reducido
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.renderFrame();
      return;
    }

    let lastTime = 0;
    const targetFpsInterval = 1000 / 60; // 16.6ms max (optimizado para pantallas de 144Hz/165Hz como Motorola Edge)
    const render = (currentTime) => {
      this.animId = requestAnimationFrame(render);
      if (!currentTime) currentTime = performance.now();
      const elapsed = currentTime - lastTime;
      if (elapsed >= targetFpsInterval) {
        lastTime = currentTime - (elapsed % targetFpsInterval);
        this.renderFrame();
      }
    };
    render(performance.now());
  }

  stopLoop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  renderFrame() {
    const gl = this.gl;
    if (!gl || !this.program || !this.canvas) return;

    // Clamping de resolución interna a max 320x320:
    // El humo es volumétrico y suave; escalado por CSS se ve idéntico y ahorra el 88% de la GPU
    const maxDim = 320;
    const clientW = this.canvas.clientWidth || 320;
    const clientH = this.canvas.clientHeight || 320;
    const scale = Math.min(1.0, maxDim / Math.max(clientW, clientH));
    const width = Math.max(128, Math.floor(clientW * scale));
    const height = Math.max(128, Math.floor(clientH * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpSpeed = 0.06;

    for (let i = 0; i < 3; i++) {
      this.current.color[i] = lerp(this.current.color[i], this.target.color[i], lerpSpeed);
      this.current.coreColor[i] = lerp(this.current.coreColor[i], this.target.coreColor[i], lerpSpeed);
    }
    this.current.turbulence = lerp(this.current.turbulence, this.target.turbulence, lerpSpeed);
    this.current.pulse = lerp(this.current.pulse, this.target.pulse, lerpSpeed);
    this.current.density = lerp(this.current.density, this.target.density, lerpSpeed);
    this.current.dissipation = lerp(this.current.dissipation, this.target.dissipation, lerpSpeed);
    this.current.satellites = lerp(this.current.satellites, this.target.satellites, lerpSpeed);
    this.current.sink = lerp(this.current.sink, this.target.sink, lerpSpeed);
    this.current.expansion = lerp(this.current.expansion, this.target.expansion, lerpSpeed);
    this.current.flash = Math.max(0.0, this.current.flash - 0.025);
    this.current.multiColor = lerp(this.current.multiColor !== undefined ? this.current.multiColor : 1.0, this.target.multiColor !== undefined ? this.target.multiColor : 1.0, lerpSpeed);

    gl.useProgram(this.program);

    const time = (Date.now() - this.startTime) * 0.001;

    gl.uniform2f(this.uniforms.resolution, width, height);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform3fv(this.uniforms.color, new Float32Array(this.current.color));
    gl.uniform3fv(this.uniforms.coreColor, new Float32Array(this.current.coreColor));
    gl.uniform1f(this.uniforms.turbulence, this.current.turbulence);
    gl.uniform1f(this.uniforms.pulse, this.current.pulse);
    gl.uniform1f(this.uniforms.density, this.current.density);
    gl.uniform1f(this.uniforms.dissipation, this.current.dissipation);
    gl.uniform1f(this.uniforms.satellites, this.current.satellites);
    gl.uniform1f(this.uniforms.sink, this.current.sink);
    gl.uniform1f(this.uniforms.expansion, this.current.expansion);
    gl.uniform1f(this.uniforms.flash, this.current.flash);
    gl.uniform1f(this.uniforms.multiColor, this.current.multiColor);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
