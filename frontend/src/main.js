import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(HelmetProvider, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(AuthProvider, { children: _jsx(CartProvider, { children: _jsx(App, {}) }) }) }) }) }));
//# sourceMappingURL=main.js.map