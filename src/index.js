import { KeyDisplay } from "./utils";
import { CharacterControls } from "./characterControls";
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
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
  Object.assign(sunlight.position, { x: 50, y: 900, z: 50 });

  sunlight.castShadow = true;

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(sunlight.shadow.camera, {
    left: -100,
    right: 100,
    top: 100,
    bottom: -100,
    // near: 0.5, // caso um passaro passa bem perto da camera e o near é muito pequeno a sombra tampa tudo
    far: 950,
  });

  // Reduzir qualidade da sombra para melhor performance
  Object.assign(sunlight.shadow.mapSize, {
    width: 512,
    height: 512,
  });

  scene.add(sunlight);
};

var setAmbientLighting = function (scene) {
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
};

var setSpotLighting = function (scene) {
  let spotLight = new THREE.SpotLight(0xffffff, 500);
  spotLight.position.set(30, 60, 30);
  spotLight.angle = Math.PI / 6; // narrow cone (30deg)
  spotLight.penumbra = 0.2;
  spotLight.decay = 1;
  spotLight.distance = 0; // 0 = no limit
  spotLight.castShadow = true;

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(spotLight.shadow.camera, {
    near: 0.5,
    far: 2000,
    fov: 30,
  });

  // Melhorar a qualidade da sombra
  Object.assign(spotLight.shadow.mapSize, {
    width: 2048,
    height: 2048,
  });

  scene.add(spotLight);
};

