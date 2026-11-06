
import { useState, useEffect } from 'react'
import './App.css'

import Fruits from './Fruits'
import BoxSizes from './BoxSizes'
import Suppliers from './Suppliers'
import StockManagement from './StockManagement'
import StreetVendors from './StreetVendors'
import MapPage from './MapPage'
import Orders from './Orders'
import Reports from './Reports'

import {
  getData,
  login,
  logout,
  getCurrentUser,
} from './api'

function App() {
  // Current page
  const [activePage, setActivePage] = useState('Dashboard')

  // Login information
  const [currentUser, setCurrentUser] = useState(getCurrentUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Dashboard information
  const [dashboardData, setDashboardData] = useState({
    fruits: [],
    suppliers: [],
    vendors: [],
    stock: [],
    orders: [],
  })

  const [dashboardError, setDashboardError] = useState('')

  // Load dashboard after login
  useEffect(() => {
    if (currentUser) {
      loadDashboard()
    }
  }, [currentUser])

  // Get information from the backend
  async function loadDashboard() {
    try {
      setDashboardError('')

      const [fruits, suppliers, vendors, stock, orders] =
        await Promise.all([
          getData('fruits'),
          getData('suppliers'),
          getData('street-vendors'),
          getData('stock'),
          getData('orders/with-items'),
        ])

      setDashboardData({
        fruits,
        suppliers,
        vendors,
        stock,
        orders,
      })
    } catch (error) {
      setDashboardError(
        error.message || 'Could not load dashboard information.'
      )
    }
  }

  // Log in
  async function handleLogin(event) {
    event.preventDefault()

    setLoginError('')
    setIsLoggingIn(true)

    try {
      const result = await login(username.trim(), password)

      setCurrentUser(result.user)
      setPassword('')
      setActivePage('Dashboard')
    } catch (error) {
      setLoginError(error.message || 'Could not log in.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Log out
  function handleLogout() {
    logout()

    setCurrentUser(null)
    setUsername('')
    setPassword('')
    setLoginError('')
    setDashboardError('')
    setActivePage('Dashboard')

    setDashboardData({
      fruits: [],
      suppliers: [],
      vendors: [],
      stock: [],
      orders: [],
    })
  }

  // Dashboard calculations
  const totalFruits = dashboardData.fruits.length
  const totalSuppliers = dashboardData.suppliers.length
  const totalVendors = dashboardData.vendors.length

  const availableStock = dashboardData.stock.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  )

  const totalOrders = dashboardData.orders.length

  const pendingOrders = dashboardData.orders.filter(
    (order) => order.status === 'Pending'
  ).length

  const completedOrders = dashboardData.orders.filter(
    (order) => order.status === 'Completed'
  ).length

  const totalSales = dashboardData.orders.reduce(
    (total, order) => total + Number(order.total_amount || 0),
    0
  )

  // Menu options
  const allMenuItems = [
    'Dashboard',
    'Fruits',
    'Box Sizes',
    'Suppliers',
    'Stock Management',
    'Street Vendors',
    'Map',
    'Orders',
    'Reports',
  ]

  const menuItems =
    currentUser?.role === 'Clerk'
      ? ['Dashboard', 'Stock Management', 'Orders']
      : allMenuItems

  const menuIcons = {
    Dashboard: '▦',
    Fruits: '●',
    'Box Sizes': '▣',
    Suppliers: '↔',
    'Stock Management': '▤',
    'Street Vendors': '♙',
    Map: '⌖',
    Orders: '▧',
    Reports: '▥',
  }

  // Show login page when nobody is logged in
  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f4f6f9',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            width: '100%',
            maxWidth: '400px',
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              textAlign: 'center',
              color: '#237a45',
              marginBottom: '8px',
              fontSize: '22px',
              lineHeight: '1.3',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.5px',
              width: '100%',
              display: 'block',
              boxSizing: 'border-box',
            }}
          >
            Batloung Fruits
          </h1>

          <p
            style={{
              textAlign: 'center',
              color: '#666',
              marginTop: '0',
            }}
          >
            Distribution System
          </p>

          <h2 style={{ marginTop: '28px' }}>Login</h2>

          <label htmlFor="username">Username</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            required
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              marginBottom: '18px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              marginBottom: '18px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />

          {loginError && (
            <p
              role="alert"
              style={{
                color: '#c62828',
                marginBottom: '16px',
              }}
            >
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              width: '100%',
              padding: '12px',
              background: '#237a45',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoggingIn ? 'wait' : 'pointer',
              opacity: isLoggingIn ? 0.7 : 1,
            }}
          >
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    )
  }

  // Main application after login
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">BF</div>

          <div>
            <h2>Batloung Fruits</h2>
            <p>Distribution System</p>
          </div>
        </div>

        <p className="menu-title">MAIN MENU</p>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`menu-item ${
                activePage === item ? 'active' : ''
              }`}
              onClick={() => setActivePage(item)}
            >
              <span className="menu-icon">{menuIcons[item]}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>DIWA2110</p>
          <small>Web Application Development</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="welcome">Welcome to</p>
            <h2>Batloung Fruits Distribution</h2>
          </div>

          <div className="user-profile">
            <div className="user-avatar">
              {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <div>
              <strong>{currentUser.full_name}</strong>
              <p>{currentUser.role}</p>
            </div>

            <button
              type="button"
              className="small-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <h1>{activePage}</h1>

            <p>
              {activePage === 'Dashboard'
                ? 'Here is an overview of your fruit distribution business.'
                : activePage === 'Map'
                  ? 'View supplier and street vendor locations on the map.'
                  : `Manage ${activePage.toLowerCase()} in your distribution system.`}
            </p>
          </div>

          <span className="date-label">● System Dashboard</span>
        </section>

        {activePage === 'Dashboard' ? (
          <>
            {dashboardError && (
              <div className="panel">
                <p>{dashboardError}</p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={loadDashboard}
                >
                  Try Again
                </button>
              </div>
            )}

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon fruit-icon">F</div>
                <p>Total Fruits</p>
                <h2>{totalFruits}</h2>
                <small>Registered fruit types</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon supplier-icon">S</div>
                <p>Total Suppliers</p>
                <h2>{totalSuppliers}</h2>
                <small>Registered suppliers</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon vendor-icon">V</div>
                <p>Registered Vendors</p>
                <h2>{totalVendors}</h2>
                <small>Street vendors</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon stock-icon">B</div>
                <p>Available Stock</p>
                <h2>{availableStock}</h2>
                <small>Total recorded quantity</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon order-icon">O</div>
                <p>Total Orders</p>
                <h2>{totalOrders}</h2>
                <small>All recorded orders</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon pending-icon">P</div>
                <p>Pending Orders</p>
                <h2>{pendingOrders}</h2>
                <small>Orders awaiting action</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon completed-icon">✓</div>
                <p>Completed Orders</p>
                <h2>{completedOrders}</h2>
                <small>Successfully completed</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon sales-icon">M</div>
                <p>Total Sales</p>

                <h2>
                  M{' '}
                  {totalSales.toLocaleString('en-ZA', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h2>

                <small>Total value of recorded orders</small>
              </div>
            </section>

            <section className="dashboard-bottom">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Fruit Inventory</h3>
                    <p>Fruits managed by the system</p>
                  </div>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() => setActivePage('Fruits')}
                  >
                    View Fruits →
                  </button>
                </div>

                <div className="fruit-list">
                  {dashboardData.fruits.length > 0 ? (
                    dashboardData.fruits.map((fruit, index) => (
                      <div
                        className="fruit-row"
                        key={fruit.fruit_id}
                      >
                        <span className="fruit-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <span>{fruit.fruit_name}</span>

                        <span className="fruit-status">
                          {fruit.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>No fruits registered yet.</p>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent Orders</h3>
                    <p>Latest vendor orders</p>
                  </div>

                  <button
                    type="button"
                    className="small-button"
                    onClick={() => setActivePage('Orders')}
                  >
                    View Orders →
                  </button>
                </div>

                {dashboardData.orders.length > 0 ? (
                  <div className="fruit-list">
                    {[...dashboardData.orders]
                      .sort(
                        (a, b) =>
                          new Date(b.order_date) -
                          new Date(a.order_date)
                      )
                      .slice(0, 5)
                      .map((order) => (
                        <div
                          className="fruit-row"
                          key={order.order_id}
                        >
                          <span className="fruit-number">
                            #{order.order_id}
                          </span>

                          <span>
                            {order.vendor_name || 'Vendor'}
                          </span>

                          <span className="fruit-status">
                            {order.status}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">O</div>
                    <h4>No orders yet</h4>
                    <p>Vendor orders will appear here.</p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setActivePage('Orders')}
                    >
                      Manage Orders
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : activePage === 'Fruits' ? (
          <Fruits />
        ) : activePage === 'Box Sizes' ? (
          <BoxSizes />
        ) : activePage === 'Suppliers' ? (
          <Suppliers />
        ) : activePage === 'Stock Management' ? (
          <StockManagement />
        ) : activePage === 'Street Vendors' ? (
          <StreetVendors />
        ) : activePage === 'Map' ? (
          <MapPage />
        ) : activePage === 'Orders' ? (
          <Orders />
        ) : activePage === 'Reports' ? (
          <Reports />
        ) : (
          <section className="panel page-placeholder">
            <div className="empty-icon">P</div>

            <h2>{activePage}</h2>

            <p>
              This section is ready for us to build next. We will add its
              forms, tables, search, and working features step by step.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setActivePage('Dashboard')}
            >
              Back to Dashboard
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
