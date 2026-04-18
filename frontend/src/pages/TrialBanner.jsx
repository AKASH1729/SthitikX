import React, { useEffect, useState } from "react";

export default function TrialBanner({ company }) {
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    if (!company?.trialExpiresAt) return;

    const diff =
      new Date(company.trialExpiresAt) - new Date();

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    setDaysLeft(days);

  }, [company]);

  if (company.plan !== "trial") return null;

  return (
    <div className="bg-yellow-100 border border-yellow-400 p-3 rounded flex justify-between items-center">

      <p>
        ⏳ Trial ends in <b>{daysLeft} days</b>
      </p>

      <a
        href="/pricing"
        className="bg-yellow-500 text-white px-4 py-1 rounded"
      >
        Upgrade
      </a>

    </div>
  );
}