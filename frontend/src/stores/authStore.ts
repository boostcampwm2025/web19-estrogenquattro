import { create } from "zustand";
import { devLogger } from "@/lib/devLogger";
import { Analytics } from "@/lib/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface User {
  sub: string;
  username: string;
  avatarUrl: string;
  playerId: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const user = await response.json();
        set({ user, isAuthenticated: true, isLoading: false });
        Analytics.authSuccess();
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
        Analytics.authFailed(`http_${response.status}`);
      }
    } catch (error) {
      devLogger.error("Failed to fetch user", { error });
      set({ user: null, isAuthenticated: false, isLoading: false });
      Analytics.authFailed("network_error");
    }
  },

  logout: () => {
    window.location.href = `${API_URL}/auth/logout`;
  },
}));
