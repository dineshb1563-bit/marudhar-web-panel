"use client";
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, App } from 'antd';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { getDeviceInfo } from '@/lib/commonFun';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

// ── Color tokens (Light Mode) ─────────────────────────────
const C = {
  gold: '#FF7A00',
  goldLight: '#FF9A3C',
  goldDim: 'rgba(255,122,0,0.10)',
  black: '#1A1A1A',
  darkBg: '#F7F4F0',       // warm off-white page bg
  cardBg: '#FFFFFF',        // white cards
  panelBg: '#FFF8F2',       // warm tinted panel
  lightBg: '#F7F7F7',
  grey: '#6B6B6B',          // readable mid-grey
  greyDim: '#9CA3AF',       // light grey
  border: '#E8DDD4',        // warm border
  text: '#1A1A1A',          // dark text
};

const TRUST_INFO = {
  name: "मरुधर जन कल्याण सेवा संस्थान",
  nameEn: "Marudhar Jan Kalyan Seva Sansthan",
  address: "मु. पो. गेलावास, तह. रोहट, जिला - पाली (राजस्थान) 306421",
  phone: ["99823 04730", "90793 91818"],
  email: "contact@sawalajiseva.org",
  regNo: "COOP/2025/PALI/500486",
  established: "2025"
};

// ── Constants ─────────────────────────────────────────────
const OTP_TIMEOUT = 60;
const OTP_VALIDITY_DAYS = 7;
const OTP_STORAGE_KEY = 'lastOtpVerification';

