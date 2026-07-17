const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "..");

function read(relPath) {
    return readFileSync(path.join(root, relPath), "utf8");
}

function loadAuthHelpers() {
    const sandbox = {
        URLSearchParams,
        localStorage: {
            store: Object.create(null),
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(this.store, key)
                    ? this.store[key]
                    : null;
            },
            setItem(key, value) {
                this.store[key] = String(value);
            },
            removeItem(key) {
                delete this.store[key];
            }
        },
        location: {
            href: "http://localhost:3000/login.html",
            search: ""
        }
    };
    sandbox.window = sandbox;

    vm.runInNewContext(read("frontend/assets/js/auth.js"), sandbox, {
        filename: "auth.js"
    });

    return sandbox.window;
}

test("login page restores session only after /api/auth/session succeeds", () => {
    const login = read("frontend/login.html");

    assert.match(login, /apiRequest\("\/api\/auth\/session"\)/);
    assert.match(login, /redirectAfterLogin/);
    // Must not bounce on stale localStorage markers without server confirmation.
    assert.doesNotMatch(
        login,
        /if\s*\(\s*getCurrentUser\(\)\s*&&\s*getAuthToken\(\)\s*\)\s*\{[\s\S]*?redirectAfterLogin/
    );
    // On session failure, clear client-side markers to break redirect loops.
    assert.match(login, /localStorage\.removeItem\("auth_session"\)/);
});

test("isSafePostLoginPath blocks open redirects and login self-loops", () => {
    const auth = loadAuthHelpers();

    assert.equal(auth.isSafePostLoginPath("/dashboard.html"), true);
    assert.equal(auth.isSafePostLoginPath("/orders.html?tab=1"), true);
    assert.equal(auth.isSafePostLoginPath("//evil.example"), false);
    assert.equal(auth.isSafePostLoginPath("https://evil.example"), false);
    assert.equal(auth.isSafePostLoginPath("/login.html"), false);
    assert.equal(auth.isSafePostLoginPath("/login.html?next=/dashboard.html"), false);
    assert.equal(auth.isSafePostLoginPath("/Login.HTML"), false);
    assert.equal(auth.isSafePostLoginPath(""), false);
    assert.equal(auth.isSafePostLoginPath(null), false);
});

test("redirectAfterLogin prefers safe next and falls back to role landing", () => {
    const auth = loadAuthHelpers();
    const admin = { id: 1, username: "admin", role: "admin" };
    const staff = { id: 2, username: "staff", role: "staff" };

    auth.location.search = "?next=%2Fdashboard.html";
    auth.redirectAfterLogin(admin);
    assert.equal(auth.location.href, "/dashboard.html");

    auth.location.search = "?next=%2Flogin.html";
    auth.redirectAfterLogin(admin);
    assert.equal(auth.location.href, "/dashboard.html");

    auth.location.search = "?next=%2F%2Fevil.example";
    auth.redirectAfterLogin(staff);
    assert.equal(auth.location.href, "/orders.html");

    auth.location.search = "";
    auth.redirectAfterLogin(staff);
    assert.equal(auth.location.href, "/orders.html");
});
