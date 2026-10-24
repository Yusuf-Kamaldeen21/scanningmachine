import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ProductRecord } from '../../types';

interface DeleteProductModalProps {
  product: ProductRecord | null;
  onConfirm: (product: ProductRecord) => Promise<void>;
  onCancel: () => void;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  product,
  onConfirm,
  onCancel,
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <div className="flex items-center space-x-3 text-rose-600 mb-3">
          <div className="p-2.5 bg-rose-500/10 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Record?
            </h4>
            <span className="text-xs text-slate-400">Confirmation Required</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Are you sure you want to delete{' '}
          <strong className="text-slate-900 dark:text-slate-100 font-semibold">
            {product.brand} - {product.productName} ({product.sizeQuantity})
          </strong>{' '}
          from the local database?
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(product)}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20"
          >
            Yes, Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
