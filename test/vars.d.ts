export const API_URL;
export const WS_URL;

export interface User {
    id: number;
    title: string;
    email: string;
    password: string;
}

export declare const users: User[];