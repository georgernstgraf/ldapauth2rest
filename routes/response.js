const assert = require('node:assert').strict;
class Response {
    code; // number
    auth; // boolean
    error; // string or null
    ip; // string
    user; // string
    result; // ldap object
    constructor(code, error, user, ip, result = null) {
        assert.equal(typeof code, 'number', 'code must be a number');
        if (error !== null && typeof error !== 'string') {
            assert(false, 'error must be a string or null');
        }
        if (user !== undefined && typeof user !== 'string') {
            assert(false, 'user must be a string or undefined');
        }
        assert.equal(typeof ip, 'string');
        assert.equal(typeof result, 'object');
        // make code a hidden and readonly property
        Object.defineProperty(this, 'code', {
            value: code,
            writable: false,
            enumerable: false,
        });
        if (Math.floor(code / 100) === 2) {
            this.auth = true;
        } else {
            this.auth = false;
        }
        this.error = error;
        this.user = user;
        this.ip = ip;
        this.result = result;
    }
}
exports.Response = Response;
