import { ClientSdk } from "../src";
import { getUserByTitle } from "./utils/userUtils";
import { User, WS_URL } from "./vars";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOAuthMethod } from "./utils/authHelper";

describe("userProfile", () => {
  let sdk: ClientSdk;
  let user: User;

  beforeAll(async () => {
    user = getUserByTitle("regular_user") as User;
    const { oauth, options } = getOAuthMethod(user);
    sdk = await ClientSdk.create(WS_URL, 82, oauth, options);
  });

  afterAll(async function () {
    await sdk.shutdown();
  });

  it("should has email field", async () => {
    const profile = sdk.userProfile;
    expect(profile.userId, "UserId should be present in user profile").eq(user.id);
    expect(profile.email, "Email should be present in user profile").not.empty;
  });
});
