(function initContactSignalField() {
    const section = document.getElementById('save-point');
    const canvas = document.getElementById('contactFieldCanvas');
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    const FRAME_INTERVAL = 1000 / 18;
    const GRID = 42;

    let width = 1;
    let height = 1;
    let contours = [];
    let visible = false;
    let frameId = 0;
    let lastFrame = 0;

    function makeContour(cx, cy, rx, ry, phase, points = 72) {
        const path = [];
        for (let index = 0; index <= points; index += 1) {
            const angle = (index / points) * Math.PI * 2;
            const distortion = 1
                + 0.075 * Math.sin(angle * 3 + phase)
                + 0.045 * Math.sin(angle * 7 - phase * 0.65)
                + 0.025 * Math.cos(angle * 11 + phase * 0.4);
            path.push({
                x: cx + Math.cos(angle) * rx * distortion,
                y: cy + Math.sin(angle) * ry * distortion
            });
        }
        return path;
    }

    function rebuildContours() {
        const compact = width < 640;
        const clusters = compact
            ? [
                { x: 0.08, y: 0.22, rx: 118, ry: 82, phase: 0.7, rings: 6 },
                { x: 0.82, y: 0.66, rx: 154, ry: 112, phase: 2.1, rings: 7 }
            ]
            : [
                { x: 0.08, y: 0.18, rx: 170, ry: 108, phase: 0.7, rings: 7 },
                { x: 0.78, y: 0.22, rx: 235, ry: 150, phase: 2.1, rings: 8 },
                { x: 0.43, y: 0.78, rx: 270, ry: 162, phase: 4.2, rings: 8 },
                { x: 1.02, y: 0.88, rx: 180, ry: 116, phase: 5.4, rings: 6 }
            ];

        contours = [];
        clusters.forEach((cluster, clusterIndex) => {
            for (let ring = 1; ring <= cluster.rings; ring += 1) {
                const scale = ring / cluster.rings;
                contours.push({
                    points: makeContour(
                        width * cluster.x,
                        height * cluster.y,
                        cluster.rx * scale,
                        cluster.ry * scale,
                        cluster.phase + ring * 0.23
                    ),
                    clusterIndex,
                    ring,
                    highlighted: clusterIndex === 1 && ring === cluster.rings - 1
                });
            }
        });
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildContours();
        draw(0);
    }

    function strokePath(points) {
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    function drawGrid(time) {
        const staticMode = reduceMotion.matches || saveData;
        const driftX = staticMode ? 0 : (time * 0.0018) % GRID;
        const driftY = staticMode ? 0 : (time * 0.0011) % GRID;

        ctx.save();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.055)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -driftX; x <= width; x += GRID) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = -driftY; y <= height; y += GRID) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawRegistrationMarks() {
        const marks = [
            [0.06, 0.5], [0.28, 0.12], [0.52, 0.48],
            [0.72, 0.82], [0.94, 0.45]
        ];
        ctx.save();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.18)';
        ctx.lineWidth = 1;
        marks.forEach(([nx, ny]) => {
            const x = width * nx;
            const y = height * ny;
            ctx.beginPath();
            ctx.moveTo(x - 8, y);
            ctx.lineTo(x + 8, y);
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x, y + 8);
            ctx.stroke();
            ctx.strokeRect(x - 2, y - 2, 4, 4);
        });
        ctx.restore();
    }

    function drawContours(time) {
        const staticMode = reduceMotion.matches || saveData;
        const panX = staticMode ? 0 : Math.sin(time / 24000) * 18;
        const panY = staticMode ? 0 : Math.cos(time / 28000) * 11;

        ctx.save();
        ctx.translate(panX, panY);
        contours.forEach(contour => {
            ctx.lineWidth = contour.highlighted ? 1.4 : 1;
            ctx.strokeStyle = contour.highlighted
                ? 'rgba(230, 75, 46, 0.58)'
                : 'rgba(243, 240, 232, 0.14)';
            if (contour.highlighted) {
                ctx.setLineDash([5, 9]);
                ctx.lineDashOffset = staticMode ? 0 : -(time * 0.012) % 14;
            } else {
                ctx.setLineDash([]);
            }
            strokePath(contour.points);
        });
        ctx.restore();
    }

    function drawSurveyBeacon(time) {
        const staticMode = reduceMotion.matches || saveData;
        const x = width * (width < 640 ? 0.78 : 0.76);
        const y = height * (width < 640 ? 0.27 : 0.29);
        const angle = staticMode ? -Math.PI * 0.24 : (time / 32000) * Math.PI * 2 - Math.PI / 2;
        const pulse = staticMode ? 0 : (time % 3200) / 3200;

        ctx.save();
        ctx.strokeStyle = 'rgba(230, 75, 46, 0.72)';
        ctx.fillStyle = '#e64b2e';
        ctx.lineWidth = 1;

        if (!staticMode) {
            ctx.globalAlpha = 1 - pulse;
            ctx.beginPath();
            ctx.arc(x, y, 12 + pulse * 44, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(243, 240, 232, 0.82)';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(230, 75, 46, 0.66)';
        ctx.beginPath();
        ctx.arc(x, y, 74, -Math.PI / 2, angle);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * 86, y + Math.sin(angle) * 86);
        ctx.stroke();

        ctx.fillStyle = 'rgba(243, 240, 232, 0.42)';
        ctx.font = '500 8px "IBM Plex Mono", monospace';
        ctx.letterSpacing = '1px';
        ctx.fillText('SIGNAL / BLR', x + 14, y - 14);
        ctx.fillText('12.9716 N · 77.5946 E', x + 14, y + 24);
        ctx.restore();
    }

    function draw(time) {
        ctx.clearRect(0, 0, width, height);
        drawGrid(time);
        drawRegistrationMarks();
        drawContours(time);
        drawSurveyBeacon(time);
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
