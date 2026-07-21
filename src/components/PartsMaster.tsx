import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Filter, 
  X, 
  Download, 
  Upload,
  Package, 
  Check, 
  MapPin, 
  Info,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part } from '../types';

interface PartsMasterProps {
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  showAddFormGlobally: boolean;
  setShowAddFormGlobally: (show: boolean) => void;
}

export const PartsMaster: React.FC<PartsMasterProps> = ({ 
  selectedPartId, 
  setSelectedPartId,
  showAddFormGlobally,
  setShowAddFormGlobally
}) => {
  const { parts, addPart, updatePart, deletePart, settings } = useERP();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [modelFilter, setModelFilter] = useState('All');

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  // Form Fields
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [modelCompatibility, setModelCompatibility] = useState('');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(5);

  const [formError, setFormError] = useState('');

  // Handle global trigger to open form
  React.useEffect(() => {
    if (showAddFormGlobally) {
      openAddModal();
      setShowAddFormGlobally(false);
    }
  }, [showAddFormGlobally]);

  // Derive unique categories/brands/models for filters
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(parts.map(p => p.category))).filter(Boolean)];
  }, [parts]);

  const brands = useMemo(() => {
    return ['All', ...Array.from(new Set(parts.map(p => p.brand))).filter(Boolean)];
  }, [parts]);

  const models = useMemo(() => {
    return ['All', ...Array.from(new Set(parts.map(p => p.modelCompatibility))).filter(Boolean)];
  }, [parts]);

  // Filters logic
  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.partNumber.toLowerCase().includes(search.toLowerCase()) || 
        p.brand.toLowerCase().includes(search.toLowerCase()) || 
        p.modelCompatibility.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      const matchesBrand = brandFilter === 'All' || p.brand === brandFilter;
      const matchesModel = modelFilter === 'All' || p.modelCompatibility === modelFilter;

      return matchesSearch && matchesCategory && matchesBrand && matchesModel;
    });
  }, [parts, search, categoryFilter, brandFilter, modelFilter]);

  // Selected Part for details panel
  const activeDetailPart = useMemo(() => {
    return parts.find(p => p.id === selectedPartId) || null;
  }, [parts, selectedPartId]);

  const openAddModal = () => {
    setEditingPart(null);
    setPartNumber('');
    setName('');
    setBrand('');
    setCategory('Engine Parts');
    setModelCompatibility('');
    setLocation('');
    setPurchasePrice(0);
    setRetailPrice(0);
    setStock(0);
    setMinStock(5);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (part: Part) => {
    setEditingPart(part);
    setPartNumber(part.partNumber);
    setName(part.name);
    setBrand(part.brand);
    setCategory(part.category);
    setModelCompatibility(part.modelCompatibility);
    setLocation(part.location);
    setPurchasePrice(part.purchasePrice);
    setRetailPrice(part.retailPrice);
    setStock(part.stock);
    setMinStock(part.minStock);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!partNumber.trim() || !name.trim() || !brand.trim() || purchasePrice <= 0 || retailPrice <= 0) {
      setFormError('Please fill out all required fields correctly. Prices must be greater than zero.');
      return;
    }

    if (retailPrice < purchasePrice) {
      setFormError('Retail selling price cannot be less than the wholesale purchase price!');
      return;
    }

    try {
      if (editingPart) {
        // Edit Part
        await updatePart(editingPart.id, {
          partNumber,
          name,
          brand,
          category,
          modelCompatibility,
          location,
          purchasePrice,
          retailPrice,
          stock,
          minStock
        });
      } else {
        // Add Part
        await addPart({
          partNumber,
          name,
          brand,
          category,
          modelCompatibility,
          location,
          purchasePrice,
          retailPrice,
          stock,
          minStock
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed. Verify inputs.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you absolutely sure you want to delete this spare part from the database? This cannot be undone.')) {
      try {
        await deletePart(id);
        if (selectedPartId === id) setSelectedPartId(null);
      } catch (err) {
        alert('Failed to delete item.');
      }
    }
  };

  // Simulated export to Excel/CSV
  const exportToCSV = () => {
    const headers = 'Part Number,Name,Brand,Category,Model Compatibility,Rack Location,Purchase Price,Retail Price,Stock,Min Stock\n';
    const rows = parts.map(p => 
      `"${p.partNumber}","${p.name}","${p.brand}","${p.category}","${p.modelCompatibility}","${p.location || ''}",${p.purchasePrice},${p.retailPrice},${p.stock},${p.minStock}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Motorcycle_Parts_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-base font-bold text-slate-800">Parts Registry (Catalog)</h1>
          <p className="text-[11px] text-slate-400 font-mono">Central directory of spare parts, location rails, and retail pricing.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add New Part</span>
          </button>
        </div>
      </div>

      {/* 2. Main Layout with Side Drawer details if selected */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Parts Table Area */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Quick Filters Panel */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalog by name, part number, compatibility..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden bg-white focus:border-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span className="text-[10px] text-slate-400 uppercase">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-slate-200 rounded-lg py-1 px-2.5 bg-white font-medium focus:outline-hidden focus:border-blue-500"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {/* Brand Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span className="text-[10px] text-slate-400 uppercase">Brand:</span>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="border border-slate-200 rounded-lg py-1 px-2.5 bg-white font-medium focus:outline-hidden focus:border-blue-500"
              >
                {brands.map(br => <option key={br} value={br}>{br}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Code / Part No.</th>
                  <th className="py-3 px-4">Part Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Compatibility</th>
                  <th className="py-3 px-4 text-right">Wholesale (Cost)</th>
                  <th className="py-3 px-4 text-right">Retail (Sell)</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No matching parts found in the catalog.
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((p) => {
                    const isSelected = p.id === selectedPartId;
                    const isLowStock = p.stock <= p.minStock;
                    return (
                      <tr 
                        key={p.id}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/30' : ''
                        }`}
                        onClick={() => setSelectedPartId(p.id)}
                      >
                        <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-900">{p.partNumber}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{p.category}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-600">{p.brand}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">{p.modelCompatibility || 'Universal'}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium">Rs. {p.purchasePrice.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">Rs. {p.retailPrice.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isLowStock 
                              ? 'bg-red-50 text-red-600 border border-red-100' 
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {p.stock} units
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit Part"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Part"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Part Details Info Drawer Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Part Details Profile</h3>
            {selectedPartId && (
              <button 
                onClick={() => setSelectedPartId(null)}
                className="text-slate-400 hover:text-slate-600 text-[10px]"
              >
                Clear
              </button>
            )}
          </div>

          {!activeDetailPart ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Package className="h-10 w-10 text-slate-300 stroke-1" />
              <p className="text-xs">Click any part in the registry table to view detailed ledger information, warehouse location, and margin stats.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-[9px] bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded uppercase">{activeDetailPart.category}</span>
                <h4 className="text-sm font-black text-slate-800 mt-1.5">{activeDetailPart.name}</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{activeDetailPart.brand} · Part No: {activeDetailPart.partNumber}</p>
              </div>

              {/* Warehouse Details Card */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-100/50 space-y-2">
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Rack Location:</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    {activeDetailPart.location || 'Rack Location not set'}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Compatibility:</span>
                  <span className="font-bold text-slate-700 font-mono">{activeDetailPart.modelCompatibility || 'CD70 / Universal'}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Registered Date:</span>
                  <span className="font-medium text-slate-600 font-mono">{new Date(activeDetailPart.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Business Margin Analysis */}
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                <h5 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-2">Margin Analytics</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px]">Unit Cost:</span>
                    <p className="font-mono font-bold text-slate-800">Rs. {activeDetailPart.purchasePrice}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px]">Selling Price:</span>
                    <p className="font-mono font-bold text-slate-800">Rs. {activeDetailPart.retailPrice}</p>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-emerald-100 flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-semibold">Markup Profit:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded">
                    Rs. {activeDetailPart.retailPrice - activeDetailPart.purchasePrice} ({Math.round(((activeDetailPart.retailPrice - activeDetailPart.purchasePrice) / activeDetailPart.purchasePrice) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Stock Status alerts */}
              {activeDetailPart.stock <= activeDetailPart.minStock && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 flex gap-2 items-start text-[11px] leading-relaxed">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="font-bold">Low stock warning!</p>
                    <p>Quantity ({activeDetailPart.stock}) is below threshold ({activeDetailPart.minStock}). Please place a new supplier purchase order.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. ADD / EDIT DIALOG MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold">{editingPart ? 'Modify Spare Part' : 'Add New Spare Part to Registry'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block">Part Name / Description *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., CD70 Cylinder Head Block Set"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Code / Part Number *</label>
                  <input
                    type="text"
                    required
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="e.g., H70-CYL-CROWN"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Manufacturer / Brand *</label>
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Crown Lifan, Honda Genuine"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="Engine Parts">Engine Parts</option>
                    <option value="Clutch & Transmission">Clutch & Transmission</option>
                    <option value="Chains & Gears">Chains & Gears</option>
                    <option value="Lubricants & Oils">Lubricants & Oils</option>
                    <option value="Electrical & Ignition">Electrical & Ignition</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Cables & Controls">Cables & Controls</option>
                    <option value="Filters">Filters</option>
                    <option value="Body Parts">Body Parts</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Rack Location / Pin</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Rack A-3"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block">Model Compatibility *</label>
                  <input
                    type="text"
                    required
                    value={modelCompatibility}
                    onChange={(e) => setModelCompatibility(e.target.value)}
                    placeholder="e.g., CD70, CG125, Universal"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Wholesale Cost (Rs.) *</label>
                  <input
                    type="number"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Retail Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Initial Stock Qty *</label>
                  <input
                    type="number"
                    required
                    disabled={!!editingPart} // Stock adjustments can be made via stock ledger to keep perfect audit trail!
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 disabled:bg-slate-50 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 block">Min Stock Alert *</label>
                  <input
                    type="number"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  {editingPart ? 'Save Changes' : 'Register Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
