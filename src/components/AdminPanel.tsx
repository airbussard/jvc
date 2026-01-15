'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { GlassSelect } from './GlassSelect'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Airline = Database['public']['Tables']['airlines']['Row']

const roleOptions = [
  { value: 'normal' as const, label: 'Normal' },
  { value: 'moderator' as const, label: 'Moderator' },
  { value: 'admin' as const, label: 'Administrator' },
]

export default function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([])
  const [airlines, setAirlines] = useState<Airline[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Profile['role']>('normal')
  const [inviting, setInviting] = useState(false)
  const [newAirlineName, setNewAirlineName] = useState('')
  const [addingAirline, setAddingAirline] = useState(false)
  const [editingAirline, setEditingAirline] = useState<string | null>(null)
  const [editAirlineName, setEditAirlineName] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadUsers(), loadAirlines()])
    setLoading(false)
  }

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setUsers(data as Profile[])
    }
  }

  const loadAirlines = async () => {
    const { data, error } = await supabase
      .from('airlines')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setAirlines(data as Airline[])
    }
  }

  const airlineOptions = useMemo(() => [
    { value: '', label: 'Keine Airline' },
    ...airlines.map(a => ({ value: a.id, label: a.name }))
  ], [airlines])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Einladung erfolgreich versendet!' })
        setInviteEmail('')
        setInviteName('')
        setInviteRole('normal')
        loadUsers()
      } else {
        setMessage({ type: 'error', text: result.error || 'Fehler beim Versenden der Einladung' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Versenden der Einladung' })
    }

    setInviting(false)
  }

  const handleRoleChange = async (userId: string, newRole: Profile['role']) => {
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      loadUsers()
      setMessage({ type: 'success', text: 'Rolle erfolgreich geändert!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Ändern der Rolle' })
    }
  }

  const handleAirlineChange = async (userId: string, airlineId: string) => {
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ airline_id: airlineId || null })
      .eq('id', userId)

    if (!error) {
      loadUsers()
      setMessage({ type: 'success', text: 'Airline erfolgreich zugewiesen!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Zuweisen der Airline' })
    }
  }

  const handleAddAirline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAirlineName.trim()) return

    setAddingAirline(true)
    const { error } = await (supabase as any)
      .from('airlines')
      .insert({ name: newAirlineName.trim() })

    if (!error) {
      setNewAirlineName('')
      loadAirlines()
      setMessage({ type: 'success', text: 'Airline erfolgreich hinzugefügt!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Hinzufügen der Airline' })
    }
    setAddingAirline(false)
  }

  const handleDeleteAirline = async (airlineId: string) => {
    if (!confirm('Möchtest du diese Airline wirklich löschen?')) return

    const { error } = await (supabase as any)
      .from('airlines')
      .delete()
      .eq('id', airlineId)

    if (!error) {
      loadAirlines()
      loadUsers() // Refresh users as their airline_id might be nullified
      setMessage({ type: 'success', text: 'Airline erfolgreich gelöscht!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Löschen der Airline' })
    }
  }

  const startEditAirline = (airline: Airline) => {
    setEditingAirline(airline.id)
    setEditAirlineName(airline.name)
  }

  const cancelEditAirline = () => {
    setEditingAirline(null)
    setEditAirlineName('')
  }

  const handleUpdateAirline = async (airlineId: string) => {
    if (!editAirlineName.trim()) return

    const { error } = await (supabase as any)
      .from('airlines')
      .update({ name: editAirlineName.trim() })
      .eq('id', airlineId)

    if (!error) {
      loadAirlines()
      setEditingAirline(null)
      setEditAirlineName('')
      setMessage({ type: 'success', text: 'Airline erfolgreich aktualisiert!' })
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren der Airline' })
    }
  }

  const getAirlineName = (airlineId: string | null) => {
    if (!airlineId) return '-'
    const airline = airlines.find(a => a.id === airlineId)
    return airline?.name || '-'
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${
          message.type === 'success'
            ? 'bg-secondary-50 border border-secondary-200 text-secondary-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Airlines Section */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Airlines verwalten
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleAddAirline} className="flex gap-3 mb-4">
            <input
              type="text"
              value={newAirlineName}
              onChange={(e) => setNewAirlineName(e.target.value)}
              placeholder="Airline-Name eingeben..."
              className="glass-input-solid flex-1"
            />
            <button
              type="submit"
              disabled={addingAirline || !newAirlineName.trim()}
              className="glass-button-primary whitespace-nowrap"
            >
              {addingAirline ? 'Füge hinzu...' : 'Hinzufügen'}
            </button>
          </form>

          {airlines.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Keine Airlines vorhanden</p>
          ) : (
            <div className="space-y-2">
              {airlines.map((airline) => (
                <div
                  key={airline.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100"
                >
                  {editingAirline === airline.id ? (
                    <>
                      <input
                        type="text"
                        value={editAirlineName}
                        onChange={(e) => setEditAirlineName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateAirline(airline.id)
                          if (e.key === 'Escape') cancelEditAirline()
                        }}
                        className="glass-input-solid flex-1 mr-3"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateAirline(airline.id)}
                          className="text-secondary-600 hover:text-secondary-700 text-sm font-medium transition-colors"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={cancelEditAirline}
                          className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{airline.name}</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEditAirline(airline)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDeleteAirline(airline.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite Section */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Neuen Benutzer einladen
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">E-Mail-Adresse</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="glass-input-solid w-full"
                  placeholder="email@beispiel.de"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  className="glass-input-solid w-full"
                  placeholder="Vollständiger Name"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rolle</label>
                <GlassSelect
                  value={inviteRole}
                  onChange={(value) => setInviteRole(value)}
                  options={roleOptions}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="glass-button-primary w-full sm:w-auto"
            >
              {inviting ? 'Sende Einladung...' : 'Einladung senden'}
            </button>
          </form>
        </div>
      </div>

      {/* Users List */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Benutzerverwaltung
          </h3>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-gray-500 text-center py-4">Lade Benutzer...</p>
          ) : (
            <>
              {/* Mobile view: Cards */}
              <div className="sm:hidden space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium">Name</span>
                      <p className="font-medium text-gray-900">{user.full_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium">E-Mail</span>
                      <p className="text-sm text-gray-600 break-all">{user.id}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium block mb-2">Rolle</span>
                      <GlassSelect
                        value={user.role}
                        onChange={(value) => handleRoleChange(user.id, value)}
                        options={roleOptions}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium block mb-2">Airline</span>
                      <GlassSelect
                        value={user.airline_id || ''}
                        onChange={(value) => handleAirlineChange(user.id, value)}
                        options={airlineOptions}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-medium">Erstellt am</span>
                      <p className="text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop view: Table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Rolle
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Airline
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Erstellt am
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.full_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {user.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <GlassSelect
                            value={user.role}
                            onChange={(value) => handleRoleChange(user.id, value)}
                            options={roleOptions}
                            className="min-w-[140px]"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <GlassSelect
                            value={user.airline_id || ''}
                            onChange={(value) => handleAirlineChange(user.id, value)}
                            options={airlineOptions}
                            className="min-w-[160px]"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('de-DE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
