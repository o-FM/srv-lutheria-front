import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockCategory } from '../../types';

const CATEGORIES: { id: StockCategory; label: string }[] = [
  { id: 'pecas', label: 'Peças' },
  { id: 'cordas', label: 'Cordas' },
  { id: 'madeiras', label: 'Madeiras' },
  { id: 'insumos', label: 'Insumos' },
];

/** Cadastro de item de estoque (POST /products). */
export const NewProductForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { createProduct, openBarcodeScanner, showToast } = useApp();
  const [form, setForm] = useState({
    name: '',
    category: 'pecas' as StockCategory,
    brand: '',
    sku: '',
    barcode: '',
    unit: 'un',
    costPrice: '',
    salePrice: '',
    minQuantity: '1',
    initialQuantity: '0',
    location: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(form.costPrice.replace(',', '.'));
    const sale = parseFloat(form.salePrice.replace(',', '.'));
    if (!form.name.trim() || !form.sku.trim() || !(cost >= 0) || !(sale >= 0)) {
      showToast({ title: 'Preencha nome, SKU e preços', type: 'warning' });
      return;
    }
    setBusy(true);
    const created = await createProduct({
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || undefined,
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || undefined,
      unit: form.unit.trim() || 'un',
      costPrice: cost,
      salePrice: sale,
      minQuantity: parseInt(form.minQuantity, 10) || 0,
      initialQuantity: parseInt(form.initialQuantity, 10) || 0,
      location: form.location.trim() || undefined,
    });
    setBusy(false);
    if (created) onDone();
  };

  const field = 'w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white';
  const label = 'text-[10px] uppercase font-bold text-stone-400 block mb-1';

  return (
    <form onSubmit={submit} className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className={label}>Nome *</label>
        <input value={form.name} onChange={set('name')} placeholder="Ex: Encordoamento 0.10" className={field} />
      </div>
      <div>
        <label className={label}>Categoria</label>
        <select value={form.category} onChange={set('category')} className={field}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Marca</label>
        <input value={form.brand} onChange={set('brand')} className={field} />
      </div>
      <div>
        <label className={label}>SKU *</label>
        <input value={form.sku} onChange={set('sku')} placeholder="EXL110" className={field} />
      </div>
      <div>
        <label className={label}>Código de barras</label>
        <div className="flex gap-1">
          <input value={form.barcode} onChange={set('barcode')} className={field} />
          <button
            type="button"
            onClick={() => openBarcodeScanner((code) => setForm((f) => ({ ...f, barcode: code })))}
            className="px-2 rounded-xl bg-stone-800 text-amber-400 text-[10px] font-bold"
          >
            Ler
          </button>
        </div>
      </div>
      <div>
        <label className={label}>Custo (R$) *</label>
        <input type="number" inputMode="decimal" value={form.costPrice} onChange={set('costPrice')} className={field} />
      </div>
      <div>
        <label className={label}>Venda (R$) *</label>
        <input type="number" inputMode="decimal" value={form.salePrice} onChange={set('salePrice')} className={field} />
      </div>
      <div>
        <label className={label}>Unidade</label>
        <input value={form.unit} onChange={set('unit')} placeholder="un, jogo, m, ml" className={field} />
      </div>
      <div>
        <label className={label}>Local</label>
        <input value={form.location} onChange={set('location')} placeholder="Gaveta A2" className={field} />
      </div>
      <div>
        <label className={label}>Qtd. inicial</label>
        <input type="number" min={0} value={form.initialQuantity} onChange={set('initialQuantity')} className={field} />
      </div>
      <div>
        <label className={label}>Estoque mínimo</label>
        <input type="number" min={0} value={form.minQuantity} onChange={set('minQuantity')} className={field} />
      </div>
      <button type="submit" disabled={busy} className="col-span-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">
        {busy ? 'Salvando...' : 'Salvar item'}
      </button>
    </form>
  );
};
