import Navbar from './Navbar.jsx'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Circuit board background - covers the whole page */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23a855f7' stroke-width='0.4' opacity='0.15'%3E%3Crect x='10' y='10' width='10' height='10'/%3E%3Crect x='40' y='10' width='10' height='10'/%3E%3Crect x='70' y='10' width='10' height='10'/%3E%3Crect x='10' y='40' width='10' height='10'/%3E%3Crect x='40' y='40' width='10' height='10'/%3E%3Crect x='70' y='40' width='10' height='10'/%3E%3Crect x='10' y='70' width='10' height='10'/%3E%3Crect x='40' y='70' width='10' height='10'/%3E%3Crect x='70' y='70' width='10' height='10'/%3E%3Cline x1='20' y1='15' x2='40' y2='15'/%3E%3Cline x1='50' y1='15' x2='70' y2='15'/%3E%3Cline x1='20' y1='45' x2='40' y2='45'/%3E%3Cline x1='50' y1='45' x2='70' y2='45'/%3E%3Cline x1='20' y1='75' x2='40' y2='75'/%3E%3Cline x1='50' y1='75' x2='70' y2='75'/%3E%3Cline x1='15' y1='20' x2='15' y2='40'/%3E%3Cline x1='15' y1='50' x2='15' y2='70'/%3E%3Cline x1='45' y1='20' x2='45' y2='40'/%3E%3Cline x1='45' y1='50' x2='45' y2='70'/%3E%3Cline x1='75' y1='20' x2='75' y2='40'/%3E%3Cline x1='75' y1='50' x2='75' y2='70'/%3E%3Ccircle cx='20' cy='15' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='50' cy='15' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='80' cy='15' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='20' cy='45' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='50' cy='45' r='1.5' fill='%23f38020'/%3E%3Ccircle cx='80' cy='45' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='20' cy='75' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='50' cy='75' r='1.5' fill='%23a855f7'/%3E%3Ccircle cx='80' cy='75' r='1.5' fill='%23f38020'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '100px 100px',
          opacity: 0.035,
        }}
      />
      <Navbar />
      <main className="relative z-10 flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="relative z-10 border-t border-white/5 py-4">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-mono">
            OneFlare Lab v1.0 — Security Attack Simulation Platform
          </span>
          <span className="text-xs text-slate-600">
            <span className="text-orange-500/60">Cloudflare</span>
            <span className="text-slate-700 mx-1">×</span>
            <span className="text-purple-500/60">SentinelOne</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
