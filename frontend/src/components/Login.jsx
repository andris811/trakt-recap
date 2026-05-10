import { useState } from 'react';

export default function Login({ onLogin, error }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/icon.png" alt="Trakt Recap" className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Trakt Recap</h1>
          <p className="text-zinc-500 text-sm mt-1">Enter password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-zinc-500"
          />
          {error && (
            <p className="text-red-400 text-sm text-center">Incorrect password</p>
          )}
          <button
            type="submit"
            disabled={!password.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
