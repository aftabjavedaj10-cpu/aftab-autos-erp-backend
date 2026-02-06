const db = require("../config/db");

exports.getAllCustomers = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM customers ORDER BY id DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const {
      name,
      customerCode,
      email,
      phone,
      address,
      city,
      state,
      country,
      category,
      openingBalance,
      notes,
      image,
    } = req.body;

    if (!name || !customerCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO customers 
       (name, customer_code, email, phone, address, city, state, country, category, 
        opening_balance, balance, notes, image, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING *`,
      [
        name,
        customerCode,
        email || "",
        phone || "",
        address || "",
        city || "",
        state || "",
        country || "Pakistan",
        category || "",
        openingBalance || "Rs. 0.00",
        openingBalance || "Rs. 0.00",
        notes || "",
        image || "",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      customerCode,
      email,
      phone,
      address,
      city,
      state,
      country,
      category,
      openingBalance,
      notes,
      image,
    } = req.body;

    const result = await db.query(
      `UPDATE customers 
       SET name = $1, customer_code = $2, email = $3, phone = $4, address = $5, 
           city = $6, state = $7, country = $8, category = $9, opening_balance = $10, 
           notes = $11, image = $12, updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        name,
        customerCode,
        email,
        phone,
        address,
        city,
        state,
        country,
        category,
        openingBalance,
        notes,
        image,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM customers WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.bulkDeleteCustomers = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const result = await db.query(`DELETE FROM customers WHERE id IN (${placeholders})`, ids);

    res.status(200).json({ message: `${result.rowCount} customers deleted` });
  } catch (error) {
    console.error("Error bulk deleting customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.importCustomers = async (req, res) => {
  try {
    const customers = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: "Invalid customers array" });
    }

    const insertedCustomers = [];

    for (const customer of customers) {
      const result = await db.query(
        `INSERT INTO customers 
         (name, customer_code, email, phone, address, city, state, country, category, 
          opening_balance, balance, notes, image, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING *`,
        [
          customer.name,
          customer.customerCode,
          customer.email || "",
          customer.phone || "",
          customer.address || "",
          customer.city || "",
          customer.state || "",
          customer.country || "Pakistan",
          customer.category || "",
          customer.openingBalance || "Rs. 0.00",
          customer.balance || customer.openingBalance || "Rs. 0.00",
          customer.notes || "",
          customer.image || "",
        ]
      );
      insertedCustomers.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${insertedCustomers.length} customers imported successfully`,
      data: insertedCustomers,
    });
  } catch (error) {
    console.error("Error importing customers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
