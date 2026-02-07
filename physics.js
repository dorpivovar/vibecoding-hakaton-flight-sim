/**
 * Модуль физики полёта
 * Реализует аэродинамическую модель с подъёмной силой, сопротивлением,
 * тягой, гравитацией, моментами вращения и эффектами атмосферы
 */

class FlightPhysics {
    constructor() {
        // Физические константы
        this.GRAVITY = 9.81;           // м/с²
        this.AIR_DENSITY_SEA = 1.225;  // кг/м³ на уровне моря
        this.SCALE_HEIGHT = 8500;      // м — масштабная высота атмосферы

        // Состояние самолёта
        this.position = new THREE.Vector3(0, 500, 0);
        this.velocity = new THREE.Vector3(0, 0, -50); // начальная скорость вперёд
        this.acceleration = new THREE.Vector3();

        // Ориентация через кватернион
        this.quaternion = new THREE.Quaternion();
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

        // Угловые скорости (рад/с)
        this.angularVelocity = new THREE.Vector3(0, 0, 0); // pitch, yaw, roll

        // Управление
        this.throttle = 0.3;      // 0..1
        this.pitchInput = 0;      // -1..1
        this.rollInput = 0;       // -1..1
        this.yawInput = 0;        // -1..1
        this.flapAngle = 0;       // 0, 10, 20, 30 градусов
        this.gearDown = true;
        this.airBrake = false;

        // Параметры самолёта (по умолчанию Cessna 172)
        this.aircraft = null;
        this.setAircraft('cessna');

        // Расчётные величины
        this.airspeed = 0;         // м/с
        this.groundSpeed = 0;      // м/с
        this.verticalSpeed = 0;    // м/с
        this.angleOfAttack = 0;    // рад
        this.sideSlip = 0;         // рад
        this.gForce = 1.0;
        this.machNumber = 0;
        this.isStalling = false;
        this.isOverspeed = false;
        this.isCrashed = false;
        this.onGround = false;

        // Ветер
        this.wind = new THREE.Vector3(0, 0, 0);
        this.turbulenceIntensity = 0;

        // Вспомогательные векторы (чтобы не создавать в цикле)
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3();
        this._liftDir = new THREE.Vector3();
        this._dragDir = new THREE.Vector3();
        this._airVelocity = new THREE.Vector3();
        this._force = new THREE.Vector3();
        this._torque = new THREE.Vector3();
        this._tempVec = new THREE.Vector3();
        this._tempQuat = new THREE.Quaternion();
        this._prevAccel = new THREE.Vector3();
    }

