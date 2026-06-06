import { useState } from "react";
import { Shield, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">PAE-Onc</span>
        </div>

        {!sent ? (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-1">Reset your password</h2>
            <p className="text-muted-foreground mb-6">Enter your email and we'll send a reset link.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@hospital.org"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <button onClick={() => setSent(true)} disabled={!email}
                className="w-full bg-primary text-white py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                Send Reset Link
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-6">
              We sent a password reset link to <strong>{email}</strong>.<br />
              Check your inbox and follow the instructions.
            </p>
            <p className="text-sm text-muted-foreground">
              Demo mode: no email is actually sent. Use password <strong>demo</strong> to sign in.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="#/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
