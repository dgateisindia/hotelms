const db = require("../config/db");

// Get all payrolls
exports.getPayrolls = (req, res) => {
    const sql = "SELECT * FROM payroll ORDER BY pay_date DESC";

    db.query(sql, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json(err);
        }

        res.json(results);
    });
};

// Add Payroll
exports.addPayroll = (req, res) => {

    const {
        employee_id,
        employee_name,
        department,
        basic_salary,
        allowances,
        deductions,
        net_pay,
        pay_date,
        status
    } = req.body;

    const sql = `
    INSERT INTO payroll
    (employee_id,employee_name,department,basic_salary,
    allowances,deductions,net_pay,pay_date,status)
    VALUES(?,?,?,?,?,?,?,?,?)
    `;

    db.query(
        sql,
        [
            employee_id,
            employee_name,
            department,
            basic_salary,
            allowances,
            deductions,
            net_pay,
            pay_date,
            status
        ],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json(err);
            }

            res.status(201).json({
                message: "Payroll added successfully"
            });
        }
    );
};

// Update Payroll
exports.updatePayroll = (req, res) => {

    const id = req.params.id;

    const {
        employee_id,
        employee_name,
        department,
        basic_salary,
        allowances,
        deductions,
        net_pay,
        pay_date,
        status
    } = req.body;

    const sql = `
    UPDATE payroll SET
    employee_id=?,
    employee_name=?,
    department=?,
    basic_salary=?,
    allowances=?,
    deductions=?,
    net_pay=?,
    pay_date=?,
    status=?
    WHERE payroll_id=?
    `;

    db.query(
        sql,
        [
            employee_id,
            employee_name,
            department,
            basic_salary,
            allowances,
            deductions,
            net_pay,
            pay_date,
            status,
            id
        ],
        (err) => {
            if (err)
                return res.status(500).json(err);

            res.json({
                message: "Payroll updated"
            });
        }
    );
};

// Delete Payroll
exports.deletePayroll = (req, res) => {

    db.query(
        "DELETE FROM payroll WHERE payroll_id=?",
        [req.params.id],
        (err) => {
            if (err)
                return res.status(500).json(err);

            res.json({
                message: "Payroll deleted"
            });
        }
    );
};