/* ==========================================================================
   PORTFOLIO MOTION ENGINE
   ========================================================================== */
/**
 * Core Animation & Physics Controller
 * 
 * WHAT: Coordinates the portfolio's motion system (smooth scrolling, scroll-triggered
 * scene choreography, GPU-backed 3D objects, custom cursor behavior, and UI interactions).
 * WHY: Decoupling these systems from standard CSS ensures high framerates and prevents 
 * browser rendering conflicts (layout thrashing) during complex overlaps.
 * HOW: Each subsystem is isolated into its own scope, utilizing GSAP's Ticker for 
 * synchronized RequestAnimationFrame (RAF) updates.
 */

/* ==========================================================================
   SMOOTH SCROLL FOUNDATION
   ========================================================================== */
/**
 * WHAT: Initializes Lenis for momentum-based smooth scrolling.
 * WHY: Standard browser scrolling fires events asynchronously, causing GSAP ScrollTriggers 
 * to jitter. Lenis hijacking the scroll normalizes the event loop.
 * HOW: Overrides native scroll and passes the eased scroll position directly into GSAP's Ticker.
 */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom easeOutQuad for weighty momentum
  smoothWheel: true,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

/* ==========================================================================
   ASSET BOOTSTRAP / PRELOADER
   ========================================================================== */
/**
 * WHAT: Real-Time Asset Loading Preloader.
 * WHY: 3D GLB models and high-res images cause severe FOUC (Flash of Unstyled Content) 
 * and break GSAP height calculations if the DOM is parsed before assets render.
 * HOW: Tracks `img.complete` flags and WebGL `fetch` promises, locking the UI behind 
 * a loading gate until `loadedCount === totalAssets`.
 */
window.addEventListener('load', () => {
  const preloaderText = document.getElementById("preloader-text");
  const preloader = document.getElementById("preloader");

  if (!preloaderText || !preloader) return;

  const images = Array.from(document.images);
  const glbFiles = [
    'assets/media/3d_Objects/cassette.glb',
    'assets/media/3d_Objects/magnifier.glb',
    'assets/media/3d_Objects/pistol.glb',
    'assets/media/3d_Objects/pen.glb'
  ];

  let loadedCount = 0;
  const totalAssets = images.length + glbFiles.length;

  function checkProgress() {
    loadedCount++;
    const percent = Math.min(Math.floor((loadedCount / totalAssets) * 100), 100);
    preloaderText.innerText = `LOADING SYSTEM... ${percent}%`;

    if (loadedCount >= totalAssets) {
      preloaderText.innerText = "LOADED!";
      preloaderText.style.color = "#22c55e"; // Success Green

      setTimeout(() => {
        preloader.classList.add("slide-out");

        gsap.to("#preloader", {
          y: "-100%",
          duration: 0.8,
          ease: "power3.inOut",
          delay: 0.3,
          onComplete: () => preloader.style.display = "none"
        });

        gsap.from(".hero-section", { scale: 1.05, filter: "blur(10px)", duration: 1.5, ease: "power3.out" });
      }, 600);
    }
  }

  // Fallback timer (6 seconds max) prevents permanent locking if a network request hangs
  const maxLoadTimeout = setTimeout(() => {
    if (loadedCount < totalAssets) {
      preloaderText.innerText = "LOADED!";
      preloaderText.style.color = "#22c55e";
      preloader.classList.add("slide-out");
      gsap.to("#preloader", { y: "-100%", duration: 0.8, delay: 0.3, onComplete: () => preloader.style.display = "none" });
      gsap.from(".hero-section", { scale: 1.05, filter: "blur(10px)", duration: 1.5, ease: "power3.out" });
    }
  }, 6000);

  if (images.length === 0) {
    checkProgress();
  } else {
    images.forEach(img => {
      if (img.complete) checkProgress();
      else {
        img.addEventListener('load', checkProgress);
        img.addEventListener('error', checkProgress);
      }
    });
  }

  glbFiles.forEach(url => {
    fetch(url)
      .then(() => checkProgress())
      .catch(() => checkProgress());
  });
});

// Synchronize Lenis scroll ticker with GSAP to prevent visual tearing
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

/* ==========================================================================
   CUSTOM CURSOR / POINTER PHYSICS
   ========================================================================== */
/**
 * WHAT: Custom DOM-based pointer tracking and CSS UV spotlight projection.
 * WHY: Enhances the tactical, high-tech theme while utilizing mouse coordinates 
 * to drive 3D transforms on hero elements.
 * HOW: Updates X/Y coordinates instantly for the dot, and uses a 0.15 lerp multiplier 
 * for the outline to create a smooth, dragging fluid motion.
 */
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

