import express from "express";
import ldap from "ldapjs";
import { FailureTracker } from "./failuretracker.ts";
import { Response } from "./response.ts";

const verifyRouter = express.Router();
verifyRouter.use(express.static("./static"));
const serviceClient = getServiceClient();
console.log("INFO created serviceClient (async)");
const failureTracker = new FailureTracker();

const _failcodes: Record<string, string> = {
    "#CRI": "Credentials Invalid",
    "#NBW": "No Brackets or Wildcards",
    "#NU#": "Number of Users",
    "#SUF": "Service User Forbidden",
    "#TMF": "Too Many Failures",
    "#UPM": "User/Password Missing",
    "#UTS": "User Too Short",
};

function bindCB(err: Error | null): void {
    if (!err) {
        console.log(`INFO client bound with dn [${Deno.env.get("SERVICE_DN")}]`);
    } else {
        console.error(
            `ERROR binding Service DN: ${Deno.env.get("SERVICE_DN")}\n${err.message}`,
        );
        throw new Error(
            `Binding Service DN: ${Deno.env.get("SERVICE_DN")}\n${err.message}`,
        );
    }
}

function getServiceClient() {
    const client = ldap.createClient({
        url: Deno.env.get("SERVICE_URL")!,
        reconnect: true,
        idleTimeout: Number(Deno.env.get("IDLE_TIMEOUT")) * 1000,
    });
    console.log(
        `INFO created serviceClient (url: ${
            Deno.env.get("SERVICE_URL")
        }, idleTimeout: ${Number(Deno.env.get("IDLE_TIMEOUT")) * 1000})`,
    );
    console.log("INFO registering connect for client");
    client.on("connect", (_: unknown) => {
        console.log("INFO client_on_connect: binding ...");
        client.bind(Deno.env.get("SERVICE_DN")!, Deno.env.get("SERVICE_PW")!, bindCB);
    });
    console.log("INFO registering reconnect for client");
    client.on("reconnect", () => {
        console.log("WARN client_on_reconnect: binding ...");
        client.bind(Deno.env.get("SERVICE_DN")!, Deno.env.get("SERVICE_PW")!, bindCB);
    });
    console.log("INFO registering error for client");
    client.on("error", (err: Error) => {
        console.error(`ERROR client_on_error [${err.message}]`);
    });
    console.log("INFO registering close for client");
    client.on("close", () => {
        console.log("INFO client_on_close");
    });
    console.log("INFO registering timeout for client");
    client.on("timeout", () => {
        console.log("INFO client_on_timeout");
    });
    console.log("INFO registering end for client");
    client.on("end", () => {
        console.log("INFO client_on_end");
    });
    console.log("INFO registering idle for client");
    client.on("idle", () => {
        console.log("INFO client_on_idle: binding ...");
        client.bind(Deno.env.get("SERVICE_DN")!, Deno.env.get("SERVICE_PW")!, bindCB);
    });
    console.log("INFO registering destroy for client");
    client.on("destroy", () => {
        console.log("INFO client_on_destroy");
    });
    console.log("INFO registering unbind for client");
    client.on("unbind", () => {
        console.log("INFO client_on_unbind");
    });
    return client;
}

verifyRouter.post("/", async (req: express.Request, res: express.Response) => {
    const ip = req.headers["x-real-ip"] as string | undefined ||
        req.socket.localAddress;
    const user = req.body.user ? req.body.user.toLowerCase() : undefined;
    const passwd = req.body.passwd;
    console.log(`INFO POST /verify from [${ip}] for user [${user}]`);
    try {
        if (failureTracker.isBlocked(ip, user)) {
            console.log(
                `INFO [${FailureTracker.getToken(ip, user!)}] is blocked`,
            );
            const response = new Response(
                401,
                "Invalid Credentials (#TMF)",
                user,
                ip,
            );
            return res.status(response.code).json(response);
        }
        if (!user || !passwd) {
            failureTracker.registerFail(ip, user);
            console.log(
                `ERROR [${ip}:${user}] user or passwd missing in request`,
            );
            const response = new Response(
                401,
                "Invalid Credentials (#UPM)",
                user,
                ip,
            );
            return res.status(response.code).json(response);
        }
        if (user.length < 3) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}:${passwd}] user too short`);
            const response = new Response(
                401,
                "Invalid Credentials (#UTS)",
                user,
                ip,
            );
            return res.status(response.code).json(response);
        }
        if (Deno.env.get("SERVICE_DN")!.toLowerCase().includes(user)) {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}:${user}] Service DN not allowed`);
            const response = new Response(
                401,
                "Invalid Credentials (#SUF)",
                user,
                ip,
            );
            return res.status(response.code).json(response);
        }
        const searchResponse = await getUserDN(user, ip);
        if (searchResponse.code !== 200) {
            failureTracker.registerFail(ip, user);
            console.log(
                `ERROR [${ip}:${user}] searchResponse.code: ${searchResponse.code} (${searchResponse.error})`,
            );
            return res.status(searchResponse.code).json(searchResponse);
        }
        const resultDn = (searchResponse.result as { dn: string } | null)?.dn;
        const bindSuccess = await bindPossible(
            resultDn,
            passwd,
        );
        if (bindSuccess) {
            console.log(`INFO [${ip}] credentials OK for user [${user}]`);
            return res.status(searchResponse.code).json(searchResponse);
        } else {
            failureTracker.registerFail(ip, user);
            console.log(`ERROR [${ip}] Invalid Credentials for user [${user}]`);
            const response = new Response(
                401,
                "Invalid Credentials (#CRI)",
                user,
                ip,
            );
            return res.status(response.code).json(response);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`ERROR [${ip}] CATCH 500 Error: ${msg}`);
        const response = new Response(500, msg, user, ip);
        res.status(response.code).json(response);
    }
});

