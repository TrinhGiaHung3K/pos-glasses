const { readFile } = require("node:fs/promises");
const path = require("node:path");

const BRAND = "POS GLASSES";
const DEFAULT_DESCRIPTION = "Hệ thống POS bán lẻ và vận hành chuyên biệt cho cửa hàng mắt kính.";
const PAGE_DESCRIPTIONS = Object.freeze({
    "/audit.html": "Theo dõi nhật ký thao tác và các sự kiện quản trị trong hệ thống POS GLASSES.",
    "/customers.html": "Quản lý khách hàng hội viên, điểm thưởng, hạng thành viên và toa kính tại POS GLASSES.",
    "/dashboard.html": "Tổng quan doanh thu, tồn kho, đơn hàng và hiệu suất vận hành cửa hàng mắt kính.",
    "/inventory.html": "Theo dõi tồn kho, nhập xuất và điều chỉnh số lượng sản phẩm mắt kính.",
    "/invoice_detail.html": "Xem chi tiết giao dịch, thanh toán và chứng từ bán hàng tại POS GLASSES.",
    "/invoices.html": "Tra cứu lịch sử hóa đơn và giao dịch bán hàng của cửa hàng mắt kính.",
    "/login.html": "Đăng nhập an toàn vào hệ thống quản lý bán lẻ POS GLASSES.",
    "/orders.html": "Màn hình bán hàng tại quầy dành cho cửa hàng mắt kính.",
    "/print-labels.html": "Tạo và in tem barcode cho sản phẩm trong hệ thống POS GLASSES.",
    "/products.html": "Quản lý danh mục, giá bán và thông tin sản phẩm mắt kính.",
    "/promotions.html": "Quản lý chương trình khuyến mãi và chính sách giảm giá tại quầy.",
    "/qr/product.html": "Tra cứu thông tin sản phẩm mắt kính chính thức từ mã QR POS GLASSES.",
    "/reports.html": "Phân tích doanh thu, đơn hàng và hiệu quả kinh doanh cửa hàng mắt kính.",
    "/shifts.html": "Quản lý ca làm việc, tiền mặt đầu ca và đối soát cuối ca.",
    "/suppliers.html": "Quản lý nhà cung cấp và quy trình nhập hàng cho cửa hàng mắt kính.",
    "/users.html": "Quản trị tài khoản và phân quyền người dùng POS GLASSES.",
    "/warranties.html": "Tra cứu và quản lý bảo hành sản phẩm mắt kính."
});

function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

function pageTitle(html) {
    return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || BRAND;
}

function buildMetadata({ title, description, canonicalUrl, publicAppUrl }) {
    const safeTitle = escapeAttribute(title);
    const safeDescription = escapeAttribute(description);
    const safeCanonical = escapeAttribute(canonicalUrl);
    const socialImage = escapeAttribute(`${publicAppUrl}/assets/images/pos-glasses-social-card.png`);
    const structuredData = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: BRAND,
        alternateName: "POS Glasses",
        description,
        url: canonicalUrl,
        image: `${publicAppUrl}/assets/images/pos-glasses-social-card.png`,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Point of Sale",
        operatingSystem: "Web",
        inLanguage: "vi-VN"
    }).replace(/</g, "\\u003c");

    return `
    <!-- POS GLASSES website metadata -->
    <meta name="description" content="${safeDescription}">
    <meta name="keywords" content="POS mắt kính, phần mềm bán hàng mắt kính, quản lý cửa hàng kính, quản lý tồn kho, khách hàng hội viên">
    <meta name="author" content="POS GLASSES">
    <meta name="creator" content="POS GLASSES">
    <meta name="publisher" content="POS GLASSES">
    <meta name="application-name" content="POS GLASSES">
    <meta name="apple-mobile-web-app-title" content="POS GLASSES">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
    <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="format-detection" content="telephone=no">
    <meta name="theme-color" content="#0f766e">
    <meta name="color-scheme" content="light">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="msapplication-TileColor" content="#10201d">
    <meta name="msapplication-config" content="/browserconfig.xml">
    <link rel="canonical" href="${safeCanonical}">
    <link rel="alternate" hreflang="vi-VN" href="${safeCanonical}">
    <link rel="alternate" hreflang="x-default" href="${safeCanonical}">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/favicon-192x192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="POS GLASSES">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safeCanonical}">
    <meta property="og:image" content="${socialImage}">
    <meta property="og:image:secure_url" content="${socialImage}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Biểu trưng POS GLASSES - hệ thống quản lý cửa hàng mắt kính">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${socialImage}">
    <meta name="twitter:image:alt" content="Biểu trưng POS GLASSES - hệ thống quản lý cửa hàng mắt kính">
    <script type="application/ld+json">${structuredData}</script>`;
}

function createPageMetadataMiddleware({ frontendRoot, publicAppUrl }) {
    const normalizedAppUrl = String(publicAppUrl || "http://localhost:3000").replace(/\/$/, "");
    const normalizedRoot = path.resolve(frontendRoot);

    return async function pageMetadata(req, res, next) {
        if (!["GET", "HEAD"].includes(req.method) || !String(req.path).toLowerCase().endsWith(".html")) {
            next();
            return;
        }

        const pagePath = String(req.path).toLowerCase();
        if (!Object.hasOwn(PAGE_DESCRIPTIONS, pagePath)) {
            next();
            return;
        }

        const relativePath = pagePath.replace(/^\/+/, "");
        const filePath = path.resolve(normalizedRoot, relativePath);
        if (!filePath.startsWith(`${normalizedRoot}${path.sep}`)) {
            next();
            return;
        }

        try {
            const html = await readFile(filePath, "utf8");
            const title = pageTitle(html);
            const canonicalUrl = `${normalizedAppUrl}${pagePath}`;
            const metadata = buildMetadata({
                title,
                description: PAGE_DESCRIPTIONS[pagePath] || DEFAULT_DESCRIPTION,
                canonicalUrl,
                publicAppUrl: normalizedAppUrl
            });
            const localizedHtml = html.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="vi"$1>');
            const rendered = localizedHtml.replace(/<\/title>/i, `</title>${metadata}`);
            res.type("html").send(rendered);
        } catch (error) {
            if (error?.code === "ENOENT") {
                next();
                return;
            }
            next(error);
        }
    };
}

module.exports = {
    PAGE_DESCRIPTIONS,
    buildMetadata,
    createPageMetadataMiddleware
};
