import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@mantine/core/styles.css";
import "@blocknote/mantine/style.css";
import "./index.css";
import config from './config';

// --- Custom Selection Styles ---
const customStyles = `
  /* Make UI text elements unselectable */
  .no-select,
  button,
  .sidebar-item,
  .tab-button,
  .document-title,
  .search-label,
  .header-text,
  h1, h2, h3, h4, h5, h6:not(.bn-editor h1, .bn-editor h2, .bn-editor h3, .bn-editor h4, .bn-editor h5, .bn-editor h6),
  label:not(.bn-editor label),
  .sticky-header,
  .sidebar-text {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
  }

  /* BlockNote editor custom selection - minimal interference approach */
  .bn-editor .ProseMirror-selectednode {
    background-color: #d4d4d4 !important;
  }

  .dark .bn-editor .ProseMirror-selectednode {
    background-color: #525252 !important;
  }

  /* Text selection in BlockNote - let ProseMirror handle it naturally */
  .bn-editor .ProseMirror {
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
  }

  /* Override default browser selection only for BlockNote content */
  .bn-editor .ProseMirror *::selection {
    background-color: #d4d4d4;
    color: inherit;
  }

  .dark .bn-editor .ProseMirror *::selection {
    background-color: #525252;
    color: inherit;
  }

  .bn-editor .ProseMirror *::-moz-selection {
    background-color: #d4d4d4;
    color: inherit;
  }

  .dark .bn-editor .ProseMirror *::-moz-selection {
    background-color: #525252;
    color: inherit;
  }

  /* Ensure BlockNote maintains its native deletion behavior */
  .bn-editor {
    outline: none;
  }

  /* Make sure selection handles work properly */
  .bn-editor .ProseMirror-gapcursor {
    pointer-events: none;
  }
`;

// --- API Client with Token Refresh ---
const apiClient = {
  // Store refresh callback
  _onTokenRefresh: null,
  _onLogout: null,
  
  setTokenRefreshCallback: (callback) => {
    apiClient._onTokenRefresh = callback;
  },
  
  setLogoutCallback: (callback) => {
    apiClient._onLogout = callback;
  },
  
  refreshToken: async (refreshToken) => {
    const response = await fetch(`${config.apiUrl}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    return response.json();
  },
  
  // Wrapper to handle token refresh automatically
  fetchWithTokenRefresh: async (url, options, user) => {
    let response = await fetch(url, options);
    
    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401 && user?.refresh) {
      try {
        const { access } = await apiClient.refreshToken(user.refresh);
        // Update token via callback
        if (apiClient._onTokenRefresh) {
          apiClient._onTokenRefresh(access);
        }
        // Retry request with new token
        const newHeaders = { ...options.headers, 'Authorization': `Bearer ${access}` };
        response = await fetch(url, { ...options, headers: newHeaders });
      } catch (err) {
        // Refresh failed, logout user
        if (apiClient._onLogout) {
          apiClient._onLogout();
        }
        throw new Error('Session expired. Please login again.');
      }
    }
    
    return response;
  },
  
  login: async (username, password) => {
    const response = await fetch(`${config.apiUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
    }
    return response.json();
  },
  
  signup: async (username, password, email) => {
    const response = await fetch(`${config.apiUrl}/api/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.username?.[0] || 'Signup failed');
    }
    return response.json();
  },
  
  getDocuments: async (user) => {
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/`,
      { headers: { 'Authorization': `Bearer ${user.access}` } },
      user
    );
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },
  
  getDocumentDetails: async (user, docId) => {
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/${docId}/`,
      { headers: { 'Authorization': `Bearer ${user.access}` } },
      user
    );
    if (!response.ok) throw new Error('Failed to fetch document details');
    return response.json();
  },
  
  uploadDocument: async (user, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.access}` },
        body: formData,
      },
      user
    );
    if (!response.ok) throw new Error('File upload failed');
    return response.json();
  },
  
  searchDocuments: async (user, query) => {
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/search/?q=${encodeURIComponent(query)}`,
      { headers: { 'Authorization': `Bearer ${user.access}` } },
      user
    );
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  },
  
  generateContent: async (user, docId, contentType) => {
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/${docId}/generate/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: contentType })
      },
      user
    );
    if (!response.ok) throw new Error(`Failed to generate ${contentType}`);
    return response.json();
  },

  createNote: async (user, title = 'New Note') => {
    // Create a minimal empty text file
    const noteContent = ``; // Completely empty
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const file = new File([blob], `${title}.txt`, { type: 'text/plain' });
    
    // Upload the file as a regular document
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.access}` },
        body: formData,
      },
      user
    );
    if (!response.ok) throw new Error('Failed to create note');
    return response.json();
  },

  deleteDocument: async (user, docId) => {
    const response = await apiClient.fetchWithTokenRefresh(
      `${config.apiUrl}/api/documents/${docId}/`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.access}` }
      },
      user
    );
    if (!response.ok) throw new Error('Failed to delete document');
    return response;
  }
};

// --- SVG Icons ---
const icons = {
  documents: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  settings: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  profile: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  search: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  sun: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>,
  moon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
  spinner: <svg className="animate-optimized-spin hw-accelerated h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
  success: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  fail: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>,
  delete: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  trash: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  threeDots: (
    <span style={{
      fontFamily: 'monospace',
      fontSize: '12px',
      fontWeight: 'normal',
      color: '#6b7280',
      lineHeight: '1',
      letterSpacing: '1px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      •••
    </span>
  ),
  edit: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
};


// --- React Components ---

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (isSigningUp) {
        await apiClient.signup(username, password, email);
        // Auto-login after successful signup
        const { access, refresh } = await apiClient.login(username, password);
        onLogin({ access, refresh, username }, rememberMe);
      } else {
        const { access, refresh } = await apiClient.login(username, password);
        onLogin({ access, refresh, username }, rememberMe);
      }
    } catch (err) {
      setError(err.message || 'An error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-850 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isSigningUp ? 'Create an Account' : 'Sign in'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="space-y-4">
            <input id="username" name="username" type="text" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-sm text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-gray-500 focus:border-gray-500" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            {isSigningUp && (
              <input id="email" name="email" type="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-sm text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-gray-500 focus:border-gray-500" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            <input id="password" name="password" type="password" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-sm text-gray-900 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-gray-500 focus:border-gray-500" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
           <div className="flex items-center justify-between pt-2">
            {!isSigningUp && (
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Remember me</label>
          </div>
            )}
            <div className={`text-sm ${isSigningUp ? 'w-full text-center' : ''}`}>
               <button type="button" onClick={() => setIsSigningUp(!isSigningUp)} className="font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                {isSigningUp ? 'Already have an account? Sign in' : 'Don\'t have an account? Sign up'}
              </button>
            </div>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors shadow-md hover:shadow-lg">
              {isLoading ? 'Processing...' : (isSigningUp ? 'Sign up' : 'Sign in')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Sidebar = ({ activePage, setActivePage, isCollapsed, setIsCollapsed }) => {
    const navItems = [
        { name: 'Notes', icon: icons.documents },
        { name: 'Settings', icon: icons.settings },
        { name: 'Profile', icon: icons.profile },
    ];
  return (
        <aside className={`${isCollapsed ? 'w-16' : 'w-52'} flex-shrink-0 bg-gray-100 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col shadow-sm transition-[width] duration-150 ease-out`}>
            <div className="flex items-center justify-between mb-6">
                {!isCollapsed && <div className="font-bold text-3xl text-gray-900 dark:text-gray-100 pl-3 no-select">Synapse</div>}
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 ml-auto transition-colors hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            </div>
            <nav className="flex flex-col space-y-2">
                {navItems.map(item => (
                    <button 
                        key={item.name} 
                        onClick={() => setActivePage(item.name)} 
                        className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-lg text-sm transition-colors ${activePage === item.name ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-850'}`}
                        title={isCollapsed ? item.name : ''}
                    >
                        <span className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center">
                            {item.icon}
                        </span>
                        {!isCollapsed && <span>{item.name}</span>}
            </button>
          ))}
        </nav>
        </aside>
    );
};

