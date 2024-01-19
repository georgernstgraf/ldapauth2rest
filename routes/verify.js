const express = require('express');
const ldap = require('ldapjs');
const { FailureTracker } = require('./failuretracker.js');
const { Response } = require('./response.js');
const verifyRouter = express.Router();
verifyRouter.use(express.static('./static'));
const serviceClient = getServiceClient();
console.log(`created serviceClient, but still unbound`);
const failureTracker = new FailureTracker();
function bindCB(err) {
    if (!err) {
        console.log(`client bound with dn [${process.env.SERVICE_DN}]`);
    } else {
        console.error(
            `throwing Error binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
        );
        throw new Error(
            `Binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
        );
    }
}

function getServiceClient() {
    // this function throws
    console.log(`creating serviceClient`);
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
        reconnect: true,
        idleTimeout: 15 * 60 * 1000, // 15 minutes
    });
    console.log('registering connect for client');
    client.on('connect', (_) => {
        console.log('client_on_connect: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('registering reconnect for client');
    client.on('reconnect', () => {
        console.log('client_on_reconnect: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('registering error for client');
    client.on('error', (err) => {
        console.error(`client_on_error [${err.message}]`);
    });
    console.log('registering close for client');
    client.on('close', () => {
        console.log('client_on_close');
    });
    console.log('registering timeout for client');
    client.on('timeout', () => {
        console.log('client_on_timeout');
    });
    console.log('registering end for client');
    client.on('end', () => {
        console.log('client_on_end');
    });
    console.log('registering idle for client');
    client.on('idle', () => {
        console.log('client_on_idle: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('registering destroy for client');
    client.on('destroy', () => {
        console.log('client_on_destroy');
    });
    console.log('registering unbind for client');
    client.on('unbind', () => {
        console.log('client_on_unbind');
    });
    return client;
}
verifyRouter.post('/', async (req, res) => {
    const ip = req.headers['x-real-ip'] || req.client.localAddress;
    const user = req.body.user ? req.body.user.toLowerCase() : undefined;
    const pass = req.body.passwd;
    console.log(`POST /verify from [${ip}] for user [${user}]`);
    try {
        if (failureTracker.isBlocked(ip, user)) {
            console.log(
                `ERROR [${FailureTracker.getToken(ip, user)}] is blocked`
            );
            return res.status(401).json({
                auth: false,
                error: `too many failures, try again later`,
                ip: ip,
            });
        }
        if (!user || !pass) {
            failureTracker.registerFail(ip, user);
            console.log(
                `ERROR [${ip}:${user}] user or pass missing in the request`
            );
            const response = new Response(
                401,
                'user and/or pass missing in request',
                ip
            );
            return res.status(response.code).json(response);
        }
        if (user.length < 3) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}:${pass}] user too short`);
            const response = new Response(401, 'user too short', ip);
            return res.status(response.code).json(response);
        }
        const searchResponse = await getUserDN(user, ip);
        if (searchResponse.code != 200) {
            failureTracker.registerFail(ip, user);
            console.log(
                `ERROR [${ip}:${user}] searchResponse.code: ${searchResponse.code} (${searchResponse.error})`
            );
            return res.status(searchResponse.code).json(searchResponse);
        }
        if (
            searchResponse.result.dn.toLowerCase() ===
            process.env.SERVICE_DN.toLocaleLowerCase()
        ) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}] Service DN not allowed`);
            response = new Response(401, 'Service DN not allowed', ip);
            return res.status(response.code).json(response);
        }
        const bindSuccess = await tryBind(searchResponse.result.dn, pass); //boolean
        // searchResponse.result['auth'] = bindSuccess;
        if (bindSuccess) {
            console.log(`INFO [${ip}] credentials OK for user [${user}]`);
            return res.status(searchResponse.code).json(searchResponse);
        } else {
            failureTracker.registerFail(ip, user);
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
        if (user.match('[()*]')) {
            return resolve(
                new Response(401, 'no special characters please', ip)
            );
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
        try {
            // console.log("getDN4user options: ", options);
            serviceClient.search(
                process.env.SEARCH_BASE,
                options,
                (err, res) => {
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
                        searchStatus.results.push(entry);
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
                        console.log(`res.on.error: ${err.message}`);
                        return resolve(new Response(500, err.message, ip));
                    });
                }
            );
        } catch (e) {
            console.log(`ERROR .. catch serviceClient search: [${e.message}]`);
            return resolve(new Response(500, e.message, ip));
        }
    });
}
async function tryBind(binddn, pass) {
    if (!binddn || !pass) {
        return false;
    }
    const hiddenpass = pass.replace(/./g, '*');
    console.log(`checking passwort trying a bind: [${binddn} / ${hiddenpass}]`);
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
    });
    return await new Promise((resolve, reject) => {
        client.bind(binddn, pass, (err) => {
            client.unbind((e) => {
                console.log(`checkClient.unbind`);
                if (e) {
                    console.error(
                        `Error unbinding checkclient: [${e.message}]`
                    );
                }
            });
            if (!err) {
                console.log(`checkclient: SUCESS in binding [${binddn}]`);
                return resolve(true);
            } else {
                console.log(`checkClient: FAIL in binding [${binddn}]`);
                return resolve(false);
            }
        });
    });
}
module.exports = { verifyRouter };
