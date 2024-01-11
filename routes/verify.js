const express = require('express');
const ldap = require('ldapjs');
const { IPTracer } = require('./iptracer.js');
const { Response } = require('./response.js');
const verifyRouter = express.Router();
const serviceClient = getServiceClient();
console.log(`created serviceClient, but still unbound`);
const ipTracer = new IPTracer();
function getServiceClient() {
    // this function throws
    console.log(`creating serviceClient`);
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
        reconnect: true,
        idleTimeout: 10 * 60 * 1000,
    });
    console.log('now binding serviceClient');
    client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, (err) => {
        if (!err) {
            console.log(`bound serviceClient DN: ${process.env.SERVICE_DN}`);
        } else {
            console.error(
                `throwing Error binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
            );
            throw new Error(
                `Binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
            );
        }
    });
    client.on('connect', (_) => console.log('client on connect'));
    client.on('reconnect', () => {
        console.log('Reconnecting...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, (err) => {
            if (!err) {
                console.log(
                    `Re-bound serviceClient DN: ${process.env.SERVICE_DN}`
                );
            } else {
                console.error(
                    `Error re-binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
                );
            }
        });
    });
    return client;
}
verifyRouter.post('/', async (req, res) => {
    const ip = req.client.localAddress;
    const user = req.body.user;
    const pass = req.body.passwd;
    console.log(`POST /verify from [${ip}] for user [${user}]`);
    try {
        if (ipTracer.isBlocked(ip)) {
            console.log(`ERROR [${ip}] is blocked`);
            return res.status(401).json({
                auth: false,
                error: `too many failures from IP: ${ip}`,
                ip: ip,
            });
        }
        if (!user || !pass) {
            ipTracer.registerFail(ip);
            console.log(`ERROR [${ip}] user or pass missing in the request`);
            const response = new Response(
                401,
                'user and/or pass missing in request',
                ip
            );
            return res.status(response.code).json(response);
        }
        if (user.length < 3) {
            ipTracer.registerFail(ip);
            console.log(`ERROR [${ip}] user too short`);
            const response = new Response(401, 'user too short', ip);
            return res.status(response.code).json(response);
        }
        const searchResponse = await getUserDN(user, ip);
        if (searchResponse.code != 200) {
            ipTracer.registerFail(ip);
            console.log(
                `ERROR [${ip}] searchResponse.code: ${searchResponse.code} (${searchResponse.error})`
            );
            return res.status(searchResponse.code).json(searchResponse);
        }
        if (
            searchResponse.result.dn.toLowerCase() ===
            process.env.SERVICE_DN.toLocaleLowerCase()
        ) {
            ipTracer.registerFail(ip);
            console.log(`ERROR [${ip}] Service DN not allowed`);
            response = new Response(401, 'Service DN not allowed', ip);
            return res.status(response.code).json(response);
        }
        const bindSuccess = await tryBind(searchResponse.result.dn, pass); //boolean
        // searchResponse.result['auth'] = bindSuccess;
        if (bindSuccess) {
            console.log(`INFO [${ip}] credentials OK for user [${user}]`);
            return res.status(searchResponse.code).json(searchResponse);
        } else {
            ipTracer.registerFail(ip);
            console.log(`ERROR [${ip}] Invalid Credentials for user [${user}]`);
            const response = new Response(401, 'Invalid Credentials', ip);
            return res.status(response.code).json(response);
        }
    } catch (e) {
        console.error(`ERROR [${ip}] CATCH 500 Error: ${e.message}`);
        const response = new Response(500, e.message, ip);
        res.status(response.code).json(response);
    }
});
function getUserDN(user, ip) {
    // resolve undefined for 400s {code, result}
    // reject for 500s {new Error}
    // TODO only return response objects
    function resultFromResponse(response) {
        const result = {};
        result.dn = response.pojo.objectName;
        response.attributes.forEach((attr) => {
            const pojo = attr.pojo;
            result[pojo.type] = pojo.values.join(', ');
        });
        return result;
    }
    return new Promise((resolve, reject) => {
        if (user.includes('*')) {
            return resolve(new Response(401, 'Wildcards Forbidden', ip));
        }
        const attributes = [
            'dn',
            'mail',
            'description',
            'displayName',
            'physicalDeliveryOfficeName',
        ];
        const options = {
            filter: `(cn=${user})`,
            scope: 'sub',
            attributes: attributes,
        };
        // console.log("getDN4user options: ", options);
        serviceClient.search(process.env.SEARCH_BASE, options, (err, res) => {
            const searchStatus = {
                results: [],
                searchRequest: [],
                searchReference: [],
                end: [],
            };
            res.on('searchRequest', (req) => {
                searchStatus.searchRequest.push(req);
            });
            res.on('searchEntry', (entry) => {
                console.log(`on searchEntry: ${entry.pojo.objectName}`);
                searchStatus.results.push(entry);
                // TODO stuff *all* attributes in here
                // dn: entry.pojo.objectName,
                // description: entry.pojo.attributes[0]['values'][0],
                // mail: entry.pojo.attributes[1]['values'][0],
            });
            res.on('searchReference', (referral) => {
                searchStatus.referral.push(referral);
            });
            res.on('end', (result) => {
                searchStatus.end.push(result);
                if (result.status != 0) {
                    return resolve(
                        new Response(
                            401,
                            `LDAP Status ${result.status}, results: ${searchStatus.results.length}`,
                            ip
                        )
                    );
                }
                if (searchStatus.results.length != 1) {
                    return resolve(
                        new Response(
                            401,
                            `${searchStatus.results.length} Users`,
                            ip
                        )
                    );
                }
                return resolve(
                    new Response(
                        200,
                        null,
                        ip,
                        resultFromResponse(searchStatus.results[0])
                    )
                );
            });
            res.on('error', (err) => {
                return resolve(new Response(500, err.message, ip));
            });
        });
    });
}
async function tryBind(binddn, pass) {
    if (!binddn || !pass) {
        return false;
    }
    const hiddenpass = pass.replace(/./g, '*');
    console.log(`trying bind: [${binddn} / ${hiddenpass}]`);
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
    });
    return await new Promise((resolve, reject) => {
        client.bind(binddn, pass, (err) => {
            if (!err) {
                console.log(`SUCESS in binding ${binddn}`);
                return resolve(true);
            } else {
                console.log(`FAIL in binding ${binddn}`);
                return resolve(false);
            }
        });
    });
}
module.exports = { verifyRouter };
