import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/',           label: 'Tableau de bord', short: 'Accueil'     },
  { to: '/livraisons', label: 'Livraisons',      short: 'Livraisons'  },
  { to: '/enseignes',  label: 'Enseignes',       short: 'Enseignes'   },
  { to: '/produits',   label: 'Mes produits',    short: 'Produits'    },
  { to: '/ventes',     label: 'Particulier',     short: 'Particulier' },
  { to: '/profil',     label: 'Mon profil',      short: 'Profil'      },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location         = useLocation();
  const navigate         = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fixe (h-14 = 56px) */}
      <header className="fixed inset-x-0 top-0 z-20 h-14 bg-blue-700 text-white shadow-md print:hidden flex items-center justify-between px-4 sm:px-6">
        <span className="font-bold text-lg tracking-wide">OrderPilot</span>
        <div className="flex items-center gap-4">
          <Link to="/profil" className="text-sm hidden sm:block text-blue-200 hover:text-white transition">{user?.company_name}</Link>
          <button
            onClick={handleLogout}
            className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Sidebar fixe (desktop) — commence sous le header */}
      <nav className="fixed left-0 top-14 bottom-0 w-52 bg-white border-r border-gray-200 hidden sm:flex flex-col p-4 gap-1 print:hidden z-10">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenu principal — poussé sous le header et à droite du sidebar */}
      <main className="pt-14 sm:pl-52 min-h-screen">
        <div className="px-4 sm:px-6 py-6 pb-24 sm:pb-8">
          {children}
        </div>
      </main>

      {/* Nav mobile (bas de l'écran) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 print:hidden sm:hidden z-20 pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-6">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center justify-center text-center py-2.5 px-0.5 text-[10px] leading-tight font-medium transition truncate ${
                    active ? 'text-blue-700 bg-blue-50' : 'text-gray-500'
                  }`}
                >
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
