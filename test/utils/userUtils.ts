import {User, users} from "../vars"

export function getUserByTitle(title: string): User | undefined {
    return users.find(user => user.title === title);
}