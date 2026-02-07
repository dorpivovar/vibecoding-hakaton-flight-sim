/**
 * Модуль генерации 3D мира — рельеф, небо, облака, вода, объекты
 */

class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.chunkSize = 500;
        this.renderDistance = 5; // чанков в каждую сторону
        this.lastChunkX = null;
        this.lastChunkZ = null;

        this.buildSky();
        this.buildSea();
        this.buildRunway();
        this.buildClouds();
        this.buildMountains();
        this.buildTrees();
        this.buildBuildings();
    }

    buildSky() {
        // Скайбокс — градиентная полусфера
        const skyGeo = new THREE.SphereGeometry(15000, 32, 32);
        const skyVertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        const skyFragmentShader = `
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition).y;
                // Горизонт -> зенит
                vec3 bottomColor = vec3(0.7, 0.8, 0.95);  // светло-голубой горизонт
                vec3 topColor = vec3(0.15, 0.3, 0.7);      // тёмно-синее небо
                vec3 sunColor = vec3(1.0, 0.95, 0.8);

                float t = max(h, 0.0);
                vec3 sky = mix(bottomColor, topColor, pow(t, 0.5));

                // Солнечное свечение
                vec3 sunDir = normalize(vec3(0.5, 0.4, -0.7));
                float sunDot = max(dot(normalize(vWorldPosition), sunDir), 0.0);
                sky += sunColor * pow(sunDot, 64.0) * 0.5;
                sky += sunColor * pow(sunDot, 8.0) * 0.15;

                // Подсветка горизонта
                float horizonGlow = exp(-abs(h) * 10.0);
                sky += vec3(1.0, 0.85, 0.6) * horizonGlow * 0.2;

                // Земля под горизонтом
                if (h < 0.0) {
                    vec3 groundColor = vec3(0.4, 0.35, 0.3);
                    sky = mix(bottomColor, groundColor, min(-h * 5.0, 1.0));
                }

                gl_FragColor = vec4(sky, 1.0);
            }
        `;

        const skyMat = new THREE.ShaderMaterial({
            vertexShader: skyVertexShader,
            fragmentShader: skyFragmentShader,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        this.skyMesh = sky;

        // Солнце (спрайт)
        const sunGeo = new THREE.SphereGeometry(200, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        sun.position.set(5000, 4000, -7000);
        this.scene.add(sun);

        // Освещение
        const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        dirLight.position.set(5000, 4000, -7000);
        dirLight.castShadow = false;
        this.scene.add(dirLight);

        const ambientLight = new THREE.AmbientLight(0x6688aa, 0.5);
        this.scene.add(ambientLight);

        // Лёгкий туман
        this.scene.fog = new THREE.FogExp2(0x8899bb, 0.00015);
    }

    buildSea() {
        // Большая плоскость воды/земли
        const groundGeo = new THREE.PlaneGeometry(30000, 30000, 100, 100);
        
        // Добавляем неровности
        const vertices = groundGeo.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 1]; // для PlaneGeometry до поворота
            // Мягкие холмы
            vertices[i + 2] = 
                Math.sin(x * 0.002) * Math.cos(z * 0.003) * 15 +
                Math.sin(x * 0.005 + 1) * Math.cos(z * 0.004) * 8 +
                Math.sin(x * 0.01) * Math.cos(z * 0.01) * 3;
        }
        groundGeo.computeVertexNormals();

        const groundMat = new THREE.MeshPhongMaterial({
            color: 0x3d7a3d,
            flatShading: true,
            shininess: 5
        });

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        this.scene.add(ground);
        this.ground = ground;

        // Водная поверхность (озеро)
        const waterGeo = new THREE.PlaneGeometry(3000, 3000);
        const waterMat = new THREE.MeshPhongMaterial({
            color: 0x2266aa,
            transparent: true,
            opacity: 0.6,
            shininess: 100,
            specular: 0x99bbdd
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.set(2000, 0.5, -2000);
        this.scene.add(water);
    }

    buildRunway() {
        // Взлётно-посадочная полоса
        const runwayGeo = new THREE.PlaneGeometry(40, 1000);
        const runwayMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const runway = new THREE.Mesh(runwayGeo, runwayMat);
        runway.rotation.x = -Math.PI / 2;
        runway.position.set(0, 0.1, 0);
        this.scene.add(runway);

        // Разметка полосы
        const markingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Центральная линия
        for (let i = -480; i < 480; i += 30) {
            const mark = new THREE.Mesh(
                new THREE.PlaneGeometry(0.5, 12),
                markingMat
            );
            mark.rotation.x = -Math.PI / 2;
            mark.position.set(0, 0.15, i);
            this.scene.add(mark);
        }

        // Пороговая разметка
        for (let side = -1; side <= 1; side += 2) {
            for (let x = -15; x <= 15; x += 3) {
                const mark = new THREE.Mesh(
                    new THREE.PlaneGeometry(1.5, 25),
                    markingMat
                );
                mark.rotation.x = -Math.PI / 2;
                mark.position.set(x, 0.15, side * 480);
                this.scene.add(mark);
            }
        }

        // Боковые огни ВПП
        const lightGeo = new THREE.SphereGeometry(0.3, 4, 4);
        const lightMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        const lightMatRed = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const lightMatGreen = new THREE.MeshBasicMaterial({ color: 0x44ff44 });

        for (let z = -500; z <= 500; z += 30) {
            for (let side = -1; side <= 1; side += 2) {
                const mat = (z < -400) ? lightMatGreen : 
                           (z > 400) ? lightMatRed : lightMatWhite;
                const light = new THREE.Mesh(lightGeo, mat);
                light.position.set(side * 22, 0.3, z);
                this.scene.add(light);
            }
        }

        // PAPI огни (подход)
        for (let x = -6; x <= 6; x += 4) {
            const papi = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            papi.position.set(25 + x, 0.5, -500);
            this.scene.add(papi);
        }

        // Рулёжная дорожка
        const taxiwayGeo = new THREE.PlaneGeometry(15, 200);
        const taxiwayMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const taxiway = new THREE.Mesh(taxiwayGeo, taxiwayMat);
        taxiway.rotation.x = -Math.PI / 2;
        taxiway.rotation.z = Math.PI / 4;
        taxiway.position.set(50, 0.08, 200);
        this.scene.add(taxiway);
    }

    buildClouds() {
        this.clouds = [];
        const cloudMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.75,
            flatShading: true
        });

        for (let i = 0; i < 80; i++) {
            const cloudGroup = new THREE.Group();
            
            // Каждое облако из нескольких сфер
            const numPuffs = 5 + Math.floor(Math.random() * 8);
            for (let j = 0; j < numPuffs; j++) {
                const size = 30 + Math.random() * 80;
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(size, 6, 6),
                    cloudMat
                );
                puff.position.set(
                    (Math.random() - 0.5) * size * 3,
                    (Math.random() - 0.5) * size * 0.5,
                    (Math.random() - 0.5) * size * 3
                );
                puff.scale.y = 0.4 + Math.random() * 0.3;
                cloudGroup.add(puff);
            }

            cloudGroup.position.set(
                (Math.random() - 0.5) * 20000,
                800 + Math.random() * 2500,
                (Math.random() - 0.5) * 20000
            );

            this.scene.add(cloudGroup);
            this.clouds.push({
                mesh: cloudGroup,
                speed: 2 + Math.random() * 5,
                originalX: cloudGroup.position.x
            });
        }
    }

    buildMountains() {
        const mountainMat = new THREE.MeshPhongMaterial({ 
            color: 0x556644, 
            flatShading: true 
        });
        const snowMat = new THREE.MeshPhongMaterial({ 
            color: 0xeeeeff, 
            flatShading: true 
        });

        // Горная цепь на горизонте
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const dist = 6000 + Math.random() * 3000;
            const height = 300 + Math.random() * 1200;
            const width = 200 + Math.random() * 500;

            const mountain = new THREE.Mesh(
                new THREE.ConeGeometry(width, height, 6 + Math.floor(Math.random() * 4)),
                height > 800 ? snowMat : mountainMat
            );
            mountain.position.set(
                Math.cos(angle) * dist,
                height / 2 - 20,
                Math.sin(angle) * dist
            );
            mountain.rotation.y = Math.random() * Math.PI;
            this.scene.add(mountain);
        }

        // Ближние холмы
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1500 + Math.random() * 4000;
            const height = 50 + Math.random() * 200;

            // Не ставим на ВПП
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            if (Math.abs(x) < 100 && Math.abs(z) < 600) continue;

            const hill = new THREE.Mesh(
                new THREE.ConeGeometry(100 + Math.random() * 200, height, 8),
                mountainMat
            );
            hill.position.set(x, height / 2 - 10, z);
            this.scene.add(hill);
        }
    }

    buildTrees() {
        const trunkMat = new THREE.MeshPhongMaterial({ color: 0x553311, flatShading: true });
        const leafMat = new THREE.MeshPhongMaterial({ color: 0x337722, flatShading: true });
        const leafMat2 = new THREE.MeshPhongMaterial({ color: 0x448833, flatShading: true });

        // Группы деревьев вдоль ВПП и вокруг
        for (let i = 0; i < 300; i++) {
            const x = (Math.random() - 0.5) * 5000;
            const z = (Math.random() - 0.5) * 5000;

            // Не ставим на ВПП
            if (Math.abs(x) < 50 && Math.abs(z) < 550) continue;

            const treeGroup = new THREE.Group();
            const height = 8 + Math.random() * 15;

            // Ствол
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.5, height * 0.4, 5),
                trunkMat
            );
            trunk.position.y = height * 0.2;
            treeGroup.add(trunk);

            // Крона (конус)
            const crown = new THREE.Mesh(
                new THREE.ConeGeometry(3 + Math.random() * 3, height * 0.7, 6),
                Math.random() > 0.5 ? leafMat : leafMat2
            );
            crown.position.y = height * 0.6;
            treeGroup.add(crown);

            treeGroup.position.set(x, 0, z);
            treeGroup.scale.setScalar(0.8 + Math.random() * 0.6);
            this.scene.add(treeGroup);
        }
    }

    buildBuildings() {
        const buildingMats = [
            new THREE.MeshPhongMaterial({ color: 0x887766, flatShading: true }),
            new THREE.MeshPhongMaterial({ color: 0x998877, flatShading: true }),
            new THREE.MeshPhongMaterial({ color: 0x667788, flatShading: true }),
        ];

        // Ангар у ВПП
        const hangar = new THREE.Mesh(
            new THREE.BoxGeometry(30, 12, 40),
            new THREE.MeshPhongMaterial({ color: 0x777788, flatShading: true })
        );
        hangar.position.set(80, 6, 100);
        this.scene.add(hangar);

        // Башня управления
        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(8, 25, 8),
            new THREE.MeshPhongMaterial({ color: 0x889999, flatShading: true })
        );
        tower.position.set(90, 12.5, 0);
        this.scene.add(tower);

        const towerTop = new THREE.Mesh(
            new THREE.BoxGeometry(12, 5, 12),
            new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 })
        );
        towerTop.position.set(90, 27, 0);
        this.scene.add(towerTop);

        // Городок вдалеке
        for (let i = 0; i < 50; i++) {
            const height = 10 + Math.random() * 50;
            const width = 10 + Math.random() * 20;
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, width),
                buildingMats[Math.floor(Math.random() * buildingMats.length)]
            );
            building.position.set(
                -2000 + Math.random() * 800,
                height / 2,
                -1500 + Math.random() * 800
            );
            this.scene.add(building);
        }
    }

    update(dt, playerPos) {
        // Двигаем облака
        for (const cloud of this.clouds) {
            cloud.mesh.position.x += cloud.speed * dt;
            if (cloud.mesh.position.x > 10000) {
                cloud.mesh.position.x = -10000;
            }
        }

        // Скайбокс следует за камерой
        if (this.skyMesh) {
            this.skyMesh.position.copy(playerPos);
        }
    }
}
