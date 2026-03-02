import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cloud, ArrowRight } from "lucide-react";
import { AuthActionError } from "@/hooks/usePhotoLibrary";
import { cn } from "@/lib/utils";

const SLIDES = [
  "Swaraj Cloud Company",
  "Free Cloud Service",
  "Create Your Own Desktop Hosted Cloud",
];

interface LandingPageProps {
  login: (loginId: string, password: string) => Promise<void>;
  register: (loginId: string, password: string) => Promise<void>;
  authError: string | null;
  authNotice: string | null;
}

const LandingPage: React.FC<LandingPageProps> = ({
  login,
  register,
  authError,
  authNotice,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideVisible, setSlideVisible] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const loginIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Slide rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideVisible(false);
      setTimeout(() => {
        setSlideIndex((i) => (i + 1) % SLIDES.length);
        setSlideVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  const resetForm = useCallback(() => {
    setLoginId("");
    setPassword("");
    setConfirmPassword("");
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const id = loginId.trim();
    if (!id || !password) {
      setFormError("Login ID and password are required.");
      triggerShake();
      return;
    }
    setLoading(true);
    try {
      await login(id, password);
    } catch (error) {
      const authCode =
        error instanceof AuthActionError ? error.code : "";
      const msg =
        error instanceof Error ? error.message : "Authentication failed.";

      if (authCode === "USER_NOT_FOUND") {
        setFormError("User not found. Create a new account.");
        setShowRegister(true);
        setShowSignIn(false);
      } else if (authCode === "INVALID_PASSWORD") {
        setFormError("Incorrect password.");
      } else if (msg.toLowerCase().includes("failed to fetch")) {
        setFormError("Cannot reach server. Check your connection.");
      } else {
        setFormError(msg);
      }
      triggerShake();
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const id = loginId.trim();
    if (!id || !password) {
      setFormError("Login ID and password are required.");
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      triggerShake();
      resetForm();
      return;
    }
    setLoading(true);
    try {
      await register(id, password);
      setFormError(null);
      setShowRegister(false);
      setShowSignIn(true);
      resetForm();
    } catch (error) {
      const authCode =
        error instanceof AuthActionError ? error.code : "";
      const msg =
        error instanceof Error ? error.message : "Registration failed.";

      if (authCode === "USER_EXISTS") {
        setFormError("Username already exists. Choose another.");
      } else {
        setFormError(msg);
      }
      triggerShake();
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl animate-pulse" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Top navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-primary-foreground/10 bg-primary-foreground/10 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary-foreground" />
          <span className="text-lg font-bold tracking-tight text-primary-foreground">
            Swaraj Cloud
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!showSignIn && !showRegister && (
            <Button
              size="sm"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
              onClick={() => {
                setShowSignIn(true);
                setShowRegister(false);
                setFormError(null);
                resetForm();
              }}
            >
              Sign In
            </Button>
          )}
          {(showSignIn || showRegister) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                setShowSignIn(false);
                setShowRegister(false);
                setFormError(null);
                resetForm();
              }}
            >
              ✕ Close
            </Button>
          )}
        </div>
      </nav>

      {/* Main content area */}
      <div className="relative flex flex-1">
        {/* Left side – hero slides (always visible) */}
        <div
          className={cn(
            "flex flex-col items-center justify-center transition-all duration-500 ease-in-out px-8",
            showRegister ? "w-1/3" : "w-full"
          )}
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-2xl bg-primary-foreground/10 p-5 backdrop-blur-sm">
              <Cloud className="h-16 w-16 text-primary-foreground" />
            </div>
            <h1
              className={cn(
                "text-4xl font-extrabold tracking-tight text-primary-foreground transition-all duration-500 md:text-5xl lg:text-6xl drop-shadow-lg",
                slideVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              )}
            >
              {SLIDES[slideIndex]}
            </h1>
            <p className="max-w-lg text-lg text-primary-foreground/70">
              Your personal cloud storage — fast, free, and fully under your
              control.
            </p>
            {/* Slide dots */}
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === slideIndex
                      ? "w-8 bg-primary-foreground"
                      : "w-2 bg-primary-foreground/30"
                  )}
                />
              ))}
            </div>
            {!showSignIn && !showRegister && (
              <Button
                size="lg"
                className="mt-4 gap-2 bg-primary-foreground text-primary shadow-xl hover:bg-primary-foreground/90 hover:scale-105 transition-transform"
                onClick={() => {
                  setShowRegister(true);
                  setShowSignIn(false);
                  setFormError(null);
                  resetForm();
                }}
              >
                Create New Account <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Sign-in dropdown (small overlay from top-right) */}
        {showSignIn && (
          <div className="absolute right-6 top-4 z-40 w-80 animate-fade-in">
            <form
              onSubmit={handleSignIn}
              className={cn(
                "rounded-2xl border border-primary-foreground/10 p-5 space-y-3 backdrop-blur-xl",
                shaking && "animate-shake"
              )}
              style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
            >
              <h2 className="text-lg font-semibold text-foreground">Sign In</h2>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Login ID</label>
                <Input
                  ref={loginIdRef}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="your username"
                  autoComplete="username"
                  className="border-primary/20 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="border-primary/20 focus-visible:ring-primary"
                />
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              {authNotice && !formError && (
                <p className="text-sm text-secondary">{authNotice}</p>
              )}
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowSignIn(false);
                  setShowRegister(true);
                  setFormError(null);
                  resetForm();
                }}
              >
                New user? <span className="font-semibold text-accent ml-1">Create Account</span>
              </Button>
            </form>
          </div>
        )}

        {/* Register panel (right 2/3 of screen) */}
        {showRegister && (
          <div className="flex w-2/3 items-center justify-center border-l border-primary-foreground/10 bg-primary-foreground/5 px-8 backdrop-blur-md animate-slide-in-right">
            <form
              onSubmit={handleRegister}
              className={cn(
                "w-full max-w-md space-y-5 rounded-2xl border border-primary-foreground/10 p-8",
                shaking && "animate-shake"
              )}
              style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}
            >
              <div>
                <h2 className="text-3xl font-extrabold text-foreground">
                  Create <span className="text-accent">New Account</span>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your photos, your cloud, your rules.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Username
                </label>
                <Input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="choose a username"
                  autoComplete="username"
                  className="border-primary/20 focus-visible:ring-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 6 characters"
                  autoComplete="new-password"
                  className="border-primary/20 focus-visible:ring-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="re-enter password"
                  autoComplete="new-password"
                  className="border-primary/20 focus-visible:ring-accent"
                />
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              {authNotice && !formError && (
                <p className="text-sm text-secondary">{authNotice}</p>
              )}
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" type="submit" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm text-primary-foreground/70 hover:text-foreground"
                onClick={() => {
                  setShowRegister(false);
                  setShowSignIn(true);
                  setFormError(null);
                  resetForm();
                }}
              >
                Already have an account? <span className="font-semibold text-primary ml-1">Sign In</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
