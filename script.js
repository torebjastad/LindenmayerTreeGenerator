import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

// --- Configuration ---
const MAX_SEGMENTS = 400000; // Safety limit

// --- State ---
let scene, camera, renderer, controls, composer;
let treeMesh, leafMesh, jointMesh, groundMesh;
let savedBaseLeafMatrices = [];
let isGenerating = false;

// --- DOM Elements ---
const uiParams = {
    iterations: document.getElementById('iterations'),
    angle: document.getElementById('angle'),
    angleRandom: document.getElementById('angle-random'),
    length: document.getElementById('step-length'),
    taper: document.getElementById('width-taper'),
    leafSize: document.getElementById('leaf-size'),
    leavesTipsOnly: document.getElementById('leaves-tips-only'),
    showGround: document.getElementById('show-ground'),
    autoScale: document.getElementById('auto-scale'),
    axiom: document.getElementById('axiom'),
    rules: document.getElementById('rules'),
    width: document.getElementById('width'),
    colorBase: document.getElementById('color-base'),
    colorTip: document.getElementById('color-tip'),
    colorLeaf: document.getElementById('color-leaf')
};
const getRenderMode = () => {
    const el = document.querySelector('input[name="render-mode"]:checked');
    return el ? el.value : '3d';
};
const statsEl = document.getElementById('stats');
const loaderEl = document.getElementById('loader');

// --- Presets ---
const presets = {
    tree1: {
        axiom: "X",
        rules: "X=F-[![X]+X]+F[+F!X]-X\nF=FF",
        angle: 22.5,
        iter: 6,
        len: 1.5,
        width: 0.961,
        cBase: "#5d4037",
        cTip: "#22c55e",
        cLeaf: "#f0abfc",
        taper: 0.69,
        angleRandom: 2
    },
    tree2: {
        axiom: "F",
        rules: "F=FF!+[+F-F-F]-[-F+F+F]",
        angle: 25,
        iter: 4,
        len: 2,
        width: 0.732,
        cBase: "#2d1b0e",
        cTip: "#84cc16",
        cLeaf: "#86efac",
        taper: 0.96,
        leavesTipsOnly: true
    },
    leafy2: {
        axiom: "X",
        rules: "X=F///+[[!XL]///-!XL]///-F[///-F!XL]///+!XL\nF=FF",
        angle: 22.5,
        iter: 7,
        len: 0.1,
        width: 0.37,
        cBase: "#36200C",
        cTip: "#6E4121",
        cLeaf: "#34AA09",
        taper: 0.81,
        angleRandom: 6,
        leafSize: 5.0,
        leavesTipsOnly: true
    },
    leafy: {
        axiom: "FX",
        rules: "X=![FXL][+FXL][-FXL][&FXL][^FXL]\nF=FF",
        angle: 34,
        iter: 7,
        len: 0.5,
        width: 9.418,
        cBase: "#2C1A02",
        cTip: "#683E03",
        cLeaf: "#0F990F",
        taper: 0.39,
        angleRandom: 22,
        leafSize: 4.6,
        leavesTipsOnly: true
    },
    pine: {
        axiom: "FX",
        rules: "X=![+FX][-FX][&FX][^FX]\nF=FF",
        angle: 22,
        iter: 8,
        len: 0.5,
        width: 6.699,
        cBase: "#3f2e18",
        cTip: "#05850d",
        cLeaf: "#05850d",
        taper: 0.58,
        angleRandom: 14,
        leavesTipsOnly: true
    },
    fern: {
        axiom: "X",
        rules: "X=F[+!X][ -!X]F!X\nF=FF",
        angle: 25,
        iter: 6,
        len: 1,
        width: 0.905,
        cBase: "#1a642e",
        cTip: "#22c55e",
        cLeaf: "#ccfbf1",
        taper: 0.7,
        leavesTipsOnly: true
    },
    fern3d: {
        axiom: "X",
        rules: "X=F///+[[!X]///-!X]///-F[///-F!X]///+!X\nF=FF",
        angle: 22.5,
        iter: 7,
        len: 0.1,
        width: 0.370,
        cBase: "#2e5c18", // Deep Green
        cTip: "#22c55e",  // Bright Green
        cLeaf: "#86efac", // Pale Green
        taper: 0.81,
        angleRandom: 6,
        leavesTipsOnly: true
    },
    bush: {
        axiom: "A",
        rules: "A=[&FL!A]/////'[&FL!A]///////'[&FL!A]\nF=S/////F\nS=FL\nL=['''^^{-f+f+f-|-f+f+f}]",
        angle: 22.5,
        iter: 7,
        len: 2,
        width: 1.422,
        cBase: "#3f2e18",
        cTip: "#0cad00",
        cLeaf: "#f43f5e",
        taper: 0.61,
        leafSize: 2.0,
        leavesTipsOnly: true
    },
    spire: {
        axiom: "F",
        rules: "F=F[&+F][&-F][^+F][^-F]//F",
        angle: 28.5,
        iter: 6,
        len: 2,
        width: 0.17,
        cBase: "#4a4036", // Dark Grey/Brown
        cTip: "#a8a8a0", // Beige/Grey
        cLeaf: "#ffcc00", // Yellow/Orange
        taper: 1.0,
        angleRandom: 2
    },
    hilbert: {
        axiom: "A",
        rules: "A=B-F+CFC+F-D&F^D-F+&&CFC+F+B//\nB=A&F^CFB^F^D^^-F-D^|F^B|FC^F^A//\nC=|D^|F^B-F+C^F^A&&FA&F^C+F+B^F^D//\nD=|CFB-F+B|FA&F^A&&FB-F+B|FC//",
        angle: 90,
        iter: 3,
        len: 4,
        width: 0.2,
        cBase: "#0ea5e9",
        cTip: "#d946ef",
        cLeaf: "#ffffff",
        taper: 1.0,
        leavesTipsOnly: true
    },
    twisted: {
        axiom: "F",
        rules: "F=F[&+F][&-F]///F",
        angle: 30,
        iter: 5,
        len: 2,
        width: 0.15,
        cBase: "#44403c",
        cTip: "#a8a29e",
        cLeaf: "#fbbf24",
        taper: 1.0
    },
    barnsley: {
        axiom: "X",
        rules: "X=F+[[!X]-!X]-F[-F!X]+!X\nF=FF",
        angle: 25,
        iter: 7,
        len: 1.5,
        width: 3.754,
        cBase: "#14532d",
        cTip: "#22c55e",
        cLeaf: "#86efac",
        taper: 0.73
    },
    flower: {
        axiom: "FFA",
        rules: "A=[&FL!A]///'[&FL!A]///'[&FL!A]///'[&FL!A]\nF=S/////F\nS=FL\nL=['''^^{-f+f+f-|-f+f+f}]",
        angle: 27,
        iter: 7,
        len: 0.1,
        width: 0.098,
        cBase: "#3f2e18",
        cTip: "#00ff00",
        cLeaf: "#ff4040",
        taper: 0.61,
        angleRandom: 2,
        leafSize: 2.3,
        leavesTipsOnly: true
    }
};

