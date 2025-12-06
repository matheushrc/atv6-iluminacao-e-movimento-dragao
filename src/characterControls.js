import * as THREE from "three";
import { A, D, DIRECTIONS, S, W } from "./utils";

export class CharacterControls {
  model;
  mixer;
  animationsMap = new Map(); // Walk, Run, Idle
  orbitControl;
  camera;
  collisionBoxes = []; // Array of Box3 for collision detection

  // state
  toggleRun = true;
  currentAction;
  runMode = "toggle"; // "toggle" ou "hold"

  // temporary data
  walkDirection = new THREE.Vector3();
  rotateAngle = new THREE.Vector3(0, 1, 0);
  rotateQuarternion = new THREE.Quaternion();
  cameraTarget = new THREE.Vector3();

  // Character bounding box for collision
  characterBox = new THREE.Box3();
  characterSize = new THREE.Vector3(3, 10, 3); // Approximate character size

  // constants
  fadeDuration = 0.2;
  runVelocity = 50;
  walkVelocity = 15;

  constructor(
    model,
    mixer,
    animationsMap,
    orbitControl,
    camera,
    currentAction
  ) {
    this.model = model;
    this.mixer = mixer;
    this.animationsMap = animationsMap;
    this.currentAction = currentAction;
    this.animationsMap.forEach((value, key) => {
      if (key == currentAction) {
        value.play();
      }
    });
    this.orbitControl = orbitControl;
    this.camera = camera;
    this.updateCameraTarget(0, 0);
  }

  switchRunToggle() {
    this.toggleRun = !this.toggleRun;
  }

  setRunMode(mode) {
    this.runMode = mode;
    // No modo hold, sempre começa sem correr
    if (mode === "hold") {
      this.toggleRun = false;
    } else {
      this.toggleRun = true;
    }
  }

  setRunning(isRunning) {
    // Usado apenas no modo "hold"
    if (this.runMode === "hold") {
      this.toggleRun = isRunning;
    }
  }

  setCollisionBoxes(boxes) {
    this.collisionBoxes = boxes;
  }

  // Check if a position would collide with any obstacle
  checkCollision(newPosition) {
    // Create a bounding box for the character at the new position
    const halfSize = this.characterSize.clone().multiplyScalar(0.5);
    this.characterBox.min.set(
      newPosition.x - halfSize.x,
      newPosition.y,
      newPosition.z - halfSize.z
    );
    this.characterBox.max.set(
      newPosition.x + halfSize.x,
      newPosition.y + this.characterSize.y,
      newPosition.z + halfSize.z
    );

    // Check collision with all obstacle boxes
    for (const box of this.collisionBoxes) {
      if (this.characterBox.intersectsBox(box)) {
        return true; // Collision detected
      }
    }
    return false; // No collision
  }

  update(delta, keysPressed) {
    const directionPressed = DIRECTIONS.some((key) => keysPressed[key] == true);

    var play = "";
    if (directionPressed && this.toggleRun) {
      play = "Run";
    } else if (directionPressed) {
      play = "Walk";
    } else {
      play = "Idle";
    }

    if (this.currentAction != play) {
      const toPlay = this.animationsMap.get(play);
      const current = this.animationsMap.get(this.currentAction);

      current.fadeOut(this.fadeDuration);
      toPlay.reset().fadeIn(this.fadeDuration).play();

      this.currentAction = play;
    }

    this.mixer.update(delta);

    if (this.currentAction == "Run" || this.currentAction == "Walk") {
      // calculate towards camera direction
      var angleYCameraDirection = Math.atan2(
        this.camera.position.x - this.model.position.x,
        this.camera.position.z - this.model.position.z
      );
      // diagonal movement angle offset
      var directionOffset = this.directionOffset(keysPressed);

      // rotate model
      this.rotateQuarternion.setFromAxisAngle(
        this.rotateAngle,
        angleYCameraDirection + directionOffset + Math.PI
      );
      this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2);

      // calculate direction
      this.camera.getWorldDirection(this.walkDirection);
      this.walkDirection.y = 0;
      this.walkDirection.normalize();
      this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

      // run/walk velocity
      const velocity =
        this.currentAction == "Run" ? this.runVelocity : this.walkVelocity;

      // Calculate intended movement
      const moveX = this.walkDirection.x * velocity * delta;
      const moveZ = this.walkDirection.z * velocity * delta;

      // Calculate new position
      const newPosition = new THREE.Vector3(
        this.model.position.x + moveX,
        this.model.position.y,
        this.model.position.z + moveZ
      );

      // Check collision before moving
      if (!this.checkCollision(newPosition)) {
        // No collision, move freely
        this.model.position.x = newPosition.x;
        this.model.position.z = newPosition.z;
        this.updateCameraTarget(moveX, moveZ);
      } else {
        // Try sliding along walls - check X and Z separately
        const newPositionX = new THREE.Vector3(
          this.model.position.x + moveX,
          this.model.position.y,
          this.model.position.z
        );
        const newPositionZ = new THREE.Vector3(
          this.model.position.x,
          this.model.position.y,
          this.model.position.z + moveZ
        );

        // Try moving only in X
        if (!this.checkCollision(newPositionX)) {
          this.model.position.x = newPositionX.x;
          this.updateCameraTarget(moveX, 0);
        }
        // Try moving only in Z
        else if (!this.checkCollision(newPositionZ)) {
          this.model.position.z = newPositionZ.z;
          this.updateCameraTarget(0, moveZ);
        }
        // Both blocked - can't move
      }
    }
  }

  updateCameraTarget(moveX, moveZ) {
    // move camera
    this.camera.position.x += moveX;
    this.camera.position.z += moveZ;

    // update camera target
    this.cameraTarget.x = this.model.position.x;
    this.cameraTarget.y = this.model.position.y + 1;
    this.cameraTarget.z = this.model.position.z;
    this.orbitControl.target = this.cameraTarget;
  }

  directionOffset(keysPressed) {
    var directionOffset = 0; // w

    if (keysPressed[W]) {
      if (keysPressed[A]) {
        directionOffset = Math.PI / 4; // w+a
      } else if (keysPressed[D]) {
        directionOffset = -Math.PI / 4; // w+d
      }
    } else if (keysPressed[S]) {
      if (keysPressed[A]) {
        directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
      } else if (keysPressed[D]) {
        directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
      } else {
        directionOffset = Math.PI; // s
      }
    } else if (keysPressed[A]) {
      directionOffset = Math.PI / 2; // a
    } else if (keysPressed[D]) {
      directionOffset = -Math.PI / 2; // d
    }

    return directionOffset;
  }
}
