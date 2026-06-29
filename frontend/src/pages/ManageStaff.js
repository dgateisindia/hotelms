import { useState, useEffect } from 'react';
import userService from '../services/userService';

const ROLE_OPTIONS = ['admin', 'receptionist', 'housekeeping', 'accountant'];

const ManageStaff = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [staffList, setStaffList] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStaff = async () => {
    try {
      const res = await userService.getStaffUsers();
      setStaffList(res.users);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res = await userService.createStaffUser(form);
      setMessage(res.message);
      setForm({ name: '', email: '', password: '', role: '' });
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manage-staff-page">
      <h2>Create Staff Account</h2>

      {message && <p className="success-msg">{message}</p>}
      {error && <p className="error-msg">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Temporary Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <select name="role" value={form.role} onChange={handleChange} required>
          <option value="">Select Role</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
      </form>

      <h3>Existing Staff</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {staffList.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.email}</td>
              <td>{s.role}</td>
              <td>{new Date(s.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ManageStaff;