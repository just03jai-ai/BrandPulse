export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0c0e15] animate-pulse">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="h-8 w-40 bg-white/5 rounded-lg mb-2" />
        <div className="h-4 w-72 bg-white/5 rounded-lg" />
      </div>

      {/* Podium */}
      <div className="px-8 pt-6">
        <div className="bg-[#12151f] border border-white/5 rounded-xl p-6">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center py-8 px-4 gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5" />
                <div className="w-14 h-14 rounded-full bg-white/5" />
                <div className="h-4 w-24 bg-white/5 rounded" />
                <div className="h-8 w-16 bg-white/5 rounded mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 pt-5 space-y-3">
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-white/5 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-7 w-20 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pt-5 pb-4">
        <div className="bg-[#12151f] border border-white/5 rounded-xl overflow-hidden">
          <div className="h-11 border-b border-white/5 bg-white/[0.02]" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-white/5" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5" />
                <div>
                  <div className="h-3.5 w-28 bg-white/5 rounded mb-1.5" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-white/5 rounded-full ml-2" />
              <div className="ml-auto h-5 w-12 bg-emerald-900/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
