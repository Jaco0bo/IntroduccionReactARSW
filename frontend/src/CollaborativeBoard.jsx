import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import p5 from 'p5';

const PALETTE = [
    '#e63946', '#1440c4', '#2a9d8f', '#ea05de', '#8d99ae',
    '#6a4c93', '#ffb703', '#219ebc', '#fb8500', '#006d77'
];

function genId() {
    return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

export default function CollaborativeBoard() {
    const containerRef = useRef(null);
    const p5Ref = useRef(null);
    const myIdRef = useRef(null);
    const myColorRef = useRef(null);
    const strokesRef = useRef([]);
    const pendingRef = useRef([]);
    const currentRef = useRef(null);

    // Assign id & color
    useEffect(() => {
        let myId = sessionStorage.getItem('drawing_my_id');
        if (!myId) {
            myId = genId();
            sessionStorage.setItem('drawing_my_id', myId);
        }
        myIdRef.current = myId;

        axios.get('http://localhost:5000/api/users')
            .then(res => {
                const users = res.data || {};
                if (users[myId]) {
                    myColorRef.current = users[myId];
                } else {
                    const used = new Set(Object.values(users));
                    const pick = PALETTE.find(c => !used.has(c)) || PALETTE[Math.floor(Math.random() * PALETTE.length)];
                    return axios.post('http://localhost:5000/api/users', { userId: myId, color: pick })
                        .then(() => { myColorRef.current = pick; })
                        .catch(() => { myColorRef.current = pick; });
                }
            })
            .catch(() => {
                myColorRef.current = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            });
    }, []);

    // Initialize p5
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // ensure container has visible size
        container.style.width = container.style.width || '800px';
        container.style.height = container.style.height || '600px';

        // remove previous p5 instance if any
        if (p5Ref.current) {
            try { p5Ref.current.remove(); } catch (_) {}
            p5Ref.current = null;
        }

        // remove any leftover canvas elements inside the container
        const old = container.querySelectorAll('canvas');
        if (old.length) old.forEach(c => c.remove());

        const sketch = (p) => {
            p.setup = () => {
                p.createCanvas(800, 600);
                p.background(255);
            };

            p.draw = () => {
                p.background(255);
                p.noStroke();

                for (const s of strokesRef.current || []) {
                    p.fill(s.color || '#000');
                    for (const pt of s.points || []) p.ellipse(pt.x, pt.y, s.size || 12, s.size || 12);
                }

                const curr = currentRef.current;
                if (curr) {
                    p.fill(curr.color || '#000');
                    for (const pt of curr.points || []) p.ellipse(pt.x, pt.y, curr.size || 12, curr.size || 12);
                }
            };

            function inCanvas() {
                return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
            }

            p.mousePressed = () => {
                if (!inCanvas()) return;
                currentRef.current = {
                    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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
                const finished = currentRef.current;
                pendingRef.current.push(finished);
                strokesRef.current = strokesRef.current.concat([finished]);
                currentRef.current = null;
                axios.post('http://localhost:5000/api/strokes', finished).catch(() => {});
            };

            p.keyPressed = () => {
                if (p.key === 'c' || p.key === 'C') {
                    axios.post('http://localhost:5000/api/clear').then(() => {
                        strokesRef.current = [];
                        pendingRef.current = [];
                    }).catch(() => {});
                }
            };
        };

        p5Ref.current = new p5(sketch, container);

        return () => {
            if (p5Ref.current) {
                try { p5Ref.current.remove(); } catch (_) {}
                p5Ref.current = null;
            }
        };
    }, []);

    // flush pending strokes in batches
    useEffect(() => {
        const id = setInterval(async () => {
            const pending = pendingRef.current;
            if (!pending || pending.length === 0) return;
            const toSend = pending.slice();
            try {
                await axios.post('http://localhost:5000/api/strokes', toSend);
                pendingRef.current = pendingRef.current.filter(s => !toSend.some(t => t.id === s.id));
            } catch (_) {}
        }, 200);
        return () => clearInterval(id);
    }, []);

    // poll server for strokes
    useEffect(() => {
        const id = setInterval(async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/strokes');
                strokesRef.current = Array.isArray(res.data) ? res.data : [];
            } catch (_) {}
        }, 400);
        return () => clearInterval(id);
    }, []);

    function doClear() {
        axios.post('http://localhost:5000/api/clear').then(() => {
            strokesRef.current = [];
            pendingRef.current = [];
        }).catch(() => {});
    }

    return (
        <div id="app" style={{ padding: 12 }}>
            <div id="controls" style={{ marginBottom: 8 }}>
                <div>Your ID: <code>{myIdRef.current}</code></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>Your color: <span className="badge" style={{ background: myColorRef.current || '#999', padding: '0.25em 0.5em', color: '#fff' }}>{myColorRef.current || '...'}</span></div>
                    <button onClick={doClear}>Clear board</button>
                </div>
            </div>

            <div id="canvas-wrap" ref={containerRef} />
        </div>
    );
}


