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
let isGenerating = false;

// --- DOM Elements ---
const uiParams = {
    iterations: document.getElementById('iterations'),
    angle: document.getElementById('angle'),
    angleRandom: document.getElementById('angle-random'),
    length: document.getElementById('step-length'),
    taper: document.getElementById('width-taper'),
    smoothJoints: document.getElementById('smooth-joints'),
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
        cLeaf: "#facc15",
        taper: 0.95
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
        angleRandom: 14
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
        taper: 0.7
    },
    fern3d: {
        axiom: "X",
        rules: "X=F///+[[!X]///-!X]///-F[///-F!X]///+!X\nF=FF",
        angle: 22.5,
        iter: 7,
        len: 1.5,
        width: 4.123,
        cBase: "#7f5539",
        cTip: "#22c55e",
        cLeaf: "#86efac",
        taper: 0.76,
        angleRandom: 6
    },
    bush: {
        axiom: "A",
        rules: "A=[&FL!A]/////'[&FL!A]///////'[&FL!A]\nF=S/////F\nS=FL\nL=['''^^{-f+f+f-|-f+f+f}]",
        angle: 22.5,
        iter: 6,
        len: 2,
        width: 0.607,
        cBase: "#3f2e18",
        cTip: "#0cad00",
        cLeaf: "#f43f5e",
        taper: 0.61
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
        taper: 1.0
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
        autoScaleEl.addEventListener('change', generateLSystem);
    }
    document.getElementById('toggle-ui').addEventListener('click', () => {
        document.getElementById('ui-panel').classList.toggle('collapsed');
    });

    // Auto-generate on slider/input release (change event)
    Object.values(uiParams).forEach(input => {
        if (input) input.addEventListener('change', generateLSystem);
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
        'width-taper': 'taper-val'
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
            const smoothJoints = uiParams.smoothJoints ? uiParams.smoothJoints.checked : false;
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
            buildGeometry(lString, angle, angleVariance, stepLen, width, taper, smoothJoints, autoScale, resetCamera);

        } catch (e) {
            console.error(e);
            alert("Error generating L-System: " + e.message);
        } finally {
            isGenerating = false;
            loaderEl.style.display = 'none';
        }
    }, 50);
}

