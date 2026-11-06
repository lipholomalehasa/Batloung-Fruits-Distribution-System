require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'batloung_fruits',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

const resources = [
  {
    path: 'fruits',
    table: 'fruits',
    id: 'fruit_id',
    fields: ['fruit_name', 'description', 'status'],
    viewRoles: ['Administrator', 'Manager', 'Sales'],
    editRoles: ['Administrator', 'Manager'],
  },
  {
    path: 'suppliers',
    table: 'suppliers',
    id: 'supplier_id',
    fields: [
      'supplier_name',
      'phone',
      'email',
      'address',
      'province',
      'latitude',
      'longitude',
    ],
    viewRoles: ['Administrator', 'Manager'],
    editRoles: ['Administrator', 'Manager'],
  },
  {
    path: 'box-sizes',
    table: 'box_sizes',
    id: 'box_size_id',
    fields: ['size_name', 'capacity_kg', 'price', 'status'],
    viewRoles: ['Administrator', 'Manager', 'Sales'],
    editRoles: ['Administrator', 'Manager'],
  },
  {
    path: 'street-vendors',
    table: 'street_vendors',
    id: 'vendor_id',
    fields: [
      'vendor_name',
      'phone',
      'address',
      'status',
      'latitude',
      'longitude',
    ],
    viewRoles: ['Administrator', 'Manager', 'Clerk', 'Sales'],
    editRoles: ['Administrator', 'Manager', 'Sales'],
  },
  {
    path: 'stock',
    table: 'stock',
    id: 'stock_id',
    fields: [
      'fruit_id',
      'box_size_id',
      'supplier_id',
      'quantity',
      'unit_cost',
    ],
    viewRoles: ['Administrator', 'Manager', 'Clerk'],
    editRoles: ['Administrator', 'Manager', 'Clerk'],
  },
  {
    path: 'orders',
    table: 'orders',
    id: 'order_id',
    fields: ['vendor_id', 'status', 'total_amount'],
    viewRoles: ['Administrator', 'Manager', 'Clerk', 'Sales'],
    editRoles: ['Administrator', 'Manager', 'Clerk', 'Sales'],
  },
]

// Include every status used by Orders.jsx.
const allowedOrderStatuses = [
  'Pending',
  'Processing',
  'Confirmed',
  'Ready for Collection/ Delivery',
  'Completed',
  'Cancelled',
]

function sendError(res, error, message = 'Something went wrong.') {
  console.error(message, error)
  return res.status(500).json({ message })
}

// Check whether the user is logged in.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Please log in to access this resource.',
    })
  }

  const token = authHeader.slice(7)

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (error) {
    return res.status(401).json({
      message:
        'Your login session is invalid or expired. Please log in again.',
    })
  }
}

// Check whether the logged-in user has permission.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.',
      })
    }

    next()
  }
}

// Validate order fields shared by create and update.
async function validateOrderDetails(connection, body) {
  const vendorId = Number(body.vendor_id)
  const fruitId = Number(body.fruit_id)
  const boxSizeId = Number(body.box_size_id)
  const quantity = Number(body.quantity)
  const status = body.status || 'Pending'

  if (
    !Number.isInteger(vendorId) ||
    vendorId <= 0 ||
    !Number.isInteger(fruitId) ||
    fruitId <= 0 ||
    !Number.isInteger(boxSizeId) ||
    boxSizeId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      'Select a vendor, fruit and box size, and enter a valid whole-number quantity.'
    )
  }

  if (!allowedOrderStatuses.includes(status)) {
    throw new Error('The selected order status is invalid.')
  }

  const [vendors] = await connection.query(
    `SELECT vendor_id
     FROM street_vendors
     WHERE vendor_id = ? AND status = 'Active'`,
    [vendorId]
  )

  if (vendors.length === 0) {
    throw new Error('The selected vendor does not exist or is inactive.')
  }

  const [fruits] = await connection.query(
    `SELECT fruit_id
     FROM fruits
     WHERE fruit_id = ? AND status = 'Active'`,
    [fruitId]
  )

  if (fruits.length === 0) {
    throw new Error('The selected fruit does not exist or is inactive.')
  }

  const [boxSizes] = await connection.query(
    `SELECT price
     FROM box_sizes
     WHERE box_size_id = ? AND status = 'Active'`,
    [boxSizeId]
  )

  if (boxSizes.length === 0) {
    throw new Error(
      'The selected box size does not exist or is inactive.'
    )
  }

  const unitPrice = Number(boxSizes[0].price)

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('The selected box size has an invalid price.')
  }

  const subtotal = Number((unitPrice * quantity).toFixed(2))

  return {
    vendorId,
    fruitId,
    boxSizeId,
    quantity,
    status,
    unitPrice,
    subtotal,
  }
}

