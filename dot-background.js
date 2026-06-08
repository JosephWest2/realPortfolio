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
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
    });
    const dotTexture = createDotTexture(THREE);
    const layerConfigs = [
        {
            countShare: 0.34,
            opacity: 0.28,
            parallax: 0.08,
            size: 5.2,
            speedMin: 0.5,
            speedMax: 1.8,
        },
        {
            countShare: 0.36,
            opacity: 0.42,
            parallax: 0.17,
            size: 7.1,
            speedMin: 1.1,
            speedMax: 3.2,
        },
        {
            countShare: 0.3,
            opacity: 0.6,
            parallax: 0.3,
            size: 9.2,
            speedMin: 2.2,
            speedMax: 5.5,
        },
    ];

    let width = 0;
    let height = 0;
    let dpr = 1;
    let resizeFrame = 0;
    let lastFrameTime = 0;
    let currentScrollY = window.scrollY;
    let targetScrollY = window.scrollY;
    let layers = [];

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const randomBetween = (min, max) => min + Math.random() * (max - min);
    const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

    function createDotLayer(config, totalDotCount, layerIndex) {
        const margin = 96;
        const count = Math.max(1, Math.round(totalDotCount * config.countShare));
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 2);
        const minX = -width / 2 - margin;
        const maxX = width / 2 + margin;
        const minY = -height / 2 - margin;
        const maxY = height / 2 + margin;

        for (let index = 0; index < count; index++) {
            const positionIndex = index * 3;
            const velocityIndex = index * 2;
            const speed = randomBetween(config.speedMin, config.speedMax);
            const angle = randomBetween(0, Math.PI * 2);

            positions[positionIndex] = randomBetween(minX, maxX);
            positions[positionIndex + 1] = randomBetween(minY, maxY);
            positions[positionIndex + 2] = layerIndex;
            velocities[velocityIndex] = Math.cos(angle) * speed;
            velocities[velocityIndex + 1] = Math.sin(angle) * speed;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            alphaTest: 0.01,
            color: 0xffffff,
            depthTest: false,
            depthWrite: false,
            map: dotTexture,
            opacity: config.opacity,
            size: config.size,
            sizeAttenuation: false,
            transparent: true,
        });

        const group = new THREE.Group();
        const primaryPoints = new THREE.Points(geometry, material);
        const wrappedPoints = new THREE.Points(geometry, material);
        const wrapHeight = height + margin * 2;

        primaryPoints.renderOrder = layerIndex;
        wrappedPoints.renderOrder = layerIndex;
        group.add(primaryPoints);
        group.add(wrappedPoints);
        scene.add(group);

        return {
            config,
            geometry,
            group,
            material,
            maxX,
            maxY,
            minX,
            minY,
            positions,
            primaryPoints,
            velocities,
            wrapHeight,
            wrappedPoints,
        };
    }

    function createLayers() {
        clearLayers();

        const totalDotCount = clamp(Math.floor((width * height) / 14000), 55, 150);
        layers = layerConfigs.map((config, index) => createDotLayer(config, totalDotCount, index));
    }

    function clearLayers() {
        layers.forEach(layer => {
            scene.remove(layer.group);
            layer.geometry.dispose();
            layer.material.dispose();
        });
        layers = [];
    }

    function getViewportSize() {
        return {
            width: Math.round(document.documentElement.clientWidth || window.innerWidth),
            height: Math.round(document.documentElement.clientHeight || window.innerHeight),
        };
    }

    function resizeRenderer() {
        const nextSize = getViewportSize();
        const nextDpr = clamp(window.devicePixelRatio || 1, 1, 1.25);
        const widthChanged = nextSize.width !== width;
        const heightChanged = nextSize.height !== height;
        const dprChanged = nextDpr !== dpr;

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

        if (widthChanged || dprChanged || layers.length === 0 || (heightChanged && !mobileQuery.matches)) {
            createLayers();
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

    function updateLayerPositions(layer, deltaSeconds) {
        const positionAttribute = layer.geometry.getAttribute('position');

        for (let index = 0; index < layer.velocities.length / 2; index++) {
            const positionIndex = index * 3;
            const velocityIndex = index * 2;

            layer.positions[positionIndex] += layer.velocities[velocityIndex] * deltaSeconds;
            layer.positions[positionIndex + 1] += layer.velocities[velocityIndex + 1] * deltaSeconds;

            if (layer.positions[positionIndex] < layer.minX) {
                layer.positions[positionIndex] = layer.maxX;
            } else if (layer.positions[positionIndex] > layer.maxX) {
                layer.positions[positionIndex] = layer.minX;
            }

            if (layer.positions[positionIndex + 1] < layer.minY) {
                layer.positions[positionIndex + 1] = layer.maxY;
            } else if (layer.positions[positionIndex + 1] > layer.maxY) {
                layer.positions[positionIndex + 1] = layer.minY;
            }
        }

        positionAttribute.needsUpdate = true;
    }

    function update(deltaSeconds) {
        currentScrollY += (targetScrollY - currentScrollY) * clamp(deltaSeconds * 32, 0, 1);

        layers.forEach(layer => {
            updateLayerPositions(layer, deltaSeconds);
        });
    }

    function renderScene() {
        layers.forEach(layer => {
            const scrollOffset = reducedMotionQuery.matches
                ? 0
                : currentScrollY * layer.config.parallax;
            const layerOffset = positiveModulo(scrollOffset, layer.wrapHeight);

            layer.primaryPoints.position.y = layerOffset;
            layer.wrappedPoints.position.y = layerOffset - layer.wrapHeight;
        });

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
        currentScrollY = window.scrollY;
        targetScrollY = window.scrollY;
        renderScene();

        if (!document.hidden && !reducedMotionQuery.matches) {
            renderer.setAnimationLoop(animate);
        }
    }

    window.addEventListener('resize', requestResize);
    window.visualViewport?.addEventListener('resize', requestResize);
    window.addEventListener('scroll', () => {
        targetScrollY = window.scrollY;
    }, { passive: true });
    document.addEventListener('visibilitychange', startRendering);
    reducedMotionQuery.addEventListener('change', startRendering);
    mobileQuery.addEventListener('change', () => {
        createLayers();
        startRendering();
    });

    resizeRenderer();
    startRendering();
}

function createDotTexture(THREE) {
    const textureCanvas = document.createElement('canvas');
    const size = 64;
    const center = size / 2;
    const context = textureCanvas.getContext('2d');

    textureCanvas.width = size;
    textureCanvas.height = size;

    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}
