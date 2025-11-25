declare global {
    const IS_BROWSER: boolean;
}
export const BASE_HOST: string;
export const API_URL: string;
export const WS_URL: string;
export const CLIENT_ID: number;
export const CLIENT_SECRET: string;

export interface User {
    id: number;
    title: string;
    email: string;
    password: string;
    access_token: string;
    refresh_token: string;
}

export declare const users: User[];