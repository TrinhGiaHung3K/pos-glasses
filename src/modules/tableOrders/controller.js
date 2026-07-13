const { subscribeTableOrderEvents } = require("./events");

function createTableOrdersController(service) {
    return {
        async createPublic(req, res) {
            res.status(201).json(await service.createPublicOrder(req.body));
        },

        async listPending(req, res) {
            res.json(await service.findPending());
        },

        async detail(req, res) {
            res.json(await service.findDetail(req.params.id));
        },

        async confirm(req, res) {
            res.json(await service.confirm(req.params.id, req.user));
        },

        async cancel(req, res) {
            res.json(await service.cancel(req.params.id));
        },

        /**
         * Server-Sent Events stream for pending QR queue.
         * Auth: JWT via query ?token= (EventSource cannot set Authorization header).
         */
        async stream(req, res) {
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders?.();

            const send = (payload) => {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            };

            send({ type: "hello", at: new Date().toISOString() });

            // Heartbeat every 25s
            const heartbeat = setInterval(() => {
                res.write(`: ping ${Date.now()}\n\n`);
            }, 25000);

            const unsubscribe = subscribeTableOrderEvents((event) => {
                send(event);
            });

            req.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        }
    };
}

module.exports = {
    createTableOrdersController
};