function buildGeometry(lString, angle, angleVariance, stepLen, width, taper, smoothJoints, autoScale, resetCamera) {
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
    if (jointMesh) {
        scene.remove(jointMesh);
        jointMesh.dispose();
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
    const jointMatrices = []; // For smoothing spheres

    // Leaf transforms
    const leafMatrices = [];

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

    for (let i = 0; i < lString.length; i++) {
        const char = lString[i];

        if (char === 'F' || char === 'G') {
            const startPos = pos.clone();
            const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
            const segmentLen = currentStep;
            const endPos = startPos.clone().add(dir.clone().multiplyScalar(segmentLen));

            // Branch Matrix Calculation
            const dummy = new THREE.Object3D();
            dummy.position.copy(startPos.clone().add(endPos).multiplyScalar(0.5));
            dummy.quaternion.copy(quat);
            dummy.scale.set(currentWidth, segmentLen, currentWidth);
            dummy.updateMatrix();
            branchMatrices.push(dummy.matrix.clone());
            branchHeights.push(startPos.y);

            // Lookahead if needed (Gradual Taper)
            if (segmentsRemaining <= 0) {
                let tempCount = 0;
                let tempIndex = i;
                let foundTaper = false;
                let bracketDepth = 0;

                while (tempIndex < lString.length) {
                    const c = lString[tempIndex];
                    if (c === '[') {
                        bracketDepth++;
                    } else if (c === ']') {
                        if (bracketDepth > 0) bracketDepth--;
                        else break; // End of scope
                    } else if (bracketDepth === 0) {
                        if (c === '!') {
                            foundTaper = true;
                            break;
                        }
                        if (c === 'F' || c === 'G') {
                            tempCount++;
                        }
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

            // Apply Gradual Taper
            branchTapers.push(activeDecay);
            currentWidth *= activeDecay;
            if (segmentsRemaining > 0) segmentsRemaining--;

            // Optional: Add sphere at the joint (startPos) to smooth connections
            if (smoothJoints) {
                const sDummy = new THREE.Object3D();
                sDummy.position.copy(startPos);
                const prevWidth = currentWidth / activeDecay;
                sDummy.scale.set(prevWidth, prevWidth, prevWidth);
                sDummy.updateMatrix();
                jointMatrices.push(sDummy.matrix.clone());
            }

            // Update turtle
            pos.copy(endPos);
            updateBounds(pos);

            if (branchMatrices.length > MAX_SEGMENTS) break;

        } else if (char === 'L' || char === 'P') {
            const dummy = new THREE.Object3D();
            dummy.position.copy(pos);
            dummy.quaternion.copy(quat);
            dummy.rotateX(Math.random());
            dummy.rotateY(Math.random());
            const s = stepLen * 0.5;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            leafMatrices.push(dummy.matrix.clone());

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
                target: targetBangIndex
            });
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
            }
        }
    }

    if (branchMatrices.length > 0) {
        // ... (existing code geometry/material setup)
        const renderMode = getRenderMode();
        let geometry, material;

        if (renderMode === '3d') {
            geometry = new THREE.CylinderGeometry(1, 1, 1, 5); // Base Cylinder
            geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.5, 0)); // Pivot at bottom
            // Check previous pivot logic! Pivot was center (0.5).
            // Line 411: dummy.position... multiplyScalar(0.5).
            // If I change pivot to bottom, I must adjust position logic OR shader logic.
            // Let's keep geometry centered (-0.5 to 0.5) to avoid breaking position logic.
            geometry = new THREE.CylinderGeometry(1, 1, 1, 5); // Centered

            material = new THREE.MeshPhongMaterial({ shininess: 10 });

            // Custom Shader to apply per-instance taper to TOP vertices
            material.onBeforeCompile = (shader) => {
                shader.vertexShader = `
                    attribute float instanceTaper;
                ` + shader.vertexShader;

                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    // Cylinder is Y-up, centered at 0. Top is y=0.5
                    if (position.y > 0.0) {
                        transformed.xz *= instanceTaper;
                    }
                    `
                );
            };

            scene.fog.density = 0.002;
        } else {
            // ...
            geometry = new THREE.BoxGeometry(1, 1, 0.01);
            material = new THREE.MeshBasicMaterial(); // No lighting
            scene.fog.density = 0.0001; // Less fog in 2D
        }

        if (renderMode === '3d') {
            geometry.setAttribute('instanceTaper', new THREE.InstancedBufferAttribute(new Float32Array(branchTapers), 1));
        }

        treeMesh = new THREE.InstancedMesh(geometry, material, branchMatrices.length);
        treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        treeMesh.userData.branchHeights = branchHeights;
        treeMesh.userData.maxY = maxY;
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
    }

    // 4. Create Joints (Spheres)
    if (jointMatrices.length > 0) {
        const renderMode = getRenderMode();
        const geometry = new THREE.SphereGeometry(1.0, 8, 8); // Radius 1.0 matches Cylinder Radius 1.0
        const material = renderMode === '3d'
            ? new THREE.MeshPhongMaterial({ shininess: 10 })
            : new THREE.MeshBasicMaterial();

        jointMesh = new THREE.InstancedMesh(geometry, material, jointMatrices.length);

        const colorBase = new THREE.Color(uiParams.colorBase.value);
        const colorTip = new THREE.Color(uiParams.colorTip.value);

        // Reuse branch heights strategy approx (map joint index to branch index approx or startPos.y)
        // Since joints correspond 1:1 to branches at startPos, we can reuse branchHeights
        for (let i = 0; i < jointMatrices.length; i++) {
            jointMesh.setMatrixAt(i, jointMatrices[i]);
            // Height color
            const h = branchHeights[i]; // joint i comes from branch i
            const t = Math.min(1, Math.max(0, h / maxY));
            jointMesh.setColorAt(i, colorBase.clone().lerp(colorTip, t));
        }
        jointMesh.instanceMatrix.needsUpdate = true;
        if (jointMesh.instanceColor) jointMesh.instanceColor.needsUpdate = true;
        jointMesh.castShadow = true;
        jointMesh.receiveShadow = true;

        scene.add(jointMesh);
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

    // Auto-Scale Logic
    let sizeX = maxX - minX;
    let sizeY = maxY - minY;
    let sizeZ = maxZ - minZ;
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;
    let centerZ = (minZ + maxZ) / 2;

    if (autoScale && sizeY > 0) {
        const targetHeight = 60;
        const scale = targetHeight / sizeY;

        if (treeMesh) treeMesh.scale.set(scale, scale, scale);
        if (leafMesh) leafMesh.scale.set(scale, scale, scale);
        if (jointMesh) jointMesh.scale.set(scale, scale, scale);

        // Adjust bounds logic for camera
        sizeX *= scale; sizeY *= scale; sizeZ *= scale;
        centerX *= scale; centerY *= scale; centerZ *= scale;
    }

    const maxDim = Math.max(sizeX, sizeY, sizeZ);

    // Ideal Camera Distance for Fog/Light scaling
    const fov = camera.fov * (Math.PI / 180);
    let idealDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    idealDistance *= 1.5; // Add some padding

    if (resetCamera) {
        controls.target.set(centerX, centerY, centerZ);
        // Default Front View
        camera.position.set(0, centerY, idealDistance);
    } else {
        // Smart Fit: Keep viewing angle, but adjust distance and target to fit new tree
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

        // Update target to new center of tree
        controls.target.set(centerX, centerY, centerZ);

        // Move camera along the same direction vector to the new ideal distance
        camera.position.copy(controls.target).add(direction.multiplyScalar(idealDistance));
    }

    camera.far = Math.max(2000, idealDistance * 5);
    camera.updateProjectionMatrix();

    // Dynamic Fog and Lighting
    const renderMode = getRenderMode();
    if (renderMode === '3d') {
        // Scale fog density so tree is always visible (0.05 / dist gives ~95% visibility at target)
        scene.fog.density = Math.min(0.002, 0.05 / idealDistance);

        // Move lights based on scene size
        const keyLight = scene.getObjectByName('keyLight');
        if (keyLight) {
            keyLight.position.set(centerX + maxDim, centerY + maxDim, centerZ + maxDim);
            keyLight.target.position.set(centerX, centerY, centerZ);
            keyLight.target.updateMatrixWorld();
            keyLight.intensity = 2.5;

            // Update shadow camera bounds to fit new tree size
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
            fillLight.intensity = 1.0;
        }
    } else {
        scene.fog.density = 0; // No fog in 2D
    }

    // Check ground visibility
    if (groundMesh) groundMesh.visible = uiParams.showGround.checked;


    statsEl.innerText = `Segments: ${branchMatrices.length} | Leaves: ${leafMatrices.length}`;
}

function updateColors() {
    if (!treeMesh || !treeMesh.instanceColor) return;
    const colorBase = new THREE.Color(uiParams.colorBase.value);
    const colorTip = new THREE.Color(uiParams.colorTip.value);

    // To get the height of each instance, we'd need to store it or extract it from matrices.
    // For performance and simplicity, we can just re-generate if colors change, 
    // or store branchHeights in a higher scope.
    // Let's rely on the fact that buildGeometry just ran.
    // However, the user wants instant color updates.
    // I'll make branchHeights a global/module variable to support this.

    // For now, let's just trigger a re-generate for color changes if we don't have heights cached.
    // But since the user wants it "instant", I should cache the heights.

    // I'll update buildGeometry to store heights on the mesh object for easy access.
    if (treeMesh.userData.branchHeights) {
        const heights = treeMesh.userData.branchHeights;
        const maxY = treeMesh.userData.maxY;
        for (let i = 0; i < treeMesh.count; i++) {
            const t = Math.min(1, Math.max(0, heights[i] / maxY));
            treeMesh.setColorAt(i, colorBase.clone().lerp(colorTip, t));
        }
        treeMesh.instanceColor.needsUpdate = true;
    } else {
        generateLSystem();
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
    if (uiParams.smoothJoints) uiParams.smoothJoints.checked = false; // Reset smoothing
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
        'width-taper': 'taper-val'
    };

    Object.keys(valDisplays).forEach(id => {
        const el = document.getElementById(id);
        const display = document.getElementById(valDisplays[id]);
        if (el && display) {
            display.textContent = el.value;
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
