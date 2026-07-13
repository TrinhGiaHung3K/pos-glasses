function createCategoriesRepository(db) {
    return {
        async findAll() {
            const [rows] = await db.execute(
                "SELECT id, name FROM categories ORDER BY name ASC"
            );
            return rows;
        },

        async findById(id) {
            const [rows] = await db.execute(
                "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
                [id]
            );
            return rows[0] || null;
        },

        async create(name) {
            const [result] = await db.execute(
                "INSERT INTO categories (name) VALUES (?)",
                [name]
            );
            return result;
        },

        async update(id, name) {
            const [result] = await db.execute(
                "UPDATE categories SET name = ? WHERE id = ?",
                [name, id]
            );
            return result;
        },

        async remove(id) {
            const [result] = await db.execute(
                "DELETE FROM categories WHERE id = ?",
                [id]
            );
            return result;
        }
    };
}

module.exports = {
    createCategoriesRepository
};
