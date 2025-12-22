import { create } from "zustand";

interface User {
  sub: string;
  username: string;
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
      const response = await fetch("/auth/me", {
        credentials: "include",
      });

      if (response.ok) {
        const user = await response.json();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    window.location.href = "/auth/logout";
  },
}));
