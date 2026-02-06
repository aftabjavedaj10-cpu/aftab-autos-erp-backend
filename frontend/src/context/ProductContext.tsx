import React, { createContext, useContext, useState } from "react";

export interface Product {
  productCode: string;
  productName: string;
  unit: string;
  category: string;
  brand: string;
  barcode: string;
  vendor: string;
  salePrice: string;
  purchasePrice: string;
  warehouse: string;
  initialStock: string;
  reorderLevel: string;
}

interface ProductContextType {
  products: Product[];
  addProduct: (product: Product) => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [products, setProducts] = useState<Product[]>([]);

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
  };

  return (
    <ProductContext.Provider value={{ products, addProduct }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within ProductProvider");
  }
  return context;
};
