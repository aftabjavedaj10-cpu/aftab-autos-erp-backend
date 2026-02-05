const db = require("../config/db");

// GET all products
exports.getAllProducts = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM products ORDER BY id DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM products WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// CREATE product
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      productCode,
      barcode,
      category,
      vendorId,
      price,
      costPrice,
      stock,
      reorderPoint,
      unit,
      warehouse,
      brandName,
      productType,
      description,
      image,
    } = req.body;

    if (!name || !productCode || !price || !costPrice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.query(
      `INSERT INTO products 
       (name, product_code, barcode, category, vendor_id, price, cost_price, stock, 
        reorder_point, unit, warehouse, brand_name, product_type, description, image, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       RETURNING *`,
      [
        name,
        productCode,
        barcode,
        category,
        vendorId,
        parseFloat(price),
        parseFloat(costPrice),
        parseInt(stock) || 0,
        parseInt(reorderPoint) || 10,
        unit || "pcs",
        warehouse || "Main",
        brandName || "Generic",
        productType || "Product",
        description || "",
        image || "",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// UPDATE product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      productCode,
      barcode,
      category,
      vendorId,
      price,
      costPrice,
      stock,
      reorderPoint,
      unit,
      warehouse,
      brandName,
      productType,
      description,
      image,
    } = req.body;

    const result = await db.query(
      `UPDATE products 
       SET name = $1, product_code = $2, barcode = $3, category = $4, vendor_id = $5, 
           price = $6, cost_price = $7, stock = $8, reorder_point = $9, unit = $10, 
           warehouse = $11, brand_name = $12, product_type = $13, description = $14, image = $15, updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        name,
        productCode,
        barcode,
        category,
        vendorId,
        parseFloat(price),
        parseFloat(costPrice),
        parseInt(stock) || 0,
        parseInt(reorderPoint) || 10,
        unit,
        warehouse,
        brandName,
        productType,
        description,
        image,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// DELETE product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// BULK DELETE products
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const result = await db.query(`DELETE FROM products WHERE id IN (${placeholders})`, ids);

    res.status(200).json({ message: `${result.rowCount} products deleted` });
  } catch (error) {
    console.error("Error bulk deleting products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// IMPORT products
exports.importProducts = async (req, res) => {
  try {
    const products = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid products array" });
    }

    const insertedProducts = [];

    for (const product of products) {
      const result = await db.query(
        `INSERT INTO products 
         (name, product_code, barcode, category, vendor_id, price, cost_price, stock, 
          reorder_point, unit, warehouse, brand_name, product_type, description, image, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         RETURNING *`,
        [
          product.name,
          product.productCode,
          product.barcode || "",
          product.category || "",
          product.vendorId || null,
          parseFloat(product.price) || 0,
          parseFloat(product.costPrice) || 0,
          parseInt(product.stock) || 0,
          parseInt(product.reorderPoint) || 10,
          product.unit || "pcs",
          product.warehouse || "Main",
          product.brandName || "Generic",
          product.productType || "Product",
          product.description || "",
          product.image || "",
        ]
      );
      insertedProducts.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${insertedProducts.length} products imported successfully`,
      data: insertedProducts,
    });
  } catch (error) {
    console.error("Error importing products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
