import { useState, useCallback, useEffect } from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Hook for local file system browsing
 */
export function useLocalExplorer(initialPath = os.homedir()) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    try {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });
      const mapped = items
        .filter(item => !item.name.startsWith('.'))
        .map(item => ({
          name: item.name,
          path: path.join(currentPath, item.name),
          isDirectory: item.isDirectory(),
          size: item.isDirectory() ? 0 : (() => {
            try { return fs.statSync(path.join(currentPath, item.name)).size; }
            catch { return 0; }
          })(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      // Add parent directory entry
      if (currentPath !== '/') {
        mapped.unshift({
          name: '..',
          path: path.dirname(currentPath),
          isDirectory: true,
          size: 0,
          isParent: true,
        });
      }

      setEntries(mapped);
      setError(null);
    } catch (err) {
      setError(err.message);
      setEntries([]);
    }
  }, [currentPath]);

  useEffect(() => {
    refresh();
  }, [currentPath, refresh]);

  const navigate = useCallback((dirPath) => {
    setCurrentPath(dirPath);
    setSelectedIndex(0);
  }, []);

  const enterSelected = useCallback(() => {
    const entry = entries[selectedIndex];
    if (entry && entry.isDirectory) {
      navigate(entry.path);
    }
    return entry;
  }, [entries, selectedIndex, navigate]);

  const moveUp = useCallback(() => {
    setSelectedIndex(prev => Math.max(0, prev - 1));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIndex(prev => Math.min(entries.length - 1, prev + 1));
  }, [entries.length]);

  const getSelected = useCallback(() => {
    return entries[selectedIndex] || null;
  }, [entries, selectedIndex]);

  return {
    currentPath,
    entries,
    selectedIndex,
    error,
    navigate,
    enterSelected,
    moveUp,
    moveDown,
    getSelected,
    refresh,
    setSelectedIndex,
  };
}

/**
 * Hook for remote file system browsing
 */
export function useRemoteExplorer(fileTransfer) {
  const [currentPath, setCurrentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!fileTransfer) return;

    setLoading(true);
    setError(null);

    try {
      let targetPath = currentPath;
      if (!targetPath) {
        targetPath = await fileTransfer.getHomeDir();
        setCurrentPath(targetPath);
      }

      const items = await fileTransfer.listRemote(targetPath);
      
      // Add parent directory
      const mapped = [...items];
      if (targetPath !== '/') {
        mapped.unshift({
          name: '..',
          path: path.posix.dirname(targetPath),
          isDirectory: true,
          size: 0,
          isParent: true,
        });
      }

      setEntries(mapped);
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath, fileTransfer]);

  useEffect(() => {
    if (fileTransfer) {
      refresh();
    }
  }, [currentPath, fileTransfer, refresh]);

  const navigate = useCallback((dirPath) => {
    setCurrentPath(dirPath);
    setSelectedIndex(0);
  }, []);

  const enterSelected = useCallback(() => {
    const entry = entries[selectedIndex];
    if (entry && entry.isDirectory) {
      navigate(entry.path);
    }
    return entry;
  }, [entries, selectedIndex, navigate]);

  const moveUp = useCallback(() => {
    setSelectedIndex(prev => Math.max(0, prev - 1));
  }, []);

  const moveDown = useCallback(() => {
    setSelectedIndex(prev => Math.min(entries.length - 1, prev + 1));
  }, [entries.length]);

  const getSelected = useCallback(() => {
    return entries[selectedIndex] || null;
  }, [entries, selectedIndex]);

  return {
    currentPath,
    entries,
    selectedIndex,
    loading,
    error,
    navigate,
    enterSelected,
    moveUp,
    moveDown,
    getSelected,
    refresh,
    setSelectedIndex,
  };
}
