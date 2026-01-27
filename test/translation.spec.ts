import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {ClientSdk, TranslationGroup, Translations} from "../src";
import {User, WS_URL} from "./vars";
import {getUserByTitle} from "./utils/userUtils";
import {getOAuthMethod} from "./utils/authHelper";

describe('Translations', () => {
    let sdk: ClientSdk;
    let translations: Translations;
    const user = getUserByTitle('regular_user') as User;
    const lang = "ru";

    beforeAll(async () => {
        const {oauth, options} = getOAuthMethod(user);
        sdk = await ClientSdk.create(WS_URL, 82, oauth, options);
        translations = await sdk.translations();
        await translations.fetchTranslations(lang, [TranslationGroup.Desktop])
    })

    afterAll(async () => {
        await sdk.shutdown();
    });

    it('should get translation', async () => {
        expect(translations.getTranslation("desktop.platform.tpsl.loss_money", lang), "Invalid translation")
            .eq("Убыток в деньгах")
    });

    it('should get key if translation was not found', async () => {
        expect(translations.getTranslation("desktop.platform.tpsl.loss_money123", lang), "Invalid translation")
            .eq("desktop.platform.tpsl.loss_money123")
    });
})