// --- Initialization ---
function init() {
    const container = document.getElementById('canvas-container');

    // Prevent multiple initializations or clear previous canvas
    if (renderer) {
        renderer.dispose();
        // Also clean up scene/controls if needed, but simple clear is good
    }
    container.innerHTML = '';

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.002);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 40, 80);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050505);
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Critical for correct brightness/colors
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;

    // Lights
    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 2.5); // Boosted Sky Light
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.name = 'keyLight';
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    // Set initial wide shadow camera
    const d = 100;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xcceeff, 1.0); // Cool rim light
    backLight.name = 'fillLight';
    backLight.position.set(-50, 50, -50);
    scene.add(backLight);
    scene.add(backLight.target); // Allow target to move
    scene.add(dirLight.target);  // Allow target to move

    const headlight = new THREE.DirectionalLight(0xffffff, 0.5);
    headlight.position.set(0, 0, 1); // Point along camera Z
    camera.add(headlight);
    scene.add(camera);

    // Ground Plane
    const groundGeo = new THREE.CircleGeometry(2000, 32);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 1,
        metalness: 0
    });
    groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Post Processing (Bloom)
    // Use multi-sampled render target for Antialiasing with Post-Processing
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 4 // Enable 4x MSAA (WebGL 2)
    });

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 0.8; // Glow strength
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('btn-generate').addEventListener('click', generateLSystem);
    document.getElementById('preset-select').addEventListener('change', loadPreset);
    const showGroundEl = document.getElementById('show-ground');
    if (showGroundEl) {
        showGroundEl.addEventListener('change', (e) => {
            if (groundMesh) groundMesh.visible = e.target.checked;
        });
    }

    const autoScaleEl = document.getElementById('auto-scale');
    if (autoScaleEl) {
        autoScaleEl.addEventListener('change', processAutoScale);
    }
    document.getElementById('toggle-ui').addEventListener('click', () => {
        document.getElementById('ui-panel').classList.toggle('collapsed');
    });

    // Auto-generate on slider/input release (change event)
    Object.values(uiParams).forEach(input => {
        if (input) {
            if (input === uiParams.leafSize) {
                input.addEventListener('input', updateLeafSize); // Instant Update
            } else if (input === uiParams.colorBase ||
                input === uiParams.colorTip ||
                input === uiParams.colorLeaf) {
                // Do nothing on 'change', as 'input' handles it live.
                // Prevents regen when closing color picker.
            } else {
                input.addEventListener('change', generateLSystem);
            }
        }
    });
    document.getElementById('preset-select').addEventListener('change', generateLSystem);
    document.querySelectorAll('input[name="render-mode"]').forEach(radio => {
        radio.addEventListener('change', generateLSystem);
    });

    // Live Update Listeners (Debounced for heavy ops, instant for colors)
    uiParams.colorBase.addEventListener('input', updateColors);
    uiParams.colorTip.addEventListener('input', updateColors);
    uiParams.colorLeaf.addEventListener('input', updateLeafColor);

    // Value displays
    const valDisplays = {
        'iterations': 'iter-val',
        'angle': 'angle-val',
        'angle-random': 'angle-random-val',
        'step-length': 'length-val',
        'width': 'width-val',
        'width-taper': 'taper-val',
        'leaf-size': 'leaf-size-val'
    };

    // Helper for Logarithmic Width
    const minW = 0.01, maxW = 50;
    const getLogWidth = (val) => {
        // val is 0..1
        return minW * Math.pow(maxW / minW, val);
    };
    const getSliderPos = (width) => {
        // width is 0.01..50
        return Math.log(width / minW) / Math.log(maxW / minW);
    };

    Object.keys(valDisplays).forEach(id => {
        const input = document.getElementById(id);
        const display = document.getElementById(valDisplays[id]);
        if (input && display) {
            input.addEventListener('input', () => {
                let val = input.value;
                if (id === 'width') {
                    // Logarithmic display
                    const w = getLogWidth(parseFloat(val));
                    display.textContent = w.toFixed(3);
                } else {
                    display.textContent = val;
                }
            });
        }
    });

    // Initial Display Update
    Object.keys(valDisplays).forEach(id => {
        const input = document.getElementById(id);
        const display = document.getElementById(valDisplays[id]);
        if (input && display && id === 'width') {
            const w = getLogWidth(parseFloat(input.value));
            display.textContent = w.toFixed(3);
        }
    });

    // Initial Generation
    // Load default preset values first
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        loadPreset.call(presetSelect);
    }
    generateLSystem(true);
    animate();
}