const Header = ({ username, onLogout, isDarkMode, onToggleDarkMode, onSearch, onClearSearch, isCollapsed }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e) => {
        if (e.key === 'Enter') {
            if (searchQuery) {
                onSearch(searchQuery);
            } else {
                onClearSearch();
            }
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        
        // If search is cleared, restore all documents
        if (value === '') {
            onClearSearch();
        }
    };

  return (
        <header className="flex-shrink-0 h-16 flex items-center justify-between px-6 neu-container neu-inset">
            {/* Spacer div that adjusts based on sidebar state */}
            <div className={`${isCollapsed ? 'w-16' : 'w-52'} flex-shrink-0`}></div>
            
            {/* Centered search bar */}
            <div className="flex-1 max-w-lg mx-auto">
          <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                        {icons.search}
                    </div>
                    <input type="search" placeholder="Semantic Search..." 
className="w-full pl-12 pr-4 py-1.5 rounded-xl neu-inset
  bg-white dark:bg-gray-900
  text-gray-800 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-500
  border border-gray-200 dark:border-gray-700
  transition-all focus:outline-none
  hover:bg-gray-50 dark:hover:bg-gray-800
  focus:ring-2 focus:ring-black dark:focus:ring-white"

              value={searchQuery}
                           onChange={handleInputChange}
                           onKeyDown={handleSearch}
            />
          </div>
        </div>
        
        {/* Right-aligned user controls */}
        <div className="flex items-center space-x-4 flex-shrink-0">
                <button onClick={onToggleDarkMode} className="p-3 neu-circle w-12 h-12 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-all">
                    {isDarkMode ? icons.sun : icons.moon}
          </button>
                <span className="text-base font-medium text-gray-700 dark:text-gray-200 no-select">{username}</span>
                <button onClick={onLogout} className="text-sm px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors shadow-md hover:shadow-lg">Logout</button>
        </div>
        </header>
    );
};