const getLastVerification = (email) => {
  try {
    const stored = localStorage.getItem(OTP_STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    return data[email] || null;
  } catch { return null; }
};

const setLastVerification = (email) => {
  try {
    const stored = localStorage.getItem(OTP_STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[email] = new Date().toISOString();
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const needsOTPVerification = (email) => {
  const lastVerified = getLastVerification(email);
  if (!lastVerified) return true;
  const diffDays = (new Date() - new Date(lastVerified)) / (1000 * 60 * 60 * 24);
  return diffDays >= OTP_VALIDITY_DAYS;
};

async function saveSession(userId, sessionToken) {
  const deviceInfo = getDeviceInfo();
  const ipRes = await fetch("https://ipapi.co/json/");
  const locationData = await ipRes.json();
  const session = {
    ip: locationData.ip,
    location: `${locationData.city}, ${locationData.region}, ${locationData.country_name}`,
    pinCode: locationData.postal,
    device: deviceInfo.device,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    sessionToken,
  };
  await setDoc(doc(db, "users", userId, "sessions", sessionToken), session);
}

// ── Inline styles (Light Mode) ────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .login-root {
    min-height: 100vh;
    background: ${C.darkBg};
    display: flex;
    align-items: stretch;
    font-family: 'DM Sans', sans-serif;
    position: relative;
    overflow: hidden;
  }

  /* Subtle warm dot pattern on bg */
  .login-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,122,0,0.07) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    z-index: 0;
  }

  /* Soft warm glow top-right */
  .login-root::after {
    content: '';
    position: fixed;
    top: -80px; right: -80px;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,122,0,0.12) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }

  /* ─ Trust Panel ─ */
  .trust-panel {
    width: 400px;
    min-height: 100vh;
    background: linear-gradient(160deg, #FFF5EC 0%, #FEF0E3 100%);
    border-right: 1px solid ${C.border};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 40px;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .trust-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 36px,
      rgba(255,122,0,0.04) 36px,
      rgba(255,122,0,0.04) 37px
    );
    pointer-events: none;
  }

  .trust-emblem {
    width: 96px; height: 96px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff 0%, #fff 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 40px;
    margin-bottom: 24px;
    box-shadow: 0 0 0 10px rgba(255,122,0,0.10), 0 8px 32px rgba(255,122,0,0.28);
    position: relative; z-index: 1;
  }

  .trust-name-devanagari {
    font-family: 'Noto Sans Devanagari', sans-serif;
    font-size: 21px;
    font-weight: 600;
    color: ${C.gold};
    text-align: center;
    line-height: 1.45;
    margin-bottom: 5px;
    position: relative; z-index: 1;
  }

  .trust-name-en {
    font-family: 'Playfair Display', serif;
    font-size: 12.5px;
    font-weight: 400;
    color: ${C.grey};
    text-align: center;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    margin-bottom: 32px;
    position: relative; z-index: 1;
  }

  .trust-divider {
    width: 60px; height: 2px;
    background: linear-gradient(90deg, transparent, ${C.gold}, transparent);
    margin: 0 auto 28px;
    position: relative; z-index: 1;
  }

  .trust-detail-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
    width: 100%;
    position: relative; z-index: 1;
  }

  .trust-detail-icon {
    width: 32px; height: 32px;
    background: rgba(255,122,0,0.10);
    border: 1px solid rgba(255,122,0,0.22);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-size: 14px;
  }

  .trust-detail-label {
    font-size: 10px;
    font-weight: 600;
    color: ${C.gold};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 3px;
  }

  .trust-detail-value {
    font-size: 12.5px;
    color: ${C.grey};
    line-height: 1.55;
  }

  .trust-badge {
    margin-top: 32px;
    padding: 9px 20px;
    border: 1px solid rgba(255,122,0,0.22);
    border-radius: 100px;
    background: rgba(255,122,0,0.07);
    font-size: 11px;
    color: ${C.grey};
    letter-spacing: 0.05em;
    text-align: center;
    position: relative; z-index: 1;
  }

  .trust-badge span { color: ${C.gold}; font-weight: 600; }

  /* ─ Login Side ─ */
  .login-side {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    position: relative;
    z-index: 1;
  }

  .login-card {
    width: 100%;
    max-width: 440px;
    background: ${C.cardBg};
    border: 1px solid ${C.border};
    border-radius: 20px;
    padding: 48px 44px;
    box-shadow: 0 8px 40px rgba(180,120,60,0.10), 0 2px 8px rgba(0,0,0,0.06);
    animation: fadeUp 0.5s ease both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .login-heading {
    font-family: 'Playfair Display', serif;
    font-size: 30px;
    font-weight: 700;
    color: ${C.text};
    margin-bottom: 6px;
  }

  .login-subheading {
    font-size: 13.5px;
    color: ${C.grey};
    margin-bottom: 36px;
  }

  .login-subheading span { color: ${C.gold}; font-weight: 500; }

  /* Step indicator */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
  }

  .step-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: ${C.border};
    transition: all 0.3s ease;
  }
  .step-dot.active {
    background: ${C.gold};
    box-shadow: 0 0 8px rgba(255,122,0,0.4);
    width: 24px;
    border-radius: 4px;
  }
  .step-dot.done { background: rgba(255,122,0,0.35); }

  /* Custom input */
  .custom-input-wrap { margin-bottom: 20px; }

  .custom-label {
    font-size: 11.5px;
    font-weight: 600;
    color: ${C.grey};
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .custom-label .timer {
    font-size: 11px;
    color: ${C.gold};
    font-weight: 600;
    background: rgba(255,122,0,0.08);
    padding: 2px 10px;
    border-radius: 100px;
    border: 1px solid rgba(255,122,0,0.20);
  }

  .ant-input-affix-wrapper,
  .ant-input-password {
    background: #FAFAFA !important;
    border: 1.5px solid ${C.border} !important;
    border-radius: 10px !important;
    color: ${C.text} !important;
    font-size: 14px !important;
    padding: 12px 16px !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
  }

  .ant-input-affix-wrapper:hover,
  .ant-input-affix-wrapper:focus-within,
  .ant-input-password:hover,
  .ant-input-password:focus-within {
    border-color: ${C.gold} !important;
    box-shadow: 0 0 0 3px rgba(255,122,0,0.10) !important;
    background: #fff !important;
  }

  .ant-input {
    background: transparent !important;
    color: ${C.text} !important;
    font-size: 14px !important;
  }

  .ant-input::placeholder { color: #C4B8AE !important; }

  .ant-input-prefix { color: ${C.gold} !important; margin-right: 10px !important; }

  .ant-input-suffix .anticon { color: ${C.greyDim} !important; }

  .ant-form-item { margin-bottom: 0 !important; }
  .ant-form-item-explain-error { font-size: 11.5px !important; margin-top: 4px !important; color: #D9534F !important; }

  /* Primary button */
  .btn-gold {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, ${C.gold} 0%, #e06000 100%);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: all 0.25s ease;
    box-shadow: 0 4px 16px rgba(255,122,0,0.30);
    margin-top: 24px;
  }

  .btn-gold:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(255,122,0,0.40);
  }

  .btn-gold:active:not(:disabled) { transform: translateY(0); }
  .btn-gold:disabled { opacity: 0.55; cursor: not-allowed; }

  .btn-gold .spinner {
    display: inline-block;
    width: 15px; height: 15px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-right: 8px;
    vertical-align: middle;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .btn-link {
    background: none; border: none; cursor: pointer;
    color: ${C.gold}; font-size: 13px; font-family: 'DM Sans', sans-serif;
    font-weight: 500; padding: 0; text-decoration: underline;
    text-underline-offset: 3px; transition: opacity 0.2s;
  }
  .btn-link:hover { opacity: 0.70; }
  .btn-link:disabled { opacity: 0.35; cursor: not-allowed; text-decoration: none; }

  .btn-ghost {
    background: none; border: none; cursor: pointer;
    color: ${C.greyDim}; font-size: 12.5px; font-family: 'DM Sans', sans-serif;
    padding: 0; transition: color 0.2s;
  }
  .btn-ghost:hover { color: ${C.text}; }

  .row-space {
    display: flex; justify-content: space-between;
    align-items: center; margin-top: 14px;
  }

  /* Responsive */
  @media (max-width: 860px) {
    .trust-panel { display: none; }
    .login-card { padding: 36px 28px; }
    .login-root { background: #FFF8F2; }
  }
`;

// ── Tiny SVG icons ─────────────────────────────────────────
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ── Main Component ─────────────────────────────────────────
const LoginPage = () => {
  const { message } = App.useApp();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [form] = Form.useForm();
  const router=useRouter();

  function generateSessionToken() {
    return "sess_" + crypto.randomUUID();
  }

  useEffect(() => {
    if (countdown > 0) {
      const t = setInterval(() => setCountdown(p => p - 1), 1000);
      return () => clearInterval(t);
    } else if (countdown === 0 && step === 2) {
      setCanResend(true);
    }
  }, [countdown, step]);

  const onFinishEmail = async (values) => {
    setLoading(true);
    setEmail(values.email);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkEmail", email: values.email }),
      });
      const data = await res.json();
      if (!data.exists) { message.error("This email is not registered."); setLoading(false); return; }

      if (needsOTPVerification(values.email)) {
        const otpRes = await fetch("/api/opt-send-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", email: values.email }),
        });
        if (otpRes.ok) {
          message.success("OTP sent to your email!");
          setStep(2); setCountdown(OTP_TIMEOUT); setCanResend(false);
        } else {
          const d = await otpRes.json();
          message.error(d.error || "Failed to send OTP.");
        }
      } else {
        setStep(3);
        message.info("Please enter your password.");
      }
    } catch { message.error("An error occurred. Please try again."); }
    setLoading(false);
  };

  const onFinishOtp = async (values) => {
    setLoading(true);
    try {
      const verifyRes = await fetch("/api/opt-send-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, otp: values.otp }),
      });
      if (verifyRes.ok) {
        setLastVerification(email);
        message.success("OTP verified!");
        setStep(3);
      } else { message.error("OTP verification failed."); }
    } catch { message.error("An error occurred during verification."); }
    setLoading(false);
  };

  const onFinishPassword = async (values) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, values.password);
      const user = userCredential.user;
      let sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        sessionToken = generateSessionToken();
        localStorage.setItem("session_token", sessionToken);
      }
      await saveSession(user.uid, sessionToken);
      message.success("Login Successful!");
router.replace("/");
    } catch (error) { message.error(error.message || "Login failed."); }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { message.error("Please enter your email first."); setStep(1); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      message.success("Password reset link sent!");
    } catch (error) { message.error(error.message || "Failed to send reset link."); }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const otpRes = await fetch("/api/opt-send-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", email }),
    });
    if (otpRes.ok) {
      message.success("New OTP sent!");
      setCountdown(OTP_TIMEOUT); setCanResend(false);
    } else {
      const d = await otpRes.json();
      message.error(d.error || "Failed to resend OTP.");
    }
    setLoading(false);
  };

  const stepLabels = ["Email", "Verify", "Password"];

  return (
    <>
      <style>{globalStyles}</style>
      <div className="login-root">

        {/* ── Trust Panel ── */}
        <aside className="trust-panel">
          <div className="trust-emblem">
            <img src='/Images/marudhar_logo.png' alt="Logo" style={{ width: 80, height: 80 }} />
          </div>

          <div className="trust-name-devanagari">{TRUST_INFO.name}</div>
          <div className="trust-name-en">{TRUST_INFO.nameEn}</div>
          <div className="trust-divider" />

          {/* Address */}
          <div className="trust-detail-row">
            <div className="trust-detail-icon">📍</div>
            <div>
              <div className="trust-detail-label">Address</div>
              <div className="trust-detail-value" style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 12 }}>{TRUST_INFO.address}</div>
            </div>
          </div>

          {/* Phone */}
          <div className="trust-detail-row">
            <div className="trust-detail-icon">📞</div>
            <div>
              <div className="trust-detail-label">Contact</div>
              {TRUST_INFO.phone.map(p => (
                <div key={p} className="trust-detail-value">+91 {p}</div>
              ))}
            </div>
          </div>

          {/* Email */}
          <div className="trust-detail-row">
            <div className="trust-detail-icon">✉️</div>
            <div>
              <div className="trust-detail-label">Email</div>
              <div className="trust-detail-value">{TRUST_INFO.email}</div>
            </div>
          </div>

          {/* Reg No */}
          <div className="trust-detail-row">
            <div className="trust-detail-icon">🏛️</div>
            <div>
              <div className="trust-detail-label">Registration No.</div>
              <div className="trust-detail-value">{TRUST_INFO.regNo}</div>
            </div>
          </div>

          <div className="trust-badge">
            Est. <span>{TRUST_INFO.established}</span> · Pali, Rajasthan · Govt. Registered
          </div>
        </aside>

        {/* ── Login Side ── */}
        <main className="login-side">
          <div className="login-card">

            {/* Heading */}
            <div className="login-heading">Welcome back</div>
            <div className="login-subheading">
              Sign in to <span>{TRUST_INFO.nameEn}</span> portal
            </div>

            {/* Step indicator */}
            <div className="step-indicator">
              {stepLabels.map((_, i) => (
                <div
                  key={i}
                  className={`step-dot ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}
                />
              ))}
              <span style={{ fontSize: 11, color: C.grey, marginLeft: 8 }}>
                Step {step} of 3 — <span style={{ color: C.gold }}>{stepLabels[step - 1]}</span>
              </span>
            </div>

            {/* ─ Step 1: Email ─ */}
            {step === 1 && (
              <Form form={form} layout="vertical" onFinish={onFinishEmail} requiredMark={false} autoComplete="off">
                <div className="custom-input-wrap">
                  <div className="custom-label">Email Address</div>
                  <Form.Item name="email" rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Invalid email address' }]}>
                    <Input prefix={<IconMail />} placeholder="you@example.com" size="large" />
                  </Form.Item>
                </div>
                <button type="submit" className="btn-gold" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Checking...' : 'Continue →'}
                </button>
              </Form>
            )}

            {/* ─ Step 2: OTP ─ */}
            {step === 2 && (
              <Form form={form} layout="vertical" onFinish={onFinishOtp} requiredMark={false} autoComplete="off">
                <div className="custom-input-wrap">
                  <div className="custom-label">
                    <span>One-Time Password</span>
                    {countdown > 0
                      ? <span className="timer">{countdown}s</span>
                      : <span className="timer" style={{ color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)', background: 'rgba(255,107,107,0.08)' }}>Expired</span>
                    }
                  </div>
                  <Form.Item name="otp" rules={[{ required: true, message: 'Please enter the OTP' }, { len: 6, message: 'OTP must be 6 digits' }]}>
                    <Input prefix={<IconShield />} placeholder="6-digit OTP" maxLength={6} size="large" />
                  </Form.Item>
                </div>
                <div className="row-space">
                  <button type="button" className="btn-link" disabled={!canResend} onClick={handleResendOTP}>
                    Resend OTP
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                    ← Change email
                  </button>
                </div>
                <button type="submit" className="btn-gold" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Verifying...' : 'Verify OTP →'}
                </button>
              </Form>
            )}

            {/* ─ Step 3: Password ─ */}
            {step === 3 && (
              <Form form={form} layout="vertical" onFinish={onFinishPassword} requiredMark={false} autoComplete="off">
                <div className="custom-input-wrap">
                  <div className="custom-label">Password</div>
                  <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }, { min: 6, message: 'At least 6 characters' }]}>
                    <Input.Password prefix={<IconLock />} placeholder="Enter your password" size="large" />
                  </Form.Item>
                </div>
                <div className="row-space" style={{ marginTop: 10, marginBottom: 0 }}>
                  <span />
                  <button type="button" className="btn-link" onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>
                <button type="submit" className="btn-gold" disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Signing in...' : 'Sign In →'}
                </button>
              </Form>
            )}

            {/* Footer note */}
            <p style={{ textAlign: 'center', fontSize: 11.5, color: C.greyDim, marginTop: 28, letterSpacing: '0.03em' }}>
              🔒 Secured login · Data encrypted
            </p>
          </div>
        </main>

      </div>
    </>
  );
};

export default LoginPage;