// --- L-System Logic ---

function generateLSystem(resetCamera = false) {
    if (typeof resetCamera === 'object') resetCamera = false;

    if (isGenerating) return;
    isGenerating = true;
    loaderEl.style.display = 'block';

    // Wait a frame to let UI update (loader show)
    setTimeout(() => {
        try {
            const axiom = uiParams.axiom.value;
            const rulesRaw = uiParams.rules.value.split('\n');
            const rules = {};
            rulesRaw.forEach(r => {
                const [key, val] = r.split('=');
                if (key && val) rules[key.trim()] = val.trim();
            });

            const iterations = parseInt(uiParams.iterations.value);
            const angle = parseFloat(uiParams.angle.value) * (Math.PI / 180);
            const angleVariance = parseFloat(uiParams.angleRandom.value) * (Math.PI / 180);
            const stepLen = parseFloat(uiParams.length.value);
            // Logarithmic Width
            const widthVal = parseFloat(uiParams.width.value);
            const minW = 0.01, maxW = 50;
            const width = minW * Math.pow(maxW / minW, widthVal);
            const taper = uiParams.taper ? parseFloat(uiParams.taper.value) : 1.0;
            const leafSize = uiParams.leafSize ? parseFloat(uiParams.leafSize.value) : 1.0;
            const leavesTipsOnly = uiParams.leavesTipsOnly ? uiParams.leavesTipsOnly.checked : false;
            const autoScale = uiParams.autoScale ? uiParams.autoScale.checked : true;

            // 1. Generate String
            let lString = axiom;
            for (let i = 0; i < iterations; i++) {
                let nextString = "";
                for (let char of lString) {
                    nextString += rules[char] || char;
                }
                lString = nextString;
                // Safety break for string length
                if (lString.length > 1000000) {
                    console.warn("L-System string too long, truncated.");
                    break;
                }
            }

            // 2. Build Geometry
            buildGeometry(lString, angle, angleVariance, stepLen, width, taper, leafSize, leavesTipsOnly, autoScale, resetCamera);

        } catch (e) {
            console.error(e);
            alert("Error generating L-System: " + e.message);
        } finally {
            isGenerating = false;
            loaderEl.style.display = 'none';
        }
    }, 50);
}

