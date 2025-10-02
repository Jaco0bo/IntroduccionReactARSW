const { useEffect, useRef } = React;

// Constantes y utlidades
const KEY_STROKES = 'shared_drawing_strokes_v1';
const KEY_USERS = 'shared_drawing_users_v1';
const KEY_CLEAR = 'shared_drawing_clear_v1';

const PALETTE = [
    '#e63946', '#1440c4', '#2a9d8f', '#ea05de', '#8d99ae',
    '#6a4c93', '#ffb703', '#219ebc', '#fb8500', '#006d77'
];

function genId() {
    return 'u' + Date.now().toString(36) + Math.floor(Math.random()*1000).toString(36);
}

// Componente principal
function CollaborativeBoard() {
    const containerRef = useRef(null);

    // refs de datos
    const myIdRef = useRef(null);
    const myColorRef = useRef(null);
    const strokesRef = useRef([]);        // strokes a dibujar
    const pendingRef = useRef([]);        // strokes locales no guardadas aún
    const currentRef = useRef(null);      // stroke en construcción
    const lastSerialized = useRef('');

    // Asignarle id y color
    useEffect(() => {
        // ID por pestaña
        let myId = sessionStorage.getItem('drawing_my_id');
        if (!myId) {
            myId = genId();
            sessionStorage.setItem('drawing_my_id', myId);
        }
        myIdRef.current = myId;

        // Asigna o reutiliza color en KEY_USERS
        try {
            const usersRaw = localStorage.getItem(KEY_USERS) || '{}';
            const users = JSON.parse(usersRaw);

            if (users[myId]) {
                myColorRef.current = users[myId];
            } else {
                // Elegimos un color no usado si es posible
                const used = new Set(Object.values(users));
                let pick = PALETTE.find(c => !used.has(c));
                if (!pick) pick = PALETTE[Math.floor(Math.random()*PALETTE.length)];

                // Guardamos la asignación
                users[myId] = pick;
                localStorage.setItem(KEY_USERS, JSON.stringify(users));
                myColorRef.current = pick;
            }
        } catch (e) {
            myColorRef.current = PALETTE[Math.floor(Math.random()*PALETTE.length)];
        }

        // limpiar asignación al cerrar pestaña
        const onUnload = () => {
            try {
                const users = JSON.parse(localStorage.getItem(KEY_USERS) || '{}');
                if (users && users[myId]) {
                    delete users[myId];
                    localStorage.setItem(KEY_USERS, JSON.stringify(users));
                }
            } catch (e) {}
        };
        window.addEventListener('beforeunload', onUnload);
        return () => window.removeEventListener('beforeunload', onUnload);
    }, []);

    // p5 sketch dentro del componente
    useEffect(() => {
        const p5lib = window.p5;
        const container = containerRef.current;
        if (!p5lib || !container) return;

        const sketch = (p) => {
            p.setup = () => {
                p.createCanvas(800, 600);
                p.background(255);
            };

            p.draw = () => {
                p.background(255);

                // dibujar todos los strokes
                const strokes = strokesRef.current || [];
                p.noStroke();
                for (const s of strokes) {
                    p.fill(s.color);
                    for (const pt of s.points) {
                        p.ellipse(pt.x, pt.y, s.size || 12, s.size || 12);
                    }
                }

                // dibujar el stroke actual
                const curr = currentRef.current;
                if (curr) {
                    p.fill(curr.color);
                    for (const pt of curr.points) p.ellipse(pt.x, pt.y, curr.size || 12, curr.size || 12);
                }
            };

            function inCanvas() {
                return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
            }

            p.mousePressed = () => {
                if (!inCanvas()) return;
                currentRef.current = {
                    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
                    userId: myIdRef.current,
                    color: myColorRef.current,
                    size: 14,
                    points: [{ x: p.mouseX, y: p.mouseY }]
                };
            };

            p.mouseDragged = () => {
                if (!currentRef.current) return;
                if (!inCanvas()) return;
                currentRef.current.points.push({ x: p.mouseX, y: p.mouseY });
            };

            p.mouseReleased = () => {
                if (!currentRef.current) return;
                pendingRef.current.push(currentRef.current);
                strokesRef.current = strokesRef.current.concat([currentRef.current]);
                currentRef.current = null;
            };

            p.keyPressed = () => {
                if (p.key === 'c' || p.key === 'C') {
                    doClear();
                }
            };
        };

        const myp5 = new p5lib(sketch, container);
        return () => {
            try { myp5.remove(); } catch(e) {}
        };
    }, []);

    // Flush de pendientes a localStorage
    useEffect(() => {
        const FLUSH_MS = 200;
        const MAX_STROKES = 2000;

        function flush() {
            const pending = pendingRef.current;
            if (!pending || pending.length === 0) return;
            try {
                const raw = localStorage.getItem(KEY_STROKES) || '[]';
                const existing = JSON.parse(raw);
                const merged = existing.concat(pending);
                const trimmed = merged.slice(-MAX_STROKES);
                localStorage.setItem(KEY_STROKES, JSON.stringify(trimmed));
                lastSerialized.current = JSON.stringify(trimmed);
            } catch (e) {
                console.error('flush error', e);
            } finally {
                pendingRef.current = [];
            }
        }

        const id = setInterval(flush, FLUSH_MS);
        return () => clearInterval(id);
    }, []);

    // Storage event para leer cambios de otros "usuarios"
    useEffect(() => {
        const POLL_MS = 250;
        let lastClear = null;

        function poll() {
            try {
                const clearVal = localStorage.getItem(KEY_CLEAR);
                if (clearVal && clearVal !== lastClear) {
                    lastClear = clearVal;
                    strokesRef.current = [];
                    pendingRef.current = [];
                    lastSerialized.current = JSON.stringify([]);
                }

                // strokes
                const raw = localStorage.getItem(KEY_STROKES) || '[]';
                if (raw !== lastSerialized.current) {
                    strokesRef.current = JSON.parse(raw);
                    lastSerialized.current = raw;
                }
            } catch (e) {
                console.error('poll error', e);
            }
        }

        poll();
        const id = setInterval(poll, POLL_MS);

        const onStorage = (e) => {
            if (e.key === KEY_STROKES || e.key === KEY_CLEAR) poll();
        };
        window.addEventListener('storage', onStorage);

        return () => {
            clearInterval(id);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    function doClear() {
        try {
            localStorage.setItem(KEY_STROKES, JSON.stringify([]));
            localStorage.setItem(KEY_CLEAR, Date.now().toString());
            strokesRef.current = [];
            pendingRef.current = [];
            lastSerialized.current = JSON.stringify([]);
        } catch (e) {
            console.error('clear error', e);
        }
    }

    return (
        <div id="app">
            <div id="controls">
                <div>
                    Tu ID: <code>{localStorage.getItem('drawing_my_id')}</code>
                </div>
                <div>
                    Tu color: <span className="badge" style={{ background: myColorRef.current || '#999' }}>{myColorRef.current || '...'}</span>
                </div>

                <button onClick={() => doClear()}>Borrar tablero (para todos)</button>
                <div style={{ marginLeft: 8 }}><small>Abre esta página en otras pestañas para simular otros usuarios. Pulsa 'C' para borrar también.</small></div>
            </div>

            <div id="canvas-wrap" ref={containerRef}></div>
        </div>
    );
}
ReactDOM.render(<CollaborativeBoard />,
    document.getElementById('root'));
