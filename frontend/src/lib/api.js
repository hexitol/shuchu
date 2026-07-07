import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const WS_BASE = BACKEND_URL.replace(/^http/, "ws");

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const user = localStorage.getItem("study_user");
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed?.id) config.headers["X-User-Id"] = parsed.id;
    } catch (e) {
      // ignore
    }
  }
  return config;
});
