(function attachPosOnboarding(window) {
    const TOUR_VERSION = "v1";
    const TOUR_GROUP = "pos-glasses-onboarding";
    let restartBound = false;
    let starting = false;

    function currentUser() {
        return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
    }

    function landingPath(user) {
        return user?.role === "admin" ? "/dashboard.html" : "/orders.html";
    }

    function isOnLanding(user) {
        const path = window.location?.pathname || "";
        return path === landingPath(user);
    }

    function storageKey(user) {
        return `pos_glasses_tour_${TOUR_VERSION}_${user?.id || "unknown"}_${user?.role || "staff"}`;
    }

    function markTourSeen(user) {
        try {
            localStorage.setItem(storageKey(user), new Date().toISOString());
        } catch (error) {
            // Ignore storage failures (private mode, quota, etc.)
        }
    }

    function notify(message, type = "warning") {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }
        if (typeof console !== "undefined" && console.warn) {
            console.warn(message);
        }
    }

    function resolveTourGuideClient() {
        return window.tourguide?.TourGuideClient
            || window.TourGuideClient
            || null;
    }

    async function waitForTourGuideClient(timeoutMs = 6000) {
        const existing = resolveTourGuideClient();
        if (existing) return existing;

        if (window.__posOnboardingAssetsReady && typeof window.__posOnboardingAssetsReady.then === "function") {
            try {
                await Promise.race([
                    window.__posOnboardingAssetsReady,
                    new Promise((resolve) => setTimeout(resolve, timeoutMs))
                ]);
            } catch (error) {
                // continue polling below
            }
            const afterAssets = resolveTourGuideClient();
            if (afterAssets) return afterAssets;
        }

        return new Promise((resolve) => {
            const startedAt = Date.now();
            const timer = setInterval(() => {
                const Client = resolveTourGuideClient();
                if (Client) {
                    clearInterval(timer);
                    resolve(Client);
                    return;
                }
                if (Date.now() - startedAt >= timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 50);
        });
    }

    function stepsFor(user) {
        const group = TOUR_GROUP;
        if (user?.role === "admin") {
            return [
                {
                    group,
                    order: 1,
                    title: "Chào mừng quản trị viên",
                    content: "Đây là trung tâm vận hành POS Glasses. Hướng dẫn ngắn này chỉ xuất hiện ở lần sử dụng đầu tiên.",
                    target: ".pos-page-intro"
                },
                {
                    group,
                    order: 2,
                    title: "Điều hướng hệ thống",
                    content: "Menu bên trái gom bán hàng, hàng hóa, kho, khách hàng, báo cáo và các chức năng quản trị.",
                    target: ".pos-nav"
                },
                {
                    group,
                    order: 3,
                    title: "Chọn kỳ báo cáo",
                    content: "Đổi kỳ hôm nay, 7 ngày hoặc 30 ngày để các KPI và biểu đồ cập nhật đồng bộ.",
                    target: "#dashboardRange"
                },
                {
                    group,
                    order: 4,
                    title: "Theo dõi chỉ số quan trọng",
                    content: "Doanh thu, lãi gộp, tồn kho và khách hàng được tổng hợp tại đây để xử lý nhanh các bất thường.",
                    target: ".dashboard-kpi-grid"
                },
                {
                    group,
                    order: 5,
                    title: "Bắt đầu bán hàng",
                    content: "Mở quầy POS từ nút Bán hàng. Chạy lại hướng dẫn bất cứ lúc nào từ mục Hướng dẫn trong menu trái.",
                    target: ".pos-topbar-actions .btn-primary"
                }
            ];
        }

        return [
            {
                group,
                order: 1,
                title: "Chào mừng đến quầy POS",
                content: "Quy trình chính gồm tìm hoặc quét sản phẩm, xác thực khách hàng, kiểm tra giỏ và chọn phương thức thanh toán.",
                target: ".pos-session-strip"
            },
            {
                group,
                order: 2,
                title: "Quét hoặc tìm kính",
                content: "Đặt con trỏ ở đây để quét SKU/barcode hoặc gõ tên sản phẩm. Phím F2 đưa nhanh con trỏ về ô tìm kiếm.",
                target: "#productSearch"
            },
            {
                group,
                order: 3,
                title: "Xác thực hội viên",
                content: "Quét barcode khách hàng để áp dụng điểm, hạng thành viên và lịch sử chăm sóc đúng hồ sơ.",
                target: "#memberScanCard"
            },
            {
                group,
                order: 4,
                title: "Kiểm tra giỏ hàng",
                content: "Điều chỉnh số lượng, giảm giá và kiểm tra tổng tiền trước khi xác nhận.",
                target: ".pos-checkout-rail"
            },
            {
                group,
                order: 5,
                title: "Thanh toán an toàn",
                content: "Với chuyển khoản, hệ thống tạo VietQR và chỉ hoàn tất hóa đơn sau khi SePay xác nhận giao dịch.",
                target: ".pos-pay-methods"
            },
            {
                group,
                order: 6,
                title: "Hoàn tất",
                content: "Nhấn Thanh toán hoặc dùng F4. Chạy lại hướng dẫn từ mục Hướng dẫn trong menu trái.",
                target: "#checkoutButton"
            }
        ];
    }

    function availableSteps(user) {
        // Always return fresh step objects so target selectors stay strings
        // (TourGuide mutates step.target to Element references on first run).
        return stepsFor(user)
            .map((step) => ({ ...step }))
            .filter((step) => {
                if (!step.target) return true;
                try {
                    return Boolean(document.querySelector(step.target));
                } catch (error) {
                    return false;
                }
            });
    }

    /**
     * TourGuideClient appends dialog/backdrop with fixed IDs (tg-dialog-next-btn…).
     * Creating a second client without removing the first breaks getElementById
     * lookups and leaves "Tiếp" bound to a hidden orphan dialog.
     */
    async function destroyTourInstance(client) {
        if (client) {
            try {
                // Unstick library state before tearing down listeners/DOM.
                client._promiseWaiting = false;
                client.isVisible = false;
                client.activeStep = 0;
            } catch (error) {
                // ignore
            }

            try {
                if (typeof client.destroyListeners === "function") {
                    await client.destroyListeners();
                }
            } catch (error) {
                // ignore
            }

            try {
                if (client.dialog && typeof client.dialog.remove === "function") {
                    client.dialog.remove();
                } else if (client.dialog?.parentNode) {
                    client.dialog.parentNode.removeChild(client.dialog);
                }
            } catch (error) {
                // ignore
            }

            try {
                if (client.backdrop && typeof client.backdrop.remove === "function") {
                    client.backdrop.remove();
                } else if (client.backdrop?.parentNode) {
                    client.backdrop.parentNode.removeChild(client.backdrop);
                }
            } catch (error) {
                // ignore
            }
        }

        // Sweep any orphaned nodes from previous broken restarts.
        try {
            document.querySelectorAll(".tg-dialog, .tg-backdrop").forEach((node) => {
                try {
                    node.remove();
                } catch (error) {
                    if (node.parentNode) node.parentNode.removeChild(node);
                }
            });
        } catch (error) {
            // ignore
        }

        try {
            document.body?.classList?.remove("tg-no-interaction");
        } catch (error) {
            // ignore
        }

        if (window.posOnboardingTour === client) {
            window.posOnboardingTour = null;
        }
    }

    async function startTour(options = {}) {
        const user = currentUser();
        if (!user) {
            notify("Vui lòng đăng nhập để xem hướng dẫn.", "warning");
            return;
        }
        if (starting) return;

        const landing = landingPath(user);
        const manual = Boolean(options.manual);

        // Auto first-use must never hijack navigation from other pages.
        // Only an explicit manual restart may jump to the role landing page.
        if (!isOnLanding(user)) {
            if (manual) {
                window.location.href = `${landing}?tour=1`;
            }
            return;
        }

        starting = true;
        try {
            const Client = await waitForTourGuideClient();
            if (!Client) {
                if (!manual) markTourSeen(user);
                notify("Không tải được TourGuide. Thử tải lại trang.", "error");
                return;
            }

            const steps = availableSteps(user);
            if (!steps.length) {
                if (!manual) markTourSeen(user);
                if (manual) {
                    history.replaceState({}, "", landing);
                    notify("Không tìm thấy phần tử hướng dẫn trên trang này.", "warning");
                }
                return;
            }

            // Always tear down previous instance before creating a new one.
            await destroyTourInstance(window.posOnboardingTour);

            const client = new Client({
                steps,
                nextLabel: "Tiếp",
                prevLabel: "Quay lại",
                finishLabel: "Hoàn tất",
                closeButton: true,
                exitOnEscape: true,
                exitOnClickOutside: false,
                keyboardControls: true,
                autoScroll: true,
                autoScrollSmooth: true,
                showStepProgress: true,
                targetPadding: 12,
                dialogZ: 10050,
                dialogClass: "pos-onboarding-dialog",
                backdropColor: "rgba(5, 20, 18, 0.78)",
                completeOnFinish: true,
                debug: false
            });

            if (typeof client.deleteFinishedTour === "function") {
                try {
                    client.deleteFinishedTour(TOUR_GROUP);
                    client.deleteFinishedTour("tour");
                } catch (error) {
                    // ignore storage errors
                }
            }

            const markSeen = () => markTourSeen(user);
            client.onFinish(markSeen);
            client.onAfterExit(markSeen);
            window.posOnboardingTour = client;

            // start(group) keeps only steps whose group matches.
            await client.start(TOUR_GROUP);

            if (manual) {
                history.replaceState({}, "", landing);
            }
        } catch (error) {
            await destroyTourInstance(window.posOnboardingTour);
            if (!manual) markTourSeen(user);
            const message = error && typeof error === "string"
                ? error
                : (error?.message || "Không thể mở hướng dẫn.");
            notify(
                message === "Tour already active"
                    ? "Hướng dẫn đang chạy. Đóng tour hiện tại rồi thử lại."
                    : `Không thể mở hướng dẫn: ${message}`,
                "error"
            );
            if (typeof console !== "undefined" && console.error) {
                console.error("[onboarding]", error);
            }
        } finally {
            starting = false;
        }
    }

    function bindRestartControl() {
        if (restartBound) return;
        restartBound = true;
        // Event delegation survives sidebar re-renders from components.js.
        document.addEventListener("click", (event) => {
            const trigger = event.target?.closest?.("[data-tour-restart]");
            if (!trigger) return;
            event.preventDefault();
            event.stopPropagation();
            startTour({ manual: true });
        });
    }

    function initialize() {
        bindRestartControl();

        const user = currentUser();
        if (!user) return;

        const manual = new URLSearchParams(window.location.search).get("tour") === "1";
        if (manual) {
            setTimeout(() => startTour({ manual: true }), 400);
            return;
        }

        // First-use: only auto-start on the role landing page.
        if (!localStorage.getItem(storageKey(user)) && isOnLanding(user)) {
            setTimeout(() => startTour({ manual: false }), 700);
        }
    }

    window.startPosOnboardingTour = startTour;
    window.stopPosOnboardingTour = () => destroyTourInstance(window.posOnboardingTour);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})(window);
