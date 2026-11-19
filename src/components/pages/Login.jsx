
import { useState } from "react";
import "./Login.css";

export default function Login() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[0-9]{10}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          mobile_number: mobile,
          password: password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.message ||
          "Invalid mobile number or password."
        );
      }

      // Backend sets authentication cookies automatically.
      console.log("Login successful:", data);

      window.location.href = "/";

    } catch (err) {
      console.error("Login error:", err);

      setError(
        err.message || "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          Nexa<span>Fin</span>
        </div>

        <h1>Welcome back</h1>

        <p className="login-description">
          Sign in to continue to your account
        </p>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="mobile">
              Mobile Number
            </label>

            <input
              id="mobile"
              type="tel"
              placeholder="Enter 10-digit mobile number"
              value={mobile}
              onChange={(e) =>
                setMobile(
                  e.target.value.replace(/\D/g, "").slice(0, 10)
                )
              }
              maxLength={10}
              autoComplete="tel"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>

        </form>

        <div className="login-footer">
          Secure access to NexaFin
        </div>

      </div>
    </div>
  );
}