function buildGeometry(lString, angle, angleVariance, stepLen, width, taper, leafSize, leavesTipsOnly, autoScale, resetCamera) {
    // Clean up old meshes
    if (treeMesh) {
        scene.remove(treeMesh);
        treeMesh.geometry.dispose();
        treeMesh.material.dispose();
    }
    if (leafMesh) {
        scene.remove(leafMesh);
        leafMesh.dispose();
    }

    // Turtle State
    const stateStack = [];
    let pos = new THREE.Vector3(0, 0, 0);
    let quat = new THREE.Quaternion();
    let currentStep = stepLen;
    let currentWidth = width;

    // Temporary vectors for math
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);
    const rotHelper = new THREE.Quaternion();

    // Buffers for InstancedMesh
    const branchMatrices = [];
    const branchHeights = [];
    const branchTapers = []; // Store taper ratio for lookahead

    // Leaf transforms
    const leafMatrices = [];
    savedBaseLeafMatrices = []; // Clear global storage

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Helper to update bounds
    function updateBounds(v) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
    }

    updateBounds(pos); // Start pos

    // Helper for random angle
    const getAngle = () => angle + (Math.random() - 0.5) * 2 * angleVariance;

    // Gradual Taper State
    let activeDecay = 1.0;
    let segmentsRemaining = 0;
    let targetBangIndex = -1;


    // --- Continuous 3D Mesh Data ---
    const vertices = [];
    const colors = [];
    const indices = [];
    let vertexCount = 0;

    // Track the frame for each ring
    const ringFrames = []; // index -> { forward: Vector3, axis: Vector3 } 

    // Helper: Add a ring of vertices
    const radialSegments = 8;
    const addRing = (p, q, radius, refFrame = null) => {
        const startIdx = vertexCount;

        // Determine the "Forward" direction (Normal of the ring)
        const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();

        let axis;

        if (refFrame) {
            // Robust Parallel Transport using Quaternion Rotation
            // Calculate the rotation that aligns oldForward to newForward with minimal twist
            const quatTransport = new THREE.Quaternion().setFromUnitVectors(refFrame.forward, forward);

            // Apply this rotation to the old axis
            axis = refFrame.axis.clone().applyQuaternion(quatTransport).normalize();

        } else {
            // First ring or reset logic
            axis = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
        }

        // Store this frame 
        const ringIndex = ringFrames.length;
        ringFrames.push({ forward: forward, axis: axis });

        // Generate Vertices
        const binormal = new THREE.Vector3().crossVectors(forward, axis).normalize();

        for (let j = 0; j < radialSegments; j++) {
            const angle = (j / radialSegments) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // ringPos = p + radius * (cos * axis + sin * binormal)
            const vX = axis.x * cos + binormal.x * sin;
            const vY = axis.y * cos + binormal.y * sin;
            const vZ = axis.z * cos + binormal.z * sin;

            vertices.push(p.x + vX * radius, p.y + vY * radius, p.z + vZ * radius);
            vertexCount++;
        }

        return { startIdx, ringIndex };
    };

    // Helper: Add faces between two rings
    const addSegmentFaces = (r1, r2) => {
        for (let j = 0; j < radialSegments; j++) {
            const next = (j + 1) % radialSegments;
            const a = r1 + j;
            const b = r1 + next;
            const c = r2 + j;
            const d = r2 + next;

            indices.push(a, d, c);
            indices.push(a, b, d);
        }
    };

    // State for continuous mesh
    let lastRingInfo = null;

    // Initial Ring (Root)
    const initialWidth = currentWidth;
    if (getRenderMode() === '3d') {
        lastRingInfo = addRing(pos, quat, currentWidth / 2, null);
    }

    for (let i = 0; i < lString.length; i++) {
        const char = lString[i];

        if (char === 'F' || char === 'G') {
            const startPos = pos.clone();
            const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
            const segmentLen = currentStep;
            const endPos = startPos.clone().add(dir.clone().multiplyScalar(segmentLen));

            // Lookahead if needed (Gradual Taper)
            if (segmentsRemaining <= 0) {
                let tempCount = 0;
                let tempIndex = i;
                let foundTaper = false;
                let bracketDepth = 0;
                while (tempIndex < lString.length) {
                    const c = lString[tempIndex];
                    if (c === '[') bracketDepth++;
                    if (c === ']') {
                        if (bracketDepth > 0) bracketDepth--;
                        else break;
                    } else if (bracketDepth === 0) {
                        if (c === '!') { foundTaper = true; break; }
                        if (c === 'F' || c === 'G') tempCount++;
                    }
                    tempIndex++;
                }
                if (foundTaper && tempCount > 0) {
                    const validTaper = (taper < 1.0) ? taper : 1.0;
                    activeDecay = Math.pow(validTaper, 1 / tempCount);
                    segmentsRemaining = tempCount;
                    targetBangIndex = tempIndex;
                } else {
                    activeDecay = 1.0;
                    segmentsRemaining = 0;
                    targetBangIndex = -1;
                }
            }
            if (getRenderMode() !== '3d') branchTapers.push(activeDecay); // Only need for instanced
            currentWidth *= activeDecay;
            if (segmentsRemaining > 0) segmentsRemaining--;

            // Legacy 2D / Instanced Logic (Only if not 3D continuous)
            if (getRenderMode() !== '3d') {
                // Branch Matrix Calculation
                const dummy = new THREE.Object3D();
                dummy.position.copy(startPos.clone().add(endPos).multiplyScalar(0.5));
                dummy.quaternion.copy(quat);
                dummy.scale.set(currentWidth, segmentLen, currentWidth);
                dummy.updateMatrix();
                branchMatrices.push(dummy.matrix.clone());
                branchHeights.push(startPos.y);
            } else {
                // Continuous 3D Logic - Parallel Transport
                // If we don't have a valid start ring (e.g. after G move), create one
                if (!lastRingInfo) {
                    lastRingInfo = addRing(startPos, quat, currentWidth / 2, null);
                }

                // Check for Direction Change (Turn)
                // If the new direction differs from the last ring's direction, insert a Pivot Ring
                const prevFrame = ringFrames[lastRingInfo.ringIndex];
                const currentForward = new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize();

                // Dot product check for alignment (1.0 = aligned)
                if (prevFrame.forward.dot(currentForward) < 0.999) {
                    // Generate a duplicate Pivot Ring at startPos, but aligned to new direction
                    // This creates a "Knuckle" (Zero-length segment) to bridge the rotation

                    // Refined Pivot Ring Width:
                    // `currentWidth` has already been decayed for the *end* of this segment.
                    // The pivot ring is at the *start* of this segment, so it should use the width *before* decay.
                    const startWidth = (activeDecay > 0) ? currentWidth / activeDecay : currentWidth;

                    const pivotRingInfo = addRing(startPos, quat, startWidth / 2, prevFrame);
                    addSegmentFaces(lastRingInfo.startIdx, pivotRingInfo.startIdx);
                    lastRingInfo = pivotRingInfo;
                }

                // Now generate the Main Segment
                const endRingInfo = addRing(endPos, quat, currentWidth / 2, ringFrames[lastRingInfo.ringIndex]);

                addSegmentFaces(lastRingInfo.startIdx, endRingInfo.startIdx);
                lastRingInfo = endRingInfo;
            }

            // Update turtle
            pos.copy(endPos);
            updateBounds(pos);

            if (getRenderMode() !== '3d' && branchMatrices.length > MAX_SEGMENTS) break;
            if (getRenderMode() === '3d' && vertexCount > 10000000) break; // Safety break increased

        } else if (char === 'L' || char === 'P') {
            // "Leaves Only At Tips" Check
            let shouldDraw = true;
            if (leavesTipsOnly) {
                // Peek ahead: If we see F, G, or [, then we are NOT at a tip
                let peekIndex = i + 1;
                while (peekIndex < lString.length) {
                    const nextChar = lString[peekIndex];
                    if (nextChar === 'F' || nextChar === 'G' || nextChar === '[') {
                        shouldDraw = false;
                        break;
                    }
                    if (nextChar === ']') break; // Branch closed, we are safe
                    // Ignore rotations, !, colors, etc.
                    peekIndex++;
                }
            }

            if (shouldDraw) {
                const dummy = new THREE.Object3D();
                dummy.position.copy(pos);
                dummy.quaternion.copy(quat);
                dummy.rotateX(Math.random());
                dummy.rotateY(Math.random());
                dummy.updateMatrix();

                // Store BASE matrix (scale = stepLen * 0.5) for live resizing
                const baseS = stepLen * 0.5;
                dummy.scale.set(baseS, baseS, baseS);
                dummy.updateMatrix();
                savedBaseLeafMatrices.push(dummy.matrix.clone());

                // Apply initial leafSize
                const s = baseS * leafSize;
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                leafMatrices.push(dummy.matrix.clone());
            }

        } else if (char === '+') {
            rotHelper.setFromAxisAngle(zAxis, getAngle());
            quat.multiply(rotHelper);
        } else if (char === '-') {
            rotHelper.setFromAxisAngle(zAxis, -getAngle());
            quat.multiply(rotHelper);
        } else if (char === '&') {
            rotHelper.setFromAxisAngle(xAxis, getAngle());
            quat.multiply(rotHelper);
        } else if (char === '^') {
            rotHelper.setFromAxisAngle(xAxis, -getAngle());
            quat.multiply(rotHelper);
        } else if (char === '\\') {
            rotHelper.setFromAxisAngle(yAxis, getAngle());
            quat.multiply(rotHelper);
        } else if (char === '/') {
            rotHelper.setFromAxisAngle(yAxis, -getAngle());
            quat.multiply(rotHelper);
        } else if (char === '|') {
            rotHelper.setFromAxisAngle(zAxis, Math.PI);
            quat.multiply(rotHelper);
        } else if (char === '!') {
            if (i === targetBangIndex) {
                activeDecay = 1.0;
                segmentsRemaining = 0;
                targetBangIndex = -1;
            } else {
                currentWidth *= taper;
            }
        } else if (char === '[') {
            stateStack.push({
                pos: pos.clone(),
                quat: quat.clone(),
                step: currentStep,
                width: currentWidth,
                decay: activeDecay,
                segs: segmentsRemaining,
                target: targetBangIndex,
                lastBend: lastRingInfo // Save current ring
            });
            // Don't reset taper state here? The original code did.
            activeDecay = 1.0;
            segmentsRemaining = 0;
            targetBangIndex = -1;
        } else if (char === ']') {
            if (stateStack.length > 0) {
                const state = stateStack.pop();
                pos.copy(state.pos);
                quat.copy(state.quat);
                currentStep = state.step;
                currentWidth = state.width;
                activeDecay = state.decay;
                segmentsRemaining = state.segs;
                targetBangIndex = state.target;
                // IMPORTANT: When returning to a branch point, we shouldn't necessarily
                // force the next segment to align with the PREVIOUS sibling branch.
                // It should align with the PARENT ring.
                // Fortunately, state.lastBend points to the PARENT ring index from before the push.
                lastRingInfo = state.lastBend; // Restore ring for branching
            }
        }
    }

    let geometry, material;

    if (getRenderMode() === '3d' && vertices.length > 0) {
        // Build Continuous Mesh
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1)); // Use Uint32 for potentially large indices
        geometry.computeVertexNormals();

        // Coloring based on Height (maxY)
        const vColors = [];
        const cBase = new THREE.Color(uiParams.colorBase.value);
        const cTip = new THREE.Color(uiParams.colorTip.value);
        // Need to calculate maxY first
        // updateBounds did it? Yes.
        const yRange = (maxY - minY) || 1;

        for (let i = 0; i < vertices.length; i += 3) {
            const y = vertices[i + 1];
            const t = Math.max(0, Math.min(1, (y - minY) / yRange));
            const c = cBase.clone().lerp(cTip, t);
            vColors.push(c.r, c.g, c.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(vColors, 3));

        // Material with vertex colors
        material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1
        });

        treeMesh = new THREE.Mesh(geometry, material);
        treeMesh.castShadow = true;
        treeMesh.receiveShadow = true;
        scene.add(treeMesh);
        treeMesh.userData.bounds = { minX, maxX, minY, maxY, minZ, maxZ };

        scene.fog.density = 0.002;

    } else if (branchMatrices.length > 0) {
        // Fallback for 2D or legacy (Instanced)
        const renderMode = getRenderMode();

        if (renderMode === '3d') {
            geometry = new THREE.CylinderGeometry(1, 1, 1, 5); // Centered
            material = new THREE.MeshPhongMaterial({ shininess: 10 });
            scene.fog.density = 0.002;
        } else {
            geometry = new THREE.BoxGeometry(1, 1, 0.01);
            material = new THREE.MeshBasicMaterial(); // No lighting
            scene.fog.density = 0.0001; // Less fog in 2D
        }

        treeMesh = new THREE.InstancedMesh(geometry, material, branchMatrices.length);
        treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        treeMesh.userData.branchHeights = branchHeights; // Keep for instanced coloring
        treeMesh.userData.maxY = maxY; // Keep for instanced coloring
        treeMesh.castShadow = true;
        treeMesh.receiveShadow = true;

        const colorBase = new THREE.Color(uiParams.colorBase.value);
        const colorTip = new THREE.Color(uiParams.colorTip.value);

        for (let i = 0; i < branchMatrices.length; i++) {
            treeMesh.setMatrixAt(i, branchMatrices[i]);
            const t = Math.min(1, Math.max(0, branchHeights[i] / maxY));
            treeMesh.setColorAt(i, colorBase.clone().lerp(colorTip, t));
        }

        treeMesh.instanceMatrix.needsUpdate = true;
        if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;

        scene.add(treeMesh);
        treeMesh.userData.bounds = { minX, maxX, minY, maxY, minZ, maxZ };
    }



    // 5. Create Leaves
    if (leafMatrices.length > 0) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.5, 0.5, 0, 1);
        shape.quadraticCurveTo(-0.5, 0.5, 0, 0);
        const leafGeo = new THREE.ShapeGeometry(shape);
        const renderMode = getRenderMode();
        const leafMat = renderMode === '3d'
            ? new THREE.MeshPhongMaterial({ color: uiParams.colorLeaf.value, side: THREE.DoubleSide, shininess: 30 })
            : new THREE.MeshBasicMaterial({ color: uiParams.colorLeaf.value, side: THREE.DoubleSide });

        leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafMatrices.length);
        for (let i = 0; i < leafMatrices.length; i++) leafMesh.setMatrixAt(i, leafMatrices[i]);
        leafMesh.instanceMatrix.needsUpdate = true;
        leafMesh.castShadow = true;
        leafMesh.receiveShadow = true;
        scene.add(leafMesh);
    }

    // Process Auto-Scale and Camera Fit
    processAutoScale();

    // if (resetCamera) ... (handled in fitCamera called by processAutoScale)
    // Legacy camera logic removed/replaced by processAutoScale + fitCamera
    /*
    if (resetCamera) {
    ...
    */

    // Check ground visibility
    if (groundMesh) groundMesh.visible = uiParams.showGround.checked;


    statsEl.innerText = `Segments: ${branchMatrices.length} | Leaves: ${leafMatrices.length}`;
}

