(() => {
    const sections = [
        document.getElementById('stats'),
        document.getElementById('background')
    ].filter(Boolean);

    if (!sections.length) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const visibleSections = new Set();

    const motionAllowed = () => !reducedMotion.matches && !connection?.saveData && !document.hidden;

    const syncMotion = () => {
        sections.forEach((section) => {
            section.classList.toggle(
                'ambient-live',
                motionAllowed() && visibleSections.has(section)
            );
        });
    };

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) visibleSections.add(entry.target);
                else visibleSections.delete(entry.target);
            });
            syncMotion();
        }, { threshold: 0.01, rootMargin: '180px 0px' });

        sections.forEach((section) => observer.observe(section));
    } else {
        sections.forEach((section) => visibleSections.add(section));
        syncMotion();
    }

    document.addEventListener('visibilitychange', syncMotion);
    reducedMotion.addEventListener?.('change', syncMotion);
})();
