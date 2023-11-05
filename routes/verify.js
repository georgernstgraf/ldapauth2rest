const express = require("express");
const ldap = require("ldapjs");
const verifyRouter = express.Router();
const serviceClient = getServiceClient();

function getServiceClient() {
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
        reconnect: true,
    });
    client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, (err) => {
        if (!err) console.log("SUCESS in binding Service DN");
        else throw Error("Binding Service DN"); // crashes APP!
    });
    return client;
}
verifyRouter.post("/", async (req, res) => {
    try {
        const user = req.body.user;
        const pass = req.body.passwd;
        if (!user || !pass)
            return res
                .status(401)
                .json({ error: "user and/or pass missing in request" });
        const binddn = await getDN4user(user);
        if (!binddn) {
            return res
                .status(401)
                .json({ error: "user not found", ip: req.client.localAddress });
        }
        // TODO try bind later
        binddn["auth"] = true;
        return res.status(200).json(binddn);
        const bindSuccess = await tryBind(binddn, pass);
        if (bindSuccess) {
            return res.status(200).json({
                auth: true,
                dn: binddn,
            });
        } else {
            return res.status(401).json({
                auth: false,
                error: "Invalid Creds",
                ip: req.client.localAddress,
                // family: req.client.localFamily,
                // port: req.client.localPort,
            });
        }
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});
function getDN4user(user) {
    return new Promise((resolve, reject) => {
        const options = {
            filter: `(mail=${user}@${process.env.SEARCH_MAILDOMAIN})`,
            scope: "sub",
            attributes: ["dn", "mail", "description"],
        };
        console.log("getDN4user options: ", options);
        serviceClient.search(process.env.SEARCH_BASE, options, (err, res) => {
            res.on("searchEntry", (entry) => {
                // console.log("entry: " + JSON.stringify(entry.pojo));
                resolve({
                    dn: entry.pojo.objectName,
                    description: entry.pojo.attributes[0]["values"][0],
                    mail: entry.pojo.attributes[1]["values"][0],
                });
            });
            res.on("error", (err) => {
                console.error("error: " + err.message);
                resolve(undefined);
            });
            res.on("end", (result) => {
                // console.log("end, result: ", result);
                resolve(undefined);
            });
        });
    });
}
async function tryBind(binddn, pass, cb) {
    return true;
    if (!cb) {
        console.error("No Callback provided");
        return;
    }
    if (!binddn || !pass) {
        cb(false);
        return;
    }
    // console.log(`Trying BIND with CREDS: ${binddn} / ${pass}`);
}
module.exports = { verifyRouter };
