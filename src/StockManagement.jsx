
import { useState, useEffect } from 'react'
import './App.css'
import { getData, addData, updateData, deleteData } from './api'

function StockManagement() {
  const [stock, setStock] = useState([])
  const [fruits, setFruits] = useState([])
  const [boxSizes, setBoxSizes] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [fruitId, setFruitId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [boxSizeId, setBoxSizeId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingStock, setViewingStock] = useState(null)
  const [showStockModal, setShowStockModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [fruitData, boxData, supplierData, stockData] =
        await Promise.all([
          getData('fruits'),
          getData('box-sizes'),
          getData('suppliers'),
          getData('stock'),
        ])

      const activeFruits = fruitData.filter(
        (fruit) => fruit.status === 'Active'
      )

      const activeBoxSizes = boxData.filter(
        (size) => !size.status || size.status === 'Active'
      )

      setFruits(activeFruits)
      setBoxSizes(activeBoxSizes)
      setSuppliers(supplierData)

      setStock(
        stockData.map((item) => ({
          id: item.stock_id,
          fruitId: item.fruit_id,
          boxSizeId: item.box_size_id,
          supplierId: item.supplier_id,
          fruitName:
            fruitData.find(
              (fruit) =>
                Number(fruit.fruit_id) === Number(item.fruit_id)
            )?.fruit_name || 'Unknown fruit',
          quantity: item.quantity,
          boxSize:
            boxData.find(
              (size) =>
                Number(size.box_size_id) === Number(item.box_size_id)
            )?.size_name || 'Unknown size',
          capacityKg:
            boxData.find(
              (size) =>
                Number(size.box_size_id) === Number(item.box_size_id)
            )?.capacity_kg || '',
          supplierName:
            supplierData.find(
              (supplier) =>
                Number(supplier.supplier_id) === Number(item.supplier_id)
            )?.supplier_name || 'Not recorded',
          unitCost: Number(item.unit_cost || 0),
        }))
      )

      setError('')
    } catch (error) {
      setError('Could not load stock. Please check the connection later.')
    }
  }

  function resetForm() {
    setFruitId('')
    setQuantity('')
    setBoxSizeId('')
    setSupplierId('')
    setUnitCost('')
    setEditingId(null)
    setMessage('')
    setError('')
    setShowStockModal(false)
  }

  function openAddModal() {
    resetForm()
    setShowStockModal(true)
  }

  function handleEdit(item) {
    setEditingId(item.id)
    setFruitId(String(item.fruitId))
    setQuantity(String(item.quantity))
    setBoxSizeId(String(item.boxSizeId))
    setSupplierId(String(item.supplierId))
    setUnitCost(String(item.unitCost))
    setMessage('')
    setError('')
    setShowStockModal(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setMessage('')
    setError('')

    if (!fruitId || !boxSizeId || !supplierId) {
      setError('Please select a fruit, box size and supplier.')
      return
    }

    const quantityNumber = Number(quantity)
    const unitCostNumber = Number(unitCost)

    if (!Number.isInteger(quantityNumber) || quantityNumber < 1) {
      setError('Quantity must be a whole number greater than zero.')
      return
    }

    if (
      !unitCost.trim() ||
      !Number.isFinite(unitCostNumber) ||
      unitCostNumber < 0
    ) {
      setError('Enter a valid unit cost of zero or more.')
      return
    }

    const stockData = {
      fruit_id: Number(fruitId),
      box_size_id: Number(boxSizeId),
      supplier_id: Number(supplierId),
      quantity: quantityNumber,
      unit_cost: unitCostNumber,
    }

    setLoading(true)

    try {
      if (editingId !== null) {
        await updateData('stock', editingId, stockData)
        setMessage('Stock record updated successfully.')
      } else {
        await addData('stock', stockData)
        setMessage('Stock added successfully.')
      }

      resetForm()
      await loadData()
      setMessage(
        editingId !== null
          ? 'Stock record updated successfully.'
          : 'Stock added successfully.'
      )
    } catch (error) {
      setError(error.message || 'Could not save the stock record.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this stock record?'
    )

    if (!confirmed || loading) return

    setMessage('')
    setError('')
    setLoading(true)

    try {
      await deleteData('stock', id)

      if (editingId === id) {
        resetForm()
      }

      if (viewingStock?.id === id) {
        setViewingStock(null)
      }

      await loadData()
      setMessage('Stock record deleted successfully.')
    } catch (error) {
      setError(error.message || 'Could not delete this stock record.')
    } finally {
      setLoading(false)
    }
  }

  function formatMoney(amount) {
    return Number(amount).toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="stock-page">
      <section className="panel">
        <h2>Stock Management</h2>

        <p>Record and manage available fruit stock.</p>

        <button
          type="button"
          className="primary-button"
          onClick={openAddModal}
          disabled={loading}
        >
          Add Stock
        </button>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}

        {error && !showStockModal && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {showStockModal && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !loading) {
              resetForm()
            }
          }}
        >
          <div
            className="fruit-form stock-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-modal-title"
          >
            <h2 id="stock-modal-title">
              {editingId !== null ? 'Edit Stock' : 'Add Stock'}
            </h2>

            <form onSubmit={handleSubmit} className="stock-form">
              <label htmlFor="stockFruitName">
                Fruit Name
                <select
                  id="stockFruitName"
                  value={fruitId}
                  onChange={(event) => setFruitId(event.target.value)}
                  required
                >
                  <option value="">Select a fruit</option>

                  {fruits.map((fruit) => (
                    <option
                      key={fruit.fruit_id}
                      value={fruit.fruit_id}
                    >
                      {fruit.fruit_name}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="stockQuantity">
                Quantity
                <input
                  id="stockQuantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Enter quantity"
                  required
                />
              </label>

              <label htmlFor="stockBoxSize">
                Box Size
                <select
                  id="stockBoxSize"
                  value={boxSizeId}
                  onChange={(event) => setBoxSizeId(event.target.value)}
                  required
                >
                  <option value="">Select a box size</option>

                  {boxSizes.map((size) => (
                    <option
                      key={size.box_size_id}
                      value={size.box_size_id}
                    >
                      {size.size_name} ({size.capacity_kg} kg)
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="stockSupplier">
                Supplier
                <select
                  id="stockSupplier"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  required
                >
                  <option value="">Select a supplier</option>

                  {suppliers.map((supplier) => (
                    <option
                      key={supplier.supplier_id}
                      value={supplier.supplier_id}
                    >
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="stockUnitCost">
                Unit Cost (M)
                <input
                  id="stockUnitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                  placeholder="Enter cost per unit"
                  required
                />
              </label>

              {error && (
                <p className="form-error stock-modal-error" role="alert">
                  {error}
                </p>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    loading ||
                    fruits.length === 0 ||
                    boxSizes.length === 0 ||
                    suppliers.length === 0
                  }
                >
                  {loading
                    ? 'Please wait...'
                    : editingId !== null
                      ? 'Save Changes'
                      : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="panel">
        <h3>Available Stock</h3>

        <div className="stock-table-wrapper">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Stock ID</th>
                <th>Fruit Name</th>
                <th>Quantity</th>
                <th>Box Size</th>
                <th>Supplier</th>
                <th>Unit Cost (M)</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {stock.length > 0 ? (
                stock.map((item) => (
                  <tr key={item.id}>
                    <td>ST{String(item.id).padStart(3, '0')}</td>
                    <td>{item.fruitName}</td>
                    <td>{item.quantity}</td>
                    <td>{item.boxSize}</td>
                    <td>{item.supplierName}</td>
                    <td>{formatMoney(item.unitCost)}</td>

                    <td>
                      <div className="supplier-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setViewingStock(item)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(item)}
                          disabled={loading}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="supplier-empty-cell">
                    No stock records added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewingStock && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setViewingStock(null)
            }
          }}
        >
          <div
            className="fruit-form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-details-title"
          >
            <h2 id="stock-details-title">Stock Record Details</h2>

            <p>
              <strong>Stock ID:</strong>{' '}
              ST{String(viewingStock.id).padStart(3, '0')}
            </p>

            <p>
              <strong>Fruit Name:</strong> {viewingStock.fruitName}
            </p>

            <p>
              <strong>Quantity:</strong> {viewingStock.quantity}
            </p>

            <p>
              <strong>Box Size:</strong> {viewingStock.boxSize}
            </p>

            <p>
              <strong>Box Capacity:</strong>{' '}
              {viewingStock.capacityKg
                ? `${viewingStock.capacityKg} kg`
                : 'Not recorded'}
            </p>

            <p>
              <strong>Supplier:</strong> {viewingStock.supplierName}
            </p>

            <p>
              <strong>Unit Cost:</strong> M{formatMoney(viewingStock.unitCost)}
            </p>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setViewingStock(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const item = viewingStock
                  setViewingStock(null)
                  handleEdit(item)
                }}
                disabled={loading}
              >
                Edit Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockManagement
