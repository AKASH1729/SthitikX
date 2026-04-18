const calculateSalarySlip = (data, config) => {
  const { totalCases, solvedCases, solvedBy17, solvedBy23 } = data;

  /* ================= PERFORMANCE ================= */
  const performance =
    totalCases === 0 ? 0 : (solvedCases / totalCases) * 100;

  /* ================= SLAB ================= */
  let slab = config.slabs.find(
    (s) => performance >= s.min && performance <= s.max
  );

  const base = slab?.rate || 0;
  const penalty = slab?.penalty || 0;

  /* ================= PER CASE ================= */
  const perCase = Math.max(0, base - penalty);
  const salary = perCase * solvedCases;

  /* ================= INCENTIVE ================= */
  const perf17 =
    totalCases === 0 ? 0 : (solvedBy17 / totalCases) * 100;

  const perf23 =
    totalCases === 0 ? 0 : (solvedBy23 / totalCases) * 100;

  let incentive = 0;

  // rule: both conditions must pass
  if (
    perf17 >= config.incentives.rule17.target &&
    perf23 >= config.incentives.rule23.target
  ) {
    incentive =
      solvedCases * config.incentives.rule17.amount +
      solvedCases * config.incentives.rule23.amount;
  }

  /* ================= FINAL ================= */
  const finalSalary = salary + incentive;

  return {
    base,
    perCase,
    incentive,
    penalty,
    performance: Number(performance.toFixed(2)),
    finalSalary: Math.round(finalSalary),
  };
};

module.exports = calculateSalarySlip;