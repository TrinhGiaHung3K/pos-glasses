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
        localStorage.removeItem("user");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_session");
        try {
            await fetch("/logout", { method: "POST", credentials: "same-origin", keepalive: true });
        } finally {
            window.location.href = "/login.html";
        }
    }

    function getLandingForUser(user = getCurrentUser()) {
        if (user?.role === "admin") {
            return "/dashboard.html";
        }

        return "/orders.html";
    }

    function redirectAfterLogin(user = getCurrentUser()) {
        window.location.href = getLandingForUser(user);
    }

    window.getCurrentUser = getCurrentUser;
    window.getAuthToken = getAuthToken;
    window.requireAuth = requireAuth;
    window.requireRole = requireRole;
    window.saveAuth = saveAuth;
    window.logout = logout;
    window.getLandingForUser = getLandingForUser;
    window.redirectAfterLogin = redirectAfterLogin;
})(window);
