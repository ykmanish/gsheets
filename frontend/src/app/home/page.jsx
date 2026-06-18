
import React from "react";
import {
  ArrowRightLeft,
  BadgeIndianRupee,
  Banknote,
  Calculator,
  CheckCircle2,
  Coins,
  Euro,
  Landmark,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

export default function ArbitrageProfitabilityPage() {
  const metrics = [
    {
      label: "Capital Per Cycle",
      value: "₹1,00,000",
      note: "Used for each arbitrage transaction",
      icon: Wallet,
      color: "bg-[#E7FF19]",
    },
    {
      label: "Euro Bought",
      value: "893 EUR",
      note: "Current buying estimate",
      icon: Euro,
      color: "bg-[#B8F7D4]",
    },
    {
      label: "USDT Value",
      value: "1032 USDT",
      note: "Converted position",
      icon: Coins,
      color: "bg-[#FFD166]",
    },
    {
      label: "Sell Rate",
      value: "₹102.8",
      note: "USDT sold back in INR",
      icon: BadgeIndianRupee,
      color: "bg-[#FFB3C6]",
    },
  ];

  const flow = [
    "₹1,00,000 capital",
    "Buy 893 EUR",
    "Convert to 1032 USDT",
    "Sell at ₹102.8",
    "Profit around ₹6.1K",
  ];

  const distribution = [
    { label: "After Tax", value: "₹33,700", width: "50%", color: "bg-[#E7FF19]" },
    { label: "Accounting Fee", value: "₹15,000", width: "22%", color: "bg-[#111111] text-white" },
    { label: "Personal Need", value: "₹12K-13K", width: "18%", color: "bg-[#00A6A6] text-white" },
    { label: "Loan Support", value: "Balance", width: "10%", color: "bg-[#F4EFE6]" },
  ];

  return (
    <main className="min-h-screen bg-[#F7F4EA] text-[#111111]">
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:grid-cols-[280px_1fr_320px] lg:px-6">
        <aside className="rounded-[6px] border-4 border-[#111111] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[4px] border-4 border-[#111111] bg-[#E7FF19]">
              <ArrowRightLeft size={24} strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-black uppercase">Arbitrage</p>
              <h1 className="text-2xl font-black leading-none">Profit Plan</h1>
            </div>
          </div>

          <div className="mt-6 rounded-[6px] border-4 border-[#111111] bg-[#111111] p-4 text-white">
            <div className="flex items-center gap-2">
              <PartyPopper className="text-[#E7FF19]" size={22} />
              <p className="font-black uppercase">Celebration Mode</p>
            </div>
            <p className="mt-3 text-sm leading-6">
              Low-volume monthly cycles designed to keep cash flow alive while
              supporting fees, personal needs, and business loan repayment.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <InfoRow icon={ShieldCheck} label="Monthly Volume" value="₹11,00,000" />
            <InfoRow icon={Calculator} label="Transactions" value="11 / month" />
            <InfoRow icon={Landmark} label="Business Loan" value="₹80,000" />
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-[6px] border-4 border-[#111111] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-[4px] border-4 border-[#111111] bg-[#E7FF19] px-3 py-1 text-xs font-black uppercase">
                  <Sparkles size={16} strokeWidth={3} />
                  Profitability Snapshot
                </p>
                <h2 className="max-w-2xl text-4xl font-black leading-tight md:text-5xl">
                  ₹6,100 profit per cycle, scaled into a clean monthly cash-flow plan.
                </h2>
              </div>

              <div className="rounded-[6px] border-4 border-[#111111] bg-[#00A6A6] p-4 text-white">
                <p className="text-xs font-black uppercase">Monthly Net After Plan</p>
                <p className="mt-1 text-4xl font-black">₹18K+</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((item) => (
                <MetricCard key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-[6px] border-4 border-[#111111] bg-white p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase">Transaction Flow</p>
                  <h3 className="text-2xl font-black">How One Cycle Works</h3>
                </div>
                <TrendingUp size={30} strokeWidth={3} />
              </div>

              <div className="space-y-3">
                {flow.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded-[6px] border-4 border-[#111111] bg-[#F7F4EA] p-3"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border-4 border-[#111111] bg-[#E7FF19] text-sm font-black">
                      {index + 1}
                    </div>
                    <p className="font-black">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[6px] border-4 border-[#111111] bg-[#E7FF19] p-5">
              <p className="text-xs font-black uppercase">Per Cycle Return</p>
              <div className="mt-3 grid aspect-square place-items-center rounded-full border-4 border-[#111111] bg-white">
                <div className="text-center">
                  <p className="text-5xl font-black">₹6.1K</p>
                  <p className="mt-1 text-sm font-black uppercase">Approx Profit</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-bold leading-6">
                1032 USDT sold at ₹102.8 gives roughly ₹1.06L output from ₹1L input.
              </p>
            </div>
          </div>

          <div className="rounded-[6px] border-4 border-[#111111] bg-white p-5">
            <div className="mb-5 flex items-center gap-3">
              <Banknote size={30} strokeWidth={3} />
              <div>
                <p className="text-xs font-black uppercase">Monthly Calculation</p>
                <h3 className="text-2xl font-black">11 Cycles Per Month</h3>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <BigNumber title="Gross Monthly Profit" value="₹67,400" note="Before tax and fees" />
              <BigNumber title="After 50% Tax" value="₹33,700" note="Clean remaining amount" />
              <BigNumber title="After Accounting Fee" value="₹18,700" note="Approx usable balance" />
            </div>
          </div>
        </section>

        <aside className="rounded-[6px] border-4 border-[#111111] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase">Cash Allocation</p>
              <h3 className="text-2xl font-black">Monthly Split</h3>
            </div>
            <CheckCircle2 size={28} strokeWidth={3} />
          </div>

          <div className="mt-5 space-y-3">
            {distribution.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm font-black">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-9 rounded-[4px] border-4 border-[#111111] bg-white">
                  <div
                    className={`h-full ${item.color}`}
                    style={{ width: item.width }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[6px] border-4 border-[#111111] bg-[#F4EFE6] p-4">
            <p className="text-xs font-black uppercase">Working Strategy</p>
            <p className="mt-2 text-sm font-bold leading-6">
              Keep monthly remittance usage around ₹11L, maintain fewer transactions,
              pay accounting first, cover ₹12K-13K personal needs, and send the
              remaining amount toward the ₹80K business loan.
            </p>
          </div>

          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-[6px] border-4 border-[#111111] bg-[#E7FF19] px-4 py-4 font-black uppercase transition-transform duration-200 hover:-translate-y-1 active:translate-y-0">
            <PartyPopper size={20} strokeWidth={3} />
            Plan Looks Workable
          </button>
        </aside>
      </section>
    </main>
  );
}

function MetricCard({ label, value, note, icon: Icon, color }) {
  return (
    <div className="rounded-[6px] border-4 border-[#111111] bg-white p-4 transition-transform duration-200 hover:-translate-y-1">
      <div className={`mb-4 grid h-11 w-11 place-items-center rounded-[4px] border-4 border-[#111111] ${color}`}>
        <Icon size={22} strokeWidth={3} />
      </div>
      <p className="text-xs font-black uppercase">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm font-bold text-[#444444]">{note}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-[6px] border-4 border-[#111111] bg-[#F7F4EA] p-3">
      <Icon size={20} strokeWidth={3} />
      <div>
        <p className="text-xs font-black uppercase">{label}</p>
        <p className="font-black">{value}</p>
      </div>
    </div>
  );
}

function BigNumber({ title, value, note }) {
  return (
    <div className="rounded-[6px] border-4 border-[#111111] bg-[#F7F4EA] p-4">
      <p className="text-xs font-black uppercase">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#444444]">{note}</p>
    </div>
  );
}
