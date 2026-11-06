
const API_URL = 'http://localhost:5000/api'

function getToken() {
  return localStorage.getItem('token')
}

function getHeaders(includeJson = false) {
  const headers = {}

  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }

  const token = getToken()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

// Read a response safely
async function readResponse(response) {
  const responseText = await response.text()

  let result = {}

  if (responseText.trim()) {
    try {
      result = JSON.parse(responseText)
    } catch {
      if (responseText.trim().startsWith('<')) {
        throw new Error(
          `The backend returned an HTML page instead of JSON. ` +
          `HTTP status: ${response.status}. ` +
          `Check whether the API route exists and the URL is correct.`
        )
      }

      throw new Error(
        `The backend returned an invalid response. ` +
        `HTTP status: ${response.status}.`
      )
    }
  }

  if (!response.ok) {
    throw new Error(
      result.message || `Request failed. HTTP status: ${response.status}.`
    )
  }

  return result
}

// Login
export async function login(username, password) {
  let response

  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error(
      'Cannot connect to the backend. Make sure it is running.'
    )
  }

  const result = await readResponse(response)

  if (!result.token) {
    throw new Error('Login response did not contain an authentication token.')
  }

  localStorage.setItem('token', result.token)
  localStorage.setItem('user', JSON.stringify(result.user))

  return result
}

// Log out
export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Get the current user
export function getCurrentUser() {
  const savedUser = localStorage.getItem('user')

  if (!savedUser) {
    return null
  }

  try {
    return JSON.parse(savedUser)
  } catch {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    return null
  }
}

// Load records
export async function getData(resource) {
  const response = await fetch(`${API_URL}/${resource}`, {
    headers: getHeaders(),
  })

  return readResponse(response)
}

// Add a record
export async function addData(resource, data) {
  const response = await fetch(`${API_URL}/${resource}`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  })

  return readResponse(response)
}

// Update a record
export async function updateData(resource, id, data) {
  const response = await fetch(`${API_URL}/${resource}/${id}`, {
    method: 'PUT',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  })

  return readResponse(response)
}

// Delete a record
export async function deleteData(resource, id) {
  const response = await fetch(`${API_URL}/${resource}/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  return readResponse(response)
}

// Load the report summary
export async function getReport() {
  const response = await fetch(`${API_URL}/reports/summary`, {
    headers: getHeaders(),
  })

  return readResponse(response)
}

// Load orders with their items
export async function getOrdersWithItems() {
  const response = await fetch(`${API_URL}/orders/with-items`, {
    headers: getHeaders(),
  })

  return readResponse(response)
}

// Create an order with its first item
export async function addOrderWithItems(data) {
  const response = await fetch(`${API_URL}/orders/with-items`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(data),
  })

  return readResponse(response)
}
