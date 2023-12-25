import * as THREE from 'three';
import { GroundProjectedSkybox } from 'three/addons/objects/GroundProjectedSkybox.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const bodyMeshMap = new Map();

var attackPeriod = 5000;
var shootTimer = undefined;
const fire = {weapon:'pistol'};
const weapons = {
    'pistol': {speed:100, frequency:2, projectile:'sphere', size:0.1, mass:0.1},
    'rifle': {speed:180, frequency:0.7, projectile:'sphere', size:0.4, mass:1, explosion:2},
    'machine_gun': {speed:150, frequency:10, projectile:'sphere', size:0.3, mass:0.3},
    'cannon': {speed:50, frequency:0.3, projectile:'box', size:[1,1,1], mass:3, explosion:10},
    'laser': {frequency:150, projectile:'ray', explosion:0.5},
};
const poofBodies = [];
const explosivePushFactor = 200;
const explosiveFizzSpeed = 2;


// Set up Cannon.js
const world = new CANNON.World();
world.gravity.set(0, 0, -9.82);
const material = new CANNON.Material();
const contact = new CANNON.ContactMaterial(material, material, { friction: 0.2, restitution: 0.8 });
world.addContactMaterial(contact);

// Set up Three.js
const clock = new THREE.Clock();
var frameTime = 1 / 30;
const near = 3;
const far = 1000;
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, near, far);
camera.position.set(0, -35, 10);
camera.rotation.x += 3.14159265 / 2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xC5FFF8);
// const hdrLoader = new RGBELoader();
// const envMap = await hdrLoader.loadAsync('blouberg_sunrise_2_1k.hdr');
// envMap.mapping = THREE.EquirectangularReflectionMapping;
// const skybox = new GroundProjectedSkybox( envMap );
// skybox.scale.setScalar(300);
// scene.add( skybox );
// scene.environment = envMap;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 14, 50);
light.target.position.set(-1, 20, -4);
light.castShadow = true;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
light.shadow.camera.near = near;
light.shadow.camera.far = far;
light.shadow.camera.top = 55;
light.shadow.camera.bottom = -55;
light.shadow.camera.left = -55;
light.shadow.camera.right = 55;
scene.add(light);
scene.add(light.target);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
//renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

document.addEventListener('mousedown', mouseDown, false);
document.addEventListener('mouseup', mouseUp, false);
document.addEventListener('mousemove', mouseMove, false);
document.addEventListener('keydown', keyDown, false);


