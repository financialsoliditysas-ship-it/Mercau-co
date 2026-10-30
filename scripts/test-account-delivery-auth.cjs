const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const calls = [];
class AccountError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const mod = new Module("delivery-auth-test");
const mocks = {
  "@/lib/deliveries": {
    DeliveryControlError: class extends Error {},
    createDeliveryOrder: async (body, context) => {
      calls.push({ body, context });
      return {
        order: { public_id: "MCU-000001", status: "created" },
        shipdayCreated: true,
      };
    },
  },
  "@/lib/account-server": {
    AccountError,
    accountUser: async (request) => {
      if (request.headers.get("authorization") !== "Bearer valid")
        throw new AccountError("Sesión no válida.", 401);
      return { id: "verified-server-user" };
    },
  },
  "@/lib/airtable-directory": {
    loadDirectoryBusiness: async (id) =>
      id === "recGLMhJYXTRE46st" ? { id } : null,
  },
};
mod.require = (id) => (id in mocks ? mocks[id] : require(id));
mod._compile(
  ts.transpileModule(fs.readFileSync("app/api/deliveries/route.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  "delivery-auth-test.cjs",
);
const request = (body, headers = {}) =>
  new Request("http://local.test/api/deliveries", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
(async () => {
  process.env.DELIVERY_CHANNEL_TOKEN = "local-only-token";
  assert.equal(
    (
      await mod.exports.POST(
        request(
          { customer_user_id: "foreign", user_id: "foreign" },
          { Authorization: "Bearer valid" },
        ),
      )
    ).status,
    200,
  );
  assert.deepEqual(calls.at(-1).context, {
    userId: "verified-server-user",
    businessId: undefined,
  });
  assert.equal(
    (await mod.exports.POST(request({ source: "WHATSAPP" }))).status,
    403,
  );
  assert.equal(
    (
      await mod.exports.POST(
        request({ source: "ADMIN" }, { "x-delivery-channel-token": "wrong" }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await mod.exports.POST(
        request(
          { source: "WHATSAPP" },
          { "x-delivery-channel-token": "local-only-token" },
        ),
      )
    ).status,
    200,
  );
  assert.equal(calls.at(-1).body.source, "WHATSAPP");
  assert.equal(
    (await mod.exports.POST(request({}, { Authorization: "Bearer invalid" })))
      .status,
    401,
  );
  assert.equal(
    (await mod.exports.POST(request({ pickupBusinessId: "rec00000000000002" })))
      .status,
    400,
  );
  assert.equal(
    (await mod.exports.POST(request({ pickupBusinessId: "recGLMhJYXTRE46st" })))
      .status,
    200,
  );
  assert.equal(calls.at(-1).context.businessId, "recGLMhJYXTRE46st");
  console.log(
    "PASS delivery route: trusted account authorship, anonymous compatibility, private WhatsApp/admin channel, published pickup validation. Provider mocked; zero dispatch.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