var setPointLighting = function (scene) {
  let pointLight = new THREE.PointLight(0xffffff, 5000);
  pointLight.position.set(-20, -5.8, 30);
  pointLight.distance = 50;
  pointLight.decay = 2;
  pointLight.castShadow = true;

  // Configurar a câmera de sombra usando Object.assign
  Object.assign(pointLight.shadow.camera, {
    near: 0.5,
    far: 2000,
    fov: 30,
  });

  // Melhorar a qualidade da sombra
  Object.assign(pointLight.shadow.mapSize, {
    width: 2048,
    height: 2048,
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
    dragaoScale: 0.01,
    dragaoRotationY: 0,
    animation: "idle",
    normalIntensity: 1.0,
    bumpIntensity: 0.5,
    roughness: 0.8,
    metalness: 0.2,
  };

  let lighting = gui.addFolder("Lighting");
  let dragao = gui.addFolder("Dragao");
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

  dragao
    .add(parametrosGui, "dragaoScale")
    .min(0.01)
    .max(0.1)
    .step(0.005)
    .name("Scale")
    .onChange(function (value) {
      objects["dragao"].scale.x =
        objects["dragao"].scale.y =
        objects["dragao"].scale.z =
          value;
    });

  dragao
    .add(parametrosGui, "dragaoRotationY")
    .min(-2)
    .max(2)
    .step(0.1)
    .name("Rotation")
    .onChange(function (value) {
      objects["dragao"].rotation.y = value;
    });

  let dragonAnimations = ["idle", "flying", "walking", "running"];
  dragao
    .add(parametrosGui, "animation")
    .name("Animation")
    .options(dragonAnimations)
    .onChange(function (value) {
      console.log("Mudou para a animação: " + value);
      switch (value) {
        case "idle":
          setAction(animationActions[2]); // index 2 from FBX
          break;
        case "flying":
          setAction(animationActions[1]); // index 1 from FBX
          break;
        case "walking":
          setAction(animationActions[0]); // index 0 from FBX
          break;
        case "running":
          setAction(animationActions[3]); // index 3 from FBX
          break;
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
      if (objects["dragao"]) {
        objects["dragao"].traverse(function (child) {
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
      if (objects["dragao"]) {
        objects["dragao"].traverse(function (child) {
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
      if (objects["dragao"]) {
        objects["dragao"].traverse(function (child) {
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
      if (objects["dragao"]) {
        objects["dragao"].traverse(function (child) {
          if (child instanceof THREE.Mesh) {
            child.material.metalness = value;
            child.material.needsUpdate = true;
          }
        });
      }
    });
};

var loadObj = function () {
  let fbxLoader = new FBXLoader();
  let textureLoader = new THREE.TextureLoader();

  fbxLoader.load(
    "/dragon/dragon.fbx",
    function (dragonMesh) {
      dragonMesh.traverse(function (child) {
        if (child instanceof THREE.Mesh) {
          console.log(child);

          // Carrega todas as texturas do dragão
          // 1. Color/Diffuse Map - define a cor base do material
          let colorTexture = textureLoader.load(
            "/dragon/Dragon_Bump_Col2.jpg"
          );

          // 2. Normal Map - adiciona detalhes de superfície sem adicionar geometria
          // Simula relevos e reentrâncias na superfície
          let normalTexture = textureLoader.load("/dragon/Dragon_Nor.jpg");

          // Cria material com layering de texturas
          // MeshStandardMaterial suporta PBR (Physically Based Rendering)
          child.material = new THREE.MeshStandardMaterial({
            // Texture Layers:
            map: colorTexture, // Cor base (difusa)
            normalMap: normalTexture, // Detalhes de superfície

            // Propriedades do Normal Map
            normalScale: new THREE.Vector2(1, 1), // Intensidade do normal map (x, y)

            // Propriedades do Bump Map
            bumpScale: 0.5, // Intensidade do bump (altura)

            // Propriedades PBR para realismo
            roughness: 0.8, // Aspereza da superfície (0=liso, 1=áspero)
            metalness: 0.2, // Propriedades metálicas (0=não-metal, 1=metal)
          });

          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(dragonMesh);
      objects["dragao"] = dragonMesh;
      dragonMesh.position.x = -10;
      dragonMesh.scale.x = dragonMesh.scale.y = dragonMesh.scale.z = 0.01;
      dragonMesh.position.y = -5.8;

      // Animation
      let animation;

      mixer = new THREE.AnimationMixer(dragonMesh);

      // Log all available animations
      console.log("Available animations:", dragonMesh.animations.length);
      dragonMesh.animations.forEach((anim, index) => {
        console.log(`Animation ${index}:`, anim.name);
      });

      // walking (index 0)
      animation = mixer.clipAction(dragonMesh.animations[0]);
      animationActions.push(animation);

      // flying (index 1) - adding the flying animation
      animation = mixer.clipAction(dragonMesh.animations[1]);
      animationActions.push(animation);

      // idle (index 2)
      animation = mixer.clipAction(dragonMesh.animations[2]);
      animationActions.push(animation);

      // running (index 3)
      animation = mixer.clipAction(dragonMesh.animations[3]);
      animationActions.push(animation);

      activeAnimation = animationActions[2]; // Start with idle
      setAction(activeAnimation);
      loadFinished = true;
      activeAnimation.play();

      // Create a Map for animations
      const animationsMap = new Map();
      animationsMap.set("Walk", animationActions[0]);
      animationsMap.set("Idle", animationActions[2]);
      animationsMap.set("Run", animationActions[3]);

      characterControls = new CharacterControls(
        dragonMesh,
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
  textureGround.anisotropy = 16;

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

  // CAMERA - Otimizado para performance
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limitar pixel ratio
  renderer.render(scene, camera);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(nossaAnimacao);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap; // Usar shadow map mais rápido

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
  orbitControls.minDistance = 50;
  orbitControls.maxDistance = 15;
  orbitControls.enablePan = false;
  orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
  orbitControls.update();

  document.body.appendChild(renderer.domElement);
}

// CONTROL KEYS
const keysPressed = {};
const keyDisplayQueue = new KeyDisplay();
document.addEventListener(
  "keydown",
  (event) => {
    keyDisplayQueue.down(event.key);
    if (event.shiftKey && characterControls) {
      characterControls.switchRunToggle();
    } else {
      keysPressed[event.key.toLowerCase()] = true;
    }
  },
  false
);

document.addEventListener("keyup", (event) => {
  keyDisplayQueue.up(event.key);
  keysPressed[event.key.toLowerCase()] = false;
});

var nossaAnimacao = function () {
  let delta = clock.getDelta();

  if (loadFinished) {
    mixer.update(delta);
    console.log("Animação rodando");
    if (characterControls) {
      characterControls.update(delta, keysPressed);
    }
  }
  orbitControls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(nossaAnimacao);
};

// Initialize the application
init();