function createGeom(cInfo) {
    const pos = cInfo.pos ?? [0,0,0];
    const size = cInfo.size ?? [1,1,1];
    const vel = cInfo.vel;
    const col = cInfo.col;
    const mass = cInfo.mass ?? 1;
    const castShadow = cInfo.castShadow ?? false;
    const receiveShadow = cInfo.receiveShadow ?? false;
    const shapeName = cInfo.shape ?? 'box';
    const meta = cInfo.meta ?? 'plain';
    const explosion = cInfo.explosion ?? 0;

    // Cannon.js
    var shape = null;
    var geom = null;
    switch (shapeName) {
        case 'box':
            shape = new CANNON.Box(new CANNON.Vec3(...size.map(x => x * 0.5)));
            geom = new THREE.BoxGeometry(...size);
            break;
        case 'sphere':
            shape = new CANNON.Sphere(size);
            geom = new THREE.SphereGeometry(size);
            break;
        case 'cylinder':
            shape = new CANNON.Cylinder(size[0], size[0], size[1], 14);
            geom = new THREE.CylinderGeometry(size[0], size[0], size[1], 28);
            break;
    }
    const body = new CANNON.Body({ mass: mass, material: material });
    body.addShape(shape);
    pos instanceof Array ? body.position.set(...pos) : body.position.copy(pos);
    if (vel !== undefined) {
        vel instanceof Array ? body.velocity.set(...vel) : body.velocity.copy(vel);
    }
    body.linearDamping = 0.05;
    body.meta = meta
    body.explosion = explosion;
    if (explosion > 0 || meta == 'fizz') {
        body.addEventListener('collide', onCollision);
    }
    world.addBody(body);

    // Three.js
    var mat = null;
    if (col !== undefined) {
        mat = new THREE.MeshPhongMaterial({color: col});
    } else {
        mat = new THREE.MeshPhongMaterial({color: Math.floor(Math.random() * 0xffffff)});
    }
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(body.position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.shapeName = shapeName;
    scene.add(mesh);

    bodyMeshMap.set(body, mesh);
}


function createBox(cInfo) {
    cInfo['shape'] = 'box';
    return createGeom(cInfo);
}


function createSphere(cInfo) {
    cInfo['shape'] = 'sphere';
    cInfo['size'] = cInfo.size ?? 1;
    return createGeom(cInfo);
}


function createCylinder(cInfo) {
    cInfo['shape'] = 'cylinder';
    cInfo['size'] = cInfo.size ?? [1, 3];
    return createGeom(cInfo);
}


function makeXYBox(x, y, width) {
    const w = width ? width : 1;
    const xf = width ? -1 : +1;
    createBox({pos:[x+xf*w/2, 0, y+0.5], size:[w, 1, 1], mass:w, castShadow:true, receiveShadow:true});
    createBox({pos:[x+xf*w/2, 1, y+0.5], size:[w, 1, 1], mass:w, castShadow:true, receiveShadow:true});
}


createBox({pos:[0,0,-5], size:[100,100,10], col:0x666633, mass:0, receiveShadow:true});
createBox({pos:[-3,0,2], size:[4,4,4], col:0xbbbbbb, mass:0, castShadow:true, receiveShadow:true});


const castle = `
X X X X X X
XXXXXXXXXXX
X====X====X
XX  XXX  XX
XX  XXX  XX
XXX=====XXX
XXXX   XXXX
XXXX   XXXX
XXXX   XXXX
`.trim();

const lines = castle.split(/\r?\n/)


for (var y = 0; y < lines.length; y++) {
    const line = lines[lines.length-1-y];
    var width = 0;
    for (var x = 0; x < line.length; x++) {
        if (line[x] == '=') {
            width++;
        } else if (width || line[x] == 'X') {
            makeXYBox(x, y, width);
            if (width && line[x] == 'X') {
                makeXYBox(x, y, 0);
            }
            width = 0;
        }
    }
    if (width) {
        makeXYBox(x, y, width);
    }
}

function aim(evt) {
    var direction = new THREE.Vector3(
        (evt.clientX / window.innerWidth)*2 - 1,
      - (evt.clientY / window.innerHeight)*2 + 1,
        0.5
    );
    direction.unproject(camera);
    return direction.sub(camera.position).normalize();
}

function mouseDown(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    fire['dir'] = aim(evt);
    if (evt.button == 0) {
        shoot();
    }
}

function mouseUp(evt) {
    clearTimeout(shootTimer);
}

function mouseMove(evt) {
    fire['dir'] = aim(evt);
    if (fire.weapon == 'lazer') {
        shoot(); // moving is shooting
    }
}

function keyDown(evt) {
    if (evt.key == '1') {
        fire.weapon = 'pistol';
    } else if (evt.key == '2') {
        fire.weapon = 'rifle';
    } else if (evt.key == '3') {
        fire.weapon = 'machine_gun';
    } else if (evt.key == '4') {
        fire.weapon = 'cannon';
    } else if (evt.key == '5') {
        fire.weapon = 'laser';
    }
}

function shoot() {
    const dir = fire['dir'];
    const weaponType = fire.weapon;
    const weapon = weapons[weaponType];
    const speed = weapon.speed;
    const freq = weapon.frequency;
    if (weaponType == 'laser') {
        var ray = new THREE.Raycaster(camera.position, dir);
        const a = Array.from(bodyMeshMap.values())
        ray.intersectObjects(a).forEach(intersection => {
            for (const [body, mesh] of bodyMeshMap) {
                if (mesh == intersection.object) {
                    if (body.mass != 0) {
                        dropThing(body, mesh);
                    }
                    break;
                }
            }
        });
    } else {
        const direction = dir.clone().multiplyScalar(speed);
        createGeom({pos:camera.position, size:weapon.size, vel:direction, mass:weapon.mass, castShadow:true, shape:weapon.projectile, explosion:weapon.explosion, meta:'bullet'});
    }
    clearTimeout(shootTimer);
    shootTimer = setTimeout(shoot, 1000/freq);
}

function attack() {
    const leftSide = true;//(Math.random() < 0.5);
    var pos, vel;
    if (leftSide) {
        pos = [-50, 0, 20];
        vel = [20, 0, 5];
    } else {
        pos = [50, 0, 20];
        vel = [-20, 0, 5];
    }
    createCylinder({pos:pos, vel:vel, mass:1, castShadow:true, meta:'attack'});
    attackPeriod *= 0.9;
    if (attackPeriod < 300) {
        attackPeriod = 300;
    }
    var r = Math.max(Math.random(), 0.5);
    setTimeout(attack, r*attackPeriod);
}


function onCollision(evt) {
    poofBodies.push(evt.target);
}


function createExplosion(pos, vel, explosion) {
    for (const [body, mesh] of bodyMeshMap) {
        if (body.mass <= 0) {
            continue;
        }
        const dist = body.position.distanceTo(pos);
        if (dist <= explosion) {
            const push = (dist > 0.3) ? explosion / dist : explosion * 3;
            const force = body.position.vsub(pos).scale(explosivePushFactor * push);
            body.applyForce(force, pos);
        }
    }
    // generate fizz
    for (var i = 0; i < 10*explosion; ++i) {
        const rnd = new CANNON.Vec3(Math.random()*2-1, Math.random()*2-1, Math.random()*2-1);
        const off = rnd.clone();
        const fizzVel = rnd.scale(explosiveFizzSpeed * explosion).vadd(vel.scale(0.3));
        createSphere({pos:pos.vadd(off), size:0.1, vel:fizzVel, mass:0.1, meta:'fizz', col:0x333333});
    }
}

function dropThing(body, mesh) {
    world.remove(body);

    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();

    bodyMeshMap.delete(body);
}

function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame(animate);
    frameTime = frameTime*0.8 + clock.getDelta() * 0.2;
    world.step(frameTime);

    while (poofBodies.length > 0) {
        const body = poofBodies.pop();
        const m = bodyMeshMap.get(body);
        if (m === undefined) {
            break;
        }
        dropThing(body, m);
        if (body.explosion > 0) {
            createExplosion(body.position, body.velocity, body.explosion);
        }
    }

    const rotation = new THREE.Quaternion();
    rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    for (const [body, mesh] of bodyMeshMap) {
        if (body.position.z < -30 ||
            body.position.z > 200 ||
            Math.abs(body.position.x) > 200 ||
            Math.abs(body.position.y) > 400) {
            dropThing(body, mesh);
            continue;
        }
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        if (mesh.shapeName == 'cylinder') {
            mesh.quaternion.multiply(rotation);
        }
    }

    renderer.render(scene, camera);
}


window.addEventListener('resize', resize, false);
setTimeout(attack, Math.random()*3000);
animate();
