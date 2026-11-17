import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.getElementById('loadoutCanvas');
if (canvas) {
  const host = canvas.parentElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b10);
  scene.fog = new THREE.Fog(0x0b0b10, 8, 17);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 0.05, 8.8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  scene.add(new THREE.HemisphereLight(0xc9d9ff, 0x261319, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffe6d1, 3.4);
  keyLight.position.set(3.5, 5, 7);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x557dff, 2.2);
  rimLight.position.set(-4, 1.5, -3);
  scene.add(rimLight);
  const redLight = new THREE.PointLight(0xff2638, 16, 9);
  redLight.position.set(-2.8, 1.2, 2.5);
  scene.add(redLight);

  const root = new THREE.Group();
  scene.add(root);

  // Optional external GLB/GLTF assets. Procedural models remain as a fallback.
  const assetStatus = document.getElementById('loadoutAssetStatus');
  const gltfLoader = new GLTFLoader();
  const assetCache = new Map();
  let assetManifest = { models: {} };
  let externalKnife = null;
  let externalGloves = null;
  function setAssetStatus(message) {
    if (assetStatus) assetStatus.textContent = message;
  }
  async function loadAssetManifest() {
    try {
      const response = await fetch('./assets/loadout/manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('manifest unavailable');
      assetManifest = await response.json();
      const count = Object.keys(assetManifest.models || {}).length;
      setAssetStatus(count ? 'ASSET MANIFEST CONNECTED · ' + count + ' MODEL ENTRIES' : 'LOADER READY · 0 MODELS CONNECTED');
      return true;
    } catch (error) {
      setAssetStatus('3D MODEL ASSETS: NOT CONNECTED');
      return false;
    }
  }
  async function getAsset(url) {
    if (!url) return null;
    if (!assetCache.has(url)) {
      assetCache.set(url, gltfLoader.loadAsync(url).then(gltf => gltf.scene).catch(error => {
        console.warn('Loadout asset failed:', url, error);
        assetCache.delete(url);
        return null;
      }));
    }
    const model = await assetCache.get(url);
    return model ? model.clone(true) : null;
  }
  function applyAssetTransform(model, config = {}) {
    const scale = Number(config.scale) || 1;
    model.scale.setScalar(scale);
    if (Array.isArray(config.position)) model.position.set(...config.position);
    if (Array.isArray(config.rotation)) model.rotation.set(...config.rotation);
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material = Array.isArray(node.material)
            ? node.material.map(material => material.clone())
            : node.material.clone();
        }
      }
    });
    return model;
  }


  function makePattern(base, accent, kind) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    if (kind === 'carbon') {
      for (let y=0;y<256;y+=12) for(let x=0;x<256;x+=12) {
        ctx.fillStyle = ((x+y)/12)%2 ? accent : 'rgba(255,255,255,.10)';
        ctx.fillRect(x,y,6,6); ctx.fillRect(x+6,y+6,6,6);
      }
    } else if (kind === 'fabric') {
      for(let i=0;i<256;i+=5) {
        ctx.strokeStyle = i%10 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.22)';
        ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();
      }
      ctx.strokeStyle=accent;ctx.lineWidth=5;
      for(let i=-256;i<512;i+=48){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+256,256);ctx.stroke();}
    } else {
      const g=ctx.createLinearGradient(0,0,256,256);
      g.addColorStop(0,accent);g.addColorStop(.48,base);g.addColorStop(1,'#08090d');
      ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
      for(let i=0;i<90;i++){ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(Math.random()*256,Math.random()*256,1,18);}
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(1.4,1.4);return tex;
  }

  const gloveMaterial = new THREE.MeshStandardMaterial({ color:0xffffff, map:makePattern('#292b32','#d93442','fabric'), roughness:.78 });
  const gloveDark = new THREE.MeshStandardMaterial({ color:0x17191f, roughness:.72 });
  const seamMat = new THREE.MeshStandardMaterial({ color:0xc7cbd3, roughness:.65 });
  const metalMat = new THREE.MeshStandardMaterial({ color:0xbfc8d8, metalness:.92, roughness:.2 });
  const bladeMat = new THREE.MeshStandardMaterial({ color:0xffffff, map:makePattern('#aeb9c8','#f4f7ff','metal'), metalness:.88, roughness:.23 });
  const edgeMat = new THREE.MeshStandardMaterial({ color:0xe8edf5, metalness:1, roughness:.13 });
  const handleMat = new THREE.MeshStandardMaterial({ color:0x20232b, map:makePattern('#171a22','#6d7483','carbon'), roughness:.5, metalness:.28 });
  const accentMat = new THREE.MeshStandardMaterial({ color:0xd52b3b, metalness:.35, roughness:.34 });

  function mesh(parent, geometry, material, pos, rot) {
    const o=new THREE.Mesh(geometry,material);
    o.position.set(pos[0],pos[1],pos[2]);
    if(rot)o.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);
    parent.add(o);return o;
  }
  function roundedBox(parent,size,pos,material,radius=.08) {
    const shape=new THREE.Shape();
    const w=size[0],h=size[1],r=Math.min(radius,w/2,h/2);
    shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
    shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
    shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    return mesh(parent,new THREE.ExtrudeGeometry(shape,{depth:size[2],bevelEnabled:true,bevelSegments:3,bevelSize:.025,bevelThickness:.025}),material,pos);
  }
  function capsuleBetween(parent,a,b,r,material,radial=12) {
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);
    const geo=new THREE.CapsuleGeometry(r,Math.max(.01,d.length()-2*r),5,radial);
    const o=mesh(parent,geo,material,[0,0,0]);
    o.position.copy(A).add(B).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    return o;
  }
  function glove(x, tilt, side) {
    const g=new THREE.Group();root.add(g);g.position.set(x,-1.02,.15);g.rotation.z=tilt;
    // cuff and palm
    roundedBox(g,[.76,.76,.38],[0,-.22,0],gloveMaterial,.16);
    roundedBox(g,[.79,.23,.4],[0,-.62,.015],gloveDark,.08);
    roundedBox(g,[.74,.075,.415],[0,-.51,.035],accentMat,.025);
    // four shaped fingers with articulated knuckle pads
    for(let i=0;i<4;i++){
      const px=-.27+i*.18, length=.53-Math.abs(i-1.5)*.035;
      capsuleBetween(g,[px,.03,.04],[px+(side*.015),length,.04],.085,gloveMaterial);
      const pad=mesh(g,new THREE.SphereGeometry(.087,14,10),gloveDark,[px,length-.14,.105]);
      pad.scale.set(1,.62,.35);
      capsuleBetween(g,[px-.052,length-.14,.135],[px+.052,length-.14,.135],.009,seamMat,6);
    }
    // thumb angled inward toward the knife
    capsuleBetween(g,[side*.28,-.08,.03],[side*.49,.26,.12],.105,gloveMaterial);
    const thumbPad=mesh(g,new THREE.SphereGeometry(.105,14,10),gloveDark,[side*.43,.18,.16]);
    thumbPad.scale.set(1,.72,.35);
    // stitched wrist panel and small armor plate
    roundedBox(g,[.43,.22,.045],[0,-.31,.22],gloveDark,.045);
    roundedBox(g,[.24,.085,.035],[0,-.31,.252],seamMat,.025);
    const emblem=mesh(g,new THREE.CircleGeometry(.045,20),accentMat,[0,-.31,.28]);
    return g;
  }
  const proceduralGloves = [glove(-1.05,.28,1), glove(1.03,-.34,-1)];

  const knife = new THREE.Group();
  root.add(knife);
  knife.position.set(.47,-.04,.62);
  knife.rotation.z=-.38;
  knife.rotation.x=-.12;

  let bladeGroup=null, handleGroup=null;
  function makeBlade(type) {
    const group=new THREE.Group();
    const s=new THREE.Shape();
    if(type==='Karambit'){
      s.moveTo(-.12,0);s.quadraticCurveTo(-.48,.42,-.25,.94);s.quadraticCurveTo(-.08,1.42,.28,1.48);
      s.quadraticCurveTo(.12,1.13,.23,.82);s.lineTo(.13,.15);s.lineTo(-.12,0);
    } else if(type==='Butterfly'){
      s.moveTo(-.13,0);s.lineTo(-.14,.55);s.lineTo(-.22,1.15);s.lineTo(0,1.63);s.lineTo(.22,1.15);s.lineTo(.14,.55);s.lineTo(.13,0);
    } else if(type==='Kunai'){
      s.moveTo(-.12,0);s.lineTo(-.12,1.03);s.lineTo(-.19,1.35);s.lineTo(0,1.72);s.lineTo(.19,1.35);s.lineTo(.12,1.03);s.lineTo(.12,0);
    } else if(type==='Fang'){
      s.moveTo(-.13,0);s.lineTo(-.18,.62);s.lineTo(-.08,1.05);s.lineTo(.2,1.52);s.lineTo(.13,.86);s.lineTo(.14,0);
    } else if(type==='Sting') {
      s.moveTo(-.12,0);s.lineTo(-.16,.9);s.lineTo(0,1.5);s.lineTo(.16,.9);s.lineTo(.12,0);
    } else {
      s.moveTo(-.12,0);s.lineTo(-.16,.9);s.lineTo(0,1.5);s.lineTo(.16,.9);s.lineTo(.12,0);
    }
    s.close();
    const body=mesh(group,new THREE.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelSegments:4,bevelSize:.035,bevelThickness:.035,curveSegments:16}),bladeMat,[0,.08,0]);
    const ridge=mesh(group,new THREE.BoxGeometry(.018,.92,.012),edgeMat,[0,.69,.095]);
    ridge.rotation.z=.015;
    if(type==='Karambit'){
      const ring=mesh(group,new THREE.TorusGeometry(.17,.055,12,32),handleMat,[0,-.72,0]);
      ring.rotation.x=.2;
    }
    return group;
  }
  function makeHandle(type) {
    const h=new THREE.Group();
    const length=type==='Butterfly'?.72:type==='Kunai'?.68:.62;
    roundedBox(h,[.19,length,.17],[0,-length/2-.02,0],handleMat,.075);
    roundedBox(h,[.27,.09,.2],[0,.02,.015],accentMat,.035);
    for(let i=0;i<5;i++){
      const band=mesh(h,new THREE.TorusGeometry(.105,.012,6,20),accentMat,[0,-.12-i*.105,.09]);
      band.rotation.x=Math.PI/2;
    }
    if(type==='Butterfly'){
      roundedBox(h,[.085,.65,.07],[-.19,-.29,-.02],metalMat,.025);
      roundedBox(h,[.085,.65,.07],[.19,-.29,-.02],metalMat,.025);
    }
    if(type==='Kunai'){
      const pom=mesh(h,new THREE.TorusGeometry(.12,.035,8,24),metalMat,[0,-.76,0]);
      pom.rotation.x=Math.PI/2;
    }
    return h;
  }
  function rebuildKnife(type) {
    if(bladeGroup){knife.remove(bladeGroup);bladeGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
    if(handleGroup){knife.remove(handleGroup);handleGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
    bladeGroup=makeBlade(type);handleGroup=makeHandle(type);
    knife.add(bladeGroup);knife.add(handleGroup);
    knife.scale.set(type==='Butterfly'?.9:type==='Karambit'?.92:1,1,1);
  }

  const skinColors={Default:0xc4cedd,Gradient:0xc56b88,'Dragon Glass':0x3daca0,Universe:0x7e6bda,Frozen:0x9bdcf2};
  const gloveColors={'Оригинални цветове':0xffffff,'Червено / черно':0xc52b38,'Синьо / черно':0x4978c8,'Лилаво':0x9562c5,'Златно':0xc49a3b};
  const gloveStyles={'Retro Wave':['#252a3a','#f0448b'],'Living Flame':['#351c20','#f07824'],Tiger:['#252018','#d69b27'],Champion:['#20252b','#bfc7d2'],Specialist:['#1d2927','#4caa8b']};

  async function syncExternalAssets() {
    const selectedKnife = document.getElementById('knife').value;
    const selectedGloves = document.getElementById('gloves').value;
    const models = assetManifest.models || {};
    const knifeConfig = models.knives && models.knives[selectedKnife];
    const gloveConfig = models.gloves && models.gloves[selectedGloves];

    if (knifeConfig && knifeConfig.src) {
      const model = await getAsset(knifeConfig.src);
      if (model) {
        while (knife.children.length) knife.remove(knife.children[0]);
        knife.add(applyAssetTransform(model, knifeConfig));
        externalKnife = selectedKnife;
      }
    } else if (externalKnife) {
      rebuildKnife(selectedKnife);
      externalKnife = null;
    }

    if (gloveConfig && gloveConfig.src) {
      const model = await getAsset(gloveConfig.src);
      if (model) {
        proceduralGloves.forEach(item => { item.visible = false; });
        if (externalGloves) root.remove(externalGloves);
        externalGloves = applyAssetTransform(model, gloveConfig);
        root.add(externalGloves);
      }
    } else {
      if (externalGloves) {
        root.remove(externalGloves);
        externalGloves = null;
      }
      proceduralGloves.forEach(item => { item.visible = true; });
    }
  }

  function updateLoadout() {
    const type=document.getElementById('knife').value;
    const skin=document.getElementById('knifeSkin').value;
    const gloveType=document.getElementById('gloves').value;
    const color=document.getElementById('gloveColor').value;
    rebuildKnife(type);
    bladeMat.color.setHex(skinColors[skin]||skinColors.Default);
    const palette=gloveStyles[gloveType]||gloveStyles['Retro Wave'];
    const oldMap=gloveMaterial.map;
    gloveMaterial.map=makePattern(palette[0],palette[1],'fabric');
    if(oldMap)oldMap.dispose();
    gloveMaterial.color.setHex(gloveColors[color]||0xffffff);
    accentMat.color.setHex(gloveColors[color]===0xffffff?0xd52b3b:gloveColors[color]);
    gloveMaterial.needsUpdate=true;
    syncExternalAssets();
  }
  ['knife','knifeSkin','gloves','gloveColor'].forEach(id=>document.getElementById(id).addEventListener('change',updateLoadout));
  loadAssetManifest().then(connected => { if (connected) syncExternalAssets(); });
  updateLoadout();

  let dragging=false,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointercancel',()=>dragging=false);
  canvas.addEventListener('pointermove',e=>{
    if(!dragging)return;
    root.rotation.y+=(e.clientX-lastX)*.008;
    root.rotation.x=THREE.MathUtils.clamp(root.rotation.x+(e.clientY-lastY)*.004,-.25,.25);
    lastX=e.clientX;lastY=e.clientY;
  });

  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function animate(){
    requestAnimationFrame(animate);
    if(!dragging){root.rotation.y+=(Math.sin(performance.now()*.00035)*.025-root.rotation.y)*.025;}
    renderer.render(scene,camera);
  }
  animate();
}
