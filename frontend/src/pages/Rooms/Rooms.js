// ============================================================
//  Rooms.js — Room Management Page (logic + JSX only)
//  Icons  → ../../utils/icons/RoomsIcons.js
//  Styles → ../../styles/Rooms.css
// ============================================================

import React, { useState } from 'react';
import '../../styles/Rooms.css';
import {
  IcoPlus, IcoSearch, IcoFilter,
  IcoEye, IcoEdit, IcoTrash,
  IcoChevL, IcoChevR, IcoWarn,
  IcoWifi, IcoTV, IcoBath, IcoAC,
  IcoBed2, IcoCheck2, IcoUser2, IcoBrush, IcoWrench,
} from '../../utils/icons/RoomsIcons';

// ── Sample Data ───────────────────────────────────────────────
const INITIAL_ROOMS = [
  { id: 1, roomNo: '101', type: 'Deluxe Room',        floor: 1, capacity: '2 Adults',           price: '₹ 4,000',  status: 'Available',   amenities: ['wifi','tv','bath','ac'] },
  { id: 2, roomNo: '102', type: 'Deluxe Room',        floor: 1, capacity: '2 Adults',           price: '₹ 4,000',  status: 'Occupied',    amenities: ['wifi','tv','bath','ac'] },
  { id: 3, roomNo: '201', type: 'Premium Room',       floor: 2, capacity: '2 Adults + 1 Child', price: '₹ 5,500',  status: 'Occupied',    amenities: ['wifi','tv','bath','ac'] },
  { id: 4, roomNo: '202', type: 'Premium Room',       floor: 2, capacity: '2 Adults + 1 Child', price: '₹ 5,500',  status: 'Cleaning',    amenities: ['wifi','tv','bath','ac'] },
  { id: 5, roomNo: '301', type: 'Suite Room',         floor: 3, capacity: '4 Adults',           price: '₹ 8,500',  status: 'Available',   amenities: ['wifi','tv','bath','ac'] },
  { id: 6, roomNo: '302', type: 'Suite Room',         floor: 3, capacity: '4 Adults',           price: '₹ 8,500',  status: 'Maintenance', amenities: ['wifi','tv','bath','ac'] },
  { id: 7, roomNo: '401', type: 'Executive Room',     floor: 4, capacity: '2 Adults',           price: '₹ 6,000',  status: 'Available',   amenities: ['wifi','tv','bath','ac'] },
  { id: 8, roomNo: '501', type: 'Presidential Suite', floor: 5, capacity: '4 Adults + 2 Child', price: '₹ 15,000', status: 'Occupied',    amenities: ['wifi','tv','bath','ac'] },
];

const EMPTY_FORM = { roomNo: '', type: 'Deluxe Room', floor: '1', capacity: '2 Adults', price: '', status: 'Available' };
const PER_PAGE = 8;

// ── Helpers ───────────────────────────────────────────────────
const statusClass = (s) => {
  const map = { 'Available':'badge-available', 'Occupied':'badge-occupied', 'Cleaning':'badge-cleaning', 'Maintenance':'badge-maintenance', 'Reserved':'badge-reserved' };
  return `badge ${map[s] || ''}`;
};

