import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('🛡️ ProtectedRoute Check:');
    console.log('   Path:', location.pathname);
    console.log('   Loading:', loading);
    console.log('   User:', user);
    console.log('   Allowed Roles:', allowedRoles);
    console.log('   User Role:', user?.role);
    console.log('   Is Allowed:', user && allowedRoles?.includes(user.role));
  }, [user, loading, location, allowedRoles]);

  // Show loading state while checking authentication
  if (loading) {
    console.log('⏳ Still loading authentication...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    console.log('❌ No user found - redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role is allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log(`❌ User role '${user.role}' not in allowed roles:`, allowedRoles);
    
    // Redirect based on user's actual role
    if (user.role === 'student') {
      console.log('↪️ Redirecting to student dashboard');
      return <Navigate to="/student/dashboard" replace />;
    } else if (user.role === 'panel' || user.role === 'admin') {
      console.log('↪️ Redirecting to panel dashboard');
      return <Navigate to="/panel/dashboard" replace />;
    } else {
      console.log('↪️ Unknown role - redirecting to login');
      return <Navigate to="/login" replace />;
    }
  }

  // User is authenticated and authorized
  console.log('✅ Access granted!');
  
  // If children provided (like <PanelLayout />), render them
  // Otherwise render <Outlet /> for nested routes
  return children ? children : <Outlet />;
}