// Basic server check.
app.get('/', (req, res) => {
  res.json({
    message: 'Batloung Fruits Distribution System API is running.',
  })
})

// Login endpoint.
app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = req.body.password

  if (!username || typeof password !== 'string' || !password) {
    return res.status(400).json({
      message: 'Please enter your username and password.',
    })
  }

  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 10 ||
    process.env.JWT_SECRET ===
      'change_this_to_a_long_random_secret_please_replace'
  ) {
    return res.status(500).json({
      message: 'Login security is not configured correctly.',
    })
  }

  try {
    const [users] = await pool.execute(
      `SELECT user_id, full_name, username, password_hash, role
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username]
    )

    if (users.length === 0) {
      return res.status(401).json({
        message: 'Invalid username or password.',
      })
    }

    const user = users[0]

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid username or password.',
      })
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    )

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    return sendError(res, error, 'Could not log in.')
  }
})

// Database connection check.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')

    res.json({
      message: 'Backend and database are connected successfully.',
    })
  } catch (error) {
    sendError(res, error, 'Database connection failed.')
  }
})

// All remaining API routes require login.
app.use('/api', requireAuth)

// Get orders with their items.
app.get(
  '/api/orders/with-items',
  requireRole('Administrator', 'Manager', 'Clerk', 'Sales'),
  async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT
          o.order_id,
          o.order_date,
          o.vendor_id,
          o.status,
          o.total_amount,
          v.vendor_name,
          oi.fruit_id,
          f.fruit_name,
          oi.quantity,
          oi.box_size_id,
          bs.size_name,
          oi.unit_price,
          oi.subtotal
        FROM orders o
        LEFT JOIN street_vendors v
          ON o.vendor_id = v.vendor_id
        LEFT JOIN order_items oi
          ON o.order_id = oi.order_id
        LEFT JOIN fruits f
          ON oi.fruit_id = f.fruit_id
        LEFT JOIN box_sizes bs
          ON oi.box_size_id = bs.box_size_id
        ORDER BY o.order_id DESC
      `)

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, 'Could not load orders.')
    }
  }
)

