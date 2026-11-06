
import { useState, useEffect } from 'react'
import './App.css'
import { getData, addData, updateData, deleteData } from './api'

const orderStatuses = [
  'Pending',
  'Processing',
  'Confirmed',
  'Ready for Collection/ Delivery',
  'Completed',
  'Cancelled',
]

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDate(date) {
  if (!date) return ''

  return String(date).slice(0, 10)
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function Orders() {
  const [orders, setOrders] = useState([])
  const [vendors, setVendors] = useState([])
  const [fruits, setFruits] = useState([])
  const [boxSizes, setBoxSizes] = useState([])

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingOrder, setViewingOrder] = useState(null)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const emptyForm = {
    orderDate: getTodayDate(),
    vendorId: '',
    fruitId: '',
    quantity: '1',
    boxSizeId: '',
    status: 'Pending',
  }

  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [orderData, vendorData, fruitData, boxData] =
        await Promise.all([
          getData('orders/with-items'),
          getData('street-vendors'),
          getData('fruits'),
          getData('box-sizes'),
        ])

      setVendors(
        vendorData.filter(
          (vendor) => !vendor.status || vendor.status === 'Active'
        )
      )

      setFruits(
        fruitData.filter(
          (fruit) => !fruit.status || fruit.status === 'Active'
        )
      )

      setBoxSizes(
        boxData.filter(
          (size) => !size.status || size.status === 'Active'
        )
      )

      setOrders(
        orderData.map((order) => ({
          id: order.order_id,
          orderDate: formatDate(order.order_date),
          vendorId: order.vendor_id,
          vendorName: order.vendor_name || 'Unknown vendor',
          fruitId: order.fruit_id,
          fruitName: order.fruit_name || 'Unknown fruit',
          quantity: Number(order.quantity || 0),
          boxSizeId: order.box_size_id,
          boxSize: order.size_name || 'Unknown size',
          unitPrice: Number(order.unit_price || 0),
          subtotal: Number(order.subtotal || 0),
          status: order.status || 'Pending',
          totalAmount: Number(order.total_amount || 0),
        }))
      )

      setError('')
    } catch (err) {
      setError(
        err.message || 'Could not load orders. Check the backend connection.'
      )
    }
  }

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }))
  }

  function resetForm() {
    setFormData({
      ...emptyForm,
      orderDate: getTodayDate(),
    })

    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  function openAddForm() {
    setFormData({
      ...emptyForm,
      orderDate: getTodayDate(),
    })

    setEditingId(null)
    setViewingOrder(null)
    setError('')
    setMessage('')
    setShowForm(true)
  }

  function openEditForm(order) {
    setFormData({
      orderDate: order.orderDate || getTodayDate(),
      vendorId: String(order.vendorId || ''),
      fruitId: String(order.fruitId || ''),
      quantity: String(order.quantity || 1),
      boxSizeId: String(order.boxSizeId || ''),
      status: order.status || 'Pending',
    })

    setEditingId(order.id)
    setViewingOrder(null)
    setError('')
    setMessage('')
    setShowForm(true)
  }

  const selectedBoxSize = boxSizes.find(
    (size) => Number(size.box_size_id) === Number(formData.boxSizeId)
  )

  const unitPrice = Number(selectedBoxSize?.price || 0)
  const quantity = Number(formData.quantity || 0)
  const subtotal = unitPrice * quantity
  const totalOrderAmount = subtotal

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    const wasEditing = editingId !== null

    if (!formData.vendorId || !formData.fruitId || !formData.boxSizeId) {
      setError('Please select a vendor, fruit, and box size.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be a whole number greater than zero.')
      return
    }

    if (!selectedBoxSize) {
      setError('Please select a valid box size.')
      return
    }

    const orderData = {
      order_date: formData.orderDate,
      vendor_id: Number(formData.vendorId),
      fruit_id: Number(formData.fruitId),
      box_size_id: Number(formData.boxSizeId),
      quantity,
      status: formData.status,
      total_amount: Number(totalOrderAmount.toFixed(2)),
    }

    setLoading(true)

    try {
      if (wasEditing) {
        await updateData(
          'orders/with-items',
          editingId,
          orderData
        )
      } else {
        await addData('orders/with-items', orderData)
      }

      resetForm()
      await loadData()

      setMessage(
        wasEditing
          ? 'Order updated successfully.'
          : 'Order created successfully.'
      )
    } catch (err) {
      setError(err.message || 'Could not save the order.')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    setError('')
    setMessage('')

    try {
      await updateData('orders', orderId, {
        status: newStatus,
      })

      await loadData()
      setMessage('Order status updated successfully.')
    } catch (err) {
      setError(err.message || 'Could not update the order status.')
    }
  }

  async function handleDelete(order) {
    const confirmed = window.confirm(
      `Are you sure you want to delete order ${order.id}?`
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteData('orders', order.id)

      setOrders((previousOrders) =>
        previousOrders.filter((item) => item.id !== order.id)
      )

      if (viewingOrder?.id === order.id) {
        setViewingOrder(null)
      }

      setMessage('Order deleted successfully.')
    } catch (err) {
      setError(
        err.message ||
          'Could not delete the order. It may have related order items.'
      )
    }
  }

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.toLowerCase()

    return (
      String(order.id).toLowerCase().includes(search) ||
      order.vendorName.toLowerCase().includes(search) ||
      order.fruitName.toLowerCase().includes(search) ||
      order.boxSize.toLowerCase().includes(search) ||
      order.status.toLowerCase().includes(search) ||
      order.orderDate.toLowerCase().includes(search)
    )
  })

  const totalOrders = orders.length

  const pendingOrders = orders.filter(
    (order) => order.status === 'Pending'
  ).length

  const completedOrders = orders.filter(
    (order) => order.status === 'Completed'
  ).length

  const totalSales = orders.reduce(
    (total, order) => total + Number(order.totalAmount || 0),
    0
  )

  return (
    <div className="orders-page">
      <section className="orders-summary">
        <div>
          <p>Total Orders</p>
          <h2>{totalOrders}</h2>
          <small>All recorded orders</small>
        </div>

        <div>
          <p>Pending Orders</p>
          <h2>{pendingOrders}</h2>
          <small>Orders awaiting action</small>
        </div>

        <div>
          <p>Completed Orders</p>
          <h2>{completedOrders}</h2>
          <small>Successfully completed</small>
        </div>

        <div>
          <p>Total Sales</p>
          <h2>M {formatMoney(totalSales)}</h2>
          <small>Value of recorded orders</small>
        </div>
      </section>

      <section className="panel orders-panel">
        <div className="orders-toolbar">
          <div>
            <h3>Order Management</h3>
            <p>Create, view, and manage vendor orders.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddForm}
          >
            + Add Order
          </button>
        </div>

        <div className="orders-search">
          <input
            type="text"
            placeholder="Search by order ID, vendor, fruit, date or status..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          {searchTerm && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          )}
        </div>

        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}

        {error && !showForm && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Fruit</th>
                <th>Quantity</th>
                <th>Box Size</th>
                <th>Total (M)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>ORD{String(order.id).padStart(3, '0')}</td>
                    <td>{order.orderDate}</td>
                    <td>{order.vendorName}</td>
                    <td>{order.fruitName}</td>
                    <td>{order.quantity}</td>
                    <td>{order.boxSize}</td>
                    <td>{formatMoney(order.totalAmount)}</td>

                    <td>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          handleStatusChange(
                            order.id,
                            event.target.value
                          )
                        }
                        aria-label={`Status for order ${order.id}`}
                      >
                        {orderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className="supplier-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setViewingOrder(order)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => openEditForm(order)}
                          disabled={loading}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(order)}
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
                  <td colSpan="9" className="supplier-empty-cell">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!loading) resetForm()
          }}
        >
          <div
            className="modal order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="supplier-form-heading">
              <div>
                <h3 id="order-modal-title">
                  {editingId !== null ? 'Edit Order' : 'Create New Order'}
                </h3>

                <p>Enter the order information below.</p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={resetForm}
                disabled={loading}
                aria-label="Close order form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="supplier-form-grid">
                <label>
                  Order Date
                  <input
                    type="date"
                    name="orderDate"
                    value={formData.orderDate}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label>
                  Vendor Name
                  <select
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a vendor</option>

                    {vendors.map((vendor) => (
                      <option
                        key={vendor.vendor_id}
                        value={vendor.vendor_id}
                      >
                        {vendor.vendor_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Fruit Name
                  <select
                    name="fruitId"
                    value={formData.fruitId}
                    onChange={handleChange}
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

                <label>
                  Quantity
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    step="1"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="Enter quantity"
                    required
                  />
                </label>

                <label>
                  Box Size
                  <select
                    name="boxSizeId"
                    value={formData.boxSizeId}
                    onChange={handleChange}
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

                <label>
                  Unit Price (M)
                  <input
                    type="text"
                    value={formatMoney(unitPrice)}
                    readOnly
                  />
                </label>

                <label>
                  Subtotal (M)
                  <input
                    type="text"
                    value={formatMoney(subtotal)}
                    readOnly
                  />
                </label>

                <label>
                  Total Order Amount (M)
                  <input
                    type="text"
                    value={formatMoney(totalOrderAmount)}
                    readOnly
                  />
                </label>

                <label>
                  Order Status
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="secondary-button"
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
                    vendors.length === 0 ||
                    fruits.length === 0 ||
                    boxSizes.length === 0
                  }
                >
                  {loading
                    ? 'Saving...'
                    : editingId !== null
                      ? 'Save Changes'
                      : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div
          className="modal-overlay"
          onClick={() => setViewingOrder(null)}
        >
          <div
            className="modal order-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="supplier-form-heading">
              <div>
                <h3 id="order-details-title">Order Details</h3>
                <p>
                  ORD{String(viewingOrder.id).padStart(3, '0')}
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setViewingOrder(null)}
                aria-label="Close order details"
              >
                ×
              </button>
            </div>

            <div className="order-details-list">
              <p>
                <strong>Order Date:</strong> {viewingOrder.orderDate}
              </p>

              <p>
                <strong>Vendor:</strong> {viewingOrder.vendorName}
              </p>

              <p>
                <strong>Fruit:</strong> {viewingOrder.fruitName}
              </p>

              <p>
                <strong>Quantity:</strong> {viewingOrder.quantity}
              </p>

              <p>
                <strong>Box Size:</strong> {viewingOrder.boxSize}
              </p>

              <p>
                <strong>Unit Price:</strong> M{' '}
                {formatMoney(viewingOrder.unitPrice)}
              </p>

              <p>
                <strong>Subtotal:</strong> M{' '}
                {formatMoney(viewingOrder.subtotal)}
              </p>

              <p>
                <strong>Total Amount:</strong> M{' '}
                {formatMoney(viewingOrder.totalAmount)}
              </p>

              <p>
                <strong>Status:</strong> {viewingOrder.status}
              </p>
            </div>

            <div className="supplier-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setViewingOrder(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="edit-button"
                onClick={() => openEditForm(viewingOrder)}
              >
                Edit Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders
