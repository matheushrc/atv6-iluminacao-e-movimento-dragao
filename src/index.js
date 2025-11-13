import { KeyDisplay } from "./utils";
import { CharacterControls } from "./characterControls";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let camera, scene, renderer, orbitControls, characterControls;

let objects = {};

let parametrosGui;

var mixer;
var animationActions = [];
var activeAnimation;
var lastAnimation;
var loadFinished = false;
var clock = new THREE.Clock();

var setDirectionalLighting = function (scene) {
  let sunlight = new THREE.DirectionalLight(0xffffff, 1);
  sunlight.castShadow = true;
  // Configurar as coordenadas da luz solar
  Object.assign(sunlight.position, { x: 50, y: 50, z: 50 });

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(sunlight.shadow.camera, {
    left: -50,
    right: 50,
    top: 50,
    bottom: -50,
    near: 0.5,
    far: 200,
  });

  // Máxima qualidade da sombra
  Object.assign(sunlight.shadow.mapSize, {
    width: 4096,
    height: 4096,
  });

  // Fix shadow acne with proper bias
  // Consertar acne de sombra com viés adequado, criava artefatos visuais de sombras quadriculadas
  sunlight.shadow.bias = -0.001;
  sunlight.shadow.normalBias = 0.05;

  scene.add(sunlight);
};

var setAmbientLighting = function (scene) {
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
};

var setSpotLighting = function (scene) {
  let spotLight = new THREE.SpotLight(0xffffff, 500);
  // Configurar as coordenadas do spotLight usando Object.assign
  Object.assign(spotLight.position, { x: 30, y: 60, z: 30 });
  spotLight.angle = Math.PI / 6; // narrow cone (30deg)
  spotLight.penumbra = 0.2;
  spotLight.decay = 1;
  spotLight.distance = 0; // 0 = no limit
  spotLight.castShadow = true;

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(spotLight.shadow.camera, {
    near: 1,
    far: 200,
    fov: 30,
  });

  // Fix shadow acne with proper bias
  spotLight.shadow.bias = -0.0001;
  spotLight.shadow.normalBias = 0.02;

  // Máxima qualidade da sombra
  Object.assign(spotLight.shadow.mapSize, {
    width: 4096,
    height: 4096,
  });

  scene.add(spotLight);
};

var setPointLighting = function (scene) {
  let pointLight = new THREE.PointLight(0xffffff, 5000);
  // Configurar as coordenadas do pointLight usando Object.assign
  Object.assign(pointLight.position, { x: -20, y: -5.8, z: 30 });
  pointLight.distance = 50;
  pointLight.decay = 2;
  pointLight.castShadow = true;

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(pointLight.shadow.camera, {
    near: 0.5,
    far: 2000,
    fov: 30,
  });

  // Máxima qualidade da sombra
  Object.assign(pointLight.shadow.mapSize, {
    width: 4096,
    height: 4096,
  });

  scene.add(pointLight);
};

var setLighting = function (lightingType) {
  // Remove all directional, spot, and point lights (but keep ambient)
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const child = scene.children[i];
    if (
      child instanceof THREE.DirectionalLight ||
      child instanceof THREE.SpotLight ||
      child instanceof THREE.PointLight
    ) {
      scene.remove(child);
    }
  }
  switch (lightingType) {
    case "directional":
      setDirectionalLighting(scene);
      break;
    case "spotlight":
      setSpotLighting(scene);
      break;
    case "point":
      setPointLighting(scene);
      break;
    default:
      console.warn("Unknown lighting type:", lightingType);
      break;
  }
};

var setAction = function (animacao) {
  if (!animacao) {
    console.error("Animation is undefined!");
    return;
  }

  if (animacao != activeAnimation) {
    lastAnimation = activeAnimation;
    activeAnimation = animacao;

    if (lastAnimation) {
      lastAnimation.stop();
    }

    activeAnimation.reset();
    activeAnimation.play();
  }
};

