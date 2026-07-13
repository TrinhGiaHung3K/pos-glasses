(function attachApiClient(window) {
    const baseUrl =
        window.API_BASE_URL ||
        (window.location.protocol === "file:" ? "http://localhost:3000" : "");

    async function parseJson(response) {
        const text = await response.text();
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch {
            // Proxy / HTML error pages should not crash the client
            return {
                message: text.slice(0, 200) || `HTTP ${response.status}`,
                raw: true
            };
        }
    }

    async function apiRequest(path, options = {}) {
        const useAuth = options.auth !== false;
        const headers = {
            ...(options.headers || {})
        };

        const token = localStorage.getItem("auth_token");
        if (useAuth && token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const request = {
            ...Object.fromEntries(
                Object.entries(options).filter(([key]) => key !== "auth")
            ),
            headers
        };

        if (request.body && typeof request.body !== "string") {
            headers["Content-Type"] = "application/json";
            request.body = JSON.stringify(request.body);
        }

        const response = await fetch(`${baseUrl}${path}`, request);
        const data = await parseJson(response);

        if (!response.ok) {
            // Auto-redirect to login on 401 (unauthorized/expired token)
            if (useAuth && response.status === 401) {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("user");
                // Only redirect if not already on login page
                if (!window.location.pathname.endsWith("login.html")) {
                    window.location.href = "/login.html";
                    return;
                }
            }

            const error = new Error(data?.message || "Request failed");
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    }

    window.apiRequest = apiRequest;
    window.publicApiRequest = (path, options = {}) =>
        apiRequest(path, { ...options, auth: false });
})(window);
