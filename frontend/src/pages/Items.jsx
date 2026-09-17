import React, { useState, useEffect } from 'react';
import { itemAPI, cacheKeys, invalidateReferenceCache } from '../utils/firestoreAPI';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { CACHE_TTL } from '../utils/core/cache';
import { useAuth } from '../context/AuthContext';
import { showToast, showConfirmation } from '../services/notificationService';
import ResponsiveFormModal from '../components/ui/ResponsiveFormModal';
import UnitSelect from '../components/ui/UnitSelect';

function Items() {
  const { user } = useAuth();
  // Reference data shared with NewBill/Bills via the per-user cache.
  const { refresh: refreshItems } = useCachedQuery(
    user?.uid, cacheKeys.activeItems, CACHE_TTL.activeItems,
    () => itemAPI.getActive(user.uid)
  );
  // Full list (incl. inactive) for the management table below.
  const [allItems, setAllItems] = useState([]); // eslint-disable-line no-unused-vars
  const { data: categories, refresh: refreshCategories } = useCachedQuery(
    user?.uid, cacheKeys.categories, CACHE_TTL.categories,
    () => itemAPI.getCategories(user.uid)
  );
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', categoryId: '', price: '', tax: 0, isActive: true, itemType: 'SERVICE', trackInventory: false, stockQuantity: 0, unit: 'pcs', lowStockThreshold: 0, sku: '', purchasePrice: 0 });
  const [itemSaving, setItemSaving] = useState(false);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  const loadData = async () => {
    const itemsData = await itemAPI.getAll(user.uid);
    setAllItems(itemsData);
    refreshItems();
    refreshCategories();
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', categoryId: categories[0]?.id || '', price: '', tax: 0, isActive: true, itemType: 'SERVICE', trackInventory: false, stockQuantity: 0, unit: 'pcs', lowStockThreshold: 0, sku: '', purchasePrice: 0 });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({ name: item.name, categoryId: item.categoryId, price: item.price, tax: item.tax, isActive: item.isActive, itemType: item.itemType, trackInventory: item.trackInventory, stockQuantity: item.stockQuantity, unit: item.unit, lowStockThreshold: item.lowStockThreshold, sku: item.sku, purchasePrice: item.purchasePrice });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (itemSaving) return;
    setItemSaving(true);
    try {
      if (editingItem) await itemAPI.update(user.uid, editingItem.id, formData);
      else await itemAPI.create(user.uid, formData);
      invalidateReferenceCache(user.uid);
      setShowModal(false);
      loadData();
      showToast({ type: 'success', message: editingItem ? 'Item updated successfully.' : 'Item added successfully.' });
    } catch { showToast({ type: 'error', message: 'Unable to save the item. Please try again.' }); }
    finally { setItemSaving(false); }
  };

  const toggleStatus = async (item) => { await itemAPI.toggleStatus(user.uid, item.id, item.isActive); invalidateReferenceCache(user.uid); loadData(); };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await itemAPI.createCategory(user.uid, newCategory.trim());
    invalidateReferenceCache(user.uid);
    setShowCategoryModal(false);
    setNewCategory('');
    loadData();
  };

  const deleteCategory = async (id) => {
    await showConfirmation({
      title: 'Delete this category?',
      message: 'This category will be permanently removed.',
      confirmText: 'Delete Category',
      destructive: true,
      onConfirm: async () => {
        try {
          await itemAPI.deleteCategory(user.uid, id);
          invalidateReferenceCache(user.uid);
          loadData();
          showToast({ type: 'success', message: 'Category deleted successfully.' });
        } catch {
          showToast({ type: 'error', message: 'Unable to delete the category. Please try again.' });
        }
      },
    });
  };

  const deleteItem = async (id) => {
    await showConfirmation({
      title: 'Delete this item?',
      message: 'This item will be permanently removed from your catalogue.',
      confirmText: 'Delete Item',
      destructive: true,
      onConfirm: async () => {
        try {
          await itemAPI.delete(user.uid, id);
          invalidateReferenceCache(user.uid);
          loadData();
          showToast({ type: 'success', message: 'Item deleted successfully.' });
        } catch {
          showToast({ type: 'error', message: 'Unable to delete the item. Please try again.' });
        }
      },
    });
  };

  const filteredItems = allItems.filter(item =>
    (!selectedCategory || item.categoryId === selectedCategory) &&
    (!searchQuery || item.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1>Items</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowCategoryModal(true)}>
            <i className="fas fa-folder-plus"></i> Add Category
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <i className="fas fa-plus"></i> Add Item
          </button>
        </div>
      </div>

      <div className="card">
        <div className="category-tabs">
          <button className={`category-tab ${!selectedCategory ? 'active' : ''}`} onClick={() => setSelectedCategory(null)}>
            All <span style={{ opacity: 0.7 }}>({allItems.length})</span>
          </button>
          {categories.map(cat => (
            <button key={cat.id} className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}>
              {cat.name} <span style={{ opacity: 0.7 }}>({allItems.filter(i => i.categoryId === cat.id).length})</span>
              <span className="category-tab-del" onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}>×</span>
            </button>
          ))}
        </div>

        <div className="search-box" style={{ marginBottom: 20 }}>
          <input type="text" placeholder="Search services..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state"><i className="fas fa-box"></i><p>No items found</p></div>
        ) : (
          <div className="services-grid">
            {filteredItems.map(item => (
              <div key={item.id} className="service-card">
                <div className="service-card-status">
                  <span className={`badge ${item.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="service-card-name">{item.name}</div>
                <div className="service-card-category">{item.categoryName}</div>
                <div className="service-card-price">₹{item.price}</div>
                <div className="service-card-tax">Tax: {item.tax}%</div>
                {item.trackInventory && <div className="service-card-tax">Stock: {item.stockQuantity} {item.unit}{item.stockQuantity <= item.lowStockThreshold ? ' · Low' : ''}</div>}
                <div className="service-card-actions">
                  <button className="btn btn-ghost" onClick={() => openEditModal(item)} style={{ flex: 1 }}>
                    <i className="fas fa-edit"></i> Edit
                  </button>
                  <button className={`btn ${item.isActive ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => toggleStatus(item)} style={{ padding: '9px 12px' }}>
                    <i className={`fas ${item.isActive ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                  </button>
                  <button className="btn btn-ghost" onClick={() => deleteItem(item.id)}
                    style={{ padding: '9px 12px', color: 'var(--color-danger)' }}>
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <ResponsiveFormModal title={editingItem ? 'Edit Item' : 'Add Item'} labelledBy="item-form-title" onClose={() => setShowModal(false)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={itemSaving}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={itemSaving}><i className={`fas ${itemSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i> {itemSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}</button></>}>
            <div className="form-group">
              <label>Item Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Price *</label>
                <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Tax %</label>
                <input type="number" value={formData.tax} onChange={e => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-group">
              <label>Item Type</label>
              <select value={formData.itemType} onChange={e => setFormData({ ...formData, itemType: e.target.value, trackInventory: e.target.value === 'PRODUCT' ? formData.trackInventory : false })}>
                <option value="SERVICE">Service</option>
                <option value="PRODUCT">Product</option>
              </select>
            </div>
            {formData.itemType === 'PRODUCT' && <>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" checked={formData.trackInventory} onChange={e => setFormData({ ...formData, trackInventory: e.target.checked })} /> Track inventory</label>
              {formData.trackInventory && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Opening Stock</label><input type="number" min="0" step="any" value={formData.stockQuantity} onChange={e => setFormData({ ...formData, stockQuantity: Number(e.target.value) || 0 })} /></div>
                <div className="form-group"><label id="item-unit-label">Unit</label><UnitSelect value={formData.unit} onChange={unit => setFormData({ ...formData, unit })} aria-labelledby="item-unit-label" /></div>
                <div className="form-group"><label>Low Stock Threshold</label><input type="number" min="0" step="any" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) || 0 })} /></div>
                <div className="form-group"><label>SKU</label><input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} /></div>
              </div>}
            </>}
      </ResponsiveFormModal>}

      {showCategoryModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Add Category</h2>
              <button className="close-btn" onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>Category Name *</label>
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                placeholder="e.g., Haircut, T-Shirt, Burger" />
            </div>
            <button className="btn btn-primary" onClick={addCategory}>Add Category</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Items;
