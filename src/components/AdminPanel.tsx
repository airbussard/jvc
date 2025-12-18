'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function AdminPanel() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Profile['role']>('normal')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setUsers(data)
    }
    setLoading(false)
  }

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

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      <div className="glass-card-solid overflow-hidden">
        <div className="section-header">
          <h3 className="text-lg font-semibold text-primary-900">
            Neuen Benutzer einladen
          </h3>
        </div>
        <div className="p-6">
          {message && (
            <div className={`mb-5 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-secondary-50 border border-secondary-200 text-secondary-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

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
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Profile['role'])}
                  className="glass-select-solid w-full"
                >
                  <option value="normal">Normal</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Administrator</option>
                </select>
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
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Profile['role'])}
                        className="glass-select-solid w-full text-sm"
                      >
                        <option value="normal">Normal</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Administrator</option>
                      </select>
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
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as Profile['role'])}
                            className="glass-select-solid text-sm py-2"
                          >
                            <option value="normal">Normal</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Administrator</option>
                          </select>
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
