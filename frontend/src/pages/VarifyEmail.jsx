import { useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/auth/verify-email/${token}`)
      .then((res) => {
        alert(res.data.message || "Email verified");

        // 🔥 redirect from backend response
        window.location.href = res.data.redirect;
      })
      .catch(() => {
        alert("Invalid or expired link");
      });
  }, [token]);

  return <p className="p-6">Verifying your email...</p>;
}