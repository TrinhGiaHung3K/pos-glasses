function createPrescriptionsRepository(db) {
    return {
        async listByCustomer(customerId) {
            const [rows] = await db.execute(
                `SELECT * FROM customer_prescriptions
                WHERE customer_id = ?
                ORDER BY is_active DESC, measured_at DESC, id DESC`,
                [customerId]
            );
            return rows;
        },

        async findById(id) {
            const [rows] = await db.execute(
                `SELECT * FROM customer_prescriptions WHERE id = ? LIMIT 1`,
                [id]
            );
            return rows[0] || null;
        },

        async findActiveByCustomer(customerId) {
            const [rows] = await db.execute(
                `SELECT * FROM customer_prescriptions
                WHERE customer_id = ? AND is_active = 1
                ORDER BY measured_at DESC, id DESC
                LIMIT 1`,
                [customerId]
            );
            return rows[0] || null;
        },

        async create(row) {
            const [result] = await db.execute(
                `INSERT INTO customer_prescriptions
                (customer_id, measured_at, doctor_name, clinic_name,
                 od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis,
                 pd, add_power, notes, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.customer_id,
                    row.measured_at,
                    row.doctor_name,
                    row.clinic_name,
                    row.od_sph,
                    row.od_cyl,
                    row.od_axis,
                    row.os_sph,
                    row.os_cyl,
                    row.os_axis,
                    row.pd,
                    row.add_power,
                    row.notes,
                    row.is_active ? 1 : 0,
                    row.created_by
                ]
            );
            return this.findById(result.insertId);
        },

        async update(id, row) {
            await db.execute(
                `UPDATE customer_prescriptions SET
                    measured_at = ?, doctor_name = ?, clinic_name = ?,
                    od_sph = ?, od_cyl = ?, od_axis = ?,
                    os_sph = ?, os_cyl = ?, os_axis = ?,
                    pd = ?, add_power = ?, notes = ?, is_active = ?
                WHERE id = ?`,
                [
                    row.measured_at,
                    row.doctor_name,
                    row.clinic_name,
                    row.od_sph,
                    row.od_cyl,
                    row.od_axis,
                    row.os_sph,
                    row.os_cyl,
                    row.os_axis,
                    row.pd,
                    row.add_power,
                    row.notes,
                    row.is_active ? 1 : 0,
                    id
                ]
            );
            return this.findById(id);
        },

        async deactivateOthers(customerId, exceptId) {
            await db.execute(
                `UPDATE customer_prescriptions
                SET is_active = 0
                WHERE customer_id = ? AND id <> ?`,
                [customerId, exceptId]
            );
        },

        async remove(id) {
            await db.execute(`DELETE FROM customer_prescriptions WHERE id = ?`, [id]);
        }
    };
}

module.exports = {
    createPrescriptionsRepository
};
