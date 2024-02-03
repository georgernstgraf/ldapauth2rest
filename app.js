console.log('START app.js');
const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());

app.use(express.json());
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        const ip = req.headers['x-real-ip'] || req.client.localAddress;
        const msg = err.message;
        console.log(`ERROR [${msg}] from [${ip}]`);
        res.status(400).json({
            error: 'Invalid JSON format',
            msg: msg,
            ip: ip,
        });
    } else {
        next(err);
    }
});

const { verifyRouter } = require('./routes/verify.js');
app.use(process.env.LOCATION, verifyRouter);

const port = Number(process.env.LISTEN_PORT);
app.listen(port, (msg) => {
    if (msg) console.error(msg);
    else console.log(`INFO app listens on Port ${port}`);
});
