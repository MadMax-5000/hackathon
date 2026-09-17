import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { DerivedCase } from "../engine/types";
import { isReviewReplacement } from "../engine/workflow";
import modelUrl from "../assets/FREE_CAR_01.fbx?url";

type Corner = "fl" | "fr" | "bl" | "br";
type TireState = Record<Corner, boolean>;

const CORNERS: Corner[] = ["fl", "fr", "bl", "br"];

const CORNER_LABEL: Record<Corner, string> = {
  fl: "front left",
  fr: "front right",
  bl: "rear left",
  br: "rear right",
};

const EDGE_COLOR = 0x63b6ff;
const FACE_COLOR = 0x0c2f55;
const ALERT_EDGE_COLOR = 0xff5d5d;
const ALERT_FACE_COLOR = 0x5c0c0c;

type WheelParts = { meshes: THREE.Mesh[]; edges: THREE.LineSegments[] };

type BlueprintController = {
  apply: (state: TireState) => void;
  dispose: () => void;
};

// The axle-level inspection data drives the corner wheels: a "front" finding
// marks both front wheels, a "rear" finding marks both rear wheels.
export function deriveTireState(item: DerivedCase): TireState {
  const front = isReviewReplacement(item.wheel.front);
  const rear = isReviewReplacement(item.wheel.rear);
  return { fl: front, fr: front, bl: rear, br: rear };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function cornerFromObject(object: THREE.Object3D): Corner | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const name = normalizeName(current.name);
    if (name.startsWith("wheelfl")) return "fl";
    if (name.startsWith("wheelfr")) return "fr";
    if (name.startsWith("wheelbl")) return "bl";
    if (name.startsWith("wheelbr")) return "br";
    current = current.parent;
  }
  return null;
}

let carModelPromise: Promise<THREE.Group> | null = null;

function loadCarModel(): Promise<THREE.Group> {
  if (!carModelPromise) {
    carModelPromise = new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.setResourcePath(import.meta.env.BASE_URL);
      loader.load(
        modelUrl,
        (group) => resolve(group),
        undefined,
        (error) => {
          carModelPromise = null;
          reject(error);
        },
      );
    });
  }
  return carModelPromise;
}

function makeWheelParts(): WheelParts {
  return { meshes: [], edges: [] };
}

function buildScene(container: HTMLElement, source: THREE.Group): BlueprintController {
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 400;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);
  camera.position.set(3.15, 2.25, 4.05);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.setClearAlpha(0);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.6;
  controls.maxDistance = 8;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 + 0.28;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.65;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xa8ccff, 1.35));
  const key = new THREE.DirectionalLight(0xcfe6ff, 1.7);
  key.position.set(3, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x1f5a8c, 1.1);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const bodyFace = new THREE.MeshStandardMaterial({
    color: FACE_COLOR,
    emissive: 0x0a3f70,
    emissiveIntensity: 0.5,
    metalness: 0.25,
    roughness: 0.45,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const bodyEdge = new THREE.LineBasicMaterial({
    color: EDGE_COLOR,
    transparent: true,
    opacity: 0.85,
  });
  const alertFace = new THREE.MeshStandardMaterial({
    color: ALERT_FACE_COLOR,
    emissive: ALERT_EDGE_COLOR,
    emissiveIntensity: 1.2,
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const alertEdge = new THREE.LineBasicMaterial({
    color: ALERT_EDGE_COLOR,
    transparent: true,
    opacity: 1,
  });

  const car = source.clone(true);
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 3.1 / maxDim;

  car.position.sub(center);
  const holder = new THREE.Group();
  holder.add(car);
  holder.scale.setScalar(scale);
  scene.add(holder);

  const grid = new THREE.GridHelper(6, 24, 0x3f86c4, 0x163a5c);
  grid.position.y = -size.y * 0.5 * scale - 0.02;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.42;
  gridMaterial.depthWrite = false;
  scene.add(grid);

  const wheels: Record<Corner, WheelParts> = {
    fl: makeWheelParts(),
    fr: makeWheelParts(),
    bl: makeWheelParts(),
    br: makeWheelParts(),
  };

  const disposableMaterials = [bodyFace, bodyEdge, alertFace, alertEdge, gridMaterial];
  const disposableGeometries: THREE.BufferGeometry[] = [grid.geometry];
  let matchedWheels = 0;

  car.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    mesh.material = bodyFace;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 26), bodyEdge);
    edges.raycast = () => {};
    mesh.add(edges);
    disposableGeometries.push(edges.geometry);

    const corner = cornerFromObject(mesh);
    if (corner) {
      matchedWheels += 1;
      wheels[corner].meshes.push(mesh);
      wheels[corner].edges.push(edges);
    }
  });

  if (matchedWheels < 4) {
    console.warn(`Vehicle blueprint: matched ${matchedWheels}/4 wheel objects in the model.`);
  }

  function apply(state: TireState) {
    for (const corner of CORNERS) {
      const flagged = state[corner];
      const parts = wheels[corner];
      for (const mesh of parts.meshes) mesh.material = flagged ? alertFace : bodyFace;
      for (const edge of parts.edges) edge.material = flagged ? alertEdge : bodyEdge;
    }
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
    alertFace.emissiveIntensity = 0.9 + 1.2 * pulse;
    alertEdge.opacity = 0.7 + 0.3 * pulse;
    controls.update();
    renderer.render(scene, camera);
  });

  const resize = () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  return {
    apply,
    dispose: () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      for (const geometry of disposableGeometries) geometry.dispose();
      for (const material of disposableMaterials) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

type Props = {
  item: DerivedCase;
};

export default function VehicleBlueprint({ item }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<BlueprintController | null>(null);
  const tireStateRef = useRef<TireState>({ fl: false, fr: false, bl: false, br: false });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const tireState = useMemo(() => deriveTireState(item), [item]);

  useEffect(() => {
    tireStateRef.current = tireState;
    controllerRef.current?.apply(tireState);
  }, [tireState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    loadCarModel()
      .then((source) => {
        if (disposed) return;
        try {
          const controller = buildScene(container, source);
          controllerRef.current = controller;
          controller.apply(tireStateRef.current);
          setStatus("ready");
        } catch (error) {
          console.error("Vehicle blueprint failed to initialise", error);
          setStatus("error");
        }
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.error("Vehicle blueprint failed to load the model", error);
        setStatus("error");
      });

    return () => {
      disposed = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const flagged = CORNERS.filter((corner) => tireState[corner]).map((corner) => CORNER_LABEL[corner]);
  const ariaLabel =
    flagged.length > 0
      ? `Vehicle blueprint. Tires requiring replacement: ${flagged.join(", ")}. All other tires inspected with no replacement required.`
      : "Vehicle blueprint. All inspected tires have no replacement requirement.";

  return (
    <div className="vehicle-blueprint" role="img" aria-label={ariaLabel}>
      <div className="vehicle-canvas" ref={containerRef} />
      {status === "loading" ? <p className="vehicle-overlay">Loading vehicle model…</p> : null}
      {status === "error" ? <p className="vehicle-overlay is-error">3D preview unavailable</p> : null}
      <div className="vehicle-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-swatch is-blue" />
          Inspected · no replacement
        </span>
        <span className="legend-item">
          <span className="legend-swatch is-red" />
          Replacement required
        </span>
      </div>
      <p className="vehicle-hint" aria-hidden="true">
        Drag to rotate · scroll to zoom
      </p>
    </div>
  );
}