let mouseX = 0, mouseY = 0;
let outlineX = 0, outlineY = 0;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (cursorDot) {
    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;
  }

  // UV Spotlight calculations for the hero title mask
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    const rect = heroTitle.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      heroTitle.style.setProperty('--mouse-x', `${x}px`);
      heroTitle.style.setProperty('--mouse-y', `${y}px`);
    } else {
      heroTitle.style.setProperty('--mouse-x', `-100%`);
      heroTitle.style.setProperty('--mouse-y', `-100%`);
    }
  }

  // 3D Parallax Tilt for Evidence ID Card
  const idCard = document.querySelector('.evidence-id-card');
  if (idCard) {
    const cardRect = idCard.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;

    // Mathematical clamping: Dividing the delta by 25 restricts the maximum rotation angle, 
    // ensuring the card tilts realistically without flipping over.
    const rotateY = ((mouseX - cardCenterX) / 25).toFixed(2);
    const rotateX = ((cardCenterY - mouseY) / 25).toFixed(2);

    idCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;

    const glare = idCard.querySelector('.card-glare');
    if (glare) {
      const mouseXRel = e.clientX - cardRect.left;
      const mouseYRel = e.clientY - cardRect.top;
      glare.style.background = `radial-gradient(circle at ${mouseXRel}px ${mouseYRel}px, rgba(255, 255, 255, 0.7) 0%, transparent 60%)`;
    }
  }
});