// ════════════════════════════════════════════════════════════
//  COMPONENT
// ════════════════════════════════════════════════════════════
function Rooms() {
  const [rooms, setRooms]               = useState(INITIAL_ROOMS);
  const [search, setSearch]             = useState('');
  const [filterFloor, setFilterFloor]   = useState('All Floors');
  const [filterType, setFilterType]     = useState('All Room Types');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [page, setPage]                 = useState(1);

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showView, setShowView]     = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  // ── Filter logic ──
  const filtered = rooms.filter(r => {
    const matchSearch = r.roomNo.includes(search) || r.type.toLowerCase().includes(search.toLowerCase());
    const matchFloor  = filterFloor  === 'All Floors'     || r.floor === parseInt(filterFloor);
    const matchType   = filterType   === 'All Room Types'  || r.type  === filterType;
    const matchStatus = filterStatus === 'All Status'      || r.status === filterStatus;
    return matchSearch && matchFloor && matchType && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Stats ──
  const totalRooms       = rooms.length;
  const availableRooms   = rooms.filter(r => r.status === 'Available').length;
  const occupiedRooms    = rooms.filter(r => r.status === 'Occupied').length;
  const cleaningRooms    = rooms.filter(r => r.status === 'Cleaning').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'Maintenance').length;

  // ── Handlers ──
  const openAdd    = () => { setForm(EMPTY_FORM); setShowAdd(true); };
  const openEdit   = (r) => { setSelected(r); setForm({ roomNo: r.roomNo, type: r.type, floor: String(r.floor), capacity: r.capacity, price: r.price, status: r.status }); setShowEdit(true); };
  const openView   = (r) => { setSelected(r); setShowView(true); };
  const openDelete = (r) => { setSelected(r); setShowDelete(true); };

  const handleAdd = () => {
    setRooms(prev => [{ ...form, id: Date.now(), floor: parseInt(form.floor), amenities: ['wifi','tv','bath','ac'] }, ...prev]);
    setShowAdd(false);
  };

  const handleEdit = () => {
    setRooms(prev => prev.map(r => r.id === selected.id ? { ...r, ...form, floor: parseInt(form.floor) } : r));
    setShowEdit(false);
  };

  const handleDelete = () => {
    setRooms(prev => prev.filter(r => r.id !== selected.id));
    setShowDelete(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Shared Room Form Modal ──
  const RoomFormModal = ({ title, onSave, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="form-group">
              <label className="form-label">Room No.</label>
              <input className="form-input" name="roomNo" value={form.roomNo} onChange={handleFormChange} placeholder="e.g. 101" />
            </div>
            <div className="form-group">
              <label className="form-label">Floor</label>
              <select className="form-select" name="floor" value={form.floor} onChange={handleFormChange}>
                {[1,2,3,4,5].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Room Type</label>
              <select className="form-select" name="type" value={form.type} onChange={handleFormChange}>
                <option>Deluxe Room</option>
                <option>Premium Room</option>
                <option>Suite Room</option>
                <option>Executive Room</option>
                <option>Presidential Suite</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <select className="form-select" name="capacity" value={form.capacity} onChange={handleFormChange}>
                <option>2 Adults</option>
                <option>2 Adults + 1 Child</option>
                <option>4 Adults</option>
                <option>4 Adults + 2 Child</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Price / Night</label>
              <input className="form-input" name="price" value={form.price} onChange={handleFormChange} placeholder="e.g. ₹ 4,000" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleFormChange}>
                <option>Available</option>
                <option>Occupied</option>
                <option>Cleaning</option>
                <option>Maintenance</option>
                <option>Reserved</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={onSave}>Save Room</button>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Rooms</h2>
          <p>Manage all hotel rooms and their availability</p>
        </div>
        <div className="page-header-right">
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search by room no. or type..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <IcoSearch />
          </div>
          <button className="btn-add-room" onClick={openAdd}>
            <IcoPlus /> Add New Room
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <select className="filter-select" value={filterFloor} onChange={e => { setFilterFloor(e.target.value); setPage(1); }}>
          <option>All Floors</option>
          {[1,2,3,4,5].map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>
        <select className="filter-select" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option>All Room Types</option>
          <option>Standard</option>
          <option>Deluxe</option>
          <option>Suite</option>
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option>All Status</option>
          <option>Available</option>
          <option>Occupied</option>
          <option>Cleaning</option>
          <option>Maintenance</option>
          <option>Reserved</option>
        </select>
        <div className="filter-spacer" />
        <button className="btn-filter"><IcoFilter /> Filter</button>
      </div>

      {/* ── Rooms Table ── */}
      <div className="rooms-card">
        <table className="rooms-table">
          <thead>
            <tr>
              <th>Room No.</th>
              <th>Room Type</th>
              <th>Floor</th>
              <th>Capacity</th>
              <th>Price / Night</th>
              <th>Status</th>
              <th>Amenities</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No rooms found.</td></tr>
            ) : (
              paginated.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.roomNo}</td>
                  <td>{r.type}</td>
                  <td>{r.floor}</td>
                  <td>{r.capacity}</td>
                  <td style={{ fontWeight: 600 }}>{r.price}</td>
                  <td><span className={statusClass(r.status)}>{r.status}</span></td>
                  <td>
                    <div className="amenities">
                      {r.amenities.includes('wifi') && <IcoWifi />}
                      {r.amenities.includes('tv')   && <IcoTV />}
                      {r.amenities.includes('bath') && <IcoBath />}
                      {r.amenities.includes('ac')   && <IcoAC />}
                    </div>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon btn-icon-view"   title="View"   onClick={() => openView(r)}><IcoEye /></button>
                      <button className="btn-icon btn-icon-edit"   title="Edit"   onClick={() => openEdit(r)}><IcoEdit /></button>
                      <button className="btn-icon btn-icon-delete" title="Delete" onClick={() => openDelete(r)}><IcoTrash /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} rooms
          </span>
          <div className="pagination-btns">
            <button className="pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}><IcoChevL /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} className={`pg-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages || totalPages === 0}><IcoChevR /></button>
          </div>
        </div>
      </div>

      {/* ── Bottom Stat Cards ── */}
      <div className="room-stats">
        <div className="rstat-card">
          <div className="rstat-icon blue"><IcoBed2 /></div>
          <div className="rstat-info">
            <div className="rstat-label">Total Rooms</div>
            <div className="rstat-value">{totalRooms}</div>
            <div className="rstat-sub">All Rooms in Hotel</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon green"><IcoCheck2 /></div>
          <div className="rstat-info">
            <div className="rstat-label">Available Rooms</div>
            <div className="rstat-value">{availableRooms}</div>
            <div className="rstat-sub">{Math.round((availableRooms / totalRooms) * 100)}% of Total</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon indigo"><IcoUser2 /></div>
          <div className="rstat-info">
            <div className="rstat-label">Occupied Rooms</div>
            <div className="rstat-value">{occupiedRooms}</div>
            <div className="rstat-sub">{Math.round((occupiedRooms / totalRooms) * 100)}% of Total</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon orange"><IcoBrush /></div>
          <div className="rstat-info">
            <div className="rstat-label">Cleaning Rooms</div>
            <div className="rstat-value">{cleaningRooms}</div>
            <div className="rstat-sub">{Math.round((cleaningRooms / totalRooms) * 100)}% of Total</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon red"><IcoWrench /></div>
          <div className="rstat-info">
            <div className="rstat-label">Maintenance Rooms</div>
            <div className="rstat-value">{maintenanceRooms}</div>
            <div className="rstat-sub">{Math.round((maintenanceRooms / totalRooms) * 100)}% of Total</div>
          </div>
        </div>
      </div>

      {/* ══════════ MODALS ══════════ */}

      {showAdd  && <RoomFormModal title="+ Add New Room" onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {showEdit && <RoomFormModal title="Edit Room"      onSave={handleEdit} onClose={() => setShowEdit(false)} />}

      {/* View Modal */}
      {showView && selected && (
        <div className="modal-overlay" onClick={() => setShowView(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Room Details — {selected.roomNo}</h3>
              <button className="modal-close" onClick={() => setShowView(false)}>×</button>
            </div>
            <div className="modal-body">
              {[
                ['Room No.',    selected.roomNo],
                ['Room Type',   selected.type],
                ['Floor',       selected.floor],
                ['Capacity',    selected.capacity],
                ['Price/Night', selected.price],
                ['Status',      selected.status],
                ['Amenities',   'WiFi, TV, Bathroom, AC'],
              ].map(([k, v]) => (
                <div className="detail-row" key={k}>
                  <span className="detail-key">{k}</span>
                  <span className="detail-value">{v}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-save" onClick={() => setShowView(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && selected && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal-box confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Room</h3>
              <button className="modal-close" onClick={() => setShowDelete(false)}>×</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon red"><IcoWarn /></div>
              <h4>Delete Room {selected.roomNo}?</h4>
              <p>This room will be permanently deleted. This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Rooms;
