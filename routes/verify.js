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
        const ip = req.client.localAddress;
        if (!user || !pass)
            return res
                .status(401)
                .json({ error: "user and/or pass missing in request", ip: ip });
        if (user.length < 3)
            return res.status(401).json({ error: "user too short", ip: ip });
        const searchResponse = await getDN4user(user);
        if (searchResponse.code != 200) {
            return res
                .status(searchResponse.code)
                .json({ error: searchResponse.result, ip: ip });
        }

        // console.log("result so far", searchResponse.result);
        // kick out service DN to protect
        if (
            searchResponse.result.dn.toLowerCase() ===
            process.env.SERVICE_DN.toLocaleLowerCase()
        ) {
            return res
                .status(401)
                .json({ error: "Service DN not allowed", ip: ip });
        }

        const bindSuccess = await tryBind(searchResponse.result.dn, pass); //boolean
        console.log(" indsuccess", bindSuccess);
        if (bindSuccess) {
            searchResponse.result["auth"] = bindSuccess;
            return res.status(200).json(searchResponse.result);
        } else {
            return res.status(401).json({
                auth: false,
                ip: ip,
                error: "Invalid Creds",
            });
        }
        return res.status(200).json(searchResponse);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
function getDN4user(user) {
    // resolve undefined for 400s {code, result}
    // reject for 500s {new Error}
    return new Promise((resolve, reject) => {
        if (user.includes("*")) {
            return resolve({ code: 401, result: "Wildcards Forbidden" });
        }
        const attributes = [
            "dn",
            "mail",
            "description",
            "displayName",
            "physicalDeliveryOfficeName",
        ];
        const options = {
            filter: `(cn=${user})`,
            scope: "sub",
            attributes: attributes,
        };
        // console.log("getDN4user options: ", options);
        serviceClient.search(process.env.SEARCH_BASE, options, (err, res) => {
            const dns = { results: [] };
            res.on("searchRequest", (req) => {
                dns["searchrequest"] = req;
                console.log("on Request");
            });
            res.on("searchEntry", (entry) => {
                console.log("on searchEntry");
                dns.results.push({
                    // TODO stuff *all* attributes in here
                    dn: entry.pojo.objectName,
                    description: entry.pojo.attributes[0]["values"][0],
                    mail: entry.pojo.attributes[1]["values"][0],
                });
            });
            res.on("searchReference", (referral) => {
                console.log("on searchReference");
                dns["referral"] = referral;
            });
            res.on("end", (result) => {
                console.log(
                    `on end status: ${result.status}, dns: ${dns.results.length}`
                );
                dns["end"] = result;
                if (result.status != 0) {
                    return reject(
                        new Error(
                            `LDAP Status ${result.status}, results: ${dns.results.length}`
                        )
                    );
                }

                if (dns.results.length != 1) {
                    return resolve({
                        code: 401,
                        result: `${dns.results.length} Users`,
                    });
                }
                resolve({ code: 200, result: dns.results[0] });
            });
            res.on("error", (err) => {
                console.error("on error");
                reject(err);
            });
        });
    });
}
async function tryBind(binddn, pass, cb) {
    // TODO try bind later
    console.log("tryBind");
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
