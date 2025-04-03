declare const IS_BROWSER: boolean;
export const API_URL: string;
export const WS_URL: string;

export interface User {
    id: number;
    title: string;
    email: string;
    password: string;
}

export declare const users: User[];