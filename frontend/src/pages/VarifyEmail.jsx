import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await api.get(`/auth/verify-email/${token}`);

        alert(res.data.message || "Email verified");

        navigate(res.data.redirect || "/login");

      } catch (err) {
        console.error("Verify error:", err?.response?.data || err.message);

        alert(
          err?.response?.data?.message || "Invalid or expired verification link"
        );

        navigate("/login");
      }
    };

    if (token) verifyEmail();
  }, [token, navigate]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold">Verifying your email...</h2>
    </div>
  );
}
