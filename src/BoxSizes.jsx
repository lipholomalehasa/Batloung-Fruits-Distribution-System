
import { useState, useEffect } from 'react'
import { getData, addData, updateData, deleteData } from './api'

function BoxSizes() {
  const [boxSizes, setBoxSizes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [price, setPrice] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [viewingSize, setViewingSize] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadBoxSizes()
  }, [])

  async function loadBoxSizes() {
    try {
      const data = await getData('box-sizes')

      setBoxSizes(
        data.map((size) => ({
          id: size.box_size_id,
          name: size.size_name,
          capacity: String(size.capacity_kg),
          price: String(size.price ?? 0),
          status: size.status || 'Active',
        }))
      )

      setError('')
    } catch (error) {
      setError('Could not load box sizes. Please check the connection later.')
    }
  }

  const filteredSizes = boxSizes.filter((size) =>
    size.name.toLowerCase().includes(search.toLowerCase())
  )

  function openAddForm() {
    setName('')
    setCapacity('')
    setPrice('')
    setEditingId(null)
    setViewingSize(null)
    setError('')
    setShowForm(true)
  }

  function openEditForm(size) {
    setName(size.name)
    setCapacity(size.capacity)
    setPrice(size.price)
    setEditingId(size.id)
    setViewingSize(null)
    setError('')
    setShowForm(true)
  }

  async function saveBoxSize(event) {
    event.preventDefault()
    setError('')

    const sizeName = name.trim()
    const capacityNumber = Number(capacity)
    const priceNumber = Number(price)

    if (
      !sizeName ||
      !capacity.trim() ||
      !Number.isFinite(capacityNumber) ||
      capacityNumber <= 0
    ) {
      setError('Enter a box size and a capacity greater than zero.')
      return
    }

    if (
      !price.trim() ||
      !Number.isFinite(priceNumber) ||
      priceNumber < 0
    ) {
      setError('Enter a valid price of zero or more.')
      return
    }

    const duplicate = boxSizes.some(
      (size) =>
        size.name.toLowerCase() === sizeName.toLowerCase() &&
        size.id !== editingId
    )

    if (duplicate) {
      setError('This box size already exists.')
      return
    }

    try {
      const data = {
        size_name: sizeName,
        capacity_kg: capacityNumber,
        price: priceNumber,
      }

      if (editingId !== null) {
        await updateData('box-sizes', editingId, data)
      } else {
        await addData('box-sizes', {
          ...data,
          status: 'Active',
        })
      }

      await loadBoxSizes()

      setShowForm(false)
      setName('')
      setCapacity('')
      setPrice('')
      setEditingId(null)
      setError('')
    } catch (error) {
      setError(error.message || 'Could not save the box size.')
    }
  }

  async function handleDelete(size) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the box size "${size.name}"?`
    )

    if (!confirmed) return

    setError('')

    try {
      await deleteData('box-sizes', size.id)

      setBoxSizes((previousSizes) =>
        previousSizes.filter((item) => item.id !== size.id)
      )

      if (viewingSize?.id === size.id) {
        setViewingSize(null)
      }

      if (editingId === size.id) {
        setShowForm(false)
        setEditingId(null)
      }

      setError('')
    } catch (error) {
      setError(
        error.message ||
          'Could not delete this box size. It may be used by existing stock or orders.'
      )
    }
  }

  function formatPrice(value) {
    return Number(value).toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="fruits-page">
      <div className="page-heading">
        <div>
          <h1>Box Sizes</h1>
          <p>Manage the box sizes used for fruit products.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openAddForm}
        >
          Add Box Size
        </button>
      </div>

      <div className="fruit-toolbar">
        <input
          type="text"
          placeholder="Search box sizes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Box Size</th>
              <th>Capacity</th>
              <th>Price (M)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredSizes.map((size) => (
              <tr key={size.id}>
                <td>{size.name}</td>
                <td>{size.capacity} kg</td>
                <td>{formatPrice(size.price)}</td>

                <td>
                  <span
                    className={`status-badge ${
                      size.status === 'Active'
                        ? 'status-active'
                        : 'status-inactive'
                    }`}
                  >
                    {size.status}
                  </span>
                </td>

                <td>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setViewingSize(size)
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
                      onClick={() => openEditForm(size)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => handleDelete(size)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredSizes.length === 0 && (
              <tr>
                <td colSpan="5">No box sizes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>
              {editingId !== null ? 'Edit Box Size' : 'Add Box Size'}
            </h2>

            <form onSubmit={saveBoxSize} className="fruit-form">
              <label htmlFor="boxName">Box Size</label>
              <input
                id="boxName"
                type="text"
                placeholder="e.g. Small"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />

              <label htmlFor="boxCapacity">Capacity in kg</label>
              <input
                id="boxCapacity"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 5"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                required
              />

              <label htmlFor="boxPrice">Price in maloti (M)</label>
              <input
                id="boxPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 8.00"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />

              {error && <p className="form-error">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setError('')
                  }}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  {editingId !== null ? 'Save Changes' : 'Save Box Size'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingSize && (
        <div
          className="modal-overlay box-size-view-overlay"
          onClick={() => setViewingSize(null)}
        >
          <div
            className="modal box-size-view-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="box-size-view-header">
              <div>
                <h2>Box Size Details</h2>
                <p>View the information for this box size.</p>
              </div>

              <button
                type="button"
                className="box-size-close-icon"
                onClick={() => setViewingSize(null)}
                aria-label="Close box size details"
              >
                ×
              </button>
            </div>

            <div className="box-size-view-content">
              <div className="box-size-name-card">
                <div className="box-size-name-icon">B</div>

                <div>
                  <span className="box-size-detail-label">Box Size</span>
                  <h3>{viewingSize.name}</h3>
                </div>
              </div>

              <div className="box-size-info-grid">
                <div className="box-size-info-card">
                  <span className="box-size-detail-label">Capacity</span>
                  <h3>{viewingSize.capacity} kg</h3>
                </div>

                <div className="box-size-info-card">
                  <span className="box-size-detail-label">Price</span>
                  <h3>M{formatPrice(viewingSize.price)}</h3>
                </div>
              </div>

              <div className="box-size-status-row">
                <span className="box-size-detail-label">Status</span>

                <span
                  className={`status-badge ${
                    viewingSize.status === 'Active'
                      ? 'status-active'
                      : 'status-inactive'
                  }`}
                >
                  {viewingSize.status}
                </span>
              </div>
            </div>

            <div className="box-size-view-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setViewingSize(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="edit-button"
                onClick={() => openEditForm(viewingSize)}
              >
                Edit Box Size
              </button>

              <button
                type="button"
                className="delete-button"
                onClick={() => handleDelete(viewingSize)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BoxSizes