// Create an order and its first item.
app.post(
  '/api/orders/with-items',
  requireRole('Administrator', 'Manager', 'Clerk', 'Sales'),
  async (req, res) => {
    let connection
    let transactionStarted = false

    try {
      connection = await pool.getConnection()

      const details = await validateOrderDetails(
        connection,
        req.body
      )

      await connection.beginTransaction()
      transactionStarted = true

      const orderDate = req.body.order_date || new Date()

      const [orderResult] = await connection.query(
        `INSERT INTO orders
          (order_date, vendor_id, status, total_amount)
         VALUES (?, ?, ?, ?)`,
        [
          orderDate,
          details.vendorId,
          details.status,
          details.subtotal,
        ]
      )

      await connection.query(
        `INSERT INTO order_items
          (order_id, fruit_id, box_size_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          details.fruitId,
          details.boxSizeId,
          details.quantity,
          details.unitPrice,
          details.subtotal,
        ]
      )

      await connection.commit()
      transactionStarted = false

      return res.status(201).json({
        message: 'Order created successfully.',
        order_id: orderResult.insertId,
        total_amount: details.subtotal,
        unit_price: details.unitPrice,
        subtotal: details.subtotal,
      })
    } catch (error) {
      if (connection && transactionStarted) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Could not roll back the order:', rollbackError)
        }
      }

      if (
        error.message &&
        (
          error.message.startsWith('Select a vendor') ||
          error.message.startsWith('The selected ')
        )
      ) {
        return res.status(400).json({ message: error.message })
      }

      return sendError(res, error, 'Could not create the order.')
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)

// Update an order and its item details.
app.put(
  '/api/orders/with-items/:id',
  requireRole('Administrator', 'Manager', 'Clerk', 'Sales'),
  async (req, res) => {
    const orderId = Number(req.params.id)

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID.',
      })
    }

    // Sales users can update only the status of an order.
    if (req.user.role === 'Sales') {
      const submittedFields = Object.keys(req.body)
      const invalidFields = submittedFields.filter(
        (field) => field !== 'status'
      )

      if (
        invalidFields.length > 0 ||
        !allowedOrderStatuses.includes(req.body.status)
      ) {
        return res.status(403).json({
          message:
            'Sales users may update only a valid order status.',
        })
      }

      try {
        const [result] = await pool.query(
          'UPDATE orders SET status = ? WHERE order_id = ?',
          [req.body.status, orderId]
        )

        if (result.affectedRows === 0) {
          const [existing] = await pool.query(
            'SELECT order_id FROM orders WHERE order_id = ?',
            [orderId]
          )

          if (existing.length === 0) {
            return res.status(404).json({
              message: 'Order not found.',
            })
          }
        }

        return res.json({
          message: 'Order status updated successfully.',
        })
      } catch (error) {
        return sendError(res, error, 'Could not update order status.')
      }
    }

    let connection
    let transactionStarted = false

    try {
      connection = await pool.getConnection()

      await connection.beginTransaction()
      transactionStarted = true

      const [existingOrders] = await connection.query(
        'SELECT order_id FROM orders WHERE order_id = ? FOR UPDATE',
        [orderId]
      )

      if (existingOrders.length === 0) {
        await connection.rollback()
        transactionStarted = false

        return res.status(404).json({
          message: 'Order not found.',
        })
      }

      const details = await validateOrderDetails(
        connection,
        req.body
      )

      await connection.query(
        `UPDATE orders
         SET order_date = ?,
             vendor_id = ?,
             status = ?,
             total_amount = ?
         WHERE order_id = ?`,
        [
          req.body.order_date || new Date(),
          details.vendorId,
          details.status,
          details.subtotal,
          orderId,
        ]
      )

      const [items] = await connection.query(
        `SELECT order_item_id
         FROM order_items
         WHERE order_id = ?
         ORDER BY order_item_id ASC`,
        [orderId]
      )

      if (items.length > 0) {
        await connection.query(
          `UPDATE order_items
           SET fruit_id = ?,
               box_size_id = ?,
               quantity = ?,
               unit_price = ?,
               subtotal = ?
           WHERE order_item_id = ?`,
          [
            details.fruitId,
            details.boxSizeId,
            details.quantity,
            details.unitPrice,
            details.subtotal,
            items[0].order_item_id,
          ]
        )

        // Keep one item per order for this page.
        if (items.length > 1) {
          const extraItemIds = items
            .slice(1)
            .map((item) => item.order_item_id)

          const placeholders = extraItemIds.map(() => '?').join(', ')

          await connection.query(
            `DELETE FROM order_items
             WHERE order_id = ?
             AND order_item_id IN (${placeholders})`,
            [orderId, ...extraItemIds]
          )
        }
      } else {
        await connection.query(
          `INSERT INTO order_items
            (order_id, fruit_id, box_size_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            details.fruitId,
            details.boxSizeId,
            details.quantity,
            details.unitPrice,
            details.subtotal,
          ]
        )
      }

      await connection.commit()
      transactionStarted = false

      return res.json({
        message: 'Order updated successfully.',
        order_id: orderId,
        unit_price: details.unitPrice,
        subtotal: details.subtotal,
        total_amount: details.subtotal,
      })
    } catch (error) {
      if (connection && transactionStarted) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error(
            'Could not roll back the order update:',
            rollbackError
          )
        }
      }

      if (
        error.message &&
        (
          error.message.startsWith('Select a vendor') ||
          error.message.startsWith('The selected ')
        )
      ) {
        return res.status(400).json({ message: error.message })
      }

      return sendError(res, error, 'Could not update the order.')
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)

