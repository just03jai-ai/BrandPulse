export default function EmployeesLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111] animate-pulse">
      {/* Header */}
      <div className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="h-8 w-56 bg-white/5 rounded-lg mb-2" />
            <div className="h-4 w-32 bg-white/5 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-white/5 rounded-lg" />
            <div className="h-9 w-32 bg-emerald-900/30 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="px-8 py-4 flex gap-3">
        <div className="flex-1 h-9 bg-white/5 rounded-lg" />
        <div className="h-9 w-40 bg-white/5 rounded-lg" />
      </div>

      {/* Table */}
      <div className="px-8 pb-8">
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden">
          <div className="h-11 border-b border-white/5 bg-white/[0.02]" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/5" />
                <div>
                  <div className="h-3.5 w-32 bg-white/5 rounded mb-1.5" />
                  <div className="h-3 w-24 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-white/5 rounded-full ml-4" />
              <div className="h-3.5 w-28 bg-white/5 rounded ml-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
