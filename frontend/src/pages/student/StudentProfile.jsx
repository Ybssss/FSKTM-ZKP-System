import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, BookOpen, GraduationCap, Calendar, Shield, Key } from 'lucide-react';

export default function StudentProfile() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="w-8 h-8" />
          My Profile
        </h1>
        <p className="text-gray-600 mt-1">View your account information</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {user?.name?.charAt(0) || 'S'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{user?.name || 'Student'}</h2>
            <p className="text-gray-600">{user?.userId}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
              Student
            </span>
          </div>
        </div>

        {/* Account Information */}
        <div className="border-t border-gray-200 pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User ID */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="font-semibold text-gray-900">{user?.userId || '-'}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold text-gray-900">{user?.email || '-'}</p>
              </div>
            </div>

            {/* Matric Number */}
            {user?.matricNumber && (
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <BookOpen className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Matric Number</p>
                  <p className="font-semibold text-gray-900">{user.matricNumber}</p>
                </div>
              </div>
            )}

            {/* Program */}
            {user?.program && (
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <GraduationCap className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Program</p>
                  <p className="font-semibold text-gray-900">{user.program}</p>
                </div>
              </div>
            )}

            {/* Last Login */}
            {user?.lastLogin && (
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Last Login</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(user.lastLogin).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ZKP Authentication Status */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
          
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">
                  Zero-Knowledge Proof Authentication
                </h4>
                <p className="text-sm text-gray-700 mb-3">
                  Your account is secured with cryptographic keys. No password needed!
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Key className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-700">
                    ZKP Identity: {user?.zkpRegistered ? 'Registered ✓' : 'Not Registered'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Research Information (if available) */}
        {(user?.researchTitle || user?.supervisor) && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Information</h3>
            
            <div className="space-y-3">
              {user?.researchTitle && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Research Title</p>
                  <p className="font-medium text-gray-900">{user.researchTitle}</p>
                </div>
              )}
              
              {user?.supervisor && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Supervisor</p>
                  <p className="font-medium text-gray-900">{user.supervisor}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 text-sm">
          📝 Need to update your information?
        </h3>
        <p className="text-xs text-blue-800">
          Contact your supervisor or admin to update your profile information.
        </p>
      </div>
    </div>
  );
}
