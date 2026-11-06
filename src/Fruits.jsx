import { useState, useEffect } from 'react'
import { getData, addData, updateData, deleteData } from './api'

function Fruits() {
  const [fruits, setFruits] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [viewingFruit, setViewingFruit] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [fruitName, setFruitName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const allowedFruits = [
    'Apples',
    'Bananas',
    'Oranges',
    'Mangoes',
    'Grapes',
  ]

  useEffect(() => {
    loadFruits()
  }, [])

  async function loadFruits() {
    try {
      setError('')

      const data = await getData('fruits')

      if (!Array.isArray(data)) {
        throw new Error('The server returned an invalid fruit list.')
      }

      setFruits(
        data.map((fruit) => ({
          id: fruit.fruit_id,
          name: fruit.fruit_name,
          description: fruit.description || '',
          status: fruit.status || 'Active',
        }))
      )
    } catch (error) {
      setError(
        error.message ||
          'Could not load fruits. Please check the connection.'
      )
    }
  }

  const filteredFruits = fruits.filter((fruit) => {
    const matchesSearch = fruit.name
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'All' || fruit.status === statusFilter

    return matchesSearch && matchesStatus
  })

  function openAddForm() {
    setEditingId(null)
    setFruitName('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(fruit) {
    setEditingId(fruit.id)
    setFruitName(fruit.name)
    setError('')
    setShowForm(true)
  }

  async function saveFruit(event) {
    event.preventDefault()

    if (loading) return

    const name = fruitName.trim()

    if (!name) {
      setError('Please select a fruit name.')
      return
    }

    const matchingFruit = allowedFruits.find(
      (fruit) => fruit.toLowerCase() === name.toLowerCase()
    )

    if (!matchingFruit) {
      setError('Please select one of the five approved fruits.')
      return
    }

    const duplicate = fruits.some((fruit) => {
      const sameName =
        fruit.name.trim().toLowerCase() ===
        matchingFruit.toLowerCase()

      const sameRecord =
        editingId !== null &&
        String(fruit.id) === String(editingId)

      return sameName && !sameRecord
    })

    if (duplicate) {
      setError(
        `${matchingFruit} already exists in the database. Delete the old record first if you want to add it again.`
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      if (editingId !== null) {
        await updateData('fruits', editingId, {
          fruit_name: matchingFruit,
        })
      } else {
        await addData('fruits', {
          fruit_name: matchingFruit,
          description: '',
          status: 'Active',
        })
      }

      await loadFruits()

      setShowForm(false)
      setFruitName('')
      setEditingId(null)
      setError('')
    } catch (error) {
      setError(
        error.message || 'Could not save the fruit. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function deleteFruit(fruit) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${fruit.name}?`
    )

    if (!confirmed || loading) return

    setLoading(true)
    setError('')

    try {
      await deleteData('fruits', fruit.id)

      setFruits((currentFruits) =>
        currentFruits.filter(
          (item) => String(item.id) !== String(fruit.id)
        )
      )

      if (viewingFruit?.id === fruit.id) {
        setViewingFruit(null)
      }

      await loadFruits()
    } catch (error) {
      setError(
        error.message ||
          `Could not delete ${fruit.name}. Check whether it is linked to stock or orders.`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="fruits-page">
      <div className="fruit-toolbar">
        <input
          type="text"
          placeholder="Search fruits..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <button
          className="primary-button"
          onClick={openAddForm}
          disabled={loading}
        >
          Add Fruit
        </button>
      </div>

      {error && !showForm && (
        <p className="form-error">{error}</p>
      )}

      <div className="panel fruit-table-panel">
        <div className="panel-heading">
          <div>
            <h3>Fruit Management</h3>
            <p>Manage the five approved fruit types.</p>
          </div>

          <span className="fruit-count">
            {filteredFruits.length} fruits
          </span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fruit Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredFruits.map((fruit) => (
                <tr key={fruit.id}>
                  <td>
                    FR{String(fruit.id).padStart(3, '0')}
                  </td>

                  <td>{fruit.name}</td>

                  <td>
                    <span
                      className={`status-badge ${
                        fruit.status === 'Active'
                          ? 'status-active'
                          : 'status-inactive'
                      }`}
                    >
                      {fruit.status}
                    </span>
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setViewingFruit(fruit)}
                      >
                        View
                      </button>

                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => openEditForm(fruit)}
                        disabled={loading}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="deactivate-button"
                        onClick={() => deleteFruit(fruit)}
                        disabled={loading}
                      >
                        {loading ? 'Please wait...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredFruits.length === 0 && (
                <tr>
                  <td colSpan="4" className="no-results">
                    No fruits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingFruit && (
        <div className="modal-overlay">
          <div className="fruit-form">
            <h2>Fruit Details</h2>

            <div className="fruit-details">
              <p>
                <strong>Fruit ID:</strong>{' '}
                FR{String(viewingFruit.id).padStart(3, '0')}
              </p>

              <p>
                <strong>Fruit Name:</strong> {viewingFruit.name}
              </p>

              <p>
                <strong>Description:</strong>{' '}
                {viewingFruit.description || 'No description provided'}
              </p>

              <p>
                <strong>Status:</strong> {viewingFruit.status}
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setViewingFruit(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const fruit = viewingFruit
                  setViewingFruit(null)
                  openEditForm(fruit)
                }}
                disabled={loading}
              >
                Edit Fruit
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <form className="fruit-form" onSubmit={saveFruit}>
            <h2>
              {editingId !== null ? 'Edit Fruit' : 'Add Fruit'}
            </h2>

            <p>Select one of the five approved fruit types.</p>

            <label htmlFor="fruitName">Fruit Name</label>

            <select
              id="fruitName"
              value={fruitName}
              onChange={(event) => {
                setFruitName(event.target.value)
                setError('')
              }}
              required
              disabled={loading}
            >
              <option value="">Select a fruit</option>

              {allowedFruits.map((fruit) => (
                <option key={fruit} value={fruit}>
                  {fruit}
                </option>
              ))}
            </select>

            {error && <p className="form-error">{error}</p>}

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Fruit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default Fruits