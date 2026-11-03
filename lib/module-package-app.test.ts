import { beforeEach, describe, expect, it } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import {
  PACKAGE_APP_SANDBOX,
  buildPackageSrcDoc,
  packageAppGrants,
} from "@/lib/module-package-app"
import {
  MAX_PACKAGE_APP_BYTES,
  PACKAGE_APP_PERSIST_NAME,
  PackageAppError,
  useModulePackageAppStore,
} from "@/lib/module-package-app-store"

describe("package app store", () => {
  beforeEach(() => {
    localStorage.clear()
    useModulePackageAppStore.setState({ apps: {} })
  })

  it("stores a folder under its own persist key", () => {
    const id = useModulePackageAppStore.getState().addApp({
      name: "Demo",
      html: "<p>hi</p>",
      css: { "./app.css": "p{color:red}" },
      js: { "app.js": "console.log(1)" },
      assets: { "icon.svg": "<svg></svg>" },
    })
    const app = useModulePackageAppStore.getState().apps[id]
    expect(app.css["app.css"]).toBe("p{color:red}")
    expect(app.js["app.js"]).toContain("console.log")
    expect(app.assets["icon.svg"]).toContain("<svg")
    expect(app.kv).toEqual({})

    const key = persistKey(PACKAGE_APP_PERSIST_NAME)
    expect(key).toBe("brain2-module-package-app")
    expect(key).not.toBe("brain2-module-html")
    const raw = localStorage.getItem(key)
    expect(raw).toContain("hi")
    expect(localStorage.getItem("brain2-module-html")).toBeNull()

    useModulePackageAppStore.getState().setKv(id, "score", "3")
    expect(useModulePackageAppStore.getState().apps[id].kv.score).toBe("3")
    useModulePackageAppStore.getState().setKv(id, "score", null)
    expect(useModulePackageAppStore.getState().apps[id].kv.score).toBeUndefined()

    useModulePackageAppStore.getState().removeApp(id)
    expect(useModulePackageAppStore.getState().apps[id]).toBeUndefined()
  })

  it("rejects a path that leaves the folder", () => {
    expect(() =>
      useModulePackageAppStore.getState().addApp({
        name: "Bad",
        html: "<p></p>",
        css: { "../x.css": "x" },
      }),
    ).toThrow(PackageAppError)
    expect(useModulePackageAppStore.getState().apps).toEqual({})
  })

  it("rejects a folder over the byte cap", () => {
    expect(() =>
      useModulePackageAppStore.getState().addApp({
        html: "x".repeat(MAX_PACKAGE_APP_BYTES + 1),
      }),
    ).toThrow(/MB/)
  })
})

describe("package app srcdoc", () => {
  const grants = { listIds: ["l1"], canWrite: true }

  it("inlines the folder and keeps the sandbox off the parent origin", () => {
    const { srcDoc, sandbox } = buildPackageSrcDoc(
      {
        html: `<!doctype html><html><head><link rel="stylesheet" href="app.css"></head><body><img src="icon.png"><script src="./app.js"></script></body></html>`,
        css: { "app.css": "p{color:red} body{background:url('icon.png')}" },
        js: { "app.js": "console.log('</script>')" },
        assets: { "icon.png": "data:image/png;base64,aaaa" },
      },
      { kv: { k: "v" }, grants },
    )
    expect(sandbox).toBe(PACKAGE_APP_SANDBOX)
    expect(sandbox).toBe("allow-scripts allow-forms allow-modals allow-popups allow-downloads")
    expect(sandbox).not.toContain("allow-same-origin")
    expect(srcDoc).toContain("p{color:red}")
    expect(srcDoc).toContain("data:image/png;base64,aaaa")
    expect(srcDoc).not.toContain('src="./app.js"')
    expect(srcDoc).not.toContain('href="app.css"')
    expect(srcDoc).toContain("<\\/script>")
    expect(srcDoc).toContain("window.brain2")
    expect(srcDoc.indexOf("__BRAIN2_CFG__")).toBeLessThan(srcDoc.indexOf("p{color:red}"))
  })

  it("appends css and js the html did not reference", () => {
    const { srcDoc } = buildPackageSrcDoc(
      {
        html: "<!doctype html><html><head></head><body><p>hi</p></body></html>",
        css: { "more.css": "b{color:blue}" },
        js: { "more.js": "window.__pkg = 1" },
      },
      { kv: {}, grants },
    )
    expect(srcDoc).toContain("b{color:blue}")
    expect(srcDoc).toContain("window.__pkg = 1")
    expect(srcDoc.indexOf("b{color:blue}")).toBeLessThan(srcDoc.indexOf("</head>"))
    expect(srcDoc.indexOf("window.__pkg = 1")).toBeLessThan(srcDoc.indexOf("</body>"))
  })
})

describe("packageAppGrants", () => {
  it("includes bound lists and writes unless the package opts out", () => {
    expect(
      packageAppGrants({
        categoryId: "a",
        daysCategoryId: "b",
        htmlListIds: ["a", "c"],
        htmlCanWrite: false,
      }),
    ).toEqual({ listIds: ["a", "b", "c"], canWrite: false })
    expect(packageAppGrants({ categoryId: "a" })).toEqual({ listIds: ["a"], canWrite: true })
    expect(packageAppGrants({})).toEqual({ listIds: [], canWrite: false })
  })
})
