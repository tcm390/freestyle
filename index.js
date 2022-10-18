import * as THREE from 'three';
import metaversefile from 'metaversefile';


const {useApp, useFrame, useLoaders, usePhysics, useCleanup, useLocalPlayer, useActivate, useInternals} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\/]*$/, '$1'); 

const textureLoader = new THREE.TextureLoader();
const circleTexture = textureLoader.load(`${baseUrl}test-freestyle2/textures/Circle133.png`);
const noiseMap = textureLoader.load(`${baseUrl}test-freestyle2/textures/noise.jpg`);
noiseMap.wrapS = noiseMap.wrapT = THREE.RepeatWrapping;

export default () => {  
    const _getGeometry = (geometry, attributeSpecs, particleCount) => {
        const geometry2 = new THREE.BufferGeometry();
        ['position', 'normal', 'uv'].forEach(k => {
        geometry2.setAttribute(k, geometry.attributes[k]);
        });
        geometry2.setIndex(geometry.index);
    
        const positions = new Float32Array(particleCount * 3);
        const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
        geometry2.setAttribute('positions', positionsAttribute);
    
        for(const attributeSpec of attributeSpecs){
            const {
                name,
                itemSize,
            } = attributeSpec;
            const array = new Float32Array(particleCount * itemSize);
            geometry2.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
        }
    
        return geometry2;
    };
    const scene = useInternals().sceneLowPriority;
    const app = useApp();
    const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: {
            value: 0
          },
          circleTexture: {
            value: circleTexture
          },
          noiseMap: {
            value: noiseMap
          }
        },
        vertexShader: `
            ${THREE.ShaderChunk.common}
            ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            
            attribute vec3 scales;
            
            attribute float rotation;
            attribute vec3 positions;
            attribute float broken;
            
            varying float vBroken;
            varying vec2 vUv;
            varying vec3 vPos;
           
            void main() {  
                mat3 rotY = mat3(
                    cos(rotation), 0.0, -sin(rotation), 
                    0.0, 1.0, 0.0, 
                    sin(rotation), 0.0, cos(rotation)
                );
                vBroken = broken;
                vUv = uv;
                vec3 pos = position;
                pos *= 0.005;
                pos *= scales;
                pos *= rotY;
                pos += positions;
                vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectionPosition = projectionMatrix * viewPosition;
                vPos = modelPosition.xyz;
                gl_Position = projectionPosition;
                ${THREE.ShaderChunk.logdepthbuf_vertex}
            }
        `,
        fragmentShader: `
            ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
            uniform sampler2D circleTexture;
            uniform float uTime;
            uniform sampler2D noiseMap;
            
            varying vec2 vUv;
            varying vec3 vPos;
            varying float vBroken;
            
            void main() {
                vec4 motion = texture2D(
                    circleTexture,
                    vUv
                );
                gl_FragColor = motion;
                float broken = abs( sin( 1.0 - vBroken ) ) - texture2D( noiseMap, vUv ).g;
                if ( broken < 0.0001 ) discard;
                if (vPos.y < 0.) {
                    discard;
                }
              ${THREE.ShaderChunk.logdepthbuf_fragment}
                
            }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const particleCount = 2;
    const info = {
        initialScale: [particleCount],
    }
    for (let i = 0; i < particleCount; i ++) {
        info.initialScale[i] = new THREE.Vector3();
    }
    let splash = null;
    const freestyleSplashGroup = new THREE.Group();
    const group = new THREE.Group();
    (async () => {
        const u = `${baseUrl}/test-freestyle2/dome.glb`;
        const splashApp = await new Promise((accept, reject) => {
            const {gltfLoader} = useLoaders();
            gltfLoader.load(u, accept, function onprogress() {}, reject);
            
        });

        splashApp.scene.traverse(o => {
            if (o.isMesh) {
                const splashGeometry = o.geometry;
                const attributeSpecs = [];
                attributeSpecs.push({name: 'broken', itemSize: 1});
                attributeSpecs.push({name: 'opacity', itemSize: 1});
                attributeSpecs.push({name: 'scales', itemSize: 3});
                attributeSpecs.push({name: 'rotation', itemSize: 1});
                const geometry = _getGeometry(splashGeometry, attributeSpecs, particleCount);
                splash = new THREE.InstancedMesh(geometry, material, particleCount);
                group.add(splash);
                group.rotation.x = -Math.PI / 1.8;
                freestyleSplashGroup.add(group);
                scene.add(freestyleSplashGroup);
            }
        });
        
        


    })();

    useFrame(({timestamp}) => {
        if (splash) {
            // if (splash.scale.y > 3) {
            //     splash.scale.x = 0.5;
            //     splash.scale.z = 0.5;
            //     splash.scale.y = 1; 
            //     splash.rotation.y = Math.random() * 2 * Math.PI;
            // }
            // splash.scale.y += 0.1;
            const positionsAttribute = splash.geometry.getAttribute('positions');
            const brokenAttribute = splash.geometry.getAttribute('broken');
            const scalesAttribute = splash.geometry.getAttribute('scales');
            const rotationAttribute = splash.geometry.getAttribute('rotation');
            for (let i = 0; i < particleCount; i ++) {
                if (brokenAttribute.getX(i) >= 1 || brokenAttribute.getX(i) <= 0) {
                    const rand = 0.125 * Math.random() + 0.125;
                    const rand2 = 0.5 * Math.random() + 0.5;
                    info.initialScale[i].set(rand, rand2, rand); 
                    scalesAttribute.setXYZ(i, info.initialScale[i].x, info.initialScale[i].y, info.initialScale[i].z);
                    rotationAttribute.setX(i, Math.random() * 2 * Math.PI);
                    brokenAttribute.setX(i, Math.random() * 0.1);
                }
                scalesAttribute.setXYZ(
                    i, 
                    scalesAttribute.getX(i) * 1.03, 
                    scalesAttribute.getY(i) * 1.04, 
                    scalesAttribute.getZ(i) * 1.03
                )
                if (brokenAttribute.getX(i) < 1 && scalesAttribute.getY(i) > info.initialScale[i].y * 3) {
                    brokenAttribute.setX(i, brokenAttribute.getX(i) + 0.025);
                }
                
            }

            scalesAttribute.needsUpdate = true;
            positionsAttribute.needsUpdate = true;
            brokenAttribute.needsUpdate = true;
            rotationAttribute.needsUpdate = true;
            splash.material.uniforms.uTime.value = timestamp / 1000;
        }
        
        scene.updateMatrixWorld();
    });

    return app;
}