interface LdapEntry {
    pojo: {
        objectName: string;
    };
}

interface LdapAttribute {
    pojo: {
        type: string;
        values: string[];
    };
}

interface LdapSearchResult {
    status: number;
}

interface LdapSearchResponse {
    on(event: "searchRequest", listener: (req: unknown) => void): void;
    on(event: "searchEntry", listener: (entry: LdapEntry) => void): void;
    on(event: "searchReference", listener: (referral: unknown) => void): void;
    on(event: "end", listener: (result: LdapSearchResult) => void): void;
    on(event: "error", listener: (error: Error) => void): void;
}

function getUserDN(
    user: string,
    ip: string,
): Promise<Response> {
    function resultFromResponse(response: LdapEntry): Record<string, string> {
        const result: Record<string, string> = {};
        result.dn = response.pojo.objectName;
        // response.attributes is an array from ldapjs — not typed on LdapEntry
        const attrs = (response as unknown as { attributes: LdapAttribute[] })
            .attributes;
        attrs.forEach((attr: LdapAttribute) => {
            const pojo = attr.pojo;
            result[pojo.type] = pojo.values.join(", ");
        });
        return result;
    }

    return new Promise((resolve) => {
        if (user.match("[()*]")) {
            return resolve(
                new Response(401, "Invalid Credentials (#NBW)", user, ip),
            );
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
            scope: "sub" as const,
            attributes: attributes,
        };
        try {
            serviceClient.search(
                Deno.env.get("SEARCH_BASE")!,
                options,
                (_err: Error | null, res: LdapSearchResponse) => {
                    const searchStatus: {
                        results: unknown[];
                        searchRequest: unknown[];
                        searchReference: unknown[];
                        end: unknown[];
                    } = {
                        results: [],
                        searchRequest: [],
                        searchReference: [],
                        end: [],
                    };
                    res.on("searchRequest", (req: unknown) => {
                        searchStatus.searchRequest.push(req);
                    });
                    res.on("searchEntry", (entry: LdapEntry) => {
                        searchStatus.results.push(entry);
                    });
                    res.on("searchReference", (referral: unknown) => {
                        searchStatus.searchReference.push(referral);
                    });
                    res.on("end", (result: LdapSearchResult) => {
                        searchStatus.end.push(result);
                        if (result.status != 0) {
                            return resolve(
                                new Response(
                                    401,
                                    `LDAP Status ${result.status}, results: ${searchStatus.results.length}`,
                                    user,
                                    ip,
                                ),
                            );
                        }
                        if (searchStatus.results.length != 1) {
                            return resolve(
                                new Response(
                                    401,
                                    `Invalid Credentials (#NU${searchStatus.results.length})`,
                                    user,
                                    ip,
                                ),
                            );
                        }
                        return resolve(
                            new Response(
                                200,
                                null,
                                user,
                                ip,
                                resultFromResponse(
                                    searchStatus.results[0] as LdapEntry,
                                ),
                            ),
                        );
                    });
                    res.on("error", (error: Error) => {
                        console.log(`ERROR res.on.error: ${error.message}`);
                        return resolve(
                            new Response(500, error.message, user, ip),
                        );
                    });
                },
            );
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.log(
                `ERROR .. catch serviceClient search: [${msg}]`,
            );
            return resolve(new Response(500, msg, user, ip));
        }
    });
}

async function bindPossible(
    binddn: string | undefined,
    pass: string | undefined,
): Promise<boolean> {
    if (!binddn || !pass) {
        return false;
    }
    const hiddenpass = pass.replace(/./g, "*");
    console.log(
        `INFO checking passwort trying a bind: [${binddn} / ${hiddenpass}]`,
    );
    const client = ldap.createClient({
        url: Deno.env.get("SERVICE_URL")!,
    });
    return await new Promise((resolve) => {
        client.bind(binddn, pass, (bError: Error | null) => {
            client.unbind((ubError: Error | null) => {
                console.log("INFO checkClient.unbind");
                if (ubError) {
                    console.error(
                        `ERROR unbinding checkclient: [${ubError.message}]`,
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

export { verifyRouter };
