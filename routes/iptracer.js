class IPTracer {
    #map;
    #lastCleaned;
    constructor() {
        this.#map = new Map();
        this.#lastCleaned = Date.now();
    }
    isBlocked(ip) {
        //return Boolean;
        // cleanup the map occasionally
        if (
            Date.now() - this.#lastCleaned >
            process.env.IP_FAIL_CLEANUP * 1000
        ) {
            this.cleanupAll();
        }
        // no failure registered
        if (!this.#map.has(ip)) {
            return false;
        }
        let entry = this.#map.get(ip);
        entry = IPTracer.cleanup(entry);
        if (entry.length == 0) {
            this.#map.delete(ip);
            return false;
        }
        this.#map.set(ip, entry);

        if (entry.length >= process.env.IP_FAIL_MAX) {
            this.registerFail(ip);
            return true;
        } else {
            return false;
        }
    }
    registerFail(ip) {
        if (!this.#map.has(ip)) {
            this.#map.set(ip, [Date.now()]);
            return;
        }
        this.#map.get(ip).push(Date.now());
    }
    cleanupAll() {
        for (let key of this.#map.keys()) {
            this.#map.set(key, IPTracer.cleanup(this.#map.get(key)));
        }
    }
    static cleanup(arr) {
        const now = Date.now();
        return arr.filter((time) => {
            return now - time < process.env.IP_FAIL_PERIOD * 1000;
        });
    }
}
exports.IPTracer = IPTracer;
