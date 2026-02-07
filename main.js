/**
 * Главный модуль — инициализация, ввод, игровой цикл
 */

(function () {
    'use strict';

    // === Состояние ===
    let selectedAircraft = 'cessna';
    let isRunning = false;
    let isPaused = false;
    let cameraMode = 0; // 0: chase, 1: cockpit, 2: external

    // === Three.js ===
    let renderer, scene, camera;
    let physics, hud, world, aircraftModel;
    let clock;

    // === Управление ===
    const keys = {};
    const cameraOffset = new THREE.Vector3(0, 5, 18);
    const cockpitOffset = new THREE.Vector3(0, 1.2, -2);
    let externalAngle = 0;
    let externalElevation = 20;
    let externalDist = 30;

    // Плавное следование камеры
    let smoothCamPos = new THREE.Vector3();
    let smoothCamTarget = new THREE.Vector3();
    let cameraInitialized = false;

    // Управление мышью — подвижное перекрестье
    let crosshairX = 0;  // пиксели от центра
    let crosshairY = 0;  // пиксели от центра
    let pointerLocked = false;
    const mouseSensitivity = 1.5;         // чувствительность мыши
    const crosshairMaxRadius = 200;       // макс отклонение перекрестья в px
    const crosshairReturnSpeed = 1.5;     // скорость возврата к центру
    let crosshairElement = null;
    let crosshairLineElement = null;

    // === ЗАГРУЗКА ===
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const hudElement = document.getElementById('hud');

    function simulateLoading() {
        const messages = [
            'Инициализация двигателя...',
            'Загрузка аэродинамической модели...',
            'Калибровка приборов...',
            'Генерация рельефа...',
            'Расстановка облаков...',
            'Проверка систем...',
            'Всё готово!'
        ];

        let progress = 0;
        const interval = setInterval(() => {
            progress += 5 + Math.random() * 10;
            if (progress > 100) progress = 100;

            loadingBar.style.width = progress + '%';
            const msgIdx = Math.min(
                Math.floor((progress / 100) * messages.length),
                messages.length - 1
            );
            loadingText.textContent = messages[msgIdx];

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    startScreen.style.display = 'flex';
                }, 500);
            }
        }, 200);
    }

    // === ВЫБОР САМОЛЁТА ===
    document.querySelectorAll('.aircraft-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedAircraft = card.dataset.aircraft;
        });
    });

    // === КНОПКА СТАРТ ===
    document.getElementById('start-btn').addEventListener('click', () => {
        startScreen.style.display = 'none';
        hudElement.style.display = 'block';
        initGame();
    });

    // === ИНИЦИАЛИЗАЦИЯ ===
    function initGame() {
        // Renderer
        const canvas = document.getElementById('game-canvas');
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = false;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;

        // Scene
        scene = new THREE.Scene();

        // Camera
        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 20000);
        camera.position.set(0, 510, 20);

        // Physics
        physics = new FlightPhysics();
        physics.setAircraft(selectedAircraft);

        // HUD
        hud = new HUD();

        // World
        world = new World(scene);

        // Aircraft model
        aircraftModel = new AircraftModel(selectedAircraft);
        scene.add(aircraftModel.group);

        // Clock
        clock = new THREE.Clock();

        // Start
        isRunning = true;
        cameraInitialized = false;
        
        // Initial camera position
        smoothCamPos.copy(physics.position).add(cameraOffset);
        smoothCamTarget.copy(physics.position);

        gameLoop();
    }

    // === ВВОД ===
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        // Одноразовые нажатия
        if (e.code === 'KeyF') {
            physics.flapAngle = (physics.flapAngle + 10) % 40; // 0, 10, 20, 30
        }
        if (e.code === 'KeyG') {
            physics.gearDown = !physics.gearDown;
        }
        if (e.code === 'KeyB') {
            physics.airBrake = !physics.airBrake;
        }
        if (e.code === 'KeyV') {
            cameraMode = (cameraMode + 1) % 3;
        }
        if (e.code === 'KeyP') {
            isPaused = !isPaused;
            hud.showPause(isPaused);
        }
        if (e.code === 'KeyR') {
            physics.reset();
            hud.showCrash(false);
            isPaused = false;
            cameraInitialized = false;
        }

        e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // === Мышь — Pointer Lock + подвижное перекрестье ===
    const gameCanvas = document.getElementById('game-canvas');

    // Захват курсора при клике
    window.addEventListener('click', () => {
        if (isRunning && !pointerLocked) {
            gameCanvas.requestPointerLock();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        pointerLocked = (document.pointerLockElement === gameCanvas);
        if (!pointerLocked) {
            crosshairX = 0;
            crosshairY = 0;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (pointerLocked) {
            // Сдвигаем перекрестье по movementX/Y
            crosshairX += e.movementX * mouseSensitivity;
            crosshairY += e.movementY * mouseSensitivity;

            // Ограничиваем радиус
            const dist = Math.sqrt(crosshairX * crosshairX + crosshairY * crosshairY);
            if (dist > crosshairMaxRadius) {
                const scale = crosshairMaxRadius / dist;
                crosshairX *= scale;
                crosshairY *= scale;
            }
        }
    });

    // Скролл для внешней камеры
    window.addEventListener('wheel', (e) => {
        if (cameraMode === 2) {
            externalDist = THREE.MathUtils.clamp(externalDist + e.deltaY * 0.05, 10, 100);
        }
    });

    // Resize
    window.addEventListener('resize', () => {
        if (!renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // === ОБРАБОТКА УПРАВЛЕНИЯ ===
    function processInput(dt) {
        // Тяга
        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            physics.throttle = Math.min(1, physics.throttle + dt * 0.5);
        }
        if (keys['ControlLeft'] || keys['ControlRight']) {
            physics.throttle = Math.max(0, physics.throttle - dt * 0.5);
        }

        // Плавный возврат перекрестья к центру
        const returnFactor = 1 - Math.exp(-crosshairReturnSpeed * dt);
        crosshairX -= crosshairX * returnFactor;
        crosshairY -= crosshairY * returnFactor;

        // Нормализованные значения перекрестья: -1..1
        const normX = crosshairX / crosshairMaxRadius;
        const normY = crosshairY / crosshairMaxRadius;

        // === Тангаж ===
        if (keys['KeyW']) {
            physics.pitchInput = 1;
        } else if (keys['KeyS']) {
            physics.pitchInput = -1;
        } else if (Math.abs(normY) > 0.02) {
            physics.pitchInput = normY;
        } else {
            physics.pitchInput *= 0.85;
        }

        // === Крен ===
        if (keys['KeyA']) {
            physics.rollInput = -1;
        } else if (keys['KeyD']) {
            physics.rollInput = 1;
        } else if (Math.abs(normX) > 0.02) {
            physics.rollInput = -normX;
        } else {
            physics.rollInput *= 0.85;
        }

        // === Рыскание (клавиатура) ===
        if (keys['KeyQ']) {
            physics.yawInput = -1;
        } else if (keys['KeyE']) {
            physics.yawInput = 1;
        } else {
            physics.yawInput *= 0.85;
        }
    }

    // === ОБНОВЛЕНИЕ ПЕРЕКРЕСТЬЯ ===
    function updateCrosshair() {
        if (!crosshairElement) {
            crosshairElement = document.getElementById('hud-crosshair');
            crosshairLineElement = document.getElementById('crosshair-line');
        }
        if (!crosshairElement) return;

        // Позиция перекрестья на экране
        const cx = window.innerWidth / 2 + crosshairX;
        const cy = window.innerHeight / 2 + crosshairY;
        crosshairElement.style.left = cx + 'px';
        crosshairElement.style.top = cy + 'px';

        // Линия от центра к перекрестью
        if (crosshairLineElement) {
            const dist = Math.sqrt(crosshairX * crosshairX + crosshairY * crosshairY);
            const angle = Math.atan2(crosshairX, -crosshairY); // угол от центра
            crosshairLineElement.style.height = dist + 'px';
            crosshairLineElement.style.transform = `rotate(${angle}rad)`;
            crosshairLineElement.style.opacity = dist > 5 ? '1' : '0';
        }
    }

    // === КАМЕРА ===
    function updateCamera(dt) {
        const pos = physics.position;
        const quat = physics.quaternion;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

        let targetPos = new THREE.Vector3();
        let lookTarget = new THREE.Vector3();

        switch (cameraMode) {
            case 0: // Chase camera
                // Позиция камеры — сзади и сверху самолёта
                targetPos.copy(pos)
                    .addScaledVector(forward, -18)
                    .addScaledVector(up, 5)
                    .add(new THREE.Vector3(0, 3, 0)); // немного абсолютного "вверх"
                
                lookTarget.copy(pos).addScaledVector(forward, 20);
                break;

            case 1: // Cockpit
                targetPos.copy(pos)
                    .addScaledVector(up, 1.2)
                    .addScaledVector(forward, 1);
                
                lookTarget.copy(pos).addScaledVector(forward, 100);
                break;

            case 2: // External orbit
                const radH = externalAngle;
                const radV = externalElevation * Math.PI / 180;
                targetPos.set(
                    pos.x + Math.sin(radH) * Math.cos(radV) * externalDist,
                    pos.y + Math.sin(radV) * externalDist,
                    pos.z + Math.cos(radH) * Math.cos(radV) * externalDist
                );
                lookTarget.copy(pos);
                break;
        }

        // Плавное следование
        const smoothFactor = 1 - Math.exp(-8 * dt);
        if (!cameraInitialized) {
            smoothCamPos.copy(targetPos);
            smoothCamTarget.copy(lookTarget);
            cameraInitialized = true;
        } else {
            smoothCamPos.lerp(targetPos, smoothFactor);
            smoothCamTarget.lerp(lookTarget, smoothFactor);
        }

        camera.position.copy(smoothCamPos);
        camera.lookAt(smoothCamTarget);

        // FOV зависит от скорости (эффект скорости)
        const speedFov = THREE.MathUtils.clamp(physics.airspeed / 200, 0, 1);
        camera.fov = THREE.MathUtils.lerp(65, 85, speedFov);
        camera.updateProjectionMatrix();
    }

    // === ЭФФЕКТЫ ===
    function updateEffects() {
        // Изменение тумана с высотой
        if (scene.fog) {
            const altFactor = THREE.MathUtils.clamp(physics.position.y / 3000, 0, 1);
            scene.fog.density = THREE.MathUtils.lerp(0.00015, 0.00003, altFactor);
        }
    }

    // === ИГРОВОЙ ЦИКЛ ===
    function gameLoop() {
        if (!isRunning) return;
        requestAnimationFrame(gameLoop);

        const dt = Math.min(clock.getDelta(), 0.05);

        if (!isPaused && !physics.isCrashed) {
            processInput(dt);
            physics.update(dt);
        }

        // Обновляем модель самолёта
        aircraftModel.group.position.copy(physics.position);
        aircraftModel.group.quaternion.copy(physics.quaternion);
        aircraftModel.update(physics.throttle, dt);

        // Скрываем самолёт из кабины
        aircraftModel.group.visible = (cameraMode !== 1);

        // Камера
        updateCamera(dt);

        // Мир
        world.update(dt, physics.position);

        // Эффекты
        updateEffects();

        // HUD
        hud.update(physics);

        // Перекрестье
        updateCrosshair();

        // Крушение
        if (physics.isCrashed) {
            hud.showCrash(true);
        }

        // Рендер
        renderer.render(scene, camera);
    }

    // === ЗАПУСК ===
    simulateLoading();

})();
