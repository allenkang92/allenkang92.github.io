import React from 'react';
import { createRoot } from 'react-dom/client';
import Posts from '../components/Posts';

const container = document.getElementById('posts-root');
const root = createRoot(container);
root.render(<Posts />);
