// import { KeyDisplay } from "./utils";
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
  Object.assign(pointLight.position, { x: 10, y: 1, z: 10 });
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
    roughness: 1.0,
    metalness: 0.0,
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

  gltfLoader.load(
    "/mickeyShopee.glb",
    async function (gltf) {
      const mickeyMesh = gltf.scene;

      // Carrega texturas fixas do GLB
      const baseColorTexture = await gltf.parser.getDependency("texture", 0);
      const normalTexture = await gltf.parser.getDependency("texture", 1);
      const ormTexture = await gltf.parser.getDependency("texture", 2);
      const emissiveTexture = await gltf.parser.getDependency("texture", 3);

      mickeyMesh.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            // Textura 0: Base Color
            child.material.map = baseColorTexture;

            // Textura 1: Normal Map (desabilitado por causar artefatos)
            // child.material.normalMap = normalTexture;
            // child.material.normalScale = new THREE.Vector2(
            //   parametrosGui.normalIntensity,
            //   parametrosGui.normalIntensity
            // );

            // Textura 2: ORM (Occlusion/Roughness/Metalness)
            child.material.roughnessMap = ormTexture;
            child.material.metalnessMap = ormTexture;

            if (child.geometry.attributes.uv2) {
              child.material.aoMap = ormTexture;
              child.material.aoMapIntensity = 1.0;
            }

            // Textura 3: Emissive
            child.material.emissiveMap = emissiveTexture;

            // Configurar propriedades do material
            child.material.roughness = parametrosGui.roughness;
            child.material.metalness = parametrosGui.metalness;
            child.material.needsUpdate = true;
          }
        }
      });
      scene.add(mickeyMesh);
      objects["mickey"] = mickeyMesh;
      mickeyMesh.position.x = 0;
      mickeyMesh.position.y = 0;
      mickeyMesh.scale.x = mickeyMesh.scale.y = mickeyMesh.scale.z = 50;

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
 * Load city GLB model.
 */
var loadCity = function (scene) {
  let gltfLoader = new GLTFLoader();

  gltfLoader.load(
    "/neighbourhood-city-modular-lowpoly/source/city.glb",
    function (gltf) {
      const cityMesh = gltf.scene;

      cityMesh.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(cityMesh);
      objects["city"] = cityMesh;

      // Adjust position and scale as needed
      cityMesh.position.set(0, 0, 0);
      cityMesh.scale.set(1, 1, 1);
    },
    function (progress) {
      console.log(
        "Loading city: " + (progress.loaded / progress.total) * 100 + "%"
      );
    },
    function (error) {
      console.log("Error loading city: " + error);
    }
  );
};

var createBackground = function (scene) {
  let background = new THREE.Color(0xb3e0ff); // azul claro, cor de céu
  scene.background = background;
};

function init() {
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  Object.assign(camera.position, { x: 0, y: 10, z: 60 });

  //cria o mundo
  scene = new THREE.Scene();
  createGui();
  createBackground(scene);
  setAmbientLighting(scene);
  setDirectionalLighting(scene);

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
  loadCity(scene);

  // scene.add(new THREE.AmbientLight(0xffffff));

  loadObj();
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
// const keyDisplayQueue = new KeyDisplay();

let shiftPressed = false;
let lastShiftTime = 0;

document.addEventListener(
  "keydown",
  (event) => {
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  keyDisplayQueue.updatePosition();
}
window.addEventListener("resize", onWindowResize);

// Initialize the application
init();
