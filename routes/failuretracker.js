class FailureTracker {
    #map;
    #lastCleaned;
    constructor() {
        this.#map = new Map();
        this.#lastCleaned = Date.now();
    }
    isBlocked(ip, user) {
        //return Boolean;
        // cleanup the map occasionally
        const token = FailureTracker.getToken(ip, user);
        if (
            Date.now() - this.#lastCleaned >
            process.env.IP_FAIL_CLEANUP * 1000
        ) {
            this.cleanupAll();
        }
        // no failure registered
        if (!this.#map.has(token)) {
            return false;
        }
        let entry = this.#map.get(token);
        entry = FailureTracker.cleanup(entry);
        if (entry.length == 0) {
            this.#map.delete(token);
            return false;
        }
        this.#map.set(token, entry);

        if (entry.length >= process.env.IP_FAIL_MAX) {
            this.registerFail(token);
            return true;
        } else {
            return false;
        }
    }
    registerFail(ip, user) {
        const token = FailureTracker.getToken(ip, user);
        if (!this.#map.has(token)) {
            this.#map.set(token, [Date.now()]);
            return;
        }
        this.#map.get(token).push(Date.now());
    }
    cleanupAll() {
        for (let key of this.#map.keys()) {
            this.#map.set(key, FailureTracker.cleanup(this.#map.get(key)));
        }
    }
    static cleanup(arr) {
        const now = Date.now();
        return arr.filter((time) => {
            return now - time < process.env.IP_FAIL_PERIOD * 1000;
        });
    }
    static getToken(ip, user) {
        return `${ip}:${user}`;
    }
}
exports.FailureTracker = FailureTracker;
