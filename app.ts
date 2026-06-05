import express from "express";
import cors from "cors";
import { verifyRouter } from "./routes/verify.ts";

const app = express();

app.use(cors());

app.use(express.json());
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((err as unknown as Record<string, unknown>).type === "entity.parse.failed") {
        const ip = req.headers["x-real-ip"] as string | undefined ||
            req.socket.localAddress;
        const msg = err.message;
        console.log(`ERROR [${msg}] from [${ip}]`);
        res.status(400).json({
            error: "Invalid JSON format",
            msg: msg,
            ip: ip,
        });
    } else {
        next(err);
    }
});

const location = Deno.env.get("LOCATION") || "/verify";
app.use(location, verifyRouter);

const port = Number(Deno.env.get("LISTEN_PORT"));
app.listen(port, (msg?: Error) => {
    if (msg) console.error(msg);
    else console.log(`INFO app listens on Port ${port}`);
});
