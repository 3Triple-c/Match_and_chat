const safeStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return null;
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return null;
    }
  },
};

export default safeStorage;
