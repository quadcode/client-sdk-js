import {ClientSdk} from "../src";
import {getUserByTitle} from "./utils/userUtils";
import {User, WS_URL} from "./vars";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {getOAuthMethod} from "./utils/authHelper";

describe('Actives', () => {
    let sdk: ClientSdk
    let user: User

    beforeAll(async () => {
        user = getUserByTitle('regular_user') as User
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options)
    });

    afterAll(async function () {
        await sdk.shutdown();
    });

    it('should be singleton object', async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options);
        const [actives1, actives2] = await Promise.all([
            sdk.actives(),
            sdk.actives(),
        ]);
        expect(actives1, "Actives facade differ").eq(actives2)
    });

    it(`active should be valid`, async () => {
        const actives = await sdk.actives()
        const active = await actives.getActive(1);
        expect(active.imageUrl).contains("https://")
        expect(active.localizationKey).not.equal(active.name)
        expect(active.name).not.empty
    });
});