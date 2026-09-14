import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import 'rsuite/dist/rsuite.css';
import { CustomProvider } from 'rsuite';
import zhCN from 'rsuite/locales/zh_CN';

createRoot(document.getElementById('root')!).render(
    <CustomProvider locale={zhCN}>
        <App />
    </CustomProvider>
);
