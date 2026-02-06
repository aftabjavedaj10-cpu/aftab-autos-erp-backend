const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// GET all products
router.get("/", productController.getAllProducts);

// GET product by ID
router.get("/:id", productController.getProductById);

// CREATE product
router.post("/", productController.createProduct);

// UPDATE product
router.put("/:id", productController.updateProduct);

// DELETE product
router.delete("/:id", productController.deleteProduct);

// BULK DELETE products
router.post("/bulk-delete", productController.bulkDeleteProducts);

// IMPORT products
router.post("/import", productController.importProducts);

module.exports = router;
