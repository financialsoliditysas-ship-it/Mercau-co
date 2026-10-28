const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const { NextRequest } = require("next/server");
function load(file, mocks = {}) {
  const mod = new Module(file);
  mod.require = (id) => (id in mocks ? mocks[id] : require(id));
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file + ".cjs",
  );
  return mod.exports;
}
class AccountError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const photo = load("lib/business-photo.ts");
const bid = "recGLMhJYXTRE46st";
const primary = {
  id: "attPrimary",
  filename: "original.jpg",
  type: "image/jpeg",
  url: "https://v5.airtableusercontent.com/primary",
};
let attachments = [primary],
  hidden = [],
  published = true,
  uploads = 0,
  denied = false;
const db = {
  from() {
    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      async maybeSingle() {
        return {
          data: { data: { galleryHiddenIds: hidden }, version: 1 },
          error: null,
        };
      },
    };
    return query;
  },
};
const admin = { getSupabaseAdminClient: () => db };
const gallery = load("lib/business-gallery.ts", {
  "./business-photo": photo,
  "./supabase-admin": admin,
  "./account-server": { AccountError },
});
const publicRoute = load("app/api/negocios/[businessId]/foto/route.ts", {
  "@/lib/business-photo": photo,
  "@/lib/supabase-admin": admin,
});
const ownerRoute = load("app/api/mi-negocio/[businessId]/galeria/route.ts", {
  "../route": {
    GET: async () => Response.json({}, { status: denied ? 403 : 200 }),
  },
  "@/lib/account-server": {
    AccountError,
    accountUser: async () => ({ id: "local" }),
    accountJson: Response.json.bind(Response),
    accountBody: async (r) => r.json(),
    accountFailure: (e) =>
      Response.json({ error: e.message }, { status: e.status || 503 }),
  },
  "@/lib/business-gallery": gallery,
  "@/lib/supabase-admin": admin,
});
const originalFetch = global.fetch;
process.env.AIRTABLE_API_KEY = "test-only";
process.env.AIRTABLE_BASE_ID = "appTest";
process.env.AIRTABLE_NEGOCIOS_TABLE_ID = "tblTest";
const body = {
  file: Buffer.from([255, 216, 255, 224, 0, 0]).toString("base64"),
  kind: "gallery",
  requestId: "11111111-1111-4111-8111-111111111111",
};
global.fetch = async (url, options = {}) => {
  if (String(url).startsWith("https://content.airtable.com/")) {
    const upload = JSON.parse(options.body);
    uploads++;
    attachments.push({
      id: "attPhoto" + uploads,
      filename: upload.filename,
      type: upload.contentType,
      url: primary.url,
    });
  }
  return Response.json({
    fields: {
      [photo.photoFieldId]: attachments,
      fldyyLYvoyMdiK13C: published ? "Publicado" : "Pendiente",
    },
  });
};
(async () => {
  try {
    assert.deepEqual(await gallery.businessGallery(bid), []);
    await gallery.addGalleryPhoto(bid, body);
    assert.equal(uploads, 1);
    assert.equal(attachments[0], primary);
    assert(
      photo.photoDetails(bid, attachments).photoUrl.endsWith("attPrimary"),
    );
    await gallery.addGalleryPhoto(bid, body);
    assert.equal(uploads, 1);
    let visible = await gallery.businessGallery(bid);
    assert.equal(visible.length, 1);
    hidden = ["attPhoto1"];
    assert.equal((await gallery.businessGallery(bid)).length, 0);
    assert.equal((await gallery.businessGallery(bid, true))[0].hidden, true);
    const image = (id) =>
      new NextRequest(
        `https://local.test/api/negocios/${bid}/foto?image=${id}`,
      );
    assert.equal(
      (
        await publicRoute.GET(image("attPhoto1"), {
          params: { businessId: bid },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await publicRoute.GET(image("attOtherBusiness"), {
          params: { businessId: bid },
        })
      ).status,
      404,
    );
    hidden = [];
    assert.equal(
      (
        await publicRoute.GET(image("attPhoto1"), {
          params: { businessId: bid },
        })
      ).status,
      302,
    );
    published = false;
    assert.deepEqual(await gallery.businessGallery(bid), []);
    published = true;
    for (let i = 2; i <= 8; i++)
      await gallery.addGalleryPhoto(bid, {
        ...body,
        requestId: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      });
    await assert.rejects(
      () =>
        gallery.addGalleryPhoto(bid, {
          ...body,
          requestId: "99999999-1111-4111-8111-111111111111",
        }),
      /hasta 8/,
    );
    await assert.rejects(
      () => gallery.addGalleryPhoto(bid, { ...body, file: "PHN2Zz4=" }),
      /JPG/,
    );
    denied = true;
    assert.equal(
      (
        await ownerRoute.GET(new NextRequest("https://local.test"), {
          params: { businessId: bid },
        })
      ).status,
      403,
    );
    console.log(
      "PASS gallery: preserved primary, retry deduplication, hidden and unpublished photos, foreign attachment 404, eight-photo limit, invalid bytes, owner denial. Mock storage only.",
    );
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
