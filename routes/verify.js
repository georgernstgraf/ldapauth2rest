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
    const client = ldap.createClient({
        url: process.env.SERVICE_URL,
        reconnect: true,
    });
    client.bind(process.env.SERVICE_DN, process.env.SERVICE_PW, (err) => {
        if (!err) {
            console.log(`bound serviceClient DN: ${process.env.SERVICE_DN}`);
        } else {
            throw new Error(
                `Binding Service DN: ${process.env.SERVICE_DN}\n${err.message}`
            );
        }
    });
    return client;
}
verifyRouter.post('/', async (req, res) => {
    const ip = req.client.localAddress;
    try {
        const user = req.body.user;
        const pass = req.body.passwd;
        if (ipTracer.isBlocked(ip)) {
            return res.status(401).json({
                auth: false,
                error: 'too many failures from this IP',
                ip: ip,
            });
        }
        if (!user || !pass) {
            ipTracer.registerFail(ip);
            const response = new Response(
                401,
                'user and/or pass missing in request',
                ip
            );
            return res.status(response.code).json(response);
        }
        if (user.length < 3) {
            ipTracer.registerFail(ip);
            const response = new Response(401, 'user too short', ip);
            return res.status(response.code).json(response);
        }
        const searchResponse = await getUserDN(user, ip);
        if (searchResponse.code != 200) {
            ipTracer.registerFail(ip);
            return res.status(searchResponse.code).json(searchResponse);
        }
        // console.log("result so far", searchResponse.result);
        // kick out service DN to protect
        if (
            searchResponse.result.dn.toLowerCase() ===
            process.env.SERVICE_DN.toLocaleLowerCase()
        ) {
            ipTracer.registerFail(ip);
            response = new Response(401, 'Service DN not allowed', ip);
            return res.status(response.code).json(response);
        }
        const bindSuccess = await tryBind(searchResponse.result.dn, pass); //boolean
        console.log(`bindsuccess for user ${user} is ${bindSuccess}`);
        searchResponse.result['auth'] = bindSuccess;
        if (bindSuccess) {
            return res.status(searchResponse.code).json(searchResponse);
        } else {
            ipTracer.registerFail(ip);
            const response = new Response(401, 'Invalid Credentials', ip);
            return res.status(response.code).json(response);
        }
    } catch (e) {
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
    console.log(`Trying BIND with CREDS: ${binddn} / ${pass}`);
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
