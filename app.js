const express = require('express');
const app = express();
app.use(express.json());
const port = Number(process.env.LISTEN_PORT);
const { verifyRouter } = require('./routes/verify.js');
app.use('/verify', verifyRouter);
app.listen(port, (msg) => {
    if (msg) console.error(msg);
    else console.log(`express app listens on Port ${port}`);
});
