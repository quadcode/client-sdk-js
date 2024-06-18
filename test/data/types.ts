export interface User {
    id: number;
    title: string;
    email: string;
    password: string;
}

export interface UsersData {
    users: User[];
}