class FailureTracker {
    #map: Map<string, number[]>;
    #lastCleaned: number;

    constructor() {
        this.#map = new Map();
        this.#lastCleaned = Date.now();
    }

    isBlocked(ip: string, user: string): boolean {
        const key = FailureTracker.getMapKey(ip, user);
        if (
            Date.now() - this.#lastCleaned >
            Number(Deno.env.get("IP_FAIL_CLEANUP")) * 1000
        ) {
            this.cleanupMap();
        }
        if (!this.#map.has(key)) {
            return false;
        }
        let entry = this.#map.get(key)!;
        entry = FailureTracker.cleanupEntry(entry);
        if (entry.length == 0) {
            this.#map.delete(key);
            return false;
        }
        this.#map.set(key, entry);

        if (entry.length >= Number(Deno.env.get("IP_FAIL_MAX"))) {
            this.registerFail(ip, user);
            return true;
        } else {
            return false;
        }
    }

    registerFail(ip: string, user: string): void {
        const key = FailureTracker.getMapKey(ip, user);
        if (!this.#map.has(key)) {
            this.#map.set(key, [Date.now()]);
            return;
        }
        this.#map.get(key)!.push(Date.now());
    }

    cleanupMap(): void {
        for (const key of this.#map.keys()) {
            this.#map.set(key, FailureTracker.cleanupEntry(this.#map.get(key)!));
        }
    }

    static cleanupEntry(arr: number[]): number[] {
        const now = Date.now();
        return arr.filter((time) => {
            return now - time < Number(Deno.env.get("IP_FAIL_PERIOD")) * 1000;
        });
    }

    static getMapKey(ip: string, user: string): string {
        return `${ip}:${user}`;
    }
}

export { FailureTracker };