function updateColors() {
    // console.log("updateColors called");
    if (!treeMesh) return;
    const colorBase = new THREE.Color(uiParams.colorBase.value);
    const colorTip = new THREE.Color(uiParams.colorTip.value);

    // I'll update buildGeometry to store heights on the mesh object for easy access.
    if (treeMesh.userData.branchHeights) {
        // console.log("Updating InstancedMesh colors");
        const heights = treeMesh.userData.branchHeights;
        const maxY = treeMesh.userData.maxY;
        for (let i = 0; i < treeMesh.count; i++) {
            const t = Math.min(1, Math.max(0, heights[i] / maxY));
            treeMesh.setColorAt(i, colorBase.clone().lerp(colorTip, t));
        }
        treeMesh.instanceColor.needsUpdate = true;
    } else if (treeMesh && treeMesh.geometry.attributes.color) {
        // Continuous Mesh (Vertex Colors)
        const cBase = new THREE.Color(uiParams.colorBase.value);
        const cTip = new THREE.Color(uiParams.colorTip.value);
        // Need bounds. stored in userData?
        const bounds = treeMesh.userData.bounds;
        if (bounds) {
            const minY = bounds.minY;
            const maxY = bounds.maxY;
            const yRange = (maxY - minY) || 1;
            const positions = treeMesh.geometry.attributes.position.array;
            const colors = treeMesh.geometry.attributes.color.array;
            for (let i = 0; i < positions.length; i += 3) {
                const y = positions[i + 1];
                const t = Math.max(0, Math.min(1, (y - minY) / yRange));
                const c = cBase.clone().lerp(cTip, t);
                colors[i] = c.r;
                colors[i + 1] = c.g;
                colors[i + 2] = c.b;
            }
            treeMesh.geometry.attributes.color.needsUpdate = true;
        }
    } else {
        generateLSystem();
    }
}