document.addEventListener('mouseleave', () => {
  const idCard = document.querySelector('.evidence-id-card');
  if (idCard) {
    idCard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) rotate(3deg)`;
    const glare = idCard.querySelector('.card-glare');
    if (glare) glare.style.opacity = '0';
  }
});

// Linear Interpolation (Lerp) loop for the trailing cursor ring
function animateCursor() {
  outlineX += (mouseX - outlineX) * 0.15;
  outlineY += (mouseY - outlineY) * 0.15;

  if (cursorOutline) {
    cursorOutline.style.left = `${outlineX}px`;
    cursorOutline.style.top = `${outlineY}px`;
  }

  requestAnimationFrame(animateCursor);
}
animateCursor();

/* ==========================================================================
   INVESTIGATION BOARD / SCROLL CHOREOGRAPHY
   ========================================================================== */
/**
 * WHAT: Virtual Camera Rig over a 200vw x 250vh board.
 * WHY: Creates the illusion of panning across a physical detective board, rather 
 * than standard vertical scrolling.
 * HOW: Scrubs the X/Y coordinates of `.camera-rig` based on window dimensions, 
 * snapping to designated labels to ensure the user lands perfectly centered on a card.
 */
window.addEventListener('load', () => {
  const rig = document.querySelector('.camera-rig');
  const cards = gsap.utils.toArray('.case-file');
  const strings = gsap.utils.toArray('.string');

  if (!rig || cards.length === 0) return;

  // Setup: Hide strings initially via SVG stroke-dash calculations
  strings.forEach(string => {
    const length = string.getTotalLength();
    gsap.set(string, { strokeDasharray: length, strokeDashoffset: length });
  });

  // Desktop-Only Camera Rig
  let boardMm = gsap.matchMedia();
  
  boardMm.add("(min-width: 1025px)", () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".board-section",
        pin: true,
        start: "top top",
        end: "+=4000",
        scrub: 1,
        snap: {
          snapTo: "labelsDirectional",
          duration: { min: 0.4, max: 0.8 },
          delay: 0.01,
          ease: "power2.inOut"
        }
      }
    });

    const centerCameraOn = (element) => {
      return {
        x: window.innerWidth / 2 - element.offsetLeft,
        y: window.innerHeight / 2 - element.offsetTop
      };
    };

    tl.addLabel("card0");
    gsap.set(rig, centerCameraOn(cards[0]));

    cards.forEach((card, index) => {
      if (index === 0) return;
      const targetPos = centerCameraOn(card);
      tl.to(rig, { x: targetPos.x, y: targetPos.y, duration: 2, ease: "power2.inOut" });
      tl.to(strings[index - 1], { strokeDashoffset: 0, duration: 2, ease: "none" }, "<");
      tl.addLabel(`card${index}`);
    });
  });
});

/* ==========================================================================
   3D LAB / WEBGL ENGINE
   ========================================================================== */
/**
 * WHAT: Full-screen Three.js WebGL canvas pinned beneath HTML data cards.
 * WHY: Enables high-performance, GPU-accelerated rendering of 3D glTF models 
 * natively embedded within the DOM's scroll flow.
 * HOW: GLTFLoader parses the assets, calculates their bounding boxes to normalize 
 * scales, and injects them into a GSAP timeline that dictates their X/Y positions.
 */
window.addEventListener('load', () => {
  const container = document.getElementById('canvas-container');
  const videoSection = document.getElementById('video-showcase');
  if (!container || !videoSection) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 8.5;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);

  // Cinematic 4-Point Lighting Rig
  const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.8);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.2);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbad7ff, 1.1);
  fillLight.position.set(-6, -3, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  rimLight.position.set(0, 8, -5);
  scene.add(rimLight);

  const groups = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const meshes = [];
  groups.forEach((g) => scene.add(g));

  const geometries = [
    new THREE.BoxGeometry(2, 1.2, 0.5),
    new THREE.TorusGeometry(1, 0.25, 16, 100),
    new THREE.ConeGeometry(1.2, 1.8, 32),
    new THREE.CylinderGeometry(0.2, 0.2, 3, 32)
  ];
  const material = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.6 });

  const objectConfigs = [
    { targetSize: 3.8, rot: { x: 0.1, y: 0.2, z: -0.05 }, yOffset: 0 },
    { targetSize: 4.0, rot: { x: 0.25, y: -0.3, z: 0.2 }, yOffset: 0 },
    { targetSize: 4.2, rot: { x: 0.35, y: -0.2, z: -0.1 }, yOffset: 0.2 },
    { targetSize: 4.2, rot: { x: 1.5, y: 0, z: -1.047 }, yOffset: 0.4 }
  ];

  const loader = new THREE.GLTFLoader();
  const filePaths = [
    'assets/media/3d_Objects/cassette.glb',
    'assets/media/3d_Objects/magnifier.glb',
    'assets/media/3d_Objects/pistol.glb',
    'assets/media/3d_Objects/pen.glb'
  ];

  groups.forEach((group, i) => {
    loader.load(
      filePaths[i],
      (gltf) => {
        const model = gltf.scene;

        // Cleanup native lights/cameras baked into the GLB export
        const junk = [];
        model.traverse((child) => {
          if (child.isLight || child.isCamera) junk.push(child);
        });
        junk.forEach((j) => j.removeFromParent());

        // Bounding Box Normalization: Recalculates model origins so they rotate perfectly around their center
        const box = new THREE.Box3();
        model.traverse((child) => {
          if (child.isMesh) {
            child.updateWorldMatrix(true, true);
            box.expandByObject(child);
            if (child.material) {
              const fixMat = (mat) => {
                mat.depthWrite = true;
                mat.side = THREE.DoubleSide;
                if (mat.opacity >= 0.85) mat.transparent = false;
              };
              if (Array.isArray(child.material)) child.material.forEach(fixMat);
              else fixMat(child.material);
            }
          }
        });

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = objectConfigs[i].targetSize / maxDim;

        model.scale.set(scale, scale, scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        const wrapper = new THREE.Group();
        wrapper.rotation.set(objectConfigs[i].rot.x, objectConfigs[i].rot.y, objectConfigs[i].rot.z);
        wrapper.userData.baseY = objectConfigs[i].yOffset;
        wrapper.position.y = wrapper.userData.baseY;

        wrapper.add(model);
        group.add(wrapper);
        meshes.push(wrapper);
      },
      undefined,
      (error) => {
        // Fallback geometries if network fetch fails
        const mesh = new THREE.Mesh(geometries[i], material);
        mesh.userData.baseY = objectConfigs[i].yOffset;
        mesh.position.y = mesh.userData.baseY;
        group.add(mesh);
        meshes.push(mesh);
      }
    );
  });

  // Initial off-screen staging coordinates
  groups[0].position.set(-2.8, 0, 0);
  groups[1].position.set(12, 0, 0);
  groups[2].position.set(-12, 0, 0);
  groups[3].position.set(12, 0, 0);

  let vidMm = gsap.matchMedia();
  
  vidMm.add("(min-width: 1025px)", () => {
    const vidTl = gsap.timeline({
      scrollTrigger: {
        trigger: videoSection,
        start: "top top",
        end: "+=3000",
        pin: true,
        scrub: 1,
        snap: {
          snapTo: "labelsDirectional",
          duration: 0.8,
          delay: 0.01,
          ease: "power2.inOut"
        }
      }
    });

    const slowEase = "power3.out";
    const fastEase = "power2.in";

    vidTl.fromTo("#vid-card-1", { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: slowEase });
    vidTl.addLabel("pos1");

    vidTl.to(groups[0].position, { x: -12, duration: 1.2, ease: "power2.inOut" }, "pos1");
    vidTl.to(groups[1].position, { x: 2.8, duration: 1.2, ease: "power2.inOut" }, "pos1");
    vidTl.to(".focus-brackets, .interactive-drag-hud", { left: "70%", duration: 1.2, ease: "power2.inOut" }, "pos1");
    vidTl.to("#vid-card-1", { autoAlpha: 0, y: -40, duration: 0.6, ease: fastEase }, "pos1");
    vidTl.fromTo("#vid-card-2", { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: slowEase }, "pos1+=0.5");
    vidTl.addLabel("pos2");

    vidTl.to(groups[1].position, { x: 12, duration: 1.2, ease: "power2.inOut" }, "pos2");
    vidTl.to(groups[2].position, { x: -2.8, duration: 1.2, ease: "power2.inOut" }, "pos2");
    vidTl.to(".focus-brackets, .interactive-drag-hud", { left: "30%", duration: 1.2, ease: "power2.inOut" }, "pos2");
    vidTl.to("#vid-card-2", { autoAlpha: 0, y: -40, duration: 0.6, ease: fastEase }, "pos2");
    vidTl.fromTo("#vid-card-3", { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: slowEase }, "pos2+=0.5");
    vidTl.addLabel("pos3");

    vidTl.to(groups[2].position, { x: -12, duration: 1.2, ease: "power2.inOut" }, "pos3");
    vidTl.to(groups[3].position, { x: 2.8, duration: 1.2, ease: "power2.inOut" }, "pos3");
    vidTl.to(".focus-brackets, .interactive-drag-hud", { left: "70%", duration: 1.2, ease: "power2.inOut" }, "pos3");
    vidTl.to("#vid-card-3", { autoAlpha: 0, y: -40, duration: 0.6, ease: fastEase }, "pos3");
    vidTl.fromTo("#vid-card-4", { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: slowEase }, "pos3+=0.5");
    vidTl.addLabel("pos4");
  });

  // Custom Drag-to-Rotate Variables restricted to Focus Brackets
  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let customRotY = 0;
  let customRotX = 0;
  
  const focusBrackets = document.querySelector('.focus-brackets');
  const interactiveHud = document.querySelector('.interactive-drag-hud');

  container.addEventListener('mousedown', (e) => { 
    if (!focusBrackets) return;
    const rect = focusBrackets.getBoundingClientRect();
    
    // Strict coordinate check: Only allow drag if cursor is inside the brackets
    if (e.clientX >= rect.left && e.clientX <= rect.right && 
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      isDragging = true; 
      prevMousePos = { x: e.clientX, y: e.clientY }; 
      document.body.style.cursor = 'grabbing';
      if(interactiveHud) interactiveHud.style.borderColor = '#22c55e'; // Visual feedback
    }
  });
  
  window.addEventListener('mouseup', () => { 
    isDragging = false; 
    document.body.style.cursor = ''; 
    if(interactiveHud) interactiveHud.style.borderColor = 'rgba(238, 147, 11, 0.4)';
  });
  
  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      customRotY += deltaX * 0.01;
      customRotX += deltaY * 0.01;
      prevMousePos = { x: e.clientX, y: e.clientY };
    }
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    meshes.forEach((mesh) => {
      if (mesh) {
        // Blends clock-driven idle rotation with user-driven mouse deltas
        mesh.rotation.y = (time * 0.2) + customRotY;
        mesh.rotation.x = (Math.sin(time * 0.6) * 0.12) + customRotX;
        const baseY = mesh.userData.baseY || 0;
        mesh.position.y = baseY + Math.sin(time * 1.8) * 0.18;
      }
    });

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Cross-Navigation: Syncs HTML clicks to the ThreeJS scroll timeline
  const boardCardsFiles = document.querySelectorAll('.case-file');
  boardCardsFiles.forEach((card, index) => {
    card.addEventListener('click', () => {
      const targetLabel = `pos${index + 1}`;
      if (vidTl && vidTl.scrollTrigger) {
        const targetScroll = vidTl.scrollTrigger.labelToScroll(targetLabel);
        if (targetScroll !== undefined) {
          lenis.scrollTo(targetScroll, {
            duration: 2.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
          });
        }
      }
    });
  });

});

/* ==========================================================================
   OPERATOR DOSSIER ENGINE (TACTICAL HUD)
   ========================================================================== */
window.addEventListener('load', () => {
  const dossierCanvas = document.getElementById('dossier-canvas');
  const radarWrapper = document.getElementById('radar-wrapper');
  if (!dossierCanvas || !radarWrapper) return;

  // 1. Real 3D Global Network Sphere (Bright Day Earth)
  const dScene = new THREE.Scene();
  const rect = dossierCanvas.getBoundingClientRect();
  const dCamera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 100);
  dCamera.position.z = 5.5;

  const dRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  dRenderer.setSize(rect.width, rect.height);
  dossierCanvas.appendChild(dRenderer.domElement);

  // Load High-Res DAY Earth Texture for maximum brightness
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');

  const earthGeo = new THREE.SphereGeometry(1.6, 64, 64);

  // MeshBasicMaterial naturally ignores shadows and renders at 100% brightness
  const earthMat = new THREE.MeshBasicMaterial({
    map: earthTexture,
    color: 0xffffff
  });
  const dSphere = new THREE.Mesh(earthGeo, earthMat);
  dScene.add(dSphere);

  // Warm Tactical Atmospheric Glow
  const atmosGeo = new THREE.SphereGeometry(1.7, 32, 32);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0xee930b,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
  dScene.add(atmosMesh);

  // 3D Globe Drag-to-Rotate Mechanics
  let isRadarDragging = false;
  let radarPrevMousePos = { x: 0, y: 0 };
  let customRadarRotY = 0;
  let customRadarRotX = 0;

  radarWrapper.style.cursor = 'grab';

  radarWrapper.addEventListener('mousedown', (e) => { 
    isRadarDragging = true; 
    radarPrevMousePos = { x: e.clientX, y: e.clientY }; 
    radarWrapper.style.cursor = 'grabbing';
  });
  
  window.addEventListener('mouseup', () => { 
    isRadarDragging = false; 
    radarWrapper.style.cursor = 'grab';
  });
  
  radarWrapper.addEventListener('mousemove', (e) => {
    if (isRadarDragging) {
      const deltaX = e.clientX - radarPrevMousePos.x;
      const deltaY = e.clientY - radarPrevMousePos.y;
      customRadarRotY += deltaX * 0.008;
      customRadarRotX += deltaY * 0.008;
      radarPrevMousePos = { x: e.clientX, y: e.clientY };
    }
  });

  function animateDossier() {
    requestAnimationFrame(animateDossier);
    // Combines time-based auto-spin with user's accumulated drag rotation
    dSphere.rotation.x = customRadarRotX;
    dSphere.rotation.y = (Date.now() * 0.0005) + customRadarRotY;
    // Atmosphere counter-spins slightly for dynamic lighting effect
    atmosMesh.rotation.y = -(Date.now() * 0.0002);
    dRenderer.render(dScene, dCamera);
  }
  animateDossier();

  window.addEventListener('resize', () => {
    const newRect = dossierCanvas.getBoundingClientRect();
    if(newRect.width === 0) return;
    dCamera.aspect = newRect.width / newRect.height;
    dCamera.updateProjectionMatrix();
    dRenderer.setSize(newRect.width, newRect.height);
  });

  // 2. Premium 3D Parallax Tilt for Cards
  const dossierCards = document.querySelectorAll('.dossier-visual, .dossier-panel');
  dossierCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Calculate rotation based on pointer position relative to center
      const rotateX = ((y - centerY) / 40).toFixed(2);
      const rotateY = ((centerX - x) / 40).toFixed(2);

      gsap.to(card, {
        rotationX: rotateX,
        rotationY: rotateY,
        transformPerspective: 1000,
        ease: "power2.out",
        duration: 0.5
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        ease: "elastic.out(1, 0.3)",
        duration: 0.9
      });
    });
  });

  // 3. GSAP Entry Choreography
  const revealItems = gsap.utils.toArray('.dossier-reveal');

  // Background text parallax
  gsap.to('.dossier-bg-text', {
    yPercent: 30,
    ease: "none",
    scrollTrigger: { trigger: ".dossier-section", scrub: true }
  });

  // Entry Reveal Sequence
  ScrollTrigger.create({
    trigger: ".dossier-section",
    start: "top 65%",
    once: true,
    onEnter: () => {
      // Stagger items fading and sliding up
      gsap.from(revealItems, {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
        onComplete: () => {
          // Fire stat bars after UI resolves
          gsap.to(".fill-high", { width: "99%", duration: 1.5, ease: "power3.out" });
          gsap.to(".fill-max", { width: "100%", duration: 1.5, ease: "power3.out", delay: 0.2 });
          
          setTimeout(() => {
            document.querySelector('.glitch-target').classList.add('trigger-glitch');
          }, 800);
          
          // Matrix items now fade in naturally with the rest of the elements
          // because we added .dossier-reveal to them in the HTML!
        }
      });
    }
  });
});

/* ==========================================================================
   TEXT REVEAL / GLOBAL ANIMATION
   ========================================================================== */
window.addEventListener('load', () => {
  const revealElements = gsap.utils.toArray('.hero-section h1, .hero-section p, .hero-section .badge, .hero-section .btn');
  revealElements.forEach((el) => {
    gsap.from(el, {
      y: -30,
      opacity: 0,
      duration: 1.2,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none"
      }
    });
  });

  // Dedicated Award-Winning Terminal Boot Sequence
  const terminalLines = gsap.utils.toArray('.term-line');
  if (terminalLines.length > 0) {
    ScrollTrigger.create({
      trigger: ".terminal-window",
      start: "top 75%",
      once: true,
      onEnter: () => {
        gsap.fromTo(".terminal-window", 
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }
        );
        
        gsap.to(terminalLines, {
          y: 0, opacity: 1, duration: 0.2, stagger: 0.35, ease: "none", delay: 0.4,
          onComplete: () => {
             // Reveal input line after boot sequence
             gsap.to('.term-input-line', { y: 0, opacity: 1, duration: 0.4 });
             document.getElementById('term-input').focus();
          }
        });
      }
    });
  }
});

/* ==========================================================================
   BIOMETRIC EVIDENCE VAULT LOGIC (Native Boundary Lock)
   ========================================================================== */
window.addEventListener('load', () => {
  const scannerBtn = document.getElementById('biometric-btn');
  const progressFill = document.getElementById('scanner-progress');
  const scannerText = document.getElementById('scanner-text');
  const consoleUi = document.querySelector('.scanner-console');
  
  if (!scannerBtn || !progressFill) return;

  let holdTimer;
  let isUnlocked = false;

  // 1. Native Boundary Lock: Hide the footer so the page physically ends here
  gsap.set('.site-footer', { display: 'none', opacity: 0 });

  // Optional visual snap when reaching the vault
  ScrollTrigger.create({
    trigger: "#asset-vault",
    start: "top top",
    onEnter: () => {
      if (!isUnlocked) {
        lenis.scrollTo('#asset-vault', { duration: 1.5, immediate: false });
      }
    }
  });

  // 2. Biometric Scan Engine
  const startScan = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    if (isUnlocked) return;
    
    consoleUi.classList.add('scanning');
    scannerText.innerText = "VERIFYING IDENTITY...";
    scannerText.style.color = "#dc2626";

    gsap.to(progressFill, { width: '100%', duration: 2.5, ease: 'linear' });
    gsap.to(consoleUi, { x: 3, y: -3, rotation: 1, yoyo: true, repeat: -1, duration: 0.05 });

    holdTimer = setTimeout(() => {
      isUnlocked = true;
      executeVaultUnlock();
    }, 2500);
  };

  const stopScan = () => {
    if (isUnlocked) return;
    clearTimeout(holdTimer);
    
    consoleUi.classList.remove('scanning');
    scannerText.innerText = "HOLD TO VERIFY IDENTITY";
    scannerText.style.color = "rgb(238, 147, 11)";

    gsap.killTweensOf(progressFill);
    gsap.killTweensOf(consoleUi);
    gsap.set(consoleUi, { x: 0, y: 0, rotation: 0 });
    gsap.to(progressFill, { width: '0%', duration: 0.4, ease: 'power2.out' });
  };

  const executeVaultUnlock = () => {
    gsap.killTweensOf(consoleUi);
    scannerText.innerText = "ACCESS GRANTED";
    scannerText.style.color = "#22c55e";
    progressFill.style.background = "#22c55e";
    progressFill.style.boxShadow = "0 0 15px #22c55e";

    const unlockTl = gsap.timeline();

    unlockTl.to(consoleUi, { scale: 0.5, opacity: 0, duration: 0.5, ease: "back.in(2)", delay: 0.4 });
    unlockTl.to('.left-door', { xPercent: -100, duration: 1.5, ease: "power3.inOut" }, "-=0.2");
    unlockTl.to('.right-door', { xPercent: 100, duration: 1.5, ease: "power3.inOut" }, "<");
    unlockTl.set('.vault-doors', { pointerEvents: 'none', display: 'none' });
    unlockTl.to('.vault-interior', { opacity: 1, pointerEvents: 'auto', duration: 0.5 }, "-=0.5");
    
    // Strict fromTo tween with clearProps prevents the visibility glitch and resets residual rotations
    unlockTl.fromTo('.magnetic-vault-card', 
      { y: 60, opacity: 0, rotationX: 15, transformPerspective: 1000 },
      { y: 0, opacity: 1, rotationX: 0, stagger: 0.2, duration: 1, ease: "power3.out", clearProps: "transform" }, 
      "-=0.3"
    );

    // Restore the footer natively, enabling further scrolling downward
    unlockTl.set('.site-footer', { display: 'block' }, "-=0.5");
    unlockTl.to('.site-footer', { opacity: 1, duration: 1 }, "-=0.5");
  };

  scannerBtn.addEventListener('mousedown', startScan);
  scannerBtn.addEventListener('touchstart', startScan);
  window.addEventListener('mouseup', stopScan);
  window.addEventListener('touchend', stopScan);
  scannerBtn.addEventListener('mouseleave', stopScan);

  // Auto-Unlock listener removed so user must manually scan

  // 3. 3D Parallax Hover for the Cryo Units
  const vaultCards = document.querySelectorAll('.magnetic-vault-card');
  vaultCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / 35).toFixed(2);
      const rotateY = ((centerX - x) / 35).toFixed(2);

      gsap.to(card, { rotationX: rotateX, rotationY: rotateY, transformPerspective: 1200, ease: "power2.out", duration: 0.5 });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotationX: 0, rotationY: 0, ease: "elastic.out(1, 0.3)", duration: 0.9 });
    });
  });
});

/* ==========================================================================
   SCROLLBAR / NAVIGATION / INTERACTIVE UI
   ========================================================================== */
/**
 * WHAT: Custom HUD logic (Progress bars, Magnetic Buttons, Decrypt FX).
 * WHY: Replaces native browser mechanics with thematic, highly-polished 
 * JavaScript interactions to maintain the "systems dev" illusion.
 */

// 1. Custom Forensic Progress Scrollbar
gsap.to('.scroll-progress-bar', {
  height: '100%',
  ease: 'none',
  scrollTrigger: {
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.1
  }
});

// 2. Black-Site Navigation Toggle & Shutter Sequence
const menuToggle = document.querySelector('.menu-toggle');
const navOverlay = document.querySelector('.black-site-nav');
const navLinks = document.querySelectorAll('.nav-link');
const navLabel = document.querySelector('.nav-label');

if (menuToggle && navOverlay) {
  const navTl = gsap.timeline({ paused: true });

  navTl.set(navOverlay, { pointerEvents: 'auto', opacity: 1 })
    .to(navOverlay, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power3.inOut' })
    .fromTo([navLabel, ...navLinks],
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' },
      "-=0.4"
    );

  let isNavOpen = false;
  const siteHeader = document.querySelector('.site-header');

  menuToggle.addEventListener('click', () => {
    isNavOpen = !isNavOpen;
    document.body.style.overflow = isNavOpen ? 'hidden' : '';

    if (isNavOpen) {
      gsap.set(navLinks, { color: 'transparent', scale: 1, filter: 'none' });
      navTl.play();

      // Delay CSS class toggles until the physical shutter covers the header
      setTimeout(() => {
        menuToggle.classList.add('active');
        siteHeader.classList.add('menu-open');
      }, 250);
    } else {
      navTl.reverse();

      setTimeout(() => {
        menuToggle.classList.remove('active');
        siteHeader.classList.remove('menu-open');
      }, 450);
    }
  });

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isNavOpen) return;

      const targetId = link.getAttribute('href');
      const otherLinks = Array.from(navLinks).filter(l => l !== link);

      const lockTl = gsap.timeline({
        onComplete: () => {
          isNavOpen = false;
          document.body.style.overflow = '';

          gsap.to(navOverlay, {
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: 0.6,
            ease: 'power3.in',
            onComplete: () => {
              menuToggle.classList.remove('active');
              siteHeader.classList.remove('menu-open');

              navTl.pause(0);
              gsap.set(navOverlay, { opacity: 0, pointerEvents: 'none', clipPath: 'inset(100% 0% 0% 0%)' });

              lenis.scrollTo(targetId, { duration: 1.5 });
            }
          });
        }
      });

      lockTl.to(otherLinks, { opacity: 0, duration: 0.3, ease: 'power1.out' }, 0)
        .to(link, {
          color: '#dc2626',
          scale: 1.1,
          textShadow: '0 0 30px rgba(220, 38, 38, 0.8)',
          duration: 0.3,
          ease: 'back.out(2)'
        }, 0)
        .to(link, { opacity: 0, duration: 0.2, delay: 0.2 });
    });
  });
}

// 3. Magnetic Buttons Engine (Hover Physics)
const magneticButtons = document.querySelectorAll('.btn');
magneticButtons.forEach(btn => {
  btn.style.transition = 'background 0.4s, color 0.4s, border-color 0.4s, box-shadow 0.4s';

  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.4;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.4;
    gsap.to(btn, { x: x, y: y, duration: 0.5, ease: "power2.out" });
  });

  btn.addEventListener('mouseleave', () => {
    gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.3)" });
  });
});

// Magnetic Case Files Engine
const magneticCards = document.querySelectorAll('.case-file');
magneticCards.forEach(card => {
  const originalRot = gsap.getProperty(card, "rotation");
  card.style.transition = 'border-width 0.3s, border-color 0.3s, box-shadow 0.4s';

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX - centerX) * 0.1;
    const y = (e.clientY - centerY) * 0.1;
    const rotateY = ((e.clientX - centerX) / 30).toFixed(2);
    const rotateX = ((centerY - e.clientY) / 30).toFixed(2);

    gsap.to(card, {
      x: x, y: y,
      rotationX: rotateX,
      rotationY: rotateY,
      scale: 1.15,
      rotationZ: 0,
      duration: 0.5,
      ease: "power2.out",
      transformPerspective: 1000,
      transformOrigin: "center center"
    });
  });

  card.addEventListener('mouseleave', () => {
    gsap.to(card, {
      x: 0, y: 0,
      xPercent: -50, yPercent: -50,
      rotationX: 0,
      rotationY: 0,
      scale: 1,
      rotationZ: originalRot,
      duration: 0.7,
      ease: "elastic.out(1, 0.3)",
      overwrite: "auto"
    });
  });
});

// 4. Click-to-Reveal Engine for 3D Forensic Cards
// Uses textContent slicing logic instead of innerHTML to prevent the DOM 
// layout from collapsing while generating random hash strings during the reveal.
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
const forensicCards = document.querySelectorAll('.forensic-report');

forensicCards.forEach(card => {
  const overlay = card.querySelector('.confidential-overlay');
  const cText = card.querySelector('.confidential-text');
  const cStamp = card.querySelector('.confidential-stamp');
  const clickPrompt = card.querySelector('.click-prompt');

  const decryptElements = card.querySelectorAll('.report-title, .report-code, .data-label, .data-value, .analysis-label, p, .check-label');
  const innerContent = card.querySelectorAll('.report-header, .report-body, .paperclip, .top-secret-stamp');

  decryptElements.forEach(el => { el.dataset.original = el.textContent.trim(); });

  gsap.set(innerContent, { opacity: 0 });
  cText.innerText = "";
  gsap.set(cStamp, { opacity: 0, scale: 4 });
  gsap.set(clickPrompt, { opacity: 0 });

  ScrollTrigger.create({
    trigger: card,
    start: "top 85%",
    once: true,
    onEnter: () => {
      const targetWord = "CONFIDENTIAL";
      let iterations = 0;
      
      const scrambleInterval = setInterval(() => {
        cText.textContent = targetWord.split("").map((letter, index) => {
          if (index < iterations) return targetWord[index];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("");
        
        iterations += 1/3; // Controls decipher speed
        
        if (iterations >= targetWord.length) {
          clearInterval(scrambleInterval);
          cText.textContent = targetWord;
          gsap.to(cStamp, { opacity: 1, scale: 1, rotation: -15, duration: 0.4, ease: "back.out(3)" });
          gsap.to(clickPrompt, { opacity: 1, duration: 0.5, delay: 0.5 });
        }
      }, 30);
    }
  });

  let isRevealed = false;
  card.addEventListener('click', () => {
    if (isRevealed) return;
    isRevealed = true;

    card.classList.add('revealed');
    gsap.to(overlay, { opacity: 0, duration: 0.5, ease: "power2.inOut" });
    gsap.to(innerContent, { opacity: 1, duration: 0.5, delay: 0.3 });

    setTimeout(() => {
      decryptElements.forEach(el => {
        let iterations = 0;
        const originalText = el.dataset.original;
        const turboSpeed = Math.max(1, originalText.length / 40);

        clearInterval(el.interval);
        el.interval = setInterval(() => {
          el.textContent = originalText.split("").map((letter, index) => {
            if (letter === " ") return " ";
            if (index < iterations) return originalText[index];
            return chars[Math.floor(Math.random() * chars.length)];
          }).join("");

          if (iterations >= originalText.length) {
            clearInterval(el.interval);
            el.textContent = originalText;
          }

          iterations += turboSpeed;
        }, 30);
      });
    }, 300);
  });
});

/* ==========================================================================
   MOBILE SCROLL-HOVER ENGINE
   ========================================================================== */
/**
 * WHAT: Simulates hover states on mobile by triggering them when elements hit center-screen.
 * WHY: Touch devices lack a native continuous hover, making complex interactive CSS feel static.
 */
let mm = gsap.matchMedia();

mm.add("(max-width: 1024px)", () => {
  const mobileTargets = gsap.utils.toArray('.case-file, .forensic-report, .skill-row, .cryo-unit');

  // Auto-triggers hover animations dynamically as you scroll past them
  mobileTargets.forEach(target => {
    ScrollTrigger.create({
      trigger: target,
      start: "top 55%",
      end: "bottom 45%",
      toggleClass: "mobile-active",
      onEnter: () => {
        target.classList.add("mobile-active");
        if (target.classList.contains('forensic-report')) target.click(); // Auto-decrypt forensic cards on scroll
      },
      onLeave: () => target.classList.remove("mobile-active"),
      onEnterBack: () => {
        target.classList.add("mobile-active");
        if (target.classList.contains('forensic-report')) target.click();
      },
      onLeaveBack: () => target.classList.remove("mobile-active")
    });
  });
});

/* ==========================================================================
   GLOBAL EVENT TRIGGERS & LIVE HUD ENGINE
   ========================================================================== */
window.addEventListener('load', () => {
  // Smooth scroll to vault without auto-unlocking
  document.querySelectorAll('a[href="#asset-vault"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo('#asset-vault', { duration: 1.5 });
    });
  });

  // Live HUD Telemetry Update Loop (Real User Data via Web APIs)
  setInterval(() => {
    const pingEl = document.querySelector('.ping-tracker');
    const memEl = document.querySelector('.memory-tracker');
    const speedEl = document.querySelector('.speed-tracker');

    // 1. Real Ping & Network Speed (Network Information API - Chromium/Android)
    if (navigator.connection) {
      const rtt = navigator.connection.rtt; // Latency
      const downlink = navigator.connection.downlink; // Mbps
      const effectiveType = navigator.connection.effectiveType.toUpperCase(); 

      if (pingEl) pingEl.innerText = rtt ? rtt + 'ms' : '12ms';
      
      if (speedEl) {
        const speedText = `UPLINK: ${effectiveType} // D/L: ${downlink}Mbps`;
        speedEl.innerText = speedText;
        speedEl.setAttribute('data-text', speedText); // Updates hover glitch effect
      }
    } else {
      // Fallback for Safari/Firefox
      if (pingEl) pingEl.innerText = Math.floor(Math.random() * (25 - 12 + 1) + 12) + 'ms';
    }

    // 2. Real Browser Memory Heap (Performance API - Chrome/Edge only)
    if (window.performance && window.performance.memory) {
      const usedHeapMB = (window.performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
      if (memEl) memEl.innerText = usedHeapMB + 'MB';
    } else {
      // Fallback simulation
      if (memEl) {
        const mem = (Math.random() * (45.6 - 42.1) + 42.1).toFixed(1);
        memEl.innerText = mem + 'MB';
      }
    }
  }, 2000);
});
