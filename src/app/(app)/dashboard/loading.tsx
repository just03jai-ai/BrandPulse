export default function DashboardLoading() {
  return (
    <div className="p-8 min-h-screen bg-[#111] animate-pulse">
      {/* Header */}
      <div className="mb-7">
        <div className="h-8 w-36 bg-white/5 rounded-lg mb-2" />
        <div className="h-4 w-64 bg-white/5 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 h-28" />
        ))}
      </div>

      {/* Engagement cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 h-20" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 h-64" />
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 h-64" />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 h-52" />
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 h-52" />
      </div>
    </div>
  );
}
