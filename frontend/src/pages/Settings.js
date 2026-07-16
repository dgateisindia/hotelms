// ============================================================
//  Settings.js — System Settings Page (logic + JSX only)
//  Tabs: General, Users & Roles, Integrations, Email Templates,
//        Payment Settings, Preferences, Security, Backup
//  Sections: General Settings, Notification Settings, Email
//            Settings, System Preferences, Third-party
//            Integrations, Data Backup, Current User,
//            System Status, Recent Activity
//  Icons  → ../../utils/icons/SettingsIcons.js
//  Styles → ../../styles/Settings.css
// ============================================================

import React, { useState } from 'react';
import '../styles/Settings.css';
import {
  IcoBell, IcoCancel, IcoRupee, IcoBox, IcoStaff, IcoEye,
  IcoUser, IcoLock, IcoLogs, IcoDownload, IcoCircle, IcoChevron,
} from '../utils/icons/SettingsIcons';

// ── Constants ─────────────────────────────────────────────────
const AVATAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6'];
const initials = (name) => name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

const TABS = ['General','Users & Roles','Integrations','Email Templates','Payment Settings','Preferences','Security','Backup'];

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_GENERAL = {
  hotelName: 'Royal Palace Hotel & Resort',
  currency: 'INR (₹) - Indian Rupee',
  language: 'English',
  timezone: '(GMT +05:30) India Standard Time',
  dateFormat: 'DD MMMM YYYY (31 May 2024)',
  timeFormat: '12 Hours (hh:mm AM/PM)',
};

const NOTIFICATIONS_DEFAULT = [
  { key:'newBooking',     title:'New Booking Alerts',     sub:'Get notified for new bookings',   icon:<IcoBell/>,   on:true  },
  { key:'cancellation',   title:'Cancellation Alerts',     sub:'Get notified for cancellations',  icon:<IcoCancel/>, on:true  },
  { key:'payment',        title:'Payment Notifications',   sub:'Get notified for payments',       icon:<IcoRupee/>,  on:true  },
  { key:'lowInventory',   title:'Low Inventory Alerts',    sub:'Get notified for low stock',      icon:<IcoBox/>,    on:true  },
  { key:'staffAttend',    title:'Staff Attendance Alerts', sub:'Get notified for attendance issues', icon:<IcoStaff/>, on:false },
];

const EMAIL_SETTINGS_DEFAULT = {
  smtpServer: 'smtp.royalpalace.com',
  port: '587',
  email: 'no-reply@royalpalace.com',
  password: '••••••••••••',
};

const SYSTEM_PREFS_DEFAULT = [
  { key:'walkIn',    label:'Allow Walk-in Bookings',  on:true },
  { key:'autoAssign',label:'Auto Assign Room',        on:true },
  { key:'idProof',   label:'Require ID Proof',        on:true },
  { key:'multiProp', label:'Enable Multi-property',   on:false },
  { key:'showTax',   label:'Show Taxes in Bill',      on:true },
];

const INTEGRATIONS = [
  { name:'Payment Gateway (Razorpay)', status:'Connected' },
  { name:'Channel Manager',            status:'Connected' },
  { name:'Email Service (SendGrid)',   status:'Connected' },
  { name:'SMS Gateway (MSG91)',        status:'Not Connected' },
  { name:'Accounting (TallyPrime)',    status:'Connected' },
];

const BACKUP_INFO = {
  lastBackup: '31 May 2024, 02:30 AM',
  frequency: 'Daily',
  retention: '30 Days',
};

const CURRENT_USER = { name:'Arjun Mehta', role:'System Administrator', badge:'Super Admin' };

const SYSTEM_STATUS = [
  { label:'System Uptime',  value:'99.9%',    color:'green'  },
  { label:'Database Status',value:'Healthy',  color:'green', isText:true },
  { label:'Server Status',  value:'Healthy',  color:'green', isText:true },
  { label:'Storage Usage',  value:'38%',      color:'orange' },
  { label:'Active Users',   value:'24',       color:'green', isText:true },
];

const RECENT_ACTIVITY = [
  { name:'Arjun Mehta',  action:'Updated general settings', time:'31 May 2024, 10:30 AM' },
  { name:'Priya Sharma', action:'Added new staff member',   time:'31 May 2024, 09:45 AM' },
  { name:'Vikram Das',   action:'Processed payroll',        time:'31 May 2024, 09:10 AM' },
  { name:'System',       action:'Daily backup completed',   time:'31 May 2024, 02:30 AM' },
];

