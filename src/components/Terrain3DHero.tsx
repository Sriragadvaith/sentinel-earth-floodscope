import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Compass, Eye, Play, Pause, ChevronDown, Layers, Activity, AlertTriangle, ArrowUp } from "lucide-react";

interface Terrain3DHeroProps {
  onScrollToMap: () => void;
  onDeployScenario: (scenarioId: string) => void;
}

const VERTICAL_EXAGGERATION = "2.5x";
const DEM_ATTRIBUTION =
  "Topographic relief derived from SRTM 30m digital elevation gradients & Krishna River gorge morphology (16.44°N–16.58°N, 80.56°E–80.74°E). Illustrative relief object, not survey-calibrated flood forecast.";

// Detect WebGL availability safely
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function Terrain3DHero({ onScrollToMap, onDeployScenario }: Terrain3DHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [wireframeMode, setWireframeMode] = useState(false);
  const [isRotating, setIsRotating] = useState(!prefersReducedMotion);
  const [activeTelemetry, setActiveTelemetry] = useState<"gorge" | "hill" | "basin">("gorge");
  const [webglAvailable, setWebglAvailable] = useState<boolean>(() => checkWebGLSupport());

  const wireframeRef = useRef(wireframeMode);
  const isRotatingRef = useRef(isRotating);

  useEffect(() => {
    wireframeRef.current = wireframeMode;
  }, [wireframeMode]);

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !webglAvailable) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 620;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x241b1a); // Deep Espresso #241B1A
    scene.fog = new THREE.FogExp2(0x241b1a, 0.012);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 36, 58);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => {
        setWebglAvailable(false);
      });
      return;
    }

    const maxPixelRatio = window.innerWidth < 768 ? 1.5 : 1.75;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Procedural Relief Model: 256x256 (desktop) or 128x128 (mobile)
    const isMobile = window.innerWidth < 768;
    const segments = isMobile ? 128 : 256;
    const sizeX = 86;
    const sizeZ = 66;

    const terrainGeo = new THREE.PlaneGeometry(sizeX, sizeZ, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      vertex.fromBufferAttribute(pos, i);
      const x = vertex.x;
      const z = vertex.z;

      // Realistic Krishna River sinuosity cutting through Vijayawada
      const riverCenterZ = Math.sin(x * 0.045) * 8.5 - x * 0.14;
      const distToRiver = Math.abs(z - riverCenterZ);

      // Indrakeeladri Ridge (Kanaka Durga promontory on northern flank)
      const distIndrakeeladri = Math.hypot(x + 7.5, z - 13.5);
      const hillIndrakeeladri = Math.max(0, 16.5 * Math.exp(-distIndrakeeladri * 0.17));

      // Sitanagaram Ridge (Guntur district southern flank)
      const distSitanagaram = Math.hypot(x + 5.5, z + 15.5);
      const hillSitanagaram = Math.max(0, 13.8 * Math.exp(-distSitanagaram * 0.19));

      // Deep incision of Krishna River gorge
      const riverCarve = Math.exp(-Math.pow(distToRiver / 6.2, 2)) * 5.4;

      // Bhavani Island upstream riverine mound
      const distBhavani = Math.hypot(x + 24, z - riverCenterZ);
      const bhavaniIsland = Math.max(0, 3.4 * Math.exp(-distBhavani * 0.32));

      // Eastern Ghats undulating relief
      const macroUndulation =
        Math.sin(x * 0.075) * Math.cos(z * 0.075) * 2.6 +
        Math.sin(x * 0.16 + z * 0.11) * 1.1;

      let elevation = macroUndulation + hillIndrakeeladri + hillSitanagaram - riverCarve + bhavaniIsland;

      // Water plane floor limit
      if (distToRiver < 5 && elevation < -1.8) {
        elevation = -1.8;
      }

      pos.setY(i, elevation);
    }

    terrainGeo.computeVertexNormals();

    // 3. Custom GLSL Shader for Museum-Grade Sculptural Relief
    const customShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new THREE.Color(0x241b1a) },      // Deep Espresso #241B1A
        uContourColor: { value: new THREE.Color(0xe5e4e2) },   // Platinum Silver #E5E4E2
        uFresnelColor: { value: new THREE.Color(0xd8ccf0) },   // Pale Lavender #D8CCF0
        uMarigoldColor: { value: new THREE.Color(0xf2b735) },  // Marigold #F2B735 (<5% accent)
        uContourSpacing: { value: 1.25 },
        uContourWidth: { value: 0.07 },
        uEdgeFadeDist: { value: 42.0 },
        uDrawProgress: { value: prefersReducedMotion ? 1.0 : 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vElevation;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vElevation = position.y;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uContourColor;
        uniform vec3 uFresnelColor;
        uniform vec3 uMarigoldColor;
        uniform float uContourSpacing;
        uniform float uContourWidth;
        uniform float uEdgeFadeDist;
        uniform float uDrawProgress;
        uniform float uTime;

        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vElevation;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          // Antialiased contour lines via fwidth
          float elevationScaled = vElevation / uContourSpacing;
          float f = fract(elevationScaled);
          float df = fwidth(elevationScaled);
          float distToLine = min(f, 1.0 - f);
          float contourLine = 1.0 - smoothstep(0.0, df * 1.6, distToLine - uContourWidth * 0.5);

          // Major index contours every 4 steps
          float majorScaled = elevationScaled / 4.0;
          float fMajor = fract(majorScaled);
          float dfMajor = fwidth(majorScaled);
          float majorLine = 1.0 - smoothstep(0.0, dfMajor * 1.6, min(fMajor, 1.0 - fMajor) - uContourWidth * 0.9);

          // Subtle slow-moving metallic light sweep across terrain
          float lightSweep = sin(vWorldPosition.x * 0.05 + vWorldPosition.z * 0.04 - uTime * 0.45) * 0.5 + 0.5;

          // Brushed silver fresnel sheen on steep ridges
          float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2) * (0.42 + lightSweep * 0.18);

          // Controlled directional illumination
          vec3 keyLightDir = normalize(vec3(0.4, 0.85, 0.35));
          float NdotL = max(dot(normal, keyLightDir), 0.0) * 0.65 + 0.35;

          vec3 color = uBaseColor * NdotL;
          color += uFresnelColor * fresnel * clamp(vElevation * 0.09, 0.0, 1.0);

          float totalContour = clamp(contourLine * 0.6 + majorLine * 0.45, 0.0, 1.0);

          // Draw-in reveal transition on load across elevation gradient
          float reveal = smoothstep(0.0, 1.0, uDrawProgress * 1.35 - (vElevation + 2.5) * 0.045);
          totalContour *= reveal;

          // Marigold contour highlights on major Indrakeeladri/crest lines (<5% selective accent)
          float marigoldAccent = step(10.5, vElevation) * majorLine * (0.35 + 0.15 * sin(uTime * 1.2));
          vec3 finalContourColor = mix(uContourColor, uMarigoldColor, clamp(marigoldAccent, 0.0, 0.85));

          color = mix(color, finalContourColor, totalContour * 0.72);

          // Edge fade into background fog
          float r = length(vWorldPosition.xz);
          float edgeAlpha = 1.0 - smoothstep(uEdgeFadeDist * 0.75, uEdgeFadeDist, r);

          gl_FragColor = vec4(color, edgeAlpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, customShaderMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 4. Precision Krishna River Ribbon with Electric Cyan Water Glow
    const riverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-42, -1.65, 8.5),
      new THREE.Vector3(-24, -1.65, 5.0),
      new THREE.Vector3(-8, -1.65, 1.5),
      new THREE.Vector3(-1.8, -1.65, 0.2), // Prakasam Barrage
      new THREE.Vector3(12, -1.65, -3.2),
      new THREE.Vector3(26, -1.65, -7.5),
      new THREE.Vector3(42, -1.65, -11.0),
    ]);

    const riverGeo = new THREE.TubeGeometry(riverCurve, 64, 1.6, 8, false);
    const riverMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0a1a2b), // Deep Ocean
      emissive: new THREE.Color(0x22d3ee), // Electric Cyan
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.85,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    scene.add(riverMesh);

    // 5. Parametric Landmark Models (Prakasam Barrage & Indrakeeladri Monument)
    // A. Prakasam Barrage: Instanced piers with road deck
    const barrageGroup = new THREE.Group();
    barrageGroup.position.set(-1.8, -0.6, 0.2);
    barrageGroup.rotation.y = 0.28;

    // Roadway bridge deck in Liquid Silver
    const deckGeo = new THREE.BoxGeometry(1.4, 0.3, 13.5);
    const deckMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc5cfda),
      metalness: 0.8,
      roughness: 0.3,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.y = 0.7;
    barrageGroup.add(deckMesh);

    // Instanced Gate Piers
    const pierGeo = new THREE.BoxGeometry(1.2, 1.2, 0.2);
    const pierMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x342824), // Elevated Mocha Panel #342824
      metalness: 0.6,
      roughness: 0.4,
    });
    const numPiers = 14;
    const instancedPiers = new THREE.InstancedMesh(pierGeo, pierMat, numPiers);
    const dummy = new THREE.Object3D();
    for (let p = 0; p < numPiers; p++) {
      dummy.position.set(0, 0, (p - numPiers / 2) * 0.95);
      dummy.updateMatrix();
      instancedPiers.setMatrixAt(p, dummy.matrix);
    }
    instancedPiers.instanceMatrix.needsUpdate = true;
    barrageGroup.add(instancedPiers);
    scene.add(barrageGroup);

    // B. Indrakeeladri Temple Silhouette Marker
    const templeGroup = new THREE.Group();
    templeGroup.position.set(-7.5, 14.8, 13.5);

    const spireGeo = new THREE.ConeGeometry(0.5, 2.2, 4);
    const spireMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe5e4e2), // Platinum Silver #E5E4E2
      metalness: 0.9,
      roughness: 0.2,
    });
    const spireMesh = new THREE.Mesh(spireGeo, spireMat);
    templeGroup.add(spireMesh);

    const beaconGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf2b735 }); // Marigold pin
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = 1.3;
    templeGroup.add(beaconMesh);
    scene.add(templeGroup);

    // 6. Machined Plinth & Stage Bezel with Scale Markers
    const plinthGeo = new THREE.BoxGeometry(sizeX + 3.5, 1.4, sizeZ + 3.5);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x342824), // Elevated Mocha Panel #342824
      metalness: 0.75,
      roughness: 0.35,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = -2.7;
    plinthMesh.receiveShadow = true;
    scene.add(plinthMesh);

    // Soft Stage Floor Shadow
    const shadowGeo = new THREE.PlaneGeometry(sizeX + 18, sizeZ + 18);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x241b1a, // Deep Espresso #241B1A
      transparent: true,
      opacity: 0.85,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = -3.42;
    scene.add(shadowMesh);

    // 7. Sparse Floating Atmospheric Micro-Dust (<150 particles)
    const particleCount = 110;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 80;
      particlePositions[p + 1] = Math.random() * 26 + 1;
      particlePositions[p + 2] = (Math.random() - 0.5) * 60;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xe5e4e2,
      size: 0.22,
      transparent: true,
      opacity: 0.35,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 8. Lighting: Strict 3-Light Cinematic Scheme
    // A. Ambient Mocha Fill
    const ambientLight = new THREE.AmbientLight(0x342824, 1.4);
    scene.add(ambientLight);

    // B. Key Light: Soft Platinum Silver from upper left
    const keyLight = new THREE.DirectionalLight(0xe5e4e2, 2.2);
    keyLight.position.set(-28, 42, 22);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // C. Pale Lavender Rim Grazing Light (constrained along gorge)
    const lavenderRim = new THREE.PointLight(0xd8ccf0, 3.2, 55, 1.6);
    lavenderRim.position.set(-2, 5, 2);
    scene.add(lavenderRim);

    // 9. Pointer Parallax (2-3° restricted) & Damped Camera Animation
    let mouseX = 0;
    let mouseY = 0;
    let targetCameraX = 0;
    let targetCameraY = 36;

    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = nx;
      mouseY = ny;
    };

    container.addEventListener("mousemove", handleMouseMove);

    // 10. Animation Loop with Intersection Observer & Visibility Change (Pause when off-screen or tab hidden)
    let animId: number;
    const clock = new THREE.Clock();
    let isIntersectingViewport = true;
    let isVisibleOnScreen = true;

    const updateVisibility = () => {
      isVisibleOnScreen = !document.hidden && isIntersectingViewport;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isIntersectingViewport = entry.isIntersecting;
          updateVisibility();
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    const handleVisibilityChange = () => {
      updateVisibility();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isVisibleOnScreen) return;

      const elapsedTime = clock.getElapsedTime();
      customShaderMaterial.uniforms.uTime.value = elapsedTime;

      // Camera parallax with heavy damping
      targetCameraX = mouseX * 7.5;
      targetCameraY = 36 + mouseY * 4.0;

      camera.position.x += (targetCameraX - camera.position.x) * 0.035;
      camera.position.y += (targetCameraY - camera.position.y) * 0.035;
      camera.lookAt(0, -1, 0);

      // Controlled 12° slow orbit
      if (isRotatingRef.current && !prefersReducedMotion) {
        const orbitAngle = Math.sin(elapsedTime * 0.08) * 0.10;
        terrainMesh.rotation.y = orbitAngle;
        riverMesh.rotation.y = orbitAngle;
        barrageGroup.rotation.y = 0.28 + orbitAngle;
        templeGroup.rotation.y = orbitAngle;
        plinthMesh.rotation.y = orbitAngle;
      }

      // Contour draw-in reveal transition on initial load
      if (!prefersReducedMotion && customShaderMaterial.uniforms.uDrawProgress.value < 1.0) {
        customShaderMaterial.uniforms.uDrawProgress.value = Math.min(
          1.0,
          customShaderMaterial.uniforms.uDrawProgress.value + 0.014
        );
      }

      // Micro-dust particle drift
      if (!prefersReducedMotion) {
        const pArray = particleGeo.attributes.position.array as Float32Array;
        for (let i = 1; i < pArray.length; i += 3) {
          pArray[i] -= 0.015;
          if (pArray[i] < 0.5) pArray[i] = 26;
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 620;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      terrainGeo.dispose();
      customShaderMaterial.dispose();
      riverGeo.dispose();
      riverMat.dispose();
      deckGeo.dispose();
      deckMat.dispose();
      pierGeo.dispose();
      pierMat.dispose();
      spireGeo.dispose();
      spireMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [webglAvailable, prefersReducedMotion]);

  // Fallback 2D Vector Contours if WebGL fails
  if (!webglAvailable) {
    return (
      <div className="terrain-hero-fallback">
        <div className="fallback-card">
          <AlertTriangle className="fallback-icon" />
          <h3>2D Topographic Contour Fallback</h3>
          <p>
            WebGL 3D acceleration is disabled or unsupported. Displaying 2D cartographic terrain contours for Vijayawada.
          </p>
          <div className="fallback-svg-frame">
            <svg viewBox="0 0 400 240" className="contour-svg">
              <ellipse cx="200" cy="120" rx="160" ry="80" stroke="#c6c8d0" strokeWidth="1" fill="none" opacity="0.3" />
              <ellipse cx="200" cy="120" rx="120" ry="60" stroke="#c6c8d0" strokeWidth="1" fill="none" opacity="0.5" />
              <ellipse cx="160" cy="110" rx="50" ry="30" stroke="#c6c8d0" strokeWidth="1.5" fill="none" opacity="0.8" />
              <ellipse cx="240" cy="130" rx="55" ry="32" stroke="#c6c8d0" strokeWidth="1.5" fill="none" opacity="0.8" />
              <path d="M 40,115 Q 160,110 200,120 T 360,135" stroke="#f2b735" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <button type="button" className="hero-action-deploy" onClick={onScrollToMap}>
            <span>Enter Operational GIS Map</span>
            <ChevronDown className="arrow-down-icon" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="terrain-hero-viewport" ref={mountRef}>
      {/* Cinematic HUD Header Overlay */}
      <div className="hero-hud-top">
        <div className="hero-title-group">
          <div className="hud-badge-gold">
            <span className="badge-orbit-dot" />
            SCULPTURAL 3D RELIEF MODEL
          </div>
          <h2 className="hero-main-heading">Vijayawada Krishna River Basin</h2>
          <p className="hero-subtext">
            Precision-machined digital elevation object of the Indrakeeladri constriction, Prakasam Barrage flow control, and Krishna floodplain morphology.
          </p>
          <div className="exaggeration-indicator">
            <span className="exaggeration-label">Vertical exaggeration:</span>
            <span className="exaggeration-val">{VERTICAL_EXAGGERATION}</span>
          </div>
        </div>

        {/* 3D Scene Controls */}
        <div className="hero-controls-bar">
          <button
            type="button"
            className={`hero-btn-pill ${wireframeMode ? "active-gold" : ""}`}
            onClick={() => setWireframeMode((v) => !v)}
            title="Toggle elevation contour visibility"
          >
            <Layers className="btn-icon" />
            <span>{wireframeMode ? "Contours Active" : "Antialiased Contours"}</span>
          </button>

          <button
            type="button"
            className={`hero-btn-pill ${isRotating ? "active-silver" : ""}`}
            onClick={() => setIsRotating((r) => !r)}
            title="Pause or resume orbital oscillation"
          >
            {isRotating ? <Pause className="btn-icon" /> : <Play className="btn-icon" />}
            <span>{isRotating ? "Orbit Active" : "Orbit Paused"}</span>
          </button>
        </div>
      </div>

      {/* Floating Tactical Telemetry Badges */}
      <div className="hero-telemetry-cluster">
        <button
          type="button"
          className={`telemetry-chip ${activeTelemetry === "gorge" ? "chip-active" : ""}`}
          onClick={() => setActiveTelemetry("gorge")}
        >
          <Activity className="chip-icon gold-text" />
          <div className="chip-data">
            <span className="chip-label">Prakasam Barrage Gorge</span>
            <span className="chip-value">18m MSL · 70 Parametric Sluices</span>
          </div>
        </button>

        <button
          type="button"
          className={`telemetry-chip ${activeTelemetry === "hill" ? "chip-active" : ""}`}
          onClick={() => setActiveTelemetry("hill")}
        >
          <Compass className="chip-icon silver-text" />
          <div className="chip-data">
            <span className="chip-label">Indrakeeladri Ridge</span>
            <span className="chip-value">104m MSL · Kanaka Durga Silhouette</span>
          </div>
        </button>

        <button
          type="button"
          className={`telemetry-chip ${activeTelemetry === "basin" ? "chip-active" : ""}`}
          onClick={() => setActiveTelemetry("basin")}
        >
          <Eye className="chip-icon gold-text" />
          <div className="chip-data">
            <span className="chip-label">Krishna Lanka Floodplain</span>
            <span className="chip-value">19m MSL · Riparian Vulnerability</span>
          </div>
        </button>
      </div>

      {/* Plinth Scale Bar & North Arrow Inset */}
      <div className="plinth-engraved-hud">
        <div className="north-arrow-badge">
          <ArrowUp className="north-arrow-icon" />
          <span>N</span>
        </div>
        <div className="scale-bar-badge">
          <div className="scale-bar-line" />
          <span>5 km</span>
        </div>
      </div>

      {/* Grounding Attribution & Transition Action */}
      <div className="hero-hud-bottom">
        <div className="hero-grounding-notice">
          <span className="notice-pip" />
          <span>{DEM_ATTRIBUTION}</span>
        </div>

        <div className="hero-action-group">
          <button
            type="button"
            className="hero-preset-chip"
            onClick={() => onDeployScenario("historical-2009")}
          >
            Simulate 2009 Flood (1.11M cfs)
          </button>

          <button
            type="button"
            className="hero-action-deploy"
            onClick={onScrollToMap}
          >
            <span>Deploy Operational Tactical Map</span>
            <ChevronDown className="arrow-down-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
