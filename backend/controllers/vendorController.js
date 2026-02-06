const db = require("../config/db");

exports.getAllVendors = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM vendors ORDER BY id DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM vendors WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching vendor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const {
      name,
      vendorCode,
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

    if (!name || !vendorCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO vendors 
       (name, vendor_code, email, phone, address, city, state, country, category, 
        opening_balance, balance, notes, image, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING *`,
      [
        name,
        vendorCode,
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
    console.error("Error creating vendor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      vendorCode,
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
      `UPDATE vendors 
       SET name = $1, vendor_code = $2, email = $3, phone = $4, address = $5, 
           city = $6, state = $7, country = $8, category = $9, opening_balance = $10, 
           notes = $11, image = $12, updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        name,
        vendorCode,
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
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM vendors WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.status(200).json({ message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.bulkDeleteVendors = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const result = await db.query(`DELETE FROM vendors WHERE id IN (${placeholders})`, ids);

    res.status(200).json({ message: `${result.rowCount} vendors deleted` });
  } catch (error) {
    console.error("Error bulk deleting vendors:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.importVendors = async (req, res) => {
  try {
    const vendors = req.body;

    if (!Array.isArray(vendors) || vendors.length === 0) {
      return res.status(400).json({ error: "Invalid vendors array" });
    }

    const insertedVendors = [];

    for (const vendor of vendors) {
      const result = await db.query(
        `INSERT INTO vendors 
         (name, vendor_code, email, phone, address, city, state, country, category, 
          opening_balance, balance, notes, image, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING *`,
        [
          vendor.name,
          vendor.vendorCode,
          vendor.email || "",
          vendor.phone || "",
          vendor.address || "",
          vendor.city || "",
          vendor.state || "",
          vendor.country || "Pakistan",
          vendor.category || "",
          vendor.openingBalance || "Rs. 0.00",
          vendor.balance || vendor.openingBalance || "Rs. 0.00",
          vendor.notes || "",
          vendor.image || "",
        ]
      );
      insertedVendors.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${insertedVendors.length} vendors imported successfully`,
      data: insertedVendors,
    });
  } catch (error) {
    console.error("Error importing vendors:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
