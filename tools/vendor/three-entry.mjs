// Three.js + OrbitControls in un solo script classico (window.THREE), per js/sala.js.
// Si rigenera con: npx esbuild tools/vendor/three-entry.mjs --bundle --minify --format=iife --outfile=js/vendor/three.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
window.THREE = Object.assign({}, THREE, { OrbitControls });
