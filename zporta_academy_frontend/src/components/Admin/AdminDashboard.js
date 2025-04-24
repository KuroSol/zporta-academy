import React from 'react';
import { Link } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = ({ onLogout }) => {
    return (
        <div className="admin-dashboard">
            <aside className="sidebar">
                <h3>Admin Panel</h3>
                <nav>
                    <ul>
                        <li><Link to="/admin/create-page">Create Page</Link></li>
                        <li><Link to="/admin/create-post">Create Post</Link></li> {/* Added link for Create Post */}
                        <li><Link to="/admin/posts">Manage Posts</Link></li>
                        <li><Link to="/admin/pages">Manage Pages</Link></li>
                        <li><Link to="/admin/create-course">Create Course</Link></li>
                        <li><Link to="/admin/manage-courses">Manage Courses</Link></li>
                    </ul>
                </nav>
                <button onClick={onLogout} className="logout-btn">Logout</button>
            </aside>
            <main className="dashboard-content">
                <h2>Welcome to the Admin Dashboard</h2>
                <p>Select an option from the sidebar to manage the website.</p>
            </main>
        </div>
    );
};

export default AdminDashboard;
