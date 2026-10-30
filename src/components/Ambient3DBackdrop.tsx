import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Minimize2, Radio } from "lucide-react";

interface Ambient3DBackdropProps {
  reducedMotion: boolean;
  enabled: boolean;
  showcaseMode?: boolean;
  onExitShowcase?: () => void;
  intensity?: "low" | "medium" | "high";
}

export function Ambient3DBackdrop({
  reducedMotion,
  enabled,
  showcaseMode = false,
  onExitShowcase,
  intensity = "high",
}: Ambient3DBackdropProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState<number>(60);
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const manualRotationRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const container = mountRef.current;
    if (!container) return;

    // Fast check for WebGL
    try {
      const canvas = document.createElement("canvas");
      if (!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))) {
        return;
      }
    } catch {
      return;
    }

    let width = window.innerWidth;
    let height = window.innerHeight;

    const scene = new THREE.Scene();
    // Deep Espresso atmospheric fog
    scene.fog = new THREE.FogExp2(0x241B1A, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, showcaseMode ? 62 : 72);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = intensity === "high" ? 1.25 : intensity === "medium" ? 1.05 : 0.85;
    container.appendChild(renderer.domElement);

    // Root Orbital Pivot Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // -------------------------------------------------------------
    // LIGHTING (Cinematic 3-Point Scheme: Deep Espresso, Lavender, Silver)
    // -------------------------------------------------------------
    // 1. Silver Key Light
    const keyLight = new THREE.DirectionalLight(0xe5e4e2, intensity === "high" ? 1.4 : 1.0);
    keyLight.position.set(35, 45, 25);
    scene.add(keyLight);

    // 2. Pale Lavender Rim Grazing Light
    const cyanRim = new THREE.DirectionalLight(0xd8ccf0, intensity === "high" ? 1.8 : 1.2);
    cyanRim.position.set(-35, -25, -15);
    scene.add(cyanRim);

    // 3. Ambient Mocha Fill
    const oceanAmbient = new THREE.AmbientLight(0x342824, 1.4);
    scene.add(oceanAmbient);

    // -------------------------------------------------------------
    // 1. HERO GLOBE (>=40% Viewport Height)
    // -------------------------------------------------------------
    const globeRadius = 22;
    const globeGroup = new THREE.Group();
    globeGroup.position.set(0, -2, 0);

    // Base Deep Espresso Sphere
    const globeGeo = new THREE.SphereGeometry(globeRadius, 36, 36);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x241b1a,
      roughness: 0.8,
      metalness: 0.25,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // Liquid Silver Wireframe Contours
    const wireGeo = new THREE.SphereGeometry(globeRadius + 0.12, 28, 28);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xe5e4e2,
      wireframe: true,
      transparent: true,
      opacity: intensity === "high" ? 0.24 : 0.16,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    globeGroup.add(wireMesh);

    // Pale Lavender Atmosphere Rim Glow
    const atmoGeo = new THREE.SphereGeometry(globeRadius + 0.45, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0xd8ccf0,
      wireframe: false,
      transparent: true,
      opacity: intensity === "high" ? 0.08 : 0.05,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    globeGroup.add(atmoMesh);

    // Vijayawada Pinpoint (16.506° N, 80.648° E)
    const lat = (16.5062 * Math.PI) / 180;
    const lon = ((80.648 - 180) * Math.PI) / 180;
    const rPin = globeRadius + 0.28;
    const pinX = rPin * Math.cos(lat) * Math.cos(lon);
    const pinY = rPin * Math.sin(lat);
    const pinZ = -rPin * Math.cos(lat) * Math.sin(lon);

    // Marigold Pin Sphere
    const pinGeo = new THREE.SphereGeometry(0.45, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xf2b735 });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.set(pinX, pinY, pinZ);
    globeGroup.add(pinMesh);

    // Pulsing Marigold Target Ring
    const pulseRingGeo = new THREE.RingGeometry(0.65, 1.05, 24);
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: 0xf2b735,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const pulseRingMesh = new THREE.Mesh(pulseRingGeo, pulseRingMat);
    pulseRingMesh.position.set(pinX, pinY, pinZ);
    pulseRingMesh.lookAt(pinX * 2, pinY * 2, pinZ * 2);
    globeGroup.add(pulseRingMesh);

    rootGroup.add(globeGroup);

    // -------------------------------------------------------------
    // 2. THREE NESTED METALLIC GYROSCOPE GIMBAL RINGS
    // -------------------------------------------------------------
    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.copy(globeGroup.position);

    const gimbalMatSilver = new THREE.MeshStandardMaterial({
      color: 0xc5cfda,
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });

    const gimbalMatCyan = new THREE.MeshBasicMaterial({
      color: 0xd8ccf0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });

    // Ring 1 (Inner Gimbal)
    const ring1Geo = new THREE.TorusGeometry(26.5, 0.12, 8, 80);
    const ring1 = new THREE.Mesh(ring1Geo, gimbalMatSilver);
    gimbalGroup.add(ring1);

    // Ring 2 (Middle Gimbal) with Cyan Accent Nodes
    const ring2Geo = new THREE.TorusGeometry(30.0, 0.14, 8, 80);
    const ring2 = new THREE.Mesh(ring2Geo, gimbalMatCyan);
    ring2.rotation.x = Math.PI * 0.35;
    gimbalGroup.add(ring2);

    // Ring 3 (Outer Gimbal)
    const ring3Geo = new THREE.TorusGeometry(33.5, 0.16, 8, 80);
    const ring3 = new THREE.Mesh(ring3Geo, gimbalMatSilver);
    ring3.rotation.y = Math.PI * 0.4;
    gimbalGroup.add(ring3);

    rootGroup.add(gimbalGroup);

    // -------------------------------------------------------------
    // 3. ORBIT SYSTEM WITH SATELLITES & SCAN CONES
    // -------------------------------------------------------------
    const orbitGroup = new THREE.Group();
    orbitGroup.position.copy(globeGroup.position);

    // Orbit ellipse paths
    const orbitPathGeo1 = new THREE.RingGeometry(35.0, 35.12, 96);
    const orbitPathMat = new THREE.MeshBasicMaterial({
      color: 0xc5cfda,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    const orbitPath1 = new THREE.Mesh(orbitPathGeo1, orbitPathMat);
    orbitPath1.rotation.x = Math.PI * 0.42;
    orbitGroup.add(orbitPath1);

    const orbitPathGeo2 = new THREE.RingGeometry(39.0, 39.12, 96);
    const orbitPath2 = new THREE.Mesh(orbitPathGeo2, orbitPathMat);
    orbitPath2.rotation.x = -Math.PI * 0.38;
    orbitPath2.rotation.y = Math.PI * 0.25;
    orbitGroup.add(orbitPath2);

    // Satellite 1: Sentinel Radar Craft
    const sat1 = new THREE.Group();
    const satBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.45, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xe9eff5, metalness: 0.9, roughness: 0.2 })
    );
    sat1.add(satBody);

    // Solar Wings (Pale Lavender)
    const panelGeo = new THREE.BoxGeometry(2.4, 0.05, 0.65);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xd8ccf0 });
    const panels = new THREE.Mesh(panelGeo, panelMat);
    sat1.add(panels);

    // Flashing Marigold Antenna Beacon
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xf2b735 })
    );
    beacon.position.y = 0.35;
    sat1.add(beacon);

    // Downlink Radar Scan Cone (Decorative translucent lavender frustum)
    const coneGeo = new THREE.ConeGeometry(3.5, 9.0, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xd8ccf0,
      transparent: true,
      opacity: intensity === "high" ? 0.09 : 0.05,
      side: THREE.DoubleSide,
    });
    const scanCone = new THREE.Mesh(coneGeo, coneMat);
    scanCone.rotation.x = Math.PI;
    scanCone.position.y = -4.5;
    sat1.add(scanCone);

    orbitGroup.add(sat1);

    // Satellite 2: Secondary Microsat
    const sat2 = new THREE.Group();
    const sat2Body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0xe5e4e2, metalness: 0.95, roughness: 0.15 })
    );
    sat2.add(sat2Body);
    orbitGroup.add(sat2);

    rootGroup.add(orbitGroup);

    // -------------------------------------------------------------
    // 4. FLOATING HOLOGRAPHIC TERRAIN SLABS
    // -------------------------------------------------------------
    const slabsGroup = new THREE.Group();
    const slabCount = 6;
    const slabMeshes: { mesh: THREE.Group; orbitAngle: number; radius: number; speed: number; yOffset: number }[] = [];

    for (let s = 0; s < slabCount; s++) {
      const slab = new THREE.Group();
      // Glass Tile Base (Elevated Mocha Panel)
      const baseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.2, 2.8),
        new THREE.MeshPhysicalMaterial({
          color: 0x342824,
          metalness: 0.3,
          roughness: 0.2,
          transmission: 0.6,
          transparent: true,
          opacity: 0.55,
        })
      );
      slab.add(baseMesh);

      // Etched Lavender Contour Wireframe on top of slab
      const contourWire = new THREE.Mesh(
        new THREE.PlaneGeometry(4.0, 2.6, 6, 4),
        new THREE.MeshBasicMaterial({
          color: 0xd8ccf0,
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        })
      );
      contourWire.rotation.x = -Math.PI / 2;
      contourWire.position.y = 0.12;
      slab.add(contourWire);

      const angle = (s / slabCount) * Math.PI * 2;
      const r = 38 + (s % 3) * 5;
      const y = (s % 2 === 0 ? 1 : -1) * (8 + (s % 3) * 4);

      slab.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      slab.rotation.x = 0.25 * (s % 2 === 0 ? 1 : -1);
      slab.rotation.z = 0.15 * s;

      slabsGroup.add(slab);
      slabMeshes.push({
        mesh: slab,
        orbitAngle: angle,
        radius: r,
        speed: 0.003 + (s % 3) * 0.0015,
        yOffset: y,
      });
    }
    rootGroup.add(slabsGroup);

    // -------------------------------------------------------------
    // 5. FLOWING LIGHT RIBBONS (Electric Cyan & Bright Silver)
    // -------------------------------------------------------------
    const ribbonCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-45, 14, -20),
      new THREE.Vector3(-20, 22, 10),
      new THREE.Vector3(12, 16, 25),
      new THREE.Vector3(38, -8, 12),
      new THREE.Vector3(48, -18, -15),
    ]);
    const ribbonGeo1 = new THREE.TubeGeometry(ribbonCurve1, 48, 0.22, 8, false);
    const ribbonMat1 = new THREE.MeshBasicMaterial({
      color: 0xd8ccf0,
      transparent: true,
      opacity: intensity === "high" ? 0.45 : 0.25,
    });
    const ribbonMesh1 = new THREE.Mesh(ribbonGeo1, ribbonMat1);
    rootGroup.add(ribbonMesh1);

    const ribbonCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-42, -16, 15),
      new THREE.Vector3(-14, -24, -12),
      new THREE.Vector3(22, -18, -25),
      new THREE.Vector3(42, 12, 15),
    ]);
    const ribbonGeo2 = new THREE.TubeGeometry(ribbonCurve2, 48, 0.18, 8, false);
    const ribbonMat2 = new THREE.MeshBasicMaterial({
      color: 0xe5e4e2,
      transparent: true,
      opacity: intensity === "high" ? 0.35 : 0.2,
    });
    const ribbonMesh2 = new THREE.Mesh(ribbonGeo2, ribbonMat2);
    rootGroup.add(ribbonMesh2);

    // -------------------------------------------------------------
    // 6. FACETED DEEP OCEAN GLASS CRYSTALS & SILVER TORI (24 Items)
    // -------------------------------------------------------------
    const floatingGroup = new THREE.Group();
    const crystalGeo = new THREE.OctahedronGeometry(1.4, 0);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x342824,
      metalness: 0.3,
      roughness: 0.15,
      transmission: 0.7,
      transparent: true,
      opacity: 0.6,
    });

    const torusGeo = new THREE.TorusGeometry(1.6, 0.14, 8, 24);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xe5e4e2,
      metalness: 0.92,
      roughness: 0.2,
    });

    const floatingObjects: { mesh: THREE.Mesh; speedX: number; speedY: number; initY: number }[] = [];

    for (let i = 0; i < 24; i++) {
      const isCrystal = i % 2 === 0;
      const mesh = new THREE.Mesh(isCrystal ? crystalGeo : torusGeo, isCrystal ? crystalMat : torusMat);
      const angle = (i / 24) * Math.PI * 2;
      const dist = 42 + (i % 5) * 5;
      const initY = (Math.sin(i * 1.3) * 22);

      mesh.position.set(
        Math.cos(angle) * dist,
        initY,
        Math.sin(angle) * dist - 10
      );

      floatingGroup.add(mesh);
      floatingObjects.push({
        mesh,
        speedX: 0.004 + (i % 3) * 0.002,
        speedY: 0.006 + (i % 4) * 0.002,
        initY,
      });
    }
    rootGroup.add(floatingGroup);

    // -------------------------------------------------------------
    // 7. TERRAIN HORIZON WIREFRAME (Undulating Stage Horizon)
    // -------------------------------------------------------------
    const horizonGeo = new THREE.PlaneGeometry(160, 48, 48, 16);
    horizonGeo.rotateX(-Math.PI * 0.42);
    const hPos = horizonGeo.attributes.position;
    for (let k = 0; k < hPos.count; k++) {
      const x = hPos.getX(k);
      const y = hPos.getY(k);
      const wave = Math.sin(x * 0.08) * Math.cos(y * 0.12) * 3.2 + Math.sin(x * 0.18) * 1.2;
      hPos.setZ(k, wave);
    }
    horizonGeo.computeVertexNormals();

    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x6f5147,
      wireframe: true,
      transparent: true,
      opacity: intensity === "high" ? 0.35 : 0.2,
    });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    horizonMesh.position.set(0, -32, -18);
    scene.add(horizonMesh);

    // -------------------------------------------------------------
    // 8. PARTICLES & VOLUMETRIC LIGHT SHAFTS (500 Particles)
    // -------------------------------------------------------------
    const particleCount = 480;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const cSilver = new THREE.Color(0xe5e4e2);
    const cLavender = new THREE.Color(0xd8ccf0);

    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 160;
      particlePositions[p + 1] = (Math.random() - 0.5) * 100;
      particlePositions[p + 2] = (Math.random() - 0.5) * 110 - 15;

      const c = Math.random() > 0.4 ? cSilver : cLavender;
      particleColors[p] = c.r;
      particleColors[p + 1] = c.g;
      particleColors[p + 2] = c.b;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: intensity === "high" ? 0.55 : 0.4,
      vertexColors: true,
      transparent: true,
      opacity: intensity === "high" ? 0.55 : 0.35,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // -------------------------------------------------------------
    // INTERACTION & ANIMATION LOOP
    // -------------------------------------------------------------
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;

      if (isDraggingRef.current) {
        const deltaX = e.clientX - prevMousePosRef.current.x;
        const deltaY = e.clientY - prevMousePosRef.current.y;
        manualRotationRef.current.y += deltaX * 0.005;
        manualRotationRef.current.x += deltaY * 0.005;
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (showcaseMode) {
        isDraggingRef.current = true;
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    let animId: number;
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const clock = new THREE.Clock();
    let frameCounter = 0;
    let lastFpsUpdate = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();

      // FPS tracking
      frameCounter++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 1000) {
        setFps(Math.round((frameCounter * 1000) / (now - lastFpsUpdate)));
        frameCounter = 0;
        lastFpsUpdate = now;
      }

      // Camera Parallax & Manual Rotation
      const targetCamX = mouseX * (showcaseMode ? 6 : 4) + manualRotationRef.current.y * 12;
      const targetCamY = mouseY * (showcaseMode ? 5 : 3) - manualRotationRef.current.x * 10;
      camera.position.x += (targetCamX - camera.position.x) * 0.04;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;
      camera.lookAt(0, -2, 0);

      if (!reducedMotion) {
        // Slow Globe Rotation
        globeGroup.rotation.y = elapsed * 0.035;

        // Pulsing Vijayawada ring
        const ringScale = 1.0 + Math.sin(elapsed * 2.8) * 0.22;
        pulseRingMesh.scale.set(ringScale, ringScale, ringScale);

        // Gyroscope Gimbal Precession
        ring1.rotation.x = elapsed * 0.06;
        ring2.rotation.y = elapsed * 0.08;
        ring3.rotation.z = elapsed * 0.045;

        // Satellite 1 Orbit & Scan Look-At
        const satAngle = elapsed * 0.22;
        const sat1X = Math.cos(satAngle) * 35;
        const sat1Y = Math.sin(satAngle * 0.7) * 14;
        const sat1Z = Math.sin(satAngle) * 28;
        sat1.position.set(sat1X, sat1Y, sat1Z);
        sat1.lookAt(0, -2, 0);

        // Satellite 2 Orbit
        const sat2Angle = -elapsed * 0.18 + Math.PI;
        sat2.position.set(Math.cos(sat2Angle) * 39, Math.sin(sat2Angle * 0.9) * 16, Math.sin(sat2Angle) * 32);

        // Floating Holographic Slabs Orbiting
        slabMeshes.forEach((item) => {
          item.orbitAngle += item.speed;
          item.mesh.position.x = Math.cos(item.orbitAngle) * item.radius;
          item.mesh.position.z = Math.sin(item.orbitAngle) * item.radius;
          item.mesh.position.y = item.yOffset + Math.sin(elapsed * 0.8 + item.orbitAngle) * 1.4;
          item.mesh.rotation.y = item.orbitAngle + Math.PI / 2;
        });

        // Floating Crystals & Tori Gentle Rotation
        floatingObjects.forEach((obj, idx) => {
          obj.mesh.rotation.x += obj.speedX;
          obj.mesh.rotation.y += obj.speedY;
          obj.mesh.position.y = obj.initY + Math.sin(elapsed * 0.5 + idx) * 1.8;
        });

        // Slow Root Oscillation
        rootGroup.rotation.y = Math.sin(elapsed * 0.04) * 0.06;
      }

      renderer.render(scene, camera);
    };

    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      globeGeo.dispose();
      globeMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [reducedMotion, enabled, showcaseMode, intensity]);

  if (!enabled) return null;

  const baseOpacity = showcaseMode ? 1.0 : intensity === "high" ? 0.92 : intensity === "medium" ? 0.68 : 0.42;

  return (
    <>
      <div
        ref={mountRef}
        className={`ambient-3d-backdrop ${showcaseMode ? "backdrop-showcase-active" : ""}`}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: showcaseMode ? 9000 : 0,
          pointerEvents: showcaseMode ? "auto" : "none",
          opacity: baseOpacity,
          transition: "opacity 0.5s ease",
          cursor: showcaseMode ? "grab" : "default",
        }}
        aria-hidden={!showcaseMode}
      />

      {/* Showcase Mode Floating HUD HUD Overlays */}
      {showcaseMode && (
        <div className="showcase-mode-hud">
          <div className="showcase-top-bar">
            <div className="showcase-badge">
              <Radio size={14} className="cyan-pulse-dot" />
              <span className="showcase-tag">SENTINEL ORBIT // LIVE 3D HERO BACKDROP</span>
              <span className="showcase-fps">{fps} FPS</span>
            </div>

            <div className="showcase-coords">
              <span>TARGET: VIJAYAWADA (16.506°N, 80.648°E)</span>
              <span className="dot-divider">•</span>
              <span>ORBIT ALT: 740 KM</span>
            </div>

            <button
              type="button"
              className="showcase-exit-btn"
              onClick={onExitShowcase}
              aria-label="Exit Showcase Mode"
              title="Exit Showcase View (Press B or Esc)"
            >
              <Minimize2 size={15} />
              <span>EXIT SHOWCASE [B]</span>
            </button>
          </div>

          <div className="showcase-bottom-hint">
            <span>Click & drag to rotate view • Press <kbd>B</kbd> or <kbd>Esc</kbd> to return to Operational Console</span>
          </div>
        </div>
      )}
    </>
  );
}