    setAircraft(type) {
        const aircraftData = {
            cessna: {
                name: 'Cessna 172',
                mass: 1100,                  // кг
                wingArea: 16.2,              // м²
                wingSpan: 11.0,              // м
                aspectRatio: 7.5,
                maxThrust: 3500,             // Н
                stallSpeed: 28,              // м/с (≈100 км/ч)
                maxSpeed: 63,               // м/с (≈226 км/ч)
                neverExceedSpeed: 80,        // м/с (≈288 км/ч)
                serviceCeiling: 4100,        // м
                clMax: 1.6,
                cl0: 0.3,
                clAlpha: 5.5,               // ∂CL/∂α per rad
                cd0: 0.032,                 // паразитное сопротивление
                cdInduced: 0.055,           // коэф. индуктивного сопротивления
                pitchRate: 1.2,             // рад/с максимально
                rollRate: 1.8,
                yawRate: 0.6,
                pitchDamping: 3.0,
                rollDamping: 4.0,
                yawDamping: 2.5,
                pitchStability: 0.5,
                rollStability: 0.3,
                yawStability: 0.4,
                flapClBonus: 0.4,           // доп подъёмная сила на 10° закрылков
                flapCdPenalty: 0.015,
                gearDrag: 0.02,
                brakeDrag: 0.06,
                maxGForce: 3.8,
                engineResponse: 2.0,        // скорость отклика тяги
                size: { fuselage: 3.5, wingspan: 5.5 }
            },
            fighter: {
                name: 'F-16 Falcon',
                mass: 9200,
                wingArea: 27.87,
                wingSpan: 9.96,
                aspectRatio: 3.56,
                maxThrust: 76000,
                stallSpeed: 55,
                maxSpeed: 590,              // ~2120 км/ч
                neverExceedSpeed: 650,
                serviceCeiling: 15000,
                clMax: 1.2,
                cl0: 0.15,
                clAlpha: 4.0,
                cd0: 0.022,
                cdInduced: 0.12,
                pitchRate: 3.5,
                rollRate: 5.0,
                yawRate: 1.5,
                pitchDamping: 2.5,
                rollDamping: 3.0,
                yawDamping: 2.0,
                pitchStability: 0.3,
                rollStability: 0.15,
                yawStability: 0.3,
                flapClBonus: 0.2,
                flapCdPenalty: 0.01,
                gearDrag: 0.01,
                brakeDrag: 0.08,
                maxGForce: 9.0,
                engineResponse: 4.0,
                size: { fuselage: 5, wingspan: 5 }
            },
            airliner: {
                name: 'Boeing 737',
                mass: 45000,
                wingArea: 125,
                wingSpan: 35.8,
                aspectRatio: 9.45,
                maxThrust: 220000,
                stallSpeed: 60,
                maxSpeed: 243,              // ~876 км/ч
                neverExceedSpeed: 280,
                serviceCeiling: 12500,
                clMax: 2.2,
                cl0: 0.35,
                clAlpha: 5.8,
                cd0: 0.025,
                cdInduced: 0.04,
                pitchRate: 0.6,
                rollRate: 0.5,
                yawRate: 0.3,
                pitchDamping: 4.0,
                rollDamping: 5.0,
                yawDamping: 3.5,
                pitchStability: 0.8,
                rollStability: 0.6,
                yawStability: 0.7,
                flapClBonus: 0.5,
                flapCdPenalty: 0.02,
                gearDrag: 0.015,
                brakeDrag: 0.05,
                maxGForce: 2.5,
                engineResponse: 1.0,
                size: { fuselage: 8, wingspan: 18 }
            }
        };

        this.aircraft = aircraftData[type] || aircraftData.cessna;
        this.currentThrust = this.throttle * this.aircraft.maxThrust;
    }

    /**
     * Плотность воздуха на заданной высоте (барометрическая формула)
     */
    getAirDensity(altitude) {
        const h = Math.max(0, altitude);
        return this.AIR_DENSITY_SEA * Math.exp(-h / this.SCALE_HEIGHT);
    }

    /**
     * Скорость звука на высоте (упрощённая модель)
     */
    getSpeedOfSound(altitude) {
        const tempKelvin = 288.15 - 0.0065 * Math.min(altitude, 11000);
        return Math.sqrt(1.4 * 287 * Math.max(tempKelvin, 216.65));
    }

    /**
     * Коэффициент подъёмной силы
     */
    getLiftCoefficient(aoa) {
        const ac = this.aircraft;
        const aoaDeg = aoa * 180 / Math.PI;
        const stallAngle = 15; // градусов
        const flapBonus = (this.flapAngle / 10) * ac.flapClBonus;

        if (Math.abs(aoaDeg) < stallAngle) {
            // Линейная область
            let cl = ac.cl0 + ac.clAlpha * aoa + flapBonus;
            return THREE.MathUtils.clamp(cl, -ac.clMax, ac.clMax + flapBonus);
        } else {
            // Область сваливания — резкое падение подъёмной силы
            this.isStalling = true;
            const excess = (Math.abs(aoaDeg) - stallAngle) / 10;
            const stallFactor = Math.max(0.1, 1 - excess * 0.8);
            const sign = aoaDeg > 0 ? 1 : -1;
            return sign * (ac.clMax + flapBonus) * stallFactor;
        }
    }

