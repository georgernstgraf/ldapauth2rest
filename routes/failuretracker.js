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
        const key = FailureTracker.getToken(ip, user);
        if (
            Date.now() - this.#lastCleaned >
            process.env.IP_FAIL_CLEANUP * 1000
        ) {
            this.cleanupMap();
        }
        // no failure registered
        if (!this.#map.has(key)) {
            return false;
        }
        let entry = this.#map.get(key);
        entry = FailureTracker.cleanupEntry(entry);
        if (entry.length == 0) {
            this.#map.delete(key);
            return false;
        }
        this.#map.set(key, entry);

        if (entry.length >= process.env.IP_FAIL_MAX) {
            this.registerFail(key);
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
    cleanupMap() {
        for (let key of this.#map.keys()) {
            this.#map.set(key, FailureTracker.cleanupEntry(this.#map.get(key)));
        }
    }
    static cleanupEntry(arr) {
        const now = Date.now();
        return arr.filter((time) => {
            return now - time < process.env.IP_FAIL_PERIOD * 1000;
        });
    }
    static getToken(ip, user) {
        if (user === undefined) {
            // go easy on undefined users, they don't hurt
            user = (10 + Math.floor(Math.random() * 3))
                .toString(36)
                .toUpperCase();
        }
        return `${ip}:${user}`;
    }
}
exports.FailureTracker = FailureTracker;
