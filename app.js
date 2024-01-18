console.log('START app.js');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
const port = Number(process.env.LISTEN_PORT);
const { verifyRouter } = require('./routes/verify.js');
app.use('/verify', verifyRouter);
app.listen(port, (msg) => {
    if (msg) console.error(msg);
    else console.log(`express app listens on Port ${port}`);
});
