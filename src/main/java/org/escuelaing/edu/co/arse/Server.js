const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Simulación de base de datos
let strokes = [];
let users = {};

// Obtener los "strokes"
app.get('/api/strokes', (req, res) => {
    res.json(strokes);
});

// Guardar un stroke o varios strokes
app.post('/api/strokes', (req, res) => {
    const payload = req.body;
    if (Array.isArray(payload)) {
        // flatten any nested arrays defensively
        const flat = payload.flat(Infinity);
        strokes = strokes.concat(flat);
    } else if (payload) {
        strokes.push(payload);
    } else {
        return res.status(400).json({ error: 'No stroke provided' });
    }

    // Limitar el tamaño
    if (strokes.length > 2000) strokes = strokes.slice(-2000);
    res.status(201).json({ total: strokes.length });
});

// Obtener los usuarios
app.get('/api/users', (req, res) => {
    res.json(users);
});

// Asignar color a un usuario
app.post('/api/users', (req, res) => {
    const { userId, color } = req.body;
    if (!userId || !color) return res.status(400).json({ error: 'userId and color required' });
    users[userId] = color;
    res.status(201).json({ userId, color });
});

// Borrar el tablero
app.post('/api/clear', (req, res) => {
    strokes = [];
    res.status(200).json({ message: 'Tablero borrado' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
