export const metadata = {
  title: "Privacy Policy — BrandPulse",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#111] text-white px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">BrandPulse Privacy Policy</h1>

      <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
        <p>
          BrandPulse collects company social media data and employee engagement
          information for internal analytics purposes.
        </p>

        <ul className="space-y-3 list-none">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">—</span>
            We do not sell personal data.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">—</span>
            We do not share data with third parties.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">—</span>
            Data is stored securely and used only for employee advocacy reporting.
          </li>
        </ul>

        <p>
          For questions contact:{" "}
          <a
            href="mailto:jai@farmart.co"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            jai@farmart.co
          </a>
        </p>
      </div>
    </main>
  );
}