// Generic routes for fruits, suppliers, box sizes,
// street vendors, stock and ordinary order updates.
for (const resource of resources) {
  const base = `/api/${resource.path}`
  const { table, id, fields, viewRoles, editRoles } = resource

  // Display records.
  app.get(
    base,
    requireRole(...viewRoles),
    async (req, res) => {
      try {
        const [rows] = await pool.query(
          `SELECT * FROM \`${table}\` ORDER BY \`${id}\` DESC`
        )

        return res.json(rows)
      } catch (error) {
        return sendError(
          res,
          error,
          `Could not load ${resource.path}.`
        )
      }
    }
  )

  // Add records.
  app.post(
    base,
    requireRole(...editRoles),
    async (req, res) => {
      if (
        req.user.role === 'Sales' &&
        resource.path !== 'street-vendors'
      ) {
        return res.status(403).json({
          message:
            'Sales users may register vendors and create orders, but cannot add records here.',
        })
      }

      const providedFields = fields.filter(
        (field) => req.body[field] !== undefined
      )

      if (providedFields.length === 0) {
        return res.status(400).json({
          message: 'Please provide the information to save.',
        })
      }

      const values = providedFields.map((field) => req.body[field])

      try {
        const columns = providedFields
          .map((field) => `\`${field}\``)
          .join(', ')

        const placeholders = providedFields.map(() => '?').join(', ')

        const [result] = await pool.query(
          `INSERT INTO \`${table}\` (${columns})
           VALUES (${placeholders})`,
          values
        )

        return res.status(201).json({
          message: 'Record created successfully.',
          id: result.insertId,
        })
      } catch (error) {
        return sendError(
          res,
          error,
          `Could not create ${resource.path} record.`
        )
      }
    }
  )

  // Edit records.
  app.put(
    `${base}/:id`,
    requireRole(...editRoles),
    async (req, res) => {
      const recordId = Number(req.params.id)

      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({
          message: 'Invalid record ID.',
        })
      }

      if (req.user.role === 'Sales') {
        if (resource.path !== 'orders') {
          return res.status(403).json({
            message: 'Sales users cannot edit this resource.',
          })
        }

        const submittedFields = Object.keys(req.body)
        const invalidFields = submittedFields.filter(
          (field) => field !== 'status'
        )

        if (
          invalidFields.length > 0 ||
          !allowedOrderStatuses.includes(req.body.status)
        ) {
          return res.status(403).json({
            message:
              'Sales users may update only a valid order status.',
          })
        }
      }

      const providedFields = fields.filter(
        (field) => req.body[field] !== undefined
      )

      if (providedFields.length === 0) {
        return res.status(400).json({
          message: 'No valid fields were provided for updating.',
        })
      }

      if (
        resource.path === 'orders' &&
        req.body.status !== undefined &&
        !allowedOrderStatuses.includes(req.body.status)
      ) {
        return res.status(400).json({
          message: 'The selected order status is invalid.',
        })
      }

      const values = providedFields.map((field) => req.body[field])

      try {
        const setClause = providedFields
          .map((field) => `\`${field}\` = ?`)
          .join(', ')

        const [result] = await pool.query(
          `UPDATE \`${table}\`
           SET ${setClause}
           WHERE \`${id}\` = ?`,
          [...values, recordId]
        )

        if (result.affectedRows === 0) {
          const [existing] = await pool.query(
            `SELECT \`${id}\`
             FROM \`${table}\`
             WHERE \`${id}\` = ?`,
            [recordId]
          )

          if (existing.length === 0) {
            return res.status(404).json({
              message: 'Record not found.',
            })
          }
        }

        return res.json({
          message: 'Record updated successfully.',
        })
      } catch (error) {
        return sendError(
          res,
          error,
          `Could not update ${resource.path} record.`
        )
      }
    }
  )

  // Delete records.
  app.delete(
    `${base}/:id`,
    requireRole('Administrator', 'Manager'),
    async (req, res) => {
      const recordId = Number(req.params.id)

      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({
          message: 'Invalid record ID.',
        })
      }

      let connection
      let transactionStarted = false

      try {
        connection = await pool.getConnection()
        await connection.beginTransaction()
        transactionStarted = true

        const [records] = await connection.query(
          `SELECT \`${id}\`
           FROM \`${table}\`
           WHERE \`${id}\` = ?`,
          [recordId]
        )

        if (records.length === 0) {
          await connection.rollback()
          transactionStarted = false

          return res.status(404).json({
            message: 'Record not found.',
          })
        }

        if (resource.path === 'fruits') {
          await connection.query(
            'DELETE FROM stock WHERE fruit_id = ?',
            [recordId]
          )
        }

        const [result] = await connection.query(
          `DELETE FROM \`${table}\`
           WHERE \`${id}\` = ?`,
          [recordId]
        )

        if (result.affectedRows === 0) {
          await connection.rollback()
          transactionStarted = false

          return res.status(404).json({
            message: 'Record not found.',
          })
        }

        await connection.commit()
        transactionStarted = false

        return res.json({
          message:
            resource.path === 'fruits'
              ? 'Fruit permanently deleted successfully.'
              : 'Record deleted successfully.',
          id: recordId,
        })
      } catch (error) {
        if (connection && transactionStarted) {
          try {
            await connection.rollback()
          } catch (rollbackError) {
            console.error(
              'Could not roll back delete transaction:',
              rollbackError
            )
          }
        }

        console.error('DELETE FAILED:', {
          resource: resource.path,
          table,
          recordId,
          code: error.code,
          message: error.message,
        })

        if (
          error.code === 'ER_ROW_IS_REFERENCED_2' ||
          error.code === 'ER_ROW_IS_REFERENCED'
        ) {
          return res.status(409).json({
            message:
              'This record is still linked to other records and cannot be permanently deleted.',
          })
        }

        return res.status(500).json({
          message: 'Delete failed. Check the backend terminal for details.',
        })
      } finally {
        if (connection) {
          connection.release()
        }
      }
    }
  )
}

