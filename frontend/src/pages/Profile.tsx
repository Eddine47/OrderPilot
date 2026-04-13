import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

export default function Profile() {
  const { user, setUser } = useAuth();

  const [name, setName]                   = useState(user?.name ?? '');
  const [email, setEmail]                 = useState(user?.email ?? '');
  const [companyName, setCompanyName]     = useState(user?.company_name ?? '');
  const [companyAddress, setCompanyAddress] = useState(user?.company_address ?? '');
  const [companySiret, setCompanySiret]   = useState(user?.company_siret ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  const emailChanged    = email !== user?.email;
  const passwordChanged = newPassword.length > 0;
  const needsCurrentPwd = emailChanged || passwordChanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (passwordChanged && newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (passwordChanged && newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (needsCurrentPwd && !currentPassword) {
      setError('Veuillez saisir votre mot de passe actuel pour modifier l\'email ou le mot de passe.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name,
        company_name:    companyName,
        company_address: companyAddress,
        company_siret:   companySiret,
      };
      if (emailChanged)    payload.email            = email;
      if (needsCurrentPwd) payload.current_password = currentPassword;
      if (passwordChanged) payload.new_password     = newPassword;

      const res = await authApi.updateMe(payload);
      setUser(res.data);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Profil mis à jour avec succès.');
    } catch (err: any) {
      const msg = err?.response?.data?.error
        || err?.response?.data?.errors?.[0]?.msg
        || 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Informations personnelles */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Informations personnelles</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Informations société */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Informations société</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la société</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={companySiret}
              onChange={(e) => setCompanySiret(e.target.value)}
            />
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">Changer le mot de passe</h2>
          <p className="text-xs text-gray-500">Laissez vide si vous ne souhaitez pas changer de mot de passe.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Mot de passe actuel (si email ou mdp changé) */}
        {needsCurrentPwd && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-amber-800 font-medium">
              Confirmez votre identité pour enregistrer les modifications
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
              <input
                type="password"
                className="w-full border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>
        )}

        {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  );
}
