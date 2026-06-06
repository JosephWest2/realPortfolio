(() => {
    const canvas = document.getElementById('dot-canvas');
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = {
        x: 0,
        y: 0,
        active: false,
    };

    let dots = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let lastFrameTime = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const randomBetween = (min, max) => min + Math.random() * (max - min);

    function resizeCanvas() {
        dpr = clamp(window.devicePixelRatio || 1, 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        createDots();
        draw();
    }

    function createDots() {
        const dotCount = clamp(Math.floor((width * height) / 14000), 55, 150);

        dots = Array.from({ length: dotCount }, () => {
            const depth = randomBetween(0, 1);
            const radius = randomBetween(0.7, 2.2) + depth * randomBetween(1.2, 3.4);
            const driftSpeed = randomBetween(1.5, 5) + depth * 6;
            const angle = randomBetween(0, Math.PI * 2);

            return {
                x: randomBetween(0, width),
                y: randomBetween(0, height),
                radius,
                depth,
                blur: (1 - depth) * 3.2,
                opacity: 0.2 + depth * 0.45,
                baseVx: Math.cos(angle) * driftSpeed,
                baseVy: Math.sin(angle) * driftSpeed,
                vx: Math.cos(angle) * driftSpeed,
                vy: Math.sin(angle) * driftSpeed,
            };
        });
    }

    function wrapDot(dot) {
        const margin = 40;

        if (dot.x < -margin) {
            dot.x = width + margin;
        } else if (dot.x > width + margin) {
            dot.x = -margin;
        }

        if (dot.y < -margin) {
            dot.y = height + margin;
        } else if (dot.y > height + margin) {
            dot.y = -margin;
        }
    }

    function getProjectedPosition(dot) {
        if (reducedMotionQuery.matches) {
            return {
                x: dot.x,
                y: dot.y,
            };
        }

        const parallaxOffset = window.scrollY * (0.08 + dot.depth * 0.22);
        let x = dot.x;
        let y = dot.y - parallaxOffset;

        y = ((y % (height + 80)) + height + 80) % (height + 80) - 40;

        return { x, y };
    }

    function drawDot(dot) {
        const { x, y } = getProjectedPosition(dot);

        ctx.save();
        ctx.filter = dot.blur > 0.1 ? `blur(${dot.blur}px)` : 'none';
        ctx.globalAlpha = dot.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        dots.forEach(drawDot);
    }

    function update(deltaSeconds) {
        if (reducedMotionQuery.matches) {
            return;
        }

        dots.forEach(dot => {
            if (pointer.active) {
                const { x, y } = getProjectedPosition(dot);
                const dx = x - pointer.x;
                const dy = y - pointer.y;
                const distance = Math.hypot(dx, dy);
                const radius = 120;

                if (distance > 0 && distance < radius) {
                    const force = ((radius - distance) / radius) ** 2;
                    const push = force * (10 + dot.depth * 14) * deltaSeconds;
                    dot.vx += (dx / distance) * push;
                    dot.vy += (dy / distance) * push;
                }
            }

            dot.vx += (dot.baseVx - dot.vx) * 0.55 * deltaSeconds;
            dot.vy += (dot.baseVy - dot.vy) * 0.55 * deltaSeconds;

            dot.x += dot.vx * deltaSeconds;
            dot.y += dot.vy * deltaSeconds;
            wrapDot(dot);
        });
    }

    function animate(time) {
        const deltaSeconds = lastFrameTime
            ? Math.min((time - lastFrameTime) / 1000, 0.05)
            : 0;

        lastFrameTime = time;
        update(deltaSeconds);
        draw();
        animationFrame = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
        window.cancelAnimationFrame(animationFrame);
        lastFrameTime = 0;
        draw();

        if (!reducedMotionQuery.matches && !document.hidden) {
            animationFrame = window.requestAnimationFrame(animate);
        }
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', event => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
    });
    window.addEventListener('pointerleave', () => {
        pointer.active = false;
    });
    window.addEventListener('scroll', () => {
        if (reducedMotionQuery.matches) {
            return;
        }

        draw();
    }, { passive: true });
    document.addEventListener('visibilitychange', startAnimation);
    reducedMotionQuery.addEventListener('change', startAnimation);

    resizeCanvas();
    startAnimation();
})();