const DocumentList = ({ documents, activeDocument, onSelectDocument, onUpload, onCreateNote, onDeleteDocument, onRenameDocument, isDarkMode }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);
    const [renamingDoc, setRenamingDoc] = useState(null);
    const [newName, setNewName] = useState('');
    const [showNewNoteModal, setShowNewNoteModal] = useState(false);
    const [noteName, setNoteName] = useState('New Note');
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const modalFileInputRef = useRef(null);
    const menuRef = useRef(null);
    const newNoteButtonRef = useRef(null);



    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            onUpload(file);
        }
    };

    const handleDelete = (e, docId) => {
        e.stopPropagation(); // Prevent selecting the document when clicking delete
        if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            onDeleteDocument(docId);
        }
        setActiveMenu(null);
    };

    const handleMenuToggle = (e, docId) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === docId ? null : docId);
    };

    const handleRename = (e, doc) => {
        e.stopPropagation();
        setRenamingDoc(doc.id);
        setNewName(getDisplayName(doc.filename));
        setActiveMenu(null);
    };

    const handleRenameSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (newName.trim() && renamingDoc) {
            onRenameDocument(renamingDoc, newName.trim());
            setRenamingDoc(null);
            setNewName('');
        }
    };

    const handleRenameCancel = (e) => {
        e.stopPropagation();
        setRenamingDoc(null);
        setNewName('');
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const StatusIcon = ({ status }) => {
        switch (status) {
            case 'processing': 
                return (
                    <div className="w-4 h-4 flex items-center justify-center hw-accelerated" title="Processing...">
                        <svg className="animate-optimized-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{stroke: '#6b7280'}} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                        </svg>
                    </div>
                );
            case 'completed': 
                return (
                    <div className="w-4 h-4 flex items-center justify-center animate-optimized-bounce hw-accelerated" title="Completed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{stroke: '#22c55e'}} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                );
            case 'failed': 
                return (
                    <div className="w-4 h-4 flex items-center justify-center animate-optimized-pulse hw-accelerated" title="Failed">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{stroke: '#ef4444'}} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </div>
                );
            default: return null;
        }
    };
    
    const getDisplayName = (filename) => {
        // Remove file extension from display
        return filename.replace(/\.(txt|md|pdf|docx)$/i, '');
    };

  return (
        <div className={`document-list ${isCollapsed ? 'w-16' : 'w-64'} flex-shrink-0 flex flex-col neu-container neu-raised h-full`}>
            {/* Sticky Header for Notes and New Note Button */}
            <div className="sticky-header bg-white/95 dark:bg-gray-850/95 sticky top-0 z-20 flex-shrink-0 -ml-3 mr-1">
                <div className="px-6 py-3 pr-4 sticky-separator">
                    <div className="flex items-center justify-between mb-3">
                        {!isCollapsed && <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Notes</span>}
                        <button onClick={() => setIsCollapsed(!isCollapsed)} className={`p-1.5 transition-colors hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded relative ${!isCollapsed ? 'ml-auto' : 'mx-auto'}`} style={{zIndex: 9999}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" style={{zIndex: 9999}}>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    {!isCollapsed && (
                        <button 
                            ref={newNoteButtonRef}
                            id="new-note-button"
                            onClick={() => setShowNewNoteModal(true)} 
                            className="w-full text-sm px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 mb-3 font-medium"
                        >
                            <span className="text-lg font-bold no-select" style={{lineHeight: 1}}>+</span>
                            <span className="no-select">New Note</span>
                        </button>
                    )}
                </div>
                {/* Horizontal Separator - reaches both left and right borders */}
                <div className="border-b border-gray-200 dark:border-gray-700 -ml-6" style={{marginRight: '-0.675rem'}}></div>
            </div>
            {/* Scrollable Document List */}
            <div className="flex-1 overflow-y-auto min-h-0 notes-scrollbar">
                {/* Add right padding so selected highlight isn't visually clipped */}
                <div className="flex flex-col px-2 pr-4 space-y-1 pb-4 pt-2" ref={menuRef}>
                    {documents.map(doc => (
                        <div key={doc.id} className="relative">
                            {renamingDoc === doc.id ? (
                                <form onSubmit={handleRenameSubmit} className="p-2.5">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onBlur={handleRenameCancel}
                                        autoFocus
                                        className="w-full neu-inset rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 focus:outline-none"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </form>
                            ) : (
                                <button onClick={() => onSelectDocument(doc)}
                                    className={`w-full p-2.5 text-left rounded-xl transition-all duration-300 ${
                                        doc.status === 'processing' ? 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 animate-optimized-pulse opacity-60 hw-accelerated' :
                                        doc.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 animate-optimized-pulse hw-accelerated' :
                                        doc.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                                        activeDocument?.id === doc.id ? 'bg-gray-200 dark:bg-gray-800 shadow-float ring-1 ring-gray-300 dark:ring-gray-700' : 
                                        'hover:bg-gray-50 dark:hover:bg-gray-850'
                                    }`}>
                                    {!isCollapsed ? (
                                        <div className="flex justify-between items-center">
                                           <div className="flex items-center gap-2 flex-1 min-w-0">
                                               <StatusIcon status={doc.status} />
                                               <div className="flex-1 min-w-0">
                                                   <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate no-select">{getDisplayName(doc.filename)}</h3>
                                                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                       {new Date(doc.uploadDate).toLocaleDateString()}
                                                   </p>
                                               </div>
                                           </div>
                                           <button 
                                               onClick={(e) => handleMenuToggle(e, doc.id)}
                                               className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center w-8 h-8 ml-3 hover:shadow-sm"
                                               title="More options"
                                           >
                                               {icons.threeDots}
                                           </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center items-center">
                                            <StatusIcon status={doc.status} />
                                        </div>
                                    )}
                                </button>
                            )}
                            {activeMenu === doc.id && (
                                <div className="absolute right-0 top-0 mt-10 mr-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shadow-lg z-50 p-2 min-w-40">
                                    <button
                                        onClick={(e) => handleRename(e, doc)}
                                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center space-x-3 mb-1 transition-colors"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                            {icons.edit}
                                        </div>
                                        <span className="font-medium">Rename</span>
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, doc.id)}
                                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center space-x-3 transition-colors"
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center text-red-600 dark:text-red-400">
                                            {icons.trash}
                                        </div>
                                        <span className="font-medium">Delete</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
      
            {/* New Note Modal */}
            {showNewNoteModal && (
        <>
          {/* Blurred background overlay */}
          <div 
            className="fixed inset-0 z-40" 
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)'
            }}
            onClick={() => setShowNewNoteModal(false)}
          />
          
          {/* Simple centered box */}
          <div 
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 w-96 max-w-sm"
            style={{
              background: isDarkMode 
                ? 'rgba(38, 38, 38, 0.95)' // Pure neutral dark gray
                : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: isDarkMode 
                ? '1px solid rgba(82, 82, 82, 0.6)' // Neutral gray border
                : '1px solid rgba(229, 231, 235, 0.8)',
              boxShadow: isDarkMode 
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 8px 8px 32px rgba(0, 0, 0, 0.4)' 
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 8px 8px 32px rgba(107, 114, 128, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 no-select" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>Create New Note</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 no-select" style={{textShadow: '0 1px 1px rgba(0,0,0,0.2)'}}>Note Name</label>
                <input
                  type="text"
                  value={noteName}
                  onChange={(e) => setNoteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-white border-0"
                  style={{
                    background: isDarkMode 
                      ? 'rgba(64, 64, 64, 0.7)' // Pure neutral gray
                      : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: isDarkMode 
                      ? '1px solid rgba(96, 96, 96, 0.6)' // Neutral gray border
                      : '1px solid rgba(229, 231, 235, 0.8)'
                  }}
                  placeholder="Enter note name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 no-select" style={{textShadow: '0 1px 1px rgba(0,0,0,0.2)'}}>Optional: Upload File for AI Processing</label>
                <input
                  type="file"
                  ref={modalFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setSelectedFile(file);
                      // Auto-set name to filename without extension
                      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                      setNoteName(nameWithoutExt);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-gray-900 dark:text-white border-0 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
                  style={{
                    background: isDarkMode 
                      ? 'rgba(64, 64, 64, 0.7)' // Pure neutral gray
                      : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: isDarkMode 
                      ? '1px solid rgba(96, 96, 96, 0.6)' // Neutral gray border
                      : '1px solid rgba(229, 231, 235, 0.8)'
                  }}
                />
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1" style={{textShadow: '0 1px 1px rgba(0,0,0,0.1)'}}>
                  {selectedFile ? 'File will be processed with AI for notes, summaries, and quizzes' : 'Leave empty to create a blank note for manual writing'}
                </p>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setShowNewNoteModal(false);
                    setNoteName('New Note');
                    setSelectedFile(null);
                    if (modalFileInputRef.current) modalFileInputRef.current.value = '';
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 rounded-lg transition-all border-0"
                  style={{
                    background: isDarkMode 
                      ? 'rgba(82, 82, 82, 0.5)' // Pure neutral gray
                      : 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: isDarkMode 
                      ? '1px solid rgba(115, 115, 115, 0.4)' // Neutral gray border
                      : '1px solid rgba(229, 231, 235, 0.6)',
                    textShadow: '0 1px 1px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = isDarkMode ? 'rgba(82, 82, 82, 0.7)' : 'rgba(255, 255, 255, 0.7)'}
                  onMouseLeave={(e) => e.target.style.background = isDarkMode ? 'rgba(82, 82, 82, 0.5)' : 'rgba(255, 255, 255, 0.5)'}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (selectedFile) {
                        // Upload file with custom name
                        const renamedFile = new File([selectedFile], `${noteName}.${selectedFile.name.split('.').pop()}`, { type: selectedFile.type });
                        await onUpload(renamedFile);
                      } else {
                        // Create empty note
                        await onCreateNote(noteName);
                      }
                      setShowNewNoteModal(false);
                      setNoteName('New Note');
                      setSelectedFile(null);
                      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
                    } catch (error) {
                      console.error('Failed to create note:', error);
                    }
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all border-0"
                  style={{
                    background: 'rgba(34, 197, 94, 0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: isDarkMode 
                      ? '1px solid rgba(82, 82, 82, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.3)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(34, 197, 94, 0.9)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(34, 197, 94, 0.8)'}
                >
                  Create Note
                </button>
              </div>
            </div>
          </div>
        </>
      )}
        </div>
    );
};

const DocumentViewer = ({ document: docProp, user, onContentGenerated, activeDocument, onRenameDocument, renamingTitle, setRenamingTitle, titleNewName, setTitleNewName }) => {
    const [activeTab, setActiveTab] = useState('Notes');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [error, setError] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [markdownContent, setMarkdownContent] = useState('');
    const [summaryContent, setSummaryContent] = useState('');
    const [quizContent, setQuizContent] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    // Refs to track previous content for comparison
    const prevSummaryContentRef = useRef('');
    const prevQuizContentRef = useRef(null);
    
    // The active document now holds its own generated content
    const generatedContent = useMemo(() => docProp?.generated_content || [], [docProp?.generated_content]);
    
    // Create BlockNote editor instances FIRST
    const notesEditor = useCreateBlockNote({
        initialContent: undefined,
    });
    
    const summaryEditor = useCreateBlockNote({
        initialContent: undefined,
    });
    
    const quizEditor = useCreateBlockNote({
        initialContent: undefined,
    });
    
    // Detect dark mode
    useEffect(() => {
        const htmlElement = window.document.querySelector('html');
        setIsDarkMode(htmlElement?.classList.contains('dark'));
        
        // Optional: Watch for changes
        const observer = new MutationObserver(() => {
            setIsDarkMode(htmlElement?.classList.contains('dark'));
        });
        
        if (htmlElement) {
            observer.observe(htmlElement, { attributes: true, attributeFilter: ['class'] });
        }
        
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (docProp) {
            // Only reset tab when document changes, not when content is generated
            if (!activeDocument || activeDocument?.id !== docProp.id) {
                setActiveTab('Notes');
                // Clear all content states when switching documents
                setMarkdownContent('');
                setSummaryContent('');
                setQuizContent(null);
                setOriginalContent('');
                
                // Clear the editors
                if (notesEditor) {
                    notesEditor.replaceBlocks(notesEditor.document, []);
                }
                if (summaryEditor) {
                    summaryEditor.replaceBlocks(summaryEditor.document, []);
                }
                if (quizEditor) {
                    quizEditor.replaceBlocks(quizEditor.document, []);
                }
            }
        }
    }, [docProp, activeDocument, notesEditor, summaryEditor, quizEditor]);
    
    // Separate effect to update content when generatedContent changes
    useEffect(() => {
        // Find content by type (should only be one of each type now)
        const notes = generatedContent.find(c => c.contentType === 'notes');
        const summary = generatedContent.find(c => c.contentType === 'summary');
        const quiz = generatedContent.find(c => c.contentType === 'quiz');
        
        // Always update content to match the current document
        const newNotesContent = notes?.contentData?.markdown_text || '';
        const newSummaryContent = summary?.contentData?.markdown_text || '';
        const newQuizContent = quiz?.contentData || null;
        
        // Debug logging
        console.log('Content update for doc:', docProp?.id, {
            hasNotes: !!notes,
            hasSummary: !!summary,
            hasQuiz: !!quiz,
            summaryLength: newSummaryContent.length,
            generatedContentCount: generatedContent.length,
            prevSummaryLength: prevSummaryContentRef.current.length,
            prevQuizLength: prevQuizContentRef.current ? Object.keys(prevQuizContentRef.current).length : 0
        });
        
        // Clear loading states when new content appears
        if (newSummaryContent && newSummaryContent !== prevSummaryContentRef.current && loadingSummary) {
            console.log('New summary content detected, clearing loading state');
            setLoadingSummary(false);
        }
        
        if (newQuizContent && JSON.stringify(newQuizContent) !== JSON.stringify(prevQuizContentRef.current) && loadingQuiz) {
            console.log('New quiz content detected, clearing loading state');
            setLoadingQuiz(false);
        }
        
        // Update refs with new values
        prevSummaryContentRef.current = newSummaryContent;
        prevQuizContentRef.current = newQuizContent;
        
        setMarkdownContent(newNotesContent);
        setSummaryContent(newSummaryContent);
        setQuizContent(newQuizContent);
    }, [generatedContent, docProp?.id, loadingSummary, loadingQuiz]);
    
    // Load content into editors when it changes
    useEffect(() => {
        if (notesEditor && markdownContent) {
            async function loadMarkdown() {
                try {
                    const blocks = await notesEditor.tryParseMarkdownToBlocks(markdownContent);
                    notesEditor.replaceBlocks(notesEditor.document, blocks);
                } catch (error) {
                    console.error('Failed to parse notes markdown:', error);
                }
            }
            loadMarkdown();
        }
    }, [markdownContent, notesEditor]);
    
    useEffect(() => {
        if (summaryEditor && summaryContent) {
            async function loadSummary() {
                try {
                    const blocks = await summaryEditor.tryParseMarkdownToBlocks(summaryContent);
                    summaryEditor.replaceBlocks(summaryEditor.document, blocks);
                } catch (error) {
                    console.error('Failed to parse summary markdown:', error);
                }
            }
            loadSummary();
        }
    }, [summaryContent, summaryEditor]);
    
    useEffect(() => {
        if (quizEditor && quizContent) {
            async function loadQuiz() {
                try {
                    // Convert JSON quiz data to BlockNote blocks
                    const blocks = [];
                    
                    // Add title
                    blocks.push({
                        type: "heading",
                        props: { level: 1 },
                        content: [{ type: "text", text: "Quiz" }],
                    });
                    
                    // Add multiple choice questions
                    if (quizContent.multiple_choice && quizContent.multiple_choice.length > 0) {
                        blocks.push({
                            type: "heading",
                            props: { level: 2 },
                            content: [{ type: "text", text: "Multiple Choice Questions" }],
                        });
                        
                        quizContent.multiple_choice.forEach((q, index) => {
                            // Question
                            blocks.push({
                                type: "paragraph",
                                content: [{ 
                                    type: "text", 
                                    text: `${index + 1}. ${q.question}`,
                                    styles: { bold: true }
                                }],
                            });
                            
                            // Options
                            q.options.forEach((option, optIndex) => {
                                const isCorrect = optIndex === q.correct_answer_index;
                                blocks.push({
                                    type: "paragraph",
                                    content: [{
                                        type: "text",
                                        text: `   ${String.fromCharCode(65 + optIndex)}. ${option}`,
                                        styles: isCorrect ? { bold: true, textColor: "green" } : {}
                                    }],
                                });
                            });
                            
                            // Add spacing
                            blocks.push({
                                type: "paragraph",
                                content: [],
                            });
                        });
                    }
                    
                    // Add fill-in-the-blanks questions
                    if (quizContent.fill_in_the_blanks && quizContent.fill_in_the_blanks.length > 0) {
                        blocks.push({
                            type: "heading",
                            props: { level: 2 },
                            content: [{ type: "text", text: "Fill in the Blanks" }],
                        });
                        
                        quizContent.fill_in_the_blanks.forEach((q, index) => {
                            blocks.push({
                                type: "paragraph",
                                content: [{ 
                                    type: "text", 
                                    text: `${index + 1}. ${q.question}`,
                                    styles: { bold: true }
                                }],
                            });
                            
                            blocks.push({
                                type: "paragraph",
                                content: [{
                                    type: "text",
                                    text: `   Answer: ${q.answer}`,
                                    styles: { bold: true, textColor: "green" }
                                }],
                            });
                            
                            // Add spacing
                            blocks.push({
                                type: "paragraph",
                                content: [],
                            });
                        });
                    }
                    
                    quizEditor.replaceBlocks(quizEditor.document, blocks);
                } catch (error) {
                    console.error('Failed to parse quiz JSON:', error);
                    // Fallback: display raw JSON as code block
                    const fallbackBlocks = [{
                        type: "paragraph",
                        content: [{ type: "text", text: "Quiz data (JSON format):" }],
                    }, {
                        type: "codeBlock",
                        props: { language: "json" },
                        content: [{ type: "text", text: JSON.stringify(quizContent, null, 2) }],
                    }];
                    quizEditor.replaceBlocks(quizEditor.document, fallbackBlocks);
                }
            }
            loadQuiz();
        }
    }, [quizContent, quizEditor]);
    

    
    const handleGenerate = async (contentType) => {
        // Set specific loading state
        if (contentType === 'summary') setLoadingSummary(true);
        else if (contentType === 'quiz') setLoadingQuiz(true);
        
        setIsLoading(true);
        setError('');
        try {
            console.log(`Generating ${contentType} for document:`, docProp.id);
            
            // Trigger the generation (this is async on backend)
            const response = await apiClient.generateContent(user, docProp.id, contentType);
            console.log(`${contentType} generation request sent, response:`, response);
            
            // Don't clear loading states here - they'll be cleared when content appears
            // The existing polling will update the documents and activeDocument
            setIsLoading(false); // Only clear general loading
            
        } catch (err) {
            console.error(`Failed to generate ${contentType}:`, err);
            setError(`Failed to generate ${contentType}.`);
            // Clear loading states on error
            setIsLoading(false);
            if (contentType === 'summary') setLoadingSummary(false);
            else if (contentType === 'quiz') setLoadingQuiz(false);
        }
    };
    
    // Debounced export to markdown to avoid heavy work on every keystroke
    const notesDebounceRef = useRef(null);
    const summaryDebounceRef = useRef(null);
    const quizDebounceRef = useRef(null);
    
    const handleNotesEditorChange = useCallback(() => {
        if (!notesEditor) return;
        if (notesDebounceRef.current) {
            clearTimeout(notesDebounceRef.current);
        }
        notesDebounceRef.current = setTimeout(async () => {
            try {
                const markdown = await notesEditor.blocksToMarkdownLossy(notesEditor.document);
                console.log('Notes content updated:', markdown);
            } catch (error) {
                console.error('Failed to convert notes to markdown:', error);
            }
        }, 250);
    }, [notesEditor]);
    
    const handleSummaryEditorChange = useCallback(() => {
        if (!summaryEditor) return;
        if (summaryDebounceRef.current) {
            clearTimeout(summaryDebounceRef.current);
        }
        summaryDebounceRef.current = setTimeout(async () => {
            try {
                const markdown = await summaryEditor.blocksToMarkdownLossy(summaryEditor.document);
                console.log('Summary content updated:', markdown);
            } catch (error) {
                console.error('Failed to convert summary to markdown:', error);
            }
        }, 250);
    }, [summaryEditor]);
    
    const handleQuizEditorChange = useCallback(() => {
        if (!quizEditor) return;
        if (quizDebounceRef.current) {
            clearTimeout(quizDebounceRef.current);
        }
        quizDebounceRef.current = setTimeout(async () => {
            try {
                const markdown = await quizEditor.blocksToMarkdownLossy(quizEditor.document);
                console.log('Quiz content updated:', markdown);
            } catch (error) {
                console.error('Failed to convert quiz to markdown:', error);
            }
        }, 250);
    }, [quizEditor]);

    const handleViewOriginal = async () => {
        try {
            // In a production app, you would call a secure API endpoint to get the file content
            // For now, we'll show a placeholder message
            setOriginalContent(`Original file: ${docProp.filename}\n\nTo view the original content, you can find the file in the 'media/uploads' directory of your backend.\n\nIn a production environment, this would show the actual file content or provide a secure download link.`);
        } catch (error) {
            setError('Failed to load original content.');
        }
    };
    
    const handleDownloadOriginal = async () => {
        try {
            // Create a download link for the original file
            // In production, this would be a secure API endpoint
            const downloadUrl = `/media/uploads/${docProp.filename}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = docProp.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please check if the file exists.');
        }
    };
    
    if (!docProp) {
        return <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">Select a document to view its content</div>;
    }

    const tabs = ['Notes', 'Summary', 'Quiz', 'Original'];
    const notes = generatedContent.find(c => c.contentType === 'notes');
    const summary = generatedContent.find(c => c.contentType === 'summary');
    const quiz = generatedContent.find(c => c.contentType === 'quiz');

    const renderContent = () => {
        if(isLoading) {
            return <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">{icons.spinner} Generating...</div>;
        }
        if(error) {
            return <p className="text-red-500 text-center">{error}</p>;
        }
        
        switch(activeTab) {
            case 'Notes':
                if (!notes && !markdownContent) {
                    return <p className="text-gray-500 text-center">Initial notes are being generated or have failed.</p>;
                }
                
                return (
                    <div className="h-full overflow-auto" data-color-mode={isDarkMode ? "dark" : "light"}>
                        <BlockNoteView
                            editor={notesEditor}
                            onChange={handleNotesEditorChange}
                            theme={isDarkMode ? "dark" : "light"}
                            className="h-full"
                        />
                    </div>
                );
            case 'Summary':
                if (summary || summaryContent) {
                    return (
                        <div className="h-full overflow-auto" data-color-mode={isDarkMode ? "dark" : "light"}>
                            <BlockNoteView
                                editor={summaryEditor}
                                onChange={handleSummaryEditorChange}
                                theme={isDarkMode ? "dark" : "light"}
                                className="h-full"
                            />
                        </div>
                    );
                } else {
                    return (
                        <div className="text-center p-6">
                            <button 
                                onClick={() => handleGenerate('summary')} 
                                disabled={loadingSummary}
                                className={`text-sm px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 mx-auto ${
                                    loadingSummary 
                                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed' 
                                        : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600'
                                }`}
                            >
                                {loadingSummary ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating Summary...
                                    </>
                                ) : (
                                    'Generate Summary'
                                )}
                            </button>
                        </div>
                    );
                }
            case 'Quiz':
                if (quiz || quizContent) {
                    return (
                        <div className="h-full overflow-auto" data-color-mode={isDarkMode ? "dark" : "light"}>
                            <BlockNoteView
                                editor={quizEditor}
                                onChange={handleQuizEditorChange}
                                theme={isDarkMode ? "dark" : "light"}
                                className="h-full"
                            />
                        </div>
                    );
                } else {
                    return (
                        <div className="text-center p-6">
                            <button 
                                onClick={() => handleGenerate('quiz')} 
                                disabled={loadingQuiz}
                                className={`text-sm px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 mx-auto ${
                                    loadingQuiz 
                                        ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed' 
                                        : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600'
                                }`}
                            >
                                {loadingQuiz ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating Quiz...
                                    </>
                                ) : (
                                    'Generate Quiz'
                                )}
                            </button>
                        </div>
                    );
                }
            case 'Original':
                return (
                    <div className="p-6 space-y-4">
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleViewOriginal}
                                className="bg-gray-800 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors shadow-md hover:shadow-lg"
                            >
                                View Original
                            </button>
                            <button 
                                onClick={handleDownloadOriginal}
                                className="bg-blue-600 dark:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg flex items-center space-x-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span>Download Original</span>
                            </button>
                        </div>
                        <div className="mt-4">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border">
                                {originalContent || "Click 'View Original' to load the original document content."}
                            </pre>
                        </div>
                    </div>
                );
      default:
        return null;
    }
  };

  const getDisplayName = (filename) => {
    return filename.replace(/\.(txt|md|pdf|docx)$/i, '');
  };

  return (
        <div className="flex-1 flex flex-col overflow-hidden neu-container neu-raised min-w-0 relative">
            {/* Sticky Header */}
            <div className="sticky-header bg-white/95 dark:bg-gray-850/95 sticky top-0 z-20">
                <div className="flex-shrink-0 px-6 pt-4 pb-3 neu-inset rounded-t-xl sticky-separator">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 flex items-center">
                            {renamingTitle ? (
                                <input
                                    type="text"
                                    value={titleNewName}
                                    onChange={(e) => setTitleNewName(e.target.value)}
                                    onBlur={() => {
                                        if (titleNewName.trim()) {
                                            const extension = docProp.filename.split('.').pop();
                                            const nameWithoutExt = titleNewName.trim();
                                            // Don't append .pdf if it's already there
                                            const newFilename = nameWithoutExt.endsWith(`.${extension}`) 
                                                ? nameWithoutExt 
                                                : `${nameWithoutExt}.${extension}`;
                                            onRenameDocument(docProp.id, newFilename);
                                        }
                                        setRenamingTitle(false);
                                        setTitleNewName('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.target.blur();
                                        } else if (e.key === 'Escape') {
                                            setRenamingTitle(false);
                                            setTitleNewName('');
                                        }
                                    }}
                                    className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent neu-inset rounded-lg px-3 py-1 focus:outline-none text-left"
                                    autoFocus
                                />
                            ) : (
                                <h2 
                                    onClick={() => {
                                        setRenamingTitle(true);
                                        setTitleNewName(getDisplayName(docProp.filename));
                                    }}
                                    className="text-xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer neu-button rounded-lg px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left"
                                    title="Click to rename"
                                >
                                    <span className="no-select">{getDisplayName(docProp.filename)}</span>
                                </h2>
                            )}
                        </div>
                        <div className="flex items-center">
                            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                                {tabs.map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap no-select ${activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-md border border-gray-300 dark:border-gray-600' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Horizontal Separator */}
                <div className="border-b border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm min-h-0 content-scrollbar">
                {renderContent()}
            </div>
        </div>
  );
};

const SettingsPage = ({ isDarkMode, onToggleDarkMode }) => {
  return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Settings</h1>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">Dark Mode</span>
                <button onClick={onToggleDarkMode} className={`w-14 h-8 rounded-full flex items-center transition-colors p-1 ${isDarkMode ? 'bg-gray-700 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <span className="w-6 h-6 bg-white rounded-full shadow-md transform transition-transform"></span>
              </button>
      </div>
    </div>
  );
};

const ProfilePage = ({ username, onLogout }) => {
  return (
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Profile</h1>
             <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <p className="text-sm text-gray-900 dark:text-gray-100">Username: <span className="font-semibold">{username}</span></p>
                <button onClick={onLogout} className="mt-4 bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-md hover:shadow-lg">Logout</button>
      </div>
      <div className="mt-6 bg-gray-100 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">About</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Analytical and detail-oriented Computer Science and Artificial Intelligence student at IE University in Madrid, with a strong focus on software engineering, data analysis, and machine learning.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          My work centers on building reliable, scalable systems and extracting meaningful insights from data. I have experience working with real-world datasets, developing Python-based solutions, and applying structured problem-solving to technical challenges.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          I am particularly interested in designing efficient backend systems, implementing data-driven applications, and exploring machine learning models that translate theory into practical impact.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Currently seeking internship opportunities in Software Engineering, Data Analysis, or Machine Learning, where I can contribute to production-level systems and continue developing as an engineer.
        </p>
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [activePage, setActivePage] = useState('Notes');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [appError, setAppError] = useState('');
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [titleNewName, setTitleNewName] = useState('');

  // Token refresh handler
  const handleTokenRefresh = useCallback((newAccessToken) => {
    setUser(prevUser => {
      if (!prevUser) return prevUser;
      const updatedUser = { ...prevUser, access: newAccessToken };
      // Update localStorage if remember me was enabled
      const sessionUser = localStorage.getItem('userSession');
      if (sessionUser) {
        localStorage.setItem('userSession', JSON.stringify(updatedUser));
      }
      return updatedUser;
    });
  }, []);

  // Logout handler
  const handleLogout = useCallback(() => {
    localStorage.removeItem('userSession');
    setUser(null);
    setDocuments([]);
    setActiveDocument(null);
  }, []);

  // Set up API callbacks
  useEffect(() => {
    apiClient.setTokenRefreshCallback(handleTokenRefresh);
    apiClient.setLogoutCallback(handleLogout);
  }, [handleTokenRefresh, handleLogout]);

  const fetchDocuments = useCallback((currentUser) => {
    if (!currentUser) return;
    setAppError('');
    apiClient.getDocuments(currentUser)
      .then(docs => {
        setDocuments(prevDocs => {
          // On initial load (no previous docs), set all completed documents to null status
          const isInitialLoad = prevDocs.length === 0;
          return docs.map(doc => {
            const prevDoc = prevDocs.find(d => d.id === doc.id);
            // If we previously cleared the status (set to null), don't override with 'completed' from API
            if (prevDoc && prevDoc.status === null && doc.status === 'completed') {
              return { ...doc, status: null };
            }
            // On initial load, don't show completed status to avoid mass green flash
            if (isInitialLoad && doc.status === 'completed') {
              return { ...doc, status: null };
            }
            return doc;
          });
        });
        // If there's an active document, update its data in the list
        setActiveDocument(prevActiveDoc => {
          if (prevActiveDoc) {
            const updatedActiveDoc = docs.find(d => d.id === prevActiveDoc.id);
            return updatedActiveDoc || prevActiveDoc;
          }
          return prevActiveDoc;
        });
      })
      .catch(err => {
        console.error(err);
        setAppError('Failed to load documents.');
      });
  }, []); // No dependencies - use functional updates instead

  // Hook to poll for document status updates and content generation
  useEffect(() => {
    if (!user || activePage !== 'Notes') return;

    // Poll when there are processing documents OR when we have an active document
    // (to catch content generation that doesn't change document status)
    const processingDocs = documents.some(doc => doc.status === 'processing');
    const hasActiveDocument = activeDocument !== null;
    
    if (!processingDocs && !hasActiveDocument) return;

    // Use a shorter interval when we have an active document to catch content updates faster
    const pollInterval = hasActiveDocument ? 3000 : 5000;
    const interval = setInterval(() => fetchDocuments(user), pollInterval); 

    return () => clearInterval(interval);
  }, [documents, user, activePage, activeDocument, fetchDocuments]);

  useEffect(() => {
    const darkModeSaved = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(darkModeSaved);

    const sessionUser = JSON.parse(localStorage.getItem('userSession'));
    if (sessionUser) {
      setUser(sessionUser);
    }
    setIsLoadingApp(false);
  }, []);
  
  useEffect(() => {
    if (user) {
      fetchDocuments(user);
    }
  }, [user, fetchDocuments]);
  
  // Auto-clear completed status after 3 seconds and revert to normal
  const documentsStatusKey = useMemo(() => 
    documents.map(d => d.id + d.status).join(','), 
    [documents]
  );
  
  useEffect(() => {
    const completedDocs = documents.filter(doc => doc.status === 'completed');
    if (completedDocs.length > 0) {
      // Use ref to track which documents we've already set timers for
      const timers = completedDocs.map(doc => {
        const timerId = setTimeout(() => {
          setDocuments(prevDocs => 
            prevDocs.map(d => 
              d.id === doc.id && d.status === 'completed' ? { ...d, status: null } : d
            )
          );
        }, 3000);
        return timerId;
      });
      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [documentsStatusKey, documents]);

  // Inject custom selection styles
  useEffect(() => {
    const styleId = 'custom-selection-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = customStyles;
      document.head.appendChild(style);
    }
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);
  
  // Use useLayoutEffect for instant, synchronous DOM updates BEFORE paint
  useLayoutEffect(() => {
      const htmlElement = document.documentElement;
      if (isDarkMode) {
          htmlElement.classList.add('dark');
      } else {
          htmlElement.classList.remove('dark');
      }
  }, [isDarkMode]);
  
  // Separate effect for localStorage (doesn't need to be synchronous)
  useEffect(() => {
      localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);
  
  // Optimized toggle function
  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const handleLogin = (userData, rememberMe) => {
    if (rememberMe) {
        localStorage.setItem('userSession', JSON.stringify(userData));
    }
    setUser(userData);
  };
  
  const handleUpload = async (file) => {
    try {
        // Add optimistic UI update with processing status
        const tempDoc = {
            id: `temp-${Date.now()}`,
            filename: file.name,
            status: 'processing',
            uploadDate: new Date().toISOString(),
            generated_content: []
        };
        setDocuments(prevDocs => [tempDoc, ...prevDocs]);
        
        const newDoc = await apiClient.uploadDocument(user, file);
        // Replace temp doc with real doc from backend
        setDocuments(prevDocs => prevDocs.map(doc => 
            doc.id === tempDoc.id ? newDoc : doc
        ));
    } catch (error) {
        console.error("Upload failed:", error);
        // Remove temp doc on failure
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== `temp-${Date.now()}`));
        alert(error.message || "Upload failed. Please try again.");
    }
  };

  const handleContentGenerated = (docId, newContent) => {
    // This function updates the state to reflect newly generated content
    const updateDocs = (prevDocs) => prevDocs.map(doc => {
        if (doc.id === docId) {
            const existingContent = doc.generated_content || [];
            // Remove any existing content of the same type and add the new one
            const filteredContent = existingContent.filter(c => c.contentType !== newContent.contentType);
            const newGeneratedContent = [...filteredContent, newContent];
            
            // Also update active document if it's the one
            if(activeDocument?.id === docId) {
                setActiveDocument(prevActive => ({...prevActive, generated_content: newGeneratedContent}));
            }
            return { ...doc, generated_content: newGeneratedContent };
        }
        return doc;
    });
    setDocuments(updateDocs);
  };

  const handleCreateNote = async (title = 'New Note') => {
    try {
        const newNote = await apiClient.createNote(user, title);
        // Add the new note to documents and set it as active
        setDocuments(prevDocs => [newNote, ...prevDocs]);
        setActiveDocument(newNote);
    } catch (error) {
        console.error("Create note failed:", error);
        alert(error.message || "Failed to create note. Please try again.");
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
        await apiClient.deleteDocument(user, docId);
        // Remove document from state
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
        // Clear active document if it was the deleted one
        if (activeDocument?.id === docId) {
            setActiveDocument(null);
        }
    } catch (error) {
        console.error("Delete failed:", error);
        alert(error.message || "Failed to delete document. Please try again.");
    }
  };
  
  const handleRenameDocument = async (docId, newName) => {
    try {
        // In a real app, you would call an API to rename the document
        // For now, we'll just update the local state
        const updatedDocs = documents.map(doc => {
            if (doc.id === docId) {
                const extension = doc.filename.split('.').pop();
                // Check if newName already has the extension to prevent duplication
                const newFilename = newName.endsWith(`.${extension}`) 
                    ? newName 
                    : `${newName}.${extension}`;
                return { ...doc, filename: newFilename };
            }
            return doc;
        });
        setDocuments(updatedDocs);
        
        // Update active document if it's the one being renamed
        if (activeDocument?.id === docId) {
            const extension = activeDocument.filename.split('.').pop();
            // Check if newName already has the extension to prevent duplication
            const newFilename = newName.endsWith(`.${extension}`) 
                ? newName 
                : `${newName}.${extension}`;
            setActiveDocument({ ...activeDocument, filename: newFilename });
        }
    } catch (error) {
        console.error("Rename failed:", error);
        alert(error.message || "Failed to rename document. Please try again.");
    }
  };
  
  if (isLoadingApp) {
      return <div className="h-screen w-screen flex items-center justify-center bg-gray-100 dark:bg-gray-850"><div className="text-gray-500 dark:text-gray-400">{icons.spinner}</div></div>;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderMainContent = () => {
      switch(activePage) {
          case 'Notes':
  return (
                  <div className="flex h-full bg-white dark:bg-gray-850 overflow-hidden">
                <div className="relative">
                    <DocumentList
                      documents={documents}
                            activeDocument={activeDocument} 
                            onSelectDocument={setActiveDocument}
                            onUpload={handleUpload}
                            onCreateNote={handleCreateNote}
                            onDeleteDocument={handleDeleteDocument}
                            onRenameDocument={handleRenameDocument}
                            isDarkMode={isDarkMode}
                    />
                </div>
                {/* Vertical Separator */}
                <div className="border-l border-gray-200 dark:border-gray-700 flex-shrink-0"></div>
                <DocumentViewer
                        document={activeDocument} 
                        user={user} 
                        onContentGenerated={handleContentGenerated} 
                        activeDocument={activeDocument}
                        onRenameDocument={handleRenameDocument}
                        renamingTitle={renamingTitle}
                        setRenamingTitle={setRenamingTitle}
                        titleNewName={titleNewName}
                        setTitleNewName={setTitleNewName}
                    />
                  </div>
              );
          case 'Settings':
              return <SettingsPage isDarkMode={isDarkMode} onToggleDarkMode={handleToggleDarkMode} />;
          case 'Profile':
              return <ProfilePage username={user.username} onLogout={handleLogout} />;
          default:
              return null;
      }
  };

  return (
    <div className={`flex h-screen w-screen font-sans text-gray-900 bg-gray-100 dark:bg-gray-950 transition-colors overflow-hidden`}>
        <Sidebar activePage={activePage} setActivePage={setActivePage} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header 
                username={user.username} 
                onLogout={handleLogout}
                isDarkMode={isDarkMode}
                onToggleDarkMode={handleToggleDarkMode}
                onSearch={(query) => apiClient.searchDocuments(user, query).then(setDocuments)}
                onClearSearch={() => fetchDocuments(user)}
                isCollapsed={isCollapsed}
              />
            <div className="flex-1 overflow-hidden p-4 bg-gray-100 dark:bg-gray-950 min-h-0">
                <div className="h-full w-full bg-white dark:bg-gray-850 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {renderMainContent()}
          </div>
        </div>
        </main>
    </div>
  );
};

export default App;

