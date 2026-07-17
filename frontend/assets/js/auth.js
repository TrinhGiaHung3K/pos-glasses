(function attachAuthHelpers(window) {
    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem("user"));
        } catch (error) {
            return null;
        }
    }

    function getAuthToken() {
        return localStorage.getItem("auth_token") || localStorage.getItem("auth_session");
    }

    function requireAuth() {
        const user = getCurrentUser();
        const token = getAuthToken();

        if (!user || !token) {
            // Clear any partial auth data
            localStorage.removeItem("user");
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_session");
            window.location.href = "/login.html";
            return null;
        }

        return user;
    }

    function requireRole(allowedRoles) {
        const user = requireAuth();
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!user) {
            return null;
        }

        if (roles.length && !roles.includes(user.role)) {
            window.location.href = getLandingForUser(user);
            return null;
        }

        return user;
    }

    function saveAuth(data) {
        // New sessions use an HttpOnly SameSite cookie. Keep only a harmless
        // marker and the display user in localStorage; never expose the JWT to JS.
        localStorage.removeItem("auth_token");
        if (data.authenticated) {
            localStorage.setItem("auth_session", "cookie");
        }
        if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
        }
    }

    async function logout() {
        const user = getCurrentUser();
        const roleKey = String(user?.role || "").toLowerCase();
        const roleLabel = roleKey === "admin" ? "quản trị viên (Admin)" : "nhân viên";
        const username = user?.username ? String(user.username) : "";

        // Reuse system confirm modal (components.js → showConfirm)
        if (typeof window.showConfirm === "function") {
            const confirmed = await window.showConfirm({
                title: "Xác nhận đăng xuất",
                message: username
                    ? `Tài khoản <strong>${escapeForConfirm(username)}</strong> đang đăng nhập với vai trò <strong>${roleLabel}</strong>. Bạn có chắc muốn đăng xuất?`
                    : `Bạn đang đăng nhập với vai trò <strong>${roleLabel}</strong>. Bạn có chắc muốn đăng xuất?`,
                confirmText: "Đăng xuất",
                cancelText: "Ở lại",
                type: "danger"
            });
            if (!confirmed) {
                return;
            }
        }

        localStorage.removeItem("user");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_session");
        try {
            await fetch("/logout", { method: "POST", credentials: "same-origin", keepalive: true });
        } finally {
            window.location.href = "/login.html";
        }
    }

    /** Minimal escape for names injected into showConfirm message HTML. */
    function escapeForConfirm(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function getLandingForUser(user = getCurrentUser()) {
        if (user?.role === "admin") {
            return "/dashboard.html";
        }

        return "/orders.html";
    }

    function isSafePostLoginPath(next) {
        if (!next || typeof next !== "string") {
            return false;
        }
        // Same-origin relative path only; block protocol-relative and login self-loops.
        if (!next.startsWith("/") || next.startsWith("//")) {
            return false;
        }
        const path = next.split(/[?#]/)[0].toLowerCase();
        if (path === "/login.html" || path === "/login") {
            return false;
        }
        return true;
    }

    function redirectAfterLogin(user = getCurrentUser()) {
        const next = new URLSearchParams(window.location.search).get("next") || "";
        const safeNext = isSafePostLoginPath(next) ? next : "";
        window.location.href = safeNext || getLandingForUser(user);
    }

    window.getCurrentUser = getCurrentUser;
    window.getAuthToken = getAuthToken;
    window.requireAuth = requireAuth;
    window.requireRole = requireRole;
    window.saveAuth = saveAuth;
    window.logout = logout;
    window.getLandingForUser = getLandingForUser;
    window.isSafePostLoginPath = isSafePostLoginPath;
    window.redirectAfterLogin = redirectAfterLogin;
})(window);
