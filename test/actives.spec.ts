import {ClientSdk, LoginPasswordAuthMethod} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

describe('Actives', () => {
    let sdk: ClientSdk

    beforeAll(async () => {
        const user = getUserByTitle('regular_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new LoginPasswordAuthMethod(API_URL, user.email, user.password), options)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it(`Active should be valid`, async () => {
        const actives = await sdk.actives()
        const active = await actives.getActive(1);
        expect(active.imageUrl).contains("https://")
        expect(active.localizationKey).not.equal(active.name)
        expect(active.name).not.empty
    });
});