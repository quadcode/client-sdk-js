import {ClientSdk, OAuthMethod} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {API_URL, BASE_HOST, CLIENT_ID, CLIENT_SECRET, User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

describe('Actives', () => {
    let sdk: ClientSdk
    let user: User

    beforeAll(async () => {
        user = getUserByTitle('regular_user') as User
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        const oauth = new OAuthMethod(API_URL, CLIENT_ID, '', 'full offline_access', CLIENT_SECRET, user.access_token, user.refresh_token);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('should be singleton object', async () => {
        const options = IS_BROWSER ? {host: BASE_HOST} : undefined;
        sdk = await ClientSdk.create(WS_URL, 82, new OAuthMethod(API_URL, CLIENT_ID, '', 'full offline_access', CLIENT_SECRET, user.access_token, user.refresh_token), options);
        const [actives1, actives2] = await Promise.all([
            sdk.actives(),
            sdk.actives(),
        ]);
        expect(actives1, "Actives facade differ").eq(actives2)
    });

    it(`Active should be valid`, async () => {
        const actives = await sdk.actives()
        const active = await actives.getActive(1);
        expect(active.imageUrl).contains("https://")
        expect(active.localizationKey).not.equal(active.name)
        expect(active.name).not.empty
    });
});