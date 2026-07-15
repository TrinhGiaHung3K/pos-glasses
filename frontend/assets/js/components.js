/**
 * POS Glasses - Reusable UI Component Library
 * Toast notifications, Confirm dialogs, Form modals
 * Replaces all native alert(), confirm(), prompt() calls
 */
(function attachComponents(window) {

    // ═══════════════════════════════════════════
    //  0. SHARED APPLICATION MENU (MEGA MENU)
    // ═══════════════════════════════════════════

    /** Flat list kept for path lookup + tests; mega groups reference the same keys. */
    const APP_MENU_ITEMS = [
        { key: "dashboard", href: "/dashboard.html", icon: "ph-squares-four", label: "Tổng quan", hint: "KPI & xu hướng" },
        { key: "orders", href: "/orders.html", icon: "ph-cash-register", label: "Bán hàng", hint: "Quầy POS" },
        { key: "shifts", href: "/shifts.html", icon: "ph-clock-countdown", label: "Ca làm việc", hint: "Mở / đóng ca" },
        { key: "products", href: "/products.html", icon: "ph-eyeglasses", label: "Sản phẩm", hint: "Catalog kính" },
        { key: "print-labels", href: "/print-labels.html", icon: "ph-barcode", label: "In tem", hint: "Barcode hàng" },
        { key: "invoices", href: "/invoices.html", icon: "ph-receipt", label: "Hóa đơn", hint: "Lịch sử đơn" },
        { key: "customers", href: "/customers.html", icon: "ph-users", label: "Khách hàng", hint: "Hội viên" },
        { key: "warranties", href: "/warranties.html", icon: "ph-shield-check", label: "Bảo hành", hint: "Tra serial" },
        { key: "inventory", href: "/inventory.html", icon: "ph-warehouse", label: "Kho hàng", hint: "Tồn & điều chỉnh" },
        { key: "suppliers", href: "/suppliers.html", icon: "ph-truck", label: "NCC / PO", hint: "Nhập hàng" },
        { key: "promotions", href: "/promotions.html", icon: "ph-ticket", label: "Khuyến mãi", hint: "Mã giảm giá" },
        { key: "reports", href: "/reports.html", icon: "ph-chart-line-up", label: "Báo cáo", hint: "Doanh thu" },
        { key: "invoice-detail", href: "/invoice_detail.html", icon: "ph-printer", label: "In hóa đơn", hint: "In / xem HĐ" },
        { key: "qr-orders", href: "/staff/qr-orders.html", icon: "ph-qr-code", label: "Yêu cầu QR", hint: "Xác nhận bàn" },
        { key: "tables", href: "/admin/tables.html", icon: "ph-desk", label: "Bàn QR", hint: "Quản lý bàn", roles: ["admin"] },
        { key: "users", href: "/users.html", icon: "ph-user-gear", label: "Người dùng", hint: "Tài khoản NV", roles: ["admin"] },
        { key: "audit", href: "/audit.html", icon: "ph-notebook", label: "Nhật ký", hint: "Audit log", roles: ["admin"] },
        { key: "payment-test", href: "/payment-test.html", icon: "ph-qr-code", label: "Test chuyển khoản", hint: "Xác minh 2.900đ", roles: ["admin"] }
    ];

    /**
     * Mega menu groups — related destinations clustered for faster scan.
     * `type: "link"` = single top-level item; `type: "mega"` = flyout + accordion group.
     */
    const APP_MENU_GROUPS = [
        {
            id: "overview",
            type: "link",
            itemKey: "dashboard"
        },
        {
            id: "pos",
            type: "mega",
            label: "Bán hàng",
            icon: "ph-storefront",
            itemKeys: ["orders", "shifts", "invoices", "invoice-detail"]
        },
        {
            id: "catalog",
            type: "mega",
            label: "Hàng hóa",
            icon: "ph-eyeglasses",
            itemKeys: ["products", "print-labels", "promotions"]
        },
        {
            id: "crm",
            type: "mega",
            label: "Khách hàng",
            icon: "ph-users-three",
            itemKeys: ["customers", "warranties"]
        },
        {
            id: "stock",
            type: "mega",
            label: "Kho hàng",
            icon: "ph-package",
            itemKeys: ["inventory", "suppliers"]
        },
        {
            id: "qr",
            type: "mega",
            label: "Bàn QR",
            icon: "ph-qr-code",
            itemKeys: ["qr-orders", "tables"]
        },
        {
            id: "analytics",
            type: "link",
            itemKey: "reports"
        },
        {
            id: "system",
            type: "mega",
            label: "Hệ thống",
            icon: "ph-gear-six",
            itemKeys: ["users", "audit", "payment-test"],
            roles: ["admin"]
        }
    ];

    const ACTIVE_MENU_BY_PATH = {
        "/dashboard.html": "dashboard",
        "/products.html": "products",
        "/print-labels.html": "print-labels",
        "/customers.html": "customers",
        "/orders.html": "orders",
        "/shifts.html": "shifts",
        "/warranties.html": "warranties",
        "/invoices.html": "invoices",
        "/inventory.html": "inventory",
        "/suppliers.html": "suppliers",
        "/promotions.html": "promotions",
        "/reports.html": "reports",
        "/invoice_detail.html": "invoice-detail",
        "/staff/qr-orders.html": "qr-orders",
        "/admin/tables.html": "tables",
        "/users.html": "users",
        "/audit.html": "audit",
        "/payment-test.html": "payment-test"
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getMenuUser(user) {
        if (user) {
            return user;
        }

        if (typeof window.getCurrentUser === "function") {
            return window.getCurrentUser();
        }

        return null;
    }

    function roleLabel(role) {
        return role === "admin" ? "Quản trị" : "Nhân viên";
    }

    function inferActiveMenu() {
        const path = window.location?.pathname || "";
        return ACTIVE_MENU_BY_PATH[path] || ACTIVE_MENU_BY_PATH[`/${path.split("/").pop()}`] || "";
    }

    function isMenuItemVisible(item, user, active) {
        if (!item) {
            return false;
        }
        if (!item.roles) {
            return true;
        }
        return item.roles.includes(user?.role) || item.key === active;
    }

    function menuItemByKey(key) {
        return APP_MENU_ITEMS.find((item) => item.key === key) || null;
    }

    function visibleGroupItems(group, user, active) {
        if (!group || group.type !== "mega") {
            return [];
        }
        return (group.itemKeys || [])
            .map(menuItemByKey)
            .filter((item) => isMenuItemVisible(item, user, active));
    }

    function isGroupVisible(group, user, active) {
        if (!group) {
            return false;
        }
        if (group.type === "link") {
            return isMenuItemVisible(menuItemByKey(group.itemKey), user, active);
        }
        if (group.roles && !group.roles.includes(user?.role)) {
            // Still show if an item inside is the active page
            const items = visibleGroupItems(group, user, active);
            return items.some((item) => item.key === active);
        }
        return visibleGroupItems(group, user, active).length > 0;
    }

    function groupContainsActive(group, active) {
        if (!group || !active) {
            return false;
        }
        if (group.type === "link") {
            return group.itemKey === active;
        }
        return (group.itemKeys || []).includes(active);
    }

    function buildNavLinkHtml(item, active, extraClass = "") {
        const activeClass = item.key === active ? " active" : "";
        const classes = `pos-nav-item${activeClass}${extraClass ? ` ${extraClass}` : ""}`;
        return `
            <a href="${item.href}" class="${classes}" data-menu-key="${item.key}" title="${escapeHtml(item.hint || item.label)}">
                <span class="nav-icon"><i class="ph ${item.icon}" aria-hidden="true"></i></span>
                <span class="nav-label">${escapeHtml(item.label)}</span>
            </a>`;
    }

    function buildMegaTileHtml(item, active) {
        const activeClass = item.key === active ? " is-active" : "";
        const title = escapeHtml(item.hint || item.label);
        return `
            <a href="${item.href}" class="pos-mega-tile${activeClass}" data-menu-key="${item.key}" title="${title}">
                <span class="pos-mega-tile-icon"><i class="ph ${item.icon}" aria-hidden="true"></i></span>
                <span class="pos-mega-tile-title">${escapeHtml(item.label)}</span>
            </a>`;
    }

    function buildMegaGroupHtml(group, items, active, isOpen) {
        const hasActive = groupContainsActive(group, active);
        const openClass = isOpen ? " is-open" : "";
        const activeClass = hasActive ? " is-active-group" : "";
        const panelId = `megaPanel_${group.id}`;
        const tiles = items.map((item) => buildMegaTileHtml(item, active)).join("");

        return `
            <div class="pos-mega-group${openClass}${activeClass}" data-mega-group="${group.id}">
                <button
                    type="button"
                    class="pos-mega-trigger"
                    data-mega-trigger="${group.id}"
                    aria-expanded="${isOpen ? "true" : "false"}"
                    aria-controls="${panelId}"
                >
                    <span class="nav-icon"><i class="ph ${group.icon}" aria-hidden="true"></i></span>
                    <span class="nav-label">${escapeHtml(group.label)}</span>
                    <i class="ph ph-caret-right pos-mega-caret" aria-hidden="true"></i>
                </button>

                <div class="pos-mega-panel" id="${panelId}" data-mega-panel="${group.id}" role="region" aria-label="${escapeHtml(group.label)}">
                    <div class="pos-mega-grid">
                        ${tiles}
                    </div>
                </div>
            </div>`;
    }

    function buildAppMenuHtml(options = {}) {
        const user = getMenuUser(options.user);
        const active = options.active || inferActiveMenu();
        const username = escapeHtml(user?.username || "Admin");
        const currentRoleLabel = escapeHtml(roleLabel(user?.role));

        const navHtml = APP_MENU_GROUPS
            .filter((group) => isGroupVisible(group, user, active))
            .map((group) => {
                if (group.type === "link") {
                    const item = menuItemByKey(group.itemKey);
                    if (!item || !isMenuItemVisible(item, user, active)) {
                        return "";
                    }
                    return buildNavLinkHtml(item, active);
                }

                const items = visibleGroupItems(group, user, active);
                if (!items.length) {
                    return "";
                }
                // Keep groups closed on load so the panel never covers the POS workspace.
                // Active page still marks the parent group via is-active-group.
                return buildMegaGroupHtml(group, items, active, false);
            })
            .join("");

        // Hướng dẫn lives in the nav rail (not the logout footer):
        // - Scannable with other destinations
        // - Still visible on mobile bottom bar (footer is hidden ≤720px)
        // - Not confused with the destructive logout control
        return `
        <div class="pos-logo">
            <img
                class="pos-logo-image"
                src="/assets/images/pos-glasses-optic-bridge-logo.png"
                alt="POS GLASSES"
            >
        </div>

        <nav class="pos-nav pos-nav--mega" aria-label="Menu chính">
            ${navHtml}
            <div class="pos-nav-utilities" aria-label="Tiện ích">
                <button
                    type="button"
                    class="pos-nav-item pos-tour-restart"
                    data-tour-restart
                    title="Chạy hướng dẫn sử dụng"
                >
                    <span class="nav-icon"><i class="ph ph-compass-tool" aria-hidden="true"></i></span>
                    <span class="nav-label">Hướng dẫn</span>
                </button>
            </div>
        </nav>

        <div class="pos-sidebar-footer">
            <div class="user-info">
                <span class="user-avatar"><i class="ph ph-user"></i></span>
                <div class="user-details">
                    <span class="username" id="welcomeUser">${username}</span>
                    <span class="role" id="roleLabel">${currentRoleLabel}</span>
                </div>
            </div>
            <button class="btn-logout" type="button" onclick="logout()">
                <i class="ph ph-sign-out"></i> <span>Đăng xuất</span>
            </button>
        </div>`;
    }

    function setGroupOpen(groupEl, open) {
        if (!groupEl) {
            return;
        }
        groupEl.classList.toggle("is-open", open);
        const trigger = groupEl.querySelector("[data-mega-trigger]");
        if (trigger) {
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
        }
    }

    function measurePanelWidth() {
        if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
            return Math.min(248, window.innerWidth - 24);
        }
        if (window.matchMedia && window.matchMedia("(max-width: 991px)").matches) {
            return Math.min(228, window.innerWidth - 80);
        }
        return Math.min(212, window.innerWidth - 24);
    }

    function positionMegaPanel(groupEl) {
        const panel = groupEl?.querySelector(".pos-mega-panel");
        const trigger = groupEl?.querySelector(".pos-mega-trigger");
        if (!panel || !trigger) {
            return;
        }

        const rect = trigger.getBoundingClientRect();
        const panelWidth = measurePanelWidth();
        const isMobileBar = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
        const gap = 8;

        // Measure off-screen so list height is accurate before placing.
        const prevVis = panel.style.visibility;
        panel.style.visibility = "hidden";
        panel.style.opacity = "0";
        panel.style.display = "block";
        panel.style.width = `${panelWidth}px`;
        const panelHeight = panel.offsetHeight || 160;
        panel.style.display = "";
        panel.style.visibility = prevVis;
        panel.style.opacity = "";

        if (isMobileBar) {
            const left = Math.max(12, Math.min(
                rect.left + rect.width / 2 - panelWidth / 2,
                window.innerWidth - panelWidth - 12
            ));
            const top = Math.max(12, rect.top - panelHeight - gap);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.width = `${panelWidth}px`;
            return;
        }

        const left = Math.min(rect.right + gap, window.innerWidth - panelWidth - 12);
        const top = Math.max(12, Math.min(rect.top - 4, window.innerHeight - panelHeight - 12));
        panel.style.left = `${Math.max(12, left)}px`;
        panel.style.top = `${top}px`;
        panel.style.width = `${panelWidth}px`;
    }

    function closeMegaPanels(root) {
        root?.querySelectorAll(".pos-mega-group.is-open").forEach((groupEl) => {
            setGroupOpen(groupEl, false);
        });
    }

    function bindMegaMenu(root) {
        if (!root || root.dataset.megaBound === "1") {
            return;
        }
        root.dataset.megaBound = "1";

        let closeTimer = null;

        function cancelCloseTimer() {
            if (closeTimer != null) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
        }

        function scheduleClose() {
            cancelCloseTimer();
            // Small delay so the cursor can cross the rail→panel gap without flicker.
            closeTimer = setTimeout(() => {
                closeMegaPanels(root);
                closeTimer = null;
            }, 140);
        }

        function openGroup(groupEl) {
            if (!groupEl) {
                return;
            }
            cancelCloseTimer();
            root.querySelectorAll(".pos-mega-group").forEach((other) => {
                setGroupOpen(other, other === groupEl);
            });
            positionMegaPanel(groupEl);
        }

        root.querySelectorAll(".pos-mega-group").forEach((groupEl) => {
            groupEl.addEventListener("mouseenter", () => {
                openGroup(groupEl);
            });
            groupEl.addEventListener("mouseleave", () => {
                scheduleClose();
            });

            const trigger = groupEl.querySelector("[data-mega-trigger]");
            if (!trigger) {
                return;
            }

            // Click still toggles for touch / keyboard; outside click closes below.
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const willOpen = !groupEl.classList.contains("is-open");
                if (willOpen) {
                    openGroup(groupEl);
                } else {
                    cancelCloseTimer();
                    setGroupOpen(groupEl, false);
                }
            });
        });

        if (typeof document.addEventListener === "function") {
            document.addEventListener("click", (event) => {
                if (typeof root.contains === "function" && !root.contains(event.target)) {
                    cancelCloseTimer();
                    closeMegaPanels(root);
                }
            });

            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    cancelCloseTimer();
                    closeMegaPanels(root);
                }
            });
        }

        if (typeof window.addEventListener === "function") {
            window.addEventListener("resize", () => {
                cancelCloseTimer();
                closeMegaPanels(root);
            });
            window.addEventListener("scroll", () => {
                cancelCloseTimer();
                closeMegaPanels(root);
            }, true);
        }
    }

    function renderAppMenu(mount, options = {}) {
        const target = mount || document.querySelector("[data-menu-component]");

        if (!target) {
            return null;
        }

        const active = options.active || target.dataset.activeMenu || inferActiveMenu();
        target.className = "pos-sidebar";
        target.dataset.megaBound = "";
        target.innerHTML = buildAppMenuHtml({ ...options, active });
        bindMegaMenu(target);
        return target;
    }

    // ═══════════════════════════════════════════
    //  0.1. SHARED CUSTOM SELECT
    // ═══════════════════════════════════════════

    let openCustomSelect = null;

    function selectedOption(select) {
        return select.options[select.selectedIndex] || select.options[0] || null;
    }

    function optionLabel(option) {
        return option ? option.textContent.trim() : "";
    }

    function closeCustomSelect(wrapper) {
        const target = wrapper || openCustomSelect;

        if (!target) {
            return;
        }

        target.classList.remove("is-open");
        const trigger = target.querySelector(".pos-custom-select-trigger");
        if (trigger) {
            trigger.setAttribute("aria-expanded", "false");
        }

        if (openCustomSelect === target) {
            openCustomSelect = null;
        }
    }

    function openSelectMenu(wrapper) {
        if (openCustomSelect && openCustomSelect !== wrapper) {
            closeCustomSelect(openCustomSelect);
        }

        wrapper.classList.add("is-open");
        const trigger = wrapper.querySelector(".pos-custom-select-trigger");
        if (trigger) {
            trigger.setAttribute("aria-expanded", "true");
        }
        openCustomSelect = wrapper;
    }

    function dispatchSelectChange(select) {
        const event = typeof Event === "function"
            ? new Event("change", { bubbles: true })
            : document.createEvent("Event");

        if (event.initEvent) {
            event.initEvent("change", true, true);
        }

        select.dispatchEvent(event);
    }

    function syncCustomSelect(select) {
        const wrapper = select._posCustomSelect;

        if (!wrapper) {
            return;
        }

        const triggerText = wrapper.querySelector(".pos-custom-select-value");
        const menu = wrapper.querySelector(".pos-custom-select-menu");
        const currentValue = String(select.value ?? "");

        if (triggerText) {
            triggerText.textContent = optionLabel(selectedOption(select)) || select.getAttribute("aria-label") || "Chọn";
        }

        if (!menu) {
            return;
        }

        menu.innerHTML = "";
        Array.from(select.options).forEach((option) => {
            const item = document.createElement("button");
            const value = String(option.value ?? "");
            const isSelected = value === currentValue;

            item.type = "button";
            item.className = `pos-custom-select-option${isSelected ? " is-selected" : ""}`;
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", isSelected ? "true" : "false");
            item.dataset.value = value;
            item.innerHTML = `
                <span>${escapeHtml(optionLabel(option))}</span>
                ${isSelected ? '<i class="ph ph-check"></i>' : ""}
            `;

            if (option.disabled) {
                item.disabled = true;
            }

            item.addEventListener("click", () => {
                select.value = value;
                dispatchSelectChange(select);
                syncCustomSelect(select);
                closeCustomSelect(wrapper);
            });

            menu.appendChild(item);
        });
    }

    function createCustomSelect(select) {
        if (!select || select.dataset.customSelect === "native" || select._posCustomSelect) {
            return select?._posCustomSelect || null;
        }

        if (!select.parentNode) {
            return null;
        }

        const wrapper = document.createElement("div");
        const selectId = select.id || `posSelect_${Math.random().toString(36).slice(2)}`;
        const trigger = document.createElement("button");
        const menu = document.createElement("div");

        if (!select.id) {
            select.id = selectId;
        }

        wrapper.className = "pos-custom-select";
        wrapper.dataset.for = selectId;
        trigger.type = "button";
        trigger.className = "pos-custom-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        trigger.innerHTML = `
            <span class="pos-custom-select-value"></span>
            <i class="ph ph-caret-down"></i>
        `;
        menu.className = "pos-custom-select-menu";
        menu.setAttribute("role", "listbox");

        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);
        select.after(wrapper);
        select.classList.add("native-select-hidden");
        select.tabIndex = -1;
        select._posCustomSelect = wrapper;

        trigger.addEventListener("click", () => {
            if (wrapper.classList.contains("is-open")) {
                closeCustomSelect(wrapper);
            } else {
                openSelectMenu(wrapper);
            }
        });

        trigger.addEventListener("keydown", (event) => {
            if (["Enter", " ", "ArrowDown"].includes(event.key)) {
                event.preventDefault();
                openSelectMenu(wrapper);
                const selected = menu.querySelector(".pos-custom-select-option.is-selected") ||
                    menu.querySelector(".pos-custom-select-option:not(:disabled)");
                if (selected) {
                    selected.focus();
                }
            }

            if (event.key === "Escape") {
                closeCustomSelect(wrapper);
            }
        });

        menu.addEventListener("keydown", (event) => {
            const options = Array.from(menu.querySelectorAll(".pos-custom-select-option:not(:disabled)"));
            const index = options.indexOf(document.activeElement);

            if (event.key === "Escape") {
                closeCustomSelect(wrapper);
                trigger.focus();
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                (options[index + 1] || options[0])?.focus();
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                (options[index - 1] || options[options.length - 1])?.focus();
            }
        });

        select.addEventListener("change", () => syncCustomSelect(select));

        if (typeof MutationObserver === "function") {
            const observer = new MutationObserver(() => syncCustomSelect(select));
            observer.observe(select, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["selected", "disabled", "label"]
            });
        }

        syncCustomSelect(select);
        return wrapper;
    }

    function enhanceCustomSelects(root = document) {
        if (!root || typeof root.querySelectorAll !== "function") {
            return [];
        }

        return Array.from(root.querySelectorAll("select.form-select, select.pos-select, select.form-modal-input"))
            .map(createCustomSelect)
            .filter(Boolean);
    }

    function renderAllAppMenus() {
        document.querySelectorAll("[data-menu-component]").forEach((mount) => {
            renderAppMenu(mount);
        });
    }

    function initializeSharedComponents() {
        renderAllAppMenus();
        enhanceCustomSelects();
        ensureOnboardingAssets();
    }

    function ensureStylesheet(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScriptOnce(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === "1") resolve();
                else existing.addEventListener("load", resolve, { once: true });
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.addEventListener("load", () => {
                script.dataset.loaded = "1";
                resolve();
            }, { once: true });
            script.addEventListener("error", reject, { once: true });
            document.head.appendChild(script);
        });
    }

    function ensureOnboardingAssets() {
        if (typeof document.querySelector !== "function"
            || typeof document.createElement !== "function"
            || !document.head) return;
        if (!document.querySelector("[data-menu-component]")) return;
        ensureStylesheet("/vendor/tourguide/css/tour.min.css");
        ensureStylesheet("/assets/css/onboarding.css");
        const tourReady = (window.tourguide && window.tourguide.TourGuideClient)
            ? Promise.resolve()
            : loadScriptOnce("/vendor/tourguide/tour.js");
        // Keep a shared promise so "Hướng dẫn" can wait for assets if needed.
        window.__posOnboardingAssetsReady = tourReady
            .then(() => loadScriptOnce("/assets/js/onboarding.js"))
            .catch((error) => {
                // Onboarding must never block core POS actions.
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("[onboarding] failed to load TourGuide assets", error);
                }
            });
        return window.__posOnboardingAssetsReady;
    }

    if (typeof document.addEventListener === "function") {
        document.addEventListener("click", (event) => {
            if (openCustomSelect && !openCustomSelect.contains(event.target)) {
                closeCustomSelect(openCustomSelect);
            }
        });
    }

    renderAllAppMenus();
    enhanceCustomSelects();
    ensureOnboardingAssets();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeSharedComponents);
    }

    // ═══════════════════════════════════════════
    //  1. TOAST NOTIFICATION
    // ═══════════════════════════════════════════

    let toastContainer = null;

    function ensureToastContainer() {
        if (toastContainer && document.body.contains(toastContainer)) return;
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        toastContainer.id = "toastContainer";
        document.body.appendChild(toastContainer);
    }

    /**
     * Show a toast notification.
     * @param {string} message - Text to display
     * @param {"success"|"error"|"warning"|"info"} type - Toast type
     * @param {number} duration - Auto-dismiss in ms (default 3500)
     */
    function showToast(message, type = "info", duration = 3500) {
        ensureToastContainer();

        const iconMap = {
            success: "ph-check-circle",
            error: "ph-x-circle",
            warning: "ph-warning",
            info: "ph-info"
        };

        const toast = document.createElement("div");
        toast.className = `toast-item toast-${type}`;
        toast.innerHTML = `
            <i class="ph ${iconMap[type]} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.closest('.toast-item').remove()">
                <i class="ph ph-x"></i>
            </button>
        `;

        toastContainer.appendChild(toast);

        // Trigger enter animation
        requestAnimationFrame(() => {
            toast.classList.add("toast-enter");
        });

        // Auto dismiss
        const timer = setTimeout(() => {
            dismissToast(toast);
        }, duration);

        toast.addEventListener("mouseenter", () => clearTimeout(timer));
        toast.addEventListener("mouseleave", () => {
            setTimeout(() => dismissToast(toast), 1500);
        });
    }

    function dismissToast(el) {
        if (!el || !el.parentNode) return;
        el.classList.add("toast-exit");
        el.addEventListener("animationend", () => el.remove());
    }

    // ═══════════════════════════════════════════
    //  1.5 BACKDROP DISMISS (system-wide rule)
    // ═══════════════════════════════════════════

    /**
     * Close an overlay ONLY when press AND release both happen on the backdrop.
     *
     * Why not `click`?
     * Browser click retargeting fires on the common ancestor when mousedown and
     * mouseup land on different nodes. Dragging from a dialog/input onto the
     * dimmed area can therefore look like a backdrop click and wrongly close
     * the popup. We use pointerdown + pointerup on the exact backdrop node.
     *
     * @param {Element} overlay - Full-screen backdrop element
     * @param {() => void} onDismiss - Called when backdrop is intentionally activated
     * @param {object} [options]
     * @param {boolean} [options.once=false] - Remove listeners after first dismiss
     * @returns {() => void} unbind function
     */
    function bindBackdropDismiss(overlay, onDismiss, options = {}) {
        if (!overlay || typeof onDismiss !== "function") {
            return () => {};
        }

        if (overlay._posBackdropDismissUnbind) {
            return overlay._posBackdropDismissUnbind;
        }

        let downOnBackdrop = false;
        let activePointerId = null;

        function isPrimaryButton(event) {
            // pointer/mouse: button 0; touch/pen often button === 0 or -1
            return event.button === undefined || event.button === 0 || event.button === -1;
        }

        function isBackdropEvent(event) {
            // Direct hit on the dimmed layer only — not on .modal-dialog children.
            return event.target === overlay;
        }

        function resetPressState() {
            downOnBackdrop = false;
            activePointerId = null;
        }

        function onPointerDown(event) {
            if (!isPrimaryButton(event)) {
                return;
            }

            downOnBackdrop = isBackdropEvent(event);
            activePointerId = event.pointerId != null ? event.pointerId : "mouse";
        }

        function onPointerUp(event) {
            if (activePointerId != null && event.pointerId != null && event.pointerId !== activePointerId) {
                return;
            }

            if (!isPrimaryButton(event)) {
                resetPressState();
                return;
            }

            const shouldDismiss = downOnBackdrop && isBackdropEvent(event);
            resetPressState();

            if (!shouldDismiss) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            onDismiss(event);

            if (options.once) {
                unbind();
            }
        }

        function onPointerCancel() {
            resetPressState();
        }

        // Swallow residual click on backdrop so no other handler can close via click retargeting.
        function onClickCapture(event) {
            if (isBackdropEvent(event)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }

        function unbind() {
            overlay.removeEventListener("pointerdown", onPointerDown);
            overlay.removeEventListener("pointerup", onPointerUp);
            overlay.removeEventListener("pointercancel", onPointerCancel);
            overlay.removeEventListener("mousedown", onPointerDown);
            overlay.removeEventListener("mouseup", onPointerUp);
            overlay.removeEventListener("click", onClickCapture, true);
            if (overlay._posBackdropDismissUnbind === unbind) {
                delete overlay._posBackdropDismissUnbind;
            }
        }

        // Bubble phase: target is the deepest node (dialog/input/button or backdrop).
        overlay.addEventListener("pointerdown", onPointerDown);
        overlay.addEventListener("pointerup", onPointerUp);
        overlay.addEventListener("pointercancel", onPointerCancel);
        // Mouse fallback when PointerEvent is unavailable.
        overlay.addEventListener("mousedown", onPointerDown);
        overlay.addEventListener("mouseup", onPointerUp);
        overlay.addEventListener("click", onClickCapture, true);

        // Dialog panel should not carry "text" selection feel into buttons; mark panel.
        const panel = overlay.querySelector(".modal-dialog, .pos-pair-dialog, [data-modal-panel]");
        if (panel) {
            panel.setAttribute("data-modal-panel", "");
        }

        overlay._posBackdropDismissUnbind = unbind;
        return unbind;
    }

    // ═══════════════════════════════════════════
    //  2. CONFIRM DIALOG
    // ═══════════════════════════════════════════

    /**
     * Show a confirm dialog. Returns a Promise<boolean>.
     * @param {object} options
     * @param {string} options.title - Dialog title
     * @param {string} options.message - Dialog body
     * @param {string} [options.confirmText="Xác nhận"]
     * @param {string} [options.cancelText="Hủy bỏ"]
     * @param {"danger"|"warning"|"info"} [options.type="danger"]
     */
    function showConfirm(options = {}) {
        const {
            title = "Xác nhận thao tác",
            message = "Bạn có chắc chắn muốn tiếp tục?",
            confirmText = "Xác nhận",
            cancelText = "Hủy bỏ",
            type = "danger"
        } = options;

        const iconMap = {
            danger: "ph-trash",
            warning: "ph-warning-circle",
            info: "ph-question"
        };

        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "modal-overlay";

            overlay.innerHTML = `
                <div class="modal-dialog confirm-dialog">
                    <div class="modal-dialog-icon modal-icon-${type}">
                        <i class="ph ${iconMap[type]}"></i>
                    </div>
                    <h3 class="modal-dialog-title">${title}</h3>
                    <p class="modal-dialog-message">${message}</p>
                    <div class="modal-dialog-actions">
                        <button type="button" class="btn-modal btn-modal-cancel" data-action="cancel">
                            ${cancelText}
                        </button>
                        <button type="button" class="btn-modal btn-modal-${type}" data-action="confirm">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            enhanceCustomSelects(overlay);
            requestAnimationFrame(() => overlay.classList.add("modal-visible"));

            // Focus the confirm button
            const confirmBtn = overlay.querySelector('[data-action="confirm"]');
            if (confirmBtn) confirmBtn.focus();

            let settled = false;
            function cleanup(result) {
                if (settled) return;
                settled = true;
                if (typeof unbindBackdrop === "function") unbindBackdrop();
                overlay.classList.remove("modal-visible");
                overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
                // Fallback remove if transitionend never fires
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 400);
                resolve(result);
            }

            const unbindBackdrop = bindBackdropDismiss(overlay, () => cleanup(false));

            overlay.querySelector('[data-action="confirm"]').addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                cleanup(true);
            });
            overlay.querySelector('[data-action="cancel"]').addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                cleanup(false);
            });
            overlay.addEventListener("keydown", (e) => {
                if (e.key === "Escape") cleanup(false);
            });
        });
    }

    // ═══════════════════════════════════════════
    //  3. FORM MODAL
    // ═══════════════════════════════════════════

    /**
     * Show a form modal with multiple fields. Returns Promise<object|null>.
     * @param {object} options
     * @param {string} options.title - Modal title
     * @param {Array<{name: string, label: string, type?: string, value?: string, placeholder?: string, required?: boolean}>} options.fields
     * @param {string} [options.submitText="Lưu"]
     * @param {string} [options.cancelText="Hủy bỏ"]
     */
    function showFormModal(options = {}) {
        const {
            title = "Nhập thông tin",
            fields = [],
            submitText = "Lưu",
            cancelText = "Hủy bỏ"
        } = options;

        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "modal-overlay";

            let fieldsHtml = "";
            fields.forEach((field, index) => {
                const inputType = field.type || "text";
                const isMoney = inputType === "money" || field.money === true;
                const required = field.required !== false ? "required" : "";
                let displayValue = field.value;
                if (isMoney && displayValue != null && displayValue !== ""
                    && typeof window.formatCurrencyInputValue === "function") {
                    displayValue = window.formatCurrencyInputValue(displayValue);
                }
                const value = displayValue != null
                    ? `value="${String(displayValue).replace(/"/g, "&quot;")}"`
                    : "";
                const placeholder = field.placeholder
                    ? `placeholder="${field.placeholder}"`
                    : (isMoney ? 'placeholder="0đ"' : "");

                if (inputType === "select" && field.options) {
                    let optionsHtml = "";
                    field.options.forEach(opt => {
                        const selected = String(opt.value) === String(field.value) ? "selected" : "";
                        optionsHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    fieldsHtml += `
                        <div class="form-modal-field">
                            <label for="formField_${index}">${field.label}</label>
                            <select id="formField_${index}" name="${field.name}" class="form-modal-input" ${required}>
                                ${optionsHtml}
                            </select>
                        </div>
                    `;
                } else if (inputType === "textarea") {
                    fieldsHtml += `
                        <div class="form-modal-field">
                            <label for="formField_${index}">${field.label}</label>
                            <textarea id="formField_${index}" name="${field.name}" class="form-modal-input" rows="3" ${placeholder} ${required}>${field.value || ""}</textarea>
                        </div>
                    `;
                } else if (isMoney) {
                    fieldsHtml += `
                        <div class="form-modal-field">
                            <label for="formField_${index}">${field.label}</label>
                            <input type="text" inputmode="numeric" autocomplete="off"
                                id="formField_${index}" name="${field.name}"
                                class="form-modal-input pos-money-input"
                                data-money="vnd"
                                ${value} ${placeholder} ${required}>
                        </div>
                    `;
                } else {
                    const htmlType = inputType === "money" ? "text" : inputType;
                    fieldsHtml += `
                        <div class="form-modal-field">
                            <label for="formField_${index}">${field.label}</label>
                            <input type="${htmlType}" id="formField_${index}" name="${field.name}" class="form-modal-input" ${value} ${placeholder} ${required}>
                        </div>
                    `;
                }
            });

            overlay.innerHTML = `
                <div class="modal-dialog form-modal" role="dialog" aria-modal="true" aria-label="${String(title).replace(/"/g, "&quot;")}">
                    <div class="form-modal-header">
                        <h3 class="form-modal-title">${title}</h3>
                        <button type="button" class="form-modal-close" data-action="cancel" aria-label="Đóng">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <form class="form-modal-body" id="formModalForm">
                        <div class="form-modal-fields">
                            ${fieldsHtml}
                        </div>
                        <div class="modal-dialog-actions form-modal-actions">
                            <button type="button" class="btn-modal btn-modal-cancel" data-action="cancel">
                                ${cancelText}
                            </button>
                            <button type="submit" class="btn-modal btn-modal-primary">
                                <i class="ph ph-check"></i> ${submitText}
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(overlay);
            if (typeof window.enhanceMoneyInputs === "function") {
                window.enhanceMoneyInputs(overlay);
            }
            requestAnimationFrame(() => overlay.classList.add("modal-visible"));

            // Focus first input
            const firstInput = overlay.querySelector(".form-modal-input");
            if (firstInput) firstInput.focus();

            let settled = false;
            function cleanup(result) {
                if (settled) return;
                settled = true;
                if (typeof unbindBackdrop === "function") unbindBackdrop();
                overlay.classList.remove("modal-visible");
                overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 400);
                resolve(result);
            }

            const unbindBackdrop = bindBackdropDismiss(overlay, () => cleanup(null));

            // Submit handler — money fields return whole-dong integers
            overlay.querySelector("#formModalForm").addEventListener("submit", (e) => {
                e.preventDefault();
                const formData = {};
                fields.forEach((field, index) => {
                    const el = overlay.querySelector(`#formField_${index}`);
                    const isMoney = field.type === "money" || field.money === true
                        || (el && el.dataset && el.dataset.money && el.dataset.money !== "false");
                    if (isMoney && typeof window.parseCurrencyInputValue === "function") {
                        formData[field.name] = window.parseCurrencyInputValue(el.value);
                    } else {
                        formData[field.name] = el.value;
                    }
                });
                cleanup(formData);
            });

            // Cancel handlers
            overlay.querySelectorAll('[data-action="cancel"]').forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(null);
                });
            });
            overlay.addEventListener("keydown", (e) => {
                if (e.key === "Escape") cleanup(null);
            });
        });
    }

    // ═══════════════════════════════════════════
    //  EXPORTS
    // ═══════════════════════════════════════════
    window.buildAppMenuHtml = buildAppMenuHtml;
    window.renderAppMenu = renderAppMenu;
    window.createCustomSelect = createCustomSelect;
    window.enhanceCustomSelects = enhanceCustomSelects;
    window.syncCustomSelect = syncCustomSelect;
    window.bindBackdropDismiss = bindBackdropDismiss;
    window.showToast = showToast;
    window.showConfirm = showConfirm;
    window.showFormModal = showFormModal;

})(window);