    /**
     * Коэффициент лобового сопротивления
     */
    getDragCoefficient(cl) {
        const ac = this.aircraft;
        const flapDrag = (this.flapAngle / 10) * ac.flapCdPenalty;
        const gearDrag = this.gearDown ? ac.gearDrag : 0;
        const brakeDrag = this.airBrake ? ac.brakeDrag : 0;

        // Drag polar: CD = CD0 + CL²/(π·e·AR) + доп. сопротивления
        const e = 0.8; // коэффициент Освальда
        const induced = (cl * cl) / (Math.PI * e * ac.aspectRatio);
        
        // Волновое сопротивление на околозвуковых скоростях
        let waveDrag = 0;
        if (this.machNumber > 0.75) {
            waveDrag = 0.1 * Math.pow(this.machNumber - 0.75, 2);
        }

        return ac.cd0 + induced + flapDrag + gearDrag + brakeDrag + waveDrag;
    }

    /**
     * Главный шаг физики
     */
    update(dt) {
        if (this.isCrashed) return;

        // Ограничиваем dt для стабильности
        dt = Math.min(dt, 0.05);
        const ac = this.aircraft;

        // === Локальные оси самолёта ===
        this._forward.set(0, 0, -1).applyQuaternion(this.quaternion);
        this._right.set(1, 0, 0).applyQuaternion(this.quaternion);
        this._up.set(0, 1, 0).applyQuaternion(this.quaternion);

        // === Вектор воздушной скорости ===
        this._airVelocity.copy(this.velocity).sub(this.wind);
        this.airspeed = this._airVelocity.length();
        this.groundSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        this.verticalSpeed = this.velocity.y;

        // Число Маха
        const sos = this.getSpeedOfSound(this.position.y);
        this.machNumber = this.airspeed / sos;

        // Предупреждения
        this.isOverspeed = this.airspeed > ac.neverExceedSpeed;
        this.isStalling = false;

        // === Угол атаки и скольжения ===
        if (this.airspeed > 1) {
            const localVel = this._airVelocity.clone();
            // Переводим скорость в локальные координаты
            const invQuat = this._tempQuat.copy(this.quaternion).invert();
            localVel.applyQuaternion(invQuat);

            // Угол атаки (pitch relative to velocity)
            this.angleOfAttack = Math.atan2(-localVel.y, -localVel.z);
            // Угол скольжения (yaw relative to velocity)
            this.sideSlip = Math.atan2(localVel.x, -localVel.z);
        } else {
            this.angleOfAttack = 0;
            this.sideSlip = 0;
        }

        // === Аэродинамические силы ===
        const rho = this.getAirDensity(this.position.y);
        const qS = 0.5 * rho * this.airspeed * this.airspeed * ac.wingArea; // динамическое давление × площадь

        // Подъёмная сила
        const cl = this.getLiftCoefficient(this.angleOfAttack);
        const liftMagnitude = qS * cl;

        // Сопротивление
        const cd = this.getDragCoefficient(cl);
        const dragMagnitude = qS * cd;

        // Направление подъёмной силы (перпендикулярно скорости, в плоскости симметрии самолёта)
        this._liftDir.copy(this._up);
        if (this.airspeed > 1) {
            const velNorm = this._tempVec.copy(this._airVelocity).normalize();
            // Подъёмная сила перпендикулярна вектору скорости
            this._liftDir.crossVectors(velNorm, this._right).normalize();
            // Корректируем направление
            if (this._liftDir.dot(this._up) < 0) {
                this._liftDir.negate();
            }
        }

        // Направление сопротивления (противоположно скорости)
        if (this.airspeed > 1) {
            this._dragDir.copy(this._airVelocity).normalize().negate();
        } else {
            this._dragDir.set(0, 0, 0);
        }

        // === Тяга ===
        // Плавное изменение тяги
        const targetThrust = this.throttle * ac.maxThrust;
        this.currentThrust += (targetThrust - this.currentThrust) * dt * ac.engineResponse;

        // Тяга уменьшается с высотой (для поршневых двигателей)
        const altitudeFactor = ac.name === 'F-16 Falcon' ? 
            Math.max(0.3, 1 - this.position.y / 20000) : 
            Math.max(0.1, rho / this.AIR_DENSITY_SEA);
        const effectiveThrust = this.currentThrust * altitudeFactor;

        // === Суммирование сил ===
        this._force.set(0, 0, 0);

        // Подъёмная сила
        this._force.addScaledVector(this._liftDir, liftMagnitude);

        // Сопротивление
        this._force.addScaledVector(this._dragDir, dragMagnitude);

        // Тяга (вдоль оси самолёта)
        this._force.addScaledVector(this._forward, effectiveThrust);

        // Гравитация
        this._force.y -= ac.mass * this.GRAVITY;

        // Боковая сила (от скольжения)
        if (this.airspeed > 5) {
            const sideForce = -qS * 0.5 * this.sideSlip;
            this._force.addScaledVector(this._right, sideForce);
        }

        // === Ускорение ===
        this._prevAccel.copy(this.acceleration);
        this.acceleration.copy(this._force).divideScalar(ac.mass);

        // === Турбулентность ===
        if (this.turbulenceIntensity > 0 && this.airspeed > 10) {
            const turb = this.turbulenceIntensity * 2;
            this.acceleration.x += (Math.random() - 0.5) * turb;
            this.acceleration.y += (Math.random() - 0.5) * turb;
            this.acceleration.z += (Math.random() - 0.5) * turb;
        }

        // === G-нагрузка ===
        const totalAccel = this._tempVec.copy(this.acceleration);
        totalAccel.y += this.GRAVITY; // убираем гравитацию для расчёта G
        // G-нагрузка в локальной оси Y самолёта
        this.gForce = totalAccel.dot(this._up) / this.GRAVITY;

        // === Интегрирование (Verlet) ===
        this.velocity.addScaledVector(this.acceleration, dt);
        this.position.addScaledVector(this.velocity, dt);

        // === Угловые моменты и вращение ===
        this._torque.set(0, 0, 0);

        // Эффективность рулей зависит от скорости
        const controlEffectiveness = THREE.MathUtils.clamp(
            (this.airspeed - 10) / (ac.stallSpeed * 0.8), 0, 1
        );
        const ce = controlEffectiveness * controlEffectiveness; // квадратичная зависимость

        // Тангаж (pitch) — вокруг оси X в локальных координатах
        const pitchTorque = this.pitchInput * ac.pitchRate * ce;
        const pitchDamping = -this.angularVelocity.x * ac.pitchDamping;
        // Продольная устойчивость — стремление к нулевому углу атаки
        const pitchStability = -this.angleOfAttack * ac.pitchStability * ce;
        this._torque.x = pitchTorque + pitchDamping + pitchStability;

        // Рыскание (yaw) — вокруг оси Y
        const yawTorque = this.yawInput * ac.yawRate * ce;
        const yawDamping = -this.angularVelocity.y * ac.yawDamping;
        // Флюгерная устойчивость
        const yawStability = -this.sideSlip * ac.yawStability * ce * 2;
        this._torque.y = yawTorque + yawDamping + yawStability;

        // Крен (roll) — вокруг оси Z
        const rollTorque = this.rollInput * ac.rollRate * ce;
        const rollDamping = -this.angularVelocity.z * ac.rollDamping;
        // Поперечная устойчивость — стремление к нулевому крену
        const currentRoll = this.euler.z;
        const rollStability = -Math.sin(currentRoll) * ac.rollStability * 0.3;
        this._torque.z = rollTorque + rollDamping + rollStability;

        // Связь крена и рыскания (adverse yaw & coordinated turn)
        if (Math.abs(this.euler.z) > 0.05 && this.airspeed > ac.stallSpeed * 0.5) {
            // В крене самолёт разворачивается
            this._torque.y += Math.sin(this.euler.z) * 0.3 * ce;
        }

        // При сваливании — случайные моменты
        if (this.isStalling && this.airspeed > 10) {
            this._torque.x += (Math.random() - 0.5) * 2.0;
            this._torque.z += (Math.random() - 0.5) * 3.0;
        }

        // Интегрируем угловые скорости
        this.angularVelocity.addScaledVector(this._torque, dt);

        // Применяем вращение через кватернион
        const rotQuat = this._tempQuat;
        const halfDt = dt * 0.5;
        
        // Pitch
        rotQuat.setFromAxisAngle(this._right, this.angularVelocity.x * dt);
        this.quaternion.premultiply(rotQuat);
        
        // Yaw
        rotQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.angularVelocity.y * dt);
        this.quaternion.premultiply(rotQuat);
        
