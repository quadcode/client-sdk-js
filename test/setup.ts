import {afterAll} from "vitest";
import {waitForSecretsSync} from "./utils/tokenSecrets.js";

afterAll(async () => {
    await waitForSecretsSync();
});
