import React from 'react';
import type { ProductRecord, ProductCategory } from '../../types';
import { ProductForm } from '../ProductForm/ProductForm';

interface EditProductModalProps {
  product: ProductRecord | null;
  categories: ProductCategory[];
  onSave: (product: Omit<ProductRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  categories,
  onSave,
  onClose,
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-3xl animate-in zoom-in-95">
        <ProductForm
          initialProduct={product}
          categories={categories}
          onSave={async (updatedProduct) => {
            await onSave(updatedProduct);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