// Reports: Administrator and Manager only.
app.get(
  '/api/reports/summary',
  requireRole('Administrator', 'Manager'),
  async (req, res) => {
    try {
      const [
        [fruitRows],
        [supplierRows],
        [vendorRows],
        [stockRows],
        [orderRows],
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM fruits'),
        pool.query('SELECT COUNT(*) AS total FROM suppliers'),
        pool.query('SELECT COUNT(*) AS total FROM street_vendors'),
        pool.query(
          'SELECT COALESCE(SUM(quantity), 0) AS total FROM stock'
        ),
        pool.query('SELECT COUNT(*) AS total FROM orders'),
      ])

      return res.json({
        totalFruits: Number(fruitRows[0].total),
        totalSuppliers: Number(supplierRows[0].total),
        totalVendors: Number(vendorRows[0].total),
        totalStock: Number(stockRows[0].total),
        totalOrders: Number(orderRows[0].total),
      })
    } catch (error) {
      return sendError(res, error, 'Could not load report summary.')
    }
  }
)

// Handle invalid JSON and unexpected errors.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    'body' in error
  ) {
    return res.status(400).json({
      message: 'The request contains invalid JSON.',
    })
  }

  return sendError(res, error, 'An unexpected server error occurred.')
})

// Start the backend server and display demo login details.
app.listen(PORT, () => {
  console.log(
    `Batloung Fruits Distribution System API running on port ${PORT}`
  )

  console.log('')
  console.log('========================================')
  console.log(' BATLOUNG FRUITS - DEMO LOGIN DETAILS')
  console.log('========================================')

  console.log('')
  console.log('ADMINISTRATOR')
  console.log('Full Name: Malehasa Lipholo')
  console.log('Username: Hasy')
  console.log('Password: MALEHASA@LIPHOLO123')
  console.log('Role: Administrator')

  console.log('')
  console.log('SALES USER')
  console.log('Username: SalesUser')
  console.log('Password: Sales123!')
  console.log('Role: Sales')

  console.log('')
  console.log('========================================')
})