var createGui = function () {
  const gui = new GUI();

  parametrosGui = {
    environmentLighting: "directional",
    mickeyScale: 50,
    mickeyRotationY: 0,
    animation: "idle",
    normalIntensity: 1.0,
    bumpIntensity: 0.5,
    roughness: 0.8,
    metalness: 0.2,
    runMode: "toggle",
  };

  let lighting = gui.addFolder("Lighting");
  let mickey = gui.addFolder("Mickey");
  let texturas = gui.addFolder("Texturas");

  let lightingOptions = ["directional", "spotlight", "point"];
  lighting
    .add(parametrosGui, "environmentLighting")
    .name("Iluminação")
    .options(lightingOptions)
    .onChange(function (value) {
      console.log(`Mudou a iluminação para: ${value}`);
      setLighting(value);
    });

  mickey
    .add(parametrosGui, "mickeyScale")
    .min(50)
    .max(500)
    .step(0.01)
    .name("Scale")
    .onChange(function (value) {
      objects["mickey"].scale.x =
        objects["mickey"].scale.y =
        objects["mickey"].scale.z =
          value;
    });

  mickey
    .add(parametrosGui, "mickeyRotationY")
    .min(-2)
    .max(2)
    .step(0.1)
    .name("Rotation")
    .onChange(function (value) {
      objects["mickey"].rotation.y = value;
    });

  let mickeyAnimations = ["idle", "walk", "run", "skipping", "jump"];
  mickey
    .add(parametrosGui, "animation")
    .name("Animation")
    .options(mickeyAnimations)
    .onChange(function (value) {
      console.log("Mudou para a animação: " + value);
      const animIndex = {
        idle: 0,
        walk: 1,
        run: 2,
        skipping: 3,
        jump: 4,
      };
      if (animationActions[animIndex[value]]) {
        setAction(animationActions[animIndex[value]]);
      }
    });

  let runModes = ["toggle", "hold"];
  mickey
    .add(parametrosGui, "runMode")
    .name("Run Mode (Shift)")
    .options(runModes)
    .onChange(function (value) {
      console.log(`Modo de corrida alterado para: ${value}`);
      if (characterControls) {
        characterControls.setRunMode(value);
      }
    });

  // Controles de textura - ajusta a intensidade das camadas de textura
  texturas
    .add(parametrosGui, "normalIntensity")
    .min(0)
    .max(2)
    .step(0.1)
    .name("Normal Map Intensity")
    .onChange(function (value) {
      if (objects["mickey"]) {
        objects["mickey"].traverse(function (child) {
          if (child instanceof THREE.Mesh && child.material.normalMap) {
            child.material.normalScale.set(value, value);
            child.material.needsUpdate = true;
          }
        });
      }
    });

  texturas
    .add(parametrosGui, "bumpIntensity")
    .min(0)
    .max(2)
    .step(0.1)
    .name("Bump Map Intensity")
    .onChange(function (value) {
      if (objects["mickey"]) {
        objects["mickey"].traverse(function (child) {
          if (child instanceof THREE.Mesh && child.material.bumpMap) {
            child.material.bumpScale = value;
            child.material.needsUpdate = true;
          }
        });
      }
    });

  texturas
    .add(parametrosGui, "roughness")
    .min(0)
    .max(1)
    .step(0.05)
    .name("Roughness")
    .onChange(function (value) {
      if (objects["mickey"]) {
        objects["mickey"].traverse(function (child) {
          if (child instanceof THREE.Mesh) {
            child.material.roughness = value;
            child.material.needsUpdate = true;
          }
        });
      }
    });

  texturas
    .add(parametrosGui, "metalness")
    .min(0)
    .max(1)
    .step(0.05)
    .name("Metalness")
    .onChange(function (value) {
      if (objects["mickey"]) {
        objects["mickey"].traverse(function (child) {
          if (child instanceof THREE.Mesh) {
            child.material.metalness = value;
            child.material.needsUpdate = true;
          }
        });
      }
    });
};

