import {readFileSync} from 'fs';
import {resolve} from 'path';
import {User, UsersData} from '../data/types';

let usersData: UsersData | undefined;

function loadUserData() {
    if (process.env.USERS_DATA) {
        usersData = JSON.parse(process.env.USERS_DATA);
    } else {
        try {
            const data = readFileSync(resolve('users.json'), 'utf8');
            usersData = JSON.parse(data);
        } catch (error) {
            throw new Error('User data not found in environment variable or file');
        }
    }
}

export function getUserByTitle(title: string): User | undefined {
    if (!usersData) {
        loadUserData();
    }
    return usersData?.users.find(user => user.title === title);
}