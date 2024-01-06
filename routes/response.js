const assert = require('node:assert').strict;
class Response {
    code; // number
    auth; // boolean
    error; // string or null
    ip; // string
    result; // ldap object
    constructor(code, error, ip, result = null) {
        assert.equal(typeof code, 'number', 'code must be a number');
        if (error !== null && typeof error !== 'string') {
            assert(false, 'error must be a string or null');
        }
        assert.equal(typeof ip, 'string');
        assert.equal(typeof result, 'object');
        //this.code = code;
        Object.defineProperty(this, 'code', {
            value: code,
            writable: false,
            enumerable: false,
        });
        if (code === 200) {
            this.auth = true;
        } else {
            this.auth = false;
        }
        this.error = error;
        this.ip = ip;
        this.result = result;
    }
}
exports.Response = Response;
