(function initSystemsTopology() {
    const section = document.getElementById('journey');
    const canvas = document.getElementById('systemsCanvas');
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);

    const TILE_WIDTH = 760;
    const TILE_HEIGHT = 440;
    const FRAME_INTERVAL = 1000 / 20;
    const points = [
        { x: 72, y: 82, shape: 'circle' },
        { x: 258, y: 82, shape: 'square' },
        { x: 258, y: 232, shape: 'circle' },
        { x: 472, y: 232, shape: 'square' },
        { x: 640, y: 104, shape: 'circle' },
        { x: 640, y: 346, shape: 'square' },
        { x: 112, y: 346, shape: 'circle' },
        { x: 390, y: 356, shape: 'circle' }
    ];
    const links = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [3, 5], [5, 7], [7, 6], [6, 0], [2, 7]
    ];

    let width = 1;
    let height = 1;
    let visible = false;
    let frameId = 0;
    let lastFrame = 0;

    function resize() {
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(reduceMotion.matches || saveData ? 0 : performance.now());
    }

    function traceRoute(ax, ay, bx, by) {
        const midX = ax + (bx - ax) * 0.55;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(midX, ay);
        ctx.lineTo(midX, by);
        ctx.lineTo(bx, by);
        ctx.stroke();
        return { ax, ay, midX, bx, by };
    }

    function pointOnRoute(route, progress) {
        const first = Math.abs(route.midX - route.ax);
        const second = Math.abs(route.by - route.ay);
        const third = Math.abs(route.bx - route.midX);
        const total = first + second + third || 1;
        let distance = progress * total;

        if (distance <= first) {
            return { x: route.ax + Math.sign(route.midX - route.ax) * distance, y: route.ay };
        }
        distance -= first;
        if (distance <= second) {
            return { x: route.midX, y: route.ay + Math.sign(route.by - route.ay) * distance };
        }
        distance -= second;
        return { x: route.midX + Math.sign(route.bx - route.midX) * distance, y: route.by };
    }

    function drawNode(x, y, shape) {
        ctx.save();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.52)';
        ctx.fillStyle = 'rgba(17, 18, 16, 0.88)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x - 8, y - 8, 16, 16);
            ctx.strokeRect(x - 8, y - 8, 16, 16);
        }

        ctx.strokeStyle = 'rgba(230, 75, 46, 0.52)';
        ctx.beginPath();
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x - 10, y);
        ctx.moveTo(x + 10, y);
        ctx.lineTo(x + 14, y);
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x, y - 10);
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x, y + 14);
        ctx.stroke();
        ctx.restore();
    }

    function drawTile(originX, originY, time, tileIndex) {
        const routes = [];
        ctx.save();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);

        links.forEach(([fromIndex, toIndex]) => {
            const from = points[fromIndex];
            const to = points[toIndex];
            routes.push(traceRoute(
                originX + from.x,
                originY + from.y,
                originX + to.x,
                originY + to.y
            ));
        });
        ctx.restore();

        points.forEach(point => drawNode(originX + point.x, originY + point.y, point.shape));

        if (reduceMotion.matches || saveData) return;

        routes.forEach((route, routeIndex) => {
            const speed = 0.000055 + (routeIndex % 3) * 0.000008;
            const progress = (time * speed + routeIndex * 0.17 + tileIndex * 0.09) % 1;
            const packet = pointOnRoute(route, progress);
            ctx.save();
            ctx.shadowColor = 'rgba(230, 75, 46, 0.85)';
            ctx.shadowBlur = 9;
            ctx.fillStyle = '#e64b2e';
            ctx.fillRect(packet.x - 2.5, packet.y - 2.5, 5, 5);
            ctx.restore();
        });
    }

    function draw(time) {
        ctx.clearRect(0, 0, width, height);

        const panX = reduceMotion.matches || saveData ? 0 : (time * 0.0045) % TILE_WIDTH;
        const panY = reduceMotion.matches || saveData ? 0 : (time * 0.0026) % TILE_HEIGHT;
        const grid = 40;
        const gridOffsetX = panX % grid;
        const gridOffsetY = panY % grid;

        ctx.save();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.055)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -gridOffsetX; x <= width; x += grid) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = -gridOffsetY; y <= height; y += grid) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();

        let tileIndex = 0;
        for (let y = -TILE_HEIGHT - panY; y < height + TILE_HEIGHT; y += TILE_HEIGHT) {
            for (let x = -TILE_WIDTH - panX; x < width + TILE_WIDTH; x += TILE_WIDTH) {
                drawTile(x, y, time, tileIndex++);
            }
        }
    }

    function loop(time) {
        if (!visible || document.hidden || reduceMotion.matches || saveData) {
            frameId = 0;
            return;
        }
        if (time - lastFrame >= FRAME_INTERVAL) {
            draw(time);
            lastFrame = time;
        }
        frameId = requestAnimationFrame(loop);
    }

    function start() {
        if (!visible || document.hidden || reduceMotion.matches || saveData || frameId) return;
        lastFrame = 0;
        frameId = requestAnimationFrame(loop);
    }

    function stop() {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
    }

    function handleMotionPreference() {
        stop();
        draw(0);
        start();
    }

    const visibilityObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start(); else stop();
    }, { threshold: 0, rootMargin: '200px 0px' });

    const resizeObserver = new ResizeObserver(resize);
    visibilityObserver.observe(section);
    resizeObserver.observe(canvas.parentElement);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });
    reduceMotion.addEventListener?.('change', handleMotionPreference);

    resize();
})();
