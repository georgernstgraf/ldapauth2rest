console.log('START app.js');
const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());

app.use(express.json());
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'Invalid JSON format' });
    } else {
        next(err);
    }
});

const { verifyRouter } = require('./routes/verify.js');
app.use('/verify', verifyRouter);

const port = Number(process.env.LISTEN_PORT);
app.listen(port, (msg) => {
    if (msg) console.error(msg);
    else console.log(`express app listens on Port ${port}`);
});
