import DailySummary from "./DailySummary";

// The dashboard is the day's summary only (the document chat bar was removed on 2026-11-28).
export default function Dashboard({ darkMode }) {
  return (
    <div
      className={`flex-1 newq flex min-h-0 flex-col overflow-hidden transition-colors duration-300 ${
        darkMode ? "bg-[#121317] text-white" : "bg-white text-[#141414]"
      }`}
    >
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <DailySummary darkMode={darkMode} />
        </div>
      </div>
    </div>
  );
}