function updateLeafSize() {
    if (!leafMesh || savedBaseLeafMatrices.length === 0) return;

    // Scale multiplier
    const leafSize = parseFloat(uiParams.leafSize.value);
    const tempMat = new THREE.Matrix4();
    const scaleVec = new THREE.Vector3(leafSize, leafSize, leafSize);

    for (let i = 0; i < savedBaseLeafMatrices.length; i++) {
        tempMat.copy(savedBaseLeafMatrices[i]);
        tempMat.scale(scaleVec);
        leafMesh.setMatrixAt(i, tempMat);
    }
    leafMesh.instanceMatrix.needsUpdate = true;
}

function processAutoScale() {
    if (!treeMesh) return;
    const autoScale = uiParams.autoScale.checked;

    // Store original unscaled bounds in userData or assume current scale is applied?
    // Easiest: Reset scale to 1,1,1 then measure, then apply new scale.
    treeMesh.scale.set(1, 1, 1);
    if (leafMesh) leafMesh.scale.set(1, 1, 1);

    if (autoScale && treeMesh.userData.bounds) {
        const b = treeMesh.userData.bounds;
        const sizeY = b.maxY - b.minY;
        if (sizeY > 0) {
            const targetHeight = 60;
            const s = targetHeight / sizeY;
            treeMesh.scale.set(s, s, s);
            if (leafMesh) leafMesh.scale.set(s, s, s);
        }
    }

    // Recalculate camera metrics (approximate or rigorous)
    // We can just call the camera fit logic again if we extract it.
    // For now, let's just leave camera alone or re-center?
    // generateLSystem usually refits camera. 
    // Let's just fit camera:
    fitCamera();
}

