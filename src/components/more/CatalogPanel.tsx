import React, { useState } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/** Catálogo de serviços (preços padrão usados na abertura da OS). */
export const CatalogPanel: React.FC = () => {
  const { catalog, saveCatalogItem, removeCatalogItem, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const laborPrice = parseFloat(price.replace(',', '.'));
    if (!title.trim() || !(laborPrice >= 0)) {
      showToast({ title: 'Informe o serviço e o preço', type: 'warning' });
      return;
    }
    setBusy(true);
    const ok = await saveCatalogItem({
      title: title.trim(),
      laborPrice,
      estimatedDays: days ? parseInt(days, 10) : undefined,
    });
    setBusy(false);
    if (ok) {
      setTitle('');
      setPrice('');
      setDays('');
    }
  };

  const field = 'px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white';

  return (
    <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 space-y-3">
      <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
        <ListChecks className="w-4 h-4 text-amber-400" /> Catálogo de serviços
      </h3>
      <form onSubmit={add} className="flex flex-wrap gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Regulagem completa" className={`${field} flex-1 min-w-[10rem]`} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" inputMode="decimal" placeholder="R$" className={`${field} w-20`} />
        <input value={days} onChange={(e) => setDays(e.target.value)} type="number" placeholder="Dias" className={`${field} w-16`} />
        <button type="submit" disabled={busy} className="px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white" aria-label="Adicionar ao catálogo">
          <Plus className="w-4 h-4" />
        </button>
      </form>
      {catalog.length === 0 && <p className="text-xs text-stone-500">Cadastre os serviços que a oficina mais faz para agilizar a abertura de OS.</p>}
      <div className="space-y-1.5">
        {catalog.map((c) => (
          <div key={c.id} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
            <div className="min-w-0">
              <p className="text-stone-200 truncate">{c.title}</p>
              {c.estimatedDays ? <p className="text-[10px] text-stone-500">{c.estimatedDays} dias</p> : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-amber-400">R$ {c.laborPrice.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => window.confirm(`Remover "${c.title}" do catálogo?`) && removeCatalogItem(c.id)}
                className="p-1 text-stone-500 hover:text-rose-400"
                aria-label="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
