/**
 * Модуль создания 3D-моделей самолётов из примитивов
 */

class AircraftModel {
    constructor(type) {
        this.type = type;
        this.group = new THREE.Group();
        this.propeller = null;
        this.aileronLeft = null;
        this.aileronRight = null;
        this.elevator = null;
        this.rudder = null;
        this.lights = [];

        this.build(type);
    }

    build(type) {
        switch (type) {
            case 'cessna': this.buildCessna(); break;
            case 'fighter': this.buildFighter(); break;
            case 'airliner': this.buildAirliner(); break;
            default: this.buildCessna();
        }
    }

    buildCessna() {
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, flatShading: true });
        const wingMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, flatShading: true });
        const accentMat = new THREE.MeshPhongMaterial({ color: 0x2255aa, flatShading: true });
        const glassMat = new THREE.MeshPhongMaterial({ 
            color: 0x88ccff, transparent: true, opacity: 0.5, flatShading: true 
        });
        const darkMat = new THREE.MeshPhongMaterial({ color: 0x333333, flatShading: true });

        // Фюзеляж
        const fuselage = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 1.0, 5.0),
            bodyMat
        );
        fuselage.position.set(0, 0, 0);
        this.group.add(fuselage);

        // Нос (конус)
        const nose = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1.5, 8),
            accentMat
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0, -3.5);
        this.group.add(nose);

        // Кабина
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.7, 1.2),
            glassMat
        );
        cabin.position.set(0, 0.6, -0.5);
        this.group.add(cabin);

        // Крылья
        const wingGeo = new THREE.BoxGeometry(11, 0.12, 1.5);
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, 0.15, -0.3);
        this.group.add(wing);

        // Стойки крыла
        const strutGeo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        const strutMat = darkMat;
        for (let side = -1; side <= 1; side += 2) {
            const strut = new THREE.Mesh(strutGeo, strutMat);
            strut.position.set(side * 2.5, -0.3, -0.3);
            strut.rotation.z = side * 0.15;
            this.group.add(strut);
        }

        // Хвостовое оперение
        const tailFin = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.5, 1.0),
            accentMat
        );
        tailFin.position.set(0, 0.8, 2.2);
        this.group.add(tailFin);

        const tailWing = new THREE.Mesh(
            new THREE.BoxGeometry(3.5, 0.08, 0.8),
            wingMat
        );
        tailWing.position.set(0, 0.05, 2.3);
        this.group.add(tailWing);

        // Хвост (сужение)
        const tailBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.6, 2.5),
            bodyMat
        );
        tailBody.position.set(0, 0.1, 2.0);
        tailBody.scale.set(1, 1, 1);
        this.group.add(tailBody);

        // Пропеллер
        const propGroup = new THREE.Group();
        const blade1 = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.15, 0.1),
            darkMat
        );
        const blade2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 2.0, 0.1),
            darkMat
        );
        propGroup.add(blade1);
        propGroup.add(blade2);
        propGroup.position.set(0, 0, -4.2);
        this.propeller = propGroup;
        this.group.add(propGroup);

        // Шасси
        this.buildGear(darkMat);

        // Полосы на фюзеляже
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(1.02, 0.15, 5.02),
            accentMat
        );
        stripe.position.set(0, -0.15, 0);
        this.group.add(stripe);

        // Огни
        this.addNavigationLights();
    }

    buildFighter() {
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x555566, flatShading: true });
        const wingMat = new THREE.MeshPhongMaterial({ color: 0x444455, flatShading: true });
        const cockpitMat = new THREE.MeshPhongMaterial({ 
            color: 0x88ccff, transparent: true, opacity: 0.4, flatShading: true 
        });
        const darkMat = new THREE.MeshPhongMaterial({ color: 0x222222, flatShading: true });
        const engineMat = new THREE.MeshPhongMaterial({ color: 0x333344, flatShading: true });

        // Фюзеляж
        const fuselage = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 7.0),
            bodyMat
        );
        this.group.add(fuselage);

        // Нос (острый)
        const nose = new THREE.Mesh(
            new THREE.ConeGeometry(0.55, 3.0, 6),
            bodyMat
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0, -5.0);
        this.group.add(nose);

        // Кабина
        const cabin = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
            cockpitMat
        );
        cabin.position.set(0, 0.5, -2.0);
        cabin.scale.set(1, 0.7, 1.5);
        this.group.add(cabin);

        // Дельтовидные крылья
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.lineTo(5, 1.5);
        wingShape.lineTo(5, 2);
        wingShape.lineTo(0, 3.5);
        wingShape.closePath();

        const wingExtrudeSettings = { depth: 0.08, bevelEnabled: false };
        
        for (let side = -1; side <= 1; side += 2) {
            const wing = new THREE.Mesh(
                new THREE.BoxGeometry(5, 0.1, 2.5),
                wingMat
            );
            wing.position.set(side * 2.8, -0.1, 0.5);
            // Скос
            if (side === 1) {
                wing.geometry.vertices && wing.geometry.vertices.forEach(v => {
                    if (v.x > 0) v.z -= 0.5;
                });
            }
            this.group.add(wing);
        }

        // Хвостовые стабилизаторы (2 наклонных)
        for (let side = -1; side <= 1; side += 2) {
            const vStab = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 1.5, 1.5),
                wingMat
            );
            vStab.position.set(side * 0.8, 0.7, 2.8);
            vStab.rotation.z = side * 0.3;
            this.group.add(vStab);
        }

        // Сопло двигателя
        const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.5, 1.5, 8),
            engineMat
        );
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(0, 0, 4.0);
        this.group.add(nozzle);

        // Форсажное свечение
        const afterburner = new THREE.Mesh(
            new THREE.ConeGeometry(0.35, 2.0, 8),
            new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 })
        );
        afterburner.rotation.x = -Math.PI / 2;
        afterburner.position.set(0, 0, 5.5);
        afterburner.visible = false;
        afterburner.name = 'afterburner';
        this.group.add(afterburner);

        // Шасси
        this.buildGear(darkMat);
        this.addNavigationLights();
    }

    buildAirliner() {
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, flatShading: true });
        const wingMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, flatShading: true });
        const accentMat = new THREE.MeshPhongMaterial({ color: 0x1155cc, flatShading: true });
        const glassMat = new THREE.MeshPhongMaterial({ 
            color: 0x88ccff, transparent: true, opacity: 0.4, flatShading: true 
        });
        const darkMat = new THREE.MeshPhongMaterial({ color: 0x333333, flatShading: true });
        const engineMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });

        // Фюзеляж (длинный цилиндр)
        const fuselage = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.5, 14, 12),
            bodyMat
        );
        fuselage.rotation.x = Math.PI / 2;
        this.group.add(fuselage);

        // Нос
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            bodyMat
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0, -7);
        this.group.add(nose);

        // Кабина пилотов
        const cockpit = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 1.0),
            glassMat
        );
        cockpit.position.set(0, 0.5, -6.5);
        this.group.add(cockpit);

        // Хвост (конус)
        const tail = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 4, 12),
            bodyMat
        );
        tail.rotation.x = -Math.PI / 2;
        tail.position.set(0, 0, 9);
        this.group.add(tail);

        // Крылья
        for (let side = -1; side <= 1; side += 2) {
            const wing = new THREE.Mesh(
                new THREE.BoxGeometry(16, 0.2, 3),
                wingMat
            );
            wing.position.set(side * 8.5, -0.5, 0);
            this.group.add(wing);
        }

        // Двигатели под крыльями
        for (let side = -1; side <= 1; side += 2) {
            const engine = new THREE.Mesh(
                new THREE.CylinderGeometry(0.6, 0.7, 2.5, 8),
                engineMat
            );
            engine.rotation.x = Math.PI / 2;
            engine.position.set(side * 5, -1.2, -0.5);
            this.group.add(engine);

            // Пилон
            const pylon = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.7, 1.5),
                darkMat
            );
            pylon.position.set(side * 5, -0.8, -0.5);
            this.group.add(pylon);
        }

        // Вертикальный стабилизатор
        const vStab = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 4, 3),
            accentMat
        );
        vStab.position.set(0, 2.5, 7.5);
        this.group.add(vStab);

        // Горизонтальный стабилизатор
        const hStab = new THREE.Mesh(
            new THREE.BoxGeometry(7, 0.1, 1.8),
            wingMat
        );
        hStab.position.set(0, 0.8, 8.5);
        this.group.add(hStab);

        // Полоса на фюзеляже
        const stripe = new THREE.Mesh(
            new THREE.CylinderGeometry(1.52, 1.52, 14, 12, 1, true, -0.2, 0.4),
            accentMat
        );
        stripe.rotation.x = Math.PI / 2;
        this.group.add(stripe);

        // Шасси
        this.buildGear(darkMat);
        this.addNavigationLights();
    }

    buildGear(darkMat) {
        const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
        const strutGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);

        // Переднее
        const frontStrut = new THREE.Mesh(strutGeo, darkMat);
        frontStrut.position.set(0, -0.8, -2);
        this.group.add(frontStrut);
        const frontWheel = new THREE.Mesh(wheelGeo, darkMat);
        frontWheel.rotation.x = Math.PI / 2;
        frontWheel.position.set(0, -1.1, -2);
        this.group.add(frontWheel);

        // Основные
        for (let side = -1; side <= 1; side += 2) {
            const strut = new THREE.Mesh(strutGeo, darkMat);
            strut.position.set(side * 1.0, -0.8, 0.5);
            this.group.add(strut);
            const wheel = new THREE.Mesh(wheelGeo, darkMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(side * 1.0, -1.1, 0.5);
            this.group.add(wheel);
        }
    }

    addNavigationLights() {
        // Красный — левый
        const redLight = new THREE.PointLight(0xff0000, 0.5, 20);
        redLight.position.set(-5.5, 0.2, 0);
        this.group.add(redLight);

        // Зелёный — правый
        const greenLight = new THREE.PointLight(0x00ff00, 0.5, 20);
        greenLight.position.set(5.5, 0.2, 0);
        this.group.add(greenLight);

        // Белый — хвост
        const whiteLight = new THREE.PointLight(0xffffff, 0.3, 15);
        whiteLight.position.set(0, 0, 3);
        this.group.add(whiteLight);
    }

    update(throttle, dt) {
        // Вращение пропеллера
        if (this.propeller) {
            this.propeller.rotation.z += throttle * 50 * dt;
        }

        // Форсаж для истребителя
        const afterburner = this.group.getObjectByName('afterburner');
        if (afterburner) {
            afterburner.visible = throttle > 0.8;
            if (afterburner.visible) {
                afterburner.scale.set(
                    0.8 + Math.random() * 0.4,
                    0.8 + Math.random() * 0.4,
                    0.8 + Math.random() * 0.3
                );
            }
        }
    }
}
