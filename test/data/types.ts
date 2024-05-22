export interface User {
    title: string;
    email: string;
    password: string;
}

export interface UsersData {
    users: User[];
}