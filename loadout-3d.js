import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const canvas=document.getElementById('loadoutCanvas');
if(canvas){
 const host=canvas.parentElement,scene=new THREE.Scene();scene.background=new THREE.Color(0x111014);
 const camera=new THREE.PerspectiveCamera(38,1,.1,30);camera.position.set(0,0,7.5);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene.add(new THREE.HemisphereLight(0xc5d2ff,0x241315,2.2));
 const light=new THREE.DirectionalLight(0xffe5d2,3);light.position.set(3,5,6);scene.add(light);
 const red=new THREE.PointLight(0xe92735,20,10);red.position.set(-3,1,2);scene.add(red);
 const root=new THREE.Group();scene.add(root);
 const gloveMat=new THREE.MeshStandardMaterial({color:0x25262b,roughness:.65});
 const trimMat=new THREE.MeshStandardMaterial({color:0xd52b37,roughness:.4,metalness:.2});
 const bladeMat=new THREE.MeshStandardMaterial({color:0xb8c4d4,roughness:.2,metalness:.85});
 const gripMat=new THREE.MeshStandardMaterial({color:0x252329,roughness:.55,metalness:.2});
 function box(parent,size,pos,material,rot=0){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),material);o.position.set(...pos);o.rotation.z=rot;parent.add(o);return o}
 function rod(parent,a,b,r,material){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);const o=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.01,d.length()-2*r),5,10),material);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(o)}
 function glove(x,tilt){const g=new THREE.Group();root.add(g);g.position.set(x,-1.15,.3);g.rotation.z=tilt;box(g,[.68,.88,.34],[0,-.18,0],gloveMat,-.15);box(g,[.72,.2,.37],[0,-.55,.02],trimMat,-.15);for(let i=0;i<4;i++){const px=-.25+i*.17;rod(g,[px,.1,.02],[px,.68-Math.abs(i-1.5)*.07,.04],.08,gloveMat);box(g,[.13,.07,.04],[px,.46,.1],trimMat,-.08)}rod(g,[x<0?.25:-.25,-.08,.03],[x<0?.5:-.5,.26,.06],.09,gloveMat)}
 glove(-1.05,.3);glove(1.05,-.38);
 const knife=new THREE.Group();root.add(knife);knife.position.set(.62,-.05,.5);knife.rotation.z=-.34;
 let blade;
 function buildBlade(type){
  const shape=new THREE.Shape();
  if(type==='Karambit'){shape.moveTo(-.13,0);shape.quadraticCurveTo(-.5,.45,-.18,1.12);shape.quadraticCurveTo(.02,1.55,.22,1.32);shape.quadraticCurveTo(.03,1.04,.16,.78);shape.lineTo(.13,0);}
  else if(type==='Butterfly'){shape.moveTo(-.13,0);shape.lineTo(-.16,.75);shape.lineTo(0,1.52);shape.lineTo(.16,.75);shape.lineTo(.13,0);}
  else if(type==='Kunai'){shape.moveTo(-.13,0);shape.lineTo(-.12,1.02);shape.lineTo(0,1.62);shape.lineTo(.12,1.02);shape.lineTo(.13,0);}
  else if(type==='Fang'){shape.moveTo(-.13,0);shape.lineTo(-.2,.55);shape.lineTo(-.08,1.48);shape.lineTo(.18,.92);shape.lineTo(.13,0);}
  else{shape.moveTo(-.13,0);shape.lineTo(-.15,.9);shape.lineTo(0,1.42);shape.lineTo(.16,.86);shape.lineTo(.13,0);}
  shape.close();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.025}),bladeMat);
  mesh.position.y=.12;knife.add(mesh);return mesh;
 }
 blade=buildBlade(document.getElementById('knife').value);
 box(knife,[.17,.62,.14],[0,-.3,0],gripMat);box(knife,[.34,.09,.17],[0,.02,0],trimMat);
 for(let i=0;i<4;i++)box(knife,[.19,.03,.15],[0,-.12-i*.11,.08],trimMat,-.08);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.04,10,24),gripMat);ring.position.set(0,-.66,0);knife.add(ring);
 const names=['knife','knifeSkin','gloves','gloveColor'];
 function update(){const k=document.getElementById('knife').value,s=document.getElementById('knifeSkin').value,g=document.getElementById('gloves').value,c=document.getElementById('gloveColor').value;
 if(blade){knife.remove(blade);blade.geometry.dispose();}blade=buildBlade(k);
 const colors={'Оригинални цветове':0x25262b,'Червено / черно':0x8e2028,'Синьо / черно':0x203c75,'Лилаво':0x593078,'Златно':0x8b6a24};gloveMat.color.setHex(colors[c]||0x25262b);
 const skins={'Default':0xb8c4d4,'Gradient':0xb95b75,'Dragon Glass':0x267e78,'Universe':0x6754b5,'Frozen':0x8ecde8};bladeMat.color.setHex(skins[s]||0xb8c4d4);
 knife.scale.set(k==='Butterfly'?.86:k==='Kunai'?.92:1,k==='Karambit'?.9:1,1)}

 let down=false,last=0;canvas.addEventListener('pointerdown',e=>{down=true;last=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointerup',()=>down=false);canvas.addEventListener('pointercancel',()=>down=false);canvas.addEventListener('pointermove',e=>{if(down){root.rotation.y+=(e.clientX-last)*.008;last=e.clientX}});
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);resize();
 function frame(){requestAnimationFrame(frame);if(!down)root.rotation.y=Math.sin(performance.now()*.0004)*.035;renderer.render(scene,camera)}frame();update();
}