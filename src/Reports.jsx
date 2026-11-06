
import { useState, useEffect } from 'react'
import './App.css'
import { getData, getReport } from './api'

const reportOptions = [
  'Available Stock Report',
  'Sales by Fruit',
  'Sales by Box Size',
  'Sales by Street Vendor',
  'Purchases by South African Province',
  'Pending Orders',
  'Completed Orders',
  'Total Sales by Date',
]

function Reports() {
  const [reportType, setReportType] = useState('Available Stock Report')
  const [fruits, setFruits] = useState([])
  const [stock, setStock] = useState([])
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [vendors, setVendors] = useState([])
  const [boxSizes, setBoxSizes] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [summary, setSummary] = useState({
    totalFruits: 0,
    totalSuppliers: 0,
    totalVendors: 0,
    totalStock: 0,
    totalOrders: 0,
    totalSales: 0,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      setError('')

      const [
        fruitData,
        stockData,
        orderData,
        reportData,
        itemData,
        vendorData,
        boxData,
        supplierData,
      ] = await Promise.all([
        getData('fruits'),
        getData('stock'),
        getData('orders'),
        getReport(),
        getData('orders/with-items'),
        getData('street-vendors'),
        getData('box-sizes'),
        getData('suppliers'),
      ])

      setFruits(fruitData)
      setStock(stockData)
      setOrders(orderData)
      setSummary(reportData)
      setOrderItems(itemData)
      setVendors(vendorData)
      setBoxSizes(boxData)
      setSuppliers(supplierData)
    } catch (error) {
      setError(
        error.message ||
          'Could not load reports. Please check the backend.'
      )
    }
  }

  function money(value) {
    return `M ${Number(value || 0).toFixed(2)}`
  }

  function getFruitName(id) {
    const fruit = fruits.find(
      (item) => Number(item.fruit_id) === Number(id)
    )
    return fruit ? fruit.fruit_name : 'Unknown fruit'
  }

  function getVendorName(id) {
    const vendor = vendors.find(
      (item) => Number(item.vendor_id) === Number(id)
    )
    return vendor ? vendor.vendor_name : 'Unknown vendor'
  }

  function getBoxSizeName(id) {
    const size = boxSizes.find(
      (item) => Number(item.box_size_id) === Number(id)
    )
    return size ? size.size_name : 'Unknown box size'
  }

  function getSupplier(id) {
    return suppliers.find(
      (item) => Number(item.supplier_id) === Number(id)
    )
  }

  function getOrderDate(order) {
    const value = order.order_date || order.date

    if (!value) return 'Unknown date'

    return String(value).slice(0, 10)
  }

  function getItemSubtotal(item) {
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return Number(item.subtotal)
    }

    return (
      Number(item.quantity || 0) *
      Number(item.unit_price || 0)
    )
  }

  const totalQuantity = stock.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  )

  const pendingOrders = orders.filter(
    (order) => order.status === 'Pending'
  )

  const completedOrders = orders.filter(
    (order) => order.status === 'Completed'
  )

  // Group order-item rows and add their sales amounts.
  function groupSales(keyFunction, nameFunction) {
    const groups = {}

    orderItems.forEach((item) => {
      const key = keyFunction(item)
      const name = nameFunction(item)

      if (key === undefined || key === null || key === '') return

      if (!groups[key]) {
        groups[key] = {
          name,
          quantity: 0,
          sales: 0,
        }
      }

      groups[key].quantity += Number(item.quantity || 0)
      groups[key].sales += getItemSubtotal(item)
    })

    return Object.values(groups).sort(
      (a, b) => b.sales - a.sales
    )
  }

  const salesByFruit = groupSales(
    (item) => item.fruit_id,
    (item) => getFruitName(item.fruit_id)
  )

  const salesByBoxSize = groupSales(
    (item) => item.box_size_id,
    (item) => getBoxSizeName(item.box_size_id)
  )

  const salesByVendor = groupSales(
    (item) => item.vendor_id,
    (item) => getVendorName(item.vendor_id)
  )

  // Group stock purchases by the supplier's province.
  const purchasesByProvince = (() => {
    const groups = {}

    stock.forEach((item) => {
      const supplier = getSupplier(item.supplier_id)
      const province = supplier?.province || 'Province not recorded'

      if (!groups[province]) {
        groups[province] = {
          name: province,
          quantity: 0,
          amount: 0,
        }
      }

      groups[province].quantity += Number(item.quantity || 0)
      groups[province].amount +=
        Number(item.quantity || 0) *
        Number(item.unit_cost || 0)
    })

    return Object.values(groups).sort(
      (a, b) => b.amount - a.amount
    )
  })()

  // Use one order record per order ID to avoid counting an order's
  // total amount more than once.
  const salesByDate = (() => {
    const groups = {}

    orders.forEach((order) => {
      const date = getOrderDate(order)

      if (!groups[date]) {
        groups[date] = {
          name: date,
          orders: 0,
          sales: 0,
        }
      }

      groups[date].orders += 1
      groups[date].sales += Number(order.total_amount || 0)
    })

    return Object.values(groups).sort((a, b) =>
      b.name.localeCompare(a.name)
    )
  })()

  function renderSalesTable(rows) {
    return (
      <table className="suppliers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Quantity Sold</th>
            <th>Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.quantity}</td>
              <td>{money(row.sales)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan="3">No sales records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    )
  }

  function renderOrderTable(orderList) {
    return (
      <table className="suppliers-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Order Date</th>
            <th>Street Vendor</th>
            <th>Status</th>
            <th>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {orderList.map((order) => (
            <tr key={order.order_id}>
              <td>ORD{String(order.order_id).padStart(3, '0')}</td>
              <td>{getOrderDate(order)}</td>
              <td>{getVendorName(order.vendor_id)}</td>
              <td>{order.status}</td>
              <td>{money(order.total_amount)}</td>
            </tr>
          ))}
          {orderList.length === 0 && (
            <tr>
              <td colSpan="5">No orders found.</td>
            </tr>
          )}
        </tbody>
      </table>
    )
  }

  function renderReport() {
    switch (reportType) {
      case 'Available Stock Report':
        return (
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Fruit</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Unit Cost</th>
                <th>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((item) => {
                const supplier = getSupplier(item.supplier_id)
                const quantity = Number(item.quantity || 0)
                const cost = Number(item.unit_cost || 0)

                return (
                  <tr key={item.stock_id}>
                    <td>{getFruitName(item.fruit_id)}</td>
                    <td>{quantity}</td>
                    <td>
                      {supplier?.supplier_name || 'Unknown supplier'}
                    </td>
                    <td>{money(cost)}</td>
                    <td>{money(quantity * cost)}</td>
                  </tr>
                )
              })}
              {stock.length === 0 && (
                <tr>
                  <td colSpan="5">No stock records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )

      case 'Sales by Fruit':
        return renderSalesTable(salesByFruit)

      case 'Sales by Box Size':
        return renderSalesTable(salesByBoxSize)

      case 'Sales by Street Vendor':
        return renderSalesTable(salesByVendor)

      case 'Purchases by South African Province':
        return (
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Stock Quantity Purchased/Recorded</th>
                <th>Purchase Value</th>
              </tr>
            </thead>
            <tbody>
              {purchasesByProvince.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.quantity}</td>
                  <td>{money(row.amount)}</td>
                </tr>
              ))}
              {purchasesByProvince.length === 0 && (
                <tr>
                  <td colSpan="3">No purchase records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )

      case 'Pending Orders':
        return renderOrderTable(pendingOrders)

      case 'Completed Orders':
        return renderOrderTable(completedOrders)

      case 'Total Sales by Date':
        return (
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Order Date</th>
                <th>Number of Orders</th>
                <th>Total Sales</th>
              </tr>
            </thead>
            <tbody>
              {salesByDate.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.sales)}</td>
                </tr>
              ))}
              {salesByDate.length === 0 && (
                <tr>
                  <td colSpan="3">No sales records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )

      default:
        return null
    }
  }

  return (
    <div className="suppliers-page">
      <div className="suppliers-summary">
        <div className="panel">
          <h3>Total Fruits</h3>
          <h2>{summary.totalFruits ?? fruits.length}</h2>
        </div>

        <div className="panel">
          <h3>Total Stock</h3>
          <h2>{totalQuantity}</h2>
        </div>

        <div className="panel">
          <h3>Total Orders</h3>
          <h2>{summary.totalOrders ?? orders.length}</h2>
        </div>
      </div>

      <section className="panel suppliers-panel">
        <div className="suppliers-toolbar">
          <div>
            <h2>Reports</h2>
            <p>View reports for the distribution system.</p>
          </div>

          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            {reportOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="primary-button"
            onClick={() => window.print()}
          >
            Print Report
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="suppliers-table-wrapper">
          {renderReport()}
        </div>
      </section>
    </div>
  )
}

export default Reports
