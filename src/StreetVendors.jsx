
import { useState, useEffect } from 'react'
import './App.css'
import { getData, addData, updateData } from './api'

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function StreetVendors() {
  const [vendors, setVendors] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewingVendor, setViewingVendor] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    phone: '',
    location: '',
    registrationDate: getTodayDate(),
  })

  useEffect(() => {
    loadVendors()
  }, [])

  async function loadVendors() {
    try {
      const data = await getData('street-vendors')

      setVendors(
        data.map((vendor) => ({
          id: vendor.vendor_id,
          name: vendor.vendor_name,
          businessName: vendor.business_name || '',
          phone: vendor.phone || '',
          location: vendor.address || '',
          registrationDate: vendor.registration_date
            ? String(vendor.registration_date).slice(0, 10)
            : '',
          status: vendor.status || 'Active',
        }))
      )

      setError('')
    } catch (error) {
      setError('Could not load vendors. Please check the connection later.')
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
      name: '',
      businessName: '',
      phone: '',
      location: '',
      registrationDate: getTodayDate(),
    })

    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  function openAddModal() {
    setViewingVendor(null)
    resetForm()
    setShowForm(true)
  }

  function handleEdit(vendor) {
    setViewingVendor(null)

    setFormData({
      name: vendor.name,
      businessName: vendor.businessName,
      phone: vendor.phone,
      location: vendor.location,
      registrationDate: vendor.registrationDate || getTodayDate(),
    })

    setEditingId(vendor.id)
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setError('')

    const vendorData = {
      vendor_name: formData.name.trim(),
      business_name: formData.businessName.trim(),
      phone: formData.phone.trim(),
      address: formData.location.trim(),
      registration_date: formData.registrationDate,
    }

    if (
      !vendorData.vendor_name ||
      !vendorData.business_name ||
      !vendorData.phone ||
      !vendorData.address ||
      !vendorData.registration_date
    ) {
      setError('Please fill in all vendor details.')
      return
    }

    setLoading(true)

    try {
      if (editingId !== null) {
        await updateData('street-vendors', editingId, vendorData)
      } else {
        await addData('street-vendors', {
          ...vendorData,
          status: 'Active',
        })
      }

      await loadVendors()
      resetForm()
    } catch (error) {
      setError(error.message || 'Could not save the vendor.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate this vendor?'
    )

    if (!confirmed || loading) return

    setError('')
    setLoading(true)

    try {
      await updateData('street-vendors', id, {
        status: 'Inactive',
      })

      await loadVendors()

      if (editingId === id) {
        resetForm()
      }

      if (viewingVendor?.id === id) {
        setViewingVendor(null)
      }
    } catch (error) {
      setError('Could not deactivate this vendor.')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate(vendor) {
    if (loading) return

    setError('')
    setLoading(true)

    try {
      await updateData('street-vendors', vendor.id, {
        status: 'Active',
      })

      await loadVendors()

      if (viewingVendor?.id === vendor.id) {
        setViewingVendor({
          ...viewingVendor,
          status: 'Active',
        })
      }
    } catch (error) {
      setError('Could not activate this vendor.')
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = vendors.filter((vendor) => {
    const search = searchTerm.toLowerCase()

    return (
      String(vendor.id).toLowerCase().includes(search) ||
      vendor.name.toLowerCase().includes(search) ||
      vendor.businessName.toLowerCase().includes(search) ||
      vendor.phone.toLowerCase().includes(search) ||
      vendor.location.toLowerCase().includes(search) ||
      vendor.registrationDate.toLowerCase().includes(search)
    )
  })

  return (
    <div className="suppliers-page">
      <section className="suppliers-summary">
        <div>
          <p>Total Vendors</p>
          <h2>{vendors.length}</h2>
          <small>Registered street vendors</small>
        </div>

        <div>
          <p>Search Results</p>
          <h2>{filteredVendors.length}</h2>
          <small>Vendors matching your search</small>
        </div>
      </section>

      <section className="panel suppliers-panel">
        <div className="suppliers-toolbar">
          <div>
            <h3>Street Vendor Management</h3>
            <p>Register and manage street vendors.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openAddModal}
            disabled={loading}
          >
            + Add Vendor
          </button>
        </div>

        <div className="suppliers-search">
          <input
            type="text"
            placeholder="Search by ID, name, business, phone or location..."
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

        {error && !showForm && !viewingVendor && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {showForm && (
          <div
            className="vendor-modal-overlay"
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
              className="vendor-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="vendor-modal-title"
            >
              <div className="supplier-form-heading">
                <div>
                  <h3 id="vendor-modal-title">
                    {editingId !== null
                      ? 'Edit Vendor'
                      : 'Register New Vendor'}
                  </h3>

                  <p>Enter the street vendor's information below.</p>
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
                    Vendor Name
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter vendor name"
                      required
                    />
                  </label>

                  <label>
                    Business Name
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder="Enter business name"
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
                    Selling Location
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Enter selling location"
                      required
                    />
                  </label>

                  <label>
                    Registration Date
                    <input
                      type="date"
                      name="registrationDate"
                      value={formData.registrationDate}
                      onChange={handleChange}
                      required
                    />
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
                        : 'Register Vendor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="suppliers-table-wrapper">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Vendor ID</th>
                <th>Vendor Name</th>
                <th>Business Name</th>
                <th>Phone</th>
                <th>Selling Location</th>
                <th>Registration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredVendors.length > 0 ? (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>VEN{String(vendor.id).padStart(3, '0')}</td>
                    <td>{vendor.name}</td>
                    <td>{vendor.businessName}</td>
                    <td>{vendor.phone}</td>
                    <td>{vendor.location}</td>
                    <td>{vendor.registrationDate}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          vendor.status === 'Active'
                            ? 'status-active'
                            : 'status-inactive'
                        }`}
                      >
                        {vendor.status}
                      </span>
                    </td>

                    <td>
                      <div className="supplier-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setViewingVendor(vendor)
                            setShowForm(false)
                            setEditingId(null)
                            setError('')
                          }}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => handleEdit(vendor)}
                          disabled={loading}
                        >
                          Edit
                        </button>

                        {vendor.status === 'Active' ? (
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => handleDelete(vendor.id)}
                            disabled={loading}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="edit-button"
                            onClick={() => handleActivate(vendor)}
                            disabled={loading}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="supplier-empty-cell">
                    {searchTerm
                      ? 'No vendors match your search.'
                      : 'No vendors registered yet. Click Add Vendor to begin.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="suppliers-table-footer">
          Showing {filteredVendors.length} of {vendors.length} vendors
        </div>

        {error && !showForm && viewingVendor && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {viewingVendor && (
        <div
          className="vendor-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setViewingVendor(null)
            }
          }}
        >
          <div
            className="vendor-modal vendor-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-details-title"
          >
            <div className="supplier-form-heading">
              <div>
                <h3 id="vendor-details-title">Street Vendor Details</h3>
                <p>Registered vendor information.</p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setViewingVendor(null)}
                aria-label="Close vendor details"
              >
                ×
              </button>
            </div>

            <div className="vendor-details">
              <p>
                <strong>Vendor ID:</strong>{' '}
                VEN{String(viewingVendor.id).padStart(3, '0')}
              </p>

              <p>
                <strong>Vendor Name:</strong> {viewingVendor.name}
              </p>

              <p>
                <strong>Business Name:</strong>{' '}
                {viewingVendor.businessName || 'Not provided'}
              </p>

              <p>
                <strong>Phone Number:</strong>{' '}
                {viewingVendor.phone || 'Not provided'}
              </p>

              <p>
                <strong>Selling Location:</strong>{' '}
                {viewingVendor.location || 'Not provided'}
              </p>

              <p>
                <strong>Registration Date:</strong>{' '}
                {viewingVendor.registrationDate || 'Not provided'}
              </p>

              <p>
                <strong>Status:</strong>{' '}
                <span
                  className={`status-badge ${
                    viewingVendor.status === 'Active'
                      ? 'status-active'
                      : 'status-inactive'
                  }`}
                >
                  {viewingVendor.status}
                </span>
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setViewingVendor(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => handleEdit(viewingVendor)}
                disabled={loading}
              >
                Edit Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StreetVendors