function fitCamera(reset = false) {
    if (!treeMesh || !treeMesh.userData.bounds) return;

    // Effective bounds (scaled)
    const s = treeMesh.scale.x; // Uniform scale
    const b = treeMesh.userData.bounds;

    const minX = b.minX * s, maxX = b.maxX * s;
    const minY = b.minY * s, maxY = b.maxY * s;
    const minZ = b.minZ * s, maxZ = b.maxZ * s;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ);

    const fov = camera.fov * (Math.PI / 180);
    let idealDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    if (reset) {
        controls.target.set(centerX, centerY, centerZ);
        camera.position.set(0, centerY, idealDistance);
    } else {
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        controls.target.set(centerX, centerY, centerZ);
        camera.position.copy(controls.target).add(direction.multiplyScalar(idealDistance));
    }

    camera.far = Math.max(2000, idealDistance * 5);
    camera.updateProjectionMatrix();

    // Update Fog/Lights
    if (getRenderMode() === '3d') {
        scene.fog.density = Math.min(0.002, 0.05 / idealDistance);

        const keyLight = scene.getObjectByName('keyLight');
        if (keyLight) {
            keyLight.position.set(centerX + maxDim, centerY + maxDim, centerZ + maxDim);
            keyLight.target.position.set(centerX, centerY, centerZ);
            keyLight.target.updateMatrixWorld();

            const d = maxDim * 1.5;
            keyLight.shadow.camera.left = -d;
            keyLight.shadow.camera.right = d;
            keyLight.shadow.camera.top = d;
            keyLight.shadow.camera.bottom = -d;
            keyLight.shadow.camera.far = maxDim * 4;
            keyLight.shadow.camera.updateProjectionMatrix();
        }
        const fillLight = scene.getObjectByName('fillLight');
        if (fillLight) {
            fillLight.position.set(centerX - maxDim, centerY + maxDim * 0.5, centerZ - maxDim);
            fillLight.target.position.set(centerX, centerY, centerZ);
            fillLight.target.updateMatrixWorld();
        }
    }
}


