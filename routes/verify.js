const express = require('express');
const ldap = require('ldapjs');
const { FailureTracker } = require('./failuretracker.js');
const { Response } = require('./response.js');
const verifyRouter = express.Router();
verifyRouter.use(express.static('./static'));
const serviceClient = getServiceClient();
console.log(`INFO created serviceClient (async)`);
const failureTracker = new FailureTracker();

const failcodes = {
    '#CRI': 'Credentials Invalid',
    '#NBW': 'No Brackets or Wildcards',
    '#SUF': 'Service User Forbidden',
    '#NU#': 'Number of Users',
    '#TMF': 'Too Many Failures',
    '#UPM': 'User/Password Missing',
    '#UTS': 'User Too Short',
};
function bindCB(err) {
    if (!err) {
        console.log(`INFO client bound with dn [${process.env.SERVICE_DN}]`);
    } else {
        console.error(
            `ERROR binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
        );
        throw new Error(
            `Binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
        );
    }
}

function getServiceClient() {
    // this function throws
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
        reconnect: true,
        idleTimeout: process.env.IDLE_TIMEOUT * 1000, // 15 minutes
    });
    console.log(
        `INFO created serviceClient (url: ${
            process.env.SERVICE_URL
        }, idleTimeout: ${process.env.IDLE_TIMEOUT * 1000})`
    );
    console.log('INFO registering connect for client');
    client.on('connect', (_) => {
        console.log('INFO client_on_connect: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('INFO registering reconnect for client');
    client.on('reconnect', () => {
        console.log('WARN client_on_reconnect: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('INFO registering error for client');
    client.on('error', (err) => {
        console.error(`ERROR client_on_error [${err.message}]`);
    });
    console.log('INFO registering close for client');
    client.on('close', () => {
        console.log('INFO client_on_close');
    });
    console.log('INFO registering timeout for client');
    client.on('timeout', () => {
        console.log('INFO client_on_timeout');
    });
    console.log('INFO registering end for client');
    client.on('end', () => {
        console.log('INFO client_on_end');
    });
    console.log('INFO registering idle for client');
    client.on('idle', () => {
        console.log('INFO client_on_idle: binding ...');
        client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, bindCB);
    });
    console.log('INFO registering destroy for client');
    client.on('destroy', () => {
        console.log('INFO client_on_destroy');
    });
    console.log('INFO registering unbind for client');
    client.on('unbind', () => {
        console.log('INFO client_on_unbind');
    });
    return client;
}
verifyRouter.post('/', async (req, res) => {
    const ip = req.headers['x-real-ip'] || req.client.localAddress;
    const user = req.body.user ? req.body.user.toLowerCase() : undefined;
    const passwd = req.body.passwd;
    console.log(`INFO POST /verify from [${ip}] for user [${user}]`);
    try {
        if (failureTracker.isBlocked(ip, user)) {
            console.log(
                `INFO [${FailureTracker.getToken(ip, user)}] is blocked`
            );
            const response = new Response(
                401,
                'Invalid Credentials (#TMF)',
                user,
                ip
            );
            return res.status(response.code).json(response);
        }
        if (!user || !passwd) {
            failureTracker.registerFail(ip, user);
            console.log(
                `ERROR [${ip}:${user}] user or passwd missing in request`
            );
            const response = new Response(
                401,
                'Invalid Credentials (#UPM)',
                user,
                ip
            );
            return res.status(response.code).json(response);
        }
        if (user.length < 3) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}:${passwd}] user too short`);
            const response = new Response(
                401,
                'Invalid Credentials (#UTS)',
                user,
                ip
            );
            return res.status(response.code).json(response);
        }
        if (process.env.SERVICE_DN.toLowerCase().includes(user)) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}] Service DN not allowed`);
            response = new Response(
                401,
                'Invalid Credentials (#SUF)',
                user,
                ip
            );
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
        const bindSuccess = await bindPossible(
            searchResponse.result.dn,
            passwd
        ); //boolean
        // searchResponse.result['auth'] = bindSuccess;
        if (bindSuccess) {
            console.log(`INFO [${ip}] credentials OK for user [${user}]`);
            return res.status(searchResponse.code).json(searchResponse);
        } else {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}] Invalid Credentials for user [${user}]`);
            const response = new Response(
                401,
                'Invalid Credentials (#CRI)',
                user,
                ip
            );
            return res.status(response.code).json(response);
        }
    } catch (e) {
        console.error(`ERROR [${ip}] CATCH 500 Error: ${e.message}`);
        const response = new Response(500, e.message, user, ip);
        res.status(response.code).json(response);
    }
});
function getUserDN(user, ip) {
    // returns response objects
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
                new Response(401, 'Invalid Credentials (#NBW)', user, ip)
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
                                    user,
                                    ip
                                )
                            );
                        }
                        if (searchStatus.results.length != 1) {
                            return resolve(
                                new Response(
                                    401,
                                    `Invalid Credentials (#NU${searchStatus.results.length})`,
                                    user,
                                    ip
                                )
                            );
                        }
                        return resolve(
                            new Response(
                                200,
                                null,
                                user,
                                ip,
                                resultFromResponse(searchStatus.results[0])
                            )
                        );
                    });
                    res.on('error', (error) => {
                        console.log(`ERROR res.on.error: ${error.message}`);
                        return resolve(
                            new Response(500, error.message, user, ip)
                        );
                    });
                }
            );
        } catch (error) {
            console.log(
                `ERROR .. catch serviceClient search: [${error.message}]`
            );
            return resolve(new Response(500, error.message, user, ip));
        }
    });
}
async function bindPossible(binddn, pass) {
    // returns boolean
    if (!binddn || !pass) {
        return false;
    }
    const hiddenpass = pass.replace(/./g, '*');
    console.log(
        `INFO checking passwort trying a bind: [${binddn} / ${hiddenpass}]`
    );
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
    });
    return await new Promise((resolve, reject) => {
        client.bind(binddn, pass, (bError) => {
            client.unbind((ubError) => {
                console.log(`INFO checkClient.unbind`);
                if (ubError) {
                    console.error(
                        `ERROR unbinding checkclient: [${ubError.message}]`
                    );
                }
            });
            if (!bError) {
                console.log(`INFO checkclient: SUCESS in binding [${binddn}]`);
                return resolve(true);
            } else {
                console.log(`INFO checkClient: FAIL in binding [${binddn}]`);
                return resolve(false);
            }
        });
    });
}
module.exports = { verifyRouter };
