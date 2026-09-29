"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, LockKeyhole, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function PhoneOtpForm({ mode = "login" }: { mode?: AuthMode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const supabase = createClient();
  
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const continueTo = isSignup ? "/onboarding" : "/workspace";
  const canSubmit = isSignup ? email.includes("@") && password.length >= 8 : email.includes("@") && password.length > 0;

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: email.split("@")[0] }
          }
        });
        if (error) throw error;
        
        router.push("/onboarding");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        router.push("/workspace");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email.includes("@") || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${continueTo}`,
        }
      });
      if (error) throw error;
      
      setAuthMode("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== 6 || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      
      router.push(continueTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const switchToOtp = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setAuthMode("otp");
  };

  const switchToPassword = () => {
    setAuthMode("password");
    setCode("");
  };

  return (
    <main className="grid min-h-screen bg-[#090b18] lg:grid-cols-[1fr_.92fr]">
      <AuthStory />
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-12 flex items-center justify-between">
            <Link href={isSignup ? "/login" : "/"} className="inline-flex items-center gap-1 text-xs font-semibold text-[#a5abc9] hover:text-white">
              <ChevronLeft size={15} />{isSignup ? "Sign in" : "Home"}
            </Link>
            <div className="lg:hidden"><Brand compact /></div>
          </div>
          <div className="rounded-2xl border border-[#30345f] bg-[#0f1430] p-6 shadow-[0_20px_70px_rgba(0,0,0,.25)] sm:p-8">
            <span className="eyebrow">{isSignup ? "Create your account" : "Customer sign in"}</span>
            
            {authMode === "password" ? (
              <>
                <h1 className="mt-5 font-display text-4xl leading-none">
                  {isSignup ? "Start your intelligence workspace." : "Welcome back."}
                </h1>
                <p className="mt-4 text-sm leading-6 text-[#bfc3dc]">
                  {isSignup 
                    ? "Create an account, tell us about yourself, then choose the AI domain you want to follow."
                    : "Sign in to continue tracking your saved research and AI market intelligence."
                  }
                </p>
                
                {error && (
                  <div className="mt-4 rounded-md border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696] flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
                
                <form className="mt-8" onSubmit={submitPassword}>
                  <label className="block text-xs font-semibold text-[#d9ddf3]">
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      className="mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-3 py-3 text-sm text-white outline-none transition focus:border-[#8993ff]"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={loading}
                    />
                  </label>
                  <label className="mt-5 block text-xs font-semibold text-[#d9ddf3]">
                    Password
                    <input
                      name="password"
                      type="password"
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      minLength={isSignup ? 8 : undefined}
                      className="mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-3 py-3 text-sm text-white outline-none transition focus:border-[#8993ff]"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                    />
                  </label>
                  
                  {isSignup && (
                    <label className="mt-5 flex items-center gap-2 text-xs text-[#a5abc9]">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                        className="rounded border-[#30345f] bg-[#111735] text-[#6c72f3] focus:ring-[#6c72f3]"
                      />
                      Remember me for 30 days
                    </label>
                  )}
                  
                  <button
                    type="submit"
                    disabled={!canSubmit || loading}
                    className={`mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      loading 
                        ? "bg-[#6c72f3] opacity-70" 
                        : canSubmit 
                          ? "bg-[#6c72f3] hover:bg-[#8187ff]" 
                          : "bg-[#3a3f6b]"
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Signing in...
                      </>
                    ) : (
                      <>
                        {isSignup ? "Create account" : "Sign in"}
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
                
                <div className="mt-6">
                  <p className="text-center text-xs text-[#a5abc9]">
                    Or <button onClick={switchToOtp} className="font-semibold text-[#aeb6ff] hover:underline">continue with email code</button>
                  </p>
                </div>
                
                {!isSignup && (
                  <p className="mt-4 text-center text-xs text-[#a5abc9]">
                    <Link href="/forgot-password" className="font-semibold text-[#aeb6ff] hover:underline">Forgot password?</Link>
                  </p>
                )}
              </>
            ) : (
              <OtpPanel
                email={email}
                code={code}
                setCode={setCode}
                loading={loading}
                error={error}
                onBack={switchToPassword}
                onVerify={verifyOtp}
                onResend={sendOtp}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function OtpPanel({ 
  email, 
  code, 
  setCode, 
  loading, 
  error, 
  onBack, 
  onVerify,
  onResend
}: { 
  email: string;
  code: string; 
  setCode: (value: string) => void; 
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onVerify: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onVerify(event);
  };

  const handleResend = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await onResend();
  };

  return (
    <>
      <h1 className="mt-5 font-display text-4xl leading-none">Check your email.</h1>
      <p className="mt-4 text-sm leading-6 text-[#bfc3dc]">
        Enter the six-digit code sent to <span className="font-semibold text-white">{email}</span>.
      </p>
      
      {error && (
        <div className="mt-4 rounded-md border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696] flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      
      <form onSubmit={handleVerify} className="mt-6">
        <input
          aria-label="Verification code"
          className="w-full rounded-md border border-[#30345f] bg-[#111735] px-4 py-4 text-center font-mono text-xl tracking-[.45em] text-white outline-none transition focus:border-[#8993ff]"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          autoFocus
          disabled={loading}
        />
        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className={`mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            code.length === 6 ? "bg-[#6c72f3] hover:bg-[#8187ff]" : "bg-[#3a3f6b]"
          }`}
        >
          {loading ? "Verifying..." : "Continue"}
          <Check size={15} />
        </button>
      </form>
      
      <div className="mt-5 flex items-center justify-between">
        <button 
          type="button" 
          onClick={onBack} 
          className="text-xs font-semibold text-[#aeb6ff] hover:underline"
          disabled={loading}
        >
          ← Use password instead
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="text-xs font-semibold text-[#aeb6ff] hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </>
  );
}

function AuthStory() { 
  return (
    <section className="relative hidden overflow-hidden border-r border-[#282d5b] bg-[#0d1025] p-10 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute -left-28 top-1/3 h-96 w-96 rounded-full bg-[#5961d4]/20 blur-3xl" />
      <Brand />
      <div className="relative my-auto max-w-lg">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb6ff]">
          Your market intelligence workspace
        </p>
        <h2 className="mt-5 font-display text-6xl leading-[.94]">
          Stay close to the market.<br />
          <em className="text-[#aeb6ff]">Keep your context.</em>
        </h2>
        <p className="mt-7 max-w-md text-sm leading-7 text-[#bfc3dc]">
          Track investment, market patterns, and source-backed intelligence from the domain you choose.
        </p>
        <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
          {[
            ["Signals", "Evidence-first"], 
            ["Capital", "Company tracking"], 
            ["Memory", "Saved context"]
          ].map(([label, detail]) => (
            <div key={label} className="rounded-lg border border-[#30345f] bg-[#111735]/80 p-3">
              <Sparkles size={14} className="text-[#aeb6ff]" />
              <p className="mt-4 text-xs font-semibold">{label}</p>
              <p className="mt-1 text-[10px] leading-4 text-[#a5abc9]">{detail}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex items-center gap-2 border-t border-[#30345f] pt-5 text-xs text-[#a5abc9]">
        <ShieldCheck size={15} className="text-[#aeb6ff]" />
        Private workspace data · Evidence lineage retained
      </div>
    </section>
  ); 
}

function Brand({ compact = false }: { compact?: boolean }) { 
  return (
    <Link href="/login" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-sm border border-[#8993ff] font-display text-2xl text-[#aeb6ff]">i</span>
      {!compact && <span className="text-[13px] font-bold">intelligence<span className="text-[#8993ff]">.</span></span>}
    </Link>
  ); 
}