function updateLeafColor() {
    if (leafMesh) {
        leafMesh.material.color.set(uiParams.colorLeaf.value);
    }
}

function loadPreset() {
    const p = presets[this.value];
    uiParams.axiom.value = p.axiom;
    uiParams.rules.value = p.rules;
    uiParams.iterations.value = p.iter;
    uiParams.angle.value = p.angle;
    uiParams.angleRandom.value = p.angleRandom !== undefined ? p.angleRandom : 0; // Set randomness
    uiParams.length.value = p.len;
    uiParams.length.value = p.len;
    // Set slider position from real width
    const minW = 0.01, maxW = 50;
    const sliderPos = Math.log(p.width / minW) / Math.log(maxW / minW);
    uiParams.width.value = sliderPos;
    if (uiParams.taper) uiParams.taper.value = p.taper !== undefined ? p.taper : 0.7; // Reset taper
    if (uiParams.leafSize) uiParams.leafSize.value = p.leafSize !== undefined ? p.leafSize : 1.0; // Reset leaf size
    if (uiParams.leavesTipsOnly) uiParams.leavesTipsOnly.checked = p.leavesTipsOnly !== undefined ? p.leavesTipsOnly : true; // Default checked

    if (uiParams.showGround) uiParams.showGround.checked = true; // Default ground on
    if (uiParams.autoScale) uiParams.autoScale.checked = true; // Default auto-scale on
    if (groundMesh) groundMesh.visible = true;
    uiParams.colorBase.value = p.cBase;
    uiParams.colorTip.value = p.cTip;
    uiParams.colorLeaf.value = p.cLeaf;

    const valDisplays = {
        'iterations': 'iter-val',
        'angle': 'angle-val',
        'angle-random': 'angle-random-val',
        'step-length': 'length-val',
        'width': 'width-val',
        'width-taper': 'taper-val',
        'leaf-size': 'leaf-size-val'
    };

    Object.keys(valDisplays).forEach(id => {
        const el = document.getElementById(id);
        const display = document.getElementById(valDisplays[id]);
        if (el && display) {
            if (id === 'width') {
                display.textContent = p.width;
            } else {
                display.textContent = el.value;
            }
        }
    });

    generateLSystem(true);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
}

try {
    init();
} catch (e) {
    console.error(e);
    alert('Error initializing app: ' + e.message + '\n' + e.stack);
}
