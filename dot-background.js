import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';

const canvas = document.getElementById('dot-canvas');

if (canvas) {
    try {
        initializeDotBackground(THREE, canvas);
    } catch (error) {
        console.warn('Dot background disabled.', error);
        canvas.style.display = 'none';
    }
}

function initializeDotBackground(THREE, canvas) {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 47.999rem)');
    const smallPhoneQuery = window.matchMedia('(max-width: 39.999rem)');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
    });
    const dotDepthConfig = {
        edgeSoftnessMax: 0.32,
        opacityMax: 0.6,
        opacityMin: 0.28,
        parallaxMax: 0.2,
        parallaxMin: 0.053,
        sizeMax: 18.4,
        sizeMin: 5.2,
        speedMax: 5.5,
        speedMin: 0.5,
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let resizeFrame = 0;
    let lastFrameTime = 0;
    let currentScrollY = window.scrollY;
    let targetScrollY = window.scrollY;
    let dotField = null;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const lerp = (min, max, amount) => min + (max - min) * amount;
    const randomBetween = (min, max) => min + Math.random() * (max - min);
    let motionTime = 0;

    const dotVertexShader = `
        attribute float dotSize;
        attribute float edgeSoftness;
        attribute float opacity;
        attribute float parallax;
        attribute vec2 velocity;

        uniform vec4 bounds;
        uniform float scrollY;
        uniform float pointSize;
        uniform float time;

        varying float vDotSize;
        varying float vEdgeSoftness;
        varying float vOpacity;

        float wrapRange(float value, float minValue, float maxValue) {
            float range = maxValue - minValue;
            return minValue + mod(value - minValue, range);
        }

        void main() {
            vec3 animatedPosition = position;
            animatedPosition.x = wrapRange(position.x + velocity.x * time, bounds.x, bounds.y);
            animatedPosition.y = wrapRange(position.y + velocity.y * time + scrollY * parallax, bounds.z, bounds.w);

            vDotSize = dotSize;
            vEdgeSoftness = edgeSoftness;
            vOpacity = opacity;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedPosition, 1.0);
            gl_PointSize = dotSize * pointSize;
        }
    `;

    const dotFragmentShader = `
        uniform vec3 backgroundColor;
        uniform vec3 dotColor;

        varying float vDotSize;
        varying float vEdgeSoftness;
        varying float vOpacity;

        void main() {
            float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
            float antialiasSoftness = 0.75 / max(vDotSize, 1.0);
            float edgeSoftness = max(vEdgeSoftness, antialiasSoftness);
            float alpha = 1.0 - smoothstep(0.5 - edgeSoftness, 0.5, distanceFromCenter);

            if (alpha < 0.01) {
                discard;
            }

            gl_FragColor = vec4(mix(backgroundColor, dotColor, alpha * vOpacity), 1.0);
        }
    `;

    function createDotMaterial(bounds) {
        return new THREE.ShaderMaterial({
            blending: THREE.NoBlending,
            depthTest: false,
            depthWrite: false,
            fragmentShader: dotFragmentShader,
            transparent: false,
            uniforms: {
                backgroundColor: { value: new THREE.Color(0x1c1b21) },
                bounds: { value: bounds },
                dotColor: { value: new THREE.Color(0xffffff) },
                pointSize: { value: 1 },
                scrollY: { value: 0 },
                time: { value: motionTime },
            },
            vertexShader: dotVertexShader,
        });
    }

    function createDotField(totalDotCount) {
        const margin = 96;
        const count = Math.max(1, totalDotCount);
        const minX = -width / 2 - margin;
        const maxX = width / 2 + margin;
        const minY = -height / 2 - margin;
        const maxY = height / 2 + margin;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 2);
        const dotSizes = new Float32Array(count);
        const edgeSoftnesses = new Float32Array(count);
        const opacities = new Float32Array(count);
        const parallaxes = new Float32Array(count);

        for (let index = 0; index < count; index++) {
            const positionIndex = index * 3;
            const velocityIndex = index * 2;
            const depth = Math.pow(Math.random(), 1.45);
            const speed = clamp(
                lerp(dotDepthConfig.speedMin, dotDepthConfig.speedMax, depth) * randomBetween(0.75, 1.25),
                dotDepthConfig.speedMin,
                dotDepthConfig.speedMax,
            );
            const angle = randomBetween(0, Math.PI * 2);

            positions[positionIndex] = randomBetween(minX, maxX);
            positions[positionIndex + 1] = randomBetween(minY, maxY);
            positions[positionIndex + 2] = depth;
            velocities[velocityIndex] = Math.cos(angle) * speed;
            velocities[velocityIndex + 1] = Math.sin(angle) * speed;
            dotSizes[index] = lerp(dotDepthConfig.sizeMin, dotDepthConfig.sizeMax, depth);
            edgeSoftnesses[index] = dotDepthConfig.edgeSoftnessMax * Math.pow(1 - depth, 1.25);
            opacities[index] = lerp(dotDepthConfig.opacityMin, dotDepthConfig.opacityMax, depth);
            parallaxes[index] = lerp(dotDepthConfig.parallaxMin, dotDepthConfig.parallaxMax, depth);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('dotSize', new THREE.BufferAttribute(dotSizes, 1));
        geometry.setAttribute('edgeSoftness', new THREE.BufferAttribute(edgeSoftnesses, 1));
        geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
        geometry.setAttribute('parallax', new THREE.BufferAttribute(parallaxes, 1));
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 2));

        const material = createDotMaterial(new THREE.Vector4(minX, maxX, minY, maxY));
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        return {
            geometry,
            material,
            points,
        };
    }

    function createDotFieldForViewport() {
        clearDotField();

        const totalDotCount = clamp(Math.floor((width * height) / 28000), 28, 75);
        dotField = createDotField(totalDotCount);
    }

    function clearDotField() {
        if (!dotField) {
            return;
        }

        scene.remove(dotField.points);
        dotField.geometry.dispose();
        dotField.material.dispose();
        dotField = null;
    }

    function getViewportSize() {
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;

        if (smallPhoneQuery.matches) {
            const canvasRect = canvas.getBoundingClientRect();

            return {
                width: Math.round(canvasRect.width || viewportWidth),
                height: Math.round(canvasRect.height || document.documentElement.clientHeight || window.innerHeight),
            };
        }

        return {
            width: Math.round(viewportWidth),
            height: Math.round(document.documentElement.clientHeight || window.innerHeight),
        };
    }

    function resizeRenderer() {
        let nextSize = getViewportSize();
        const nextDpr = clamp(window.devicePixelRatio || 1, 1, 1.25);
        const smallPhone = smallPhoneQuery.matches;
        const widthChanged = nextSize.width !== width;
        let heightChanged = nextSize.height !== height;
        const dprChanged = nextDpr !== dpr;

        if (smallPhone && !widthChanged && heightChanged && height > 0) {
            nextSize = { ...nextSize, height };
            heightChanged = false;
        }

        if (!widthChanged && !heightChanged && !dprChanged) {
            return;
        }

        width = Math.max(1, nextSize.width);
        height = Math.max(1, nextSize.height);
        dpr = nextDpr;

        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        renderer.setClearColor(0x1c1b21, 1);

        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.position.z = 10;
        camera.updateProjectionMatrix();

        if (widthChanged || dprChanged || !dotField || (heightChanged && !mobileQuery.matches)) {
            createDotFieldForViewport();
        }

        renderScene();
    }

    function requestResize() {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = 0;
            resizeRenderer();
        });
    }

    function getParallaxScrollY() {
        return smallPhoneQuery.matches ? 0 : window.scrollY;
    }

    function update(deltaSeconds) {
        motionTime += deltaSeconds;
        currentScrollY += (targetScrollY - currentScrollY) * clamp(deltaSeconds * 32, 0, 1);
    }

    function renderScene() {
        const scrollParallaxDisabled = reducedMotionQuery.matches || smallPhoneQuery.matches;

        if (dotField) {
            dotField.material.uniforms.scrollY.value = scrollParallaxDisabled ? 0 : currentScrollY;
            dotField.material.uniforms.time.value = motionTime;
        }

        renderer.render(scene, camera);
    }

    function animate(time) {
        const deltaSeconds = lastFrameTime
            ? Math.min((time - lastFrameTime) / 1000, 0.05)
            : 0;

        lastFrameTime = time;
        update(deltaSeconds);
        renderScene();
    }

    function startRendering() {
        renderer.setAnimationLoop(null);
        lastFrameTime = 0;
        currentScrollY = getParallaxScrollY();
        targetScrollY = currentScrollY;
        renderScene();

        if (!document.hidden && !reducedMotionQuery.matches) {
            renderer.setAnimationLoop(animate);
        }
    }

    window.addEventListener('resize', requestResize);
    window.visualViewport?.addEventListener('resize', requestResize);
    window.addEventListener('scroll', () => {
        targetScrollY = getParallaxScrollY();
    }, { passive: true });
    document.addEventListener('visibilitychange', startRendering);
    reducedMotionQuery.addEventListener('change', startRendering);
    mobileQuery.addEventListener('change', () => {
        createDotFieldForViewport();
        startRendering();
    });
    smallPhoneQuery.addEventListener('change', () => {
        requestResize();
        startRendering();
    });

    resizeRenderer();
    startRendering();
}
