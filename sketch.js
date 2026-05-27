(function () {
  const sketch = function (p) {

    let imgEyeOpen, imgEyeClosed, imgEyeWide;
    let imgIris = null;
    let imgHeart = null;

    let started       = false;
    let stage         = 0;
    let stageTimer    = 0;
    let idleTimer     = 0;
    let eyeSpawnAccum = 0;

    let lastMouseX = 0;
    let lastMouseY = 0;

    let tracePoints = [];
    let eyes        = [];
    let scars       = [];

    let revealActive    = false;
    let revealText      = '';
    let revealCountdown = 0;

    let revealIndex          = 0;
    let revealCycleTimer     = 0;
    let revealCycleShowing   = false;
    let revealCycleCountdown = 0;

    let heartbeatTimer = 0;
    let heartbeatFlash = 0;

    let heartActive       = false;
    let heartScale        = 0;
    let heartOpacity      = 0;
    let heartBeatScale    = 1;
    let heartBeatTimer    = 0;
    let heartBeatInterval = 1.4;
    let burstState        = 0;
    let burstTimer        = 0;
    let burstParticles    = [];
    let heartbeatSound    = null;
    let flatlineSound     = null;
    let shakeAmount       = 0;
    let ambientSound      = null;
    let muteBtn           = null;
    let muteBtnDodgeCount = 0;
    let muteBtnVisible    = false;
    let muteBtnTextShowing = false;
    let hintOpacity       = 0;
    let hintShown         = false;

    let bloodDrops   = [];
    let bloodPuddles = [];
    let bloodLevel   = 0;
    let bloodFilling = false;

    let endingActive    = false;
    let endingTimer     = 0;
    let endingPhase     = 0;
    const endingLines   = ['you were here', 'we counted every step', 'before you knew'];
    let endingLineIndex = 0;
    let endingLineTimer = 0;
    let endingFadeOpacity = 0;

    const STAGE_MESSAGES = ['', 'it found you', 'it remembers', 'it has always been here'];
    const CYCLE_MESSAGES = [
      'we have been counting',
      'every step was recorded',
      'you led it here',
      'it knew before you did'
    ];

    p.setup = function () {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.imageMode(p.CENTER);
      lastMouseX = p.mouseX;
      lastMouseY = p.mouseY;

      window.startSketch = function () {
        p.noCursor();
        imgEyeOpen   = htmlToP5(document.getElementById('img-eye-open'));
        imgEyeClosed = htmlToP5(document.getElementById('img-eye-closed'));
        imgEyeWide   = htmlToP5(document.getElementById('img-eye-wide'));
        imgIris      = htmlToP5(document.getElementById('img-iris'));
        imgHeart     = htmlToP5(document.getElementById('img-heart'));

        heartbeatSound = new Audio('sounds/heartbeat.mp3');
        heartbeatSound.volume = 0.75;

        flatlineSound = new Audio('sounds/flatline.mp3');
        flatlineSound.volume = 0.8;

        ambientSound = new Audio('sounds/ambient.mp3');
        ambientSound.loop = true;
        ambientSound.volume = 0.15;
        ambientSound.play().catch(() => {});

        muteBtn = document.getElementById('mute-btn');
        muteBtn.innerHTML = '<img src="images/mute.png" style="width:64px;height:64px;opacity:0.7;">';
        muteBtn.style.display = 'block';
        muteBtnVisible = true;

        muteBtn.addEventListener('mouseenter', function () {
          if (muteBtnDodgeCount >= 6 || !muteBtnVisible) return;
          muteBtnDodgeCount++;

          const margin = 80;
          const x = Math.random() * (window.innerWidth  - margin * 2) + margin;
          const y = Math.random() * (window.innerHeight - margin * 2) + margin;

          muteBtn.style.position = 'fixed';
          muteBtn.style.left   = x + 'px';
          muteBtn.style.top    = y + 'px';
          muteBtn.style.right  = 'auto';
          muteBtn.style.bottom = 'auto';

          if (muteBtnDodgeCount === 6) {
            setTimeout(() => {
              muteBtn.style.display = 'none';
              muteBtnVisible = false;
              muteBtnTextShowing = true;

              const revealEl = document.getElementById('reveal-text');
              const lineEl = document.getElementById('reveal-line');
              if (revealEl && lineEl) {
                revealEl.classList.remove('hidden');
                revealEl.classList.remove('show');
                lineEl.textContent = "you can't stop what you've already started";
                void revealEl.offsetWidth;
                revealEl.classList.add('show');
                setTimeout(() => {
                  muteBtnTextShowing = false;
                  revealEl.classList.remove('show');
                  revealEl.classList.add('hidden');
                }, 4000);
              }
            }, 100);
          }
        });

        started = true;
        spawnEye(p.width / 2, p.height / 2, true);
      };
    };

    function htmlToP5(el) {
      if (!el || !el.complete || !el.naturalWidth) return null;
      const g = p.createGraphics(el.naturalWidth, el.naturalHeight);
      g.drawingContext.drawImage(el, 0, 0);
      return g;
    }

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p.draw = function () {
      if (!started) {
        drawCursor();
        return;
      }

      const dt = p.deltaTime / 1000;

      p.background(0, 0, 0, 28);

      if (shakeAmount > 0) {
        p.translate(p.random(-shakeAmount, shakeAmount),
                    p.random(-shakeAmount, shakeAmount));
        shakeAmount *= 0.85;
      }

      const moved = p.dist(p.mouseX, p.mouseY, lastMouseX, lastMouseY) > 1.5;
      if (moved) {
        stageTimer    += dt;
        eyeSpawnAccum += dt;
        idleTimer      = 0;
        tracePoints.push({ x: p.mouseX, y: p.mouseY, age: 0, opacity: 180 });
      } else {
        idleTimer += dt;
      }
      lastMouseX = p.mouseX;
      lastMouseY = p.mouseY;

      checkStageTransitions();

      if (ambientSound) {
        let targetVol = 0.15;
        if (stage === 2) targetVol = 0.35;
        if (stage === 3) targetVol = 0.6;
        if (heartActive) targetVol = 0;
        ambientSound.volume += (targetVol - ambientSound.volume) * 0.02;
      }

      for (let i = tracePoints.length - 1; i >= 0; i--) {
        const tp = tracePoints[i];
        tp.age     += dt;
        tp.opacity -= dt * 55;
        if (tp.opacity < 12) tp.opacity = 12;
        if (tp.age > 30) tracePoints.splice(i, 1);
      }

      for (const s of scars) {
        if (s.rippleOpacity > 0) {
          s.rippleR       += dt * 18;
          s.rippleOpacity -= dt * 25;
          if (s.rippleOpacity < 0) s.rippleOpacity = 0;
        }
      }

      drawTrace();
      drawScars();
      drawEyes(dt);

      updateBurst(dt);
      drawBurstParticles(dt);

      drawVignette();

      if (!heartActive) {
        updateHeartbeat(dt);
        drawHeartbeatFlash();
      }

      if (idleTimer > 10 && !heartActive) {
        const pulse = Math.sin(p.millis() * 0.001) * 0.5 + 0.5;
        p.noStroke();
        p.fill(0, 0, 0, 30 * pulse);
        p.rect(0, 0, p.width, p.height);
      }

      if (heartActive || bloodLevel > 0) drawBlood(dt);
      if (heartActive) drawHeart(dt);
      updateEnding(dt);

      drawCursor();
      drawHint(dt);
      handleReveal(dt);
    };

    p.keyPressed = function () {
      if (!started) return;
      if (p.key === 'h' || p.key === 'H') {
        eyes = [];
        burstState   = 3;
        heartActive  = true;
        heartScale   = 0.2;
        heartOpacity = 0;
        bloodFilling = true;
        playHeartbeat();
      }
    };

    p.mouseClicked = function () {
      if (heartActive) {
        const d = p.dist(p.mouseX, p.mouseY, p.width / 2, p.height / 2);
        if (d < 200 * heartScale) {
          heartBeatInterval = p.max(0.3, heartBeatInterval - 0.08);
          heartBeatScale    = 1.4;
          playHeartbeat();
        }
        return;
      }
      if (!started) return;

      if (stage === 3 && eyes.length > 0 && burstState === 0) {
        const e = eyes[0];
        const d = p.dist(p.mouseX, p.mouseY, e.x, e.y);
        if (d < e.baseW * e.scale * 0.5) {
          burstState = 1;
          burstTimer = 0;
          return;
        }
      }

      if (stage >= 3) return;

      spawnEye(p.mouseX, p.mouseY, false);
      scars.push({ x: p.mouseX, y: p.mouseY, time: p.millis(), rippleR: 0, rippleOpacity: 120 });
    };

    function checkStageTransitions() {
      if      (stageTimer >= 15 && stage < 3) enterStage3();
      else if (stageTimer >= 8  && stage < 2) enterStage2();
      else if (stageTimer >  0  && stage < 1) { stage = 1; triggerReveal(STAGE_MESSAGES[1]); }
    }

    function enterStage2() {
      stage = 2;
      triggerReveal(STAGE_MESSAGES[2]);
    }

    function enterStage3() {
      stage = 3;
      if (eyes.length > 0) {
        eyes[0].x = p.width  / 2;
        eyes[0].y = p.height / 2;
      }
      triggerReveal('it knew before you did');
    }

    function triggerReveal(text) {
      revealText      = text;
      revealActive    = true;
      revealCountdown = 6;
    }

    function updateHeartbeat(dt) {
      heartbeatTimer += dt;
      const period = stage >= 3 ? 0.75 : stage >= 2 ? 1.05 : 1.5;
      const ht = heartbeatTimer % period;

      if (ht < 0.04) {
        heartbeatFlash = p.map(ht, 0, 0.04, 0, 1);
      } else if (ht < 0.13) {
        heartbeatFlash = p.map(ht, 0.04, 0.13, 1, 0.22);
      } else if (ht < 0.19) {
        heartbeatFlash = p.map(ht, 0.13, 0.19, 0.22, 0.72);
      } else if (ht < 0.33) {
        heartbeatFlash = p.map(ht, 0.19, 0.33, 0.72, 0);
      } else {
        heartbeatFlash = 0;
      }
    }

    function drawHeartbeatFlash() {
      if (heartbeatFlash <= 0) return;
      const maxAlpha = stage >= 3 ? 70 : stage >= 2 ? 52 : 38;
      p.noStroke();
      p.fill(160, 0, 0, heartbeatFlash * maxAlpha);
      p.rect(0, 0, p.width, p.height);
    }

    function drawVignette() {
      const ctx = p.drawingContext;
      const cx  = p.width  / 2;
      const cy  = p.height / 2;
      const inner = Math.min(cx, cy) * 0.35;
      const outer = Math.max(cx, cy) * 1.55;

      const alpha = stage >= 3 ? 0.92 : idleTimer > 10 ? 0.82 : 0.72;

      const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      grad.addColorStop(0,   'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0)');
      grad.addColorStop(1,   `rgba(0,0,0,${alpha})`);

      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, p.width, p.height);
      ctx.restore();
    }

    function playHeartbeat() {
      if (!heartbeatSound) return;
      heartbeatSound.currentTime = 0;
      heartbeatSound.play().catch(() => {});
    }

    function updateBurst(dt) {
      if (burstState === 0) return;

      if (burstState === 1) {
        burstTimer += dt;
        if (eyes.length > 0) {
          eyes[0].targetScale = 18 + Math.sin(burstTimer * 30) * 5;
          eyes[0].scale = eyes[0].targetScale;
        }
        heartbeatFlash = Math.abs(Math.sin(burstTimer * 25)) * 0.6;

        shakeAmount = (burstTimer / 3.0) * 8;

        if (burstTimer >= 3.0) {
          burstState = 2;
          burstTimer = 0;
          if (eyes.length > 0) {
            const ex = eyes[0].x;
            const ey = eyes[0].y;
            for (let i = 0; i < 40; i++) {
              const angle = p.random(p.TWO_PI);
              const speed = p.random(250, 700);
              burstParticles.push({
                x: ex, y: ey,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                opacity: 255,
                size: p.random(6, 28),
                rotation: p.random(p.TWO_PI)
              });
            }
          }
        }
        return;
      }

      if (burstState === 2) {
        burstTimer += dt;
        p.noStroke();
        p.fill(255, 255, 255, p.map(burstTimer, 0, 0.15, 220, 0, true));
        p.rect(0, 0, p.width, p.height);
        p.fill(139, 0, 0, p.map(burstTimer, 0.1, 0.35, 160, 0, true));
        p.rect(0, 0, p.width, p.height);

        if (eyes.length > 0) eyes[0].opacity -= dt * 800;

        if (burstTimer >= 0.35) {
          eyes = [];
          burstState   = 3;
          burstTimer   = 0;
          heartActive  = true;
          heartScale   = 0.2;
          heartOpacity = 0;
          bloodFilling = true;
          playHeartbeat();
        }
        return;
      }

      if (burstState === 3) {
        burstTimer += dt;
      }
    }

    function drawBurstParticles(dt) {
      if (burstParticles.length === 0) return;
      for (let i = burstParticles.length - 1; i >= 0; i--) {
        const bp = burstParticles[i];
        bp.x       += bp.vx * dt;
        bp.y       += bp.vy * dt;
        bp.vy      += 200 * dt;
        bp.opacity -= dt * 80;
        if (bp.opacity <= 0) {
          burstParticles.splice(i, 1);
          continue;
        }
        p.push();
        p.translate(bp.x, bp.y);
        p.rotate(bp.rotation);
        p.noStroke();
        p.fill(120, 0, 0, bp.opacity);
        p.ellipse(0, 0, bp.size, bp.size * 0.3);
        p.pop();
      }
    }

    function drawHeart(dt) {
      heartOpacity = Math.min(255, heartOpacity + dt * 45);
      heartScale  += (1.0 - heartScale) * dt * 2.0;

      heartBeatTimer += dt;
      if (heartBeatTimer >= heartBeatInterval) {
        heartBeatTimer    = 0;
        heartBeatScale    = 1.28;
        heartBeatInterval = Math.max(0.65, heartBeatInterval - 0.012);
        playHeartbeat();
        spawnBlood();
      }
      heartBeatScale += (1.0 - heartBeatScale) * dt * 7;

      const isSmallScreen = p.width < 1600;
      const baseSize = isSmallScreen
        ? Math.min(p.width * 0.28, p.height * 0.38)
        : 1100;
      const fs = heartScale * heartBeatScale;
      const hw = baseSize * fs;
      const hh = baseSize * 1.2 * fs;

      if (imgHeart) {
        p.tint(255, heartOpacity);
        p.image(imgHeart, p.width / 2, p.height / 2, hw, hh);
        p.noTint();
      } else {
        p.noStroke();
        p.fill(180, 0, 0, heartOpacity);
        p.ellipse(p.width / 2, p.height / 2, hw * 0.8, hh * 0.8);
      }
    }

    function spawnBlood() {
      const count = Math.floor(p.random(3, 7));
      for (let i = 0; i < count; i++) {
        const angle = p.random(p.PI * 0.1, p.PI * 0.9);
        const rx = 220 * heartScale * heartBeatScale;
        const ry = 280 * heartScale * heartBeatScale;

        const edgeX = p.width  / 2 + Math.cos(angle) * rx * p.random(0.6, 1.0);
        const edgeY = p.height / 2 + Math.sin(angle) * ry * p.random(0.6, 1.0);

        bloodDrops.push({
          x: edgeX,
          y: edgeY,
          vx: p.random(-25, 25),
          vy: p.random(60, 180),
          size: p.random(8, 22),
          opacity: p.random(180, 255),
          wobble: p.random(p.TWO_PI),
          settled: false
        });
      }
      if (bloodDrops.length > 40) bloodDrops.splice(0, bloodDrops.length - 40);
    }

    function drawBlood(dt) {
      if (bloodLevel > 0) {
        const poolY = p.height - (bloodLevel * p.height);
        p.noStroke();

        p.fill(50, 0, 0, 230);
        p.rect(0, poolY + 35, p.width, p.height);

        for (let x = -60; x < p.width + 60; x += 18) {
          const wy = poolY + Math.sin((x * 0.035) + p.millis() * 0.0006) * 10;
          p.fill(55, 0, 0, 240);
          p.ellipse(x, wy + 20, 130, 50);
        }

        for (let x = -60; x < p.width + 60; x += 18) {
          const wy = poolY + Math.sin((x * 0.028) + p.millis() * 0.0009 + 1.2) * 8;
          p.fill(65, 0, 0, 180);
          p.ellipse(x, wy + 10, 110, 35);
        }

        p.fill(90, 0, 0, 55);
        p.rect(0, poolY, p.width, 30);
      }

      for (let i = bloodDrops.length - 1; i >= 0; i--) {
        const d = bloodDrops[i];

        d.vy += 280 * dt;
        d.vx += Math.sin(d.wobble + p.millis() * 0.003) * 12 * dt;
        d.x  += d.vx * dt;
        d.y  += d.vy * dt;
        d.vx *= (1 - dt * 2.5);

        const floor = p.height - (bloodLevel * p.height) - 10;
        if (d.y >= floor && !d.settled) {
          d.settled = true;
          bloodLevel = p.min(1, bloodLevel + 0.006);
          bloodDrops.splice(i, 1);
          bloodPuddles.push({
            x: d.x,
            y: floor,
            w: d.size * p.random(2.5, 4.5),
            h: d.size * p.random(0.3, 0.6),
            opacity: 200
          });
          continue;
        }

        p.push();
        p.translate(d.x, d.y);
        p.noStroke();

        p.fill(40, 0, 0, d.opacity * 0.3);
        p.ellipse(0, 0, d.size * 1.8, d.size * 2.4);

        p.fill(60, 0, 0, d.opacity);
        p.ellipse(0, d.size * 0.15, d.size * 0.85, d.size * 1.1);

        p.fill(180, 20, 20, d.opacity * 0.5);
        p.ellipse(-d.size * 0.18, -d.size * 0.1, d.size * 0.28, d.size * 0.35);

        p.pop();
      }

      for (let i = bloodPuddles.length - 1; i >= 0; i--) {
        const pu = bloodPuddles[i];
        pu.opacity -= dt * 18;
        if (pu.opacity <= 0) { bloodPuddles.splice(i, 1); continue; }

        p.noStroke();
        p.fill(60, 0, 0, pu.opacity * 0.4);
        p.ellipse(pu.x, pu.y, pu.w * 1.4, pu.h * 1.4);
        p.fill(100, 0, 0, pu.opacity);
        p.ellipse(pu.x, pu.y, pu.w, pu.h);
      }
    }

    function updateEnding(dt) {
      if (bloodLevel >= 1 && !endingActive) {
        endingActive = true;
        endingTimer  = 0;
        endingPhase  = 0;
        heartActive  = false;
        bloodDrops   = [];
        bloodPuddles = [];
        if (heartbeatSound) {
          heartbeatSound.pause();
          heartbeatSound.currentTime = 0;
        }
        if (flatlineSound) flatlineSound.play().catch(() => {});
      }
      if (!endingActive) return;
      endingTimer += dt;

      if (endingPhase === 0) {
        if (endingTimer >= 6) {
          if (flatlineSound) {
            flatlineSound.pause();
            flatlineSound.currentTime = 0;
          }
          endingPhase = 1;
          endingTimer = 0;
        }
        return;
      }

      if (endingPhase === 1) {
        p.noStroke();
        p.fill(0, 0, 0, dt * 60);
        p.rect(0, 0, p.width, p.height);
        if (endingTimer >= 2) {
          endingPhase     = 2;
          endingTimer     = 0;
          endingLineTimer = 0;
          endingLineIndex = 0;
        }
        return;
      }

      if (endingPhase === 2) {
        p.background(0);
        endingLineTimer += dt;
        if (endingLineTimer > 2.5 && endingLineIndex < endingLines.length) {
          endingLineTimer  = 0;
          endingLineIndex += 1;
        }
        p.textFont('monospace');
        p.textSize(32);
        p.textAlign(p.CENTER);
        p.noStroke();
        for (let i = 0; i < endingLineIndex; i++) {
          p.fill(180, 0, 0, 200);
          p.text(endingLines[i], p.width / 2, p.height / 2 - 30 + i * 40);
        }
        if (endingLineIndex >= endingLines.length && endingLineTimer > 3) {
          endingFadeOpacity += dt * 60;
          p.fill(0, 0, 0, Math.min(endingFadeOpacity, 255));
          p.rect(0, 0, p.width, p.height);
          if (endingFadeOpacity >= 255) {
            endingPhase = 3;
            endingTimer = 0;
          }
        }
        return;
      }

      if (endingPhase === 3) {
        p.noStroke();
        p.fill(0, 0, 0, dt * 40);
        p.rect(0, 0, p.width, p.height);
        if (endingTimer >= 2) {
          started = false; stage = 0; stageTimer = 0; idleTimer = 0;
          eyeSpawnAccum = 0; eyes = []; tracePoints = []; scars = [];
          heartActive = false; heartScale = 0; heartOpacity = 0;
          heartBeatInterval = 1.4; heartBeatScale = 1; heartBeatTimer = 0;
          burstState = 0; burstTimer = 0; burstParticles = []; shakeAmount = 0;
          bloodDrops = []; bloodPuddles = []; bloodLevel = 0;
          bloodFilling = false; endingActive = false; endingTimer = 0;
          endingPhase = 0; endingLineIndex = 0; endingLineTimer = 0; endingFadeOpacity = 0;
          revealActive = false; revealIndex = 0;
          revealCycleTimer = 0; revealCycleShowing = false;

          if (ambientSound) {
            ambientSound.pause();
            ambientSound.currentTime = 0;
          }
          if (muteBtn) {
            muteBtn.style.display = 'none';
            muteBtn.style.left  = 'auto';
            muteBtn.style.top   = '20px';
            muteBtn.style.right = '20px';
          }
          muteBtnDodgeCount = 0;
          muteBtnVisible = false;
          muteBtnTextShowing = false;
          hintOpacity = 0; hintShown = false;

          const canvasEl = document.getElementById('canvas-screen');
          const introEl  = document.getElementById('intro-screen');
          canvasEl.classList.add('hidden');
          introEl.classList.remove('hidden');
          introEl.classList.remove('fade-out');
          introEl.style.opacity = '0';
          introEl.style.transition = 'opacity 1.5s ease';
          setTimeout(() => { introEl.style.opacity = '1'; }, 100);

          document.getElementById('intro-eye').src = 'images/eye_closed.png';
          document.getElementById('intro-hint').classList.add('hidden');
        }
      }
    }

    function spawnEye(x, y, isFirst) {
      const sizeScale = isFirst ? 1 : p.random(0.4, 2.2);
      eyes.push({
        x, y,
        baseW:        p.random(70, 180) * sizeScale,
        openProgress: isFirst ? 0 : p.random(0.2, 0.6),
        opening:      true,
        scale:        1,
        targetScale:  1,
        opacity:      0,
        fadeIn:       true,
        rotation:     isFirst ? 0 : p.random(-p.PI, p.PI),
        flipX:        isFirst ? false : p.random() < 0.5
      });
    }

    function drawEyes(dt) {
      if (eyes.length === 0) return;

      if (stage >= 3 && eyes.length > 1) {
        eyes.splice(1, eyes.length - 1);
      }

      let nearestIdx  = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < eyes.length; i++) {
        const d = p.dist(p.mouseX, p.mouseY, eyes[i].x, eyes[i].y);
        if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
      }

      for (let i = 0; i < eyes.length; i++) {
        const e       = eyes[i];
        const isFirst = i === 0;

        if (e.fadeIn) {
          e.opacity += dt * 140;
          if (e.opacity >= 255) { e.opacity = 255; e.fadeIn = false; }
        }

        if (e.opening) {
          e.openProgress += dt * 0.55;
          if (e.openProgress >= 1) { e.openProgress = 1; e.opening = false; }
        }

        let img;
        if (stage >= 3 && isFirst) {
          img = imgEyeWide;
        } else if (idleTimer > 6) {
          img = imgEyeWide;
        } else if (e.openProgress < 0.3) {
          img = imgEyeClosed;
        } else {
          img = imgEyeOpen;
        }

        if (stage >= 3 && isFirst) {
          e.x = p.width / 2 + (e.baseW * e.scale * 0.08);
          e.y = p.height / 2;
          const maxEyeW = p.width * 0.7;
          const desiredW = e.baseW * 18;
          e.targetScale = desiredW > maxEyeW ? (maxEyeW / e.baseW) : 18;
        } else if (idleTimer > 6) {
          e.targetScale = 1.25;
        } else {
          e.targetScale = 1;
        }
        if (idleTimer > 3 && i === nearestIdx) e.targetScale += 0.15;

        e.scale += (e.targetScale - e.scale) * dt * 2.2;

        const w  = e.baseW * e.scale;
        const h  = e.baseW * e.scale * 0.55;
        const ps = e.baseW * e.scale * 0.1;

        const worldAngle = Math.atan2(p.mouseY - e.y, p.mouseX - e.x);
        let localAngle = worldAngle - e.rotation;
        if (e.flipX) localAngle = Math.PI - localAngle;

        let maxOff;
        if (stage >= 3 && isFirst) {
          maxOff = e.baseW * e.scale * 0.01;
        } else {
          maxOff = e.baseW * e.scale * 0.08;
        }
        const offX = Math.cos(localAngle) * maxOff;
        const offY = Math.sin(localAngle) * maxOff * 0.55;

        const irisD = Math.min(h * 0.38, w * 0.18);

        p.push();
        p.translate(e.x, e.y);
        p.rotate(e.rotation);
        if (e.flipX) p.scale(-1, 1);

        if (img) {
          p.tint(255, e.opacity);
          p.image(img, 0, 0, w, h);
          p.noTint();
        } else {
          p.noFill();
          p.stroke(139, 0, 0, e.opacity);
          p.strokeWeight(1.5);
          p.ellipse(0, 0, w, h);
        }

        if (!(stage >= 3 && isFirst)) {
          p.push();
          p.beginClip();
          const clipW = w * 0.40;
          const clipH = h * 0.70;
          p.ellipse(-w * 0.08, 0, clipW, clipH);
          p.endClip();

          if (imgIris) {
            p.tint(255, e.opacity);
            p.image(imgIris, offX - w * 0.08, offY, irisD, irisD);
            p.noTint();
          } else {
            p.noStroke();
            p.fill(60, 0, 0, e.opacity * 0.85);
            p.ellipse(offX, offY, ps * 2.4, ps * 2.4);
            p.fill(150, 10, 10, e.opacity * 0.9);
            p.ellipse(offX, offY, ps * 1.6, ps * 1.6);
            p.fill(0, 0, 0, e.opacity);
            p.ellipse(offX, offY, ps * 0.95, ps * 0.95);
            p.fill(255, 230, 230, e.opacity * 0.7);
            p.ellipse(offX - ps * 0.3, offY - ps * 0.3, ps * 0.35, ps * 0.35);
          }
          p.pop();
        }

        p.pop();
      }
    }

    function drawTrace() {
      p.noStroke();
      for (const tp of tracePoints) {
        const op = tp.opacity;
        const r  = p.map(op, 12, 180, 2, 7);
        p.fill(80, 0, 0, op * 0.3);
        p.ellipse(tp.x, tp.y, r * 4, r * 4);
        p.fill(139, 0, 0, op);
        p.ellipse(tp.x, tp.y, r * 2, r * 1.3);
      }
    }

    function drawScars() {
      p.textFont('monospace');
      p.textSize(9);
      for (const s of scars) {
        p.noFill();
        p.stroke(160, 0, 0, 90);
        p.strokeWeight(1);
        p.ellipse(s.x, s.y, 10, 10);

        p.stroke(100, 0, 0, 60);
        p.strokeWeight(0.5);
        p.ellipse(s.x, s.y, 18, 18);

        if (s.rippleOpacity > 0) {
          p.stroke(180, 0, 0, s.rippleOpacity);
          p.strokeWeight(0.8);
          p.ellipse(s.x, s.y, s.rippleR * 2, s.rippleR * 2);
        }

        const elapsed = (p.millis() - s.time) / 1000;
        const mm = p.nf(p.floor(elapsed / 60), 2);
        const ss = p.nf(p.floor(elapsed % 60), 2);
        p.noStroke();
        p.fill(120, 0, 0, 55);
        p.text('seen — ' + mm + ':' + ss, s.x + 14, s.y + 4);
      }
    }

    function drawCursor() {
      p.noStroke();
      p.fill(204, 0, 0, 90);
      p.ellipse(p.mouseX, p.mouseY, 22, 22);

      p.fill(255, 40, 40, 255);
      p.ellipse(p.mouseX, p.mouseY, 9, 9);

      p.stroke(255, 60, 60, 220);
      p.strokeWeight(1.4);
      p.line(p.mouseX - 16, p.mouseY,      p.mouseX - 6,  p.mouseY);
      p.line(p.mouseX + 6,  p.mouseY,      p.mouseX + 16, p.mouseY);
      p.line(p.mouseX,      p.mouseY - 16, p.mouseX,      p.mouseY - 6);
      p.line(p.mouseX,      p.mouseY + 6,  p.mouseX,      p.mouseY + 16);
    }

    function drawHint(dt) {
      if (hintShown) return;
      if (stage > 0) { hintShown = true; hintOpacity = 0; return; }

      if (hintOpacity < 255 && stageTimer === 0) {
        hintOpacity = Math.min(255, hintOpacity + dt * 80);
      }

      if (hintOpacity > 0) {
        p.textFont('monospace');
        p.textSize(11);
        p.textAlign(p.LEFT);
        p.noStroke();
        p.fill(139, 0, 0, hintOpacity * 0.7);
        p.text('move. it is listening.', p.mouseX + 18, p.mouseY - 10);

        if (p.millis() > 4000) {
          hintOpacity -= dt * 45;
        }
      }
    }

    function handleReveal(dt) {
      if (endingActive) {
        document.getElementById('reveal-text').classList.add('hidden');
        return;
      }
      if (muteBtnTextShowing) return;

      const revealEl = document.getElementById('reveal-text');
      const lineEl   = document.getElementById('reveal-line');

      if (revealActive) {
        if (revealEl && lineEl) {
          lineEl.textContent = revealText;
          revealEl.classList.remove('hidden');
          revealEl.classList.add('show');
        }
        revealCountdown -= dt;
        if (revealCountdown <= 0) {
          revealActive = false;
          if (!revealCycleShowing && revealEl) {
            revealEl.classList.remove('show');
            revealEl.classList.add('hidden');
          }
        }
        return;
      }

      if (stage < 2) return;

      if (revealCycleShowing) {
        revealCycleCountdown -= dt;
        if (revealCycleCountdown <= 0) {
          revealCycleShowing = false;
          if (revealEl) {
            revealEl.classList.remove('show');
            revealEl.classList.add('hidden');
          }
        }
      } else {
        revealCycleTimer += dt;
        if (revealCycleTimer >= 15) {
          revealCycleTimer     = 0;
          revealCycleShowing   = true;
          revealCycleCountdown = 4;
          revealIndex = (revealIndex + 1) % CYCLE_MESSAGES.length;
          if (revealEl && lineEl) {
            lineEl.textContent = CYCLE_MESSAGES[revealIndex];
            revealEl.classList.remove('hidden');
            revealEl.classList.add('show');
          }
        }
      }
    }

  };

  new p5(sketch, 'p5-container');
})();