        // Roll
        rotQuat.setFromAxisAngle(this._forward, this.angularVelocity.z * dt);
        this.quaternion.premultiply(rotQuat);
        
        this.quaternion.normalize();
        this.euler.setFromQuaternion(this.quaternion, 'YXZ');

        // === Взаимодействие с землёй ===
        const groundLevel = 0; // для ровного рельефа
        this.onGround = false;

        if (this.position.y <= groundLevel + 2) {
            // Проверяем условия посадки/краша
            const descentRate = -this.verticalSpeed;
            const pitch = this.euler.x * 180 / Math.PI;
            const roll = this.euler.z * 180 / Math.PI;

            if (this.position.y <= groundLevel + 0.5) {
                if (descentRate > 5 || Math.abs(roll) > 30 || pitch < -20) {
                    // Крушение!
                    this.crash();
                    return;
                }

                // Мягкая посадка / на земле
                this.onGround = true;
                this.position.y = groundLevel + 0.5;
                this.velocity.y = Math.max(0, this.velocity.y);

                // Трение на земле
                if (this.gearDown) {
                    const friction = this.airBrake ? 0.5 : 0.02;
                    this.velocity.x *= (1 - friction * dt);
                    this.velocity.z *= (1 - friction * dt);
                }

                // Выравнивание на земле
                const targetRoll = 0;
                const targetPitch = 0;
                this.euler.z += (targetRoll - this.euler.z) * dt * 2;
                if (this.airspeed < ac.stallSpeed * 0.5) {
                    this.euler.x += (targetPitch - this.euler.x) * dt * 1;
                }
                this.quaternion.setFromEuler(this.euler);
            }
        }

        // Ограничение по потолку
        if (this.position.y > ac.serviceCeiling * 1.2) {
            this.velocity.y = Math.min(this.velocity.y, 0);
        }
    }

    crash() {
        this.isCrashed = true;
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
    }

    reset() {
        this.position.set(0, 500, 0);
        this.velocity.set(0, 0, -50);
        this.acceleration.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.quaternion.identity();
        this.euler.set(0, 0, 0, 'YXZ');
        this.throttle = 0.3;
        this.flapAngle = 0;
        this.gearDown = true;
        this.airBrake = false;
        this.isCrashed = false;
        this.isStalling = false;
        this.currentThrust = this.throttle * this.aircraft.maxThrust;
    }

    // Геттеры для удобства
    getSpeedKmh() { return this.airspeed * 3.6; }
    getHeading() {
        let h = this.euler.y * 180 / Math.PI;
        h = ((h % 360) + 360) % 360;
        return h;
    }
    getPitchDeg() { return this.euler.x * 180 / Math.PI; }
    getRollDeg() { return this.euler.z * 180 / Math.PI; }
    getAoaDeg() { return this.angleOfAttack * 180 / Math.PI; }
}
