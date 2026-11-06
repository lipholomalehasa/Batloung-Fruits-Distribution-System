
import { useState, useEffect } from 'react'
import './App.css'
import { getData, addData, updateData, deleteData } from './api'

const provinces = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [viewingSupplier, setViewingSupplier] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    province: '',
  })

  useEffect(() => {
    loadSuppliers()
  }, [])

  async function loadSuppliers() {
    try {
      const data = await getData('suppliers')

      setSuppliers(
        data.map((supplier) => ({
          id: supplier.supplier_id,
          name: supplier.supplier_name,
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || '',
          province: supplier.province || '',
        }))
      )

      setError('')
    } catch (error) {
      setError('Could not load suppliers. Please check the connection later.')
    }
  }

  function handleChange(event) {
    const { name, value } = event.target

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  function resetForm() {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      province: '',
    })

    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  function openAddModal() {
    resetForm()
    setShowForm(true)
  }

  function handleEdit(supplier) {
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      province: supplier.province,
    })

    setEditingId(supplier.id)
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setError('')

    const supplierData = {
      supplier_name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      province: formData.province,
    }

    if (
      !supplierData.supplier_name ||
      !supplierData.phone ||
      !supplierData.email ||
      !supplierData.address ||
      !supplierData.province
    ) {
      setError('Please fill in all supplier details.')
      return
    }

    setLoading(true)

    try {
      if (editingId !== null) {
        await updateData('suppliers', editingId, supplierData)
      } else {
        await addData('suppliers', supplierData)
      }

      await loadSuppliers()
      resetForm()
    } catch (error) {
      setError(error.message || 'Could not save the supplier.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this supplier?'
    )

    if (!confirmed || loading) return

    setError('')
    setLoading(true)

    try {
      await deleteData('suppliers', id)
      await loadSuppliers()

      if (editingId === id) {
        resetForm()
      }

      if (viewingSupplier?.id === id) {
        setViewingSupplier(null)
      }
    } catch (error) {
      setError(
        'Could not delete this supplier. It may be linked to existing stock.'
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter((supplier) => {
    const search = searchTerm.toLowerCase()

    return (
      String(supplier.id).toLowerCase().includes(search) ||
      supplier.name.toLowerCase().includes(search) ||
      supplier.phone.toLowerCase().includes(search) ||
      supplier.email.toLowerCase().includes(search) ||
      supplier.address.toLowerCase().includes(search) ||
      supplier.province.toLowerCase().includes(search)
    )
  })

  return (
    <div className="suppliers-page">
      <section className="suppliers-summary">
        <div>
          <p>Total Suppliers</p>
          <h2>{suppliers.length}</h2>
          <small>Registered fruit suppliers</small>
        </div>

        <div>
          <p>Search Results</p>
          <h2>{filteredSuppliers.length}</h2>
          <small>Suppliers matching your search</small>
        </div>
      </section>

      <section className="panel suppliers-panel">
        <div className="suppliers-toolbar">
          <div>
            <h3>Supplier Management</h3>
            <p>Register and manage fruit suppliers.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddModal}
            disabled={loading}
          >
            + Add Supplier
          </button>
        </div>

        <div className="suppliers-search">
          <input
            type="text"
            placeholder="Search by ID, name, phone, email or province..."
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

        {error && !showForm && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {showForm && (
          <div
            className="supplier-modal-overlay"
            onClick={(event) => {
              if (
                event.target === event.currentTarget &&
                !loading
              ) {
                resetForm()
              }
            }}
          >
            <div
              className="supplier-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-modal-title"
            >
              <div className="supplier-form-heading">
                <div>
                  <h3 id="supplier-modal-title">
                    {editingId !== null
                      ? 'Edit Supplier'
                      : 'Register New Supplier'}
                  </h3>
                  <p>Enter the supplier's information below.</p>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={resetForm}
                  disabled={loading}
                  aria-label="Close form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="supplier-form-grid">
                  <label>
                    Supplier Name
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter supplier name"
                      required
                    />
                  </label>

                  <label>
                    Phone Number
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      required
                    />
                  </label>

                  <label>
                    Email Address
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter email address"
                      required
                    />
                  </label>

                  <label>
                    Address
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Enter supplier address"
                      required
                    />
                  </label>

                  <label>
                    Province
                    <select
                      name="province"
                      value={formData.province}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Province</option>

                      {provinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
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
                    disabled={loading}
                  >
                    {loading
                      ? 'Please wait...'
                      : editingId !== null
                        ? 'Save Changes'
                        : 'Register Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewingSupplier && (
          <div
            className="supplier-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setViewingSupplier(null)
              }
            }}
          >
            <div
              className="supplier-modal supplier-details-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supplier-details-title"
            >
              <div className="supplier-form-heading">
                <div>
                  <h3 id="supplier-details-title">Supplier Details</h3>
                  <p>View the registered supplier information.</p>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={() => setViewingSupplier(null)}
                  aria-label="Close supplier details"
                >
                  ×
                </button>
              </div>

              <div className="supplier-form-grid">
                <div>
                  <strong>Supplier ID</strong>
                  <p>
                    SUP{String(viewingSupplier.id).padStart(3, '0')}
                  </p>
                </div>

                <div>
                  <strong>Supplier Name</strong>
                  <p>{viewingSupplier.name}</p>
                </div>

                <div>
                  <strong>Phone Number</strong>
                  <p>{viewingSupplier.phone || 'Not provided'}</p>
                </div>

                <div>
                  <strong>Email Address</strong>
                  <p>{viewingSupplier.email || 'Not provided'}</p>
                </div>

                <div>
                  <strong>Address</strong>
                  <p>{viewingSupplier.address || 'Not provided'}</p>
                </div>

                <div>
                  <strong>Province</strong>
                  <p>{viewingSupplier.province || 'Not provided'}</p>
                </div>
              </div>

              <div className="supplier-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setViewingSupplier(null)}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const supplier = viewingSupplier
                    setViewingSupplier(null)
                    handleEdit(supplier)
                  }}
                >
                  Edit Supplier
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="suppliers-table-wrapper">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Supplier ID</th>
                <th>Supplier Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Province</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      SUP{String(supplier.id).padStart(3, '0')}
                    </td>
                    <td>{supplier.name}</td>
                    <td>{supplier.phone}</td>
                    <td>{supplier.email}</td>
                    <td>{supplier.address}</td>
                    <td>{supplier.province}</td>

                    <td>
                      <div className="supplier-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setViewingSupplier(supplier)}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(supplier)}
                          disabled={loading}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => handleDelete(supplier.id)}
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
                    {searchTerm
                      ? 'No suppliers match your search.'
                      : 'No suppliers registered yet. Click Add Supplier to begin.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="suppliers-table-footer">
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
        </div>
      </section>
    </div>
  )
}

export default Suppliers