// ── Toggle Switch Component ─────────────────────────────────
const ToggleSwitch = ({ checked, onChange }) => (
  <label className="toggle-switch">
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="toggle-slider"/>
  </label>
);

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Settings() {
  const [activeTab, setActiveTab]   = useState('General');
  const [general, setGeneral]       = useState(INITIAL_GENERAL);
  const [notifications, setNotifications] = useState(NOTIFICATIONS_DEFAULT);
  const [emailSettings, setEmailSettings] = useState(EMAIL_SETTINGS_DEFAULT);
  const [showPassword, setShowPassword]   = useState(false);
  const [systemPrefs, setSystemPrefs]     = useState(SYSTEM_PREFS_DEFAULT);
  const [connTested, setConnTested]       = useState(true);

  // ── Handlers ──
  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneral(prev => ({ ...prev, [name]: value }));
  };

  const toggleNotification = (key) => {
    setNotifications(prev => prev.map(n => n.key===key ? { ...n, on: !n.on } : n));
  };

  const toggleSystemPref = (key) => {
    setSystemPrefs(prev => prev.map(p => p.key===key ? { ...p, on: !p.on } : p));
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveGeneral = () => {
    alert('General settings saved successfully!');
  };

  const handleSaveNotifications = () => {
    alert('Notification preferences saved!');
  };

  const handleTestConnection = () => {
    setConnTested(true);
    alert('SMTP connection test successful!');
  };

  const handleSaveSystemPrefs = () => {
    alert('System preferences saved!');
  };

  const handleBackupNow = () => {
    alert('Backup started! This may take a few minutes.');
  };

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <h2>System Settings</h2>
        <p>Configure system preferences, manage users and roles, configure integrations and ensure the system works the way you need.</p>
      </div>

      {/* ── Tabs ── */}
      <div className="settings-tabs">
        {TABS.map(tab => (
          <button key={tab} className={`settings-tab ${activeTab===tab?'active':''}`} onClick={()=>setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="settings-layout">

        {/* ── LEFT: Settings forms ── */}
        <div>
          {activeTab === 'General' && (
            <>
              {/* Row 1: General Settings | Notification Settings | Email Settings */}
              <div className="settings-row">

                {/* General Settings */}
                <div className="settings-card">
                  <div className="settings-card-title">General Settings</div>
                  <div className="set-form-group">
                    <label className="set-label">Hotel Name</label>
                    <input className="set-input" name="hotelName" value={general.hotelName} onChange={handleGeneralChange}/>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Currency</label>
                    <select className="set-select" name="currency" value={general.currency} onChange={handleGeneralChange}>
                      <option>INR (₹) - Indian Rupee</option>
                      <option>USD ($) - US Dollar</option>
                      <option>EUR (€) - Euro</option>
                      <option>GBP (£) - British Pound</option>
                    </select>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Language</label>
                    <select className="set-select" name="language" value={general.language} onChange={handleGeneralChange}>
                      <option>English</option><option>Hindi</option><option>Spanish</option><option>French</option>
                    </select>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Timezone</label>
                    <select className="set-select" name="timezone" value={general.timezone} onChange={handleGeneralChange}>
                      <option>(GMT +05:30) India Standard Time</option>
                      <option>(GMT +00:00) UTC</option>
                      <option>(GMT -05:00) Eastern Time</option>
                    </select>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Date Format</label>
                    <select className="set-select" name="dateFormat" value={general.dateFormat} onChange={handleGeneralChange}>
                      <option>DD MMMM YYYY (31 May 2024)</option>
                      <option>MM/DD/YYYY (05/31/2024)</option>
                      <option>DD/MM/YYYY (31/05/2024)</option>
                    </select>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Time Format</label>
                    <select className="set-select" name="timeFormat" value={general.timeFormat} onChange={handleGeneralChange}>
                      <option>12 Hours (hh:mm AM/PM)</option>
                      <option>24 Hours (HH:mm)</option>
                    </select>
                  </div>
                  <button className="btn-save-settings" onClick={handleSaveGeneral}>Save Changes</button>
                </div>

                {/* Notification Settings */}
                <div className="settings-card">
                  <div className="settings-card-title">Notification Settings</div>
                  {notifications.map(n => (
                    <div className="notif-row" key={n.key}>
                      <div className="notif-icon">{n.icon}</div>
                      <div className="notif-info">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-sub">{n.sub}</div>
                      </div>
                      <ToggleSwitch checked={n.on} onChange={()=>toggleNotification(n.key)}/>
                    </div>
                  ))}
                  <button className="btn-save-settings" onClick={handleSaveNotifications}>Save Preferences</button>
                </div>

                {/* Email Settings */}
                <div className="settings-card">
                  <div className="settings-card-title">Email Settings</div>
                  <div className="set-form-group">
                    <label className="set-label">SMTP Server</label>
                    <input className="set-input" name="smtpServer" value={emailSettings.smtpServer} onChange={handleEmailChange}/>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Port</label>
                    <input className="set-input" name="port" value={emailSettings.port} onChange={handleEmailChange}/>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Email</label>
                    <input className="set-input" name="email" value={emailSettings.email} onChange={handleEmailChange}/>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Password</label>
                    <div className="set-input-wrap">
                      <input className="set-input" type={showPassword?'text':'password'} name="password" value={emailSettings.password} onChange={handleEmailChange} style={{paddingRight:36}}/>
                      <button className="set-eye-btn" onClick={()=>setShowPassword(p=>!p)}><IcoEye open={showPassword}/></button>
                    </div>
                  </div>
                  {connTested && <div className="set-success">✓ Connection Successful</div>}
                  <button className="btn-test-conn" onClick={handleTestConnection}>Test Connection</button>
                </div>
              </div>

              {/* Row 2: System Preferences | Third-party Integrations | Data Backup */}
              <div className="settings-row">

                {/* System Preferences */}
                <div className="settings-card">
                  <div className="settings-card-title">System Preferences</div>
                  {systemPrefs.map(p => (
                    <div className="toggle-list-row" key={p.key}>
                      <span className="toggle-list-label">{p.label}</span>
                      <ToggleSwitch checked={p.on} onChange={()=>toggleSystemPref(p.key)}/>
                    </div>
                  ))}
                  <button className="btn-save-settings" onClick={handleSaveSystemPrefs}>Save Preferences</button>
                </div>

                {/* Third-party Integrations */}
                <div className="settings-card">
                  <div className="settings-card-title">Third-party Integrations</div>
                  {INTEGRATIONS.map(i => (
                    <div className="integ-row" key={i.name}>
                      <div>
                        <div className="integ-name">{i.name}</div>
                        <div className={`integ-status ${i.status==='Connected'?'connected':'notconnected'}`}>{i.status}</div>
                      </div>
                      <button className="btn-manage">Manage</button>
                    </div>
                  ))}
                  <button className="btn-view-link">View All Integrations</button>
                </div>

                {/* Data Backup */}
                <div className="settings-card">
                  <div className="settings-card-title">Data Backup</div>
                  <div className="backup-info-row"><span className="backup-key">Last Backup</span></div>
                  <div className="backup-value" style={{marginBottom:12}}>{BACKUP_INFO.lastBackup}</div>

                  <div className="set-form-group">
                    <label className="set-label">Backup Frequency</label>
                    <select className="set-select">
                      <option>Daily</option><option>Weekly</option><option>Monthly</option>
                    </select>
                  </div>
                  <div className="set-form-group">
                    <label className="set-label">Backup Retention</label>
                    <select className="set-select">
                      <option>30 Days</option><option>60 Days</option><option>90 Days</option>
                    </select>
                  </div>
                  <button className="btn-backup-now" onClick={handleBackupNow}><IcoDownload/> Backup Now</button>
                </div>
              </div>
            </>
          )}

          {/* Placeholder for other tabs */}
          {activeTab !== 'General' && (
            <div className="settings-card" style={{textAlign:'center',padding:'60px 20px',color:'#9ca3af'}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>{activeTab}</div>
              <div style={{fontSize:13}}>This section is under construction. Connect your backend to populate {activeTab.toLowerCase()} settings here.</div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="settings-sidebar">

          {/* Current User */}
          <div className="curuser-card">
            <div className="curuser-title">Current User</div>
            <div className="curuser-info">
              <div className="curuser-avatar">{initials(CURRENT_USER.name)}</div>
              <div>
                <div className="curuser-name">{CURRENT_USER.name}</div>
                <div className="curuser-role">{CURRENT_USER.role}</div>
                <span className="curuser-badge">{CURRENT_USER.badge}</span>
              </div>
            </div>
            <div className="curuser-links">
              <div className="curuser-link"><IcoUser/> My Profile</div>
              <div className="curuser-link"><IcoLock/> Change Password</div>
            </div>
          </div>

          {/* System Status */}
          <div className="sysstatus-card">
            <div className="sysstatus-title">System Status</div>
            {SYSTEM_STATUS.map(s => (
              <div className="sysstatus-row" key={s.label}>
                <span className={`sysstatus-dot ${s.color}`}><IcoCircle/></span>
                <span className="sysstatus-label">{s.label}</span>
                <span className={`sysstatus-value ${s.isText?'healthy':'percent'}`}>{s.value}</span>
              </div>
            ))}
            <button className="btn-view-logs"><IcoLogs/> View System Logs</button>
          </div>

          {/* Recent Activity */}
          <div className="recent-act-card">
            <div className="recent-act-title">Recent Activity</div>
            {RECENT_ACTIVITY.map((a,i) => (
              <div className="act-item" key={i}>
                <div className="act-avatar" style={{background: a.name==='System' ? '#9ca3af' : AVATAR_COLORS[i%AVATAR_COLORS.length]}}>
                  {a.name==='System' ? '⚙' : initials(a.name)}
                </div>
                <div className="act-info">
                  <div className="act-text"><span className="act-name">{a.name}</span> {a.action}</div>
                  <div className="act-time">{a.time}</div>
                </div>
              </div>
            ))}
            <div className="view-all-link">View All Activity Logs</div>
          </div>
        </div>
      </div>
    </>
  );
}
export default Settings;

