import React from "react";
import AddProducts from "./AddProducts";
import type { Category, Product, Vendor } from "../types";

interface POSProductFormPageProps {
  product?: Product;
  categories: Category[];
  vendors: Vendor[];
  onBack: () => void;
  onSave: (product: any, stayOnPage: boolean) => void;
  onAddCategory: (category: Category) => void;
}

const POSProductFormPage: React.FC<POSProductFormPageProps> = ({
  product,
  categories,
  vendors,
  onBack,
  onSave,
  onAddCategory,
}) => {
  return (
    <AddProducts
      product={product}
      categories={categories}
      vendors={vendors}
      onBack={onBack}
      onSave={onSave}
      onAddCategory={onAddCategory}
    />
  );
};

export default POSProductFormPage;

