const express = require("express");
const app = express();
app.use(express.json());

const { verifyRouter } = require("./routes/verify");
app.use("/verify", verifyRouter);
app.listen(3000, (msg) => {
    if (msg) console.error(msg);
    else console.log("Servicer listens on Port 3000");
});
