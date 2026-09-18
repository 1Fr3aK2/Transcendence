import { useState } from 'react';
import { registerUser } from '../api/users';
import { loginUser } from '../api/auth';

export default function RegisterModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await registerUser({ ...form, wallet: 0 });

      // Registration doesn't return a token, so log in right after
      // with the same credentials to get a real session going.
      const { access_token } = await loginUser({
        username: form.username,
        password: form.password,
      });

      onSuccess({ user, accessToken: access_token });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Register</h2>
        <form onSubmit={handleSubmit}>
          <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required minLength={8} />
          {error && <div className="modal-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
}