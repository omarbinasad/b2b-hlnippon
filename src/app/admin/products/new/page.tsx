import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/product-form";
import { loadProductFormOptions } from "../form-options";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  return <ProductForm options={await loadProductFormOptions()} />;
}
