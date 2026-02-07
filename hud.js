/**
 * Модуль обновления HUD — приборная панель
 */

class HUD {
    constructor() {
        this.compassCanvas = document.getElementById('compass-canvas');
        this.compassCtx = this.compassCanvas ? this.compassCanvas.getContext('2d') : null;
        
        // Кеш DOM элементов
        this.elements = {
            speed: document.getElementById('hud-speed'),
            altitude: document.getElementById('hud-altitude'),
            vspeed: document.getElementById('hud-vspeed'),
            heading: document.getElementById('hud-heading'),
            throttle: document.getElementById('hud-throttle'),
            throttleFill: document.getElementById('throttle-fill'),
            gforce: document.getElementById('hud-gforce'),
            pitch: document.getElementById('hud-pitch'),
            roll: document.getElementById('hud-roll'),
            aoa: document.getElementById('hud-aoa'),
            flaps: document.getElementById('status-flaps'),
            gear: document.getElementById('status-gear'),
            brake: document.getElementById('status-brake'),
            stall: document.getElementById('status-stall'),
            overspeed: document.getElementById('status-overspeed'),
            ground: document.getElementById('status-ground'),
            attitudeSky: document.getElementById('attitude-sky'),
            attitudeGround: document.getElementById('attitude-ground'),
            attitudeHorizon: document.getElementById('attitude-horizon'),
            bankPointer: document.getElementById('bank-pointer'),
            pauseOverlay: document.getElementById('pause-overlay'),
            crashOverlay: document.getElementById('crash-overlay'),
        };
    }

    update(physics) {
        const el = this.elements;

        // Основные показатели
        el.speed.textContent = Math.round(physics.getSpeedKmh());
        el.altitude.textContent = Math.round(physics.position.y);
        
        const vs = physics.verticalSpeed;
        el.vspeed.textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1);
        el.vspeed.style.color = vs < -5 ? '#ff6644' : vs > 5 ? '#44ff66' : '#00ffcc';

        const heading = Math.round(physics.getHeading());
        el.heading.textContent = String(heading).padStart(3, '0');

        // Тяга
        const throttlePct = Math.round(physics.throttle * 100);
        el.throttle.textContent = throttlePct + '%';
        el.throttleFill.style.width = throttlePct + '%';

        // G-нагрузка
        const gf = physics.gForce;
        el.gforce.textContent = gf.toFixed(1) + 'G';
        el.gforce.style.color = Math.abs(gf) > physics.aircraft.maxGForce * 0.8 ? '#ff4444' : '#00ffcc';

        // Углы
        el.pitch.textContent = physics.getPitchDeg().toFixed(1) + '°';
        el.roll.textContent = physics.getRollDeg().toFixed(1) + '°';
        el.aoa.textContent = physics.getAoaDeg().toFixed(1) + '°';
        el.aoa.style.color = Math.abs(physics.getAoaDeg()) > 12 ? '#ff8844' : '#00ffcc';

        // Статус
        el.flaps.textContent = `ЗАКРЫЛКИ: ${physics.flapAngle}°`;
        el.gear.textContent = `ШАССИ: ${physics.gearDown ? '▼' : '▲'}`;
        el.gear.style.color = physics.gearDown ? '#66ccaa' : '#ccaa66';
        el.brake.textContent = `ТОРМОЗ: ${physics.airBrake ? 'ВКЛ' : 'ВЫКЛ'}`;
        el.brake.style.color = physics.airBrake ? '#ff8844' : '#66ccaa';

        // Предупреждения
        el.stall.style.display = physics.isStalling ? 'block' : 'none';
        el.overspeed.style.display = physics.isOverspeed ? 'block' : 'none';
        el.ground.style.display = (physics.position.y < 50 && physics.verticalSpeed < -3) ? 'block' : 'none';

        // Авиагоризонт
        this.updateAttitudeIndicator(physics);

        // Компас
        this.updateCompass(heading);
    }

    updateAttitudeIndicator(physics) {
        const el = this.elements;
        const pitch = physics.getPitchDeg();
        const roll = physics.getRollDeg();

        // Смещение горизонта по тангажу (2px на градус)
        const pitchOffset = pitch * 2;
        const rollRad = -roll * Math.PI / 180;

        // Вращение всего индикатора по крену + смещение по тангажу
        const transform = `rotate(${-roll}deg) translateY(${pitchOffset}px)`;

        el.attitudeSky.style.transform = transform;
        el.attitudeGround.style.transform = transform;
        el.attitudeHorizon.style.transform = transform;

        // Указатель крена
        el.bankPointer.style.transform = `translateX(-50%) rotate(${-roll}deg)`;
    }

    updateCompass(heading) {
        if (!this.compassCtx) return;
        const ctx = this.compassCtx;
        const w = 400;
        const h = 40;

        ctx.clearRect(0, 0, w, h);

        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, w, h);

        const dirs = {
            0: 'N', 45: 'NE', 90: 'E', 135: 'SE',
            180: 'S', 225: 'SW', 270: 'W', 315: 'NW'
        };

        const centerX = w / 2;
        const pixelsPerDeg = 3;

        // Рисуем шкалу
        for (let deg = heading - 70; deg <= heading + 70; deg++) {
            const d = ((deg % 360) + 360) % 360;
            const x = centerX + (deg - heading) * pixelsPerDeg;

            if (x < 0 || x > w) continue;

            if (d % 10 === 0) {
                // Большие деления
                ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, h);
                ctx.lineTo(x, h - 12);
                ctx.stroke();

                // Числа
                ctx.fillStyle = 'rgba(0, 255, 200, 0.8)';
                ctx.font = '10px Courier New';
                ctx.textAlign = 'center';

                if (dirs[d]) {
                    ctx.fillStyle = '#ffaa00';
                    ctx.font = 'bold 12px Courier New';
                    ctx.fillText(dirs[d], x, 14);
                } else {
                    ctx.fillText(d.toString(), x, 14);
                }
            } else if (d % 5 === 0) {
                // Малые деления
                ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, h);
                ctx.lineTo(x, h - 6);
                ctx.stroke();
            }
        }

        // Центральный маркер
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(centerX - 5, 0);
        ctx.lineTo(centerX + 5, 0);
        ctx.lineTo(centerX, 6);
        ctx.closePath();
        ctx.fill();
    }

    showPause(show) {
        this.elements.pauseOverlay.style.display = show ? 'flex' : 'none';
    }

    showCrash(show) {
        this.elements.crashOverlay.style.display = show ? 'flex' : 'none';
    }
}
