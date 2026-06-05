export interface ResponseJson {
    auth: boolean;
    error: string | null;
    user: string | undefined;
    ip: string;
    result: object | null;
}

export class Response {
    constructor(
        readonly code: number,
        public error: string | null,
        public user: string | undefined,
        public ip: string,
        public result: object | null = null,
    ) {}

    get auth(): boolean {
        return Math.floor(this.code / 100) === 2;
    }

    toJSON(): ResponseJson {
        return {
            auth: this.auth,
            error: this.error,
            user: this.user,
            ip: this.ip,
            result: this.result,
        };
    }
}
