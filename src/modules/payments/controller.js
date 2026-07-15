const { subscribePaymentEvents } = require("./events");

function createPaymentsController(service) {
    return {
        async createTestIntent(req, res) {
            res.status(201).json(await service.createTestIntent(req.user));
        },
        async getIntent(req, res) {
            res.json(await service.findIntent(req.params.publicId));
        },
        async createOrderIntent(req, res) {
            res.status(201).json(await service.createOrderIntent(req.body, req.user, { ip: req.ip }));
        },
        async simulate(req, res) {
            res.json(await service.simulatePayment(req.params.publicId, req.user));
        },
        async webhook(req, res) {
            res.json(await service.handleWebhook(req.headers, req.rawBody || "", req.body));
        },
        async stream(req, res) {
            const publicId = String(req.params.publicId || "");
            const intent = await service.findIntent(publicId);
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.flushHeaders?.();
            const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
            // Send the persisted state immediately. This closes the race where
            // the webhook is processed before EventSource has connected.
            send({
                type: `payment.${intent.status}`,
                public_id: publicId,
                order_id: intent.order_id,
                status: intent.status,
                at: new Date().toISOString()
            });
            const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 25000);
            const unsubscribe = subscribePaymentEvents((event) => {
                if (event.public_id === publicId) send(event);
            });
            req.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
        async adminList(req, res) {
            res.json(await service.adminList(req.query, req.user));
        }
    };
}

module.exports = { createPaymentsController };
