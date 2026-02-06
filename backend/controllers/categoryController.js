const db = require("../config/db");

exports.getAllCategories = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM categories ORDER BY id DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM categories WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, type, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO categories (name, type, description, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [name, type, description || ""]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;

    const result = await db.query(
      `UPDATE categories 
       SET name = $1, type = $2, description = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, type, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.bulkDeleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const result = await db.query(`DELETE FROM categories WHERE id IN (${placeholders})`, ids);

    res.status(200).json({ message: `${result.rowCount} categories deleted` });
  } catch (error) {
    console.error("Error bulk deleting categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
