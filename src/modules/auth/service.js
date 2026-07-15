const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");
const { createHttpError } = require("../../middleware/httpError");

const SALT_ROUNDS = 12;
const ALLOWED_ROLES = new Set(["admin", "staff"]);

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        env.jwt.secret,
        { expiresIn: env.jwt.expiresIn }
    );
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active == null ? true : Number(user.is_active) === 1
    };
}

function createAuthService(repository, options = {}) {
    const auditService = options.auditService || null;

    async function writeAudit(entry) {
        if (!auditService || typeof auditService.log !== "function") {
            return;
        }
        try {
            await auditService.log(entry);
        } catch {
            // never block auth
        }
    }

    return {
        async validateSession(claims) {
            const user = await repository.findById(Number(claims?.id));
            if (!user || (user.is_active != null && Number(user.is_active) === 0)) {
                throw createHttpError(401, "Phiên đăng nhập không còn hiệu lực");
            }
            return publicUser(user);
        },

        findAllUsers() {
            return repository.findAllUsers().then((rows) =>
                rows.map((row) => ({
                    ...row,
                    is_active: row.is_active == null ? 1 : Number(row.is_active)
                }))
            );
        },

        async login(payload, meta = {}) {
            const { username, password } = payload;

            if (!username || !password) {
                throw createHttpError(400, "Vui lòng nhập tên đăng nhập và mật khẩu");
            }

            const user = await repository.findByUsername(String(username).trim());

            if (!user) {
                await writeAudit({
                    actor_id: null,
                    action: "auth.login_failed",
                    entity_type: "user",
                    entity_id: null,
                    payload: { username: String(username).trim().slice(0, 50), reason: "not_found" },
                    ip: meta.ip || null
                });
                throw createHttpError(401, "Tên đăng nhập hoặc mật khẩu không đúng");
            }

            if (user.is_active != null && Number(user.is_active) === 0) {
                await writeAudit({
                    actor_id: user.id,
                    action: "auth.login_failed",
                    entity_type: "user",
                    entity_id: user.id,
                    payload: { reason: "disabled" },
                    ip: meta.ip || null
                });
                throw createHttpError(403, "Tài khoản đã bị vô hiệu hóa");
            }

            const isBcryptHash = user.password.startsWith("$2b$") || user.password.startsWith("$2a$");
            let isPasswordValid = false;

            if (isBcryptHash) {
                isPasswordValid = await bcrypt.compare(password, user.password);
            } else {
                // Legacy plain-text seed → migrate on success
                isPasswordValid = password === user.password;
                if (isPasswordValid) {
                    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                    await repository.updatePassword(user.id, hashedPassword);
                }
            }

            if (!isPasswordValid) {
                await writeAudit({
                    actor_id: user.id,
                    action: "auth.login_failed",
                    entity_type: "user",
                    entity_id: user.id,
                    payload: { reason: "bad_password" },
                    ip: meta.ip || null
                });
                throw createHttpError(401, "Tên đăng nhập hoặc mật khẩu không đúng");
            }

            const token = generateToken(user);
            await writeAudit({
                actor_id: user.id,
                action: "auth.login_success",
                entity_type: "user",
                entity_id: user.id,
                payload: { username: user.username },
                ip: meta.ip || null
            });

            return {
                message: "Login successful",
                token,
                user: publicUser(user)
            };
        },

        /**
         * Public register — only when ALLOW_PUBLIC_REGISTER=true.
         * Always creates role=staff.
         */
        async register(payload) {
            if (!env.security.allowPublicRegister) {
                throw createHttpError(
                    403,
                    "Đăng ký công khai đã tắt. Liên hệ quản trị để tạo tài khoản."
                );
            }
            return this.createUser(payload, { role: "staff", allowToken: true });
        },

        /**
         * Admin create user (staff or admin).
         */
        async createUser(payload, optionsCreate = {}) {
            const username = String(payload.username || "").trim();
            const password = payload.password;
            const confirmPassword = payload.confirmPassword;
            const role = String(optionsCreate.role || payload.role || "staff").trim().toLowerCase();

            if (!username || !password) {
                throw createHttpError(400, "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu");
            }

            if (username.length < 3 || username.length > 50) {
                throw createHttpError(400, "Tên đăng nhập phải từ 3 đến 50 ký tự");
            }

            if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
                throw createHttpError(400, "Tên đăng nhập chỉ gồm chữ, số, . _ -");
            }

            if (typeof password !== "string" || password.length < 10 || password.length > 128) {
                throw createHttpError(400, "Mật khẩu phải từ 10 đến 128 ký tự");
            }

            if (!/[A-Za-zÀ-ỹ]/u.test(password) || !/\d/.test(password)) {
                throw createHttpError(400, "Mật khẩu phải có ít nhất một chữ và một số");
            }

            if (confirmPassword != null && password !== confirmPassword) {
                throw createHttpError(400, "Mật khẩu xác nhận không khớp");
            }

            if (!ALLOWED_ROLES.has(role)) {
                throw createHttpError(400, "Vai trò không hợp lệ (admin|staff)");
            }

            const existingUser = await repository.findByUsername(username);
            if (existingUser) {
                throw createHttpError(409, "Tên đăng nhập đã tồn tại");
            }

            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const newUser = await repository.createUser(username, hashedPassword, role, 1);

            const response = {
                message: "Đã tạo tài khoản",
                user: publicUser(newUser)
            };

            if (optionsCreate.allowToken) {
                response.token = generateToken(newUser);
                response.message = "Đăng ký thành công";
            }

            return response;
        },

        async setUserActive(id, isActive, actor = null) {
            const user = await repository.findById(Number(id));
            if (!user) {
                throw createHttpError(404, "Không tìm thấy người dùng");
            }
            if (actor && Number(actor.id) === Number(id) && !isActive) {
                throw createHttpError(400, "Không thể tự vô hiệu hóa chính mình");
            }
            await repository.setActive(Number(id), Boolean(isActive));
            return {
                message: isActive ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản",
                id: Number(id),
                is_active: Boolean(isActive)
            };
        }
    };
}

module.exports = {
    createAuthService
};
