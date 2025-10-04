const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Simulación de base de datos
let strokes = [];
let users = {};

// Obtener los "strokes"
app.get('/api/strokes', (req, res) => {
    res.json(strokes);
});

// Guardar un stroke
app.post('/api/strokes', (req, res) => {
    const newStroke = req.body;
    strokes.push(newStroke);
    if (strokes.length > 2000) strokes = strokes.slice(-2000); // Limitar el tamaño
    res.status(201).json(newStroke);
});

// Obtener los usuarios
app.get('/api/users', (req, res) => {
    res.json(users);
});

// Asignar color a un usuario
app.post('/api/users', (req, res) => {
    const { userId, color } = req.body;
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