var loadObj = function () {
  let gltfLoader = new GLTFLoader();
  let textureLoader = new THREE.TextureLoader();

  gltfLoader.load(
    "/mickeyShopee.glb",
    function (gltf) {
      const mickeyMesh = gltf.scene;
      mickeyMesh.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          console.log(child);
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(mickeyMesh);
      objects["mickey"] = mickeyMesh;
      mickeyMesh.position.x = -10;
      mickeyMesh.scale.x = mickeyMesh.scale.y = mickeyMesh.scale.z = 50;
      mickeyMesh.position.y = -5.8;

      // Animation
      let animation;

      mixer = new THREE.AnimationMixer(mickeyMesh);

      // Log all available animations
      console.log("Available animations:", gltf.animations.length);
      gltf.animations.forEach((anim, index) => {
        console.log(`Animation ${index}:`, anim.name);
      });

      // Load all animations from GLB
      gltf.animations.forEach((anim, index) => {
        animation = mixer.clipAction(anim);
        animationActions.push(animation);
      });

      // Start with first animation (usually idle)
      if (animationActions.length > 0) {
        activeAnimation = animationActions[0];
        setAction(activeAnimation);
        loadFinished = true;
        activeAnimation.play();
      }

      // Create a Map for animations using correct GLB animation names
      const animationsMap = new Map();
      animationsMap.set("Idle", mixer.clipAction(gltf.animations[0])); // idle
      animationsMap.set("Walk", mixer.clipAction(gltf.animations[1])); // walk
      animationsMap.set("Run", mixer.clipAction(gltf.animations[2])); // run

      characterControls = new CharacterControls(
        mickeyMesh,
        mixer,
        animationsMap,
        orbitControls,
        camera,
        "Idle"
      );
    },

    function (progress) {
      console.log("ta vivo! " + (progress.loaded / progress.total) * 100 + "%");
    },
    function (error) {
      console.log("Deu merda " + error);
    }
  );
};

/**
 * Receives scene
 * @param {THREE.Scene} scene
 *
 * Create ground mesh.
 * @returns {THREE.Mesh}
 */
var createGround = function (scene) {
  let textureLoader = new THREE.TextureLoader();
  let textureGround = textureLoader.load("/grasslight-big.jpg");
  textureGround.wrapS = THREE.RepeatWrapping;
  textureGround.wrapT = THREE.RepeatWrapping;
  textureGround.repeat.set(25, 25);
  textureGround.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Máximo anisotropic filtering

  let materialGround = new THREE.MeshStandardMaterial({ map: textureGround });

  let ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    materialGround
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6;
  ground.receiveShadow = true;

  scene.add(ground);
};

function init() {
  camera = new THREE.PerspectiveCamera(
    100,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  // camera.position.z = -20;

  //cria o mundo
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb3e0ff); // azul claro, cor de céu

  // CAMERA - Máxima qualidade de antialiasing
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio); // Usar pixel ratio máximo para melhor qualidade
  renderer.render(scene, camera);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(nossaAnimacao);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Melhor qualidade de sombras com antialiasing

  // scene.add(new THREE.AmbientLight(0xffffff));
  createGround(scene);
  setAmbientLighting(scene);
  setDirectionalLighting(scene);

  createGui();
  loadObj();
  camera.position.z = 60;
  camera.position.y = 10;
  //necessário se queremos fazer algo com animação

  // CONTROLS
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.minDistance = 5;
  orbitControls.maxDistance = 150;
  orbitControls.enablePan = false;
  orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
  orbitControls.update();

  document.body.appendChild(renderer.domElement);
}

// CONTROL KEYS
const keysPressed = {};
const keyDisplayQueue = new KeyDisplay();

let shiftPressed = false;
let lastShiftTime = 0;

document.addEventListener(
  "keydown",
  (event) => {
    keyDisplayQueue.down(event.key);

    if (event.key.toLowerCase() === "shift") {
      if (!shiftPressed && characterControls) {
        shiftPressed = true;
        const currentTime = Date.now();

        // Toggle mode: precisa dar tap no Shift
        if (
          parametrosGui.runMode === "toggle" &&
          currentTime - lastShiftTime < 500
        ) {
          characterControls.switchRunToggle();
        } else if (parametrosGui.runMode === "toggle") {
          characterControls.switchRunToggle();
        } else if (parametrosGui.runMode === "hold") {
          // Hold mode: ativa corrida enquanto segura
          characterControls.setRunning(true);
        }

        lastShiftTime = currentTime;
      }
    } else {
      keysPressed[event.key.toLowerCase()] = true;
    }
  },
  false
);

document.addEventListener("keyup", (event) => {
  keyDisplayQueue.up(event.key);

  if (event.key.toLowerCase() === "shift") {
    shiftPressed = false;

    // Hold mode: desativa corrida ao soltar
    if (parametrosGui.runMode === "hold" && characterControls) {
      characterControls.setRunning(false);
    }
  } else {
    keysPressed[event.key.toLowerCase()] = false;
  }
});

var nossaAnimacao = function () {
  let delta = clock.getDelta();

  if (loadFinished) {
    mixer.update(delta);
    if (characterControls) {
      characterControls.update(delta, keysPressed);
    }
  }
  orbitControls.update();
  renderer.render(scene, camera);
};

// Initialize the application
init();
