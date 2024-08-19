import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { debugGui } from "./debugGui";
import { elementToWorldRect, elementToWorldRectPoints, pageToWorldCoords } from "./utils";

const TINT_COLOUR_START = new THREE.Color("#5b1473");
const TINT_COLOUR_END = new THREE.Color("#ffffff");
const PANEL_START_ID = "video-panel-start";
const PANEL_END_ID = "video-panel-end";
const AUTOSCROLL_ENABLED = false;

export default class VideoPanelBones extends THREE.Group {
    animPlaybackPercent = 0;

    // The scroll positions used to calculate t, a percentage used to play the panel animation
    scrollYAnimStart = window.innerHeight * 0.9;
    scrollYAnimEnd = window.innerHeight * 1.3;

    worldRectStart;
    worldRectEnd;

    prevScrollY = 0;
    scrollDelta = 1;    // 1 down, -1 up

    material;
    tintColour = TINT_COLOUR_START.clone();

    panelScene;

    boneTL;
    boneTR;
    boneBL;
    boneBR;

    constructor(camera) {
        super();

        this.material = new THREE.MeshBasicMaterial({
            roughness: 0.1,
            metalness: 0,
            map: this.createVideoTexture(),
            side: THREE.FrontSide,
            color: this.tintColour
        });

        this.worldRectStart = elementToWorldRectPoints(PANEL_START_ID, camera);
        this.worldRectEnd = elementToWorldRectPoints(PANEL_END_ID, camera);

        new GLTFLoader().load('../assets/panel-anim-bones-02.glb', (gltf) => {
            this.panelScene = gltf.scene;

            const panelMesh = this.panelScene.children[0].children[0];
            panelMesh.material = this.material;

            this.panelScene.position.copy(this.worldRectStart.center);

            this.add(this.panelScene);

            this.panelScene.children[0].children.forEach(child => {
                if (child.type === "Bone") {
                    if (child.name === "BoneTR") {
                        this.boneTR = child;
                    }
                    else if (child.name === "BoneTL") {
                        this.boneTL = child;
                    }
                    else if (child.name === "BoneBR") {
                        this.boneBR = child;
                    }
                    else if (child.name === "BoneBL") {
                        this.boneBL = child;
                    }
                }
            });

            console.assert(this.boneBL);
            console.assert(this.boneBR);
            console.assert(this.boneTL);
            console.assert(this.boneTR);

            const parent = this.boneBL.parent;

            parent.worldToLocal(this.worldRectStart.tl);
            parent.worldToLocal(this.worldRectStart.tr);
            parent.worldToLocal(this.worldRectStart.bl);
            parent.worldToLocal(this.worldRectStart.br);

            parent.worldToLocal(this.worldRectEnd.tl);
            parent.worldToLocal(this.worldRectEnd.tr);
            parent.worldToLocal(this.worldRectEnd.bl);
            parent.worldToLocal(this.worldRectEnd.br);

            this.onScroll();    // trigger scroll in case user refreshes mid scroll

            this.initDebug();
        }, undefined, (error) => {
            console.error(error);
        });

        window.addEventListener("scroll", this.onScroll);
    }

    initDebug() {
        const folder = debugGui.addFolder("VideoPanel");
        folder.add(this, "animPlaybackPercent", 0, 1).onChange(v => this.playAnimation(v));
    }

    playAnimation() {
        this.boneTL.position.lerpVectors(this.worldRectStart.tl, this.worldRectEnd.tl, this.animPlaybackPercent);
        this.boneTR.position.lerpVectors(this.worldRectStart.tr, this.worldRectEnd.tr, this.animPlaybackPercent);
        this.boneBL.position.lerpVectors(this.worldRectStart.bl, this.worldRectEnd.bl, this.animPlaybackPercent);
        this.boneBR.position.lerpVectors(this.worldRectStart.br, this.worldRectEnd.br, this.animPlaybackPercent);

        this.tintColour.lerpColors(TINT_COLOUR_START, TINT_COLOUR_END, this.animPlaybackPercent);
    }

    createVideoTexture() {
        const video = document.createElement('video');
        video.src = 'assets/pexels-2519660-uhd_3840_2160_24fps.mp4';
        video.loop = true;
        video.muted = true;
        video.play();

        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;

        return texture;
    }

    onScroll = (e) => {
        // this.animPlaybackPercent = THREE.MathUtils.clamp(THREE.MathUtils.inverseLerp(this.scrollYAnimStart, this.scrollYAnimEnd, window.scrollY), 0, 0.99);

        // const curve = new THREE.CubicBezierCurve3(
        //     this.worldPosAtAnimStart,
        //     new THREE.Vector3(-5, 15, 0),
        //     new THREE.Vector3(20, 15, 0),
        //     this.worldPosAtAnimEnd,
        // );
        // new THREE.Vector3(20, 15, 0),

        // const p = curve.getPoint(this.animPlaybackPercent);
        this.playAnimation()

        // this.scrollDelta = (window.scrollY - this.prevScrollY);

        // this.prevScrollY = window.scrollY;
    }

    update(dt) {
        // this.mixer && this.mixer.update(dt);
        if (!AUTOSCROLL_ENABLED) {
            return;
        }
        if (this.animPlaybackPercent > 0.3 && this.animPlaybackPercent < 0.99) {
            let target = window.scrollY;
            if (this.scrollDelta >= 1) {
                target = this.scrollYAnimEnd;
            }
            else if (this.scrollDelta <= 1) {
                target = this.scrollYAnimStart;
            }

            const scrollY = THREE.MathUtils.lerp(window.scrollY, target, dt * 3);
            window.scrollTo({ top: scrollY, behavior: "instant" })
        }
    }
}

const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment Shader
const fragmentShader = `
    uniform float time;
    uniform vec2 resolution;
    void main()	{
        float x = mod(time + gl_FragCoord.x, 20.) < 10. ? 1. : 0.;
        float y = mod(time + gl_FragCoord.y, 20.) < 10. ? 1. : 0.;
        gl_FragColor = vec4(vec3(min(x, y)), 1.);
    }
`;
