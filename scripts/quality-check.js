const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const frontendRoot = path.join(root, "frontend");
const failures = [];

function walk(directory, predicate) {
    const files = [];
    if (!fs.existsSync(directory)) return files;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...walk(absolute, predicate));
        else if (!predicate || predicate(absolute)) files.push(absolute);
    }
    return files;
}

function relative(file) {
    return path.relative(root, file).replaceAll("\\", "/");
}

function checkJavaScriptSyntax() {
    const files = [
        path.join(root, "server.js"),
        ...walk(path.join(root, "src"), (file) => file.endsWith(".js")),
        ...walk(path.join(frontendRoot, "assets", "js"), (file) => file.endsWith(".js"))
    ];

    for (const file of files) {
        try {
            new vm.Script(fs.readFileSync(file, "utf8"), { filename: relative(file) });
        } catch (error) {
            failures.push(`${relative(file)}: JavaScript không hợp lệ (${error.message})`);
        }
    }
}

function checkInlineScripts() {
    const htmlFiles = walk(frontendRoot, (file) => file.endsWith(".html"));
    const scriptPattern = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, "utf8");
        let match;
        let index = 0;
        while ((match = scriptPattern.exec(html))) {
            index += 1;
            if (!match[1].trim()) continue;
            try {
                new vm.Script(match[1], { filename: `${relative(file)}#inline-${index}` });
            } catch (error) {
                failures.push(`${relative(file)}: inline script ${index} không hợp lệ (${error.message})`);
            }
        }
    }
}

function checkLocalHtmlReferences() {
    const htmlFiles = walk(frontendRoot, (file) => file.endsWith(".html"));
    const referencePattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, "utf8");
        let match;
        while ((match = referencePattern.exec(html))) {
            const raw = match[1].trim();
            if (!raw || raw.includes("${") || /^(?:https?:|data:|blob:|#|mailto:|tel:|javascript:)/i.test(raw)) continue;
            if (raw.startsWith("/vendor/") || raw.startsWith("/api/")) continue;

            const pathname = raw.split(/[?#]/, 1)[0];
            const target = pathname.startsWith("/")
                ? path.join(frontendRoot, pathname.slice(1))
                : path.resolve(path.dirname(file), pathname);
            if (!fs.existsSync(target)) {
                failures.push(`${relative(file)}: tham chiếu local không tồn tại (${raw})`);
            }
        }
    }
}

function checkProductionHygiene() {
    const appSource = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
    const menuSource = fs.readFileSync(path.join(frontendRoot, "assets", "js", "components.js"), "utf8");
    const dump = fs.readFileSync(path.join(root, "scripts", "Dump20260704.sql"), "utf8");
    const baseCss = fs.readFileSync(path.join(frontendRoot, "assets", "css", "base.css"), "utf8");
    const retiredQrMigration = path.join(root, "scripts", "2026-07-05-pos-qr-migration.sql");

    if (/create(?:Public|Staff|Admin)?Table|tableOrders|modules\/tables/.test(appSource)) {
        failures.push("src/app.js: module đặt bàn vẫn còn được đăng ký");
    }
    if (/qr-orders|admin\/tables|Bàn QR|Yêu cầu QR/.test(menuSource)) {
        failures.push("frontend/assets/js/components.js: menu đặt bàn vẫn còn hiển thị");
    }
    if (/CREATE TABLE `(?:store_tables|table_orders|table_order_items)`/i.test(dump)) {
        failures.push("scripts/Dump20260704.sql: schema nhà hàng vẫn còn trong dump mới");
    }
    if (/'123456'/.test(dump)) {
        failures.push("scripts/Dump20260704.sql: phát hiện mật khẩu seed yếu");
    }
    if (/fonts\.googleapis\.com/i.test(baseCss)) {
        failures.push("frontend/assets/css/base.css: font production vẫn phụ thuộc Google Fonts");
    }
    if (fs.existsSync(retiredQrMigration)) {
        failures.push("scripts/2026-07-05-pos-qr-migration.sql: migration đặt bàn đã nghỉ vẫn còn có thể bị chạy nhầm");
    }

    try {
        const trackedEnv = execFileSync("git", ["ls-files", ".env"], {
            cwd: root,
            encoding: "utf8"
        }).trim();
        if (trackedEnv) failures.push(".env đang bị Git theo dõi");
    } catch (error) {
        failures.push(`Không kiểm tra được Git secrets (${error.message})`);
    }
}

function checkReverseProxyCsrf() {
    const { createCsrfProtection } = require(path.join(root, "src", "middleware", "csrfProtection"));
    const middleware = createCsrfProtection({
        trustedOrigins: ["https://pos.example.com"]
    });
    let accepted = false;

    middleware({
        method: "POST",
        authSource: "cookie",
        protocol: "http",
        headers: {
            host: "pos.example.com",
            origin: "https://pos.example.com",
            "sec-fetch-site": "same-origin"
        }
    }, {}, () => {
        accepted = true;
    });

    if (!accepted) {
        failures.push("CSRF: HTTPS public origin không hoạt động sau reverse proxy");
    }
}

checkJavaScriptSyntax();
checkInlineScripts();
checkLocalHtmlReferences();
checkProductionHygiene();
checkReverseProxyCsrf();

if (failures.length) {
    console.error("Quality check thất bại:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log("Quality check đạt: syntax, inline scripts, local assets và production hygiene.");
}
