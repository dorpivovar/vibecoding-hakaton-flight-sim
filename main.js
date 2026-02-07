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

    const gameCanvas = document.getElementById('game-canvas');

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

        // === Тангаж ===
        if (keys['KeyW']) {
            physics.pitchInput = 1;
        } else if (keys['KeyS']) {
            physics.pitchInput = -1;
        } else {
            physics.pitchInput *= 0.85;
        }

        // === Крен ===
        if (keys['KeyA']) {
            physics.rollInput = -1;
        } else if (keys['KeyD']) {
            physics.rollInput = 1;
        } else {
            physics.rollInput *= 0.85;
        }

        // === Рыскание (клавиатура) ===
        if (keys['KeyQ']) {
            physics.yawInput = 1;
        } else if (keys['KeyE']) {
            physics.yawInput = -1;
        } else {
            physics.yawInput *= 0.85;
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

        // Скорость сглаживания: для быстрых самолётов — быстрее следуем
        const baseSmooth = 8;
        const speedBoost = THREE.MathUtils.clamp(physics.airspeed / 150, 0, 2);
        const smoothRate = baseSmooth + speedBoost * 6;

        switch (cameraMode) {
            case 0: // Chase camera
                // Позиция камеры — сзади и сверху самолёта
                targetPos.copy(pos)
                    .addScaledVector(forward, -18)
                    .addScaledVector(up, 5)
                    .add(new THREE.Vector3(0, 3, 0)); // немного абсолютного "вверх"
                
                lookTarget.copy(pos).addScaledVector(forward, 20);
                break;

            case 1: // Cockpit — камера жёстко привязана, без интерполяции
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

        // Кабинная камера — без сглаживания, жёсткая привязка
        if (cameraMode === 1) {
            camera.position.copy(targetPos);
            camera.lookAt(lookTarget);
        } else {
            // Плавное следование для chase и external
            const smoothFactor = 1 - Math.exp(-smoothRate * dt);
            if (!cameraInitialized) {
                smoothCamPos.copy(targetPos);
                smoothCamTarget.copy(lookTarget);
                cameraInitialized = true;
            } else {
                smoothCamPos.lerp(targetPos, smoothFactor);
                smoothCamTarget.lerp(lookTarget, smoothFactor);
            }

            // Защита от NaN / Infinity
            if (!isFinite(smoothCamPos.x)) smoothCamPos.copy(targetPos);
            if (!isFinite(smoothCamTarget.x)) smoothCamTarget.copy(lookTarget);

            camera.position.copy(smoothCamPos);
            camera.lookAt(smoothCamTarget);
        }

        // FOV зависит от скорости (мягкий эффект)
        const maxSpeedForFov = physics.aircraft ? physics.aircraft.maxSpeed : 200;
        const speedFov = THREE.MathUtils.clamp(physics.airspeed / maxSpeedForFov, 0, 1);
        camera.fov = THREE.MathUtils.lerp(65, 78, speedFov);
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
