import React, { useState } from 'react';
import {
  X,
  Cloud,
  Download,
  Upload,
  LogOut,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Globe,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserLibraryEntry } from '../types/media';
import {
  exportLibraryToJson,
  parseAndValidateLibraryImport,
} from '../utils/trackingLogic';

interface AccountSyncModalProps {
  user: User | null;
  libraryMap: Record<string, UserLibraryEntry>;
  cloudSyncState: 'local' | 'synced' | 'syncing' | 'error';
  onClose: () => void;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onImportLibrary: (imported: Record<string, UserLibraryEntry>) => Promise<void>;
}

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({
  user,
  libraryMap,
  onClose,
  onSignInGoogle,
  onSignOut,
  onImportLibrary,
}) => {
  const [importText, setImportText] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [authBusy, setAuthBusy] = useState<boolean>(false);

  const handleDownloadJson = () => {
    const json = exportLibraryToJson(libraryMap);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-bibliotheque-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'success',
      message: 'Export JSON généré et téléchargé avec succès.',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = String(ev.target?.result || '');
      setImportText(content);
      try {
        const res = parseAndValidateLibraryImport(content, user?.uid || 'local-user');
        await onImportLibrary(res.entries);
        setFeedback({
          type: 'success',
          message: `${res.importedCount} œuvres importées et synchronisées dans votre bibliothèque.`,
        });
      } catch (err) {
        setFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Erreur lors de la lecture du fichier JSON.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromTextarea = async () => {
    if (!importText.trim()) {
      setFeedback({
        type: 'error',
        message: 'Veuillez coller un contenu JSON valide avant d’importer.',
      });
      return;
    }
    try {
      const res = parseAndValidateLibraryImport(importText, user?.uid || 'local-user');
      await onImportLibrary(res.entries);
      setFeedback({
        type: 'success',
        message: `${res.importedCount} œuvres importées avec succès.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Format JSON invalide.',
      });
    }
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    setFeedback(null);
    try {
      await onSignInGoogle();
      setFeedback({
        type: 'success',
        message: 'Connexion Google réussie. Synchronisation Firestore activée.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `Connexion interrompue : ${err.message}`
            : 'Impossible de finaliser la connexion Google.',
      });
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0c0e16] border border-white/10 p-6 sm:p-8 space-y-6 my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 id="account-modal-title" className="font-display text-xl font-bold text-white">
              Compte, Synchronisation Cloud & Sauvegarde
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Synchronisation multi-appareils via Firebase Firestore, sauvegarde JSON et déploiement GitHub Pages
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les paramètres de compte"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300 hover:bg-white hover:text-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Section 1 : Authentification Firebase & Synchronisation */}
        <section className="rounded-xl bg-[#111420] border border-white/[0.07] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white">
                {user ? (
                  <Cloud className="h-5 w-5 text-emerald-400" />
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {user
                    ? user.displayName || user.email || 'Compte connecté'
                    : 'Mode local persistant (Navigateur)'}
                </p>
                <p className="text-xs text-zinc-400">
                  {user
                    ? `Synchronisé avec Firestore (${user.email}) · Isolation stricte par UID`
                    : 'Vos données sont sauvegardées localement. Connectez-vous pour synchroniser vos appareils.'}
                </p>
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-rose-500/20 text-xs font-semibold text-zinc-200 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Se déconnecter</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={authBusy}
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <span>{authBusy ? 'Connexion...' : 'Se connecter avec Google'}</span>
              </button>
            )}
          </div>
        </section>

        {/* Section 2 : Export / Import JSON */}
        <section className="rounded-xl bg-[#111420] border border-white/[0.07] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Sauvegarde & Portabilité JSON ({Object.keys(libraryMap).length} œuvres suivies)
              </h3>
              <p className="text-xs text-zinc-400">
                Exportez votre bibliothèque complète ou restaurez une sauvegarde JSON à tout moment.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#06070a] hover:bg-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exporter en JSON</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="h-3.5 w-3.5" />
                <span>Importer un fichier</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="json-import-area" className="block text-xs text-zinc-400">
              Ou collez directement une sauvegarde JSON ci-dessous :
            </label>
            <div className="flex gap-2">
              <textarea
                id="json-import-area"
                rows={2}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"application": "NEXUS", "items": [...]}'
                className="flex-1 rounded-lg bg-[#06070a] border border-white/10 p-2.5 text-xs font-mono-tabular text-zinc-200 focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={handleImportFromTextarea}
                className="px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white whitespace-nowrap shrink-0"
              >
                Valider l’import
              </button>
            </div>
          </div>
        </section>

        {/* Section 3 : Sources API sans clé & Déploiement GitHub Pages */}
        <section className="rounded-xl bg-[#111420] border border-white/[0.07] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Globe className="h-4 w-4 text-emerald-400" />
            <span>Catalogues en direct (0 clé API requise) & Déploiement GitHub Pages</span>
          </div>

          <div className="text-xs text-zinc-300 space-y-1">
            <p>
              · <strong className="text-white">Films (France)</strong> : Connecté en direct à l’API publique Apple TV / iTunes France (titres FR, affiches HD et prix VOD vérifiés sans clé).
            </p>
            <p>
              · <strong className="text-white">Séries TV</strong> : Connecté en direct à l’API publique TVMaze (recherche + chargement automatique des saisons et épisodes réels sans clé).
            </p>
            <p>
              · <strong className="text-white">Anime japonais</strong> : Connecté en direct à l’API publique GraphQL AniList (séries TV, films d’animation, VO/VF sans clé).
            </p>
          </div>

          <div className="pt-2 border-t border-white/[0.07] text-xs text-zinc-400 space-y-1">
            <p className="text-zinc-200 font-semibold">
              Prêt pour GitHub Pages (fichier .github/workflows/deploy.yml inclus) :
            </p>
            <p>
              1. Poussez le code sur votre dépôt GitHub (branche <code className="text-zinc-200">main</code>).
            </p>
            <p>
              2. Dans GitHub, ouvrez <strong className="text-zinc-200">Settings → Pages → Build and deployment</strong> et choisissez <strong className="text-zinc-200">Source : GitHub Actions</strong>. Votre site est publié automatiquement !
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
