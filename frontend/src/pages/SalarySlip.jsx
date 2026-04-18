import React, { useState, useEffect } from "react";
import api from "../services/api";

const GenerateSalary = () => {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [companyData, setCompanyData] = useState({ name: "Your Company", address: "", email: "", phone: "" });
  const [formData, setFormData] = useState({
    employeeId: "",
    month: new Date().toISOString().slice(0, 7), // Current month as default
    totalCases: "100",
    solvedCases: "85",
    amountPerCase: "150",
    penaltyPercent: "5",
    penaltyAmountPerCase: "10",
    incentiveTargetDate: "",
    incentiveAction: "",
    incentiveExtraPerCase: "0",
    slabTargetDate: "",
    slabAction: "",
    slabExtraPay: "0",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setEmployeesLoading(true);
        const empRes = await api.get("/v2/users");
        setEmployees(empRes.data?.users || []);
        try {
          const companyRes = await api.get("/company/details");
          setCompanyData(companyRes.data || { name: "Your Company", address: "", email: "", phone: "" });
        } catch {
          setCompanyData({ name: "Your Company", address: "", email: "", phone: "" });
        }
        setError("");
      } catch {
        setError("Failed to load employee data");
      } finally {
        setEmployeesLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fill with demo data for easy testing
  const fillDemoData = () => {
    const demoEmployee = employees.find(emp => emp.name) || { _id: "" };
    setFormData({
      employeeId: demoEmployee._id || "",
      month: new Date().toISOString().slice(0, 7),
      totalCases: "120",
      solvedCases: "108",
      amountPerCase: "200",
      penaltyPercent: "3",
      penaltyAmountPerCase: "15",
      incentiveTargetDate: new Date().toISOString().slice(0, 10),
      incentiveAction: "Early Completion",
      incentiveExtraPerCase: "25",
      slabTargetDate: new Date().toISOString().slice(0, 10),
      slabAction: "Monthly Target Achieved",
      slabExtraPay: "3000",
    });
    setResult(null);
    setError("");
  };

  const formatMonthForBackend = (isoMonth) => {
    if (!isoMonth) return "";
    const [year, month] = isoMonth.split("-");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${monthNames[parseInt(month, 10) - 1]}-${year}`;
  };

  const formatMonthForDisplay = (isoMonth) => {
    if (!isoMonth) return "";
    const [year, month] = isoMonth.split("-");
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const n = (val) => Number(val) || 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear previous result when form changes
    if (result) setResult(null);
  };

  const validate = () => {
    if (!formData.employeeId) return "Please select an employee";
    if (!formData.month) return "Please select a month";
    if (n(formData.solvedCases) > n(formData.totalCases)) return "Solved cases cannot exceed total cases";
    if (n(formData.totalCases) <= 0) return "Total cases must be greater than 0";
    return "";
  };

  const generatePDF = async () => {
    if (!result?.breakdown) { 
      alert("Please generate salary first"); 
      return; 
    }
    const selectedEmployee = employees.find((emp) => emp._id === formData.employeeId);
    if (!selectedEmployee) { 
      alert("Employee not found"); 
      return; 
    }

    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();

      const monthYearDisplay = formatMonthForDisplay(formData.month);
      const monthYearBackend = formatMonthForBackend(formData.month);
      const pageWidth = doc.internal.pageSize.getWidth();
      const companyName = companyData?.name || companyData?.companyName || "Your Company";
      const companyAddress = companyData?.address || "";
      const companyEmail = companyData?.email || "";
      const companyPhone = companyData?.phone || companyData?.contact || "";

      const total = n(formData.totalCases);
      const solved = n(formData.solvedCases);
      const unsolved = total - solved;
      const performance = total > 0 ? (solved / total) * 100 : 0;

      // ── HEADER ──────────────────────────────────────────────────────
      doc.setFillColor(26, 86, 219);
      doc.rect(0, 0, pageWidth, 48, "F");

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(companyName.toUpperCase(), pageWidth / 2, 16, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const subDetails = [companyAddress, companyEmail, companyPhone].filter(Boolean).join("  |  ");
      if (subDetails) doc.text(subDetails, pageWidth / 2, 24, { align: "center" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("SALARY SLIP", pageWidth / 2, 34, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`For the month of ${monthYearDisplay}`, pageWidth / 2, 43, { align: "center" });

      // ── EMPLOYEE DETAILS ────────────────────────────────────────────
      doc.setFillColor(245, 247, 255);
      doc.roundedRect(14, 54, pageWidth - 28, 42, 3, 3, "F");
      doc.setDrawColor(200, 210, 240);
      doc.roundedRect(14, 54, pageWidth - 28, 42, 3, 3, "S");

      doc.setFontSize(10);
      doc.setTextColor(26, 86, 219);
      doc.setFont("helvetica", "bold");
      doc.text("EMPLOYEE DETAILS", 20, 63);

      const empFields = [
        ["Name", selectedEmployee.name || "N/A"],
        ["Employee ID", selectedEmployee.employeeId || "N/A"],
        ["Department", selectedEmployee.department || "N/A"],
      ];
      const empFieldsRight = [
        ["Designation", selectedEmployee.designation || selectedEmployee.role || "N/A"],
        ["Email", selectedEmployee.email || "N/A"],
        ["Pay Period", monthYearDisplay],
      ];

      doc.setFontSize(9);
      empFields.forEach(([label, value], i) => {
        const y = 70 + i * 7;
        doc.setTextColor(80, 80, 80); 
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 20, y);
        doc.setFont("helvetica", "normal"); 
        doc.setTextColor(40, 40, 40);
        doc.text(value, 55, y);
      });
      empFieldsRight.forEach(([label, value], i) => {
        const y = 70 + i * 7;
        doc.setTextColor(80, 80, 80); 
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 108, y);
        doc.setFont("helvetica", "normal"); 
        doc.setTextColor(40, 40, 40);
        doc.text(String(value), 135, y);
      });

      // ── PERFORMANCE BANNER ──────────────────────────────────────────
      const perfColor = performance >= 75 ? [39, 174, 96] : performance >= 50 ? [230, 126, 34] : [231, 76, 60];
      doc.setFillColor(...perfColor);
      doc.roundedRect(14, 101, pageWidth - 28, 18, 3, 3, "F");

      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      const perfItems = [
        `Total Cases: ${total}`,
        `Solved: ${solved}`,
        `Unsolved: ${unsolved}`,
        `Performance: ${performance.toFixed(2)}%`,
      ];
      perfItems.forEach((item, i) => doc.text(item, 20 + i * 47, 112));

      // ── EARNINGS TABLE ──────────────────────────────────────────────
      doc.setFontSize(10);
      doc.setTextColor(26, 86, 219);
      doc.setFont("helvetica", "bold");
      doc.text("EARNINGS & DEDUCTIONS", 20, 130);

      // Calculate base earning: solvedCases * amountPerCase
      const baseEarning = solved * n(formData.amountPerCase);
      const incentiveEarning = n(result.breakdown.incentiveEarning);
      const slabEarning = n(result.breakdown.slabEarning);
      const penaltyDeduction = n(result.breakdown.penaltyDeduction);
      const totalEarning = baseEarning + incentiveEarning + slabEarning - penaltyDeduction;

      autoTable(doc, {
        startY: 134,
        head: [["#", "Description", "Details", "Amount (₹)"]],
        body: [
          ["1", "Base Salary", `${solved} cases × ₹${n(formData.amountPerCase).toFixed(2)}`, `₹${baseEarning.toFixed(2)}`],
          ["2", "Incentive Bonus", 
            formData.incentiveAction && n(formData.incentiveExtraPerCase) > 0
              ? `${formData.incentiveAction} | Target: ${formatDate(formData.incentiveTargetDate)} | +₹${n(formData.incentiveExtraPerCase).toFixed(2)}/case`
              : "No incentive applied",
            `+ ₹${incentiveEarning.toFixed(2)}`],
          ["3", "Slab Bonus",
            formData.slabAction && n(formData.slabExtraPay) > 0
              ? `${formData.slabAction} | Target: ${formatDate(formData.slabTargetDate)}`
              : "No slab bonus applied",
            `+ ₹${slabEarning.toFixed(2)}`],
          ["4", "Penalty",
            unsolved > 0 
              ? `${unsolved} unsolved cases | ${n(formData.penaltyPercent)}% of base | ₹${n(formData.penaltyAmountPerCase).toFixed(2)}/case`
              : "No penalty (all cases solved)",
            `- ₹${penaltyDeduction.toFixed(2)}`],
        ],
        foot: [["", "", "TOTAL", `₹${totalEarning.toFixed(2)}`]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        theme: "striped",
        headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
      });

      // ── NET SALARY BOX ──────────────────────────────────────────────
      const afterTable = doc.lastAutoTable.finalY + 6;
      doc.setFillColor(26, 86, 219);
      doc.roundedRect(14, afterTable, pageWidth - 28, 14, 3, 3, "F");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("NET SALARY PAYABLE", 20, afterTable + 9);
      doc.text(`₹ ${totalEarning.toFixed(2)}`, pageWidth - 18, afterTable + 9, { align: "right" });

      // ── CASE WORK DETAILS ───────────────────────────────────────────
      const detailY = afterTable + 22;
      doc.setFontSize(10);
      doc.setTextColor(26, 86, 219);
      doc.setFont("helvetica", "bold");
      doc.text("CASE WORK SUMMARY", 20, detailY);

      autoTable(doc, {
        startY: detailY + 4,
        head: [["Metric", "Value", "Calculation"]],
        body: [
          ["Total Cases Assigned", total.toString(), "-"],
          ["Cases Solved", solved.toString(), `${((solved/total)*100).toFixed(1)}% of total`],
          ["Unsolved Cases", unsolved.toString(), `${((unsolved/total)*100).toFixed(1)}% of total`],
          ["Amount per Case", `₹${n(formData.amountPerCase).toFixed(2)}`, "Base rate"],
          ["Penalty %", `${n(formData.penaltyPercent)}%`, `Applied on ${unsolved} unsolved cases`],
          ["Penalty per Unsolved Case", `₹${n(formData.penaltyAmountPerCase).toFixed(2)}`, "-"],
        ],
        theme: "plain",
        headStyles: { fillColor: [245, 247, 255], textColor: [26, 86, 219], fontStyle: "bold" },
      });

      // ── INCENTIVE & SLAB DETAILS (if applicable) ────────────────────
      let currentY = doc.lastAutoTable.finalY + 6;
      
      if (formData.incentiveAction || formData.slabAction) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "bold");
        
        if (formData.incentiveAction && n(formData.incentiveExtraPerCase) > 0) {
          doc.text(`✓ Incentive: ${formData.incentiveAction} (Target Date: ${formatDate(formData.incentiveTargetDate)}) - Extra ₹${n(formData.incentiveExtraPerCase).toFixed(2)} per solved case`, 20, currentY);
          currentY += 6;
        }
        
        if (formData.slabAction && n(formData.slabExtraPay) > 0) {
          doc.text(`✓ Slab Bonus: ${formData.slabAction} (Target Date: ${formatDate(formData.slabTargetDate)}) - Extra ₹${n(formData.slabExtraPay).toFixed(2)}`, 20, currentY);
          currentY += 6;
        }
      }

      // ── SIGNATURES ──────────────────────────────────────────────────
      const sigY = Math.max(currentY + 10, afterTable + 80);
      doc.setDrawColor(180, 180, 180);
      doc.line(20, sigY, 75, sigY);
      doc.line(pageWidth - 75, sigY, pageWidth - 20, sigY);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text("Employee Signature", 47, sigY + 5, { align: "center" });
      doc.text("Authorized Signatory", pageWidth - 47, sigY + 5, { align: "center" });
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageWidth / 2, sigY + 12, { align: "center" });

      // ── FOOTER ──────────────────────────────────────────────────────
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 285, pageWidth, 12, "F");
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("This is a computer-generated salary slip. Valid with authorized signature.", pageWidth / 2, 292, { align: "center" });

      const safeName = (selectedEmployee.name || "Employee").replace(/\s+/g, "_");
      doc.save(`SalarySlip_${safeName}_${monthYearBackend.replace("/", "_")}.pdf`);
      
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF generation failed: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { 
      setError(validationError); 
      return; 
    }
    setLoading(true); 
    setError(""); 
    setSuccess(""); 
    setResult(null);
    
    try {
      const payload = {
        employeeId: formData.employeeId,
        month: formatMonthForBackend(formData.month),
        totalCases: n(formData.totalCases),
        solvedCases: n(formData.solvedCases),
        amountPerCase: n(formData.amountPerCase),
        penaltyPercent: n(formData.penaltyPercent),
        penaltyAmountPerCase: n(formData.penaltyAmountPerCase),
        incentiveTargetDate: formData.incentiveTargetDate,
        incentiveAction: formData.incentiveAction,
        incentiveExtraPerCase: n(formData.incentiveExtraPerCase),
        slabTargetDate: formData.slabTargetDate,
        slabAction: formData.slabAction,
        slabExtraPay: n(formData.slabExtraPay),
      };
      const res = await api.post("/salary/generate", payload);
      setSuccess("Salary generated successfully!");
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Salary generation failed");
    } finally {
      setLoading(false);
    }
  };

  // ── REUSABLE FIELD COMPONENT ──────────────────────────────────────
  const Field = ({ label, name, type = "text", placeholder, min, max, step, required, disabled }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        name={name} type={type} placeholder={placeholder || (type === "number" ? "0" : "")}
        value={formData[name]} onChange={handleChange}
        min={min} max={max} step={step} required={required} disabled={disabled}
        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  );

  const selectedEmployee = employees.find((emp) => emp._id === formData.employeeId);
  const performance = n(formData.totalCases) > 0 ? (n(formData.solvedCases) / n(formData.totalCases)) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Salary</h1>
          <p className="text-sm text-gray-500 mt-1">Fill in the details below to calculate and download a salary slip</p>
        </div>
        <button
          type="button"
          onClick={fillDemoData}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-all"
          disabled={employeesLoading || employees.length === 0}
        >
          🚀 Fill Demo Data
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── SECTION 1: Employee & Month ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Employee & Period
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee *</label>
              <select
                name="employeeId" value={formData.employeeId} onChange={handleChange}
                disabled={employeesLoading} required
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="">{employeesLoading ? "Loading..." : "Select employee"}</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.employeeId || "No ID"}) - {emp.designation || emp.role || "N/A"}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Salary Month *" name="month" type="month" required />
          </div>

          {/* Employee preview badge */}
          {selectedEmployee && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                {selectedEmployee.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{selectedEmployee.name}</p>
                <p className="text-gray-500 text-xs">{selectedEmployee.designation || selectedEmployee.role || "N/A"} • {selectedEmployee.department || "N/A"} • {selectedEmployee.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 2: Case Statistics ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Case Statistics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Total Cases" name="totalCases" type="number" min="0" required />
            <Field label="Solved Cases" name="solvedCases" type="number" min="0" required />
            <Field label="Amount / Case (₹)" name="amountPerCase" type="number" min="0" step="0.01" required />
          </div>
          
          {/* Live performance preview */}
          {n(formData.totalCases) > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Performance: {performance.toFixed(1)}%</span>
                <span className={performance >= 75 ? "text-green-600" : performance >= 50 ? "text-yellow-600" : "text-red-600"}>
                  {performance >= 75 ? "Excellent" : performance >= 50 ? "Average" : "Needs Improvement"}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    performance >= 75 ? "bg-green-500" :
                    performance >= 50 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(performance, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {n(formData.solvedCases)} solved out of {n(formData.totalCases)} total cases
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 3: Penalty ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Penalty Deductions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Penalty % (of base amount)" name="penaltyPercent" type="number" min="0" max="100" step="0.1" placeholder="0" />
            <Field label="Penalty Amount / Unsolved Case (₹)" name="penaltyAmountPerCase" type="number" min="0" step="0.01" placeholder="0" />
          </div>
          {n(formData.totalCases) > 0 && n(formData.solvedCases) < n(formData.totalCases) && (
            <div className="mt-2 text-xs text-red-600">
              ⚠️ {n(formData.totalCases) - n(formData.solvedCases)} unsolved case(s) will incur penalty
            </div>
          )}
        </div>

        {/* ── SECTION 4: Incentive ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">4</span>
            Incentive Bonus (Optional)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Target Date" name="incentiveTargetDate" type="date" />
            <Field label="Action / Reason" name="incentiveAction" placeholder="e.g. Completed Early" />
            <Field label="Extra ₹ per Solved Case" name="incentiveExtraPerCase" type="number" min="0" step="0.01" placeholder="0" />
          </div>
        </div>

        {/* ── SECTION 5: Slab ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs">5</span>
            Slab Bonus (Optional)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Target Date" name="slabTargetDate" type="date" />
            <Field label="Action / Reason" name="slabAction" placeholder="e.g. Target Achieved" />
            <Field label="Fixed Extra Pay (₹)" name="slabExtraPay" type="number" min="0" step="0.01" placeholder="0" />
          </div>
        </div>

        {/* ── STATUS MESSAGES ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg">✕</span>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-green-500 text-lg">✓</span>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        <button
          type="submit" 
          disabled={loading || employeesLoading}
          className={`w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all ${
            loading || employeesLoading ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
          }`}
        >
          {loading ? "Calculating..." : "💰 Generate Salary"}
        </button>
      </form>

      {/* ── RESULT CARD ── */}
      {result?.breakdown && (
        <div className="mt-6 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">Salary Breakdown</h2>
            <p className="text-blue-200 text-sm">{selectedEmployee?.name} — {formatMonthForDisplay(formData.month)}</p>
          </div>
          <div className="p-6 space-y-3">
            {[
              { label: "Performance", value: `${n(result.breakdown.performance).toFixed(2)}%`, color: "text-gray-800" },
              { label: "Base Earning", value: `₹${n(result.breakdown.baseEarning).toFixed(2)}`, color: "text-gray-800" },
              { label: "+ Incentive Bonus", value: `₹${n(result.breakdown.incentiveEarning).toFixed(2)}`, color: "text-green-600" },
              { label: "+ Slab Bonus", value: `₹${n(result.breakdown.slabEarning).toFixed(2)}`, color: "text-green-600" },
              { label: "− Penalty", value: `₹${n(result.breakdown.penaltyDeduction).toFixed(2)}`, color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center text-sm py-1 border-b border-gray-50">
                <span className="text-gray-600">{label}</span>
                <span className={`font-semibold ${color}`}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-gray-200">
              <span className="font-bold text-gray-900 text-lg">Net Salary</span>
              <span className="text-2xl font-bold text-blue-600">₹{n(result.breakdown.totalEarning).toFixed(2)}</span>
            </div>
            <button
              onClick={generatePDF}
              className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-all shadow hover:shadow-md"
            >
              📄 Download Salary Slip PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateSalary;