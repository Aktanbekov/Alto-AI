import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, logout } from "../api";

interface User {
  id: string;
  email: string;
  name: string;
  email_verified?: boolean;
}

interface ProfileDropdownProps {
  user?: User | null;
  onLogout?: () => void;
}

export default function ProfileDropdown({ user, onLogout }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(user || null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch user if not provided
    if (!user) {
      const fetchUser = async () => {
        try {
          const userData = await getMe();
          setCurrentUser(userData);
        } catch (err) {
          setCurrentUser(null);
        }
      };
      fetchUser();
    } else {
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await logout();
        if (onLogout) {
          onLogout();
        }
        navigate("/");
      } catch (err) {
        console.error("Logout error:", err);
        navigate("/");
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getProfilePicture = () => {
    // For now, use initials. In the future, you can add profile picture URL to user model
    const initials = currentUser?.name ? getInitials(currentUser.name) : "U";
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
        {initials}
      </div>
    );
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
        aria-label="Profile menu"
      >
        {getProfilePicture()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Profile Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {getProfilePicture()}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {currentUser.name || "User"}
                </p>
                <p className="text-sm text-gray-600 truncate">{currentUser.email}</p>
              </div>
            </div>
          </div>

          {/* Plan Info */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Plan</span>
              <span className="text-sm font-medium text-indigo-600">Free</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to account details page (you can create this later)
                // navigate("/account");
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Details
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to upgrade plan page (you can create this later)
                // navigate("/upgrade");
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Upgrade Plan
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                // Open contact us (you can implement this as a modal or navigate to a page)
                window.location.href = "mailto:support@altoai.com?subject=Contact Us";
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Us
            </button>

            <div className="border-t border-gray-200 my-1"></div>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}




